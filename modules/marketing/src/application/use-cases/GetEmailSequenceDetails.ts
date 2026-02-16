/**
 * Get Email Sequence Details Use-Case
 *
 * Retrieves details of a specific email sequence including steps.
 *
 * @module marketing/application/use-cases
 */

import { NotFoundError } from '@shared/errors';

export interface GetEmailSequenceResponse {
  id: string;
  name: string;
  campaignId: string;
  triggerEvent: string;
  status: string;
  enrolledCount: number;
  completedCount: number;
  completionRate: number;
  steps: Array<{
    id: string;
    order: number;
    delayDays: number;
    delayHours: number;
    templateId: string;
    subject: string;
    body: string;
    condition: string;
    sentCount: number;
    openedCount: number;
    clickedCount: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get Email Sequence Details Use-Case.
 *
 * Application service for retrieving email sequence details.
 *
 * @class GetEmailSequenceDetails
 */
export class GetEmailSequenceDetails {
  constructor(private readonly sequenceRepository: any) {}

  async execute(sequenceId: string): Promise<GetEmailSequenceResponse> {
    const sequence: any = await this.sequenceRepository.findOne({
      where: { id: sequenceId },
      relations: ['steps'],
    });

    if (!sequence) {
      throw new NotFoundError('EmailSequence', sequenceId);
    }

    const completionRate = sequence.enrolledCount > 0
      ? (sequence.completedCount / sequence.enrolledCount) * 100
      : 0;

    return {
      id: sequence.id,
      name: sequence.name,
      campaignId: sequence.campaignId,
      triggerEvent: sequence.triggerEvent,
      status: sequence.status,
      enrolledCount: sequence.enrolledCount || 0,
      completedCount: sequence.completedCount || 0,
      completionRate,
      steps: sequence.steps?.map((step: any) => ({
        id: step.id,
        order: step.order,
        delayDays: step.delayDays || 0,
        delayHours: step.delayHours || 0,
        templateId: step.templateId,
        subject: step.subject || '',
        body: step.body,
        condition: step.condition || 'ALWAYS',
        sentCount: step.sentCount || 0,
        openedCount: step.openedCount || 0,
        clickedCount: step.clickedCount || 0,
      })) || [],
      createdAt: sequence.createdAt?.toISOString(),
      updatedAt: sequence.updatedAt?.toISOString(),
    };
  }
}
