/**
 * Get Movement History Use Case
 * Retrieves stock movement history for a product
 */

import { IInventoryRepository } from '../../domain/repositories';
import { StockMovement } from '../../domain/ports/IInventoryRepository';

/**
 * GetMovementHistory Use Case
 * Implements retrieval of stock movement history
 */
export class GetMovementHistory {
  /**
   * Create instance of GetMovementHistory use case
   * @param repository - Inventory repository for data access
   */
  constructor(private readonly repository: IInventoryRepository) { }

  /**
   * Execute get movement history use case
   * Retrieves stock movements for a specific product
   *
   * @param productId - Product ID to retrieve movements for
   * @param warehouseId - Optional warehouse filter
   * @returns Promise resolving to array of stock movements
   */
  async execute(
    productId: string,
    warehouseId?: string
  ): Promise<StockMovement[]> {
    // Validate input
    if (!productId) {
      throw new Error('Product ID is required');
    }

    return this.repository.getMovementHistory(productId, warehouseId ? { warehouseId } : undefined);
  }
}
