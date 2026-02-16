/**
 * Inventory Port
 *
 * Interface for accessing inventory information from the inventory module.
 * Used to check component availability before allowing additions to configuration.
 *
 * @interface IInventoryPort
 */
export interface IInventoryPort {
  /**
   * Check stock availability for multiple products
   *
   * Queries the inventory module to check if products have available stock.
   * Returns a map of product ID to available quantity.
   *
   * @param productIds - Array of product IDs to check
   * @returns Promise resolving to map of productId => availableQuantity
   * @throws {Error} If inventory service unavailable
   *
   * @example
   * const availability = await inventoryPort.checkStockAvailability([1, 2, 3]);
   * // Returns Map:
   * // 1 => 50 (50 units available)
   * // 2 => 0 (out of stock)
   * // 3 => 999 (unlimited or very high stock)
   */
  checkStockAvailability(productIds: number[]): Promise<Map<number, number>>;

  /**
   * Check if a single product is in stock
   *
   * @param productId - Product ID
   * @returns Promise resolving to true if in stock
   */
  isInStock(productId: number): Promise<boolean>;

  /**
   * Get available quantity for a product
   *
   * @param productId - Product ID
   * @returns Promise resolving to available quantity (0 if not available)
   */
  getAvailableQuantity(productId: number): Promise<number>;
}
