/**
 * Notification Domain Entity
 * Represents a notification to be sent across multiple channels (Email, SMS, WhatsApp, In-App, Push)
 *
 * This is a rich domain entity with extensive business logic for notification lifecycle management.
 * Implements notification status transitions, retry logic, and expiration handling.
 *
 * @class Notification
 */
export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
export type NotificationStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'BOUNCED';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface NotificationProps {
  id?: string;
  type: NotificationChannel;
  channel: NotificationChannel;
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  status: NotificationStatus;
  priority: NotificationPriority;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Notification {
  readonly id: string;
  readonly type: NotificationChannel;
  readonly channel: NotificationChannel;
  readonly recipientId: string;
  readonly recipientEmail?: string;
  readonly recipientPhone?: string;
  readonly subject: string;
  readonly body: string;
  readonly templateId?: string;
  readonly templateData: Record<string, unknown>;
  readonly priority: NotificationPriority;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;

  private status: NotificationStatus;
  private scheduledAt?: Date;
  private sentAt?: Date;
  private deliveredAt?: Date;
  private failedAt?: Date;
  private failureReason?: string;
  private retryCount: number;
  private updatedAt: Date;

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_BACKOFF_MS = 300000; // 5 minutes
  private static readonly NOTIFICATION_TTL_MS = 86400000; // 24 hours

  /**
   * Create a new Notification entity
   *
   * @param props - Notification properties
   * @throws {Error} If required properties are missing
   */
  constructor(props: NotificationProps) {
    if (!props.id) {
      throw new Error('Notification ID is required');
    }
    if (!props.channel) {
      throw new Error('Channel is required');
    }
    if (!props.recipientId) {
      throw new Error('Recipient ID is required');
    }

    this.id = props.id;
    this.type = props.type;
    this.channel = props.channel;
    this.recipientId = props.recipientId;
    this.recipientEmail = props.recipientEmail;
    this.recipientPhone = props.recipientPhone;
    this.subject = props.subject;
    this.body = props.body;
    this.templateId = props.templateId;
    this.templateData = props.templateData || {};
    this.status = props.status;
    this.priority = props.priority;
    this.scheduledAt = props.scheduledAt;
    this.sentAt = props.sentAt;
    this.deliveredAt = props.deliveredAt;
    this.failedAt = props.failedAt;
    this.failureReason = props.failureReason;
    this.retryCount = props.retryCount;
    this.metadata = props.metadata || {};
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  /**
   * Get current notification status
   *
   * @returns Current status
   */
  getStatus(): NotificationStatus {
    return this.status;
  }

  /**
   * Get current retry count
   *
   * @returns Number of retries attempted
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Mark notification as queued for sending
   *
   * @throws {Error} If status transition is invalid
   */
  queue(): void {
    if (this.status !== 'PENDING') {
      throw new Error(
        `Cannot queue notification with status: ${this.status}. Expected: PENDING`
      );
    }
    this.status = 'QUEUED';
    this.updatedAt = new Date();
  }

  /**
   * Mark notification as currently being sent
   *
   * @throws {Error} If status transition is invalid
   */
  markAsSending(): void {
    if (this.status !== 'QUEUED') {
      throw new Error(
        `Cannot mark as sending with status: ${this.status}. Expected: QUEUED`
      );
    }
    this.status = 'SENDING';
    this.updatedAt = new Date();
  }

  /**
   * Mark notification as sent
   *
   * @throws {Error} If status transition is invalid
   */
  markAsSent(): void {
    if (!['QUEUED', 'SENDING'].includes(this.status)) {
      throw new Error(
        `Cannot mark as sent with status: ${this.status}. Expected: QUEUED or SENDING`
      );
    }
    this.status = 'SENT';
    this.sentAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark notification as delivered
   *
   * @throws {Error} If status transition is invalid
   */
  markAsDelivered(): void {
    if (!['SENT', 'SENDING', 'QUEUED'].includes(this.status)) {
      throw new Error(
        `Cannot mark as delivered with status: ${this.status}. Expected: SENT, SENDING, or QUEUED`
      );
    }
    this.status = 'DELIVERED';
    this.deliveredAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark notification as failed with optional reason
   *
   * @param reason - Failure reason
   * @throws {Error} If reason is not provided
   */
  markAsFailed(reason: string): void {
    if (!reason) {
      throw new Error('Failure reason is required');
    }
    this.status = 'FAILED';
    this.failureReason = reason;
    this.failedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark notification as bounced (recipient address invalid)
   *
   * @throws {Error} If status transition is invalid
   */
  markAsBounced(): void {
    this.status = 'BOUNCED';
    this.failureReason = 'Bounced: recipient address invalid or unreachable';
    this.failedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Check if notification can be retried
   * Max retries: 3
   * Retries only for FAILED status
   *
   * @returns True if notification can be retried
   */
  canRetry(): boolean {
    return this.status === 'FAILED' && this.retryCount < Notification.MAX_RETRIES;
  }

  /**
   * Reset notification for retry attempt
   *
   * @throws {Error} If notification cannot be retried
   */
  scheduleRetry(): void {
    if (!this.canRetry()) {
      throw new Error(
        `Cannot retry: status=${this.status}, retries=${this.retryCount}/${Notification.MAX_RETRIES}`
      );
    }

    this.status = 'PENDING';
    this.retryCount++;
    this.failureReason = undefined;
    this.failedAt = undefined;

    // Exponential backoff: 5min * 2^(retryCount-1)
    const backoff = Notification.RETRY_BACKOFF_MS * Math.pow(2, this.retryCount - 1);
    this.scheduledAt = new Date(Date.now() + backoff);
    this.updatedAt = new Date();
  }

  /**
   * Cancel notification
   * Can only cancel PENDING or QUEUED notifications
   *
   * @throws {Error} If notification status does not allow cancellation
   */
  cancel(): void {
    if (!['PENDING', 'QUEUED'].includes(this.status)) {
      throw new Error(
        `Cannot cancel notification with status: ${this.status}. Allowed: PENDING, QUEUED`
      );
    }
    this.status = 'FAILED';
    this.failureReason = 'Cancelled by user';
    this.failedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Check if notification has expired (older than 24 hours)
   *
   * @returns True if notification has expired
   */
  isExpired(): boolean {
    const ageMs = Date.now() - this.createdAt.getTime();
    return ageMs > Notification.NOTIFICATION_TTL_MS;
  }

  /**
   * Check if notification is ready to send (scheduled time has passed)
   *
   * @returns True if notification can be sent now
   */
  isReadyToSend(): boolean {
    if (this.status !== 'PENDING' && this.status !== 'QUEUED') {
      return false;
    }
    if (!this.scheduledAt) {
      return true;
    }
    return this.scheduledAt <= new Date();
  }

  /**
   * Get notification for JSON serialization
   *
   * @returns Plain object representation
   */
  toJSON(): NotificationProps {
    return {
      id: this.id,
      type: this.type,
      channel: this.channel,
      recipientId: this.recipientId,
      recipientEmail: this.recipientEmail,
      recipientPhone: this.recipientPhone,
      subject: this.subject,
      body: this.body,
      templateId: this.templateId,
      templateData: this.templateData,
      status: this.status,
      priority: this.priority,
      scheduledAt: this.scheduledAt,
      sentAt: this.sentAt,
      deliveredAt: this.deliveredAt,
      failedAt: this.failedAt,
      failureReason: this.failureReason,
      retryCount: this.retryCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
