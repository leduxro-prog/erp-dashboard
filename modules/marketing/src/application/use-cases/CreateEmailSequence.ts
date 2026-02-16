/**
 * Create Email Sequence Use-Case
 *
 * Creates a new automated email sequence for a campaign.
 *
 * @module marketing/application/use-cases
 */

import { EmailSequence, SequenceTriggerEvent } from '../../domain/entities/EmailSequence';
import { EmailSequenceStep, StepCondition } from '../../domain/entities/EmailSequenceStep';
import { NotFoundError } from '@shared/errors';

/**
 * Create email sequence request DTO.
 */
export interface CreateEmailSequenceRequest {
  /** Campaign ID */
  campaignId: string;
  /** Sequence name */
  name: string;
  /** Event that triggers enrollment */
  triggerEvent: SequenceTriggerEvent;
  /** Initial sequence steps */
  steps?: Array<{
    order: number;
    delayDays: number;
    delayHours: number;
    templateId: string;
    subject?: string;
    body: string;
    condition?: string;
  }>;
}

/**
 * Create email sequence response DTO.
 */
export interface CreateEmailSequenceResponse {
  sequenceId: string;
  name: string;
  status: string;
  stepCount: number;
  createdAt: string;
}

/**
 * Create Email Sequence Use-Case.
 *
 * Application service for creating automated email sequences.
 *
 * @class CreateEmailSequence
 */
export class CreateEmailSequence {
  constructor(private readonly sequenceRepository: any) {}

  /**
   * Execute use-case.
   *
   * @param request - Create email sequence request
   * @returns Promise resolving to created sequence
   * @throws {Error} On validation errors
   */
  async execute(request: CreateEmailSequenceRequest): Promise<CreateEmailSequenceResponse> {
    const { campaignId, name, triggerEvent, steps } = request;

    // Validate request
    if (!campaignId || !name || !triggerEvent) {
      throw new Error('Missing required fields: campaignId, name, triggerEvent');
    }

    // Create sequence ID
    const sequenceId = crypto.randomUUID();

    // Create sequence
    const sequence = new EmailSequence(
      sequenceId,
      campaignId,
      name,
      triggerEvent,
      steps?.map(
        (s, index) =>
          new EmailSequenceStep(
            crypto.randomUUID(),
            sequenceId,
            index,
            s.delayDays || 0,
            s.delayHours || 0,
            s.templateId,
            s.subject || '',
            s.body,
            (s.condition || 'ALWAYS') as StepCondition,
            0,
            0,
            0,
          ),
      ) || [],
      'DRAFT',
      0,
      0,
      new Date(),
    );

    await this.sequenceRepository.save(sequence);

    return {
      sequenceId,
      name,
      status: 'DRAFT',
      stepCount: steps?.length || 0,
      createdAt: new Date().toISOString(),
    };
  }
}
