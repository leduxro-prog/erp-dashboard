/**
 * CalculatePrice Use Case
 * Calculates the final price for a single product with all applicable discounts
 */

import { PriceCalculationResult } from '../dtos/pricing.dtos';
import {
  ProductNotFoundError,
  PricingError,
} from '../errors/pricing.errors';
import { IPriceRepository } from '../ports/IPriceRepository';
import { ITierRepository } from '../ports/ITierRepository';

/**
 * Use case for calculating the final price of a product
 * Orchestrates domain objects and repositories to compute price with discounts
 */
export class CalculatePrice {
  constructor(
    private priceRepository: IPriceRepository,
    private tierRepository: ITierRepository
  ) {}

  /**
   * Execute the price calculation
   * @param productId - The product to calculate price for
   * @param customerId - Optional customer ID for tier-based discounts
   * @param quantity - Optional quantity for volume discount calculation
   * @returns Complete price calculation breakdown
   * @throws ProductNotFoundError if product not found
   * @throws PricingError if calculation fails
   */
  async execute(
    productId: number,
    customerId?: number,
    quantity: number = 1
  ): Promise<PriceCalculationResult> {
    // Step 1: Get product price from repository
    const productPrice = await this.priceRepository.getProductPrice(productId);
    if (!productPrice) {
      throw new ProductNotFoundError(productId);
    }

    let basePrice = productPrice.price;
    let tierDiscount = 0;
    let tierDiscountPercentage = 0;
    let appliedTierLevel: string | undefined;

    // Step 2: If customerId provided, get customer tier
    let customerTierDiscount = 0;
    let customerTierName: string | undefined;
    if (customerId) {
      const customerTier = await this.tierRepository.getCustomerTier(
        customerId
      );
      if (customerTier) {
        customerTierDiscount = customerTier.discountPercentage;
        tierDiscountPercentage = customerTierDiscount;
        tierDiscount = basePrice * customerTierDiscount;
        customerTierName = customerTier.level;
        appliedTierLevel = customerTier.level;
      }
    }

    // Step 3: Get active promotion for product
    let promotionalDiscount = 0;
    let promotionalPrice = basePrice - tierDiscount;
    let appliedPromotion: any = undefined;
    const activePromotions =
      await this.priceRepository.getActivePromotionsForProduct(productId);

    if (activePromotions && activePromotions.length > 0) {
      // Use the first active promotion (or implement priority logic if needed)
      const promotion = activePromotions[0];
      promotionalPrice = promotion.promotionalPrice;
      promotionalDiscount = basePrice - promotion.promotionalPrice;

      appliedPromotion = {
        promotionId: promotion.id,
        validFrom: promotion.validFrom,
        validUntil: promotion.validUntil,
        reason: promotion.reason,
      };
    }

    // Step 4: Get volume discount rules
    let volumeDiscount = 0;
    let volumeDiscountPercentage = 0;
    let appliedVolumeDiscount: any = undefined;
    const volumeDiscountRule =
      await this.priceRepository.getVolumeDiscountRuleForQuantity(
        productId,
        quantity
      );

    const priceBeforeVolume = Math.max(
      promotionalPrice,
      basePrice - tierDiscount
    );
    if (volumeDiscountRule) {
      volumeDiscountPercentage = volumeDiscountRule.discountPercentage;
      volumeDiscount = priceBeforeVolume * volumeDiscountPercentage;

      appliedVolumeDiscount = {
        minQuantity: volumeDiscountRule.minQuantity,
        maxQuantity: volumeDiscountRule.maxQuantity,
        discountPercentage: volumeDiscountRule.discountPercentage,
      };
    }

    // Step 5: Use domain calculation to compute final price
    const priceBeforeDiscount = basePrice;
    const totalDiscount = tierDiscount + promotionalDiscount + volumeDiscount;
    const totalDiscountPercentage =
      totalDiscount > 0 ? totalDiscount / basePrice : 0;
    const finalPrice = Math.max(
      basePrice - totalDiscount,
      0 // Ensure price never goes negative
    );

    // Step 6: Return full calculation breakdown
    return {
      productId,
      quantity,
      basePrice,
      tierDiscount,
      tierDiscountPercentage,
      promotionalDiscount,
      promotionalPrice,
      volumeDiscount,
      volumeDiscountPercentage,
      totalDiscount,
      totalDiscountPercentage,
      finalPrice,
      currency: 'RON',
      breakdownDetails: {
        appliedTierLevel,
        appliedPromotion,
        appliedVolumeDiscount,
      },
    };
  }
}
