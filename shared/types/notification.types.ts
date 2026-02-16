/**
 * Notification and messaging types
 * Supports: Email, WhatsApp, SMS, In-App notifications
 */

import { BaseEntity } from './common.types';

/**
 * WhatsApp message direction
 */
export const WhatsAppDirectionEnum = {
  SENT: 'SENT',
  RECEIVED: 'RECEIVED',
} as const;

export type WhatsAppDirection = typeof WhatsAppDirectionEnum[keyof typeof WhatsAppDirectionEnum];

/**
 * WhatsApp message types
 */
export const WhatsAppMessageTypeEnum = {
  CONFIRMATION: 'CONFIRMATION',
  STATUS: 'STATUS',
  ALERT: 'ALERT',
  NOTIFICATION: 'NOTIFICATION',
  QUOTE: 'QUOTE',
} as const;

export type WhatsAppMessageType = typeof WhatsAppMessageTypeEnum[keyof typeof WhatsAppMessageTypeEnum];

/**
 * Notification type enumeration
 */
export const NotificationTypeEnum = {
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  IN_APP: 'IN_APP',
} as const;

export type NotificationType = typeof NotificationTypeEnum[keyof typeof NotificationTypeEnum];

/**
 * WhatsApp message
 */
export interface WhatsAppMessage extends BaseEntity {
  /** Customer ID */
  customerId?: number | null;
  /** Customer phone number (with country code) */
  phoneNumber: string;
  /** Message direction */
  direction: WhatsAppDirection;
  /** Message type */
  messageType: WhatsAppMessageType;
  /** Message content */
  content: string;
  /** Message status (sent, delivered, read, failed) */
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  /** WhatsApp message ID */
  whatsappMessageId?: string | null;
  /** Related entity type (order, quote, quote_request) */
  relatedEntityType?: string | null;
  /** Related entity ID */
  relatedEntityId?: number | null;
  /** Order ID (if message is about an order) */
  orderId?: number | null;
  /** Quote ID (if message is about a quote) */
  quoteId?: number | null;
  /** Timestamp when message was sent */
  sentAt?: Date | null;
  /** Timestamp when message was delivered */
  deliveredAt?: Date | null;
  /** Timestamp when message was read */
  readAt?: Date | null;
  /** Error message if failed */
  errorMessage?: string | null;
  /** Metadata JSON (button callbacks, parameters, etc.) */
  metadata?: Record<string, unknown> | null;
  /** Response from customer (if applicable) */
  response?: string | null;
  /** Response received at */
  responseReceivedAt?: Date | null;
}

/**
 * SMS message
 */
