import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { createModuleLogger } from '@shared/utils/logger';

export class SupplierSyncJob {
  private readonly logger = createModuleLogger('SupplierSyncJob');
  private queue: Queue;
  private worker!: Worker;

  constructor(private redis: Redis) {
    this.queue = new Queue('supplier-sync', { connection: this.redis });
  }

  async initialize(): Promise<void> {
    this.worker = new Worker('supplier-sync', this.handler.bind(this), {
      connection: this.redis,
      concurrency: 1,
    });

    this.worker.on('completed', (job: Job) => {
      this.logger.info(`Supplier sync job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(`Supplier sync job ${job?.id || 'unknown'} failed:`, { error });
    });

    // Schedule job to run every 4 hours (only 06:00-22:00)
    await this.queue.add('sync', {}, {
      repeat: {
        pattern: '0 6-22/4 * * *',
      },
    });

    this.logger.info('Supplier sync job initialized (every 4 hours, 06:00-22:00)');
  }

  private async handler(job: Job): Promise<void> {
    this.logger.info(`Starting supplier sync job ${job.id}`);

    try {
      const now = new Date();
      const hour = now.getHours();

      // Skip if outside business hours (6 AM to 10 PM)
      if (hour < 6 || hour >= 22) {
        this.logger.info(`Supplier sync skipped: outside business hours (${hour}:00)`);
        return;
      }

      // Placeholder: Will call Supplier module when available
      this.logger.info('Supplier sync: Placeholder - waiting for Supplier module integration');

      // TODO: Implement actual supplier sync
      // const supplierService = container.resolve('SupplierService');
      // await supplierService.syncStockLevels();

      this.logger.info('Supplier sync completed successfully');
    } catch (error) {
      this.logger.error('Supplier sync failed:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
