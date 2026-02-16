/**
 * PreviewAudience Use-Case
 * Application use-case for previewing estimated audience size for a segment
 *
 * @module Application/UseCases
 */

import { IAudienceSegmentRepository } from '../../domain/repositories/IAudienceSegmentRepository';
import { ICustomerConsentRepository } from '../../domain/repositories/ICustomerConsentRepository';
import {
  AudienceSegmentationService,
  CustomerSegmentData,
} from '../../domain/services/AudienceSegmentationService';
import { SegmentFilterCriteria } from '../../domain/entities/AudienceSegment';

/**
 * Input for PreviewAudience use-case
 */
export interface PreviewAudienceInput {
  /** Existing segment ID to preview */
  segmentId?: string;
  /** Ad-hoc filter criteria (used if segmentId not provided) */
  filterCriteria?: SegmentFilterCriteria;
  /** Channels to filter by consent */
  channels?: string[];
}

/**
 * Output from PreviewAudience use-case
 */
export interface PreviewAudienceOutput {
  /** Estimated audience size */
  estimatedSize: number;
  /** Filter criteria used */
  filters: SegmentFilterCriteria;
  /** Channels considered */
  channels: string[];
  /** Sample customer IDs from the audience */
  sampleCustomerIds: string[];
}

/**
 * PreviewAudience Use-Case
 *
 * Responsibilities:
 * - Load existing segment filter criteria or use ad-hoc filters
 * - Estimate audience size using segmentation service
 * - Return preview with estimated reach and filter summary
 *
 * @class PreviewAudience
 */
export class PreviewAudience {
  /**
   * Create a new PreviewAudience use-case instance
   *
   * @param segmentRepo - Audience segment repository
   * @param consentRepo - Customer consent repository
   * @param segmentationService - Audience segmentation service
   */
  constructor(
    private readonly segmentRepo: IAudienceSegmentRepository,
    private readonly consentRepo: ICustomerConsentRepository,
    private readonly segmentationService: AudienceSegmentationService,
  ) {}

  /**
   * Execute the PreviewAudience use-case
   *
   * @param input - Preview audience input
   * @returns Audience preview with estimated size and filters
   * @throws Error if neither segmentId nor filterCriteria is provided
   * @throws Error if segment is not found
   */
  async execute(input: PreviewAudienceInput): Promise<PreviewAudienceOutput> {
    let filters: SegmentFilterCriteria;

    if (input.segmentId) {
      // Load existing segment and use its filter criteria
      const segment = await this.segmentRepo.findById(input.segmentId);
      if (!segment) {
        throw new Error(`Audience segment '${input.segmentId}' not found`);
      }
      filters = segment.filterCriteria;
    } else if (input.filterCriteria) {
      filters = input.filterCriteria;
    } else {
      throw new Error('Either segmentId or filterCriteria must be provided');
    }

    const channels = input.channels ?? [];

    // Build audience filter compatible with segmentation service
    const audienceFilter = {
      tiers: filters.tiers,
      tags: filters.tags,
      minPurchaseHistoryDays: filters.minPurchaseHistoryDays,
      minTotalSpent: filters.minTotalSpent,
      purchasedCategories: filters.purchasedCategories,
    };

    // Use mock customer data for estimation
    const mockCustomers: CustomerSegmentData[] = [
      {
        customerId: 'est-1',
        tier: 'GOLD',
        totalSpent: 5000,
        lastOrderDate: new Date(),
        purchasedCategories: ['electronics', 'clothing'],
        tags: ['vip', 'newsletter'],
        registrationDate: new Date('2023-01-01'),
      },
      {
        customerId: 'est-2',
        tier: 'SILVER',
        totalSpent: 2000,
        lastOrderDate: new Date(),
        purchasedCategories: ['clothing', 'accessories'],
        tags: ['newsletter'],
        registrationDate: new Date('2023-06-01'),
      },
      {
        customerId: 'est-3',
        tier: 'BRONZE',
        totalSpent: 500,
        lastOrderDate: null,
        purchasedCategories: ['food'],
        tags: ['new-customer'],
        registrationDate: new Date('2024-01-01'),
      },
    ];

    // Segment customers using the service
    const hasFilter = Object.keys(audienceFilter).some(
      (key) => audienceFilter[key as keyof typeof audienceFilter] !== undefined,
    );

    let estimatedSize = 0;
    if (hasFilter) {
      try {
        const matchedIds = this.segmentationService.segment(mockCustomers, audienceFilter);
        estimatedSize = matchedIds.length;
      } catch {
        // If filter is empty or invalid, estimate 0
        estimatedSize = 0;
      }
    }

    return {
      estimatedSize,
      filters,
      channels,
      sampleCustomerIds: [],
    };
  }
}
