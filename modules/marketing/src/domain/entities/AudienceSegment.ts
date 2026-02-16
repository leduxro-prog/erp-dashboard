/**
 * AudienceSegment Domain Entity
 * Represents a persistent, reusable audience segment definition.
 *
 * @module Domain/Entities
 */

export interface SegmentFilterCriteria {
  tiers?: string[];
  tags?: string[];
  minPurchaseHistoryDays?: number;
  minTotalSpent?: number;
  maxTotalSpent?: number;
  purchasedCategories?: string[];
  excludedCategories?: string[];
  regions?: string[];
  ageRange?: { min?: number; max?: number };
  registeredAfter?: Date;
  registeredBefore?: Date;
  lastOrderAfter?: Date;
  lastOrderBefore?: Date;
  hasEmail?: boolean;
  hasPhone?: boolean;
  consentedChannels?: string[];
}

export class AudienceSegment {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly description: string | null,
    readonly filterCriteria: SegmentFilterCriteria,
    private estimatedSize: number,
    private lastComputedAt: Date | null,
    readonly isDynamic: boolean,
    private cachedCustomerIds: string[],
    readonly createdBy: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  getEstimatedSize(): number {
    return this.estimatedSize;
  }

  getLastComputedAt(): Date | null {
    return this.lastComputedAt;
  }

  getCachedCustomerIds(): string[] {
    return [...this.cachedCustomerIds];
  }

  updateEstimate(size: number, customerIds: string[]): void {
    this.estimatedSize = size;
    this.cachedCustomerIds = customerIds;
    this.lastComputedAt = new Date();
  }

  isStale(maxAgeHours: number = 24): boolean {
    if (!this.lastComputedAt) return true;
    const ageMs = Date.now() - this.lastComputedAt.getTime();
    return ageMs > maxAgeHours * 60 * 60 * 1000;
  }

  hasFilters(): boolean {
    const c = this.filterCriteria;
    return !!(
      c.tiers?.length ||
      c.tags?.length ||
      c.purchasedCategories?.length ||
      c.regions?.length ||
      c.minTotalSpent ||
      c.maxTotalSpent ||
      c.registeredAfter ||
      c.lastOrderAfter ||
      c.consentedChannels?.length
    );
  }
}
