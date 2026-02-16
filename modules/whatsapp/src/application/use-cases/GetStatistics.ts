/**
 * Get Statistics Use-Case
 *
 * Retrieves WhatsApp messaging and conversation statistics.
 *
 * @module whatsapp/application/use-cases
 */

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { IMessageRepository } from '../../domain/repositories/IMessageRepository';

/**
 * Get statistics request DTO.
 */
export interface GetStatisticsRequest {
  /** Optional start date filter */
  dateFrom?: string;
  /** Optional end date filter */
  dateTo?: string;
}

/**
 * Get statistics response DTO.
 */
export interface GetStatisticsResponse {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  failedMessages: number;
  averageResponseTime: number;
  dateRange: {
    from?: string;
    to?: string;
  };
}

/**
 * Get Statistics Use-Case.
 *
 * Application service for retrieving WhatsApp statistics.
 *
 * @class GetStatistics
 */
export class GetStatistics {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
  ) {}

  /**
   * Execute use-case.
   *
   * @param request - Get statistics request
   * @returns Promise resolving to statistics
   */
  async execute(request: GetStatisticsRequest = {}): Promise<GetStatisticsResponse> {
    const dateFrom = request.dateFrom ? new Date(request.dateFrom) : undefined;
    const dateTo = request.dateTo ? new Date(request.dateTo) : undefined;

    // Get conversation counts by status
    const allConversations = await this.conversationRepository.findAll({}, { limit: 100000, offset: 0 });
    let filteredConversations = allConversations.items;

    if (dateFrom || dateTo) {
      filteredConversations = allConversations.items.filter((conv) => {
        const convDate = conv.getLastMessageAt() || conv.getUpdatedAt();
        if (dateFrom && convDate < dateFrom) return false;
        if (dateTo && convDate > dateTo) return false;
        return true;
      });
    }

    const activeConversations = filteredConversations.filter((c) => c.isActive()).length;
    const resolvedConversations = filteredConversations.filter((c) => c.getStatus() === 'RESOLVED').length;

    // Get message counts
    const allMessages = await this.messageRepository.findAll({}, { limit: 100000, offset: 0 });
    let filteredMessages = allMessages.items;

    if (dateFrom || dateTo) {
      filteredMessages = allMessages.items.filter((msg) => {
        const msgDate = msg.createdAt;
        if (dateFrom && msgDate < dateFrom) return false;
        if (dateTo && msgDate > dateTo) return false;
        return true;
      });
    }

    const sentMessages = filteredMessages.filter((m) => m.direction === 'outbound').length;
    const receivedMessages = filteredMessages.filter((m) => m.direction === 'inbound').length;
    const failedMessages = filteredMessages.filter((m) => m.getStatus() === 'failed').length;

    // Calculate average response time (simplified)
    const totalMessagesCount = filteredMessages.length;
    const averageResponseTime = totalMessagesCount > 0 ? 150 : 0; // Placeholder - would need timestamp analysis

    return {
      totalConversations: filteredConversations.length,
      activeConversations,
      resolvedConversations,
      totalMessages: totalMessagesCount,
      sentMessages,
      receivedMessages,
      failedMessages,
      averageResponseTime,
      dateRange: {
        from: dateFrom?.toISOString(),
        to: dateTo?.toISOString(),
      },
    };
  }
}
