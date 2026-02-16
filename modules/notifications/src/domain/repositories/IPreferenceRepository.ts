/**
 * NotificationPreference Repository Port (Interface)
 * Defines contract for preference persistence layer
 *
 * @interface IPreferenceRepository
 */
import { NotificationPreference } from '../entities/NotificationPreference';

/**
 * Port interface for notification preference data persistence
 * Implementations provide actual database access
 */
export interface IPreferenceRepository {
  /**
   * Save a new preference
   *
   * @param preference - Preference entity to save
   * @returns Saved preference
   */
  save(preference: NotificationPreference): Promise<NotificationPreference>;

  /**
   * Update an existing preference
   *
   * @param preference - Updated preference entity
   * @returns Updated preference
   */
  update(preference: NotificationPreference): Promise<NotificationPreference>;

  /**
   * Find preference by ID
   *
   * @param id - Preference ID
   * @returns Preference or null if not found
   */
  findById(id: string): Promise<NotificationPreference | null>;

  /**
   * Find all preferences for a customer
   *
   * @param customerId - Customer identifier
   * @returns Array of preferences for the customer
   */
  findByCustomerId(customerId: string): Promise<NotificationPreference[]>;

  /**
   * Find preference for specific customer and channel
   *
   * @param customerId - Customer identifier
   * @param channel - Notification channel
   * @returns Preference or null if not found
   */
  findByCustomerAndChannel(
    customerId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH'
  ): Promise<NotificationPreference | null>;

  /**
   * Save or update preference (upsert)
   * Creates if doesn't exist, updates if exists
   *
   * @param preference - Preference to save/update
   * @returns Saved/updated preference
   */
  upsert(preference: NotificationPreference): Promise<NotificationPreference>;

  /**
   * Delete a preference
   *
   * @param id - Preference ID
   * @returns Number of deleted records
   */
  delete(id: string): Promise<number>;

  /**
   * Find all enabled preferences for a channel
   * Used for sending notifications
   *
   * @param channel - Notification channel
   * @returns Array of enabled preferences
   */
  findEnabledByChannel(
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH'
  ): Promise<NotificationPreference[]>;

  /**
   * Count preferences by channel
   *
   * @returns Object mapping channels to count of enabled preferences
   */
  countEnabledByChannel(): Promise<Record<string, number>>;
}
