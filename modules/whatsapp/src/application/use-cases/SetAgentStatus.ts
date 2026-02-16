/**
 * Set Agent Status Use-Case
 *
 * Updates the availability status of a support agent.
 *
 * @module whatsapp/application/use-cases
 */

import { IAgentRepository } from '../../domain/repositories/IAgentRepository';
import { NotFoundError } from '@shared/errors';

/**
 * Set agent status request DTO.
 */
export interface SetAgentStatusRequest {
  /** Agent ID */
  agentId: string;
  /** New status */
  status: 'online' | 'away' | 'offline';
}

/**
 * Set agent status response DTO.
 */
export interface SetAgentStatusResponse {
  agentId: string;
  status: 'online' | 'away' | 'offline';
  updatedAt: string;
}

/**
 * Set Agent Status Use-Case.
 *
 * Application service for updating agent availability status.
 *
 * @class SetAgentStatus
 */
export class SetAgentStatus {
  constructor(private readonly agentRepository: IAgentRepository) {}

  /**
   * Execute use-case.
   *
   * @param request - Set agent status request
   * @returns Promise resolving to status update result
   * @throws {NotFoundError} If agent not found
   */
  async execute(request: SetAgentStatusRequest): Promise<SetAgentStatusResponse> {
    const agent = await this.agentRepository.findByUserId(request.agentId);

    if (!agent) {
      throw new NotFoundError('Agent', request.agentId);
    }

    const updated = await this.agentRepository.updateStatus(
      request.agentId,
      request.status,
    );

    return {
      agentId: updated.id,
      status: updated.getStatus(),
      updatedAt: updated.getLastStatusUpdate().toISOString(),
    };
  }
}
