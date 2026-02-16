import { SyncBatch } from '../../domain/entities/SyncBatch';
import { SyncItem } from '../../domain/entities/SyncItem';
import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../domain/ports/IWooCommerceMapper';
import { BatchSyncResult } from '../dtos/woocommerce.dtos';
import { v4 as uuidv4 } from 'uuid';

export interface InternalProduct {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  sku: string;
  price: number;
  salePrice?: number;
  categories?: string[];
  images?: Array<{
    url: string;
    alt?: string;
    name?: string;
  }>;
  attributes?: Array<{
    name: string;
    values: string[];
  }>;
  status: 'active' | 'inactive' | 'draft';
}

export class SyncAllProducts {
  constructor(
    private syncRepository: ISyncRepository,
    private apiClient: IWooCommerceClient,
    private mapper: IWooCommerceMapper,
    private getAllProducts: (
      force?: boolean
    ) => Promise<InternalProduct[]>
  ) {}

  async execute(force: boolean = false): Promise<BatchSyncResult> {
    const startTime = Date.now();
    const batchId = uuidv4();
    const batch = new SyncBatch(batchId, 100);

    try {
      batch.start();

      // Get all products from internal system
      const products = await this.getAllProducts(force);

      // Create sync items for all products
      for (const product of products) {
        const syncItem = new SyncItem(
          uuidv4(),
          product.id,
          'product',
          { product },
          3
        );
        batch.addItem(syncItem);
        await this.syncRepository.saveSyncItem(syncItem);
      }

      // Process batches of 100
      const batches = this.chunkArray(batch.items, 100);
      let successCount = 0;
      let failCount = 0;
      const failedItems: Array<{ productId: string; reason: string }> = [];

      for (const batchGroup of batches) {
        const payload = batchGroup.map((item) => {
          const product = item.payload.product as InternalProduct;
          const mapping = this.syncRepository.getMapping(product.id);
          return this.mapper.toWooCommerceProduct(product, undefined);
        });

        try {
          // Batch update via WooCommerce API
          await this.apiClient.batchUpdateProducts(payload);

          for (const item of batchGroup) {
            item.markCompleted();
            await this.syncRepository.updateSyncItem(item);
            batch.recordSuccess();
            successCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          for (const item of batchGroup) {
            item.markFailed(errorMessage);
            await this.syncRepository.updateSyncItem(item);
            batch.recordFailure();
            failCount++;
            failedItems.push({
              productId: item.productId,
              reason: errorMessage,
            });
          }
        }
      }

      batch.complete();
      await this.syncRepository.updateBatch(batch);

      const duration = Date.now() - startTime;

      return {
        batchId,
        totalProducts: batch.totalItems,
        synced: successCount,
        failed: failCount,
        skipped: 0,
        duration,
        startedAt: batch.startedAt!,
        completedAt: batch.completedAt!,
        failedItems: failedItems.length > 0 ? failedItems : undefined,
      };
    } catch (error) {
      batch.complete();
      await this.syncRepository.updateBatch(batch);

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        batchId,
        totalProducts: batch.totalItems,
        synced: batch.successCount,
        failed: batch.failCount,
        skipped: batch.totalItems - batch.successCount - batch.failCount,
        duration,
        startedAt: batch.startedAt!,
        completedAt: batch.completedAt!,
        failedItems: [
          {
            productId: 'batch',
            reason: errorMessage,
          },
        ],
      };
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
