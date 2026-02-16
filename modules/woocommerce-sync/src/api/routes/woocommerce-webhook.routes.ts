/**
 * WooCommerce Webhook Routes
 * Routes for receiving webhook events from WooCommerce
 */

import { Router } from 'express';
import { WooCommerceWebhookController } from '../controllers/WooCommerceWebhookController';
import { authenticate } from '@shared/middleware/auth.middleware';

/**
 * Create webhook routes
 * Note: Webhook endpoints should NOT be authenticated (WooCommerce doesn't support it)
 * but we rate limit to prevent abuse
 */
export function createWooCommerceWebhookRoutes(
  controller: WooCommerceWebhookController
): Router {
  const router = Router();

  // Main webhook endpoint - no authentication required (WooCommerce signature verification used instead)
  router.post('/webhook', (req, res) => controller.handleWebhook(req, res));

  // Health check - no auth required for monitoring
  router.get('/health', (req, res) => controller.healthCheck(req, res));

  // Admin endpoints - require authentication
  router.use(authenticate);

  // Get webhook statistics
  router.get('/stats', (req, res) => controller.getStats(req, res));

  // Get dead letter queue entries
  router.get('/dead-letter', (req, res) => controller.getDeadLetterQueue(req, res));

  // Retry a specific dead letter entry
  router.post('/dead-letter/:id/retry', (req, res) => controller.retryDeadLetter(req, res));

  // Batch retry dead letter entries
  router.post('/dead-letter/batch-retry', (req, res) => controller.batchRetryDeadLetters(req, res));

  return router;
}
