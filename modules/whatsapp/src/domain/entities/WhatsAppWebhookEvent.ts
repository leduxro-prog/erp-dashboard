/**
 * WhatsApp Webhook Event Domain Entity
 *
 * Represents an incoming webhook event from Meta WhatsApp Business API.
 * Ensures idempotent processing with deduplication by idempotency key.
 *
 * @module whatsapp/domain/entities
 */

/**
 * Type of webhook event from Meta.
 */
export type WebhookEventType =
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_STATUS'
  | 'TEMPLATE_STATUS';

/**
 * WhatsApp Webhook Event entity.
 *
 * Core domain entity representing an incoming webhook event.
 * Handles idempotent processing to prevent duplicate handling.
 *
 * @class WhatsAppWebhookEvent
 */
export class WhatsAppWebhookEvent {
  /**
   * Create a new webhook event.
   *
   * @param id - Unique event ID in ERP system
   * @param eventType - Type of event (MESSAGE_RECEIVED, MESSAGE_STATUS, etc.)
   * @param payload - Event payload from Meta API
   * @param idempotencyKey - Unique key for deduplication (Meta's message_id)
   * @param createdAt - Event received timestamp
   * @param processedAt - When event was processed (optional)
   * @param processingError - Error if processing failed (optional)
   */
  constructor(
    readonly id: string,
    readonly eventType: WebhookEventType,
    readonly payload: Record<string, unknown>,
    readonly messageId: string, // Was idempotencyKey
    readonly createdAt: Date,
    private processedAt?: Date,
    private processingError?: string,
    private retryCount: number = 0
  ) { }

  /**
   * Check if this event has been processed.
   *
   * @returns True if event was successfully processed
   */
  isProcessed(): boolean {
    return this.processedAt !== undefined && this.processingError === undefined;
  }

  /**
   * Mark this event as successfully processed.
   */
  markProcessed(): void {
    if (this.isProcessed()) {
      return; // Idempotent
    }
    this.processedAt = new Date();
    this.processingError = undefined;
  }

  /**
   * Mark this event as failed during processing.
   *
   * @param error - Error message describing the failure
   */
  markFailed(error: string): void {
    this.processedAt = new Date();
    this.processingError = error;
  }

  /**
   * Get processing status.
   *
   * @returns 'pending' | 'processed' | 'failed'
   */
  getStatus(): 'pending' | 'processed' | 'failed' {
    if (!this.processedAt) {
      return 'pending';
    }
    return this.processingError ? 'failed' : 'processed';
  }

  /**
   * Get processing error if any.
   * @internal
   */
  getProcessingError(): string | undefined {
    return this.processingError;
  }

  /**
   * Get processed timestamp.
   * @internal
   */
  getProcessedAt(): Date | undefined {
    return this.processedAt;
  }

  /**
   * Get specific data from payload.
   *
   * @param path - Dot-separated path (e.g., 'messages[0].text.body')
   * @returns Value at path or undefined
   */
  getPayloadValue(path: string): unknown {
    const keys = path.split('.');
    let current: unknown = this.payload;

    for (const key of keys) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }

      // Handle array notation: "messages[0]"
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);
        const array = (current as Record<string, unknown>)[arrayKey];
        if (Array.isArray(array)) {
          current = array[index];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[key];
      }
    }

    return current;
  }


  /**
   * Get retry count.
   * @internal
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Increment retry count.
   */
  incrementRetry(): void {
    this.retryCount++;
  }
}
