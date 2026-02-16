/**
 * ApplyDiscountCode Use-Case
 * Application use-case for applying discount codes to orders
 *
 * @module Application/UseCases
 */

import { DiscountCode } from '../../domain/entities/DiscountCode';
import { MarketingEvent } from '../../domain/entities/MarketingEvent';
import { IDiscountCodeRepository } from '../../domain/repositories/IDiscountCodeRepository';
import { IMarketingEventRepository } from '../../domain/repositories/IMarketingEventRepository';
import { DiscountCalculationService } from '../../domain/services/DiscountCalculationService';
import {
  InvalidDiscountCodeError,
  DiscountCodeExpiredError,
  DiscountCodeUsedUpError,
  CodeUsagePerCustomerExceededError,
} from '../../domain/errors/marketing.errors';

/**
 * Order item for discount application
 */
export interface ApplyOrderItem {
  productId: string;
  categoryId: string;
  amount: number;
  quantity: number;
}

/**
 * Input for ApplyDiscountCode use-case
 */
export interface ApplyDiscountCodeInput {
  /** Discount code string */
  code: string;
  /** Order amount */
  orderAmount: number;
  /** Order items */
  items: ApplyOrderItem[];
  /** Customer ID */
  customerId: string;
  /** Campaign ID (optional) */
  campaignId?: string;
}

/**
 * Output from ApplyDiscountCode use-case
 */
export interface ApplyDiscountCodeOutput {
  /** Code applied successfully */
  success: boolean;
  /** Code used */
  code: string;
  /** Discount amount */
  discountAmount: number;
  /** Final order amount after discount */
  finalAmount: number;
  /** Discount percentage */
  discountPercentage: number;
  /** Error message if failed */
  error?: string;
}

/**
 * ApplyDiscountCode Use-Case
 *
 * Responsibilities:
 * - Find discount code by string
 * - Validate code against order
 * - Calculate discount amount
 * - Increment code usage
 * - Create marketing event for tracking
 * - Persist changes
 * - Publish marketing.discount_applied event
 *
 * @class ApplyDiscountCode
 */
export class ApplyDiscountCode {
  /**
   * Create a new ApplyDiscountCode use-case instance
   *
   * @param discountCodeRepository - Discount code repository
   * @param marketingEventRepository - Marketing event repository
   * @param discountCalculationService - Discount calculation service
   */
  constructor(
    private readonly discountCodeRepository: IDiscountCodeRepository,
    private readonly marketingEventRepository: IMarketingEventRepository,
    private readonly discountCalculationService: DiscountCalculationService,
  ) {}

  /**
   * Execute the ApplyDiscountCode use-case
   *
   * @param input - Apply code input
   * @returns Application result
   */
  async execute(input: ApplyDiscountCodeInput): Promise<ApplyDiscountCodeOutput> {
    // Find code
    const code = await this.discountCodeRepository.findByCode(input.code.toUpperCase());
    if (!code) {
      return {
        success: false,
        code: input.code,
        discountAmount: 0,
        finalAmount: input.orderAmount,
        discountPercentage: 0,
        error: `Discount code '${input.code}' not found`,
      };
    }

    // Get customer usage count
    const customerUsageCount = await this.discountCodeRepository.getCustomerUsageCount(
      code.id,
      input.customerId,
    );

    // Apply code using calculation service
    try {
      const discountResult = this.discountCalculationService.applyCode(
        code,
        input.orderAmount,
        input.items,
        input.customerId,
        customerUsageCount,
      );

      // Increment usage atomically to avoid race conditions at max usage.
      const incrementedCode = await this.discountCodeRepository.incrementUsageIfAvailable(code.id);
      if (!incrementedCode) {
        throw new DiscountCodeUsedUpError(code.code);
      }

      // Create marketing event
      const event = MarketingEvent.createConverted(
        input.campaignId || code.campaignId || '',
        input.customerId,
        code.id,
        {
          discountCode: code.code,
          discountAmount: discountResult.discountAmount,
          originalAmount: input.orderAmount,
          finalAmount: discountResult.finalAmount,
        },
      );

      await this.marketingEventRepository.save(event);

      return {
        success: true,
        code: discountResult.code,
        discountAmount: discountResult.discountAmount,
        finalAmount: discountResult.finalAmount,
        discountPercentage: discountResult.discountPercentage,
      };
    } catch (error) {
      let errorMessage = 'Unable to apply discount code';

      if (error instanceof InvalidDiscountCodeError) {
        errorMessage = error.message;
      } else if (error instanceof DiscountCodeExpiredError) {
        errorMessage = error.message;
      } else if (error instanceof DiscountCodeUsedUpError) {
        errorMessage = error.message;
      } else if (error instanceof CodeUsagePerCustomerExceededError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        code: input.code,
        discountAmount: 0,
        finalAmount: input.orderAmount,
        discountPercentage: 0,
        error: errorMessage,
      };
    }
  }
}
