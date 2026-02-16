/**
 * Centralized webhook handler for incoming API callbacks.
 *
 * Manages webhook signatures validation, deduplication, delivery tracking,
 * and dead letter queue for failed deliveries.
 *
 * Supports webhooks from multiple API sources (SmartBill, WooCommerce, etc.)
 * with source-specific signature validation strategies.
 *
 * @module shared/api/webhook-manager
 */

import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('webhook-manager');

/**
 * Webhook result after processing.
 *
 * @interface WebhookResult
 */
export interface WebhookResult {
  /** Whether webhook was successfully processed */
  success: boolean;
  /** Webhook unique identifier */
  webhookId: string;
  /** Source API name */
  source: string;
  /** HTTP status code to return */
  statusCode: number;
  /** Processing message */
  message: string;
  /** Error details if processing failed */
  error?: string;
}

/**
 * Webhook handler function signature.
 *
 * @type WebhookHandler
 */
export type WebhookHandler = (
  data: unknown,
  source: string,
  webhookId: string
) => Promise<void>;

/**
 * Webhook validation configuration.
 *
 * @interface WebhookValidation
 */
export interface WebhookValidation {
  /** Header name containing signature */
  signatureHeader: string;
  /** Secret key for HMAC validation */
  secret: string;
  /** Algorithm for hashing (default: sha256) */
  algorithm?: string;
  /** Whether to validate timestamp (default: true) */
  validateTimestamp?: boolean;
  /** Max age of webhook in seconds (default: 300) */
  maxAge?: number;
}

/**
 * Dead letter webhook entry.
 *
 * @interface DeadLetterEntry
 */
export interface DeadLetterEntry {
  /** Webhook unique ID */
  webhookId: string;
  /** Source API */
  source: string;
  /** Webhook payload */
  payload: unknown;
  /** Error message */
  error: string;
  /** Attempt count */
  attempts: number;
  /** First failed timestamp */
  failedAt: Date;
  /** Last retry timestamp */
  lastRetryAt?: Date;
}

/**
 * Webhook Manager for handling incoming API callbacks.
 *
 * Features:
 * - Signature validation (HMAC-SHA256, etc.)
 * - Idempotency via deduplication
 * - Delivery retry tracking
 * - Dead letter queue for failed webhooks
 * - Express middleware integration
 * - Per-source handler registration
 *
 * @example
 * const webhookManager = new WebhookManager();
 *
 * // Register SmartBill webhook handler
 * webhookManager.registerHandler('smartbill', async (data, source, id) => {
 *   await processSmartBillWebhook(data);
 * });
 *
 * // Register validation config
 * webhookManager.registerValidation('smartbill', {
 *   signatureHeader: 'X-SmartBill-Signature',
 *   secret: process.env.SMARTBILL_WEBHOOK_SECRET,
 * });
 *
 * // Use as Express middleware
 * app.post('/webhooks/:source', webhookManager.middleware());
 */
export class WebhookManager {
  private readonly handlers: Map<string, WebhookHandler> = new Map();
  private readonly validations: Map<string, WebhookValidation> = new Map();
  private readonly processedWebhooks: Map<string, number> = new Map(); // webhookId -> timestamp
  private readonly deadLetterQueue: DeadLetterEntry[] = [];
  private readonly maxDeadLetters = 1000;
  private readonly deduplicationWindow = 3600000; // 1 hour in ms

  /**
   * Register a webhook handler for a source.
   *
   * @param source - Source API name (e.g., 'smartbill', 'woocommerce')
   * @param handler - Async handler function
   *
   * @example
   * webhookManager.registerHandler('smartbill', async (data, source, id) => {
   *   const invoice = data as SmartBillInvoice;
   *   await saveInvoice(invoice);
   * });
   */
  registerHandler(source: string, handler: WebhookHandler): void {
    this.handlers.set(source, handler);

    logger.info('Webhook handler registered', {
      source,
    });
  }

  /**
   * Register webhook signature validation config for a source.
   *
   * @param source - Source API name
   * @param validation - Validation configuration
   *
   * @example
   * webhookManager.registerValidation('smartbill', {
   *   signatureHeader: 'X-SmartBill-Signature',
   *   secret: process.env.SMARTBILL_WEBHOOK_SECRET,
   *   algorithm: 'sha256',
   *   validateTimestamp: true,
   *   maxAge: 300,
   * });
   */
  registerValidation(source: string, validation: WebhookValidation): void {
    this.validations.set(source, {
      algorithm: 'sha256',
      validateTimestamp: true,
      maxAge: 300,
      ...validation,
    });

    logger.info('Webhook validation registered', {
      source,
      algorithm: validation.algorithm || 'sha256',
    });
  }

