import { createModuleLogger } from '@shared/utils/logger';
import { Queue, Worker, Job, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { ScrapeSupplierStock } from '../../application';
import { ISupplierRepository } from '../../domain';
import { ScraperFactory } from '../scrapers/ScraperFactory';

/**
 * Data for supplier sync job
 */
export interface SyncJobData {
  supplierId?: number;
  syncAll?: boolean;
}

/**
 * Result of supplier sync job
 */
export interface SyncJobResult {
  success: boolean;
  totalSuppliers: number;
  successCount: number;
  failureCount: number;
  timestamp: Date;
  details: Array<{
    supplierId: number;
    supplierName: string;
    success: boolean;
    error?: string;
    productsFound?: number;
    productsUpdated?: number;
    priceChanges?: number;
    significantPriceChanges?: number;
    smartbillOverlap?: number;
    duration?: number;
  }>;
}

interface SupplierSyncReportPayload {
  supplierId: number;
  supplierName: string;
  syncType: string;
  success: boolean;
  productsFound: number;
  productsUpdated: number;
  priceChanges: number;
  significantPriceChanges: number;
  specificationsDetected?: number;
  specificationsUpdated?: number;
  specificationCoveragePct?: number;
  durationMs: number;
  errorMessage?: string;
}

/**
 * SupplierSyncJob - Periodic job for synchronizing supplier pricing and inventory
 *
 * Implements enterprise-grade job configuration with:
 * - Automatic retries with exponential backoff
 * - Job timeout and completion handling
 * - Rate limiting to prevent overload
 * - Stalled job detection and recovery
 * - Failure alerting and logging
 * - Graceful shutdown support
 */
export class SupplierSyncJob {
  private queue: Queue<SyncJobData>;
  private worker: Worker<SyncJobData, SyncJobResult>;
  private lockRedis: Redis;
  private readonly logger = createModuleLogger('SupplierSyncJob');
  private readonly supplierLockTtlMs: number;
  private readonly monitorTargetSupplierCode: string;
  private readonly minExpectedSupplierProducts: number;
  private readonly monitorFailureWindow: number;
  private readonly monitorConsecutiveFailuresThreshold: number;
  private readonly monitorTimeoutFailuresThreshold: number;
  private readonly minSpecificationCoveragePct: number;
  private readonly monitorAlertCooldownMs: number;
  private readonly lastMonitorAlertByKey = new Map<string, number>();

  /**
   * Create a new SupplierSyncJob instance
   *
   * @param repository - Supplier repository for data access
   * @param redisConfig - Optional Redis configuration
   */
  constructor(
    private repository: ISupplierRepository,
    redisConfig?: { host: string; port: number; password?: string },
  ) {
    const redis = redisConfig || { host: 'localhost', port: 6379 };
    this.supplierLockTtlMs = this.parsePositiveIntEnv('SUPPLIER_SYNC_LOCK_TTL_MS', 25 * 60 * 1000);
    this.monitorTargetSupplierCode = String(
      process.env.SUPPLIER_MONITOR_TARGET_CODE || 'aca-lighting',
    ).toLowerCase();
    this.minExpectedSupplierProducts = this.parsePositiveIntEnv(
      'SUPPLIER_MONITOR_MIN_PRODUCTS',
      1000,
    );
    this.monitorFailureWindow = this.parsePositiveIntEnv('SUPPLIER_MONITOR_FAILURE_WINDOW', 8);
    this.monitorConsecutiveFailuresThreshold = this.parsePositiveIntEnv(
      'SUPPLIER_MONITOR_CONSECUTIVE_FAILURES',
      3,
    );
    this.monitorTimeoutFailuresThreshold = this.parsePositiveIntEnv(
      'SUPPLIER_MONITOR_TIMEOUT_FAILURES',
      2,
    );
    this.minSpecificationCoveragePct = this.parsePositiveIntEnv(
      'SUPPLIER_MONITOR_MIN_SPEC_COVERAGE_PCT',
      45,
    );
    this.monitorAlertCooldownMs = this.parsePositiveIntEnv(
      'SUPPLIER_MONITOR_ALERT_COOLDOWN_MS',
      30 * 60 * 1000,
    );

    this.lockRedis = new Redis({
      host: redis.host,
      port: redis.port,
      password: redis.password,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    const queueOptions: QueueOptions = {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 500,
        },
      },
    };

    this.queue = new Queue('supplier-sync', queueOptions);
    this.worker = new Worker('supplier-sync', this.jobHandler.bind(this), {
      connection: redis,
      concurrency: 2, // Allow 2 concurrent supplier syncs
    });

    this.setupEventListeners();
  }

  private parsePositiveIntEnv(name: string, fallback: number): number {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
  }

  private supplierLockKey(supplierId: number): string {
    return `supplier-sync:lock:${supplierId}`;
  }

  private async acquireSupplierLock(supplierId: number): Promise<string | null> {
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const key = this.supplierLockKey(supplierId);

    const result = await this.lockRedis.set(key, token, 'PX', this.supplierLockTtlMs, 'NX');
    if (result === 'OK') {
      return token;
    }

    return null;
  }

  private async releaseSupplierLock(supplierId: number, token: string): Promise<void> {
    const key = this.supplierLockKey(supplierId);
    const releaseScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    `;

    try {
      await this.lockRedis.eval(releaseScript, 1, key, token);
    } catch (error) {
      this.logger.warn('Failed to release supplier sync lock', {
        supplierId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private shouldMonitorSupplier(supplierCode: string | null | undefined): boolean {
    return String(supplierCode || '')
      .trim()
      .toLowerCase() === this.monitorTargetSupplierCode;
  }

  private shouldEmitMonitorAlert(key: string): boolean {
    const now = Date.now();
    const lastAt = this.lastMonitorAlertByKey.get(key) || 0;
    if (now - lastAt < this.monitorAlertCooldownMs) {
      return false;
    }

    this.lastMonitorAlertByKey.set(key, now);
    return true;
  }

  private isTimeoutLikeError(message: string): boolean {
    const normalized = String(message || '').toLowerCase();
    return (
      normalized.includes('query read timeout') ||
      normalized.includes('statement timeout') ||
      normalized.includes('canceling statement')
    );
  }

  private async evaluateSupplierHealthForAlerting(
    supplier: { id: number; name: string; code?: string | null },
  ): Promise<void> {
    if (!this.shouldMonitorSupplier(supplier.code)) {
      return;
    }

    const repositoryWithMonitoring = this.repository as ISupplierRepository & {
      getSupplierCoverageStats?: (supplierId: number) => Promise<{
        supplierProducts: number;
        supplierStockCache: number;
        lastCacheUpdateAt: Date | null;
      }>;
      getSupplierSpecificationCoverageStats?: (supplierId: number) => Promise<{
        supplierProducts: number;
        productsWithSpecs: number;
        missingSpecs: number;
        coveragePct: number;
      }>;
    };

    try {
      if (typeof repositoryWithMonitoring.getSupplierCoverageStats === 'function') {
        const stats = await repositoryWithMonitoring.getSupplierCoverageStats(supplier.id);

        if (stats.supplierProducts < this.minExpectedSupplierProducts) {
          const alertKey = `coverage:${supplier.id}`;
          if (this.shouldEmitMonitorAlert(alertKey)) {
            this.logger.error('SUPPLIER_SYNC_ALERT: product coverage below expected threshold', {
              supplierId: supplier.id,
              supplierName: supplier.name,
              supplierCode: supplier.code,
              supplierProducts: stats.supplierProducts,
              supplierStockCache: stats.supplierStockCache,
              minExpectedSupplierProducts: this.minExpectedSupplierProducts,
              lastCacheUpdateAt: stats.lastCacheUpdateAt?.toISOString() || null,
            });
          }
        }
      }

      if (typeof repositoryWithMonitoring.getSupplierSpecificationCoverageStats === 'function') {
        const specStats = await repositoryWithMonitoring.getSupplierSpecificationCoverageStats(supplier.id);

        if (specStats.coveragePct < this.minSpecificationCoveragePct) {
          const alertKey = `spec-coverage:${supplier.id}`;
          if (this.shouldEmitMonitorAlert(alertKey)) {
            this.logger.error('SUPPLIER_SYNC_ALERT: specification coverage below expected threshold', {
              supplierId: supplier.id,
              supplierName: supplier.name,
              supplierCode: supplier.code,
              supplierProducts: specStats.supplierProducts,
              productsWithSpecs: specStats.productsWithSpecs,
              missingSpecs: specStats.missingSpecs,
              coveragePct: specStats.coveragePct,
              minSpecificationCoveragePct: this.minSpecificationCoveragePct,
            });
          }
        }
      }

      const reports = await this.repository.getSyncReports(supplier.id, this.monitorFailureWindow);
      if (!reports.length) {
        return;
      }

      let consecutiveFailures = 0;
      for (const report of reports) {
        if (String(report.syncStatus || '').toLowerCase() === 'success') {
          break;
        }
        consecutiveFailures += 1;
      }

      if (consecutiveFailures >= this.monitorConsecutiveFailuresThreshold) {
        const alertKey = `consecutive-failures:${supplier.id}`;
        if (this.shouldEmitMonitorAlert(alertKey)) {
          this.logger.error('SUPPLIER_SYNC_ALERT: consecutive supplier sync failures detected', {
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierCode: supplier.code,
            consecutiveFailures,
            threshold: this.monitorConsecutiveFailuresThreshold,
          });
        }
      }

      const timeoutFailures = reports.filter(
        (report) =>
          String(report.syncStatus || '').toLowerCase() !== 'success' &&
          this.isTimeoutLikeError(String(report.errorMessage || '')),
      ).length;

      if (timeoutFailures >= this.monitorTimeoutFailuresThreshold) {
        const alertKey = `timeout-failures:${supplier.id}`;
        if (this.shouldEmitMonitorAlert(alertKey)) {
          this.logger.error('SUPPLIER_SYNC_ALERT: repeated timeout-like failures detected', {
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierCode: supplier.code,
            timeoutFailures,
            threshold: this.monitorTimeoutFailuresThreshold,
            sampledReports: reports.map((report) => ({
              createdAt: report.createdAt,
              syncStatus: report.syncStatus,
              errorMessage: report.errorMessage || null,
            })),
          });
        }
      }
    } catch (error) {
      this.logger.warn('Supplier sync monitor evaluation failed', {
        supplierId: supplier.id,
        supplierCode: supplier.code,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Setup event listeners for job monitoring
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job: Job<SyncJobData>): void => {
      this.logger.info('Supplier sync job completed', {
        jobId: job.id,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
      });
    });

    this.worker.on('failed', (job: Job<SyncJobData> | undefined, err: Error): void => {
      this.logger.warn('Supplier sync job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('stalled', (jobId: string): void => {
      this.logger.warn('Supplier sync job stalled', { jobId });
    });

    this.worker.on('error', (error: Error): void => {
      this.logger.error('Supplier sync worker error', {
        error: error.message,
        stack: error.stack,
      });
    });
  }

  /**
   * Schedule periodic supplier sync
   *
   * Syncs all active suppliers every 4 hours between 06:00-22:00
   */
  async scheduleSync(): Promise<void> {
    // Schedule sync job every 4 hours, only between 06:00-22:00
    await this.queue.add(
      'sync-all',
      { syncAll: true },
      {
        repeat: {
          pattern: '0 0 6-21/4 * * *', // Every 4 hours from 06:00-22:00
        },
        jobId: 'supplier-sync-recurring',
        removeOnComplete: {
          age: 86400,
          count: 100,
        },
        removeOnFail: {
          age: 604800,
          count: 500,
        },
      },
    );

    this.logger.info('Supplier sync job scheduled');
  }

  async disableRecurringSync(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const recurringJobs = repeatableJobs.filter(
      (job) => job.name === 'sync-all' || job.id === 'supplier-sync-recurring',
    );

    for (const job of recurringJobs) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    if (recurringJobs.length > 0) {
      this.logger.info('Supplier sync recurring jobs disabled', {
        removed: recurringJobs.length,
      });
    }
  }

  private async jobHandler(job: Job<SyncJobData>): Promise<SyncJobResult> {
    const startTime = new Date();
    const syncType = job.name === 'manual-sync' ? 'MANUAL' : 'AUTO';

    try {
      const result: SyncJobResult = {
        success: true,
        totalSuppliers: 0,
        successCount: 0,
        failureCount: 0,
        timestamp: startTime,
        details: [],
      };

      // Get current hour to check if sync should run
      const hour = new Date().getHours();
      if (hour < 6 || hour >= 22) {
        this.logger.info(`Sync skipped: outside sync window (current hour: ${hour})`);
        result.success = false;
        return result;
      }

      const scraperFactory = new ScraperFactory();
      const scrapeUseCase = new ScrapeSupplierStock(
        this.repository,
        scraperFactory as any,
      );

      if (job.data.syncAll) {
        // Sync all active suppliers
        const suppliers = await this.repository.listSuppliers(true);
        const supportedSuppliers = suppliers.filter((supplier) =>
          scraperFactory.supportsSupplier(String(supplier.code)),
        );
        result.totalSuppliers = supportedSuppliers.length;

        const skippedSuppliers = suppliers.filter(
          (supplier) => !scraperFactory.supportsSupplier(String(supplier.code)),
        );

        for (const supplier of skippedSuppliers) {
          result.failureCount++;
          const smartbillOverlap = await this.recordSupplierSyncReport({
            supplierId: supplier.id,
            supplierName: supplier.name,
            syncType,
            success: false,
            productsFound: 0,
            productsUpdated: 0,
            priceChanges: 0,
            significantPriceChanges: 0,
            durationMs: 0,
            errorMessage: `Unsupported supplier code: ${supplier.code}`,
          });

          result.details.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: false,
            error: `Unsupported supplier code: ${supplier.code}`,
            smartbillOverlap,
          });
        }

        for (const supplier of supportedSuppliers) {
          const lockToken = await this.acquireSupplierLock(supplier.id);
          if (!lockToken) {
            result.failureCount++;
            result.details.push({
              supplierId: supplier.id,
              supplierName: supplier.name,
              success: false,
              error: 'Sync skipped: another sync for this supplier is already running',
            });
            continue;
          }

          try {
            const scrapeResult = await scrapeUseCase.execute(supplier.id);
            const smartbillOverlap = await this.recordSupplierSyncReport({
              supplierId: supplier.id,
              supplierName: supplier.name,
              syncType,
              success: true,
              productsFound: scrapeResult.productsFound,
              productsUpdated: scrapeResult.productsUpdated,
              priceChanges: scrapeResult.priceChanges.length,
              significantPriceChanges: scrapeResult.significantPriceChanges.length,
              specificationsDetected: scrapeResult.specificationsDetected,
              specificationsUpdated: scrapeResult.specificationsUpdated,
              durationMs: scrapeResult.duration,
            });

            result.successCount++;
            result.details.push({
              supplierId: supplier.id,
              supplierName: supplier.name,
              success: true,
              productsFound: scrapeResult.productsFound,
              productsUpdated: scrapeResult.productsUpdated,
              priceChanges: scrapeResult.priceChanges.length,
              significantPriceChanges: scrapeResult.significantPriceChanges.length,
              smartbillOverlap,
              duration: scrapeResult.duration,
            });

            // Emit event if there are significant price changes
            if (scrapeResult.significantPriceChanges.length > 0) {
              this.emitPriceChangeAlert(supplier.name, scrapeResult);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const smartbillOverlap = await this.recordSupplierSyncReport({
              supplierId: supplier.id,
              supplierName: supplier.name,
              syncType,
              success: false,
              productsFound: 0,
              productsUpdated: 0,
              priceChanges: 0,
              significantPriceChanges: 0,
              durationMs: 0,
              errorMessage: message,
            });

            result.failureCount++;
            result.details.push({
              supplierId: supplier.id,
              supplierName: supplier.name,
              success: false,
              error: message,
              smartbillOverlap,
            });
          } finally {
            await this.releaseSupplierLock(supplier.id, lockToken);
            await this.evaluateSupplierHealthForAlerting({
              id: supplier.id,
              name: supplier.name,
              code: String(supplier.code || ''),
            });
          }
        }
      } else if (job.data.supplierId) {
        // Sync single supplier
        const supplier = await this.repository.getSupplier(job.data.supplierId);

        if (!supplier) {
          throw new Error(
            `Supplier ${job.data.supplierId} not found`,
          );
        }

        if (!scraperFactory.supportsSupplier(String(supplier.code))) {
          const smartbillOverlap = await this.recordSupplierSyncReport({
            supplierId: supplier.id,
            supplierName: supplier.name,
            syncType,
            success: false,
            productsFound: 0,
            productsUpdated: 0,
            priceChanges: 0,
            significantPriceChanges: 0,
            durationMs: 0,
            errorMessage: `Unsupported supplier code: ${supplier.code}`,
          });

          result.totalSuppliers = 1;
          result.failureCount = 1;
          result.details.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: false,
            error: `Unsupported supplier code: ${supplier.code}`,
            smartbillOverlap,
          });
          result.success = false;
          return result;
        }

        const lockToken = await this.acquireSupplierLock(supplier.id);
        if (!lockToken) {
          result.totalSuppliers = 1;
          result.failureCount = 1;
          result.details.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: false,
            error: 'Sync skipped: another sync for this supplier is already running',
          });
          result.success = false;
          return result;
        }

        try {
          const scrapeResult = await scrapeUseCase.execute(supplier.id);
          const smartbillOverlap = await this.recordSupplierSyncReport({
            supplierId: supplier.id,
            supplierName: supplier.name,
            syncType,
            success: true,
            productsFound: scrapeResult.productsFound,
            productsUpdated: scrapeResult.productsUpdated,
            priceChanges: scrapeResult.priceChanges.length,
            significantPriceChanges: scrapeResult.significantPriceChanges.length,
            specificationsDetected: scrapeResult.specificationsDetected,
            specificationsUpdated: scrapeResult.specificationsUpdated,
            durationMs: scrapeResult.duration,
          });

          result.totalSuppliers = 1;
          result.successCount = 1;
          result.details.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: true,
            productsFound: scrapeResult.productsFound,
            productsUpdated: scrapeResult.productsUpdated,
            priceChanges: scrapeResult.priceChanges.length,
            significantPriceChanges: scrapeResult.significantPriceChanges.length,
            smartbillOverlap,
            duration: scrapeResult.duration,
          });

          if (scrapeResult.significantPriceChanges.length > 0) {
            this.emitPriceChangeAlert(supplier.name, scrapeResult);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          const smartbillOverlap = await this.recordSupplierSyncReport({
            supplierId: supplier.id,
            supplierName: supplier.name,
            syncType,
            success: false,
            productsFound: 0,
            productsUpdated: 0,
            priceChanges: 0,
            significantPriceChanges: 0,
            durationMs: 0,
            errorMessage: message,
          });

          result.totalSuppliers = 1;
          result.failureCount = 1;
          result.details.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: false,
            error: message,
            smartbillOverlap,
          });
        } finally {
          await this.releaseSupplierLock(supplier.id, lockToken);
          await this.evaluateSupplierHealthForAlerting({
            id: supplier.id,
            name: supplier.name,
            code: String(supplier.code || ''),
          });
        }
      }

      if (result.failureCount > 0) {
        result.success = false;
      }

      return result;
    } catch (error) {
      this.logger.error('Sync job error:', error);
      throw error;
    }
  }

  private emitPriceChangeAlert(supplierName: string, result: any): void {
    // In production, this would emit to a message queue or notification service
    this.logger.warn(`Price change alert for ${supplierName}:`, result.significantPriceChanges);
  }

  private async getSmartBillOverlapCount(supplierId: number): Promise<number> {
    const repositoryWithMetrics = this.repository as ISupplierRepository & {
      getSmartBillOverlapCount?: (supplierId: number) => Promise<number>;
    };

    if (typeof repositoryWithMetrics.getSmartBillOverlapCount !== 'function') {
      return 0;
    }

    try {
      const overlap = await repositoryWithMetrics.getSmartBillOverlapCount(supplierId);
      return Number.isFinite(overlap) ? overlap : 0;
    } catch {
      return 0;
    }
  }

  private async recordSupplierSyncReport(payload: SupplierSyncReportPayload): Promise<number> {
    const smartbillOverlap = await this.getSmartBillOverlapCount(payload.supplierId);
    const repositoryWithMetrics = this.repository as ISupplierRepository & {
      getSupplierSpecificationCoverageStats?: (supplierId: number) => Promise<{
        supplierProducts: number;
        productsWithSpecs: number;
        missingSpecs: number;
        coveragePct: number;
      }>;
    };

    let specificationCoveragePct = payload.specificationCoveragePct;
    if (typeof repositoryWithMetrics.getSupplierSpecificationCoverageStats === 'function') {
      try {
        const coverage = await repositoryWithMetrics.getSupplierSpecificationCoverageStats(
          payload.supplierId,
        );
        specificationCoveragePct = coverage.coveragePct;
      } catch {
        // best effort metrics enrichment
      }
    }

    const report = {
      ...payload,
      smartbillOverlap,
      specificationCoveragePct,
      recordedAt: new Date().toISOString(),
    };

    this.logger.info('Supplier sync report', report);

    const repositoryWithReport = this.repository as ISupplierRepository & {
      saveSyncReport?: (report: SupplierSyncReportPayload & { smartbillOverlap: number }) => Promise<void>;
    };

    if (typeof repositoryWithReport.saveSyncReport === 'function') {
      await repositoryWithReport.saveSyncReport({
        ...payload,
        smartbillOverlap,
        specificationCoveragePct,
      });
    }

    return smartbillOverlap;
  }

  /**
   * Trigger manual supplier sync
   *
   * @param supplierId - Optional supplier ID to sync single supplier
   * @returns The created job
   */
  async triggerSync(supplierId?: number): Promise<Job<SyncJobData>> {
    const data: SyncJobData = supplierId
      ? { supplierId }
      : { syncAll: true };

    return this.queue.add('manual-sync', data, {
      priority: 10,
      removeOnComplete: {
        age: 3600, // Keep for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 604800,
        count: 500,
      },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  /**
   * Close the job gracefully
   */
  async close(): Promise<void> {
    try {
      await this.worker.close();
      await this.queue.close();
      await this.lockRedis.quit();
      this.logger.info('Supplier sync job closed');
    } catch (error) {
      this.logger.error('Error closing supplier sync job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
