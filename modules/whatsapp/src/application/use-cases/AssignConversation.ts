/**
 * Assign Conversation Use-Case
 *
 * Assigns a conversation to a support agent.
 *
 * @module whatsapp/application/use-cases
 */

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { WhatsAppConversation } from '../../domain/entities/WhatsAppConversation';
import { NotFoundError } from '@shared/errors';

/**
 * Assign conversation request DTO.
 */
export interface AssignConversationRequest {
  /** Conversation ID */
  conversationId: string;
  /** User ID to assign to */
  userId: string;
  /** Optional notes about the assignment */
  notes?: string;
}

/**
 * Assign conversation response DTO.
 */
export interface AssignConversationResponse {
  conversation: WhatsAppConversation;
  assignedAt: Date;
}

/**
 * Assign Conversation Use-Case.
 *
 * Application service for assigning a conversation to an agent.
 *
 * @class AssignConversation
 */
export class AssignConversation {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  /**
   * Execute the use-case.
   *
   * @param request - Assign conversation request
   * @returns Promise resolving to assignment result
   * @throws {NotFoundError} If conversation not found
   * @throws {Error} If conversation is resolved or archived
   */
  async execute(request: AssignConversationRequest): Promise<AssignConversationResponse> {
    const conversation = await this.conversationRepository.findById(request.conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation', request.conversationId);
    }

    conversation.assign(request.userId);
    const saved = await this.conversationRepository.save(conversation);

    return {
      conversation: saved,
      assignedAt: new Date(),
    };
  }
}
