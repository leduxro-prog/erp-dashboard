/**
 * Composition Root
 * Dependency injection setup for notifications module
 */
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Domain layer
import { NotificationDispatcher } from '../domain/services/NotificationDispatcher';
import { TemplateEngine } from '../domain/services/TemplateEngine';

// Infrastructure layer - Repositories
import { TypeOrmNotificationRepository } from './repositories/TypeOrmNotificationRepository';
import { TypeOrmTemplateRepository } from './repositories/TypeOrmTemplateRepository';
import { TypeOrmPreferenceRepository } from './repositories/TypeOrmPreferenceRepository';
import { NotificationBatchEntity } from './entities/NotificationBatchEntity';

// Infrastructure layer - Providers
import { NodemailerEmailProvider } from './providers/NodemailerEmailProvider';
import { TwilioSmsProvider } from './providers/TwilioSmsProvider';
import { WhatsAppBusinessProvider } from './providers/WhatsAppBusinessProvider';
import { WebPushProvider } from './providers/WebPushProvider';

// Infrastructure layer - Adapters
import { ResendEmailAdapter } from './adapters/ResendEmailAdapter';

// Application layer - Use cases
import { SendNotification } from '../application/use-cases/SendNotification';
import { SendBulkNotification } from '../application/use-cases/SendBulkNotification';
import { ProcessNotificationQueue } from '../application/use-cases/ProcessNotificationQueue';
import { GetNotificationHistory } from '../application/use-cases/GetNotificationHistory';

export interface CompositionRootDependencies {
  dataSource: DataSource;
  logger: Logger;
  eventBus: {
    publish(channel: string, data: unknown): Promise<void>;
  };
}

/**
 * Composition root for dependency injection
 */
export class NotificationsCompositionRoot {
  private notificationRepository: TypeOrmNotificationRepository;
  private templateRepository: TypeOrmTemplateRepository;
  private preferenceRepository: TypeOrmPreferenceRepository;
  private batchRepository: Repository<NotificationBatchEntity>;

  private notificationDispatcher: NotificationDispatcher;
  private templateEngine: TemplateEngine;

  private sendNotificationUseCase: SendNotification;
  private sendBulkNotificationUseCase: SendBulkNotification;
  private processQueueUseCase: ProcessNotificationQueue;
  private historyUseCase: GetNotificationHistory;

  private resendAdapter?: ResendEmailAdapter;

  constructor(private deps: CompositionRootDependencies) {
    // Initialize repositories
    this.notificationRepository = new TypeOrmNotificationRepository(
      deps.dataSource,
      deps.logger
    );
    this.templateRepository = new TypeOrmTemplateRepository(
      deps.dataSource,
      deps.logger
    );
    this.preferenceRepository = new TypeOrmPreferenceRepository(
      deps.dataSource,
      deps.logger
    );
    this.batchRepository = deps.dataSource.getRepository(NotificationBatchEntity);

    // Initialize Resend adapter if API key is available
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey && resendApiKey !== 're_placeholder_key') {
      try {
        const defaultFrom = process.env.EMAIL_FROM || 'noreply@ledux.ro';
        this.resendAdapter = new ResendEmailAdapter(resendApiKey, defaultFrom);
        deps.logger.info('Resend email adapter initialized successfully', {
          defaultFrom,
        });
      } catch (error: any) {
        deps.logger.error('Failed to initialize Resend adapter', {
          error: error.message,
        });
      }
    } else {
      deps.logger.warn('Resend API key not configured, email functionality will be limited');
    }

    // Initialize domain services
    this.notificationDispatcher = new NotificationDispatcher(deps.logger);
    this.templateEngine = new TemplateEngine(deps.logger);

    // Register providers with dispatcher
    this.registerProviders();

    // Initialize use cases
    this.sendNotificationUseCase = new SendNotification(
      this.notificationRepository,
      this.templateRepository,
      this.preferenceRepository,
      this.notificationDispatcher,
      this.templateEngine,
      deps.logger,
      deps.eventBus
    );

    this.sendBulkNotificationUseCase = new SendBulkNotification(
      this.notificationRepository,
      this.templateRepository,
      deps.logger,
      deps.eventBus,
      this.batchRepository
    );

    this.processQueueUseCase = new ProcessNotificationQueue(
      this.notificationRepository,
      this.notificationDispatcher,
      deps.logger,
      deps.eventBus,
      this.batchRepository
    );

    this.historyUseCase = new GetNotificationHistory(
      this.notificationRepository,
      deps.logger
    );
  }

  /**
   * Register all channel providers
   */
  private registerProviders(): void {
    // Email provider
    const emailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      from: process.env.SMTP_FROM || 'noreply@cyphererp.com',
      fromName: process.env.SMTP_FROM_NAME || 'CYPHER ERP',
    };

    const emailProvider = new NodemailerEmailProvider(this.deps.logger, emailConfig);
    this.notificationDispatcher.registerProvider({
      channel: 'EMAIL',
      send: (notification) => emailProvider.sendEmail(
        notification.recipientEmail || notification.recipientId,
        notification.subject,
        notification.body
      ).then(r => ({
        messageId: r.messageId,
        status: r.status,
      })),
    });

    // SMS provider
    const smsConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    };

    const smsProvider = new TwilioSmsProvider(this.deps.logger, smsConfig);
    this.notificationDispatcher.registerProvider({
      channel: 'SMS',
      send: (notification) => smsProvider.sendSms(
        notification.recipientPhone || notification.recipientId,
        notification.body
      ).then(r => ({
        messageId: r.messageId,
        status: r.status,
      })),
    });

    // WhatsApp provider
    const whatsappConfig = {
      phoneNumberId: process.env.WHATSAPP_PHONE_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    };

    const whatsappProvider = new WhatsAppBusinessProvider(
      this.deps.logger,
      whatsappConfig
    );
    this.notificationDispatcher.registerProvider({
      channel: 'WHATSAPP',
      send: (notification) => whatsappProvider.sendTextMessage(
        notification.recipientPhone || notification.recipientId,
        notification.body
      ).then(r => ({
        messageId: r.messageId,
        status: r.status,
      })),
    });

    // Push provider
    const pushConfig = {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    };

    const pushProvider = new WebPushProvider(this.deps.logger, pushConfig);
    this.notificationDispatcher.registerProvider({
      channel: 'PUSH',
      send: (notification) => pushProvider.sendPush(
        notification.recipientId,
        {
          title: notification.subject,
          body: notification.body,
        }
      ).then(r => ({
        messageId: r.messageId,
        status: r.status,
      })),
    });
  }

  // Getters for repositories
  getNotificationRepository() {
    return this.notificationRepository;
  }

  getTemplateRepository() {
    return this.templateRepository;
  }

  getPreferenceRepository() {
    return this.preferenceRepository;
  }

  getBatchRepository(): Repository<NotificationBatchEntity> {
    return this.batchRepository;
  }

  // Getters for domain services
  getNotificationDispatcher() {
    return this.notificationDispatcher;
  }

  getTemplateEngine() {
    return this.templateEngine;
  }

  // Getters for use cases
  getSendNotificationUseCase() {
    return this.sendNotificationUseCase;
  }

  getSendBulkNotificationUseCase() {
    return this.sendBulkNotificationUseCase;
  }

  getProcessQueueUseCase() {
    return this.processQueueUseCase;
  }

  getHistoryUseCase(): GetNotificationHistory {
    return this.historyUseCase;
  }

  // Getter for Resend adapter
  getResendAdapter(): ResendEmailAdapter | undefined {
    return this.resendAdapter;
  }
}
