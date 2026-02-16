/**
 * Conversation Repository Interface
 *
 * Defines the contract for persistent storage of WhatsApp conversations.
 *
 * @module whatsapp/domain/repositories
 */

import { WhatsAppConversation, ConversationStatus } from '../entities/WhatsAppConversation';
import { PaginationParams, PaginatedResult } from './IMessageRepository';

/**
 * Conversation filter options.
 */
export interface ConversationFilter {
  status?: ConversationStatus;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  assignedToUserId?: string;
  customerId?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Conversation Repository Interface.
 *
 * Port interface for conversation persistence layer.
 *
 * @interface IConversationRepository
 */
export interface IConversationRepository {
  /**
   * Save a conversation to persistent storage.
   * Creates if doesn't exist, updates if exists (upsert).
   *
   * @param conversation - Conversation entity to save
   * @returns Promise resolving to saved conversation
   * @throws {Error} On database errors
   */
  save(conversation: WhatsAppConversation): Promise<WhatsAppConversation>;

  /**
   * Retrieve a conversation by ID.
   *
   * @param id - Conversation ID
   * @returns Promise resolving to conversation or null if not found
   * @throws {Error} On database errors
   */
  findById(id: string): Promise<WhatsAppConversation | null>;

  /**
   * Find conversation by customer phone number.
   * Returns the most recent conversation if multiple exist.
   *
   * @param phone - Customer phone number
   * @returns Promise resolving to conversation or null if not found
   * @throws {Error} On database errors
   */
  findByPhone(phone: string): Promise<WhatsAppConversation | null>;

  /**
   * Find all open conversations.
   * Returns conversations with status OPEN or ASSIGNED.
   *
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findOpen(
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>>;

  /**
   * Find conversations assigned to a specific user.
   *
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findAssigned(
    userId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>>;

  /**
   * Find all conversations matching filters.
   *
   * @param filter - Filter criteria
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findAll(
    filter: ConversationFilter,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>>;

  /**
   * Search conversations by customer name or phone.
   *
   * @param query - Search query (name or phone substring)
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  search(
    query: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppConversation>>;

  /**
   * Find conversations resolved before a specific date.
   * Useful for automated archiving.
   *
   * @param beforeDate - Date threshold
   * @param limit - Maximum number to return
   * @returns Promise resolving to array of conversations
   * @throws {Error} On database errors
   */
  findResolvedBefore(
    beforeDate: Date,
    limit: number
  ): Promise<WhatsAppConversation[]>;

  /**
   * Delete a conversation (soft or hard delete).
   *
   * @param id - Conversation ID
   * @returns Promise resolving when deletion completes
   * @throws {Error} On database errors
   */
  delete(id: string): Promise<void>;
}
