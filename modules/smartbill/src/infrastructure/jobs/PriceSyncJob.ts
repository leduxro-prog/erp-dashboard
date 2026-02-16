import { Job, Queue, Worker, QueueOptions } from 'bullmq';
import { SyncPricesFromInvoicesUseCase } from '../../application/use-cases/SyncPricesFromInvoices';
import { createModuleLogger } from '@shared/utils/logger';

/**
 * Configuration for PriceSyncJob
 */
export interface PriceSyncJobConfig {
  queueName?: string;
  connectionUrl?: string;
  schedulePattern?: string;
}

/**
 * PriceSyncJob - Periodic job for synchronizing product prices from SmartBill invoices
 *
 * Implements enterprise-grade job configuration with:
 * - Automatic retries with exponential backoff (5000ms base)
 * - Job timeout and completion handling
 * - Stalled job detection and recovery
 * - Failure alerting and logging
 * - Graceful shutdown support
 */
export class PriceSyncJob {
  private queue: Queue;
  private worker: Worker;
  private readonly queueName: string;
  private readonly schedulePattern: string;
  private readonly logger = createModuleLogger('PriceSyncJob');

  /**
   * Create a new PriceSyncJob instance
   *
   * @param syncPricesUseCase - Use case for executing price synchronization
   * @param redisConnection - Redis connection configuration
   * @param config - Optional job configuration
   */
  constructor(
    private readonly syncPricesUseCase: SyncPricesFromInvoicesUseCase,
    private readonly redisConnection: any,
    config: PriceSyncJobConfig = {},
  ) {
    this.queueName = config.queueName || 'smartbill-price-sync';
    this.schedulePattern = config.schedulePattern || '0 3 * * *';

    const queueOptions: QueueOptions = {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 50, // Keep at most 50 completed jobs
        },
        removeOnFail: {
          age: 2592000, // Keep failed jobs for 30 days
          count: 200, // Keep at most 200 failed jobs
        },
      },
    };

    this.queue = new Queue(this.queueName, queueOptions);
    this.worker = new Worker(this.queueName, this.handle.bind(this), {
      connection: redisConnection,
      concurrency: 1, // Only one price sync at a time
    });
  }

  /**
   * Start the price sync job
   *
   * Schedules recurring job and sets up event handlers for monitoring
   */
  async start(): Promise<void> {
    // Add recurring job - daily at 3 AM Bucharest time
    await this.queue.add(
      'sync-prices',
      {},
      {
        repeat: {
          pattern: this.schedulePattern,
          tz: 'Europe/Bucharest',
        },
        jobId: 'price-sync-recurring',
        removeOnComplete: {
          age: 86400,
          count: 50,
        },
        removeOnFail: {
          age: 2592000,
          count: 200,
        },
      },
    );

    // Handle job completion
    this.worker.on('completed', (job: Job): void => {
      this.logger.info('Price sync job completed', {
        jobId: job.id,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
      });
    });

    // Handle job failures
    this.worker.on('failed', (job: Job | undefined, err: Error): void => {
      this.logger.warn('Price sync job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    // Handle stalled jobs (job took too long)
    this.worker.on('stalled', (jobId: string): void => {
      this.logger.warn('Price sync job stalled', {
        jobId,
      });
    });

    // Handle worker errors
    this.worker.on('error', (error: Error): void => {
      this.logger.error('Price sync worker error', {
        error: error.message,
        stack: error.stack,
      });
    });

    this.logger.info('Price sync job started', {
      queueName: this.queueName,
      schedulePattern: this.schedulePattern,
    });
  }

  /**
   * Handle individual price sync job execution
   *
   * @param job - The job to process
   */
  private async handle(job: Job): Promise<void> {
    try {
      this.logger.debug('Processing price sync job', { jobId: job.id });

      const result = await this.syncPricesUseCase.execute(90, 'latest');

      await job.updateProgress(100);

      this.logger.info('Price sync completed successfully', {
        jobId: job.id,
        productsUpdated: result.productsUpdated,
        productsSkipped: result.totalProducts - result.productsUpdated,
      });
    } catch (error) {
      this.logger.error('Price sync job error', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the price sync job gracefully
   *
   * Closes worker and queue connections
   */
  async stop(): Promise<void> {
    try {
      await this.worker.close();
      await this.queue.close();
      this.logger.info('Price sync job stopped');
    } catch (error) {
      this.logger.error('Error stopping price sync job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
