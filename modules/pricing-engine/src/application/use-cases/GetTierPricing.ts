/**
 * GetTierPricing Use Case
 * Retrieve tier-specific pricing for display purposes
 */

import { TierPricingDTO } from '../dtos/pricing.dtos';
import { ProductNotFoundError } from '../errors/pricing.errors';
import { IPriceRepository } from '../ports/IPriceRepository';
import { TierLevel } from './ManageTiers';

/**
 * Use case for getting tier-specific pricing information
 * Useful for displaying pricing tables or tier comparison pages
 */
export class GetTierPricing {
  constructor(private priceRepository: IPriceRepository) {}

  /**
   * Execute the tier pricing retrieval
   * @param productId - The product to get tier pricing for
   * @returns Tier pricing DTO with prices at each tier level
   * @throws ProductNotFoundError if product not found
   */
  async execute(productId: number): Promise<TierPricingDTO> {
    // Get the base product price
    const productPrice = await this.priceRepository.getProductPrice(productId);
    if (!productPrice) {
      throw new ProductNotFoundError(productId);
    }

    const basePrice = productPrice.price;

    // Define tier structure with discount percentages
    const tierStructure = [
      { level: TierLevel.BRONZE, name: 'Bronze', discount: 0.05 },    // 5%
      { level: TierLevel.SILVER, name: 'Silver', discount: 0.1 },     // 10%
      { level: TierLevel.GOLD, name: 'Gold', discount: 0.15 },        // 15%
      { level: TierLevel.PLATINUM, name: 'Platinum', discount: 0.2 },  // 20%
    ];

    // Calculate price at each tier
    const tiers = tierStructure.map((tier) => ({
      level: tier.level,
      name: tier.name,
      discountPercentage: tier.discount,
      price: basePrice * (1 - tier.discount),
    }));

    return {
      productId,
      basePrice,
      tiers,
      currency: 'RON',
    };
  }
}
