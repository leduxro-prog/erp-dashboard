import { Router } from 'express';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { createWooCommerceRouter } from './infrastructure/composition-root';
import { createWebhookComposition, startWebhookComposition, stopWebhookComposition, type WebhookCompositionContext } from './infrastructure/WebhookCompositionRoot';

// Export composition roots
export { createWooCommerceRouter } from './infrastructure/composition-root';
export { createWebhookComposition, startWebhookComposition, stopWebhookComposition, type WebhookCompositionContext } from './infrastructure/WebhookCompositionRoot';

// Domain exports
export * from './domain';

// Application exports
export * from './application';

// Application exports - transformers
export * from './application/transformers';

// Infrastructure exports
export { WooCommerceApiClient, type WooCommerceConfig } from './infrastructure/api-client/WooCommerceApiClient';
export { WooCommerceMapper } from './infrastructure/mappers/WooCommerceMapper';
export { TypeOrmSyncRepository } from './infrastructure/repositories/TypeOrmSyncRepository';
export { SyncCache } from './infrastructure/cache/SyncCache';
export { RealTimeSyncWorker, type SyncJobData } from './infrastructure/jobs/RealTimeSyncWorker';
export { FullSyncJob } from './infrastructure/jobs/FullSyncJob';
export { OrderPullJob } from './infrastructure/jobs/OrderPullJob';
export { RetryFailedJob } from './infrastructure/jobs/RetryFailedJob';
export { SyncEventHandler } from './infrastructure/event-handlers/SyncEventHandler';

// Infrastructure exports - outbox
export * from './infrastructure/outbox';

// Infrastructure exports - workers
export * from './infrastructure/workers';

// Infrastructure exports - DLQ
export * from './infrastructure/dlq';

// Infrastructure exports - entities
export { WebhookEventLogEntity, WebhookStatus } from './infrastructure/entities/WebhookEventLogEntity';

// API exports
export { WooCommerceController } from './api/controllers/WooCommerceController';
export { WooCommerceWebhookController } from './api/controllers/WooCommerceWebhookController';
export { WooCommerceValidators } from './api/validators/woocommerce.validators';
export { createWooCommerceRoutes } from './api/routes/woocommerce.routes';
export { createWooCommerceWebhookRoutes } from './api/routes/woocommerce-webhook.routes';

/**
 * WooCommerce Sync Module Implementation
 * Handles real-time synchronization between WooCommerce and CYPHER ERP
 */
export class WooCommerceSyncModule implements ICypherModule {
  readonly name = 'woocommerce-sync';
  readonly version = '2.0.0';
  readonly description = 'Real-time webhook intake and synchronization between WooCommerce and CYPHER ERP with outbox pattern and DLQ';
  readonly dependencies = ['inventory', 'orders'];
  readonly publishedEvents = [
    'woocommerce.product_synced',
    'woocommerce.order_synced',
    'woocommerce.customer_synced',
    'woocommerce.sync_failed',
  ];
  readonly subscribedEvents = ['order.created', 'inventory.stock_adjusted'];

  private context!: IModuleContext;
  private router!: Router;
  private webhookRouter?: Router;
  private webhookContext?: WebhookCompositionContext;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;

    // Create main sync router
    this.router = createWooCommerceRouter(context.dataSource);

    // Create webhook composition for real-time intake
    this.webhookContext = await createWebhookComposition(context.dataSource);
    this.webhookRouter = this.webhookContext.router;

    this.context.logger.info('WooCommerce Sync module initialized', {
      webhookRouterReady: !!this.webhookRouter,
    });
  }

  async start(): Promise<void> {
    // Start retry worker
    if (this.webhookContext) {
      await startWebhookComposition(this.webhookContext);
    }

    this.context.logger.info('WooCommerce Sync module started');
  }

  async stop(): Promise<void> {
    // Stop webhook composition
    if (this.webhookContext) {
      await stopWebhookComposition(this.webhookContext);
    }

    this.context.logger.info('WooCommerce Sync module stopped');
  }

  async getHealth(): Promise<IModuleHealth> {
    try {
      await this.context.dataSource.query('SELECT 1');

      const details: any = {
        database: { status: 'up', message: 'Connected to database' },
      };

      // Add webhook composition health if available
      if (this.webhookContext) {
        const retryStatus = this.webhookContext.retryWorker.getStatus();
        const dlqStats = await this.webhookContext.dlqManager.getStatistics();
        const webhookStats = await this.webhookContext.webhookReliabilityService.getStatistics();

        details.webhookComposition = {
          status: 'up',
          retryWorker: retryStatus.isRunning ? 'running' : 'stopped',
          outboxPublisher: this.webhookContext.outboxPublisher.isHealthy() ? 'healthy' : 'unhealthy',
          dlqEntries: dlqStats.totalDeadLetters,
          webhookStats,
        };
      }

      return {
        status: 'healthy',
        details,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          database: {
            status: 'down',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        lastChecked: new Date(),
      };
    }
  }

  getRouter(): Router {
    return this.router;
  }

  getWebhookRouter(): Router | undefined {
    return this.webhookRouter;
  }

  getMetrics(): IModuleMetrics {
    return {
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      activeWorkers: this.webhookContext?.retryWorker.getStatus().isRunning ? 1 : 0,
      cacheHitRate: 0,
      eventCount: {
        published: 0,
        received: 0,
      },
    };
  }
}

const woocommerceSyncModule = new WooCommerceSyncModule();
export default woocommerceSyncModule;
