/**
 * Tier Calculation Service
 * Determines B2B customer pricing tiers based on spending thresholds.
 *
 * @module B2B Portal - Domain Services
 */

import { B2BCustomerTier } from '../entities/B2BCustomer';

/**
 * Tier threshold configuration
 */
interface TierThreshold {
  tier: B2BCustomerTier;
  minSpent: number;
  description: string;
}

/**
 * Tier Calculation Service
 *
 * Encapsulates business logic for determining customer tiers based on:
 * - Total lifetime spending
 * - Number of orders
 * - Average order value
 *
 * @class TierCalculationService
 */
export class TierCalculationService {
  /**
   * Tier thresholds (spending-based)
   * Updated with B2B tiers: STANDARD, SILVER, GOLD, PLATINUM
   */
  private readonly tierThresholds: TierThreshold[] = [
    {
      tier: B2BCustomerTier.PLATINUM,
      minSpent: 50000,
      description: 'Platinum: > 50,000 RON lifetime spending',
    },
    {
      tier: B2BCustomerTier.GOLD,
      minSpent: 20000,
      description: 'Gold: > 20,000 RON lifetime spending',
    },
    {
      tier: B2BCustomerTier.SILVER,
      minSpent: 5000,
      description: 'Silver: > 5,000 RON lifetime spending',
    },
    {
      tier: B2BCustomerTier.STANDARD,
      minSpent: 0,
      description: 'Standard: < 5,000 RON lifetime spending',
    },
  ];

  /**
   * Calculate tier based on total lifetime spending.
   *
   * @param totalSpent - Total amount spent by customer
   * @returns Appropriate tier for spending amount
   */
  calculateTierBySpending(totalSpent: number): B2BCustomerTier {
    for (const threshold of this.tierThresholds) {
      if (totalSpent >= threshold.minSpent) {
        return threshold.tier;
      }
    }

    return B2BCustomerTier.STANDARD;
  }

  /**
   * Calculate tier based on multiple factors (advanced).
   * Considers spending, order count, and average order value.
   *
   * @param totalSpent - Total lifetime spending
   * @param orderCount - Number of orders placed
   * @param avgOrderValue - Average order value
   * @returns Appropriate tier based on weighted factors
   */
  calculateTierAdvanced(
    totalSpent: number,
    orderCount: number,
    avgOrderValue: number
  ): B2BCustomerTier {
    // Weights: spending (60%), order count (25%), avg order value (15%)
    let score = 0;

    // Spending component (max 60 points)
    const spendingScore = Math.min(60, (totalSpent / 50000) * 60);
    score += spendingScore;

    // Order count component (max 25 points)
    // 50+ orders = full score
    const orderScore = Math.min(25, (orderCount / 50) * 25);
    score += orderScore;

    // Avg order value component (max 15 points)
    // 1000+ avg order value = full score
    const avgScore = Math.min(15, (avgOrderValue / 1000) * 15);
    score += avgScore;

    // Map score to tier
    if (score >= 80) {
      return B2BCustomerTier.PLATINUM;
    } else if (score >= 60) {
      return B2BCustomerTier.GOLD;
    } else if (score >= 40) {
      return B2BCustomerTier.SILVER;
    }

    return B2BCustomerTier.STANDARD;
  }

  /**
   * Get minimum spending required for a tier.
   *
   * @param tier - Tier to check
   * @returns Minimum spending amount for that tier
   */
  getMinimumSpendingForTier(tier: B2BCustomerTier): number {
    const threshold = this.tierThresholds.find((t) => t.tier === tier);
    return threshold?.minSpent || 0;
  }

  /**
   * Get spending needed to reach next tier.
   *
   * @param currentTier - Current customer tier
   * @param totalSpent - Current total spending
   * @returns Amount needed to reach next tier, or 0 if already at highest
   */
  getSpendingToNextTier(currentTier: B2BCustomerTier, totalSpent: number): number {
    const tierOrder = [
      B2BCustomerTier.STANDARD,
      B2BCustomerTier.SILVER,
      B2BCustomerTier.GOLD,
      B2BCustomerTier.PLATINUM,
    ];

    const currentIndex = tierOrder.indexOf(currentTier);
    if (currentIndex === tierOrder.length - 1) {
      // Already at highest tier
      return 0;
    }

    const nextTier = tierOrder[currentIndex + 1];
    const nextThreshold = this.tierThresholds.find((t) => t.tier === nextTier);

    if (!nextThreshold) {
      return 0;
    }

    return Math.max(0, nextThreshold.minSpent - totalSpent);
  }

  /**
   * Get discount percentage for a tier.
   * Used in pricing calculations.
   *
   * @param tier - Customer tier
   * @returns Discount percentage (as decimal: 0.0 to 0.15)
   */
  getDiscountForTier(tier: B2BCustomerTier): number {
    const discounts: Record<B2BCustomerTier, number> = {
      [B2BCustomerTier.STANDARD]: 0.0,
      [B2BCustomerTier.SILVER]: 0.05,
      [B2BCustomerTier.GOLD]: 0.1,
      [B2BCustomerTier.PLATINUM]: 0.15,
    };

    return discounts[tier];
  }

  /**
   * Get human-readable description for a tier.
   *
   * @param tier - Customer tier
   * @returns Description
   */
  getDescriptionForTier(tier: B2BCustomerTier): string {
    const threshold = this.tierThresholds.find((t) => t.tier === tier);
    return threshold?.description || '';
  }

  /**
   * Get all tier information.
   *
   * @returns Array of all tier thresholds
   */
  getAllTierThresholds(): TierThreshold[] {
    return [...this.tierThresholds];
  }

  /**
   * Check if customer should be upgraded to a higher tier.
   *
   * @param currentTier - Current tier
   * @param totalSpent - Total spending
   * @returns New tier if upgrade recommended, or current tier if no upgrade needed
   */
  checkForTierUpgrade(currentTier: B2BCustomerTier, totalSpent: number): B2BCustomerTier {
    const recommendedTier = this.calculateTierBySpending(totalSpent);

    // Only upgrade, never downgrade
    const tierOrder = [
      B2BCustomerTier.STANDARD,
      B2BCustomerTier.SILVER,
      B2BCustomerTier.GOLD,
      B2BCustomerTier.PLATINUM,
    ];

    const currentIndex = tierOrder.indexOf(currentTier);
    const recommendedIndex = tierOrder.indexOf(recommendedTier);

    return recommendedIndex > currentIndex ? recommendedTier : currentTier;
  }

  /**
   * Calculate payment terms (in days) based on tier.
   * Higher tiers get longer payment terms.
   *
   * @param tier - Customer tier
   * @returns Payment terms in days
   */
  getPaymentTermsForTier(tier: B2BCustomerTier): number {
    const terms: Record<B2BCustomerTier, number> = {
      [B2BCustomerTier.STANDARD]: 0, // Prepayment
      [B2BCustomerTier.SILVER]: 15,
      [B2BCustomerTier.GOLD]: 30,
      [B2BCustomerTier.PLATINUM]: 45,
    };

    return terms[tier];
  }
}
