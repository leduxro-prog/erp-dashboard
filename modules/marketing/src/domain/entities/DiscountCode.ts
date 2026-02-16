/**
 * DiscountCode Domain Entity
 * Represents a marketing discount code with validation and usage tracking.
 *
 * @module Domain/Entities
 */

/**
 * Discount code type classification
 */
export type DiscountCodeType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';

/**
 * DiscountCode Domain Entity
 *
 * Encapsulates discount code data with business logic for:
 * - Code validation (active, not expired, usage limits)
 * - Discount calculation
 * - Usage tracking and limits enforcement
 *
 * @class DiscountCode
 */
export class DiscountCode {
  /**
   * Create a new DiscountCode entity
   *
   * @param id - Unique discount code identifier
   * @param campaignId - Associated campaign ID (optional)
   * @param code - Unique discount code (uppercase)
   * @param type - Discount type (PERCENTAGE, FIXED_AMOUNT, etc.)
   * @param value - Discount value (percentage or amount)
   * @param minimumOrderAmount - Minimum order amount to apply code
   * @param maximumDiscount - Maximum discount cap
   * @param validFrom - Code validity start date
   * @param validTo - Code validity end date
   * @param maxUses - Maximum total uses (null = unlimited)
   * @param currentUses - Current usage count
   * @param maxUsesPerCustomer - Maximum uses per customer (null = unlimited)
   * @param applicableToProducts - Product IDs code applies to (empty = all)
   * @param applicableToCategories - Category IDs code applies to (empty = all)
   * @param excludedProducts - Product IDs code excludes
   * @param isActive - Whether code is currently active
   * @param isStackable - Whether code can be stacked with other codes
   * @param createdBy - User ID who created the code
   * @param createdAt - Creation timestamp
   */
  constructor(
    readonly id: string,
    readonly campaignId: string | null,
    readonly code: string,
    readonly type: DiscountCodeType,
    readonly value: number,
    readonly minimumOrderAmount: number | null,
    readonly maximumDiscount: number | null,
    readonly validFrom: Date,
    readonly validTo: Date,
    readonly maxUses: number | null,
    private currentUses: number,
    readonly maxUsesPerCustomer: number | null,
    readonly applicableToProducts: string[],
    readonly applicableToCategories: string[],
    readonly excludedProducts: string[],
    private isActive: boolean,
    readonly isStackable: boolean,
    readonly createdBy: string,
    readonly createdAt: Date,
  ) {}

  /**
   * Check if code is currently active
   * @returns True if code is not deactivated
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Deactivate the code
   */
  deactivate(): void {
    this.isActive = false;
  }

  /**
   * Activate the code
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * Check if code has expired
   * @returns True if current date is past validTo date
   */
  isExpired(): boolean {
    return new Date() > this.validTo;
  }

  /**
   * Check if code is valid for an order
   * Validates: active status, expiration, minimum amount, usage limits
   *
   * @param orderAmount - Order total amount
   * @param customerId - Customer ID (for per-customer limit check)
   * @returns True if code can be applied
   */
  isValid(orderAmount: number, customerId?: string): boolean {
    // Check if active
    if (!this.isActive) {
      return false;
    }

    // Check if code is not yet active (before validFrom)
    if (this.validFrom && new Date() < this.validFrom) {
      return false;
    }

    // Check expiration
    if (this.isExpired()) {
      return false;
    }

    // Check minimum order amount
    if (this.minimumOrderAmount !== null && orderAmount < this.minimumOrderAmount) {
      return false;
    }

    // Check total usage limit
    if (this.maxUses !== null && this.currentUses >= this.maxUses) {
      return false;
    }

    return true;
  }

  /**
   * Mark code as used (increment usage counter)
   *
   * @throws Error if code usage limit reached
   */
  use(): void {
    if (this.maxUses !== null && this.currentUses >= this.maxUses) {
      throw new Error('Discount code usage limit reached');
    }
    this.currentUses += 1;
  }

  /**
   * Check if customer can still use this code
   * Validates per-customer usage limit
   *
   * @param customerId - Customer ID
   * @param customerUsageCount - Number of times customer has used this code
   * @returns True if customer can still use code
   */
  canUse(customerId: string, customerUsageCount: number): boolean {
    if (this.maxUsesPerCustomer === null) {
      return true;
    }
    return customerUsageCount < this.maxUsesPerCustomer;
  }

  /**
   * Calculate discount amount for an order
   * Applies discount logic based on type and constraints
   *
   * @param orderAmount - Order total amount
   * @param items - Order items with product/category IDs
   * @returns Discount amount to apply
   * @throws Error if code is not applicable to items
   */
  calculateDiscount(
    orderAmount: number,
    items: Array<{ productId: string; categoryId: string; amount: number }>,
  ): number {
    // Check if any items are applicable
    const hasApplicableItems = items.some((item) => {
      const isExcluded = this.excludedProducts.includes(item.productId);
      if (isExcluded) {
        return false;
      }

      if (this.applicableToProducts.length > 0) {
        return this.applicableToProducts.includes(item.productId);
      }

      if (this.applicableToCategories.length > 0) {
        return this.applicableToCategories.includes(item.categoryId);
      }

      return true;
    });

    if (!hasApplicableItems) {
      throw new Error('Discount code not applicable to any items in order');
    }

    let discountAmount = 0;

    switch (this.type) {
      case 'PERCENTAGE':
        discountAmount = (orderAmount * this.value) / 100;
        break;
      case 'FIXED_AMOUNT':
        discountAmount = this.value;
        break;
      case 'FREE_SHIPPING':
        // FREE_SHIPPING uses separate shipping calculation
        discountAmount = this.value;
        break;
      case 'BUY_X_GET_Y':
        // Placeholder for buy X get Y logic
        discountAmount = this.value;
        break;
    }

    // Apply maximum discount cap if set
    if (this.maximumDiscount !== null) {
      discountAmount = Math.min(discountAmount, this.maximumDiscount);
    }

    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    return discountAmount;
  }

  /**
   * Get current usage count
   * @returns Number of times code has been used
   */
  getCurrentUses(): number {
    return this.currentUses;
  }

  /**
   * Get remaining uses
   * @returns Remaining uses, or null if unlimited
   */
  getRemainingUses(): number | null {
    if (this.maxUses === null) {
      return null;
    }
    return Math.max(0, this.maxUses - this.currentUses);
  }

  /**
   * Check if code is fully used
   * @returns True if usage limit reached
   */
  isFullyUsed(): boolean {
    if (this.maxUses === null) {
      return false;
    }
    return this.currentUses >= this.maxUses;
  }
}
