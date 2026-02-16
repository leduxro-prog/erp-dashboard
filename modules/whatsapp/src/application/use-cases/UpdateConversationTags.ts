/**
 * Update Conversation Tags Use-Case
 *
 * Updates the tags associated with a conversation.
 *
 * @module whatsapp/application/use-cases
 */

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { NotFoundError } from '@shared/errors';

/**
 * Update conversation tags request DTO.
 */
export interface UpdateConversationTagsRequest {
  /** Conversation ID */
  conversationId: string;
  /** Array of tag IDs to associate */
  tagIds: string[];
}

/**
 * Update conversation tags response DTO.
 */
export interface UpdateConversationTagsResponse {
  conversationId: string;
  tags: string[];
  updatedAt: string;
}

/**
 * Update Conversation Tags Use-Case.
 *
 * Application service for updating conversation tags.
 *
 * @class UpdateConversationTags
 */
export class UpdateConversationTags {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  /**
   * Execute use-case.
   *
   * @param request - Update tags request
   * @returns Promise resolving to update result
   * @throws {NotFoundError} If conversation not found
   */
  async execute(request: UpdateConversationTagsRequest): Promise<UpdateConversationTagsResponse> {
    const conversation = await this.conversationRepository.findById(request.conversationId);

    if (!conversation) {
      throw new NotFoundError('Conversation', request.conversationId);
    }

    // Clear existing tags and add new ones
    const entity = conversation as any;
    entity.tags = [];
    for (const tagId of request.tagIds) {
      conversation.addTag(tagId);
    }

    const saved = await this.conversationRepository.save(conversation);

    return {
      conversationId: saved.id,
      tags: saved.getTags(),
      updatedAt: saved.getUpdatedAt().toISOString(),
    };
  }
}
