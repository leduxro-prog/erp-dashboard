/**
 * Update Email Sequence Use-Case
 *
 * Updates an existing email sequence.
 *
 * @module marketing/application/use-cases
 */

import { NotFoundError } from '@shared/errors';

export interface UpdateEmailSequenceRequest {
  sequenceId: string;
  name?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  steps?: Array<{
    id: string;
    order: number;
    delayDays: number;
    delayHours: number;
    condition?: string;
  }>;
}

export interface UpdateEmailSequenceResponse {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

/**
 * Update Email Sequence Use-Case.
 *
 * Application service for updating email sequences.
 *
 * @class UpdateEmailSequence
 */
export class UpdateEmailSequence {
  constructor(private readonly sequenceRepository: any) {}

  async execute(request: UpdateEmailSequenceRequest): Promise<UpdateEmailSequenceResponse> {
    const { sequenceId, name, status, steps } = request;

    const sequence: any = await this.sequenceRepository.findOne({
      where: { id: sequenceId },
      relations: ['steps'],
    });

    if (!sequence) {
      throw new NotFoundError('EmailSequence', sequenceId);
    }

    if (name) sequence.name = name;
    if (status) {
      if (status === 'ACTIVE') sequence.activate();
      else if (status === 'PAUSED') sequence.pause();
      else sequence.status = status;
    }

    if (steps) {
      for (const stepUpdate of steps) {
        const stepIndex = sequence.steps.findIndex((s: any) => s.id === stepUpdate.id);
        if (stepIndex >= 0) {
          const step = sequence.steps[stepIndex];
          if (stepUpdate.order !== undefined) step.order = stepUpdate.order;
          if (stepUpdate.delayDays !== undefined || stepUpdate.delayHours !== undefined) {
            step.setDelay(stepUpdate.delayDays || 0, stepUpdate.delayHours || 0);
          }
          if (stepUpdate.condition) {
            sequence.steps[stepIndex] = {
              ...step,
              condition: stepUpdate.condition,
            } as any;
          }
        }
      }
    }

    sequence.updatedAt = new Date();
    await this.sequenceRepository.save(sequence);

    return {
      id: sequence.id,
      name: sequence.name,
      status: sequence.status,
      updatedAt: new Date().toISOString(),
    };
  }
}
