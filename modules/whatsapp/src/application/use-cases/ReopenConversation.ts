/**
 * Reopen Conversation Use-Case
 *
 * Reopens a resolved or archived conversation.
 * Used when a customer sends a new message or issue wasn't resolved.
 *
 * @module whatsapp/application/use-cases
 */

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { NotFoundError } from '@shared/errors';

/**
 * Reopen conversation request DTO.
 */
export interface ReopenConversationRequest {
  /** Conversation ID */
  conversationId: string;
}

/**
 * Reopen conversation response DTO.
 */
export interface ReopenConversationResponse {
  conversationId: string;
  reopenedAt: Date;
  status: 'OPEN';
}

/**
 * Reopen Conversation Use-Case.
 *
 * Application service for reopening a resolved or archived conversation.
 *
 * @class ReopenConversation
 */
export class ReopenConversation {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  /**
   * Execute use-case.
   *
   * @param request - Reopen conversation request
   * @returns Promise resolving to reopen result
   * @throws {NotFoundError} If conversation not found
   */
  async execute(request: ReopenConversationRequest): Promise<ReopenConversationResponse> {
    const conversation = await this.conversationRepository.findById(request.conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation', request.conversationId);
    }

    // Use domain entity's reopen method (idempotent if already open)
    conversation.reopen();

    const saved = await this.conversationRepository.save(conversation);

    return {
      conversationId: saved.id,
      reopenedAt: new Date(),
      status: 'OPEN',
    };
  }
}
