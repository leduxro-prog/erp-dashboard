import { Job, Queue, Worker, QueueOptions } from 'bullmq';
import { SyncInvoiceStatusUseCase } from '../../application/use-cases/SyncInvoiceStatus';
import { createModuleLogger } from '@shared/utils/logger';

/**
 * Configuration for InvoiceStatusSyncJob
 */
export interface InvoiceStatusSyncJobConfig {
  queueName?: string;
  connectionUrl?: string;
  schedulePattern?: string;
}

/**
 * InvoiceStatusSyncJob - Periodic job for syncing SmartBill invoice payment statuses
 *
 * Polls SmartBill API every 30 minutes to check for payment status changes
 * on outstanding invoices, enabling bidirectional status sync.
 */
export class InvoiceStatusSyncJob {
  private queue: Queue;
  private worker: Worker;
  private readonly queueName: string;
  private readonly schedulePattern: string;
  private readonly logger = createModuleLogger('InvoiceStatusSyncJob');

  /**
   * Create a new InvoiceStatusSyncJob instance
   *
   * @param syncInvoiceStatusUseCase - Use case for executing invoice status sync
   * @param redisConnection - Redis connection configuration
   * @param config - Optional job configuration
   */
  constructor(
    private readonly syncInvoiceStatusUseCase: SyncInvoiceStatusUseCase,
    private readonly redisConnection: any,
    config: InvoiceStatusSyncJobConfig = {},
  ) {
    this.queueName = config.queueName || 'smartbill-invoice-status-sync';
    this.schedulePattern = config.schedulePattern || '*/30 * * * *';

    const queueOptions: QueueOptions = {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep at most 100 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
          count: 500, // Keep at most 500 failed jobs
        },
      },
    };

    this.queue = new Queue(this.queueName, queueOptions);
    this.worker = new Worker(this.queueName, this.handle.bind(this), {
      connection: redisConnection,
      concurrency: 1, // Only one status sync at a time
    });
  }

  /**
   * Start the invoice status sync job
   *
   * Schedules recurring job and sets up event handlers for monitoring
   */
  async start(): Promise<void> {
    // Add recurring job - every 30 minutes
    await this.queue.add(
      'sync-invoice-status',
      {},
      {
        repeat: {
          pattern: this.schedulePattern,
        },
        jobId: 'invoice-status-sync-recurring',
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
      this.logger.info('Invoice status sync job completed', {
        jobId: job.id,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
      });
    });

    // Handle job failures
    this.worker.on('failed', (job: Job | undefined, err: Error): void => {
      this.logger.warn('Invoice status sync job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    // Handle stalled jobs
    this.worker.on('stalled', (jobId: string): void => {
      this.logger.warn('Invoice status sync job stalled', {
        jobId,
      });
    });

    // Handle worker errors
    this.worker.on('error', (error: Error): void => {
      this.logger.error('Invoice status sync worker error', {
        error: error.message,
        stack: error.stack,
      });
    });

    this.logger.info('Invoice status sync job started', {
      queueName: this.queueName,
      schedulePattern: this.schedulePattern,
    });
  }

  /**
   * Handle individual invoice status sync job execution
   *
   * @param job - The job to process
   */
  private async handle(job: Job): Promise<void> {
    try {
      this.logger.debug('Processing invoice status sync job', { jobId: job.id });

      const result = await this.syncInvoiceStatusUseCase.execute();

      await job.updateProgress(100);

      this.logger.info('Invoice status sync completed successfully', {
        jobId: job.id,
        checked: result.checked,
        updated: result.updated,
        errors: result.errors,
      });
    } catch (error) {
      this.logger.error('Invoice status sync job error', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the invoice status sync job gracefully
   *
   * Closes worker and queue connections
   */
  async stop(): Promise<void> {
    try {
      await this.worker.close();
      await this.queue.close();
      this.logger.info('Invoice status sync job stopped');
    } catch (error) {
      this.logger.error('Error stopping invoice status sync job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
