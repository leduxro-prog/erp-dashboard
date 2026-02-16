/**
 * DiscountCode Repository Interface
 * Port for discount code data persistence
 *
 * @module Domain/Repositories
 */

import { DiscountCode } from '../entities/DiscountCode';

/**
 * Filter options for discount code queries
 */
export interface DiscountCodeFilter {
  /** Filter by campaign ID */
  campaignId?: string;
  /** Filter by code type */
  type?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Codes created by user ID */
  createdBy?: string;
  /** Search by code text */
  search?: string;
  /** Codes expiring after this date */
  expiringAfter?: Date;
  /** Codes expiring before this date */
  expiringBefore?: Date;
}

/**
 * IDiscountCodeRepository
 * Port interface for discount code persistence operations
 */
export interface IDiscountCodeRepository {
  /**
   * Save a discount code (create or update)
   * @param code - Discount code entity to save
   * @returns Saved discount code
   */
  save(code: DiscountCode): Promise<DiscountCode>;

  /**
   * Find discount code by unique code string
   * @param code - The discount code string (case-insensitive)
   * @returns Discount code or null if not found
   */
  findByCode(code: string): Promise<DiscountCode | null>;

  /**
   * Find discount code by ID
   * @param id - Discount code ID
   * @returns Discount code or null if not found
   */
  findById(id: string): Promise<DiscountCode | null>;

  /**
   * Find all discount codes for a campaign
   * @param campaignId - Campaign ID
   * @returns All codes for campaign
   */
  findByCampaign(campaignId: string): Promise<DiscountCode[]>;

  /**
   * Find all active discount codes
   * @returns Active discount codes
   */
  findActive(): Promise<DiscountCode[]>;

  /**
   * Find codes with filtering and pagination
   * @param filter - Filter criteria
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Discount codes
   */
  findWithFilter(
    filter: DiscountCodeFilter,
    page: number,
    limit: number,
  ): Promise<{ items: DiscountCode[]; total: number; page: number; pages: number }>;

  /**
   * Increment usage count for a code
   * Called when code is applied to an order
   *
   * @param codeId - Discount code ID
   * @returns Updated code
   */
  incrementUsage(codeId: string): Promise<DiscountCode>;

  /**
   * Atomically increment usage count only if code still has available uses.
   * Returns null when usage limit is already reached.
   */
  incrementUsageIfAvailable(codeId: string): Promise<DiscountCode | null>;

  /**
   * Validate code exists and is valid
   * @param code - Code string
   * @param orderAmount - Order amount for validation
   * @returns True if valid, false otherwise
   */
  validateCode(code: string, orderAmount: number): Promise<boolean>;

  /**
   * Find all expired codes
   * @returns Expired discount codes
   */
  findExpired(): Promise<DiscountCode[]>;

  /**
   * Find codes expiring soon
   * @param daysUntilExpiry - Days until expiry threshold
   * @returns Codes expiring within threshold
   */
  findExpiringCodes(daysUntilExpiry: number): Promise<DiscountCode[]>;

  /**
   * Count codes matching filter
   * @param filter - Filter criteria
   * @returns Count of matching codes
   */
  count(filter: DiscountCodeFilter): Promise<number>;

  /**
   * Delete a discount code
   * @param id - Discount code ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Get customer's usage count for a code
   * @param codeId - Discount code ID
   * @param customerId - Customer ID
   * @returns Number of times customer has used code
   */
  getCustomerUsageCount(codeId: string, customerId: string): Promise<number>;
}
