/**
 * Send Bulk Notification Use Case
 * Sends notifications to multiple recipients
 *
 * Application service for batch notification sending
 */
import { Logger } from 'winston';
import { Notification } from '../../domain/entities/Notification';
import { NotificationBatch } from '../../domain/entities/NotificationBatch';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { SendBulkNotificationDTO, SendBulkNotificationResponseDTO } from '../dtos/notification.dtos';
import {
  TemplateNotFoundError,
  InvalidChannelError,
} from '../../domain/errors/notification.errors';
import { v4 as uuidv4 } from 'uuid';

interface NotificationBatchRepositoryPort {
  create(data: Record<string, unknown>): unknown;
  save(entity: unknown): Promise<unknown>;
  update(criteria: Record<string, unknown>, partial: Record<string, unknown>): Promise<unknown>;
}

/**
 * Send notifications to multiple recipients
 *
 * Workflow:
 * 1. Validate channel and find template
 * 2. Create batch entity
 * 3. For each recipient:
 *    - Render template
 *    - Create notification entity
 *    - Save to database
 *    - Add to batch
 * 4. Save batch
 * 5. Publish event
 * 6. Return response with batchId
 */
export class SendBulkNotification {
  constructor(
    private notificationRepository: INotificationRepository,
    private templateRepository: ITemplateRepository,
    private logger: Logger,
    private eventBus: {
      publish(channel: string, data: unknown): Promise<void>;
    },
    private batchRepository?: NotificationBatchRepositoryPort
  ) {}

  private resolveRecipientIds(input: SendBulkNotificationDTO): string[] {
    if (Array.isArray(input.recipientIds) && input.recipientIds.length > 0) {
      return input.recipientIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }

    if (Array.isArray(input.recipients) && input.recipients.length > 0) {
      return input.recipients
        .map((recipient) => {
          if (typeof recipient === 'string') return recipient;
          return recipient.id || recipient.email || '';
        })
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    }

    return [];
  }

  /**
   * Execute the use case
   *
   * @param input - Input DTO with bulk notification details
   * @returns Response DTO with batchId
   * @throws {InvalidChannelError} If channel is invalid
   * @throws {TemplateNotFoundError} If template not found
   */
  async execute(input: SendBulkNotificationDTO): Promise<SendBulkNotificationResponseDTO> {
    const recipientIds = this.resolveRecipientIds(input);

    if (recipientIds.length === 0) {
      throw new Error('At least one recipient is required');
    }

    this.logger.debug('SendBulkNotification use case started', {
      recipientCount: recipientIds.length,
      channel: input.channel,
      templateSlug: input.templateSlug,
      batchName: input.batchName,
    });

    // Validate channel
    const validChannels = ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'];
    if (!validChannels.includes(input.channel)) {
      throw new InvalidChannelError(input.channel);
    }

    // Find template (if template-based)
    let template;
    if (input.templateSlug) {
      template = await this.templateRepository.findBySlug(input.templateSlug);
      if (!template) {
        throw new TemplateNotFoundError(input.templateSlug);
      }
    }

    // Create batch
    const batchId = uuidv4();
    const batch = new NotificationBatch({
      id: batchId,
      name: input.batchName || `batch-${batchId}`,
      notifications: [],
      status: 'PENDING',
      totalCount: 0,
      sentCount: 0,
      failedCount: 0,
    });

    if (this.batchRepository) {
      const persistedBatch = this.batchRepository.create({
        id: batchId,
        name: batch.name,
        notifications: [],
        status: 'PROCESSING',
        totalCount: recipientIds.length,
        sentCount: 0,
        failedCount: 0,
        startedAt: new Date(),
      });
      await this.batchRepository.save(persistedBatch);
    }

    // Create notifications for each recipient
    const notificationIds: string[] = [];

    for (const recipientId of recipientIds) {
      try {
        // Render template for this recipient (or use direct message)
        let rendered;
        if (template) {
          try {
            rendered = template.render(input.templateData || {});
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.logger.warn('Failed to render template for recipient', {
              recipientId,
              error: reason,
            });
            continue; // Skip this recipient
          }
        } else {
          // Direct message (no template)
          rendered = {
            subject: input.subject || '',
            body: input.body || input.html || '',
          };
        }

        // Create notification
        const notificationId = uuidv4();
        const notification = new Notification({
          id: notificationId,
          type: input.channel as unknown as typeof input.channel,
          channel: input.channel as unknown as typeof input.channel,
          recipientId,
          subject: rendered.subject,
          body: rendered.body,
          templateId: template?.id,
          templateData: input.templateData || {},
          status: 'PENDING',
          priority: input.priority || 'NORMAL',
          retryCount: 0,
          metadata: {
            batchId,
            templateSlug: input.templateSlug,
          },
        });

        // Save notification
        await this.notificationRepository.save(notification);
        batch.addNotification(notificationId);
        notificationIds.push(notificationId);

        this.logger.debug('Notification added to batch', {
          notificationId,
          recipientId,
          batchId,
        });
      } catch (error) {
        this.logger.error('Error creating notification for recipient', {
          recipientId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('Bulk notification batch created', {
      batchId: batch.id,
      batchName: batch.name,
      totalNotifications: notificationIds.length,
      expectedRecipients: recipientIds.length,
    });

    if (this.batchRepository) {
      await this.batchRepository.update(
        { id: batch.id },
        {
          notifications: notificationIds,
          totalCount: notificationIds.length,
          sentCount: 0,
          failedCount: 0,
          status: notificationIds.length > 0 ? 'PROCESSING' : 'FAILED',
          completedAt: notificationIds.length > 0 ? null : new Date(),
        }
      );
    }

    // Publish event
    await this.eventBus.publish('notification.batch_created', {
      batchId: batch.id,
      batchName: batch.name,
      notificationCount: notificationIds.length,
      channel: input.channel,
      templateSlug: input.templateSlug,
      createdAt: new Date(),
    });

    return {
      batchId: batch.id,
      totalCount: notificationIds.length,
      message: `Batch ${batch.id} created with ${notificationIds.length} notifications`,
    };
  }
}
