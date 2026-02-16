/**
 * Email attachment information
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Internal alert for system notifications
 */
export interface InternalAlert {
  type: 'warning' | 'error' | 'info' | 'critical';
  title: string;
  message: string;
  module: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data?: Record<string, unknown>;
  recipientUserIds?: number[];
  sendToAdmin?: boolean;
  timestamp?: Date;
}

/**
 * Generic notification payload
 */
export interface NotificationPayload {
  type: 'email' | 'whatsapp' | 'sms' | 'internal';
  recipient: {
    userId?: number;
    email?: string;
    phone?: string;
  };
  subject?: string;
  templateId?: string;
  params?: Record<string, string>;
  content?: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

/**
 * Notification service interface for sending various types of notifications
 * Implemented by Agent B, consumed by Agent A
 */
export interface INotificationService {
  /**
   * Send a generic notification using specified channel
   * @param notification - Notification payload with details
   */
  send(notification: NotificationPayload): Promise<void>;

  /**
   * Send WhatsApp message using template
   * @param phone - Phone number with country code
   * @param templateId - WhatsApp template ID
   * @param params - Template parameters
   */
  sendWhatsApp(
    phone: string,
    templateId: string,
    params: Record<string, string>,
  ): Promise<void>;

  /**
   * Send email message
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param html - HTML email content
   * @param attachments - Optional file attachments
   */
  sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: EmailAttachment[],
  ): Promise<void>;

  /**
   * Send SMS message
   * @param phone - Phone number with country code
   * @param message - SMS message text
   */
  sendSMS(phone: string, message: string): Promise<void>;

  /**
   * Send internal system alert
   * @param alert - Internal alert details
   */
  sendInternalAlert(alert: InternalAlert): Promise<void>;
}
