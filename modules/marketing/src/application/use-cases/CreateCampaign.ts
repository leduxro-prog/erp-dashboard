/**
 * CreateCampaign Use-Case
 * Application use-case for creating new marketing campaigns
 *
 * @module Application/UseCases
 */

import { Campaign, CampaignType, AudienceFilter } from '../../domain/entities/Campaign';
import { ICampaignRepository } from '../../domain/repositories/ICampaignRepository';
import { InvalidCampaignDateRangeError, InvalidAudienceFilterError } from '../../domain/errors/marketing.errors';
import { AudienceSegmentationService } from '../../domain/services/AudienceSegmentationService';

/**
 * Input for CreateCampaign use-case
 */
export interface CreateCampaignInput {
  /** Campaign name */
  name: string;
  /** Campaign type */
  type: CampaignType;
  /** Campaign description */
  description: string;
  /** Audience filter criteria */
  targetAudience: AudienceFilter;
  /** Campaign start date */
  startDate: Date;
  /** Campaign end date */
  endDate: Date;
  /** Campaign budget (optional) */
  budget?: number;
  /** User creating the campaign */
  createdBy: string;
}

/**
 * Output from CreateCampaign use-case
 */
export interface CreateCampaignOutput {
  /** Created campaign */
  campaign: Campaign;
  /** Estimated audience size */
  estimatedAudienceSize: number;
}

/**
 * CreateCampaign Use-Case
 *
 * Responsibilities:
 * - Validate campaign input (dates, budget, audience)
 * - Create campaign entity with DRAFT status
 * - Persist campaign to repository
 * - Return created campaign with metadata
 *
 * @class CreateCampaign
 */
export class CreateCampaign {
  /**
   * Create a new CreateCampaign use-case instance
   *
   * @param campaignRepository - Campaign repository
   * @param audienceSegmentationService - Audience segmentation service
   */
  constructor(
    private readonly campaignRepository: ICampaignRepository,
    private readonly audienceSegmentationService: AudienceSegmentationService
  ) {}

  /**
   * Execute the CreateCampaign use-case
   *
   * @param input - Create campaign input
   * @returns Created campaign with metadata
   * @throws InvalidCampaignDateRangeError if dates are invalid
   * @throws InvalidAudienceFilterError if audience filter is invalid
   */
  async execute(input: CreateCampaignInput): Promise<CreateCampaignOutput> {
    // Validate dates
    this.validateDates(input.startDate, input.endDate);

    // Validate audience filter
    try {
      this.audienceSegmentationService.validateFilter(input.targetAudience);
    } catch (error) {
      throw new InvalidAudienceFilterError(
        error instanceof Error ? error.message : 'Invalid audience filter'
      );
    }

    // Validate budget
    if (input.budget !== undefined && input.budget <= 0) {
      throw new InvalidCampaignDateRangeError('Budget must be greater than 0');
    }

    // Create campaign entity
    const campaignId = this.generateId();
    const now = new Date();

    const campaign = new Campaign(
      campaignId,
      input.name,
      input.type,
      'DRAFT',
      input.description,
      input.targetAudience,
      input.startDate,
      input.endDate,
      input.budget ?? null,
      0,
      {
        sent: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
        revenue: 0,
      },
      input.createdBy,
      now,
      now
    );

    // Persist campaign
    const savedCampaign = await this.campaignRepository.save(campaign);

    return {
      campaign: savedCampaign,
      estimatedAudienceSize: 0, // Would be populated by actual customer data in real scenario
    };
  }

  /**
   * Validate campaign date range
   * @internal
   */
  private validateDates(startDate: Date, endDate: Date): void {
    const now = new Date();

    if (startDate < now) {
      throw new InvalidCampaignDateRangeError('Start date must be in the future');
    }

    if (endDate <= startDate) {
      throw new InvalidCampaignDateRangeError('End date must be after start date');
    }

    const minDuration = 1000 * 60 * 60; // 1 hour
    if (endDate.getTime() - startDate.getTime() < minDuration) {
      throw new InvalidCampaignDateRangeError('Campaign must run for at least 1 hour');
    }
  }

  /**
   * Generate unique campaign ID
   * @internal
   */
  private generateId(): string {
    return `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
