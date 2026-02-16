/**
 * Notification Repository Port (Interface)
 * Defines contract for notification persistence layer
 *
 * @interface INotificationRepository
 */
import { Notification } from '../entities/Notification';

export interface PaginationOptions {
  page: number;
  limit: number;
  cursor?: string;
}

export interface NotificationQueryResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Port interface for notification data persistence
 * Implementations provide actual database access
 */
export interface INotificationRepository {
  /**
   * Save a new notification
   *
   * @param notification - Notification entity to save
   * @returns Saved notification
   */
  save(notification: Notification): Promise<Notification>;

  /**
   * Update an existing notification
   *
   * @param notification - Updated notification entity
   * @returns Updated notification
   */
  update(notification: Notification): Promise<Notification>;

  /**
   * Find notification by ID
   *
   * @param id - Notification ID
   * @returns Notification or null if not found
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Find notifications for a recipient with pagination
   *
   * @param recipientId - Recipient identifier
   * @param options - Pagination options (page, limit, cursor)
   * @returns Paginated list of notifications
   */
  findByRecipient(
    recipientId: string,
    options: PaginationOptions
  ): Promise<NotificationQueryResult<Notification>>;

  /**
   * Find all pending notifications ready to send
   * Checks: status=PENDING, scheduledAt is in the past or null
   *
   * @param limit - Max notifications to retrieve
   * @returns Array of pending notifications
   */
  findPending(limit?: number): Promise<Notification[]>;

  /**
   * Find all failed notifications eligible for retry
   * Checks: status=FAILED, retryCount < MAX_RETRIES
   *
   * @param limit - Max notifications to retrieve
   * @returns Array of failed notifications
   */
  findFailed(limit?: number): Promise<Notification[]>;

  /**
   * Update notification status
   *
   * @param id - Notification ID
   * @param status - New status
   * @returns Updated notification
   */
  updateStatus(
    id: string,
    status: 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED'
  ): Promise<Notification>;

  /**
   * Count notifications by status
   *
   * @param status - Status to count
   * @returns Number of notifications with that status
   */
  countByStatus(status: string): Promise<number>;

  /**
   * Delete notifications older than specified date
   * Used for cleanup of old records
   *
   * @param beforeDate - Delete notifications created before this date
   * @returns Number of deleted records
   */
  deleteOlderThan(beforeDate: Date): Promise<number>;

  /**
   * Find notifications by status for date range
   * Used for statistics and reporting
   *
   * @param status - Status filter
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns Array of matching notifications
   */
  findByStatusAndDateRange(
    status: string,
    startDate: Date,
    endDate: Date
  ): Promise<Notification[]>;

  /**
   * Count notifications by channel
   *
   * @returns Object mapping channels to counts
   */
  countByChannel(): Promise<Record<string, number>>;
}
