import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../domain/ports/IWooCommerceMapper';
import { SyncResult } from '../dtos/woocommerce.dtos';
import { SyncError, MappingNotFoundError } from '../errors/woocommerce.errors';
import { v4 as uuidv4 } from 'uuid';
import { SyncItem } from '../../domain/entities/SyncItem';
import { ProductSyncMapping } from '../../domain/entities/ProductSyncMapping';

export class SyncStock {
  constructor(
    private syncRepository: ISyncRepository,
    private apiClient: IWooCommerceClient,
    private mapper: IWooCommerceMapper,
    private getProductStock: (productId: string) => Promise<number>
  ) { }

  async execute(productId: string): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get mapping
      const mapping = await this.syncRepository.getMapping(productId);
      if (!mapping) {
        throw new MappingNotFoundError(productId);
      }

      // Step 2: Get stock from internal system
      const quantity = await this.getProductStock(productId);

      // Step 3: Create stock update payload
      const payload = this.mapper.toWooCommerceStock(
        quantity
      );

      // Step 4: Update in WooCommerce
      await this.apiClient.updateProduct(mapping.wooCommerceProductId, payload);

      // Step 5: Mark mapping as in sync
      mapping.markInSync();
      await this.syncRepository.updateMapping(mapping);

      const duration = Date.now() - startTime;

      return {
        success: true,
        productId,
        wooCommerceId: mapping.wooCommerceProductId,
        syncType: 'stock',
        message: `Stock for product ${productId} synced (qty: ${quantity})`,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark mapping as error
      try {
        const mapping = await this.syncRepository.getMapping(productId);
        if (mapping) {
          mapping.markError(errorMessage);
          await this.syncRepository.updateMapping(mapping);
        }
      } catch (e) {
        // Ignore mapping update errors
      }

      // Record failed sync item
      const syncItem = new SyncItem(
        uuidv4(),
        productId,
        'stock',
        { productId },
        3
      );
      syncItem.markFailed(errorMessage);
      await this.syncRepository.saveSyncItem(syncItem);

      throw new SyncError(
        `Failed to sync stock: ${errorMessage}`,
        productId,
        'stock',
        error instanceof Error ? error : undefined
      );
    }
  }
}
