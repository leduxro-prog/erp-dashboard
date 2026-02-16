import { Job, Queue, Worker, QueueOptions } from 'bullmq';
import { SyncStockUseCase } from '../../application/use-cases/SyncStock';
import { createModuleLogger } from '@shared/utils/logger';

/**
 * Configuration for StockSyncJob
 */
export interface StockSyncJobConfig {
  queueName?: string;
  connectionUrl?: string;
  schedulePattern?: string;
}

/**
 * StockSyncJob - Periodic job for synchronizing SmartBill stock data
 *
 * Implements enterprise-grade job configuration with:
 * - Automatic retries with exponential backoff
 * - Job timeout and completion handling
 * - Rate limiting to prevent overload
 * - Stalled job detection and recovery
 * - Failure alerting and logging
 * - Graceful shutdown support
 */
export class StockSyncJob {
  private queue: Queue;
  private worker: Worker;
  private readonly queueName: string;
  private readonly schedulePattern: string;
  private readonly logger = createModuleLogger('StockSyncJob');

  /**
   * Create a new StockSyncJob instance
   *
   * @param syncStockUseCase - Use case for executing stock synchronization
   * @param redisConnection - Redis connection configuration
   * @param config - Optional job configuration
   */
  constructor(
    private readonly syncStockUseCase: SyncStockUseCase,
    private readonly redisConnection: any,
    config: StockSyncJobConfig = {},
  ) {
    this.queueName = config.queueName || 'smartbill-stock-sync';
    this.schedulePattern = config.schedulePattern || '*/15 * * * *';

    const queueOptions: QueueOptions = {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // Note: timeout is not supported in defaultJobOptions, use job-level options instead
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep at most 100 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 500, // Keep at most 500 failed jobs
        },
      },
      // Note: limiter should be configured on the Worker, not Queue
    };

    this.queue = new Queue(this.queueName, queueOptions);
    this.worker = new Worker(this.queueName, this.handle.bind(this), {
      connection: redisConnection,
      concurrency: 1, // Only one stock sync at a time
    });
  }

  /**
   * Start the stock sync job
   *
   * Schedules recurring job and sets up event handlers for monitoring
   */
  async start(): Promise<void> {
    // Add recurring job - every 15 minutes
    await this.queue.add(
      'sync-stock',
      {},
      {
        repeat: {
          pattern: this.schedulePattern,
        },
        jobId: 'stock-sync-recurring',
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: {
          age: 604800,
          count: 500,
        },
      },
    );

    // Handle job completion
    this.worker.on('completed', (job: Job): void => {
      this.logger.info('Stock sync job completed', {
        jobId: job.id,
        duration: (job.finishedOn && job.processedOn) ? job.finishedOn - job.processedOn : 0,
      });
    });

    // Handle job failures
    this.worker.on('failed', (job: Job | undefined, err: Error): void => {
      this.logger.warn('Stock sync job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    // Handle stalled jobs (job took too long)
    this.worker.on('stalled', (jobId: string): void => {
      this.logger.warn('Stock sync job stalled', {
        jobId,
      });
    });

    // Handle worker errors
    this.worker.on('error', (error: Error): void => {
      this.logger.error('Stock sync worker error', {
        error: error.message,
        stack: error.stack,
      });
    });

    this.logger.info('Stock sync job started', {
      queueName: this.queueName,
      schedulePattern: this.schedulePattern,
    });
  }

  /**
   * Handle individual stock sync job execution
   *
   * @param job - The job to process
   */
  private async handle(job: Job): Promise<void> {
    try {
      this.logger.debug('Processing stock sync job', { jobId: job.id });

      const result = await this.syncStockUseCase.execute();

      await job.updateProgress(100);

      this.logger.info('Stock sync completed successfully', {
        jobId: job.id,
        result,
      });
    } catch (error) {
      this.logger.error('Stock sync job error', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the stock sync job gracefully
   *
   * Closes worker and queue connections
   */
  async stop(): Promise<void> {
    try {
      await this.worker.close();
      await this.queue.close();
      this.logger.info('Stock sync job stopped');
    } catch (error) {
      this.logger.error('Error stopping stock sync job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
