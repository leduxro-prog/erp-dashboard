/**
 * @deprecated This job stub is superseded by the SmartBill module's StockSyncJob.
 *
 * The real stock sync pipeline lives in:
 *   - modules/smartbill/src/infrastructure/jobs/StockSyncJob.ts  (BullMQ job)
 *   - modules/smartbill/src/application/use-cases/SyncStock.ts   (use case)
 *
 * The SmartBill module's StockSyncJob is started automatically in
 * SmartBillModule.start() and runs every 15 minutes via BullMQ.
 *
 * This file is kept only for historical reference and should not be imported.
 */
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { createModuleLogger } from '@shared/utils/logger';

export class SmartBillSyncJob {
  private readonly logger = createModuleLogger('SmartBillSyncJob');
  private queue: Queue;
  private worker!: Worker;

  constructor(private redis: Redis) {
    this.queue = new Queue('smartbill-sync', { connection: this.redis });
  }

  /**
   * @deprecated Use SmartBill module's StockSyncJob instead.
   */
  async initialize(): Promise<void> {
    this.logger.warn(
      'SmartBillSyncJob (inventory module) is deprecated. ' +
        "Stock sync is now handled by the SmartBill module's StockSyncJob.",
    );
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
