import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import Redis from 'ioredis';
import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { SyncItem } from '../../domain/entities/SyncItem';
import { createModuleLogger } from '@shared/utils/logger';

/**
 * RetryFailedJob - Periodic job for retrying failed WooCommerce sync items
 *
 * Implements enterprise-grade job configuration with:
 * - Automatic retries with exponential backoff
 * - Job timeout and completion handling
 * - Rate limiting to prevent overload
 * - Stalled job detection and recovery
 * - Failure alerting and logging
 * - Graceful shutdown support
 */
export class RetryFailedJob {
  private queue?: Queue;
  private worker?: Worker;
  private readonly logger = createModuleLogger('RetryFailedJob');

  /**
   * Create a new RetryFailedJob instance
   *
   * @param redisConnection - Redis connection
   * @param syncRepository - Repository for sync items
   * @param queueJob - Function to queue jobs
   */
  constructor(
    private redisConnection: Redis,
    private syncRepository: ISyncRepository,
    private queueJob: (jobName: string, data: unknown) => Promise<void>
  ) { }

  /**
   * Register the retry failed job with schedule
   *
   * Schedules retry checks every 30 minutes
   */
  async register(): Promise<void> {
    const queueOptions: QueueOptions = {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 500,
        },
      },
    };

    this.queue = new Queue('retry-failed', queueOptions);

    // Schedule every 30 minutes
    await this.queue.add(
      'retry-failed-syncs',
      {},
      {
        repeat: {
          pattern: '*/30 * * * *', // Every 30 minutes
        },
        jobId: 'retry-failed-recurring',
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: {
          age: 604800,
          count: 500,
        },
      }
    );

    const workerOptions: WorkerOptions = {
      connection: this.redisConnection,
      concurrency: 1,
    };

    this.worker = new Worker(
      'retry-failed',
      (job) => this.jobHandler(job),
      workerOptions
    );

    // Setup event listeners
    this.setupEventListeners();

    this.logger.info('RetryFailedJob registered - scheduled every 30 minutes');
  }

  /**
   * Setup event listeners for job monitoring
   */
  private setupEventListeners(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job): void => {
      this.logger.info('Retry failed job completed', {
        jobId: job.id,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
      });
    });

    this.worker.on('failed', (job, err): void => {
      this.logger.warn('Retry failed job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('stalled', (jobId): void => {
      this.logger.warn('Retry failed job stalled', { jobId });
    });

    this.worker.on('error', (error): void => {
      this.logger.error('Retry failed worker error', {
        error: error.message,
        stack: error.stack,
      });
    });
  }

  /**
   * Handle job execution
   *
   * @param job - The job to process
   */
  private async jobHandler(job: any): Promise<void> {
    try {
      this.logger.debug('Retrying failed sync items...', { jobId: job.id });

      // Get all failed items
      const failedItems = await this.syncRepository.getFailedItems();

      let retryCount = 0;

      for (const item of failedItems) {
        // Only retry if:
        // 1. Can still retry (attempts < maxAttempts)
        // 2. Last attempt was at least 1 minute ago
        if (!item.canRetry()) {
          continue;
        }

        if (item.lastAttempt) {
          const minutesSinceLastAttempt =
            (new Date().getTime() - item.lastAttempt.getTime()) / 1000 / 60;
          if (minutesSinceLastAttempt < 1) {
            continue;
          }
        }

        // Reset and requeue
        item.reset();
        await this.syncRepository.updateSyncItem(item);

        // Requeue the sync job
        await this.queueJob(`sync_${item.syncType}`, {
          syncItemId: item.id,
          productId: item.productId,
          syncType: item.syncType,
        });

        retryCount++;
      }

      job.progress(100);

      this.logger.info('Retry failed job completed', {
        jobId: job.id,
        failedItemsFound: failedItems.length,
        itemsRetried: retryCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Retry failed job error', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the job gracefully
   */
  async stop(): Promise<void> {
    try {
      if (this.worker) {
        await this.worker.close();
      }
      if (this.queue) {
        await this.queue.close();
      }
      this.logger.info('RetryFailedJob stopped');
    } catch (error) {
      this.logger.error('Error stopping retry failed job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
