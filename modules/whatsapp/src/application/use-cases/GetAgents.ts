/**
 * Get Agents Use-Case
 *
 * Retrieves all support agents with their current status and workload.
 *
 * @module whatsapp/application/use-cases
 */

import { IAgentRepository } from '../../domain/repositories/IAgentRepository';

/**
 * Get agents request DTO.
 */
export interface GetAgentsRequest {
  /** Optional filter by status */
  status?: 'online' | 'away' | 'offline';
  /** Optional search by name */
  search?: string;
}

/**
 * Get agents response DTO.
 */
export interface GetAgentsResponse {
  agents: Array<{
    id: string;
    name: string;
    email?: string;
    status: 'online' | 'away' | 'offline';
    activeConversations: number;
    assignedConversations: number;
    avatar?: string;
    lastStatusUpdate: string;
  }>;
  stats: {
    online: number;
    away: number;
    offline: number;
  };
}

/**
 * Get Agents Use-Case.
 *
 * Application service for retrieving all support agents.
 *
 * @class GetAgents
 */
export class GetAgents {
  constructor(private readonly agentRepository: IAgentRepository) {}

  /**
   * Execute use-case.
   *
   * @param request - Get agents request
   * @returns Promise resolving to agents list with stats
   */
  async execute(request: GetAgentsRequest = {}): Promise<GetAgentsResponse> {
    const filter: any = {};
    if (request.status) {
      filter.status = request.status;
    }
    if (request.search) {
      filter.search = request.search;
    }

    const agents = await this.agentRepository.findAll(filter);
    const stats = await this.agentRepository.getAvailabilityStats();

    return {
      agents: agents.map((agent) => agent.toJSON()),
      stats,
    };
  }
}
