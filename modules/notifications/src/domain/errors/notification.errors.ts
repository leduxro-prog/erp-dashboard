/**
 * Notification Domain Errors
 * Custom error classes for notification module
 */
import { BaseError } from '@shared/errors/BaseError';

/**
 * Thrown when a template is not found
 * HTTP 404
 */
export class TemplateNotFoundError extends BaseError {
  constructor(templateIdOrSlug: string) {
    super(
      `Notification template not found: ${templateIdOrSlug}`,
      'TEMPLATE_NOT_FOUND',
      404
    );
  }
}

/**
 * Thrown when notification channel is invalid
 * HTTP 400
 */
export class InvalidChannelError extends BaseError {
  constructor(channel: string) {
    super(
      `Invalid notification channel: ${channel}. Allowed: EMAIL, SMS, WHATSAPP, IN_APP, PUSH`,
      'INVALID_CHANNEL',
      400
    );
  }
}

/**
 * Thrown when recipient is not found or invalid
 * HTTP 400
 */
export class RecipientNotFoundError extends BaseError {
  constructor(recipientId: string, context?: string) {
    const message = context
      ? `Recipient not found: ${recipientId} (${context})`
      : `Recipient not found: ${recipientId}`;
    super(message, 'RECIPIENT_NOT_FOUND', 400);
  }
}

/**
 * Thrown when notification would be sent during quiet hours
 * HTTP 422 (Business Rule)
 */
export class QuietHoursError extends BaseError {
  constructor(recipientId: string, channel: string) {
    super(
      `Cannot send ${channel} notification to ${recipientId} during quiet hours`,
      'QUIET_HOURS_VIOLATION',
      422
    );
  }
}

/**
 * Thrown when notification has exceeded max retry attempts
 * HTTP 422 (Business Rule)
 */
export class MaxRetriesExceededError extends BaseError {
  constructor(notificationId: string, maxRetries: number) {
    super(
      `Notification ${notificationId} has exceeded max retries (${maxRetries})`,
      'MAX_RETRIES_EXCEEDED',
      422
    );
  }
}

/**
 * Thrown when template rendering fails
 * HTTP 400
 */
export class TemplateRenderError extends BaseError {
  constructor(templateId: string, reason: string) {
    super(
      `Failed to render template ${templateId}: ${reason}`,
      'TEMPLATE_RENDER_ERROR',
      400
    );
  }
}

/**
 * Thrown when template validation fails
 * HTTP 400
 */
export class TemplateValidationError extends BaseError {
  constructor(templateId: string, reason: string) {
    super(
      `Template ${templateId} validation failed: ${reason}`,
      'TEMPLATE_VALIDATION_ERROR',
      400
    );
  }
}

/**
 * Thrown when preference is not found
 * HTTP 404
 */
export class PreferenceNotFoundError extends BaseError {
  constructor(customerId: string, channel: string) {
    super(
      `Notification preference not found for customer ${customerId} on channel ${channel}`,
      'PREFERENCE_NOT_FOUND',
      404
    );
  }
}

/**
 * Thrown when notification status transition is invalid
 * HTTP 422 (Business Rule)
 */
export class InvalidStatusTransitionError extends BaseError {
  constructor(
    notificationId: string,
    currentStatus: string,
    attemptedStatus: string
  ) {
    super(
      `Invalid status transition for notification ${notificationId}: ${currentStatus} -> ${attemptedStatus}`,
      'INVALID_STATUS_TRANSITION',
      422
    );
  }
}

/**
 * Thrown when batch operation fails
 * HTTP 400
 */
export class BatchOperationError extends BaseError {
  constructor(batchId: string, reason: string) {
    super(
      `Batch operation failed for batch ${batchId}: ${reason}`,
      'BATCH_OPERATION_ERROR',
      400
    );
  }
}

/**
 * Thrown when notification is expired
 * HTTP 422 (Business Rule)
 */
export class NotificationExpiredError extends BaseError {
  constructor(notificationId: string) {
    super(
      `Notification ${notificationId} has expired and can no longer be processed`,
      'NOTIFICATION_EXPIRED',
      422
    );
  }
}
