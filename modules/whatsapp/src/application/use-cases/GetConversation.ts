/**
 * Get Conversation Use-Case
 *
 * Retrieves a single conversation with its recent messages.
 *
 * @module whatsapp/application/use-cases
 */

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { IMessageRepository } from '../../domain/repositories/IMessageRepository';
import { WhatsAppConversation } from '../../domain/entities/WhatsAppConversation';
import { WhatsAppMessage } from '../../domain/entities/WhatsAppMessage';
import { NotFoundError } from '@shared/errors';

/**
 * Get conversation request DTO.
 */
export interface GetConversationRequest {
  /** Conversation ID */
  conversationId: string;
}

/**
 * Get conversation response DTO.
 */
export interface GetConversationResponse {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  totalMessages: number;
}

/**
 * Get Conversation Use-Case.
 *
 * Application service for retrieving a conversation with its messages.
 *
 * @class GetConversation
 */
export class GetConversation {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
  ) {}

  /**
   * Execute the use-case.
   *
   * @param request - Get conversation request
   * @returns Promise resolving to conversation with messages
   * @throws {NotFoundError} If conversation not found
   */
  async execute(request: GetConversationRequest): Promise<GetConversationResponse> {
    const conversation = await this.conversationRepository.findById(request.conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation', request.conversationId);
    }

    const messagesResult = await this.messageRepository.findByConversation(request.conversationId, {
      limit: 50,
      offset: 0,
    });

    return {
      conversation,
      messages: messagesResult.items,
      totalMessages: messagesResult.total,
    };
  }
}
