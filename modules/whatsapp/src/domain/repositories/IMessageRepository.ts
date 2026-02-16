/**
 * Message Repository Interface
 *
 * Defines the contract for persistent storage of WhatsApp messages.
 * Implementations must handle database operations with full error handling.
 *
 * @module whatsapp/domain/repositories
 */

import { WhatsAppMessage, MessageStatus } from '../entities/WhatsAppMessage';

/**
 * Pagination parameters for queries.
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Paginated result set.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Message Repository Interface.
 *
 * Port interface for message persistence layer.
 * Implementations must be thread-safe and transactional.
 *
 * @interface IMessageRepository
 */
export interface IMessageRepository {
  /**
   * Save a message to persistent storage.
   * Creates if doesn't exist, updates if exists (upsert).
   *
   * @param message - Message entity to save
   * @returns Promise resolving to saved message
   * @throws {Error} On database errors
   */
  save(message: WhatsAppMessage): Promise<WhatsAppMessage>;

  /**
   * Retrieve a message by ID.
   *
   * @param id - Message ID
   * @returns Promise resolving to message or null if not found
   * @throws {Error} On database errors
   */
  findById(id: string): Promise<WhatsAppMessage | null>;

  /**
   * Find all messages in a conversation.
   * Results are ordered by creation date (newest last).
   *
   * @param conversationId - Conversation ID
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findByConversation(
    conversationId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppMessage>>;

  /**
   * Find messages by customer phone number.
   * Useful for finding conversations by phone.
   *
   * @param phone - Customer phone number
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findByPhone(
    phone: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppMessage>>;

  /**
   * Find pending messages that need to be sent.
   * Status must be PENDING or QUEUED.
   *
   * @param limit - Maximum number of messages to return
   * @returns Promise resolving to array of pending messages
   * @throws {Error} On database errors
   */
  findPending(limit: number): Promise<WhatsAppMessage[]>;

  /**
   * Update message status.
   * Atomically updates the status field.
   *
   * @param id - Message ID
   * @param status - New status
   * @returns Promise resolving when update completes
   * @throws {Error} If message not found or database error
   */
  updateStatus(id: string, status: MessageStatus): Promise<void>;

  /**
   * Count unread messages in a conversation.
   *
   * @param conversationId - Conversation ID
   * @returns Promise resolving to count
   * @throws {Error} On database errors
   */
  countUnread(conversationId: string): Promise<number>;

  /**
   * Delete a message (soft or hard delete).
   * Implementation may use soft delete with deleted_at field.
   *
   * @param id - Message ID
   * @returns Promise resolving when deletion completes
   * @throws {Error} On database errors
   */
  delete(id: string): Promise<void>;
}
