/**
 * Discount Calculation Service
 * Domain service for calculating and applying discount codes to orders
 *
 * @module Domain/Services
 */

import { DiscountCode } from '../entities/DiscountCode';
import { InvalidDiscountCodeError, CodeNotApplicableError } from '../errors/marketing.errors';

/**
 * Order item for discount calculation
 */
export interface OrderItem {
  /** Product ID */
  productId: string;
  /** Product category ID */
  categoryId: string;
  /** Item amount */
  amount: number;
  /** Quantity */
  quantity: number;
}

/**
 * Discount calculation result
 */
export interface DiscountResult {
  /** Discount code used */
  code: string;
  /** Discount amount */
  discountAmount: number;
  /** Final order amount after discount */
  finalAmount: number;
  /** Discount percentage (if applicable) */
  discountPercentage: number;
}

/**
 * DiscountCalculationService
 *
 * Domain service for:
 * - Validating discount codes for orders
 * - Calculating discount amounts
 * - Handling stacking rules
 * - Enforcing constraints (min order, max discount, etc.)
 *
 * @class DiscountCalculationService
 */
export class DiscountCalculationService {
  /**
   * Create a new DiscountCalculationService
   */
  constructor() {}

  /**
   * Apply a discount code to an order
   * Validates code and calculates discount
   *
   * @param code - Discount code entity
   * @param orderAmount - Total order amount
   * @param items - Order items for applicability check
   * @param customerId - Customer ID
   * @param customerUsageCount - How many times customer has used code
   * @returns Discount calculation result
   * @throws InvalidDiscountCodeError if code is invalid
   * @throws CodeNotApplicableError if code doesn't apply to items
   */
  applyCode(
    code: DiscountCode,
    orderAmount: number,
    items: OrderItem[],
    customerId: string,
    customerUsageCount: number
  ): DiscountResult {
    // Check if code is active
    if (!code.getIsActive()) {
      throw new InvalidDiscountCodeError(code.code, 'Discount code is not active');
    }

    // Check if code is expired
    if (code.isExpired()) {
      throw new InvalidDiscountCodeError(code.code, 'Discount code has expired');
    }

    // Check minimum order amount
    if (code.minimumOrderAmount !== null && orderAmount < code.minimumOrderAmount) {
      throw new InvalidDiscountCodeError(
        code.code,
        `Minimum order amount of $${code.minimumOrderAmount} required`
      );
    }

    // Check total usage limit
    if (code.maxUses !== null && code.getCurrentUses() >= code.maxUses) {
      throw new InvalidDiscountCodeError(code.code, 'Discount code usage limit exceeded');
    }

    // Check per-customer usage limit
    if (!code.canUse(customerId, customerUsageCount)) {
      throw new InvalidDiscountCodeError(
        code.code,
        `Customer has reached usage limit for this code`
      );
    }

    // Calculate discount
    const discountAmount = code.calculateDiscount(orderAmount, items);

    // Calculate percentage for response
    const discountPercentage = (discountAmount / orderAmount) * 100;

    // Calculate final amount
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      code: code.code,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
      discountPercentage: Math.round(discountPercentage * 100) / 100,
    };
  }

  /**
   * Validate if a code can be applied without calculating discount
   * Useful for early validation
   *
   * @param code - Discount code entity
   * @param orderAmount - Order amount
   * @returns Validation result with error message if invalid
   */
  validateCode(
    code: DiscountCode,
    orderAmount: number
  ): { valid: boolean; error?: string } {
    if (!code.getIsActive()) {
      return { valid: false, error: 'Code is not active' };
    }

    if (code.isExpired()) {
      return { valid: false, error: 'Code has expired' };
    }

    if (code.isFullyUsed()) {
      return { valid: false, error: 'Code usage limit reached' };
    }

    if (code.minimumOrderAmount !== null && orderAmount < code.minimumOrderAmount) {
      return { valid: false, error: `Minimum order $${code.minimumOrderAmount} required` };
    }

    return { valid: true };
  }

  /**
   * Calculate what a discount code would be worth for an order
   * Without modifying code state
   *
   * @param code - Discount code
   * @param orderAmount - Order amount
   * @param items - Order items
   * @returns Estimated discount amount
   */
  estimateDiscount(code: DiscountCode, orderAmount: number, items: OrderItem[]): number {
    try {
      const discountAmount = code.calculateDiscount(orderAmount, items);
      return Math.round(discountAmount * 100) / 100;
    } catch {
      return 0;
    }
  }

  /**
   * Apply multiple discount codes (if stackable)
   * Checks stacking rules and applies sequentially
   *
   * @param codes - Discount code entities
   * @param orderAmount - Initial order amount
   * @param items - Order items
   * @param customerId - Customer ID
   * @param customerUsageCounts - Usage count per code
   * @returns Combined discount result
   * @throws Error if codes are not stackable
   */
  applyMultipleCodes(
    codes: DiscountCode[],
    orderAmount: number,
    items: OrderItem[],
    customerId: string,
    customerUsageCounts: { [codeId: string]: number }
  ): {
    codes: string[];
    totalDiscount: number;
    finalAmount: number;
  } {
    // Check if all codes are stackable
    const nonStackable = codes.find((c) => !c.isStackable);
    if (nonStackable) {
      throw new Error(`Code '${nonStackable.code}' is not stackable with other codes`);
    }

    let currentAmount = orderAmount;
    let totalDiscount = 0;
    const appliedCodes: string[] = [];

    for (const code of codes) {
      try {
        const result = this.applyCode(code, currentAmount, items, customerId, customerUsageCounts[code.id] || 0);
        appliedCodes.push(result.code);
        totalDiscount += result.discountAmount;
        currentAmount = result.finalAmount;
      } catch (error) {
        // Skip codes that can't be applied
        continue;
      }
    }

    return {
      codes: appliedCodes,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      finalAmount: Math.round(currentAmount * 100) / 100,
    };
  }

  /**
   * Get discount breakdown for a code
   * Shows what portion of discount applies to which items
   *
   * @param code - Discount code
   * @param items - Order items
   * @returns Breakdown by item
   */
  getDiscountBreakdown(
    code: DiscountCode,
    items: OrderItem[]
  ): Array<{ productId: string; discount: number }> {
    const breakdown: Array<{ productId: string; discount: number }> = [];

    for (const item of items) {
      const isExcluded = code.excludedProducts.includes(item.productId);
      if (isExcluded) {
        continue;
      }

      let isApplicable = false;
      if (code.applicableToProducts.length > 0) {
        isApplicable = code.applicableToProducts.includes(item.productId);
      } else if (code.applicableToCategories.length > 0) {
        isApplicable = code.applicableToCategories.includes(item.categoryId);
      } else {
        isApplicable = true;
      }

      if (!isApplicable) {
        continue;
      }

      let itemDiscount = 0;
      switch (code.type) {
        case 'PERCENTAGE':
          itemDiscount = (item.amount * code.value) / 100;
          break;
        case 'FIXED_AMOUNT':
          itemDiscount = code.value / items.length;
          break;
        case 'FREE_SHIPPING':
          itemDiscount = 0; // Handled separately
          break;
        case 'BUY_X_GET_Y':
          itemDiscount = 0; // Complex logic, not included
          break;
      }

      breakdown.push({
        productId: item.productId,
        discount: Math.round(itemDiscount * 100) / 100,
      });
    }

    return breakdown;
  }
}
