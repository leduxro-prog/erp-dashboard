import { Logger } from 'winston';
import { ComponentCatalog } from '../../domain/entities/ComponentCatalog';
import { ICatalogRepository } from '../../domain/repositories/ICatalogRepository';
import { IInventoryPort } from '../ports/IInventoryPort';

/**
 * GetCatalog Use-Case
 *
 * Retrieves available components for a configurator type with stock status.
 *
 * Business Rules:
 * - Only returns active components
 * - Includes current stock information
 * - Sorted by display order
 *
 * @class GetCatalog
 */
export class GetCatalog {
  /**
   * Create new GetCatalog use-case
   *
   * @param catalogRepository - Catalog repository
   * @param inventoryPort - Inventory port for stock checking
   * @param logger - Structured logger
   */
  constructor(
    private readonly catalogRepository: ICatalogRepository,
    private readonly inventoryPort: IInventoryPort,
    private readonly logger: Logger
  ) {}

  /**
   * Execute get catalog use-case
   *
   * @param input - Use-case input
   * @returns Promise resolving to catalog items with stock status
   */
  async execute(input: {
    configuratorType: 'MAGNETIC_TRACK' | 'LED_STRIP';
  }): Promise<
    Array<{
      id: string;
      componentType: string;
      name: string;
      sku: string;
      basePrice: number;
      specifications: Record<string, unknown>;
      maxPerConfig: number;
      inStock: boolean;
      availableQuantity: number;
      sortOrder: number;
    }>
  > {
    this.logger.debug('GetCatalog: Starting', {
      configuratorType: input.configuratorType,
    });

    try {
      // 1. Find catalog entries
      const components = await this.catalogRepository.findByConfiguratorType(
        input.configuratorType,
        true // Only active
      );

      // 2. Get product IDs for inventory check
      const productIds = components
        .map((c) => parseInt(c.id.replace('cat_', '').split('_')[0], 10))
        .filter((id) => !isNaN(id));

      // 3. Check stock availability
      let stockMap = new Map<number, number>();
      if (productIds.length > 0) {
        try {
          stockMap = await this.inventoryPort.checkStockAvailability(productIds);
        } catch (error) {
          this.logger.warn('GetCatalog: Failed to check inventory', {
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with empty stock map if inventory service fails
        }
      }

      // 4. Build response with stock information
      const result = components
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((component) => {
          const productId = parseInt(component.id.replace('cat_', '').split('_')[0], 10);
          const availableQuantity = stockMap.get(productId) ?? 0;

          return {
            id: component.id,
            componentType: component.componentType,
            name: component.name,
            sku: component.sku,
            basePrice: component.basePrice,
            specifications: component.specifications,
            maxPerConfig: component.maxPerConfig,
            inStock: availableQuantity > 0,
            availableQuantity,
            sortOrder: component.sortOrder,
          };
        });

      this.logger.info('GetCatalog: Catalog retrieved successfully', {
        configuratorType: input.configuratorType,
        componentCount: result.length,
      });

      return result;
    } catch (error) {
      this.logger.error('GetCatalog: Failed to retrieve catalog', {
        configuratorType: input.configuratorType,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
