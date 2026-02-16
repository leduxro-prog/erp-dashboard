import { ComponentCatalog } from '../entities/ComponentCatalog';

/**
 * Component Catalog Repository Port
 *
 * Defines the contract for accessing available components in the configurator.
 * Catalog entries are read-only from the domain perspective (created/updated
 * via admin endpoints).
 *
 * @interface ICatalogRepository
 */
export interface ICatalogRepository {
  /**
   * Find all components for a configurator type
   *
   * @param configuratorType - MAGNETIC_TRACK or LED_STRIP
   * @param onlyActive - Only return active components (default: true)
   * @returns Promise resolving to catalog entries
   */
  findByConfiguratorType(
    configuratorType: 'MAGNETIC_TRACK' | 'LED_STRIP',
    onlyActive?: boolean
  ): Promise<ComponentCatalog[]>;

  /**
   * Find all components of a specific type
   *
   * @param componentType - Component type to search
   * @param onlyActive - Only return active components (default: true)
   * @returns Promise resolving to matching components
   */
  findByComponentType(componentType: string, onlyActive?: boolean): Promise<ComponentCatalog[]>;

  /**
   * Find component by ID
   *
   * @param id - Catalog entry ID
   * @returns Promise resolving to component or undefined
   */
  findById(id: string): Promise<ComponentCatalog | undefined>;

  /**
   * Find component by SKU
   *
   * @param sku - Product SKU
   * @returns Promise resolving to component or undefined
   */
  findBySku(sku: string): Promise<ComponentCatalog | undefined>;

  /**
   * Find all catalog entries
   *
   * @param onlyActive - Only return active components (default: true)
   * @returns Promise resolving to all catalog entries
   */
  findAll(onlyActive?: boolean): Promise<ComponentCatalog[]>;

  /**
   * Save catalog entry (create or update)
   *
   * @param catalog - Catalog entry to save
   * @returns Promise resolving to saved entry
   * @throws {Error} If persistence fails
   */
  save(catalog: ComponentCatalog): Promise<ComponentCatalog>;

  /**
   * Delete catalog entry
   *
   * @param id - Catalog entry ID
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;
}
