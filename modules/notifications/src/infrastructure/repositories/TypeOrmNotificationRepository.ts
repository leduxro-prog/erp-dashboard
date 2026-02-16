/**
 * TypeORM Notification Repository
 * Implements INotificationRepository using TypeORM
 */
import { DataSource, Repository, LessThan, Between } from 'typeorm';
import { Logger } from 'winston';
import { Notification } from '../../domain/entities/Notification';
import { INotificationRepository, PaginationOptions, NotificationQueryResult } from '../../domain/repositories/INotificationRepository';
import { NotificationEntity } from '../entities/NotificationEntity';
import { NotificationMapper } from '../mappers/NotificationMapper';

/**
 * TypeORM implementation of INotificationRepository
 * Provides database access for notifications with caching support
 */
export class TypeOrmNotificationRepository implements INotificationRepository {
  private repository: Repository<NotificationEntity>;
  private logger: Logger;

  constructor(
    dataSource: DataSource,
    logger: Logger
  ) {
    this.repository = dataSource.getRepository(NotificationEntity);
    this.logger = logger;
  }

  async save(notification: Notification): Promise<Notification> {
    try {
      const entity = NotificationMapper.toPersistence(notification);
      const saved = await this.repository.save(entity);
      return NotificationMapper.toDomain(saved);
    } catch (error) {
      this.logger.error('Error saving notification', {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async update(notification: Notification): Promise<Notification> {
    try {
      const entity = NotificationMapper.toPersistence(notification);
      await this.repository.save(entity);
      return notification;
    } catch (error) {
      this.logger.error('Error updating notification', {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<Notification | null> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      return entity ? NotificationMapper.toDomain(entity) : null;
    } catch (error) {
      this.logger.error('Error finding notification by ID', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByRecipient(
    recipientId: string,
    options: PaginationOptions
  ): Promise<NotificationQueryResult<Notification>> {
    try {
      const skip = (options.page - 1) * options.limit;

      const [entities, total] = await this.repository.findAndCount({
        where: { recipientId },
        order: { createdAt: 'DESC' },
        skip,
        take: options.limit + 1, // Get one extra to determine if more exist
      });

      const hasMore = entities.length > options.limit;
      const data = entities
        .slice(0, options.limit)
        .map((e) => NotificationMapper.toDomain(e));

      return {
        data,
        total,
        hasMore,
        nextCursor: hasMore ? String(options.page + 1) : undefined,
      };
    } catch (error) {
      this.logger.error('Error finding notifications by recipient', {
        recipientId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findPending(limit: number = 100): Promise<Notification[]> {
    try {
      const entities = await this.repository.find({
        where: {
          status: 'PENDING',
        },
        order: { scheduledAt: 'ASC', createdAt: 'ASC' },
        take: limit,
      });

      return entities.map((e) => NotificationMapper.toDomain(e));
    } catch (error) {
      this.logger.error('Error finding pending notifications', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findFailed(limit: number = 100): Promise<Notification[]> {
    try {
      const entities = await this.repository.find({
        where: {
          status: 'FAILED',
        },
        order: { createdAt: 'ASC' },
        take: limit,
      });

      return entities
        .filter((e) => {
          const notification = NotificationMapper.toDomain(e);
          return notification.canRetry();
        })
        .map((e) => NotificationMapper.toDomain(e));
    } catch (error) {
      this.logger.error('Error finding failed notifications', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED'
  ): Promise<Notification> {
    try {
      await this.repository.update({ id }, { status, updatedAt: new Date() });
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) throw new Error(`Notification ${id} not found after update`);
      return NotificationMapper.toDomain(entity);
    } catch (error) {
      this.logger.error('Error updating notification status', {
        id,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async countByStatus(status: string): Promise<number> {
    try {
      return await this.repository.count({ where: { status } });
    } catch (error) {
      this.logger.error('Error counting notifications by status', {
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async deleteOlderThan(beforeDate: Date): Promise<number> {
    try {
      const result = await this.repository.delete({
        createdAt: LessThan(beforeDate),
      });
      return result.affected || 0;
    } catch (error) {
      this.logger.error('Error deleting old notifications', {
        beforeDate,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByStatusAndDateRange(
    status: string,
    startDate: Date,
    endDate: Date
  ): Promise<Notification[]> {
    try {
      const entities = await this.repository.find({
        where: {
          status,
          createdAt: Between(startDate, endDate),
        },
      });

      return entities.map((e) => NotificationMapper.toDomain(e));
    } catch (error) {
      this.logger.error('Error finding notifications by status and date range', {
        status,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async countByChannel(): Promise<Record<string, number>> {
    try {
      const result = await this.repository.query(`
        SELECT channel, COUNT(*) as count
        FROM notifications
        GROUP BY channel
      `);

      const counts: Record<string, number> = {};
      for (const row of result) {
        counts[row.channel] = parseInt(row.count, 10);
      }
      return counts;
    } catch (error) {
      this.logger.error('Error counting notifications by channel', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
