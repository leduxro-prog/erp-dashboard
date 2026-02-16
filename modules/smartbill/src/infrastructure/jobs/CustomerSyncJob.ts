import { Job, Queue, Worker, QueueOptions } from 'bullmq';
import { SyncSmartBillCustomers } from '../../application/use-cases/SyncSmartBillCustomers';
import { createModuleLogger } from '@shared/utils/logger';

/**
 * Configuration for CustomerSyncJob
 */
export interface CustomerSyncJobConfig {
  queueName?: string;
  connectionUrl?: string;
  schedulePattern?: string;
}

/**
 * CustomerSyncJob - Periodic job for synchronizing SmartBill customer data
 *
 * Implements enterprise-grade job configuration with:
 * - Automatic retries with exponential backoff (5000ms base)
 * - Job timeout and completion handling
 * - Stalled job detection and recovery
 * - Failure alerting and logging
 * - Graceful shutdown support
 */
export class CustomerSyncJob {
  private queue: Queue;
  private worker: Worker;
  private readonly queueName: string;
  private readonly schedulePattern: string;
  private readonly logger = createModuleLogger('CustomerSyncJob');

  /**
   * Create a new CustomerSyncJob instance
   *
   * @param syncSmartBillCustomers - Use case for executing customer synchronization
   * @param redisConnection - Redis connection configuration
   * @param config - Optional job configuration
   */
  constructor(
    private readonly syncSmartBillCustomers: SyncSmartBillCustomers,
    private readonly redisConnection: any,
    config: CustomerSyncJobConfig = {},
  ) {
    this.queueName = config.queueName || 'smartbill-customer-sync';
    this.schedulePattern = config.schedulePattern || '0 2 * * *';

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
      concurrency: 1, // Only one customer sync at a time
    });
  }

  /**
   * Start the customer sync job
   *
   * Schedules recurring job and sets up event handlers for monitoring
   */
  async start(): Promise<void> {
    // Add recurring job - daily at 2 AM Bucharest time
    await this.queue.add(
      'sync-customers',
      {},
      {
        repeat: {
          pattern: this.schedulePattern,
          tz: 'Europe/Bucharest',
        },
        jobId: 'customer-sync-recurring',
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
      this.logger.info('Customer sync job completed', {
        jobId: job.id,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
      });
    });

    // Handle job failures
    this.worker.on('failed', (job: Job | undefined, err: Error): void => {
      this.logger.warn('Customer sync job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    // Handle stalled jobs (job took too long)
    this.worker.on('stalled', (jobId: string): void => {
      this.logger.warn('Customer sync job stalled', {
        jobId,
      });
    });

    // Handle worker errors
    this.worker.on('error', (error: Error): void => {
      this.logger.error('Customer sync worker error', {
        error: error.message,
        stack: error.stack,
      });
    });

    this.logger.info('Customer sync job started', {
      queueName: this.queueName,
      schedulePattern: this.schedulePattern,
    });
  }

  /**
   * Handle individual customer sync job execution
   *
   * @param job - The job to process
   */
  private async handle(job: Job): Promise<void> {
    try {
      this.logger.debug('Processing customer sync job', { jobId: job.id });

      // Calculate date range: last 365 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const result = await this.syncSmartBillCustomers.execute({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      await job.updateProgress(100);

      this.logger.info('Customer sync completed successfully', {
        jobId: job.id,
        totalProcessed: result.totalProcessed,
        newLinks: result.newLinks,
        updatedLinks: result.updatedLinks,
        matchedToErp: result.matchedToErp,
        conflicts: result.conflicts.length,
      });
    } catch (error) {
      this.logger.error('Customer sync job error', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the customer sync job gracefully
   *
   * Closes worker and queue connections
   */
  async stop(): Promise<void> {
    try {
      await this.worker.close();
      await this.queue.close();
      this.logger.info('Customer sync job stopped');
    } catch (error) {
      this.logger.error('Error stopping customer sync job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
