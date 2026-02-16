/**
 * Resolve Conversation Use-Case
 *
 * Resolves a conversation, marking it as handled.
 *
 * @module whatsapp/application/use-cases
 */

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { WhatsAppConversation } from '../../domain/entities/WhatsAppConversation';
import { NotFoundError } from '@shared/errors';

/**
 * Resolve conversation request DTO.
 */
export interface ResolveConversationRequest {
  /** Conversation ID */
  conversationId: string;
  /** Optional resolution notes */
  resolutionNotes?: string;
}

/**
 * Resolve conversation response DTO.
 */
export interface ResolveConversationResponse {
  conversation: WhatsAppConversation;
  resolvedAt: Date;
}

/**
 * Resolve Conversation Use-Case.
 *
 * Application service for resolving a conversation.
 *
 * @class ResolveConversation
 */
export class ResolveConversation {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  /**
   * Execute the use-case.
   *
   * @param request - Resolve conversation request
   * @returns Promise resolving to resolution result
   * @throws {NotFoundError} If conversation not found
   * @throws {Error} If conversation is archived
   */
  async execute(request: ResolveConversationRequest): Promise<ResolveConversationResponse> {
    const conversation = await this.conversationRepository.findById(request.conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation', request.conversationId);
    }

    conversation.resolve();
    const saved = await this.conversationRepository.save(conversation);

    return {
      conversation: saved,
      resolvedAt: new Date(),
    };
  }
}
