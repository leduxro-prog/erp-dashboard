/**
 * Send Notification Use Case
 * Sends a single notification after checking preferences and rendering template
 *
 * Application service orchestrating domain logic and I/O
 */
import { Logger } from 'winston';
import { Notification } from '../../domain/entities/Notification';
import { NotificationTemplate } from '../../domain/entities/NotificationTemplate';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { IPreferenceRepository } from '../../domain/repositories/IPreferenceRepository';
import { NotificationDispatcher } from '../../domain/services/NotificationDispatcher';
import { TemplateEngine } from '../../domain/services/TemplateEngine';
import { SendNotificationDTO, SendNotificationResponseDTO } from '../dtos/notification.dtos';
import {
  TemplateNotFoundError,
  InvalidChannelError,
  RecipientNotFoundError,
  QuietHoursError,
  TemplateRenderError,
  PreferenceNotFoundError,
} from '../../domain/errors/notification.errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Send a single notification through specified channel
 *
 * Workflow:
 * 1. Find and render template
 * 2. Check customer preferences
 * 3. Create notification entity
 * 4. Save to database (PENDING status)
 * 5. Publish event
 * 6. Return response
 */
export class SendNotification {
  constructor(
    private notificationRepository: INotificationRepository,
    private templateRepository: ITemplateRepository,
    private preferenceRepository: IPreferenceRepository,
    private dispatcher: NotificationDispatcher,
    private templateEngine: TemplateEngine,
    private logger: Logger,
    private eventBus: {
      publish(channel: string, data: unknown): Promise<void>;
    }
  ) {}

  /**
   * Execute the use case
   *
   * @param input - Input DTO with notification details
   * @returns Response DTO with notification ID and status
   * @throws {TemplateNotFoundError} If template not found
   * @throws {InvalidChannelError} If channel is invalid
   * @throws {QuietHoursError} If within quiet hours
   * @throws {TemplateRenderError} If template rendering fails
   */
  async execute(input: SendNotificationDTO): Promise<SendNotificationResponseDTO> {
    this.logger.debug('SendNotification use case started', {
      recipientId: input.recipientId,
      channel: input.channel,
      templateSlug: input.templateSlug,
    });

    // Validate channel
    const validChannels = ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'];
    if (!validChannels.includes(input.channel)) {
      throw new InvalidChannelError(input.channel);
    }

    // Find and render template (if template-based)
    let rendered;
    let template;
    if (input.templateSlug) {
      template = await this.templateRepository.findBySlug(input.templateSlug);
      if (!template) {
        throw new TemplateNotFoundError(input.templateSlug);
      }

      try {
        rendered = this.templateEngine.render(template, input.templateData || {});
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new TemplateRenderError(template.id, reason);
      }
    } else {
      // Direct message (no template)
      rendered = {
        subject: input.subject || '',
        body: input.body || input.html || '',
      };
    }

    // Check preferences and quiet hours
    const preference = await this.preferenceRepository.findByCustomerAndChannel(
      input.recipientId,
      input.channel as unknown as typeof input.channel
    );

    if (preference) {
      if (!preference.getIsEnabled()) {
        this.logger.info('Notification not sent: customer has disabled channel', {
          recipientId: input.recipientId,
          channel: input.channel,
        });
        throw new PreferenceNotFoundError(input.recipientId, input.channel);
      }

      if (!preference.isAllowed(input.channel as unknown as typeof input.channel)) {
        throw new QuietHoursError(input.recipientId, input.channel);
      }
    }

    // Create notification entity
    const notificationId = uuidv4();
    const notification = new Notification({
      id: notificationId,
      type: input.channel as unknown as typeof input.channel,
      channel: input.channel as unknown as typeof input.channel,
      recipientId: input.recipientId,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      subject: rendered.subject,
      body: rendered.body,
      templateId: template?.id,
      templateData: input.templateData || {},
      status: 'PENDING',
      priority: input.priority || 'NORMAL',
      scheduledAt: input.scheduledAt,
      retryCount: 0,
      metadata: {
        templateSlug: input.templateSlug,
      },
    });

    // Save notification
    const savedNotification = await this.notificationRepository.save(notification);

    this.logger.info('Notification created and saved', {
      notificationId: savedNotification.id,
      recipientId: savedNotification.recipientId,
      channel: savedNotification.channel,
      status: savedNotification.getStatus(),
    });

    // Publish event
    await this.eventBus.publish('notification.created', {
      notificationId: savedNotification.id,
      recipientId: savedNotification.recipientId,
      channel: savedNotification.channel,
      priority: savedNotification.priority,
      templateSlug: input.templateSlug,
      createdAt: new Date(),
    });

    return {
      notificationId: savedNotification.id,
      status: 'PENDING',
      message: `Notification ${savedNotification.id} created and queued for sending`,
    };
  }
}
