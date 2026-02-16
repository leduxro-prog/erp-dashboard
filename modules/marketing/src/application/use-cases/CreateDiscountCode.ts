/**
 * CreateDiscountCode Use-Case
 * Application use-case for creating discount codes
 *
 * @module Application/UseCases
 */

import { DiscountCode } from '../../domain/entities/DiscountCode';
import { IDiscountCodeRepository } from '../../domain/repositories/IDiscountCodeRepository';
import { DuplicateCodeError, ValidationError } from '../../domain/errors/marketing.errors';

/**
 * Input for CreateDiscountCode use-case
 */
export interface CreateDiscountCodeInput {
  /** Campaign ID (optional) */
  campaignId?: string;
  /** Discount code (auto-generated if not provided) */
  code?: string;
  /** Discount type */
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
  /** Discount value */
  value: number;
  /** Minimum order amount to apply code */
  minimumOrderAmount?: number;
  /** Maximum discount cap */
  maximumDiscount?: number;
  /** Code validity start date */
  validFrom: Date;
  /** Code validity end date */
  validTo: Date;
  /** Maximum total uses (null = unlimited) */
  maxUses?: number | null;
  /** Maximum uses per customer (null = unlimited) */
  maxUsesPerCustomer?: number | null;
  /** Product IDs code applies to (empty = all) */
  applicableToProducts?: string[];
  /** Category IDs code applies to (empty = all) */
  applicableToCategories?: string[];
  /** Product IDs to exclude */
  excludedProducts?: string[];
  /** Can code be stacked with others */
  isStackable?: boolean;
  /** User creating the code */
  createdBy: string;
}

/**
 * Output from CreateDiscountCode use-case
 */
export interface CreateDiscountCodeOutput {
  /** Created discount code */
  discountCode: DiscountCode;
  /** Generated code if auto-generated */
  generatedCode: string;
}

/**
 * CreateDiscountCode Use-Case
 *
 * Responsibilities:
 * - Validate code input (values, dates, type)
 * - Generate code if not provided
 * - Check for duplicate codes
 * - Create discount code entity
 * - Persist to repository
 *
 * @class CreateDiscountCode
 */
export class CreateDiscountCode {
  /**
   * Create a new CreateDiscountCode use-case instance
   *
   * @param discountCodeRepository - Discount code repository
   */
  constructor(private readonly discountCodeRepository: IDiscountCodeRepository) {}

  /**
   * Execute the CreateDiscountCode use-case
   *
   * @param input - Create discount code input
   * @returns Created discount code
   * @throws DuplicateCodeError if code already exists
   * @throws ValidationError if input is invalid
   */
  async execute(input: CreateDiscountCodeInput): Promise<CreateDiscountCodeOutput> {
    // Validate dates
    if (input.validTo <= input.validFrom) {
      throw new ValidationError('Invalid date range', 'End date must be after start date');
    }

    // Validate value
    if (input.value <= 0) {
      throw new ValidationError('Invalid discount value', 'Value must be greater than 0');
    }

    if (input.type === 'PERCENTAGE' && input.value > 100) {
      throw new ValidationError('Invalid discount value', 'Percentage cannot exceed 100');
    }

    // Validate minimum order amount
    if (input.minimumOrderAmount !== undefined && input.minimumOrderAmount < 0) {
      throw new ValidationError('Invalid minimum order amount', 'Must be non-negative');
    }

    // Validate maximum discount
    if (input.maximumDiscount !== undefined && input.maximumDiscount < 0) {
      throw new ValidationError('Invalid maximum discount', 'Must be non-negative');
    }

    // Validate max uses
    if (input.maxUses !== null && input.maxUses !== undefined && input.maxUses < 1) {
      throw new ValidationError('Invalid max uses', 'Must be at least 1');
    }

    // Validate max uses per customer
    if (
      input.maxUsesPerCustomer !== null &&
      input.maxUsesPerCustomer !== undefined &&
      input.maxUsesPerCustomer < 1
    ) {
      throw new ValidationError('Invalid max uses per customer', 'Must be at least 1');
    }

    // Generate or use provided code
    const code = input.code || this.generateCode();

    // Check for duplicate
    const existing = await this.discountCodeRepository.findByCode(code.toUpperCase());
    if (existing) {
      throw new DuplicateCodeError(code);
    }

    // Create entity
    const discountCode = new DiscountCode(
      this.generateId(),
      input.campaignId || null,
      code.toUpperCase(),
      input.type,
      input.value,
      input.minimumOrderAmount ?? null,
      input.maximumDiscount ?? null,
      input.validFrom,
      input.validTo,
      input.maxUses ?? null,
      0,
      input.maxUsesPerCustomer ?? null,
      input.applicableToProducts || [],
      input.applicableToCategories || [],
      input.excludedProducts || [],
      true,
      input.isStackable ?? true,
      input.createdBy,
      new Date(),
    );

    // Persist
    const saved = await this.discountCodeRepository.save(discountCode);

    return {
      discountCode: saved,
      generatedCode: code.toUpperCase(),
    };
  }

  /**
   * Generate a random discount code
   * Format: PREFIX-RANDOM (e.g., PROMO-ABC123)
   *
   * @internal
   */
  private generateCode(): string {
    const prefix = 'PROMO';
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${random}`;
  }

  /**
   * Generate unique ID
   * @internal
   */
  private generateId(): string {
    return `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
