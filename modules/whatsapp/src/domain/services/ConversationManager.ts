/**
 * Conversation Manager Domain Service
 *
 * Manages conversation lifecycle: creation, assignment, escalation.
 * Tracks response SLA (Service Level Agreement).
 *
 * @module whatsapp/domain/services
 */

import { WhatsAppConversation } from '../entities/WhatsAppConversation';

/**
 * SLA configuration for conversations.
 */
export interface SLAConfig {
  /** Response time in minutes before escalation */
  responseTimeMinutes: number;
  /** Idle time in minutes before auto-closing */
  idleTimeMinutes: number;
}

/**
 * SLA status for a conversation.
 */
export enum SLAStatus {
  /** Within SLA */
  OK = 'OK',
  /** SLA approaching (80% of time used) */
  WARNING = 'WARNING',
  /** SLA exceeded */
  BREACHED = 'BREACHED',
}

/**
 * Conversation Manager Service.
 *
 * Domain service for managing conversation lifecycle and SLA tracking.
 *
 * @class ConversationManager
 */
export class ConversationManager {
  /** Default SLA configuration */
  private static readonly DEFAULT_SLA: SLAConfig = {
    responseTimeMinutes: 120, // 2 hours
    idleTimeMinutes: 1440, // 24 hours
  };

  /**
   * Constructor.
   *
   * @param slaConfig - SLA configuration (uses defaults if not provided)
   */
  constructor(
    private slaConfig: SLAConfig = ConversationManager.DEFAULT_SLA
  ) {}

  /**
   * Check SLA status of a conversation.
   * Determines if response is within SLA, approaching, or breached.
   *
   * @param conversation - The conversation to check
   * @returns SLA status
   */
  checkSLAStatus(conversation: WhatsAppConversation): SLAStatus {
    if (!conversation.getLastMessageAt()) {
      // No messages yet, check creation time
      const creationTime = conversation.createdAt;
      const ageMinutes =
        (Date.now() - creationTime.getTime()) / (1000 * 60);

      if (ageMinutes > this.slaConfig.responseTimeMinutes) {
        return SLAStatus.BREACHED;
      }
      if (
        ageMinutes >
        this.slaConfig.responseTimeMinutes * 0.8
      ) {
        return SLAStatus.WARNING;
      }
      return SLAStatus.OK;
    }

    const lastMessageTime = conversation.getLastMessageAt()!;
    const ageMinutes =
      (Date.now() - lastMessageTime.getTime()) / (1000 * 60);

    if (ageMinutes > this.slaConfig.responseTimeMinutes) {
      return SLAStatus.BREACHED;
    }
    if (ageMinutes > this.slaConfig.responseTimeMinutes * 0.8) {
      return SLAStatus.WARNING;
    }
    return SLAStatus.OK;
  }

  /**
   * Get minutes until SLA breach.
   * Returns negative value if already breached.
   *
   * @param conversation - The conversation to check
   * @returns Minutes until breach
   */
  getMinutesUntilBreach(conversation: WhatsAppConversation): number {
    const lastMessageTime = conversation.getLastMessageAt() || conversation.createdAt;
    const ageMinutes =
      (Date.now() - lastMessageTime.getTime()) / (1000 * 60);
    return this.slaConfig.responseTimeMinutes - ageMinutes;
  }

  /**
   * Check if conversation should be auto-closed due to inactivity.
   *
   * @param conversation - The conversation to check
   * @returns True if conversation is idle beyond threshold
   */
  shouldAutoClose(conversation: WhatsAppConversation): boolean {
    const lastMessageTime = conversation.getLastMessageAt() || conversation.createdAt;
    const ageMinutes =
      (Date.now() - lastMessageTime.getTime()) / (1000 * 60);
    return ageMinutes > this.slaConfig.idleTimeMinutes;
  }

  /**
   * Calculate escalation priority based on conversation state.
   * Higher priority for older unresponded conversations.
   *
   * @param conversation - The conversation to evaluate
   * @returns Priority score (higher = more urgent)
   */
  calculateEscalationPriority(conversation: WhatsAppConversation): number {
    const slaStatus = this.checkSLAStatus(conversation);
    const minutesUntilBreach = this.getMinutesUntilBreach(conversation);

    // Base priority from conversation priority
    let priority = 0;
    switch (conversation.getPriority()) {
      case 'HIGH':
        priority = 30;
        break;
      case 'NORMAL':
        priority = 20;
        break;
      case 'LOW':
        priority = 10;
        break;
    }

    // Add time-based priority
    if (slaStatus === SLAStatus.BREACHED) {
      priority += 100;
    } else if (slaStatus === SLAStatus.WARNING) {
      priority += 50;
    }

    // Add factor for unread messages
    priority += conversation.getUnreadCount() * 5;

    return priority;
  }

  /**
   * Suggest an available support agent for assignment.
   * Uses a simple round-robin with consideration for current load.
   *
   * @param availableAgentIds - List of available agent IDs
   * @param agentWorkloads - Map of agent ID to current workload (conversation count)
   * @returns Suggested agent ID
   */
  suggestAgent(
    availableAgentIds: string[],
    agentWorkloads: Map<string, number>
  ): string | undefined {
    if (availableAgentIds.length === 0) {
      return undefined;
    }

    // Find agent with least conversations
    let leastBusyAgent = availableAgentIds[0];
    let leastBusyCount = agentWorkloads.get(leastBusyAgent) || 0;

    for (const agentId of availableAgentIds) {
      const workload = agentWorkloads.get(agentId) || 0;
      if (workload < leastBusyCount) {
        leastBusyAgent = agentId;
        leastBusyCount = workload;
      }
    }

    return leastBusyAgent;
  }
}
