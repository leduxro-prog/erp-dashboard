/**
 * ValidateDiscountCode Use-Case
 * Application use-case for validating discount codes against orders
 *
 * @module Application/UseCases
 */

import { DiscountCode } from '../../domain/entities/DiscountCode';
import { IDiscountCodeRepository } from '../../domain/repositories/IDiscountCodeRepository';
import { DiscountCalculationService } from '../../domain/services/DiscountCalculationService';
import {
  InvalidDiscountCodeError,
  DiscountCodeExpiredError,
  DiscountCodeUsedUpError,
} from '../../domain/errors/marketing.errors';

/**
 * Order item for validation
 */
export interface ValidationOrderItem {
  productId: string;
  categoryId: string;
  amount: number;
  quantity: number;
}

/**
 * Input for ValidateDiscountCode use-case
 */
export interface ValidateDiscountCodeInput {
  /** Discount code string */
  code: string;
  /** Order amount to validate against */
  orderAmount: number;
  /** Order items */
  items: ValidationOrderItem[];
  /** Customer ID */
  customerId?: string;
}

/**
 * Output from ValidateDiscountCode use-case
 */
export interface ValidateDiscountCodeOutput {
  /** Code is valid and can be applied */
  isValid: boolean;
  /** Validation error message if not valid */
  error?: string;
  /** Estimated discount amount if valid */
  estimatedDiscount?: number;
  /** Code details if valid */
  code?: {
    id: string;
    code: string;
    type: string;
    value: number;
  };
}

/**
 * ValidateDiscountCode Use-Case
 *
 * Responsibilities:
 * - Find discount code by string
 * - Validate code against order (active, not expired, usage limits)
 * - Check if code is applicable to order items
 * - Calculate estimated discount
 * - Return validation result
 *
 * Does NOT apply the code - just validates it.
 *
 * @class ValidateDiscountCode
 */
export class ValidateDiscountCode {
  /**
   * Create a new ValidateDiscountCode use-case instance
   *
   * @param discountCodeRepository - Discount code repository
   * @param discountCalculationService - Discount calculation service
   */
  constructor(
    private readonly discountCodeRepository: IDiscountCodeRepository,
    private readonly discountCalculationService: DiscountCalculationService,
  ) {}

  /**
   * Execute the ValidateDiscountCode use-case
   *
   * @param input - Validation input
   * @returns Validation result
   */
  async execute(input: ValidateDiscountCodeInput): Promise<ValidateDiscountCodeOutput> {
    // Find code
    const code = await this.discountCodeRepository.findByCode(input.code.toUpperCase());
    if (!code) {
      return {
        isValid: false,
        error: `Discount code '${input.code}' not found`,
      };
    }

    // Check if active
    if (!code.getIsActive()) {
      return {
        isValid: false,
        error: 'Discount code is not active',
      };
    }

    // Check if expired
    if (code.isExpired()) {
      return {
        isValid: false,
        error: 'Discount code has expired',
      };
    }

    if (code.validFrom && new Date() < code.validFrom) {
      return {
        isValid: false,
        error: 'Discount code is not active yet',
      };
    }

    // Check usage limit
    if (code.maxUses !== null && code.getCurrentUses() >= code.maxUses) {
      return {
        isValid: false,
        error: 'Discount code usage limit exceeded',
      };
    }

    // Check minimum order amount
    if (code.minimumOrderAmount !== null && input.orderAmount < code.minimumOrderAmount) {
      return {
        isValid: false,
        error: `Minimum order amount of $${code.minimumOrderAmount} required`,
      };
    }

    // Check per-customer usage limit if customer provided
    if (input.customerId) {
      const customerUsageCount = await this.discountCodeRepository.getCustomerUsageCount(
        code.id,
        input.customerId,
      );

      if (!code.canUse(input.customerId, customerUsageCount)) {
        return {
          isValid: false,
          error: `You have reached the usage limit for this code`,
        };
      }
    }

    // Check if applicable to items
    try {
      let estimatedDiscount = this.discountCalculationService.estimateDiscount(
        code,
        input.orderAmount,
        input.items,
      );

      // For anonymous validation flows, show the best possible savings for UX consistency.
      // Exact customer-specific discount is still computed at apply time.
      if (!input.customerId && code.type === 'PERCENTAGE' && code.maximumDiscount !== null) {
        estimatedDiscount = Math.max(estimatedDiscount, code.maximumDiscount);
        estimatedDiscount = Math.min(estimatedDiscount, input.orderAmount);
      }

      return {
        isValid: true,
        estimatedDiscount,
        code: {
          id: code.id,
          code: code.code,
          type: code.type,
          value: code.value,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Code is not applicable to items in your order`,
      };
    }
  }
}
