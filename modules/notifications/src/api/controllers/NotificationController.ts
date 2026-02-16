/**
 * Notification Controller
 * Handles HTTP requests for notification endpoints
 */
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsCompositionRoot } from '../../infrastructure/composition-root';
import { SendNotificationDTO, SendBulkNotificationDTO } from '../../application/dtos/notification.dtos';
import { ResendEmailAdapter } from '../../infrastructure/adapters/ResendEmailAdapter';
import { NotificationTemplate } from '../../domain/entities/NotificationTemplate';
import {
  NotificationPreference,
  NotificationChannel,
  NotificationFrequency,
} from '../../domain/entities/NotificationPreference';
import { NotificationBatchEntity } from '../../infrastructure/entities/NotificationBatchEntity';

// Use intersection type instead of interface to avoid extension conflicts
type AuthenticatedRequest = Request & { user?: { id: string; email: string; role: string } };

/**
 * REST API controller for notifications
 */
export class NotificationController {
  constructor(
    private compositionRoot: NotificationsCompositionRoot,
    private resendAdapter?: ResendEmailAdapter
  ) { }

  /**
   * POST /send
   * Send a single notification
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const input: SendNotificationDTO = req.body;

      // Check if this is a direct email send request
      if (input.channel === 'EMAIL' && this.resendAdapter && input.recipientEmail) {
        try {
          const emailResult = await this.resendAdapter.sendEmail({
            to: input.recipientEmail,
            subject: input.subject || 'Notification',
            html: input.body,
            template: input.templateSlug,
            templateData: input.data,
          });

          if (emailResult.success) {
            res.status(201).json({
              success: true,
              notificationId: emailResult.messageId,
              channel: 'EMAIL',
              status: 'SENT',
            });
            return;
          } else {
            res.status(500).json({
              success: false,
              error: emailResult.error || 'Failed to send email',
            });
            return;
          }
        } catch (emailError: any) {
          res.status(500).json({
            success: false,
            error: emailError.message || 'Email sending failed',
          });
          return;
        }
      }

      // Fall back to standard use case
      const useCase = this.compositionRoot.getSendNotificationUseCase();
      const result = await useCase.execute(input);

      res.status(201).json(result);
    } catch (error) {
      throw error;
    }
  }

  /**
   * POST /bulk
   * Send bulk notifications
   */
  async sendBulkNotification(req: Request, res: Response): Promise<void> {
    try {
      const rawInput = req.body as SendBulkNotificationDTO;
      const hasRecipientIds = Array.isArray(rawInput.recipientIds) && rawInput.recipientIds.length > 0;
      const hasRecipients = Array.isArray(rawInput.recipients) && rawInput.recipients.length > 0;

      if (!hasRecipientIds && !hasRecipients) {
        res.status(400).json({
          success: false,
          error: 'At least one recipient is required',
        });
        return;
      }

      const input: SendBulkNotificationDTO = {
        ...rawInput,
        recipientIds: hasRecipientIds
          ? rawInput.recipientIds
          : (rawInput.recipients || [])
              .map((recipient: any) => {
                if (typeof recipient === 'string') return recipient;
                return recipient?.id || recipient?.email || '';
              })
              .filter((id: string) => typeof id === 'string' && id.length > 0),
      };

      // Check if this is a bulk email send request via Resend
      if (input.channel === 'EMAIL' && this.resendAdapter && (hasRecipients || hasRecipientIds)) {
        const batchRepository = this.compositionRoot.getBatchRepository();
        let batchId: string | undefined;
        try {
          const recipientSource = hasRecipients
            ? (rawInput.recipients as Array<string | { email?: string; data?: Record<string, unknown> }>)
            : (rawInput.recipientIds || []);

          const recipientRecords = recipientSource
            .map((recipient: any) => {
              if (typeof recipient === 'string') {
                return { email: recipient, data: input.data || input.templateData };
              }
              return {
                email: recipient?.email,
                data: recipient?.data || input.data || input.templateData,
              };
            })
            .filter((recipient) => typeof recipient.email === 'string' && recipient.email.length > 0);

          const emailMessages = recipientRecords.map((recipient) => ({
            to: recipient.email,
            subject: input.subject || 'Notification',
            html: input.body || input.html,
            template: input.templateSlug,
            templateData: recipient.data,
          }));

          if (emailMessages.length === 0) {
            res.status(400).json({
              success: false,
              error: 'No valid recipients provided',
            });
            return;
          }

          batchId = uuidv4();
          const now = new Date();

          const batch = batchRepository.create({
            id: batchId,
            name: input.batchName || `resend-batch-${batchId}`,
            notifications: [],
            status: 'PROCESSING',
            totalCount: emailMessages.length,
            sentCount: 0,
            failedCount: 0,
            startedAt: now,
          });

          await batchRepository.save(batch);

          const bulkResult = await this.resendAdapter.sendBulk(emailMessages);
          const sentCount = bulkResult.totalSuccess;
          const failedCount = bulkResult.totalFailed;
          const status = failedCount > 0 && sentCount === 0 ? 'FAILED' : 'COMPLETED';

          await batchRepository.update(
            { id: batchId },
            {
              sentCount,
              failedCount,
              status,
              completedAt: new Date(),
            }
          );

          res.status(bulkResult.success ? 201 : 207).json({
            success: bulkResult.success,
            batchId,
            totalCount: emailMessages.length,
            totalSent: sentCount,
            totalFailed: failedCount,
            results: bulkResult.results,
            status: bulkResult.success ? 'COMPLETED' : 'PARTIAL',
            channel: 'EMAIL',
            message: `Batch ${batchId} processed with ${sentCount} sent and ${failedCount} failed`,
          });
          return;
        } catch (emailError: any) {
          if (batchId) {
            try {
              await batchRepository.update(
                { id: batchId },
                {
                  status: 'FAILED',
                  completedAt: new Date(),
                }
              );
            } catch {
              // Keep original send error response
            }
          }
          res.status(500).json({
            success: false,
            error: emailError.message || 'Bulk email sending failed',
          });
          return;
        }
      }

      // Fall back to standard use case
      const useCase = this.compositionRoot.getSendBulkNotificationUseCase();
      const result = await useCase.execute(input);

      res.status(201).json({
        success: true,
        batchId: result.batchId,
        totalCount: result.totalCount,
        totalSent: 0,
        totalFailed: 0,
        results: [],
        status: 'QUEUED',
        channel: input.channel,
        message: result.message,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /history
   * Get notification history for user
   */
  async getNotificationHistory(req: Request, res: Response): Promise<void> {
    try {
      const recipientId = String(req.user?.id || '');
      if (!recipientId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const page = parseInt((req.query.page as string) || '1');
      const limit = parseInt((req.query.limit as string) || '20');
      const cursor = req.query.cursor as string | undefined;

      const useCase = this.compositionRoot.getHistoryUseCase();
      const result = await useCase.execute(recipientId, page, limit, cursor);

      res.json(result);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /:id
   * Get notification detail
   */
  async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const notificationRepo = this.compositionRoot.getNotificationRepository();
      const notification = await notificationRepo.findById(id);

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
        return;
      }

      const currentUserId = String(req.user?.id || '');
      const isAdmin = req.user?.role === 'admin';
      if (!isAdmin && currentUserId && String(notification.recipientId) !== currentUserId) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      res.json({
        success: true,
        data: notification.toJSON(),
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * POST /:id/retry
   * Retry failed notification
   */
  async retryNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const notificationRepo = this.compositionRoot.getNotificationRepository();
      const notification = await notificationRepo.findById(id);

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
        return;
      }

      if (!notification.canRetry()) {
        res.status(400).json({
          success: false,
          error: 'Notification is not retryable',
        });
        return;
      }

      notification.scheduleRetry();
      await notificationRepo.update(notification);

      res.json({
        success: true,
        notificationId: id,
        status: notification.getStatus(),
        retryCount: notification.getRetryCount(),
        message: 'Retry queued',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /stats
   * Get notification statistics
   */
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const startDate = new Date(req.query.startDate as string || new Date().setDate(new Date().getDate() - 7));
      const endDate = new Date(req.query.endDate as string || new Date());

      const notificationRepo = this.compositionRoot.getNotificationRepository();
      const [
        sent,
        delivered,
        failed,
        bounced,
        pending,
        queued,
        sending,
        byChannel,
      ] = await Promise.all([
        notificationRepo.findByStatusAndDateRange('SENT', startDate, endDate),
        notificationRepo.findByStatusAndDateRange('DELIVERED', startDate, endDate),
        notificationRepo.findByStatusAndDateRange('FAILED', startDate, endDate),
        notificationRepo.findByStatusAndDateRange('BOUNCED', startDate, endDate),
        notificationRepo.findByStatusAndDateRange('PENDING', startDate, endDate),
        notificationRepo.findByStatusAndDateRange('QUEUED', startDate, endDate),
        notificationRepo.findByStatusAndDateRange('SENDING', startDate, endDate),
        notificationRepo.countByChannel(),
      ]);

      const total =
        sent.length + delivered.length + failed.length + bounced.length + pending.length + queued.length + sending.length;

      res.json({
        success: true,
        period: { startDate, endDate },
        summary: {
          total,
          sent: sent.length,
          delivered: delivered.length,
          failed: failed.length,
          bounced: bounced.length,
          pending: pending.length,
          queued: queued.length,
          sending: sending.length,
        },
        byChannel,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /templates
   * List notification templates
   */
  async listTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templateRepo = this.compositionRoot.getTemplateRepository();

      // TODO: Extract filters from query params
      const templates = await templateRepo.findAll();

      res.json(templates);
    } catch (error) {
      throw error;
    }
  }

  /**
   * POST /templates
   * Create notification template
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, slug, channel, subject, body, locale, isActive } = req.body;

      // Validate input
      if (!name || !slug || !body) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, slug, body',
        });
        return;
      }

      // Check slug uniqueness
      const templateRepo = this.compositionRoot.getTemplateRepository();
      const slugExists = await templateRepo.slugExists(slug);
      if (slugExists) {
        res.status(400).json({
          success: false,
          error: `Template with slug '${slug}' already exists`,
        });
        return;
      }

      // Register template with ResendAdapter if it's an EMAIL template
      if ((channel === 'EMAIL' || !channel) && this.resendAdapter) {
        try {
          this.resendAdapter.registerTemplate(slug, body);
        } catch (templateError: any) {
          res.status(400).json({
            success: false,
            error: 'Invalid Handlebars template: ' + templateError.message,
          });
          return;
        }
      }

      // Create domain entity
      const template = new NotificationTemplate({
        id: uuidv4(),
        name,
        slug,
        channel: (channel || 'EMAIL') as any,
        subject: subject || '',
        body,
        locale: (locale || 'ro') as any,
        isActive: isActive !== false,
        version: 1,
        createdBy: String(req.user?.id || 'system'),
      });

      // Save to database
      await templateRepo.save(template);

      res.status(201).json({
        success: true,
        message: 'Template created',
        templateId: template.id,
        template: template.toJSON(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create template',
      });
    }
  }

  /**
   * PUT /templates/:id
   * Update notification template
   */
  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, subject, body, isActive } = req.body;

      const templateRepo = this.compositionRoot.getTemplateRepository();

      // Find existing template
      const template = await templateRepo.findById(id);
      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found',
        });
        return;
      }

      // If updating email template content, validate and register with ResendAdapter
      if ((subject !== undefined || body !== undefined) && template.channel === 'EMAIL' && this.resendAdapter) {
        const newSubject = subject !== undefined ? subject : template.toJSON().subject;
        const newBody = body !== undefined ? body : template.toJSON().body;

        try {
          template.updateContent(newSubject, newBody);
          this.resendAdapter.registerTemplate(template.slug, newBody);
        } catch (templateError: any) {
          res.status(400).json({
            success: false,
            error: 'Invalid Handlebars template: ' + templateError.message,
          });
          return;
        }
      } else if (subject !== undefined && body !== undefined) {
        template.updateContent(subject, body);
      }

      // Update active status
      if (isActive !== undefined) {
        if (isActive) {
          template.activate();
        } else {
          template.deactivate();
        }
      }

      // Save updated template
      await templateRepo.update(template);

      res.json({
        success: true,
        message: 'Template updated',
        templateId: id,
        template: template.toJSON(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update template',
      });
    }
  }

  /**
   * DELETE /templates/:id
   * Delete notification template
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const templateRepo = this.compositionRoot.getTemplateRepository();

      // TODO: Check if template is in use
      const deleted = await templateRepo.delete(id);

      res.json({ message: 'Template deleted', deletedCount: deleted });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /preferences
   * Get my notification preferences
   */
  async getMyPreferences(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Extract customerId from authenticated user
      const customerId = String(req.user?.id || '');
      const preferenceRepo = this.compositionRoot.getPreferenceRepository();

      const preferences = await preferenceRepo.findByCustomerId(customerId);

      res.json(preferences);
    } catch (error) {
      throw error;
    }
  }

  /**
   * PUT /preferences
   * Update my notification preferences
   */
  async updateMyPreferences(req: Request, res: Response): Promise<void> {
    try {
      const customerId = String(req.user?.id || '');
      if (!customerId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }

      const rawPayload = req.body;
      const payload = Array.isArray(rawPayload)
        ? rawPayload
        : (rawPayload?.preferences as unknown);

      if (!Array.isArray(payload)) {
        res.status(400).json({
          success: false,
          error: 'Invalid payload. Expected an array or { preferences: [] }',
        });
        return;
      }

      const allowedChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'];
      const allowedFrequencies: NotificationFrequency[] = ['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST'];

      const preferenceRepo = this.compositionRoot.getPreferenceRepository();
      const updatedPreferences: NotificationPreference[] = [];

      for (let i = 0; i < payload.length; i += 1) {
        const item = payload[i] as any;

        if (!item || typeof item !== 'object') {
          res.status(400).json({
            success: false,
            error: `Invalid preferences[${i}]. Expected an object`,
          });
          return;
        }

        const { channel, isEnabled, quietHoursStart, quietHoursEnd, frequency } = item;

        if (!channel) {
          res.status(400).json({
            success: false,
            error: `Missing required field preferences[${i}].channel`,
          });
          return;
        }

        if (typeof isEnabled !== 'boolean') {
          res.status(400).json({
            success: false,
            error: `Invalid or missing required field preferences[${i}].isEnabled (expected boolean)`,
          });
          return;
        }

        if (!frequency) {
          res.status(400).json({
            success: false,
            error: `Missing required field preferences[${i}].frequency`,
          });
          return;
        }

        if (!allowedChannels.includes(channel)) {
          res.status(400).json({
            success: false,
            error: `Invalid preferences[${i}].channel. Allowed values: ${allowedChannels.join(', ')}`,
          });
          return;
        }

        if (!allowedFrequencies.includes(frequency)) {
          res.status(400).json({
            success: false,
            error: `Invalid preferences[${i}].frequency. Allowed values: ${allowedFrequencies.join(', ')}`,
          });
          return;
        }

        if (quietHoursStart !== undefined && typeof quietHoursStart !== 'string') {
          res.status(400).json({
            success: false,
            error: `Invalid preferences[${i}].quietHoursStart (expected HH:mm string)`,
          });
          return;
        }

        if (quietHoursEnd !== undefined && typeof quietHoursEnd !== 'string') {
          res.status(400).json({
            success: false,
            error: `Invalid preferences[${i}].quietHoursEnd (expected HH:mm string)`,
          });
          return;
        }

        if (
          (quietHoursStart !== undefined && quietHoursEnd === undefined)
          || (quietHoursStart === undefined && quietHoursEnd !== undefined)
        ) {
          res.status(400).json({
            success: false,
            error: `preferences[${i}] must provide both quietHoursStart and quietHoursEnd`,
          });
          return;
        }

        const existing = await preferenceRepo.findByCustomerAndChannel(customerId, channel as NotificationChannel);
        const preferenceId = existing?.id || uuidv4();

        let preference: NotificationPreference;
        try {
          preference = new NotificationPreference({
            id: preferenceId,
            customerId,
            channel: channel as NotificationChannel,
            isEnabled,
            quietHoursStart,
            quietHoursEnd,
            frequency: frequency as NotificationFrequency,
          });
        } catch (validationError: any) {
          res.status(400).json({
            success: false,
            error: `Invalid preferences[${i}]: ${validationError.message}`,
          });
          return;
        }

        const updated = await preferenceRepo.upsert(preference);
        updatedPreferences.push(updated);
      }

      res.json({
        success: true,
        preferences: updatedPreferences.map((preference) => preference.toJSON()),
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /batches/:id
   * Get batch status
   */
  async getBatchStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const batchRepository = this.compositionRoot.getBatchRepository();
      const batch = await batchRepository.findOne({ where: { id } });

      if (!batch) {
        res.status(404).json({
          success: false,
          error: 'Batch not found',
        });
        return;
      }

      const processed = batch.sentCount + batch.failedCount;
      const pending = Math.max(0, batch.totalCount - processed);
      const progress = batch.totalCount > 0
        ? Math.round((processed / batch.totalCount) * 100)
        : 0;

      res.json({
        success: true,
        batchId: batch.id,
        status: batch.status,
        totalCount: batch.totalCount,
        sentCount: batch.sentCount,
        failedCount: batch.failedCount,
        pendingCount: pending,
        progress,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      });
    } catch (error) {
      throw error;
    }
  }
}
