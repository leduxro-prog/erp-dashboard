/**
 * Tier Repository Interface (Port)
 * Defines contract for customer tier data access
 */

/**
 * Customer tier representation
 */
export interface CustomerTierRecord {
  customerId: number;
  level: string;
  discountPercentage: number;
  name: string;
  assignedAt: Date;
  reason?: string;
}

/**
 * Repository port for customer tier management
 * Implementation-agnostic interface
 */
export interface ITierRepository {
  /**
   * Get the current tier for a customer
   */
  getCustomerTier(customerId: number): Promise<CustomerTierRecord | null>;

  /**
   * Set or update a customer's tier
   * @param customerId - Customer ID
   * @param tierLevel - Tier level (e.g., 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM')
   * @param discountPercentage - Discount percentage for the tier
   * @param reason - Reason for the assignment (for audit trail)
   */
  setCustomerTier(
    customerId: number,
    tierLevel: string,
    discountPercentage: number,
    reason: string
  ): Promise<void>;

  /**
   * Get all customers at a specific tier level
   */
  getCustomersByTierLevel(tierLevel: string): Promise<number[]>;

  /**
   * Bulk update customer tiers
   */
  bulkUpdateCustomerTiers(
    updates: Array<{
      customerId: number;
      tierLevel: string;
      reason: string;
    }>
  ): Promise<number>;

  /**
   * Get tier assignment history for a customer
   */
  getCustomerTierHistory(
    customerId: number,
    limit?: number
  ): Promise<Array<{
    tierLevel: string;
    discountPercentage: number;
    assignedAt: Date;
    reason?: string;
  }>>;
}
