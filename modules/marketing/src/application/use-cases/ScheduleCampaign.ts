/**
 * ScheduleCampaign Use-Case
 * Application use-case for scheduling a campaign for future execution
 *
 * @module Application/UseCases
 */

import { v4 as uuidv4 } from 'uuid';

import { ICampaignRepository } from '../../domain/repositories/ICampaignRepository';
import { ICampaignStepRepository } from '../../domain/repositories/ICampaignStepRepository';
import { ICampaignAuditLogRepository } from '../../domain/repositories/ICampaignAuditLogRepository';
import { CampaignAuditEntry } from '../../domain/entities/CampaignAuditEntry';
import { Campaign } from '../../domain/entities/Campaign';
import { CampaignNotFoundError } from '../../domain/errors/marketing.errors';

/**
 * Input for ScheduleCampaign use-case
 */
export interface ScheduleCampaignInput {
  /** Campaign ID to schedule */
  campaignId: string;
  /** Scheduled execution date/time */
  scheduledAt: Date;
  /** Timezone for scheduling */
  timezone?: string;
  /** User performing the scheduling action */
  actorId: string;
}

/**
 * ScheduleCampaign Use-Case
 *
 * Responsibilities:
 * - Validate campaign exists and is in DRAFT status
 * - Validate scheduled date is in the future
 * - Verify campaign has at least one step
 * - Activate the campaign
 * - Record audit entry for the scheduling action
 *
 * @class ScheduleCampaign
 */
export class ScheduleCampaign {
  /**
   * Create a new ScheduleCampaign use-case instance
   *
   * @param campaignRepo - Campaign repository
   * @param stepRepo - Campaign step repository
   * @param auditRepo - Campaign audit log repository
   */
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly stepRepo: ICampaignStepRepository,
    private readonly auditRepo: ICampaignAuditLogRepository,
  ) {}

  /**
   * Execute the ScheduleCampaign use-case
   *
   * @param input - Schedule campaign input
   * @returns Activated campaign
   * @throws CampaignNotFoundError if campaign does not exist
   * @throws Error if campaign is not in DRAFT status
   * @throws Error if scheduledAt is not in the future
   * @throws Error if campaign has no steps
   */
  async execute(input: ScheduleCampaignInput): Promise<Campaign> {
    // Find campaign
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new CampaignNotFoundError(input.campaignId);
    }

    // Validate campaign is DRAFT
    const status = campaign.getStatus();
    if (status !== 'DRAFT') {
      throw new Error(`Cannot schedule campaign with status ${status}. Must be DRAFT.`);
    }

    // Validate scheduledAt is in the future
    const now = new Date();
    if (input.scheduledAt <= now) {
      throw new Error('Scheduled date must be in the future');
    }

    // Verify campaign has at least one step
    const stepCount = await this.stepRepo.count(input.campaignId);
    if (stepCount === 0) {
      throw new Error('Campaign must have at least one step before scheduling');
    }

    // Activate the campaign
    campaign.activate();

    // Save campaign
    const savedCampaign = await this.campaignRepo.save(campaign);

    // Create audit entry
    const auditEntry = CampaignAuditEntry.create({
      id: uuidv4(),
      campaignId: input.campaignId,
      action: 'CAMPAIGN_SCHEDULED',
      actorId: input.actorId,
      previousState: { status: 'DRAFT' },
      newState: {
        status: savedCampaign.getStatus(),
        scheduledAt: input.scheduledAt.toISOString(),
        timezone: input.timezone ?? null,
      },
      details: {
        scheduledAt: input.scheduledAt.toISOString(),
        timezone: input.timezone ?? 'UTC',
        stepCount,
      },
    });
    await this.auditRepo.save(auditEntry);

    return savedCampaign;
  }
}
