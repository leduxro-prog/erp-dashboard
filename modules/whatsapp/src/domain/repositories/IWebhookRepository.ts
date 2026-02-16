/**
 * Webhook Repository Interface
 *
 * Defines the contract for persistent storage of webhook events.
 * Ensures idempotent processing through deduplication.
 *
 * @module whatsapp/domain/repositories
 */

import { WhatsAppWebhookEvent } from '../entities/WhatsAppWebhookEvent';
import { PaginationParams, PaginatedResult } from './IMessageRepository';

/**
 * Webhook Repository Interface.
 *
 * Port interface for webhook event persistence layer.
 *
 * @interface IWebhookRepository
 */
export interface IWebhookRepository {
  /**
   * Save a webhook event to persistent storage.
   * Creates if doesn't exist, updates if exists (upsert).
   *
   * @param event - Webhook event entity to save
   * @returns Promise resolving to saved event
   * @throws {Error} On database errors
   */
  save(event: WhatsAppWebhookEvent): Promise<WhatsAppWebhookEvent>;

  /**
   * Retrieve a webhook event by ID.
   *
   * @param id - Event ID
   * @returns Promise resolving to event or null if not found
   * @throws {Error} On database errors
   */
  findById(id: string): Promise<WhatsAppWebhookEvent | null>;

  /**
   * Check if a webhook event has already been processed.
   * Uses idempotency key for deduplication (Meta's message_id).
   *
   * This is critical for preventing duplicate message processing
   * when webhooks are retried by Meta.
   *
   * @param idempotencyKey - Unique key from Meta API
   * @returns Promise resolving to existing event or null
   * @throws {Error} On database errors
   */
  findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<WhatsAppWebhookEvent | null>;

  /**
   * Mark a webhook event as successfully processed.
   *
   * @param id - Event ID
   * @returns Promise resolving when update completes
   * @throws {Error} If event not found or database error
   */
  markProcessed(id: string): Promise<void>;

  /**
   * Mark a webhook event as failed.
   *
   * @param id - Event ID
   * @param error - Error message
   * @returns Promise resolving when update completes
   * @throws {Error} If event not found or database error
   */
  markFailed(id: string, error: string): Promise<void>;

  /**
   * Find pending (unprocessed) webhook events.
   *
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findPending(
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppWebhookEvent>>;

  /**
   * Delete a webhook event (soft or hard delete).
   * Typically only after processing is complete and logged.
   *
   * @param id - Event ID
   * @returns Promise resolving when deletion completes
   * @throws {Error} On database errors
   */
  delete(id: string): Promise<void>;
}
