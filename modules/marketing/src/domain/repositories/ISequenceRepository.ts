/**
 * EmailSequence Repository Interface
 * Port for email sequence data persistence
 *
 * @module Domain/Repositories
 */

import { EmailSequence } from '../entities/EmailSequence';

/**
 * ISequenceRepository
 * Port interface for email sequence persistence operations
 */
export interface ISequenceRepository {
  /**
   * Save an email sequence (create or update)
   * @param sequence - Email sequence entity to save
   * @returns Saved email sequence
   */
  save(sequence: EmailSequence): Promise<EmailSequence>;

  /**
   * Find email sequence by ID
   * @param id - Sequence ID
   * @returns Email sequence or null if not found
   */
  findById(id: string): Promise<EmailSequence | null>;

  /**
   * Find all sequences for a campaign
   * @param campaignId - Campaign ID
   * @returns Sequences for campaign
   */
  findByCampaign(campaignId: string): Promise<EmailSequence[]>;

  /**
   * Find sequences by trigger event
   * @param triggerEvent - Trigger event type
   * @returns Sequences with specified trigger
   */
  findByTrigger(triggerEvent: string): Promise<EmailSequence[]>;

  /**
   * Find all active sequences
   * @returns Active email sequences
   */
  findActive(): Promise<EmailSequence[]>;

  /**
   * Find all sequences with pagination and filters
   * @param filter - Filter options
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated sequences
   */
  findWithFilter(
    filter: { status?: string; campaignId?: string; triggerEvent?: string },
    page: number,
    limit: number
  ): Promise<{ items: EmailSequence[]; total: number; page: number; pages: number }>;

  /**
   * Delete an email sequence
   * @param id - Sequence ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count sequences matching filter
   * @param filter - Filter criteria
   * @returns Count of matching sequences
   */
  count(filter: { status?: string; campaignId?: string; triggerEvent?: string }): Promise<number>;

  /**
   * Get total enrolled count for a sequence
   * @param sequenceId - Sequence ID
   * @returns Number of customers enrolled
   */
  getEnrolledCount(sequenceId: string): Promise<number>;

  /**
   * Get total completed count for a sequence
   * @param sequenceId - Sequence ID
   * @returns Number of customers who completed sequence
   */
  getCompletedCount(sequenceId: string): Promise<number>;

  /**
   * Check if customer is enrolled in sequence
   * @param sequenceId - Sequence ID
   * @param customerId - Customer ID
   * @returns True if enrolled
   */
  isCustomerEnrolled(sequenceId: string, customerId: string): Promise<boolean>;
}
