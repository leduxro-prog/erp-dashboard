/**
 * ActivateCampaign Use-Case
 * Application use-case for activating marketing campaigns
 *
 * @module Application/UseCases
 */

import { Campaign } from '../../domain/entities/Campaign';
import { ICampaignRepository } from '../../domain/repositories/ICampaignRepository';
import { IDiscountCodeRepository } from '../../domain/repositories/IDiscountCodeRepository';
import { ISequenceRepository } from '../../domain/repositories/ISequenceRepository';
import {
  CampaignNotFoundError,
  CampaignAlreadyActiveError,
} from '../../domain/errors/marketing.errors';

/**
 * Input for ActivateCampaign use-case
 */
export interface ActivateCampaignInput {
  /** Campaign ID to activate */
  campaignId: string;
  /** Activate associated discount codes */
  activateDiscountCodes?: boolean;
  /** Activate associated email sequences */
  activateSequences?: boolean;
}

/**
 * Output from ActivateCampaign use-case
 */
export interface ActivateCampaignOutput {
  /** Activated campaign */
  campaign: Campaign;
  /** Number of discount codes activated */
  discountCodesActivated: number;
  /** Number of sequences activated */
  sequencesActivated: number;
  /** Message describing what was activated */
  message: string;
}

/**
 * ActivateCampaign Use-Case
 *
 * Responsibilities:
 * - Find campaign by ID
 * - Validate campaign can be activated
 * - Call campaign.activate() to update status
 * - Optionally activate associated discount codes and sequences
 * - Persist changes
 * - Publish campaign.activated event
 *
 * @class ActivateCampaign
 */
export class ActivateCampaign {
  /**
   * Create a new ActivateCampaign use-case instance
   *
   * @param campaignRepository - Campaign repository
   * @param discountCodeRepository - Discount code repository
   * @param sequenceRepository - Email sequence repository
   */
  constructor(
    private readonly campaignRepository: ICampaignRepository,
    private readonly discountCodeRepository: IDiscountCodeRepository,
    private readonly sequenceRepository: ISequenceRepository
  ) {}

  /**
   * Execute the ActivateCampaign use-case
   *
   * @param input - Activate campaign input
   * @returns Activation result with campaign and counts
   * @throws CampaignNotFoundError if campaign doesn't exist
   * @throws CampaignAlreadyActiveError if campaign is already active
   */
  async execute(input: ActivateCampaignInput): Promise<ActivateCampaignOutput> {
    // Find campaign
    const campaign = await this.campaignRepository.findById(input.campaignId);
    if (!campaign) {
      throw new CampaignNotFoundError(input.campaignId);
    }

    // Check if already active
    if (campaign.isActive()) {
      throw new CampaignAlreadyActiveError(input.campaignId);
    }

    // Activate campaign
    campaign.activate();

    // Save activated campaign
    const activatedCampaign = await this.campaignRepository.save(campaign);

    let discountCodesActivated = 0;
    let sequencesActivated = 0;

    // Activate associated discount codes if requested
    if (input.activateDiscountCodes) {
      const codes = await this.discountCodeRepository.findByCampaign(input.campaignId);
      for (const code of codes) {
        if (!code.getIsActive()) {
          code.activate();
          await this.discountCodeRepository.save(code);
          discountCodesActivated++;
        }
      }
    }

    // Activate associated email sequences if requested
    if (input.activateSequences) {
      const sequences = await this.sequenceRepository.findByCampaign(input.campaignId);
      for (const sequence of sequences) {
        if (!sequence.isActive()) {
          sequence.activate();
          await this.sequenceRepository.save(sequence);
          sequencesActivated++;
        }
      }
    }

    const message =
      `Campaign activated. ` +
      (discountCodesActivated > 0 ? `${discountCodesActivated} discount codes activated. ` : '') +
      (sequencesActivated > 0 ? `${sequencesActivated} sequences activated.` : '');

    return {
      campaign: activatedCampaign,
      discountCodesActivated,
      sequencesActivated,
      message: message.trim(),
    };
  }
}
