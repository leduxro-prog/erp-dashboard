import { Worker, WorkerOptions, Job } from 'bullmq';
import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { SyncPriorityService } from '../../domain/services/SyncPriorityService';
import { WooCommerceApiClient } from '../api-client/WooCommerceApiClient';
import { WooCommerceMapper } from '../mappers/WooCommerceMapper';
import Redis from 'ioredis';
import { SyncItem } from '../../domain/entities/SyncItem';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('realtime-sync-worker');

/**
 * Data structure for sync jobs in the queue
 */
export interface SyncJobData {
  syncItemId: string;
  productId: string;
  syncType: string;
}

/**
 * Real-time sync worker for processing WooCommerce sync jobs
 */
export class RealTimeSyncWorker {
  private worker?: Worker<SyncJobData>;
  private priorityService: SyncPriorityService;

  constructor(
    private redisConnection: Redis,
    private syncRepository: ISyncRepository,
    private apiClient: WooCommerceApiClient,
    private mapper: WooCommerceMapper,
    private getProductData: (productId: string) => Promise<unknown>
  ) {
    this.priorityService = new SyncPriorityService();
  }

  /**
   * Start the worker to process sync jobs
   */
  async start(): Promise<void> {
    const workerOptions: WorkerOptions = {
      connection: this.redisConnection,
      concurrency: 10,
    };

    this.worker = new Worker<SyncJobData>(
      'woocommerce-sync',
      async (job) => this.processJob(job),
      workerOptions
    );

    this.worker.on('completed', (job) => {
      logger.info(`[WC Sync] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`[WC Sync] Job ${job?.id} failed:`, { error: err.message });
    });

    logger.info('[WC Sync] RealTimeSyncWorker started');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      logger.info('[WC Sync] RealTimeSyncWorker stopped');
    }
  }

  private async processJob(job: Job<SyncJobData>): Promise<void> {
    const { syncItemId, productId, syncType } = job.data;

    try {
      // Load sync item
      const syncItem = await this.syncRepository.getSyncItem(syncItemId);
      if (!syncItem) {
        throw new Error(`SyncItem not found: ${syncItemId}`);
      }

      // Mark as syncing
      syncItem.markSyncing();
      await this.syncRepository.updateSyncItem(syncItem);

      // Get mapping
      const mapping = await this.syncRepository.getMapping(productId);
      if (!mapping) {
        throw new Error(`Mapping not found for product: ${productId}`);
      }

      // Fetch product data
      const productData = await this.getProductData(productId) as any;

      // Prepare payload based on sync type
      let payload: any;

      switch (syncType) {
        case 'stock':
          payload = this.mapper.toWooCommerceStock(
            mapping.wooCommerceProductId,
            productData.stockQuantity || 0
          );
          break;

        case 'price':
          payload = this.mapper.toWooCommercePrice(
            mapping.wooCommerceProductId,
            productData.price,
            productData.salePrice
          );
          break;

        case 'product':
          payload = this.mapper.toWooCommerceProduct(productData, mapping);
          break;

        default:
          throw new Error(`Unknown sync type: ${syncType}`);
      }

      // Update in WooCommerce
      await this.apiClient.updateProduct(mapping.wooCommerceProductId, payload);

      // Mark as completed
      syncItem.markCompleted();
      mapping.markInSync();

      await Promise.all([
        this.syncRepository.updateSyncItem(syncItem),
        this.syncRepository.updateMapping(mapping),
      ]);

      await job.updateProgress(100);
    } catch (error) {
      const syncItem = await this.syncRepository.getSyncItem(syncItemId);
      if (syncItem) {
        syncItem.incrementAttempt();
        syncItem.markFailed(error instanceof Error ? error.message : String(error));
        await this.syncRepository.updateSyncItem(syncItem);
      }

      throw error;
    }
  }
}
