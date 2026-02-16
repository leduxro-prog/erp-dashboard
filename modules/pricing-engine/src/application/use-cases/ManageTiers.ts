/**
 * ManageTiers Use Case
 * Customer tier management and retrieval
 */

import { CustomerTierDTO } from '../dtos/pricing.dtos';
import { CustomerTierNotFoundError, PricingError } from '../errors/pricing.errors';
import { ITierRepository } from '../ports/ITierRepository';

/**
 * Enum for tier levels
 */
export enum TierLevel {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

/**
 * Use case for managing customer tiers
 */
export class ManageTiers {
  constructor(private tierRepository: ITierRepository) { }

  /**
   * Get the current tier for a customer
   * @param customerId - The customer ID
   * @returns Customer tier DTO with discount percentage
   * @throws CustomerTierNotFoundError if customer has no tier assigned
   */
  async getCustomerTier(customerId: number): Promise<CustomerTierDTO> {
    const tier = await this.tierRepository.getCustomerTier(customerId);

    if (!tier) {
      throw new CustomerTierNotFoundError(customerId);
    }

    return {
      customerId,
      level: tier.level,
      name: this.getTierName(tier.level as TierLevel),
      discountPercentage: tier.discountPercentage,
    };
  }

  /**
   * Set or update a customer's tier
   * @param customerId - The customer ID
   * @param tierLevel - The new tier level
   * @param reason - Reason for the tier change (audit trail)
   * @throws PricingError if tier level is invalid
   */
  async setCustomerTier(
    customerId: number,
    tierLevel: TierLevel,
    reason: string
  ): Promise<void> {
    // Validate tier level
    if (!Object.values(TierLevel).includes(tierLevel)) {
      throw new PricingError(
        `Invalid tier level: ${tierLevel}. Must be one of: ${Object.values(TierLevel).join(', ')}`,
        'INVALID_TIER_LEVEL',
        400,
        { tierLevel }
      );
    }

    // Validate reason is provided
    if (!reason || reason.trim().length === 0) {
      throw new PricingError(
        'Reason for tier change must be provided for audit trail',
        'INVALID_TIER_REASON',
        400
      );
    }

    // Get discount percentage for tier
    const discountPercentage = this.getDiscountForTier(tierLevel);

    // Update in repository
    await this.tierRepository.setCustomerTier(
      customerId,
      tierLevel,
      discountPercentage,
      reason
    );
  }

  /**
   * Get all available tiers with their properties
   * @returns Array of all tier levels with names and discounts
   */
  async getAllTiers(): Promise<Array<{
    level: TierLevel;
    name: string;
    discountPercentage: number;
  }>> {
    return Object.values(TierLevel).map((level) => ({
      level: level as TierLevel,
      name: this.getTierName(level as TierLevel),
      discountPercentage: this.getDiscountForTier(level as TierLevel),
    }));
  }

  /**
   * Get the human-readable name for a tier level
   * @param level - Tier level enum
   * @returns Human-readable tier name
   */
  private getTierName(level: TierLevel): string {
    const names: Record<TierLevel, string> = {
      [TierLevel.BRONZE]: 'Bronze',
      [TierLevel.SILVER]: 'Silver',
      [TierLevel.GOLD]: 'Gold',
      [TierLevel.PLATINUM]: 'Platinum',
    };
    return names[level];
  }

  /**
   * Get the discount percentage for a tier level
   * @param level - Tier level enum
   * @returns Discount percentage (0.0 to 1.0)
   */
  private getDiscountForTier(level: TierLevel): number {
    const discounts: Record<TierLevel, number> = {
      [TierLevel.BRONZE]: 0.05,    // 5%
      [TierLevel.SILVER]: 0.1,     // 10%
      [TierLevel.GOLD]: 0.15,      // 15%
      [TierLevel.PLATINUM]: 0.2,   // 20%
    };
    return discounts[level];
  }
}
