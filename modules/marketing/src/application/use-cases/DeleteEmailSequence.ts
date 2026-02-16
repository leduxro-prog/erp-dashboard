/**
 * Delete Email Sequence Use-Case
 *
 * Deletes an email sequence.
 *
 * @module marketing/application/use-cases
 */

import { NotFoundError } from '@shared/errors';

export interface DeleteEmailSequenceRequest {
  sequenceId: string;
}

export interface DeleteEmailSequenceResponse {
  sequenceId: string;
  deletedAt: string;
}

/**
 * Delete Email Sequence Use-Case.
 *
 * Application service for deleting email sequences.
 *
 * @class DeleteEmailSequence
 */
export class DeleteEmailSequence {
  constructor(private readonly sequenceRepository: any) {}

  async execute(request: DeleteEmailSequenceRequest): Promise<DeleteEmailSequenceResponse> {
    const { sequenceId } = request;

    const sequence = await this.sequenceRepository.findOne({
      where: { id: sequenceId },
    });

    if (!sequence) {
      throw new NotFoundError('EmailSequence', sequenceId);
    }

    await this.sequenceRepository.delete({ id: sequenceId });

    return {
      sequenceId,
      deletedAt: new Date().toISOString(),
    };
  }
}
