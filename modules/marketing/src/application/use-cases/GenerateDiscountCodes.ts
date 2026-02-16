/**
 * GenerateDiscountCodes Use-Case
 * Application use-case for batch generating discount codes
 *
 * @module Application/UseCases
 */

import { DiscountCode } from '../../domain/entities/DiscountCode';
import { IDiscountCodeRepository } from '../../domain/repositories/IDiscountCodeRepository';
import { ValidationError } from '../../domain/errors/marketing.errors';

/**
 * Input for GenerateDiscountCodes use-case
 */
export interface GenerateDiscountCodesInput {
  /** Number of codes to generate */
  count: number;
  /** Code prefix (e.g., 'SUMMER') */
  prefix: string;
  /** Campaign ID */
  campaignId?: string;
  /** Discount type */
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
  /** Discount value */
  value: number;
  /** Minimum order amount */
  minimumOrderAmount?: number;
  /** Maximum discount cap */
  maximumDiscount?: number;
  /** Code validity start date */
  validFrom: Date;
  /** Code validity end date */
  validTo: Date;
  /** Maximum uses per code (null = unlimited) */
  maxUsesPerCode?: number | null;
  /** Maximum uses per customer (null = unlimited) */
  maxUsesPerCustomer?: number | null;
  /** Product IDs code applies to */
  applicableToProducts?: string[];
  /** Category IDs code applies to */
  applicableToCategories?: string[];
  /** Product IDs to exclude */
  excludedProducts?: string[];
  /** Can codes be stacked */
  isStackable?: boolean;
  /** User creating the codes */
  createdBy: string;
}

/**
 * Output from GenerateDiscountCodes use-case
 */
export interface GenerateDiscountCodesOutput {
  /** Generated discount codes */
  discountCodes: DiscountCode[];
  /** Count of successfully generated codes */
  generatedCount: number;
  /** Generated code strings */
  codes: string[];
}

/**
 * GenerateDiscountCodes Use-Case
 *
 * Responsibilities:
 * - Validate batch generation input
 * - Generate unique codes with prefix + random suffix
 * - Create discount code entities
 * - Persist all codes to repository
 * - Handle errors gracefully (skip duplicates)
 *
 * @class GenerateDiscountCodes
 */
export class GenerateDiscountCodes {
  /**
   * Create a new GenerateDiscountCodes use-case instance
   *
   * @param discountCodeRepository - Discount code repository
   */
  constructor(private readonly discountCodeRepository: IDiscountCodeRepository) {}

  /**
   * Execute the GenerateDiscountCodes use-case
   *
   * @param input - Generate codes input
   * @returns Generated codes
   * @throws ValidationError if input is invalid
   */
  async execute(input: GenerateDiscountCodesInput): Promise<GenerateDiscountCodesOutput> {
    // Validate count
    if (input.count < 1 || input.count > 10000) {
      throw new ValidationError('Invalid code count', 'Must be between 1 and 10000');
    }

    // Validate prefix
    if (!input.prefix || input.prefix.length < 2 || input.prefix.length > 10) {
      throw new ValidationError('Invalid prefix', 'Must be 2-10 characters');
    }

    // Validate other inputs (reuse validation from CreateDiscountCode)
    if (input.validTo <= input.validFrom) {
      throw new ValidationError('Invalid date range', 'End date must be after start date');
    }

    if (input.value <= 0) {
      throw new ValidationError('Invalid discount value', 'Value must be greater than 0');
    }

    if (input.type === 'PERCENTAGE' && input.value > 100) {
      throw new ValidationError('Invalid discount value', 'Percentage cannot exceed 100');
    }

    // Generate codes
    const codes: string[] = [];
    const discountCodes: DiscountCode[] = [];

    for (let i = 0; i < input.count; i++) {
      const code = this.generateCode(input.prefix);

      // Check if duplicate exists
      const existing = await this.discountCodeRepository.findByCode(code);
      if (existing) {
        continue; // Skip duplicates
      }

      const discountCode = new DiscountCode(
        this.generateId(),
        input.campaignId || null,
        code,
        input.type,
        input.value,
        input.minimumOrderAmount || null,
        input.maximumDiscount || null,
        input.validFrom,
        input.validTo,
        input.maxUsesPerCode ?? null,
        0,
        input.maxUsesPerCustomer ?? null,
        input.applicableToProducts || [],
        input.applicableToCategories || [],
        input.excludedProducts || [],
        true,
        input.isStackable ?? true,
        input.createdBy,
        new Date()
      );

      codes.push(code);
      discountCodes.push(discountCode);
    }

    // Persist all codes
    const savedCodes: DiscountCode[] = [];
    for (const discountCode of discountCodes) {
      const saved = await this.discountCodeRepository.save(discountCode);
      savedCodes.push(saved);
    }

    return {
      discountCodes: savedCodes,
      generatedCount: savedCodes.length,
      codes: codes.slice(0, savedCodes.length),
    };
  }

  /**
   * Generate a unique code with prefix and random suffix
   * Format: PREFIX-RANDOM123 (e.g., SUMMER-ABC123XYZ)
   *
   * @internal
   */
  private generateCode(prefix: string): string {
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    return `${prefix.toUpperCase()}-${random}`;
  }

  /**
   * Generate unique ID
   * @internal
   */
  private generateId(): string {
    return `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
