/**
 * WhatsApp Business API Port Interface
 *
 * Defines the contract for integrating with Meta's WhatsApp Business API.
 * Implementations handle all communication with the external API.
 *
 * @module whatsapp/domain/ports
 */

import { WhatsAppTemplate } from '../entities/WhatsAppTemplate';

/**
 * Request to send a text message.
 */
export interface SendTextMessageRequest {
  phone: string;
  text: string;
}

/**
 * Request to send a template message.
 */
export interface SendTemplateMessageRequest {
  phone: string;
  templateName: string;
  languageCode?: string;
  parameters?: string[];
}

/**
 * Request to send media message.
 */
export interface SendMediaMessageRequest {
  phone: string;
  mediaType: 'image' | 'document' | 'video' | 'audio';
  mediaUrl: string;
  caption?: string;
}

/**
 * Response from message send operation.
 */
export interface MessageSendResponse {
  messageId: string;
  status: 'queued' | 'sent' | 'failed';
  timestamp: Date;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Template status update from API.
 */
export interface TemplateStatusUpdate {
  templateId: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  rejectionReason?: string;
}

/**
 * WhatsApp Business API Port.
 *
 * Port interface for external WhatsApp API integration.
 * Implementations must handle:
 * - Token authentication
 * - Rate limiting (80 msg/sec)
 * - Circuit breaker for resilience
 * - Retry logic for transient failures
 *
 * @interface IWhatsAppBusinessApi
 */
export interface IWhatsAppBusinessApi {
  /**
   * Send a text message.
   *
   * @param request - Message request
   * @returns Promise resolving to send response
   * @throws {RateLimitExceededError} If API rate limit exceeded
   * @throws {MessageSendError} If send fails
   * @throws {ServiceUnavailableError} If API unavailable
   */
  sendTextMessage(request: SendTextMessageRequest): Promise<MessageSendResponse>;

  /**
   * Send a template message.
   * Template must be approved by Meta.
   *
   * @param request - Template message request
   * @returns Promise resolving to send response
   * @throws {TemplateNotApprovedError} If template not approved
   * @throws {RateLimitExceededError} If API rate limit exceeded
   * @throws {MessageSendError} If send fails
   * @throws {ServiceUnavailableError} If API unavailable
   */
  sendTemplateMessage(
    request: SendTemplateMessageRequest
  ): Promise<MessageSendResponse>;

  /**
   * Send a media message (image, document, video, audio).
   *
   * @param request - Media message request
   * @returns Promise resolving to send response
   * @throws {MediaTooLargeError} If media exceeds size limit
   * @throws {RateLimitExceededError} If API rate limit exceeded
   * @throws {MessageSendError} If send fails
   * @throws {ServiceUnavailableError} If API unavailable
   */
  sendMediaMessage(request: SendMediaMessageRequest): Promise<MessageSendResponse>;

  /**
   * Get template status from Meta API.
   * Checks if template is approved and ready to use.
   *
   * @param templateName - Name of the template
   * @param languageCode - Language code (ro, en)
   * @returns Promise resolving to status update
   * @throws {Error} If template not found or API error
   */
  getTemplateStatus(
    templateName: string,
    languageCode: string
  ): Promise<TemplateStatusUpdate>;

  /**
   * Mark a message as read on the recipient's device.
   *
   * @param messageId - External message ID from WhatsApp
   * @returns Promise resolving when marked as read
   * @throws {Error} If message not found or API error
   */
  markMessageRead(messageId: string): Promise<void>;

  /**
   * Upload media to WhatsApp's media storage.
   * Used for media messages.
   *
   * @param mediaType - Type of media
   * @param mediaBuffer - Binary content of the media
   * @param mimeType - MIME type of the media
   * @returns Promise resolving to media URL
   * @throws {MediaTooLargeError} If media exceeds size limit
   * @throws {Error} If upload fails
   */
  uploadMedia(
    mediaType: string,
    mediaBuffer: Buffer,
    mimeType: string
  ): Promise<string>;

  /**
   * Check current API health and rate limit status.
   *
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<{
    healthy: boolean;
    rateLimitRemaining: number;
    rateLimitReset: Date;
  }>;

  /**
   * Get current connection status.
   *
   * @returns Promise resolving to connection status
   */
  getConnectionStatus(): Promise<{
    connected: boolean;
    phoneNumber?: string;
    status: 'connected' | 'disconnected' | 'connecting' | 'needs_authentication';
    lastConnectedAt?: Date;
  }>;

  /**
   * Generate QR code for WhatsApp pairing.
   *
   * @param force - Force new QR code even if already connected
   * @returns Promise resolving to QR code and expiry
   */
  generateQRCode(force?: boolean): Promise<{
    qrCode?: string;
    expiresIn?: number;
  }>;

  /**
   * Disconnect from WhatsApp Business API.
   *
   * @returns Promise resolving when disconnected
   */
  disconnect(): Promise<void>;
}
