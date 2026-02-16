/**
 * ManagePromotions Use Case
 * CRUD operations for promotions with validation
 */

import { CreatePromotionDTO } from '../dtos/pricing.dtos';
import {
  InvalidPromotionError,
  ProductNotFoundError,
  PromotionDateError,
  MarginBelowMinimumError,
} from '../errors/pricing.errors';
import { IPriceRepository } from '../ports/IPriceRepository';

/**
 * Promotion domain object representation
 */
export interface Promotion {
  id: number;
  productId: number;
  promotionalPrice: number;
  originalPrice: number;
  validFrom: Date;
  validUntil: Date;
  reason: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MINIMUM_MARGIN_PERCENTAGE = 0.1; // 10% minimum margin

/**
 * Use case for managing promotions (create, deactivate, query)
 */
export class ManagePromotions {
  constructor(private priceRepository: IPriceRepository) {}

  /**
   * Create a new promotion with validation
   * @param data - Promotion creation data
   * @returns Created promotion
   * @throws ProductNotFoundError if product not found
   * @throws InvalidPromotionError if price validation fails
   * @throws PromotionDateError if dates are invalid or overlap
   * @throws MarginBelowMinimumError if margin falls below minimum
   */
  async createPromotion(data: CreatePromotionDTO): Promise<Promotion> {
    // Validate product exists
    const productPrice = await this.priceRepository.getProductPrice(
      data.productId
    );
    if (!productPrice) {
      throw new ProductNotFoundError(data.productId);
    }

    const originalPrice = productPrice.price;

    // Validate promotional price is less than original
    if (data.promotionalPrice >= originalPrice) {
      throw new InvalidPromotionError(
        `Promotional price (${data.promotionalPrice}) must be less than original price (${originalPrice})`,
        {
          promotionalPrice: data.promotionalPrice,
          originalPrice,
        }
      );
    }

    // Validate promotional price is not zero or negative
    if (data.promotionalPrice <= 0) {
      throw new InvalidPromotionError(
        `Promotional price must be greater than 0, got ${data.promotionalPrice}`,
        {
          promotionalPrice: data.promotionalPrice,
        }
      );
    }

    // Validate dates
    this.validatePromotionDates(data.validFrom, data.validUntil);

    // Validate dates do not overlap with existing active promotions
    await this.validateNoDateOverlap(data.productId, data.validFrom, data.validUntil);

    // Validate margin doesn't fall below minimum
    const margin = (originalPrice - data.promotionalPrice) / originalPrice;
    const discountPercentage = (originalPrice - data.promotionalPrice) / originalPrice;

    // Assuming we need minimum margin (cost + min profit). If cost is unknown, we validate based on discount
    // For now, we ensure the discount isn't more than allowed (i.e., 90% discount would be too much)
    const maxAllowableDiscountPercentage = 0.9; // Cannot discount more than 90%
    if (discountPercentage > maxAllowableDiscountPercentage) {
      throw new InvalidPromotionError(
        `Discount of ${(discountPercentage * 100).toFixed(2)}% exceeds maximum allowed 90%`,
        {
          discount: discountPercentage,
          maxAllowed: maxAllowableDiscountPercentage,
        }
      );
    }

    // Create promotion in repository
    const promotion = await this.priceRepository.createPromotion(data);

    return promotion;
  }

  /**
   * Deactivate a promotion
   * @param promotionId - ID of promotion to deactivate
   * @throws Error if promotion not found
   */
  async deactivatePromotion(promotionId: number): Promise<void> {
    await this.priceRepository.deactivatePromotion(promotionId);
  }

  /**
   * Get all active promotions, optionally filtered by product
   * @param productId - Optional product ID to filter by
   * @returns Array of active promotions
   */
  async getActivePromotions(productId?: number): Promise<Promotion[]> {
    if (productId) {
      return this.priceRepository.getActivePromotionsForProduct(productId);
    }

    return this.priceRepository.getAllActivePromotions();
  }

  /**
   * Expire outdated promotions (to be called by scheduled job/cron)
   * @returns Number of promotions that were expired
   */
  async expireOverduePromotions(): Promise<number> {
    const now = new Date();
    const expiredCount = await this.priceRepository.expirePromotionsBefore(now);
    return expiredCount;
  }

  /**
   * Private method to validate promotion dates
   */
  private validatePromotionDates(validFrom: Date, validUntil: Date): void {
    if (!(validFrom instanceof Date) || isNaN(validFrom.getTime())) {
      throw new PromotionDateError(
        'validFrom must be a valid date',
        { validFrom }
      );
    }

    if (!(validUntil instanceof Date) || isNaN(validUntil.getTime())) {
      throw new PromotionDateError(
        'validUntil must be a valid date',
        { validUntil }
      );
    }

    if (validFrom >= validUntil) {
      throw new PromotionDateError(
        `validFrom (${validFrom.toISOString()}) must be before validUntil (${validUntil.toISOString()})`,
        { validFrom, validUntil }
      );
    }

    const now = new Date();
    if (validUntil <= now) {
      throw new PromotionDateError(
        `Promotion cannot end in the past (validUntil: ${validUntil.toISOString()})`,
        { validUntil }
      );
    }
  }

  /**
   * Private method to validate no date overlaps with existing promotions
   */
  private async validateNoDateOverlap(
    productId: number,
    validFrom: Date,
    validUntil: Date
  ): Promise<void> {
    const activePromotions =
      await this.priceRepository.getActivePromotionsForProduct(productId);

    for (const existing of activePromotions) {
      // Check if date ranges overlap
      if (validFrom < existing.validUntil && validUntil > existing.validFrom) {
        throw new PromotionDateError(
          `Promotion dates overlap with existing promotion (ID: ${existing.id}) ` +
          `from ${existing.validFrom.toISOString()} to ${existing.validUntil.toISOString()}`,
          {
            newValidFrom: validFrom,
            newValidUntil: validUntil,
            existingPromotionId: existing.id,
            existingValidFrom: existing.validFrom,
            existingValidUntil: existing.validUntil,
          }
        );
      }
    }
  }
}
