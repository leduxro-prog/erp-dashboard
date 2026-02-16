/**
 * Webhook Composition Root
 * Orchestrates webhook intake, transformation, outbox publishing, retry, and DLQ
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { WebhookReliabilityService } from '../application/services/WebhookReliabilityService';
import { WebhookEventTransformer } from '../application/transformers/WebhookEventTransformer';
import { OutboxEventPublisher } from './outbox/OutboxEventPublisher';
import { WebhookRetryWorker } from './workers/WebhookRetryWorker';
import { DeadLetterQueueManager } from './dlq/DeadLetterQueueManager';
import { WooCommerceWebhookController } from '../api/controllers/WooCommerceWebhookController';
import { createWooCommerceWebhookRoutes } from '../api/routes/woocommerce-webhook.routes';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('webhook-composition-root');

/**
 * Composition context containing all required components
 */
export interface WebhookCompositionContext {
  router: Router;
  webhookReliabilityService: WebhookReliabilityService;
  eventTransformer: WebhookEventTransformer;
  outboxPublisher: OutboxEventPublisher;
  retryWorker: WebhookRetryWorker;
  dlqManager: DeadLetterQueueManager;
}

/**
 * Create and configure the webhook composition root
 */
export async function createWebhookComposition(
  dataSource: DataSource,
): Promise<WebhookCompositionContext> {
  logger.info('Creating webhook composition root');

  // 1. Create webhook reliability service
  const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';
  const webhookReliabilityService = new WebhookReliabilityService(dataSource, webhookSecret);

  logger.info('WebhookReliabilityService created', {
    hasSecret: !!webhookSecret,
  });

  // 2. Create event transformer
  const eventTransformer = new WebhookEventTransformer();
  logger.info('WebhookEventTransformer created');

  // 3. Create outbox publisher
  const outboxPublisher = new OutboxEventPublisher();
  await outboxPublisher.initialize();
  logger.info('OutboxEventPublisher initialized');

  // 4. Create retry worker
  const retryWorker = new WebhookRetryWorker(
    webhookReliabilityService,
    eventTransformer,
    outboxPublisher,
    {
      enabled: process.env.WOO_RETRY_ENABLED !== 'false',
      cronPattern: process.env.WOO_RETRY_CRON || '*/1 * * * *',
      batchSize: parseInt(process.env.WOO_RETRY_BATCH_SIZE || '50', 10),
      maxConcurrentRetries: parseInt(process.env.WOO_RETRY_CONCURRENCY || '10', 10),
    },
  );
  logger.info('WebhookRetryWorker created');

  // 5. Create DLQ manager
  const dlqManager = new DeadLetterQueueManager(dataSource);
  logger.info('DeadLetterQueueManager created');

  // 6. Create webhook controller
  const webhookController = new WooCommerceWebhookController(
    webhookReliabilityService,
    eventTransformer,
    outboxPublisher,
  );
  logger.info('WooCommerceWebhookController created');

  // 7. Create router
  const router = createWooCommerceWebhookRoutes(webhookController);
  logger.info('WooCommerce webhook routes created');

  const context: WebhookCompositionContext = {
    router,
    webhookReliabilityService,
    eventTransformer,
    outboxPublisher,
    retryWorker,
    dlqManager,
  };

  logger.info('Webhook composition root created successfully');

  return context;
}

/**
 * Start webhook composition (starts retry worker)
 */
export async function startWebhookComposition(context: WebhookCompositionContext): Promise<void> {
  logger.info('Starting webhook composition');

  // Start retry worker
  context.retryWorker.start();

  logger.info('Webhook composition started successfully');
}

/**
 * Stop webhook composition (stops retry worker)
 */
export async function stopWebhookComposition(context: WebhookCompositionContext): Promise<void> {
  logger.info('Stopping webhook composition');

  // Stop retry worker
  context.retryWorker.stop();

  // Close outbox publisher
  await context.outboxPublisher.close();

  logger.info('Webhook composition stopped successfully');
}

/**
 * Create a health check endpoint for webhook composition
 */
export function createWebhookHealthCheck(context: WebhookCompositionContext): {
  handler: (req: Request, res: Response) => Promise<void>;
} {
  return {
    handler: async (req: Request, res: Response) => {
      try {
        const [webhookStats, dlqStats, retryWorkerStatus] = await Promise.all([
          context.webhookReliabilityService.getStatistics(),
          context.dlqManager.getStatistics(),
          Promise.resolve(context.retryWorker.getStatus()),
        ]);

        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          components: {
            webhookReliability: {
              status: 'up',
              stats: webhookStats,
            },
            outboxPublisher: {
              status: context.outboxPublisher.isHealthy() ? 'up' : 'down',
            },
            retryWorker: {
              status: retryWorkerStatus.isRunning ? 'running' : 'stopped',
              config: retryWorkerStatus.config,
            },
            deadLetterQueue: {
              status: 'up',
              stats: dlqStats,
            },
          },
        });
      } catch (error: any) {
        logger.error('Webhook health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    },
  };
}
