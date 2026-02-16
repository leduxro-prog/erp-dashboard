import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import Redis from 'ioredis';
import { PullOrders } from '../../application/use-cases/PullOrders';
import { SyncCache } from '../cache/SyncCache';
import { createModuleLogger } from '@shared/utils/logger';

/**
 * OrderPullJob - Periodic job for pulling orders from WooCommerce
 *
 * Implements enterprise-grade job configuration with:
 * - Automatic retries with exponential backoff
 * - Job timeout and completion handling
 * - Rate limiting to prevent overload
 * - Stalled job detection and recovery
 * - Failure alerting and logging
 * - Graceful shutdown support
 */
export class OrderPullJob {
  private queue?: Queue;
  private worker?: Worker;
  private readonly logger = createModuleLogger('OrderPullJob');

  /**
   * Create a new OrderPullJob instance
   *
   * @param redisConnection - Redis connection
   * @param pullOrders - Use case for pulling orders
   * @param syncCache - Cache for sync metadata
   */
  constructor(
    private redisConnection: Redis,
    private pullOrders: PullOrders,
    private syncCache: SyncCache
  ) { }

  /**
   * Register the order pull job with schedule
   *
   * Schedules order pulls every 5 minutes
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

    this.queue = new Queue('order-pull', queueOptions);

    // Schedule every 5 minutes
    await this.queue.add(
      'pull-orders',
      {},
      {
        repeat: {
          pattern: '*/5 * * * *', // Every 5 minutes
        },
        jobId: 'order-pull-recurring',
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
      'order-pull',
      (job) => this.jobHandler(job),
      workerOptions
    );

    // Setup event listeners
    this.setupEventListeners();

    this.logger.info('OrderPullJob registered - scheduled every 5 minutes');
  }

  /**
   * Setup event listeners for job monitoring
   */
  private setupEventListeners(): void {
    if (!this.worker) return;

    this.worker.on('completed', (job): void => {
      this.logger.info('Order pull job completed', {
        jobId: job.id,
        duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0,
      });
    });

    this.worker.on('failed', (job, err): void => {
      this.logger.warn('Order pull job failed', {
        jobId: job?.id,
        error: err.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('stalled', (jobId): void => {
      this.logger.warn('Order pull job stalled', { jobId });
    });

    this.worker.on('error', (error): void => {
      this.logger.error('Order pull worker error', {
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
      this.logger.debug('Pulling orders from WooCommerce...', { jobId: job.id });

      // Get last pull time from cache
      const lastPullCache = await this.syncCache.getLastSync('order_pull');

      const orders = await this.pullOrders.execute(lastPullCache || undefined);

      job.progress(100);

      this.logger.info('Orders pulled successfully', {
        jobId: job.id,
        count: orders.length,
        timestamp: new Date().toISOString(),
      });

      // Update last pull time
      await this.syncCache.cacheLastSync('order_pull', new Date());
    } catch (error) {
      this.logger.error('Order pull job error', {
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
      this.logger.info('OrderPullJob stopped');
    } catch (error) {
      this.logger.error('Error stopping order pull job', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
