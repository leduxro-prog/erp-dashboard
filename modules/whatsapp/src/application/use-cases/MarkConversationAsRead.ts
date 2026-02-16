/**
 * Mark Conversation As Read Use-Case
 *
 * Marks all unread messages in a conversation as read.
 * Updates the unread count to zero.
 *
 * @module whatsapp/application/use-cases
 */

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { NotFoundError } from '@shared/errors';

/**
 * Mark conversation as read request DTO.
 */
export interface MarkConversationAsReadRequest {
  /** Conversation ID */
  conversationId: string;
}

/**
 * Mark conversation as read response DTO.
 */
export interface MarkConversationAsReadResponse {
  conversationId: string;
  markedAt: Date;
  previousUnreadCount: number;
}

/**
 * Mark Conversation As Read Use-Case.
 *
 * Application service for marking a conversation's messages as read.
 *
 * @class MarkConversationAsRead
 */
export class MarkConversationAsRead {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  /**
   * Execute use-case.
   *
   * @param request - Mark as read request
   * @returns Promise resolving to mark result
   * @throws {NotFoundError} If conversation not found
   */
  async execute(request: MarkConversationAsReadRequest): Promise<MarkConversationAsReadResponse> {
    const conversation = await this.conversationRepository.findById(request.conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation', request.conversationId);
    }

    // Get previous unread count for response
    const previousUnreadCount = conversation.getUnreadCount();

    // Use domain entity's markRead method
    conversation.markRead();

    const saved = await this.conversationRepository.save(conversation);

    return {
      conversationId: saved.id,
      markedAt: new Date(),
      previousUnreadCount,
    };
  }
}
