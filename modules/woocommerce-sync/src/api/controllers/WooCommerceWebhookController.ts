/**
 * WooCommerce Webhook Controller
 * Handles real webhook intake from WooCommerce for orders, products, and customers.
 */

import { Request, Response } from 'express';
import { WebhookReliabilityService } from '../../application/services/WebhookReliabilityService';
import { WebhookEventTransformer } from '../../application/transformers/WebhookEventTransformer';
import { OutboxEventPublisher } from '../../infrastructure/outbox/OutboxEventPublisher';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('woocommerce-webhook-controller');

/**
 * WooCommerce webhook payload structure
 */
interface WooCommerceWebhookHeaders {
  'x-wc-webhook-signature'?: string;
  'x-wc-webhook-id'?: string;
  'x-wc-webhook-topic'?: string;
  'x-wc-webhook-delivery-id'?: string;
  'x-wc-webhook-resource'?: string;
  'x-wc-webhook-event'?: string;
  'x-wc-webhook-timestamp'?: string;
}

/**
 * Supported WooCommerce webhook topics
 */
enum WooCommerceWebhookTopic {
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_DELETED = 'order.deleted',
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRODUCT_DELETED = 'product.deleted',
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
  CUSTOMER_DELETED = 'customer.deleted',
}

/**
 * Controller for handling WooCommerce webhooks
 */
export class WooCommerceWebhookController {
  constructor(
    private webhookReliabilityService: WebhookReliabilityService,
    private eventTransformer: WebhookEventTransformer,
    private outboxPublisher: OutboxEventPublisher
  ) {}

  /**
   * Main webhook handler endpoint
   * Receives all webhook events from WooCommerce
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Extract headers
      const headers = req.headers as unknown as WooCommerceWebhookHeaders;
      const signature = headers['x-wc-webhook-signature'] || '';
      const webhookId = headers['x-wc-webhook-id'] || headers['x-wc-webhook-delivery-id'] || this.generateDeliveryId();
      const topic = headers['x-wc-webhook-topic'] || headers['x-wc-webhook-event'] || '';
      const timestamp = headers['x-wc-webhook-timestamp'] || String(Date.now());

      // Validate topic
      if (!this.isValidTopic(topic)) {
        logger.warn('Received unsupported webhook topic', { topic, webhookId });
        res.status(200).json({ message: 'Topic not handled', ignored: true });
        return;
      }

      logger.info('Received WooCommerce webhook', {
        webhookId,
        topic,
        timestamp,
        ip: req.ip,
      });

      // Get raw body for signature verification
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      // Verify and process webhook with reliability service
      const result = await this.webhookReliabilityService.processWebhook(
        rawBody,
        signature,
        webhookId,
        topic,
        async (payload) => {
          // Transform to ERP domain event
          const domainEvent = this.eventTransformer.transform(topic, payload, webhookId);

          // Publish to outbox for unified replay
          if (domainEvent) {
            await this.outboxPublisher.publish(domainEvent);
            logger.info('ERP domain event published to outbox', {
              eventType: domainEvent.event_type,
              sourceEntityId: domainEvent.source_entity_id,
              wooWebhookId: webhookId,
            });
          } else {
            logger.warn('Event transformation returned null', { topic });
          }
        }
      );

      const duration = Date.now() - startTime;

      if (result.success) {
        if (result.isDuplicate) {
          logger.info('Duplicate webhook detected, ignoring', { webhookId, topic });
          res.status(200).json({ message: 'Duplicate, already processed', ignored: true, duration });
        } else {
          logger.info('Webhook processed successfully', {
            webhookId,
            topic,
            webhookLogId: result.webhookLogId,
            duration,
          });
          res.status(200).json({
            message: 'Webhook processed successfully',
            webhookLogId: result.webhookLogId,
            duration,
          });
        }
      } else {
        logger.error('Webhook processing failed', {
          webhookId,
          topic,
          error: result.error,
          duration,
        });
        res.status(202).json({
          message: 'Webhook accepted but processing failed',
          error: result.error,
          webhookLogId: result.webhookLogId,
          duration,
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('Unexpected error in webhook handler', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration,
      });

      // Always return 200 to WooCommerce to avoid redelivery loops
      // The error is logged and will be retried via internal mechanism
      res.status(200).json({
        message: 'Webhook received with error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Health check endpoint for webhook monitoring
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      service: 'woocommerce-webhook-controller',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get webhook statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.webhookReliabilityService.getStatistics();

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to get webhook statistics', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get dead letter queue entries
   */
  async getDeadLetterQueue(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0 } = req.query;

      const deadLetterEntries = await this.webhookReliabilityService.getDeadLetterWebhooks(
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.status(200).json({
        success: true,
        data: deadLetterEntries,
        count: deadLetterEntries.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to get dead letter queue', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retry a dead letter webhook entry
   */
  async retryDeadLetter(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Webhook log ID is required',
        });
        return;
      }

      const success = await this.webhookReliabilityService.retryDeadLetterWebhook(id);

      if (success) {
        logger.info('Dead letter webhook queued for retry', { id });
        res.status(200).json({
          success: true,
          message: 'Webhook queued for retry',
          id,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Dead letter webhook not found',
          id,
        });
      }
    } catch (error: any) {
      logger.error('Failed to retry dead letter webhook', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Batch retry dead letter webhooks
   */
  async batchRetryDeadLetters(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Array of webhook log IDs is required',
        });
        return;
      }

      const results = await this.webhookReliabilityService.batchRetryDeadLetterWebhooks(ids);

      res.status(200).json({
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to batch retry dead letter webhooks', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate webhook topic
   */
  private isValidTopic(topic: string): boolean {
    return Object.values(WooCommerceWebhookTopic).includes(topic as WooCommerceWebhookTopic);
  }

  /**
   * Generate a delivery ID if not provided by WooCommerce
   */
  private generateDeliveryId(): string {
    return `wc-delivery-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
