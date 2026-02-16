/**
 * Notification Mapper
 * Maps between domain Notification entity and TypeORM NotificationEntity
 */
import { Notification, NotificationProps } from '../../domain/entities/Notification';
import { NotificationEntity } from '../entities/NotificationEntity';

/**
 * Mapper for Notification domain entity
 */
export class NotificationMapper {
  /**
   * Map from domain entity to persistence entity
   *
   * @param notification - Domain Notification entity
   * @returns TypeORM NotificationEntity
   */
  static toPersistence(notification: Notification): NotificationEntity {
    const props = notification.toJSON();
    const entity = new NotificationEntity();

    entity.id = props.id!;
    entity.type = props.type;
    entity.channel = props.channel;
    entity.recipientId = props.recipientId;
    entity.recipientEmail = props.recipientEmail;
    entity.recipientPhone = props.recipientPhone;
    entity.subject = props.subject;
    entity.body = props.body;
    entity.templateId = props.templateId;
    entity.templateData = props.templateData;
    entity.status = props.status;
    entity.priority = props.priority;
    entity.scheduledAt = props.scheduledAt;
    entity.sentAt = props.sentAt;
    entity.deliveredAt = props.deliveredAt;
    entity.failedAt = props.failedAt;
    entity.failureReason = props.failureReason;
    entity.retryCount = props.retryCount;
    entity.metadata = props.metadata;
    entity.createdAt = props.createdAt!;
    entity.updatedAt = props.updatedAt!;

    return entity;
  }

  /**
   * Map from persistence entity to domain entity
   *
   * @param entity - TypeORM NotificationEntity
   * @returns Domain Notification entity
   */
  static toDomain(entity: NotificationEntity): Notification {
    const props: NotificationProps = {
      id: entity.id,
      type: entity.type as any,
      channel: entity.channel as any,
      recipientId: entity.recipientId,
      recipientEmail: entity.recipientEmail,
      recipientPhone: entity.recipientPhone,
      subject: entity.subject,
      body: entity.body,
      templateId: entity.templateId,
      templateData: entity.templateData,
      status: entity.status as any,
      priority: entity.priority as any,
      scheduledAt: entity.scheduledAt,
      sentAt: entity.sentAt,
      deliveredAt: entity.deliveredAt,
      failedAt: entity.failedAt,
      failureReason: entity.failureReason,
      retryCount: entity.retryCount,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    return new Notification(props);
  }
}
