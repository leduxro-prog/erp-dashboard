/**
 * Template Repository Interface
 *
 * Defines the contract for persistent storage of WhatsApp templates.
 *
 * @module whatsapp/domain/repositories
 */

import { WhatsAppTemplate, TemplateStatus } from '../entities/WhatsAppTemplate';
import { PaginationParams, PaginatedResult } from './IMessageRepository';

/**
 * Template Repository Interface.
 *
 * Port interface for template persistence layer.
 *
 * @interface ITemplateRepository
 */
export interface ITemplateRepository {
  /**
   * Save a template to persistent storage.
   * Creates if doesn't exist, updates if exists (upsert).
   *
   * @param template - Template entity to save
   * @returns Promise resolving to saved template
   * @throws {Error} On database errors
   */
  save(template: WhatsAppTemplate): Promise<WhatsAppTemplate>;

  /**
   * Retrieve a template by ID.
   *
   * @param id - Template ID
   * @returns Promise resolving to template or null if not found
   * @throws {Error} On database errors
   */
  findById(id: string): Promise<WhatsAppTemplate | null>;

  /**
   * Find template by name.
   * Names are unique within a language.
   *
   * @param name - Template name
   * @returns Promise resolving to template or null if not found
   * @throws {Error} On database errors
   */
  findByName(name: string): Promise<WhatsAppTemplate | null>;

  /**
   * Find all approved templates.
   * Only templates with status APPROVED.
   *
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findApproved(
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppTemplate>>;

  /**
   * Find all templates (regardless of status).
   *
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated results
   * @throws {Error} On database errors
   */
  findAll(
    pagination: PaginationParams
  ): Promise<PaginatedResult<WhatsAppTemplate>>;

  /**
   * Update template status.
   * Atomically updates the status and related timestamps.
   *
   * @param id - Template ID
   * @param status - New status
   * @param details - Additional details (e.g., rejection reason)
   * @returns Promise resolving when update completes
   * @throws {Error} If template not found or database error
   */
  updateStatus(
    id: string,
    status: TemplateStatus,
    details?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Find templates pending approval from Meta.
   *
   * @returns Promise resolving to array of pending templates
   * @throws {Error} On database errors
   */
  findPending(): Promise<WhatsAppTemplate[]>;

  /**
   * Delete a template (soft or hard delete).
   *
   * @param id - Template ID
   * @returns Promise resolving when deletion completes
   * @throws {Error} On database errors
   */
  delete(id: string): Promise<void>;
}
