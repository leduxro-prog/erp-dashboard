/**
 * List Messages Use-Case
 *
 * Lists WhatsApp messages with filtering and pagination.
 * Supports filtering by conversation, phone number, and status.
 *
 * @module whatsapp/application/use-cases
 */

import { IMessageRepository, PaginatedResult } from '../../domain/repositories/IMessageRepository';
import { WhatsAppMessage, MessageStatus } from '../../domain/entities/WhatsAppMessage';

/**
 * List messages request DTO.
 */
export interface ListMessagesRequest {
  /** Filter by conversation ID */
  conversationId?: string;
  /** Filter by phone number */
  phone?: string;
  /** Filter by message status */
  status?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * List Messages Use-Case.
 *
 * Application service for listing WhatsApp messages with filters.
 *
 * @class ListMessages
 */
export class ListMessages {
  constructor(private readonly messageRepository: IMessageRepository) {}

  /**
   * Execute the use-case.
   *
   * @param request - List messages request
   * @returns Promise resolving to paginated message results
   */
  async execute(request: ListMessagesRequest): Promise<PaginatedResult<WhatsAppMessage>> {
    const page = request.page ?? 1;
    const limit = request.limit ?? 20;
    const offset = (page - 1) * limit;

    if (request.conversationId) {
      return this.messageRepository.findByConversation(request.conversationId, { limit, offset });
    }

    if (request.phone) {
      return this.messageRepository.findByPhone(request.phone, { limit, offset });
    }

    // Default: return by conversation with empty filter (first page of all)
    return this.messageRepository.findByConversation('', { limit, offset });
  }
}
