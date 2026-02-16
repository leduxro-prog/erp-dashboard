/**
 * Tag Repository Interface
 *
 * Defines the contract for persistent storage of WhatsApp tags.
 *
 * @module whatsapp/domain/repositories
 */

import { WhatsAppTag } from '../entities/WhatsAppTag';

/**
 * Tag Repository Interface.
 *
 * Port interface for tag persistence layer.
 *
 * @interface ITagRepository
 */
export interface ITagRepository {
  /**
   * Save a tag to persistent storage.
   *
   * @param tag - Tag entity to save
   * @returns Promise resolving to saved tag
   * @throws {Error} On database errors
   */
  save(tag: WhatsAppTag): Promise<WhatsAppTag>;

  /**
   * Retrieve all tags.
   *
   * @returns Promise resolving to array of tags
   * @throws {Error} On database errors
   */
  findAll(): Promise<WhatsAppTag[]>;

  /**
   * Find a tag by ID.
   *
   * @param id - Tag ID
   * @returns Promise resolving to tag or null if not found
   * @throws {Error} On database errors
   */
  findById(id: string): Promise<WhatsAppTag | null>;

  /**
   * Delete a tag.
   *
   * @param id - Tag ID
   * @returns Promise resolving when deletion completes
   * @throws {Error} On database errors
   */
  delete(id: string): Promise<void>;
}