  /**
   * Validate webhook signature.
   *
   * Supports HMAC-based signature validation. Checks both signature
   * and timestamp (if configured).
   *
   * @param source - Source API name
   * @param payload - Raw request body
   * @param signature - Signature from header
   * @param timestamp - Timestamp from header (optional)
   * @returns true if valid, false otherwise
   *
   * @internal
   */
  private validateSignature(
    source: string,
    payload: string | Buffer,
    signature: string,
    timestamp?: string
  ): boolean {
    const validation = this.validations.get(source);
    if (!validation) {
      logger.warn('No validation config for webhook source', { source });
      return false;
    }

    // Validate timestamp if configured
    if (validation.validateTimestamp && timestamp) {
      const webhookTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const age = currentTime - webhookTime;

      if (age > validation.maxAge!) {
        logger.warn('Webhook timestamp too old', {
          source,
          age,
          maxAge: validation.maxAge,
        });
        return false;
      }
    }

    // Compute signature
    const payloadString = typeof payload === 'string' ? payload : payload.toString();
    const message = timestamp ? `${timestamp}.${payloadString}` : payloadString;

    const computed = crypto
      .createHmac(validation.algorithm || 'sha256', validation.secret)
      .update(message)
      .digest('hex');

    const valid = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));

    if (!valid) {
      logger.warn('Webhook signature validation failed', {
        source,
        provided: signature.substring(0, 10) + '...',
      });
    }

    return valid;
  }

  /**
   * Check if webhook has been processed (deduplication).
   *
   * Prevents processing duplicate webhook deliveries.
   *
   * @param webhookId - Webhook unique ID
   * @returns true if already processed
   *
   * @internal
   */
  private isDuplicate(webhookId: string): boolean {
    const timestamp = this.processedWebhooks.get(webhookId);

    if (!timestamp) {
      return false;
    }

    const age = Date.now() - timestamp;
    const isDup = age < this.deduplicationWindow;

    if (isDup) {
      logger.debug('Webhook duplicate detected', {
        webhookId,
        age: age / 1000,
      });
    }

    return isDup;
  }

  /**
   * Mark webhook as processed.
   *
   * @param webhookId - Webhook unique ID
   *
   * @internal
   */
  private markProcessed(webhookId: string): void {
    this.processedWebhooks.set(webhookId, Date.now());

    // Clean old entries
    const cutoff = Date.now() - this.deduplicationWindow;
    const entries = Array.from(this.processedWebhooks.entries());
    for (const [id, time] of entries) {
      if (time < cutoff) {
        this.processedWebhooks.delete(id);
      }
    }
  }

  /**
   * Add webhook to dead letter queue.
   *
   * @param entry - Dead letter entry
   *
   * @internal
   */
  private addToDeadLetterQueue(entry: DeadLetterEntry): void {
    this.deadLetterQueue.push(entry);

    // Maintain size limit
    while (this.deadLetterQueue.length > this.maxDeadLetters) {
      this.deadLetterQueue.shift();
    }

    logger.warn('Webhook added to dead letter queue', {
      webhookId: entry.webhookId,
      source: entry.source,
      error: entry.error,
    });
  }

  /**
   * Process an incoming webhook.
   *
   * Validates signature, checks for duplicates, executes handler,
   * and manages dead letter queue on failure.
   *
   * @param request - Express request object
   * @returns Webhook processing result
   *
   * @example
   * const result = await webhookManager.handleWebhook(req);
   * res.status(result.statusCode).json({ success: result.success });
   */
  async handleWebhook(request: Request): Promise<WebhookResult> {
    const source = (request.params as { source: string }).source || 'unknown';

    try {
      // Get webhook ID from request
      const webhookId =
        (request.headers['x-webhook-id'] as string) ||
        (request.headers['x-delivery-id'] as string) ||
        crypto.randomUUID();

      // Check deduplication
      if (this.isDuplicate(webhookId)) {
        return {
          success: true,
          webhookId,
          source,
          statusCode: 200,
          message: 'Webhook already processed (duplicate)',
        };
      }

      // Get handler for source
      const handler = this.handlers.get(source);
      if (!handler) {
        return {
          success: false,
          webhookId,
          source,
          statusCode: 400,
          message: `No handler registered for source: ${source}`,
        };
      }

      // Get raw body for signature validation
      const rawBody = (request as any).rawBody || JSON.stringify(request.body);

      // Validate signature if configured
      const validation = this.validations.get(source);
      if (validation) {
        const signature = request.headers[validation.signatureHeader.toLowerCase()] as string;
        const timestamp = request.headers['x-webhook-timestamp'] as string;

        if (!signature) {
          logger.warn('Webhook missing signature', {
            source,
            webhookId,
            expected: validation.signatureHeader,
          });

          return {
            success: false,
            webhookId,
            source,
            statusCode: 401,
            message: 'Missing webhook signature',
          };
        }

        if (!this.validateSignature(source, rawBody, signature, timestamp)) {
          return {
            success: false,
            webhookId,
            source,
            statusCode: 401,
            message: 'Invalid webhook signature',
          };
        }
      }

      // Execute handler
      try {
        await handler(request.body, source, webhookId);
        this.markProcessed(webhookId);

        logger.info('Webhook processed successfully', {
          webhookId,
          source,
        });

        return {
          success: true,
          webhookId,
          source,
          statusCode: 200,
          message: 'Webhook processed',
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Add to dead letter queue
        this.addToDeadLetterQueue({
          webhookId,
          source,
          payload: request.body,
          error: errorMsg,
          attempts: 1,
          failedAt: new Date(),
        });

        logger.error('Webhook handler error', {
          webhookId,
          source,
          error: errorMsg,
        });

        return {
          success: false,
          webhookId,
          source,
          statusCode: 500,
          message: 'Webhook processing failed',
          error: errorMsg,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error('Webhook processing error', {
        source,
        error: errorMsg,
      });

      return {
        success: false,
        webhookId: 'unknown',
        source,
        statusCode: 500,
        message: 'Internal error processing webhook',
        error: errorMsg,
      };
    }
  }

  /**
   * Express middleware for webhook handling.
   *
   * Automatically parses JSON, handles webhook processing,
   * and sends appropriate responses.
   *
   * @returns Express middleware function
   *
   * @example
   * app.post('/webhooks/:source', webhookManager.middleware());
   */
  middleware() {
    return async (request: Request, response: Response): Promise<void> => {
      const result = await this.handleWebhook(request);

      response.status(result.statusCode).json({
        success: result.success,
        message: result.message,
        webhookId: result.webhookId,
      });
    };
  }

  /**
   * Get dead letter queue entries.
   *
   * @returns Array of failed webhooks
   *
   * @example
   * const failed = webhookManager.getDeadLetters();
   * for (const entry of failed) {
   *   console.log(`${entry.source}: ${entry.error}`);
   * }
   */
  getDeadLetters(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Get dead letter entries for a specific source.
   *
   * @param source - Source API name
   * @returns Failed webhooks from that source
   */
  getDeadLettersBySource(source: string): DeadLetterEntry[] {
    return this.deadLetterQueue.filter((e) => e.source === source);
  }

  /**
   * Retry a dead letter webhook.
   *
   * Attempts to reprocess a failed webhook.
   *
   * @param webhookId - Webhook to retry
   * @returns true if retry succeeded
   *
   * @example
   * const success = await webhookManager.retryDeadLetter(webhookId);
   */
  async retryDeadLetter(webhookId: string): Promise<boolean> {
    const entry = this.deadLetterQueue.find((e) => e.webhookId === webhookId);
    if (!entry) {
      return false;
    }

    const handler = this.handlers.get(entry.source);
    if (!handler) {
      return false;
    }

    try {
      await handler(entry.payload, entry.source, webhookId);
      entry.attempts++;
      entry.lastRetryAt = new Date();

      logger.info('Dead letter webhook retried successfully', {
        webhookId,
        source: entry.source,
        attempts: entry.attempts,
      });

      return true;
    } catch (error) {
      entry.attempts++;
      entry.lastRetryAt = new Date();
      entry.error = error instanceof Error ? error.message : String(error);

      logger.warn('Dead letter webhook retry failed', {
        webhookId,
        source: entry.source,
        attempts: entry.attempts,
        error: entry.error,
      });

      return false;
    }
  }

  /**
   * Clear dead letter queue.
   *
   * @example
   * webhookManager.clearDeadLetters();
   */
  clearDeadLetters(): void {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue.length = 0;

    logger.info('Dead letter queue cleared', { count });
  }

  /**
   * Get webhook manager statistics.
   *
   * @returns Statistics object
   */
  getStats() {
    return {
      processedWebhooks: this.processedWebhooks.size,
      deadLetterCount: this.deadLetterQueue.length,
      handlersCount: this.handlers.size,
      validationsCount: this.validations.size,
    };
  }
}

export default WebhookManager;
