/**
 * Notifications Module - Public API
 * Exports all public classes and types
 */

// Domain Entities
export { Notification } from './domain/entities/Notification';
export type {
  NotificationChannel,
  NotificationStatus,
  NotificationPriority,
  NotificationProps,
} from './domain/entities/Notification';

export { NotificationTemplate } from './domain/entities/NotificationTemplate';
export type {
  TemplateLocale,
  NotificationTemplateProps,
} from './domain/entities/NotificationTemplate';

export { NotificationPreference } from './domain/entities/NotificationPreference';
export type {
  NotificationFrequency,
  NotificationPreferenceProps,
  QuietHours,
} from './domain/entities/NotificationPreference';

export { NotificationBatch } from './domain/entities/NotificationBatch';
export type {
  BatchStatus,
  NotificationBatchProps,
} from './domain/entities/NotificationBatch';

// Domain Errors
export {
  TemplateNotFoundError,
  InvalidChannelError,
  RecipientNotFoundError,
  QuietHoursError,
  MaxRetriesExceededError,
  TemplateRenderError,
  TemplateValidationError,
  PreferenceNotFoundError,
  InvalidStatusTransitionError,
  BatchOperationError,
  NotificationExpiredError,
} from './domain/errors/notification.errors';

// Domain Services
export { NotificationDispatcher } from './domain/services/NotificationDispatcher';
export type { IChannelProvider } from './domain/services/NotificationDispatcher';

export { TemplateEngine } from './domain/services/TemplateEngine';
export type { TemplateRenderResult } from './domain/services/TemplateEngine';

// Domain Repositories (Interfaces)
export type {
  INotificationRepository,
  PaginationOptions,
  NotificationQueryResult,
} from './domain/repositories/INotificationRepository';

export type { ITemplateRepository } from './domain/repositories/ITemplateRepository';

export type { IPreferenceRepository } from './domain/repositories/IPreferenceRepository';

// Application DTOs
export type {
  SendNotificationDTO,
  SendBulkNotificationDTO,
  NotificationResponseDTO,
  NotificationHistoryDTO,
  TemplateDTO,
  CreateTemplateDTO,
  UpdateTemplateDTO,
  PreferenceDTO,
  UpdatePreferenceDTO,
  BatchDTO,
  StatsDTO,
  RetryNotificationDTO,
  SendNotificationResponseDTO,
  SendBulkNotificationResponseDTO,
} from './application/dtos/notification.dtos';

// Application Ports (Provider Interfaces)
export type { IEmailProvider, EmailSendResult, EmailAttachment } from './application/ports/IEmailProvider';

export type { ISmsProvider, SmsSendResult } from './application/ports/ISmsProvider';

export type {
  IWhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppButton,
  WhatsAppTemplate,
} from './application/ports/IWhatsAppProvider';

export type {
  IPushProvider,
  PushSendResult,
  PushNotificationPayload,
} from './application/ports/IPushProvider';

// Use Cases
export { SendNotification } from './application/use-cases/SendNotification';
export { SendBulkNotification } from './application/use-cases/SendBulkNotification';
export { ProcessNotificationQueue } from './application/use-cases/ProcessNotificationQueue';
export { GetNotificationHistory } from './application/use-cases/GetNotificationHistory';

// Infrastructure
export { TypeOrmNotificationRepository } from './infrastructure/repositories/TypeOrmNotificationRepository';
export { TypeOrmTemplateRepository } from './infrastructure/repositories/TypeOrmTemplateRepository';
export { TypeOrmPreferenceRepository } from './infrastructure/repositories/TypeOrmPreferenceRepository';

export { NotificationsCompositionRoot } from './infrastructure/composition-root';
export type { CompositionRootDependencies } from './infrastructure/composition-root';

export { NodemailerEmailProvider } from './infrastructure/providers/NodemailerEmailProvider';
export { TwilioSmsProvider } from './infrastructure/providers/TwilioSmsProvider';
export { WhatsAppBusinessProvider } from './infrastructure/providers/WhatsAppBusinessProvider';
export { WebPushProvider } from './infrastructure/providers/WebPushProvider';

// Module
export { default as NotificationsModule } from './notification-module';

// API
export { createNotificationsRouter } from './api/routes/notification.routes';
export { NotificationController } from './api/controllers/NotificationController';