export interface SMSMessage extends BaseEntity {
  /** Customer ID */
  customerId?: number | null;
  /** Phone number */
  phoneNumber: string;
  /** Message content */
  content: string;
  /** Message status */
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  /** SMS provider (Twilio, etc.) */
  provider?: string | null;
  /** Provider message ID */
  providerMessageId?: string | null;
  /** Related entity type */
  relatedEntityType?: string | null;
  /** Related entity ID */
  relatedEntityId?: number | null;
  /** Order ID */
  orderId?: number | null;
  /** Sent at timestamp */
  sentAt?: Date | null;
  /** Delivered at timestamp */
  deliveredAt?: Date | null;
  /** Error message if failed */
  errorMessage?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Email message
 */
export interface EmailMessage extends BaseEntity {
  /** From address */
  fromAddress: string;
  /** From name */
  fromName?: string | null;
  /** To address */
  toAddress: string;
  /** CC addresses (comma-separated) */
  ccAddresses?: string | null;
  /** BCC addresses (comma-separated) */
  bccAddresses?: string | null;
  /** Email subject */
  subject: string;
  /** Email body (HTML) */
  htmlBody?: string | null;
  /** Email body (plain text) */
  textBody?: string | null;
  /** Email status (sent, delivered, bounced, failed, pending) */
  status: 'sent' | 'delivered' | 'bounced' | 'failed' | 'pending';
  /** Email provider (SMTP, SendGrid, etc.) */
  provider?: string | null;
  /** Provider message ID */
  providerMessageId?: string | null;
  /** Customer ID */
  customerId?: number | null;
  /** Related entity type */
  relatedEntityType?: string | null;
  /** Related entity ID */
  relatedEntityId?: number | null;
  /** Order ID */
  orderId?: number | null;
  /** Quote ID */
  quoteId?: number | null;
  /** Template used */
  templateName?: string | null;
  /** Sent at timestamp */
  sentAt?: Date | null;
  /** Delivered at timestamp */
  deliveredAt?: Date | null;
  /** Opened at timestamp */
  openedAt?: Date | null;
  /** Clicked at timestamp */
  clickedAt?: Date | null;
  /** Error message if failed */
  errorMessage?: string | null;
  /** Number of send attempts */
  attemptCount: number;
  /** Attachments (JSON array with filenames) */
  attachments?: Array<{ filename: string; size: number }> | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * In-app notification
 */
export interface InAppNotification extends BaseEntity {
  /** User ID */
  userId: number;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification type (info, success, warning, error) */
  notificationType: 'info' | 'success' | 'warning' | 'error';
  /** Related entity type */
  relatedEntityType?: string | null;
  /** Related entity ID */
  relatedEntityId?: number | null;
  /** Order ID */
  orderId?: number | null;
  /** Quote ID */
  quoteId?: number | null;
  /** Action URL */
  actionUrl?: string | null;
  /** Whether notification is read */
  isRead: boolean;
  /** Read at timestamp */
  readAt?: Date | null;
  /** Whether notification should be archived */
  isArchived: boolean;
  /** Archived at timestamp */
  archivedAt?: Date | null;
  /** Notification priority (low, normal, high) */
  priority: 'low' | 'normal' | 'high';
  /** Icon/avatar URL */
  iconUrl?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * General notification wrapper
 */
export interface Notification extends BaseEntity {
  /** Notification type */
  type: NotificationType;
  /** Recipient type (user, customer, guest) */
  recipientType: 'user' | 'customer' | 'guest';
  /** Recipient ID (userId, customerId, or email) */
  recipientId: string;
  /** Recipient email */
  recipientEmail?: string | null;
  /** Recipient phone */
  recipientPhone?: string | null;
  /** Notification subject/title */
  subject: string;
  /** Notification body/message */
  message: string;
  /** Notification status */
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  /** Related entity type */
  relatedEntityType?: string | null;
  /** Related entity ID */
  relatedEntityId?: number | null;
  /** Order ID */
  orderId?: number | null;
  /** Quote ID */
  quoteId?: number | null;
  /** Template used */
  templateName?: string | null;
  /** Template variables JSON */
  templateVariables?: Record<string, unknown> | null;
  /** Sent at timestamp */
  sentAt?: Date | null;
  /** Delivered at timestamp */
  deliveredAt?: Date | null;
  /** Error message if failed */
  errorMessage?: string | null;
  /** Retry count */
  retryCount: number;
  /** Next retry at */
  nextRetryAt?: Date | null;
  /** Channel-specific ID (email ID, SMS ID, WhatsApp ID, etc.) */
  channelMessageId?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Notification template
 */
export interface NotificationTemplate extends BaseEntity {
  /** Template name */
  name: string;
  /** Template type */
  type: NotificationType;
  /** Template subject (for email) */
  subject?: string | null;
  /** Template body (HTML for email, plain text for SMS/WhatsApp) */
  body: string;
  /** Template description */
  description?: string | null;
  /** Variables used in template (JSON array) */
  variables: Array<{
    name: string;
    displayName: string;
    description?: string;
    defaultValue?: string;
  }>;
  /** Whether template is active */
  isActive: boolean;
  /** Whether template is default */
  isDefault: boolean;
  /** Template language */
  language: string;
  /** Usage count */
  usageCount: number;
  /** Created by user ID */
  createdByUserId: number;
  /** Last used date */
  lastUsedAt?: Date | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Notification payload for sending
 */
export interface NotificationPayload {
  /** Recipient email/phone/user ID */
  recipient: string;
  /** Notification type */
  type: NotificationType;
  /** Template name or direct content */
  template?: string;
  subject?: string;
  message: string;
  /** Template variables */
  variables?: Record<string, unknown>;
  /** Related entity */
  relatedEntity?: {
    type: string;
    id: number;
  };
  /** Priority */
  priority?: 'low' | 'normal' | 'high';
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Notification preference
 */
export interface NotificationPreference extends BaseEntity {
  /** User ID or Customer ID */
  entityId: number;
  /** Entity type (user or customer) */
  entityType: 'user' | 'customer';
  /** Notification type */
  notificationType: NotificationType;
  /** Whether enabled */
  enabled: boolean;
  /** Frequency (immediate, daily, weekly, never) */
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  /** Quiet hours (JSON: {start: "22:00", end: "08:00"}) */
  quietHours?: Record<string, string> | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Notification queue for processing
 */
export interface NotificationQueue extends BaseEntity {
  /** Notification type */
  type: NotificationType;
  /** Queue status (queued, processing, sent, failed) */
  status: 'queued' | 'processing' | 'sent' | 'failed';
  /** Notification payload */
  payload: NotificationPayload;
  /** Scheduled send time */
  scheduledAt?: Date | null;
  /** Processing started at */
  processingStartedAt?: Date | null;
  /** Sent at */
  sentAt?: Date | null;
  /** Error message */
  errorMessage?: string | null;
  /** Retry count */
  retryCount: number;
  /** Max retries */
  maxRetries: number;
  /** Next retry at */
  nextRetryAt?: Date | null;
}

/**
 * DTO for sending notification
 */
export interface SendNotificationDTO {
  type: NotificationType;
  recipient: string;
  subject?: string;
  message: string;
  templateName?: string;
  templateVariables?: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: number;
  priority?: 'low' | 'normal' | 'high';
  scheduledAt?: Date;
}

/**
 * DTO for notification preferences
 */
export interface UpdateNotificationPreferencesDTO {
  notificationType: NotificationType;
  enabled: boolean;
  frequency?: 'immediate' | 'daily' | 'weekly' | 'never';
  quietHours?: {
    start: string;
    end: string;
  };
}
