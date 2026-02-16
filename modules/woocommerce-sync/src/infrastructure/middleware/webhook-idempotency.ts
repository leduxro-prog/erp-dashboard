/**
 * WooCommerce Webhook Idempotency Middleware
 *
 * Prevents duplicate processing of WooCommerce webhooks using the
 * woocommerce_webhook_logs table. Checks webhook_id (from X-WC-Webhook-Delivery-ID
 * header) against DB before allowing processing.
 *
 * Works with the existing WebhookEventLogEntity infrastructure.
 */

import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import crypto from 'crypto';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('woo-webhook-idempotency');

/**
 * Configuration for webhook idempotency
 */
export interface WebhookIdempotencyConfig {
  /** DataSource for DB access */
  dataSource: DataSource;
  /** WooCommerce webhook secret for HMAC verification */
  webhookSecret?: string;
  /** Maximum age (ms) for idempotency keys (default: 7 days) */
  ttlMs?: number;
}

/**
 * Creates Express middleware that:
 * 1. Verifies WooCommerce webhook HMAC signature
 * 2. Extracts the delivery ID from X-WC-Webhook-Delivery-ID header
 * 3. Checks if this delivery was already processed (idempotency guard)
 * 4. If new, inserts a PENDING record and lets the request through
 * 5. After handler completes, marks as COMPLETED or FAILED
 */
export function createWebhookIdempotencyMiddleware(config: WebhookIdempotencyConfig) {
  const { dataSource, webhookSecret } = config;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const deliveryId = req.headers['x-wc-webhook-delivery-id'] as string;
    const topic = (req.headers['x-wc-webhook-topic'] as string) || 'unknown';
    const signature = req.headers['x-wc-webhook-signature'] as string;

    // Generate a fallback webhook_id from payload hash if no delivery ID header
    const webhookId = deliveryId || generatePayloadHash(req.body, topic);

    // 1. Verify HMAC signature if secret is configured
    if (webhookSecret && signature) {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody, 'utf8')
        .digest('base64');

      if (signature !== expectedSig) {
        logger.warn('Webhook HMAC signature mismatch', { webhookId, topic });
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    // 2. Check idempotency - has this webhook been processed before?
    try {
      const existing = await dataSource.query(
        `SELECT id, status FROM woocommerce_webhook_logs WHERE webhook_id = $1 LIMIT 1`,
        [webhookId],
      );

      if (existing.length > 0) {
        const record = existing[0];
        if (record.status === 'completed' || record.status === 'processing') {
          logger.info('Duplicate webhook detected, skipping', {
            webhookId,
            topic,
            existingStatus: record.status,
          });
          res.status(200).json({
            status: 'already_processed',
            webhook_id: webhookId,
          });
          return;
        }
        // If status is 'failed' or 'dead_letter', allow retry
        logger.info('Retrying previously failed webhook', {
          webhookId,
          topic,
          previousStatus: record.status,
        });
      }

      // 3. Insert or update webhook log as PROCESSING
      await dataSource.query(
        `INSERT INTO woocommerce_webhook_logs
           (webhook_id, topic, payload, status, signature_verified, retry_count)
         VALUES ($1, $2, $3, 'processing', $4, 0)
         ON CONFLICT (webhook_id) DO UPDATE SET
           status = 'processing',
           retry_count = woocommerce_webhook_logs.retry_count + 1,
           last_retry_at = NOW()`,
        [webhookId, topic, JSON.stringify(req.body), !!(webhookSecret && signature)],
      );

      // Attach webhook metadata to request for downstream use
      (req as any).webhookMeta = {
        webhookId,
        topic,
        signatureVerified: !!(webhookSecret && signature),
      };

      // 4. Proceed to handler
      // We wrap the response to capture success/failure
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        // Mark as completed on successful response
        const statusCode = res.statusCode;
        const finalStatus = statusCode >= 200 && statusCode < 400 ? 'completed' : 'failed';

        dataSource
          .query(
            `UPDATE woocommerce_webhook_logs
           SET status = $1, processed_at = NOW(), error_message = $2
           WHERE webhook_id = $3`,
            [finalStatus, finalStatus === 'failed' ? JSON.stringify(body) : null, webhookId],
          )
          .catch((err: Error) => {
            logger.error('Failed to update webhook log status', {
              webhookId,
              error: err.message,
            });
          });

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Webhook idempotency check failed', {
        webhookId,
        topic,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fail open - allow processing but log the error
      next();
    }
  };
}

/**
 * Generate a deterministic hash from webhook payload for deduplication
 * when X-WC-Webhook-Delivery-ID header is missing
 */
function generatePayloadHash(payload: any, topic: string): string {
  const content = JSON.stringify({ topic, id: payload?.id, date: payload?.date_modified });
  return `hash_${crypto.createHash('sha256').update(content).digest('hex').substring(0, 32)}`;
}
