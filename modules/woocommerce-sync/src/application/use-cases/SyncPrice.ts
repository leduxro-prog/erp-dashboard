import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../domain/ports/IWooCommerceMapper';
import { SyncResult } from '../dtos/woocommerce.dtos';
import { SyncError, MappingNotFoundError } from '../errors/woocommerce.errors';
import { v4 as uuidv4 } from 'uuid';
import { SyncItem } from '../../domain/entities/SyncItem';

export interface PriceInfo {
  price: number;
  salePrice?: number;
  salePriceStartDate?: Date;
  salePriceEndDate?: Date;
}

export class SyncPrice {
  constructor(
    private syncRepository: ISyncRepository,
    private apiClient: IWooCommerceClient,
    private mapper: IWooCommerceMapper,
    private getProductPrice: (productId: string) => Promise<PriceInfo>
  ) { }

  async execute(productId: string): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get mapping
      const mapping = await this.syncRepository.getMapping(productId);
      if (!mapping) {
        throw new MappingNotFoundError(productId);
      }

      // Step 2: Get price from internal system
      const priceInfo = await this.getProductPrice(productId);

      // Step 3: Create price update payload
      const payload = this.mapper.toWooCommercePrice(
        priceInfo.price,
        priceInfo.salePrice,
        priceInfo.salePriceStartDate,
        priceInfo.salePriceEndDate
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
        syncType: 'price',
        message: `Price for product ${productId} synced (${priceInfo.price})`,
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
        'price',
        { productId },
        3
      );
      syncItem.markFailed(errorMessage);
      await this.syncRepository.saveSyncItem(syncItem);

      throw new SyncError(
        `Failed to sync price: ${errorMessage}`,
        productId,
        'price',
        error instanceof Error ? error : undefined
      );
    }
  }
}
