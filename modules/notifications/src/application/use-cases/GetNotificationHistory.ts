/**
 * Get Notification History Use Case
 * Retrieves paginated notification history for a customer
 *
 * Application service for data retrieval
 */
import { Logger } from 'winston';
import { INotificationRepository, PaginationOptions } from '../../domain/repositories/INotificationRepository';
import { NotificationHistoryDTO } from '../dtos/notification.dtos';

/**
 * Get notification history for a customer
 *
 * Provides cursor-based pagination for efficient history retrieval
 */
export class GetNotificationHistory {
  constructor(
    private notificationRepository: INotificationRepository,
    private logger: Logger
  ) {}

  /**
   * Execute the use case
   *
   * @param recipientId - Customer ID
   * @param page - Page number (default 1)
   * @param limit - Items per page (default 20, max 100)
   * @param cursor - Optional cursor for pagination
   * @returns Paginated history with DTOs
   */
  async execute(
    recipientId: string,
    page?: number,
    limit?: number,
    cursor?: string
  ): Promise<{
    data: NotificationHistoryDTO[];
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  }> {
    this.logger.debug('GetNotificationHistory use case started', {
      recipientId,
      page: page || 1,
      limit: limit || 20,
      hasCursor: !!cursor,
    });

    // Validate pagination params
    const pageNum = Math.max(1, page || 1);
    const pageSize = Math.min(100, Math.max(1, limit ?? 20));

    const options: PaginationOptions = {
      page: pageNum,
      limit: pageSize,
      cursor,
    };

    // Query repository
    const result = await this.notificationRepository.findByRecipient(
      recipientId,
      options
    );

    // Map to DTOs
    const dtos: NotificationHistoryDTO[] = result.data.map((notification) => ({
      id: notification.id,
      channel: notification.channel,
      subject: notification.subject,
      body: notification.body,
      status: notification.getStatus(),
      priority: notification.priority,
      sentAt: notification.toJSON().sentAt,
      deliveredAt: notification.toJSON().deliveredAt,
      failureReason: notification.toJSON().failureReason,
      createdAt: notification.createdAt,
    }));

    this.logger.debug('NotificationHistory retrieved', {
      recipientId,
      returnedCount: dtos.length,
      total: result.total,
      hasMore: result.hasMore,
    });

    return {
      data: dtos,
      total: result.total,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }
}
