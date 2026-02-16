/**
 * Data Transfer Objects (DTOs) for Notification Module
 * Used for API request/response contracts
 */

/**
 * DTO for sending a single notification
 */
export interface SendNotificationDTO {
  recipientId: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  templateSlug?: string;
  templateData?: Record<string, unknown>;
  // Direct message fields (alternative to template-based)
  subject?: string;
  body?: string;
  html?: string;
  data?: Record<string, unknown>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  scheduledAt?: Date;
  recipientEmail?: string;
  recipientPhone?: string;
}

/**
 * DTO for bulk sending notifications
 */
export interface SendBulkNotificationDTO {
  recipientIds?: string[];
  recipients?: Array<string | { id?: string; email?: string; data?: Record<string, unknown> }>; // Alias/support for direct email payloads
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  templateSlug?: string;
  templateData?: Record<string, unknown>;
  // Direct message fields (alternative to template-based)
  subject?: string;
  body?: string;
  html?: string;
  data?: Record<string, unknown>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  batchName: string;
}

/**
 * DTO for notification response
 */
export interface NotificationResponseDTO {
  id: string;
  type: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for notification history entry
 */
export interface NotificationHistoryDTO {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  subject: string;
  body: string;
  status: 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  createdAt: Date;
}

/**
 * DTO for notification template
 */
export interface TemplateDTO {
  id: string;
  name: string;
  slug: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  subject: string;
  body: string;
  locale: 'ro' | 'en';
  isActive: boolean;
  version: number;
  requiredVariables: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating/updating template
 */
export interface CreateTemplateDTO {
  name: string;
  slug: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  subject: string;
  body: string;
  locale: 'ro' | 'en';
  isActive?: boolean;
}

export interface UpdateTemplateDTO {
  name?: string;
  subject?: string;
  body?: string;
  locale?: 'ro' | 'en';
  isActive?: boolean;
}

/**
 * DTO for notification preference
 */
export interface PreferenceDTO {
  id: string;
  customerId: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  isEnabled: boolean;
  frequency: 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for updating notification preference
 */
export interface UpdatePreferenceDTO {
  isEnabled?: boolean;
  frequency?: 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST';
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

/**
 * DTO for notification batch
 */
export interface BatchDTO {
  id: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalCount: number;
  sentCount: number;
  failedCount: number;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for notification statistics
 */
export interface StatsDTO {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    bounced: number;
    pending: number;
  };
  byChannel: Record<string, {
    total: number;
    sent: number;
    failed: number;
    bounced: number;
  }>;
  byPriority: Record<string, {
    total: number;
    sent: number;
    failed: number;
  }>;
  averageRetries: number;
  maxRetries: number;
}

/**
 * DTO for retry notification request
 */
export interface RetryNotificationDTO {
  notificationId: string;
}

/**
 * DTO for response from sending notification
 */
export interface SendNotificationResponseDTO {
  notificationId: string;
  status: 'PENDING' | 'QUEUED';
  message: string;
}

/**
 * DTO for response from bulk sending
 */
export interface SendBulkNotificationResponseDTO {
  batchId: string;
  totalCount: number;
  message: string;
}
