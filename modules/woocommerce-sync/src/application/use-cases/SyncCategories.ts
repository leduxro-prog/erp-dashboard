import { ISyncRepository } from '../../domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../domain/ports/IWooCommerceClient';
import { SyncResult } from '../dtos/woocommerce.dtos';
import { SyncError } from '../errors/woocommerce.errors';
import { v4 as uuidv4 } from 'uuid';
import { SyncItem } from '../../domain/entities/SyncItem';

export interface InternalCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
}

export class SyncCategories {
  constructor(
    private syncRepository: ISyncRepository,
    private apiClient: IWooCommerceClient,
    private getCategories: () => Promise<InternalCategory[]>
  ) { }

  async execute(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get all categories from internal system
      const categories = await this.getCategories();

      // Step 2: Get existing WooCommerce categories
      const wcCategories = await this.apiClient.getCategories();
      const wcCategoriesByName = new Map(
        wcCategories.map((cat) => [cat.name, cat])
      );

      // Step 3: Create or update categories
      let createdCount = 0;
      let updatedCount = 0;

      for (const category of categories) {
        const existingCategory = wcCategoriesByName.get(category.name);

        if (existingCategory) {
          // Update existing category
          if (this.apiClient.updateCategory) {
            await this.apiClient.updateCategory(existingCategory.id, {
              name: category.name,
              slug: category.slug,
              description: category.description,
            });
            updatedCount++;
          }
        } else {
          // Create new category
          await this.apiClient.createCategory({
            name: category.name,
            slug: category.slug,
          });
          createdCount++;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        productId: 'all',
        syncType: 'category',
        message: `Categories synced: ${createdCount} created, ${updatedCount} updated`,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failed sync item
      const syncItem = new SyncItem(
        uuidv4(),
        'all_categories',
        'category',
        { action: 'sync_categories' },
        3
      );
      syncItem.markFailed(errorMessage);
      await this.syncRepository.saveSyncItem(syncItem);

      throw new SyncError(
        `Failed to sync categories: ${errorMessage}`,
        'all_categories',
        'category',
        error instanceof Error ? error : undefined
      );
    }
  }
}
