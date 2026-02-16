/**
 * WhatsApp Message Domain Entity
 *
 * Represents a single WhatsApp message in the system.
 * Handles message lifecycle: creation, delivery tracking, and retries.
 *
 * @module whatsapp/domain/entities
 */

/**
 * Direction of the message.
 */
export type MessageDirection = 'INBOUND' | 'OUTBOUND';

/**
 * Type of message content.
 */
export type MessageType =
  | 'TEXT'
  | 'TEMPLATE'
  | 'IMAGE'
  | 'DOCUMENT'
  | 'VIDEO'
  | 'AUDIO'
  | 'INTERACTIVE';

/**
 * Status of message delivery.
 */
export type MessageStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

/**
 * WhatsApp Message entity.
 *
 * Core domain entity representing a WhatsApp message with full lifecycle tracking.
 * Maintains immutability for historical record and provides state transition methods.
 *
 * @class WhatsAppMessage
 */
export class WhatsAppMessage {
  /**
   * Create a new WhatsApp message.
   *
   * @param id - Unique message ID in ERP system
   * @param conversationId - ID of the conversation this message belongs to
   * @param direction - INBOUND or OUTBOUND
   * @param messageType - Type of message content
   * @param recipientPhone - Phone number receiving the message
   * @param senderPhone - Phone number sending the message
   * @param content - Text content of the message
   * @param status - Current delivery status
   * @param createdAt - Message creation timestamp
   * @param updatedAt - Last update timestamp
   * @param templateName - Name of template used (for TEMPLATE type)
   * @param templateData - Parameters for template rendering
   * @param mediaUrl - URL of media attachment (for media messages)
   * @param mediaType - Type of media (image, pdf, etc.)
   * @param whatsappMessageId - External ID from WhatsApp API
   * @param failureReason - Why delivery failed
   * @param retryCount - Number of retry attempts
   * @param metadata - Additional metadata
   */
  constructor(
    readonly id: string,
    readonly conversationId: string,
    readonly direction: MessageDirection,
    readonly messageType: MessageType,
    readonly recipientPhone: string,
    readonly senderPhone: string,
    readonly content: string,
    private status: MessageStatus,
    readonly createdAt: Date,
    private updatedAt: Date,
    readonly templateName?: string,
    readonly templateData?: Record<string, string>,
    readonly mediaUrl?: string,
    readonly mediaType?: string,
    private whatsappMessageId?: string,
    private failureReason?: string,
    private retryCount: number = 0,
    readonly metadata: Record<string, unknown> = {}
  ) {}

  /**
   * Mark the message as sent.
   * Sets the external WhatsApp message ID from the API.
   *
   * @param externalId - ID from WhatsApp API
   * @throws {Error} If already marked as delivered or read
   */
  markSent(externalId: string): void {
    if (
      this.status === 'DELIVERED' ||
      this.status === 'READ' ||
      this.status === 'SENT'
    ) {
      return; // Idempotent
    }
    this.status = 'SENT';
    this.whatsappMessageId = externalId;
    this.updatedAt = new Date();
  }

  /**
   * Mark the message as delivered to recipient's device.
   *
   * @throws {Error} If message was not sent yet
   */
  markDelivered(): void {
    if (this.status === 'PENDING' || this.status === 'QUEUED') {
      throw new Error('Cannot mark message as delivered before it is sent');
    }
    if (this.status === 'DELIVERED' || this.status === 'READ') {
      return; // Idempotent
    }
    this.status = 'DELIVERED';
    this.updatedAt = new Date();
  }

  /**
   * Mark the message as read by recipient.
   *
   * @throws {Error} If message was not sent yet
   */
  markRead(): void {
    if (this.status === 'PENDING' || this.status === 'QUEUED') {
      throw new Error('Cannot mark message as read before it is sent');
    }
    if (this.status === 'READ') {
      return; // Idempotent
    }
    this.status = 'READ';
    this.updatedAt = new Date();
  }

  /**
   * Mark the message as failed.
   *
   * @param reason - Reason for failure
   */
  markFailed(reason: string): void {
    if (this.status === 'FAILED') {
      return; // Idempotent
    }
    this.status = 'FAILED';
    this.failureReason = reason;
    this.updatedAt = new Date();
  }

  /**
   * Check if message can be retried.
   *
   * Messages can be retried if:
   * - Status is FAILED
   * - Retry count is less than max (3)
   * - Message is not expired (created less than 24 hours ago)
   *
   * @returns True if message can be retried
   */
  canRetry(): boolean {
    if (this.status !== 'FAILED') {
      return false;
    }
    if (this.retryCount >= 3) {
      return false;
    }
    const ageHours =
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
    return ageHours < 24;
  }

  /**
   * Increment retry count.
   * Used before attempting to resend a failed message.
   */
  incrementRetryCount(): void {
    this.retryCount++;
  }

  /**
   * Check if message has expired.
   * Messages expire after 24 hours.
   *
   * @returns True if message has expired
   */
  isExpired(): boolean {
    const ageHours =
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
    return ageHours > 24;
  }

  /**
   * Get display content for the message.
   * Handles template rendering and media descriptions.
   *
   * @returns Human-readable message content
   */
  getDisplayContent(): string {
    if (this.messageType === 'TEMPLATE' && this.templateName) {
      return `[${this.templateName}] ${this.content}`;
    }
    if (this.messageType !== 'TEXT' && this.mediaUrl) {
      return `[${this.messageType}] ${this.content || '(No caption)'}`;
    }
    return this.content;
  }

  /**
   * Get current status.
   * @internal
   */
  getStatus(): MessageStatus {
    return this.status;
  }

  /**
   * Get external WhatsApp message ID.
   * @internal
   */
  getWhatsAppMessageId(): string | undefined {
    return this.whatsappMessageId;
  }

  /**
   * Get failure reason if any.
   * @internal
   */
  getFailureReason(): string | undefined {
    return this.failureReason;
  }

  /**
   * Get retry count.
   * @internal
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get last update timestamp.
   * @internal
   */
  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
