/**
 * NotificationTemplate Repository Port (Interface)
 * Defines contract for template persistence layer
 *
 * @interface ITemplateRepository
 */
import { NotificationTemplate } from '../entities/NotificationTemplate';

/**
 * Port interface for notification template data persistence
 * Implementations provide actual database access
 */
export interface ITemplateRepository {
  /**
   * Save a new template
   *
   * @param template - Template entity to save
   * @returns Saved template
   */
  save(template: NotificationTemplate): Promise<NotificationTemplate>;

  /**
   * Update an existing template
   *
   * @param template - Updated template entity
   * @returns Updated template
   */
  update(template: NotificationTemplate): Promise<NotificationTemplate>;

  /**
   * Find template by ID
   *
   * @param id - Template ID
   * @returns Template or null if not found
   */
  findById(id: string): Promise<NotificationTemplate | null>;

  /**
   * Find template by slug (unique identifier)
   * Used for retrieving templates by name
   *
   * @param slug - Template slug
   * @param locale - Optional locale filter
   * @returns Template or null if not found
   */
  findBySlug(slug: string, locale?: string): Promise<NotificationTemplate | null>;

  /**
   * Find all active templates for a channel
   *
   * @param channel - Communication channel
   * @param locale - Optional locale filter
   * @returns Array of active templates
   */
  findByChannel(
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH',
    locale?: string
  ): Promise<NotificationTemplate[]>;

  /**
   * Find all templates
   * Optional filtering by active status and locale
   *
   * @param options - Filter options
   * @returns Array of templates
   */
  findAll(options?: {
    isActive?: boolean;
    locale?: string;
    channel?: string;
  }): Promise<NotificationTemplate[]>;

  /**
   * Find all active templates
   *
   * @returns Array of active templates
   */
  findActive(): Promise<NotificationTemplate[]>;

  /**
   * Delete a template
   *
   * @param id - Template ID
   * @returns Number of deleted records
   */
  delete(id: string): Promise<number>;

  /**
   * Check if template slug exists
   *
   * @param slug - Template slug
   * @param excludeId - Optional template ID to exclude from check
   * @returns True if slug exists
   */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;

  /**
   * Increment template usage count
   * Called when template is used to send a notification
   *
   * @param id - Template ID
   * @returns Updated template
   */
  incrementUsageCount(id: string): Promise<NotificationTemplate>;
}
