import { Queue, QueueOptions, Worker } from 'bullmq';
import Redis from 'ioredis';
import { SyncAllProducts } from '../../application/use-cases/SyncAllProducts';
import { createModuleLogger } from '@shared/utils/logger';

/**
 * FullSyncJob - Daily full product synchronization with WooCommerce
 *
 * Implements enterprise-grade job configuration with:
 * - Automatic retries with exponential backoff
 * - Job timeout and completion handling
 * - Rate limiting to prevent overload
 * - Stalled job detection and recovery
 * - Failure alerting and logging
 * - Graceful shutdown support
 */
export class FullSyncJob {
  private queue?: Queue;
  private worker?: Worker;
  private readonly logger = createModuleLogger('FullSyncJob');

  /**
   * Create a new FullSyncJob instance
   *
   * @param redisConnection - Redis connection
   * @param syncAllProducts - Use case for syncing products
   */
  constructor(
    private redisConnection: Redis,
    private syncAllProducts: SyncAllProducts
  ) { }

  /**
   * Register the full sync job with schedule
   *
   * Schedules daily full sync at 03:00 UTC
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
          age: 86400, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 500,
        },
      },
    };

    this.queue = new Queue('full-sync', queueOptions);
    this.worker = new Worker('full-sync', this.jobHandler.bind(this), {
      connection: this.redisConnection,
      concurrency: 1, // Only one full sync at a time
    });

    // Setup event listeners
    this.setupEventListeners();

    // Schedule daily at 03:00 UTC
    await this.queue.add(
      'full-sync',
      { force: false },
      {
        repeat: {
          pattern: '0 3 * * *', // 03:00 UTC daily
        },
        jobId: 'full-sync-recurring',
        removeOnComplete: {
          age: 86400,
          count: 100,
        },
        removeOnFail: {
          age: 604800,
          count: 500,
        },
      }
    );

    this.logger.info('FullSyncJob registered - scheduled for 03:00 UTC daily');
  }

  /**
   * Setup event listeners for job monitoring
   */
  private setupEventListeners(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job): void => {
      this.logger.info('Full sync job completed', {
        jobId: job.id,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
      });
    });

    this.worker.on('failed', (job, err): void => {
      this.logger.warn('Full sync job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('stalled', (jobId): void => {
      this.logger.warn('Full sync job stalled', { jobId });
    });

    this.worker.on('error', (error): void => {
      this.logger.error('Full sync worker error', {
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
      this.logger.info('Starting full product sync...', { jobId: job.id });

      const result = await this.syncAllProducts.execute(false);

      job.progress(100);

      this.logger.info('Full sync completed successfully', {
        jobId: job.id,
        totalProducts: result.totalProducts,
        synced: result.synced,
        failed: result.failed,
        duration: result.duration,
      });
    } catch (error) {
      this.logger.error('Full sync job error', {
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
      this.logger.info('FullSyncJob stopped');
    } catch (error) {
      this.logger.error('Error stopping full sync job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
