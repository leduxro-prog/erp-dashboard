/**
 * List Conversations Use-Case
 *
 * Lists WhatsApp conversations with filtering and pagination.
 * Supports filtering by status, assigned user, and search query.
 *
 * @module whatsapp/application/use-cases
 */

import {
  IConversationRepository,
  ConversationFilter,
} from '../../domain/repositories/IConversationRepository';
import { PaginatedResult } from '../../domain/repositories/IMessageRepository';
import {
  WhatsAppConversation,
  ConversationStatus,
} from '../../domain/entities/WhatsAppConversation';

/**
 * List conversations request DTO.
 */
export interface ListConversationsRequest {
  /** Filter by conversation status */
  status?: string;
  /** Filter by assigned user ID */
  assignedTo?: string;
  /** Search by customer name or phone */
  search?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * List Conversations Use-Case.
 *
 * Application service for listing WhatsApp conversations with filters.
 *
 * @class ListConversations
 */
export class ListConversations {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  /**
   * Execute the use-case.
   *
   * @param request - List conversations request
   * @returns Promise resolving to paginated conversation results
   */
  async execute(request: ListConversationsRequest): Promise<PaginatedResult<WhatsAppConversation>> {
    const page = request.page ?? 1;
    const limit = request.limit ?? 20;
    const offset = (page - 1) * limit;

    // If search is provided, use the search method
    if (request.search) {
      return this.conversationRepository.search(request.search, { limit, offset });
    }

    // If assignedTo is provided, use findAssigned
    if (request.assignedTo) {
      return this.conversationRepository.findAssigned(request.assignedTo, { limit, offset });
    }

    // Build filter for findAll
    const filter: ConversationFilter = {};
    if (request.status) {
      filter.status = request.status as ConversationStatus;
    }

    return this.conversationRepository.findAll(filter, { limit, offset });
  }
}
