/**
 * Audience Segmentation Service
 * Domain service for customer audience targeting and segmentation
 *
 * @module Domain/Services
 */

import { AudienceFilter } from '../entities/Campaign';

/**
 * Customer data for segmentation
 */
export interface CustomerSegmentData {
  /** Customer ID */
  customerId: string;
  /** Customer tier */
  tier: string;
  /** Total amount spent */
  totalSpent: number;
  /** Last order date */
  lastOrderDate: Date | null;
  /** Categories purchased */
  purchasedCategories: string[];
  /** Customer tags */
  tags: string[];
  /** Registration date */
  registrationDate: Date;
}

/**
 * AudienceSegmentationService
 *
 * Domain service for segmenting customers based on:
 * - Customer tier (BRONZE, SILVER, GOLD, PLATINUM)
 * - Purchase history and total spent
 * - Product categories purchased
 * - Customer tags/attributes
 * - Registration date
 * - Recent activity
 *
 * Returns customer IDs matching filter criteria.
 *
 * @class AudienceSegmentationService
 */
export class AudienceSegmentationService {
  /**
   * Create a new AudienceSegmentationService
   */
  constructor() {}

  /**
   * Segment customers matching the given filter criteria
   *
   * Applies AND logic: customers must match ALL specified filters
   * If filter property is not set, that criterion is ignored
   *
   * @param customers - Available customers for segmentation
   * @param filter - Filter criteria
   * @returns Customer IDs matching filter
   * @throws Error if filter is empty (no criteria)
   */
  segment(customers: CustomerSegmentData[], filter: AudienceFilter): string[] {
    if (!filter || Object.keys(filter).length === 0) {
      throw new Error('Audience filter must have at least one criterion');
    }

    return customers
      .filter((customer) => {
        // Check tier filter
        if (filter.tiers && filter.tiers.length > 0) {
          if (!filter.tiers.includes(customer.tier)) {
            return false;
          }
        }

        // Check tags filter
        if (filter.tags && filter.tags.length > 0) {
          const hasAllTags = filter.tags.every((tag) => customer.tags.includes(tag));
          if (!hasAllTags) {
            return false;
          }
        }

        // Check purchase history (days since last order)
        if (filter.minPurchaseHistoryDays !== undefined && customer.lastOrderDate !== null) {
          const daysSinceLastOrder = this.getDaysSince(customer.lastOrderDate);
          if (daysSinceLastOrder < filter.minPurchaseHistoryDays) {
            return false;
          }
        }

        // Check minimum total spent
        if (filter.minTotalSpent !== undefined && filter.minTotalSpent > 0) {
          if (customer.totalSpent < filter.minTotalSpent) {
            return false;
          }
        }

        // Check purchased categories
        if (filter.purchasedCategories && filter.purchasedCategories.length > 0) {
          const hasAllCategories = filter.purchasedCategories.every((category) =>
            customer.purchasedCategories.includes(category)
          );
          if (!hasAllCategories) {
            return false;
          }
        }

        return true;
      })
      .map((customer) => customer.customerId);
  }

  /**
   * Calculate days since a date
   * @param date - Date to calculate from
   * @returns Number of days elapsed
   * @internal
   */
  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays);
  }

  /**
   * Get summary statistics for a customer segment
   *
   * @param customers - Customers in segment
   * @returns Segment statistics
   */
  getSegmentStats(customers: CustomerSegmentData[]): {
    count: number;
    avgTotalSpent: number;
    avgTierValue: { [tier: string]: number };
    mostCommonTags: string[];
  } {
    if (customers.length === 0) {
      return {
        count: 0,
        avgTotalSpent: 0,
        avgTierValue: {},
        mostCommonTags: [],
      };
    }

    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgTotalSpent = totalSpent / customers.length;

    // Calculate average spent by tier
    const byTier: { [tier: string]: number[] } = {};
    customers.forEach((c) => {
      if (!byTier[c.tier]) {
        byTier[c.tier] = [];
      }
      byTier[c.tier].push(c.totalSpent);
    });

    const avgTierValue: { [tier: string]: number } = {};
    Object.entries(byTier).forEach(([tier, spents]) => {
      avgTierValue[tier] = spents.reduce((a, b) => a + b, 0) / spents.length;
    });

    // Find most common tags
    const tagCounts: { [tag: string]: number } = {};
    customers.forEach((c) => {
      c.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const mostCommonTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);

    return {
      count: customers.length,
      avgTotalSpent,
      avgTierValue,
      mostCommonTags,
    };
  }

  /**
   * Validate filter criteria
   * @param filter - Filter to validate
   * @throws Error if filter is invalid
   */
  validateFilter(filter: AudienceFilter): void {
    if (!filter || Object.keys(filter).length === 0) {
      throw new Error('Filter must have at least one criterion');
    }

    if (filter.minTotalSpent !== undefined && filter.minTotalSpent < 0) {
      throw new Error('minTotalSpent must be non-negative');
    }

    if (filter.minPurchaseHistoryDays !== undefined && filter.minPurchaseHistoryDays < 0) {
      throw new Error('minPurchaseHistoryDays must be non-negative');
    }

    if (filter.tiers && filter.tiers.length === 0) {
      throw new Error('If tiers filter is specified, must include at least one tier');
    }

    if (filter.tags && filter.tags.length === 0) {
      throw new Error('If tags filter is specified, must include at least one tag');
    }

    if (filter.purchasedCategories && filter.purchasedCategories.length === 0) {
      throw new Error('If purchasedCategories filter is specified, must include at least one category');
    }
  }
}
