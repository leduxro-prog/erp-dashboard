/**
 * Agent Repository Interface
 *
 * Defines the contract for persistent storage of WhatsApp agents.
 *
 * @module whatsapp/domain/repositories
 */

import { WhatsAppAgent, AgentStatus } from '../entities/WhatsAppAgent';
import { PaginatedResult } from './IMessageRepository';

/**
 * Agent filter options.
 */
export interface AgentFilter {
  status?: AgentStatus;
  search?: string;
}

/**
 * Agent Repository Interface.
 *
 * Port interface for agent persistence layer.
 *
 * @interface IAgentRepository
 */
export interface IAgentRepository {
  /**
   * Find an agent by user ID.
   *
   * @param userId - User ID (same as agent ID)
   * @returns Promise resolving to agent or null if not found
   * @throws {Error} On database errors
   */
  findByUserId(userId: string): Promise<WhatsAppAgent | null>;

  /**
   * Find all agents with optional filtering.
   *
   * @param filter - Optional filter criteria
   * @returns Promise resolving to array of agents
   * @throws {Error} On database errors
   */
  findAll(filter?: AgentFilter): Promise<WhatsAppAgent[]>;

  /**
   * Update agent status.
   *
   * @param agentId - Agent ID
   * @param status - New status
   * @returns Promise resolving to updated agent
   * @throws {Error} On database errors
   */
  updateStatus(agentId: string, status: AgentStatus): Promise<WhatsAppAgent>;

  /**
   * Update conversation counts for an agent.
   *
   * @param agentId - Agent ID
   * @param deltaActive - Change in active conversations
   * @param deltaAssigned - Change in assigned conversations
   * @returns Promise resolving when update completes
   * @throws {Error} On database errors
   */
  updateCounts(
    agentId: string,
    deltaActive: number,
    deltaAssigned: number,
  ): Promise<void>;

  /**
   * Get agent availability summary.
   *
   * @returns Promise resolving to availability stats
   * @throws {Error} On database errors
   */
  getAvailabilityStats(): Promise<{
    online: number;
    away: number;
    offline: number;
  }>;
}
