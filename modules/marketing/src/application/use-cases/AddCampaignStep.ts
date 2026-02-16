/**
 * AddCampaignStep Use-Case
 * Application use-case for adding a step to a campaign journey
 *
 * @module Application/UseCases
 */

import { v4 as uuidv4 } from 'uuid';

import { ICampaignRepository } from '../../domain/repositories/ICampaignRepository';
import { ICampaignStepRepository } from '../../domain/repositories/ICampaignStepRepository';
import { ICampaignAuditLogRepository } from '../../domain/repositories/ICampaignAuditLogRepository';
import { CampaignStep, StepType, CampaignChannel } from '../../domain/entities/CampaignStep';
import { CampaignAuditEntry } from '../../domain/entities/CampaignAuditEntry';
import { CampaignNotFoundError } from '../../domain/errors/marketing.errors';

/**
 * Input for AddCampaignStep use-case
 */
export interface AddCampaignStepInput {
  /** Campaign ID to add step to */
  campaignId: string;
  /** Type of step */
  stepType: StepType;
  /** Step name */
  name: string;
  /** Step description */
  description?: string;
  /** Channel for send steps */
  channel?: CampaignChannel;
  /** Template ID for send steps */
  templateId?: string;
  /** Template data for send steps */
  templateData?: Record<string, unknown>;
  /** Delay in minutes before executing step */
  delayMinutes?: number;
  /** Condition rules for condition steps */
  conditionRules?: Record<string, unknown>;
  /** Split configuration for split steps */
  splitConfig?: Record<string, unknown>;
  /** Webhook URL for webhook steps */
  webhookUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AddCampaignStep Use-Case
 *
 * Responsibilities:
 * - Validate campaign exists and is in DRAFT or SCHEDULED status
 * - Determine next step order in the campaign
 * - Create and persist the campaign step
 * - Record audit entry for the step addition
 *
 * @class AddCampaignStep
 */
export class AddCampaignStep {
  /**
   * Create a new AddCampaignStep use-case instance
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
   * Execute the AddCampaignStep use-case
   *
   * @param input - Add campaign step input
   * @returns Saved campaign step
   * @throws CampaignNotFoundError if campaign does not exist
   * @throws Error if campaign is not in DRAFT or SCHEDULED status
   */
  async execute(input: AddCampaignStepInput): Promise<CampaignStep> {
    // Validate campaign exists
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new CampaignNotFoundError(input.campaignId);
    }

    // Validate campaign is in an editable status
    const status = campaign.getStatus();
    if (status !== 'DRAFT' && status !== 'SCHEDULED') {
      throw new Error(
        `Cannot add steps to campaign with status ${status}. Must be DRAFT or SCHEDULED.`,
      );
    }

    // Get next step order
    const nextOrder = await this.stepRepo.getNextStepOrder(input.campaignId);

    // Create campaign step domain entity
    const now = new Date();
    const step = new CampaignStep(
      uuidv4(),
      input.campaignId,
      nextOrder,
      input.stepType,
      'PENDING',
      input.name,
      input.description ?? null,
      input.channel ?? null,
      input.templateId ?? null,
      input.templateData ?? {},
      input.delayMinutes ?? 0,
      input.conditionRules ?? null,
      input.splitConfig ?? null,
      input.webhookUrl ?? null,
      0, // retryCount
      3, // maxRetries
      null, // startedAt
      null, // completedAt
      input.metadata ?? {},
      now,
      now,
    );

    // Persist step
    const savedStep = await this.stepRepo.save(step);

    // Create audit entry
    const auditEntry = CampaignAuditEntry.create({
      id: uuidv4(),
      campaignId: input.campaignId,
      action: 'STEP_ADDED',
      actorId: campaign.createdBy,
      newState: {
        stepId: savedStep.id,
        stepType: input.stepType,
        stepOrder: nextOrder,
        name: input.name,
      },
      details: {
        stepType: input.stepType,
        channel: input.channel ?? null,
      },
    });
    await this.auditRepo.save(auditEntry);

    return savedStep;
  }
}
