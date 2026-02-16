/**
 * Pricing Port
 *
 * Interface for accessing pricing information from the pricing-engine module.
 * Used by the configurator to apply customer tier discounts.
 *
 * @interface IPricingPort
 */
export interface IPricingPort {
  /**
   * Get customer tier discount percentage
   *
   * Queries the pricing module to retrieve the discount percentage
   * for a specific customer based on their tier.
   *
   * @param customerId - Customer ID
   * @returns Promise resolving to discount percentage (0-100)
   * @throws {Error} If customer not found or service unavailable
   *
   * @example
   * const discount = await pricingPort.getCustomerTierDiscount(123);
   * // Returns 10 (for 10% discount)
   */
  getCustomerTierDiscount(customerId: number): Promise<number>;

  /**
   * Get product price from pricing engine
   *
   * Retrieves current product pricing including any promotions.
   *
   * @param productId - Product ID
   * @returns Promise resolving to product price in RON
   * @throws {Error} If product not found
   */
  getProductPrice(productId: number): Promise<number>;

  /**
   * Check if promotion is active for a product
   *
   * @param productId - Product ID
   * @returns Promise resolving to true if active promotion exists
   */
  hasActivePromotion(productId: number): Promise<boolean>;
}
