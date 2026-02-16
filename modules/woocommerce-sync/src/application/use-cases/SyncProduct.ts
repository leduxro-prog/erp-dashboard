import { SyncItem, SyncType } from '../../domain';
import { ProductSyncMapping } from '../../domain/entities/ProductSyncMapping';
import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../domain/ports/IWooCommerceMapper';
import { SyncResult } from '../dtos/woocommerce.dtos';
import { SyncError, MappingNotFoundError } from '../errors/woocommerce.errors';
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
  stockQuantity?: number;
}

export class SyncProduct {
  constructor(
    private syncRepository: ISyncRepository,
    private apiClient: IWooCommerceClient,
    private mapper: IWooCommerceMapper,
    private getProduct: (productId: string) => Promise<InternalProduct>
  ) { }

  async execute(productId: string): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get product from internal system
      const product = await this.getProduct(productId);

      // Step 2: Get or create mapping
      let mapping = await this.syncRepository.getMapping(productId);

      // Step 3: Map to WooCommerce format
      const wcProduct = this.mapper.toWooCommerceProduct(product, mapping);

      // Step 4: Update or create in WooCommerce
      let wooCommerceId: number;

      if (mapping && mapping.wooCommerceProductId) {
        // Update existing product
        wooCommerceId = mapping.wooCommerceProductId;
        await this.apiClient.updateProduct(wooCommerceId, wcProduct);
      } else {
        // Create new product
        const created = await this.apiClient.createProduct(wcProduct);
        wooCommerceId = created.id;

        // Create mapping
        mapping = new ProductSyncMapping(uuidv4(), productId, wooCommerceId);
        await this.syncRepository.createMapping(mapping);
      }

      // Step 5: Mark mapping as in sync
      if (mapping) {
        mapping.markInSync();
        await this.syncRepository.updateMapping(mapping);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        productId,
        wooCommerceId,
        syncType: 'product',
        message: `Product ${productId} synced successfully`,
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
        'product',
        { product: productId },
        3
      );
      syncItem.markFailed(errorMessage);
      await this.syncRepository.saveSyncItem(syncItem);

      throw new SyncError(
        `Failed to sync product: ${errorMessage}`,
        productId,
        'product',
        error instanceof Error ? error : undefined
      );
    }
  }
}
