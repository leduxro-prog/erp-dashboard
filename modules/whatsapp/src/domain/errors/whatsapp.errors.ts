/**
 * WhatsApp Module Domain Errors
 *
 * Custom error classes for WhatsApp module business logic.
 * All errors extend BaseError for consistent error handling.
 *
 * @module whatsapp/domain/errors
 */

import { BaseError, BusinessRuleError, ValidationError } from '@shared/errors';

/**
 * Message not deliverable error.
 * Thrown when a message cannot be delivered due to business rules.
 *
 * @extends BusinessRuleError
 */
export class MessageNotDeliverableError extends BusinessRuleError {
  /**
   * Create a MessageNotDeliverableError.
   *
   * @param reason - Why the message cannot be delivered
   */
  constructor(reason: string) {
    super(
      `Message is not deliverable: ${reason}`,
      'MESSAGE_NOT_DELIVERABLE'
    );
  }
}

/**
 * Template not approved error.
 * Thrown when attempting to send a template that hasn't been approved by Meta.
 *
 * @extends BusinessRuleError
 */
export class TemplateNotApprovedError extends BusinessRuleError {
  /**
   * Create a TemplateNotApprovedError.
   *
   * @param templateName - Name of the template
   */
  constructor(templateName: string) {
    super(
      `Template "${templateName}" is not approved by Meta`,
      'TEMPLATE_NOT_APPROVED'
    );
  }
}

/**
 * Conversation closed error.
 * Thrown when attempting to add a message to a resolved/archived conversation.
 *
 * @extends BusinessRuleError
 */
export class ConversationClosedError extends BusinessRuleError {
  /**
   * Create a ConversationClosedError.
   *
   * @param conversationId - ID of the closed conversation
   * @param status - Current status of the conversation
   */
  constructor(conversationId: string | number, status: string) {
    super(
      `Conversation ${conversationId} is ${status} and cannot receive messages`,
      'CONVERSATION_CLOSED'
    );
  }
}

/**
 * Invalid phone number error.
 * Thrown when phone number format is invalid.
 *
 * @extends ValidationError
 */
export class InvalidPhoneError extends ValidationError {
  /**
   * Create an InvalidPhoneError.
   *
   * @param phone - The invalid phone number
   */
  constructor(phone: string) {
    super(
      'Invalid phone number format',
      `Phone "${phone}" does not match WhatsApp format (country code + number)`
    );
  }
}

/**
 * Webhook validation error.
 * Thrown when webhook signature validation fails.
 *
 * @extends ValidationError
 */
export class WebhookValidationError extends ValidationError {
  /**
   * Create a WebhookValidationError.
   */
  constructor() {
    super(
      'Webhook signature validation failed',
      'HMAC SHA256 signature does not match request body'
    );
  }
}

/**
 * Rate limit exceeded error.
 * Thrown when API rate limit is exceeded.
 *
 * @extends BusinessRuleError
 */
export class RateLimitExceededError extends BusinessRuleError {
  /**
   * Create a RateLimitExceededError.
   *
   * @param retryAfterSeconds - Seconds to wait before retrying
   */
  constructor(retryAfterSeconds?: number) {
    const details = retryAfterSeconds
      ? ` Retry after ${retryAfterSeconds} seconds`
      : '';
    super(
      `WhatsApp API rate limit exceeded.${details}`,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

/**
 * Media too large error.
 * Thrown when media file exceeds maximum allowed size.
 *
 * @extends ValidationError
 */
export class MediaTooLargeError extends ValidationError {
  /**
   * Create a MediaTooLargeError.
   *
   * @param mediaType - Type of media (image, document, etc.)
   * @param sizeBytes - Size of the file in bytes
   * @param maxSizeBytes - Maximum allowed size in bytes
   */
  constructor(
    mediaType: string,
    sizeBytes: number,
    maxSizeBytes: number
  ) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    const maxMB = (maxSizeBytes / 1024 / 1024).toFixed(2);
    super(
      `${mediaType} size exceeds maximum allowed`,
      `${sizeMB}MB exceeds limit of ${maxMB}MB`
    );
  }
}

/**
 * Template validation error.
 * Thrown when template structure or parameters are invalid.
 *
 * @extends ValidationError
 */
export class TemplateValidationError extends ValidationError {
  /**
   * Create a TemplateValidationError.
   *
   * @param message - What's wrong with the template
   */
  constructor(message: string) {
    super('Template validation failed', message);
  }
}

/**
 * Message send error.
 * Thrown when WhatsApp API fails to send a message.
 *
 * @extends BaseError
 */
export class MessageSendError extends BaseError {
  /**
   * Create a MessageSendError.
   *
   * @param reason - Why the send failed
   * @param statusCode - HTTP status code from API (default: 500)
   */
  constructor(reason: string, statusCode: number = 500) {
    super(
      `Failed to send WhatsApp message: ${reason}`,
      'MESSAGE_SEND_ERROR',
      statusCode
    );
  }
}

/**
 * Webhook processing error.
 * Thrown when webhook processing fails.
 *
 * @extends BaseError
 */
export class WebhookProcessingError extends BaseError {
  /**
   * Create a WebhookProcessingError.
   *
   * @param message - Error description
   */
  constructor(message: string) {
    super(
      `Webhook processing failed: ${message}`,
      'WEBHOOK_PROCESSING_ERROR',
      500
    );
  }
}
