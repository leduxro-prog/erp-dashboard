/**
 * B2B Portal Module
 * Handles B2B customer registration, approval workflow, bulk ordering, saved carts,
 * and tier-based pricing for 500+ business clients. Also provides integration with
 * external B2B Portal APIs for order/invoice synchronization.
 *
 * @module B2B Portal
 * @version 1.0.0
 */

import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system';
import { createModuleLogger } from '@shared/utils/logger';
import { createB2BPortalRouter, type B2BPortalModuleConfig } from './infrastructure/composition-root';

const logger = createModuleLogger('b2b-portal');

/**
 * B2B Portal Module
 *
 * Handles B2B customer self-service: registration, approval workflow, bulk ordering,
 * saved carts, and tier-based pricing for 500+ business clients. Also provides
 * integration with external B2B Portal APIs for bidirectional order/invoice synchronization.
 *
 * ### Published Events
 * - `b2b.registration_submitted`: New B2B registration submitted
 * - `b2b.registration_approved`: Registration approved, customer created
 * - `b2b.registration_rejected`: Registration rejected
 * - `b2b.order_from_cart`: Order created from saved cart
 * - `b2b.bulk_order`: Bulk order submitted
 * - `b2b.credit_adjusted`: Credit limit adjusted (admin)
 * - `b2b.order_synced`: Order synced to B2B Portal
 * - `b2b.order_status_changed`: Order status updated from B2B Portal
 * - `b2b.invoice_synced`: Invoice synced to B2B Portal
 * - `b2b.invoice_status_changed`: Invoice status updated from B2B Portal
 *
 * ### Subscribed Events
 * - `order.completed`: Order completed for credit tracking
 * - `order.cancelled`: Order cancelled to release credit
 * - `pricing.tier_updated`: Tier pricing updated
 *
 * ### Webhook Endpoints
 * - `POST /webhooks/b2b/order`: Handle order status updates from B2B Portal
 * - `POST /webhooks/b2b/invoice`: Handle invoice status updates from B2B Portal
 * - `POST /webhooks/b2b`: Handle generic webhooks from B2B Portal
 * - `GET /webhooks/b2b/verify`: Verify B2B Portal webhook endpoint
 *
 * ### Architecture
 * - **Domain**: B2BRegistration, B2BCustomer, SavedCart, BulkOrder, CreditTransaction entities
 * - **Application**: Use-cases for registration, cart, order, credit, and B2B Portal sync
 * - **Infrastructure**: TypeORM repositories, B2B Portal API client, status mapper
 * - **API**: REST endpoints for B2B operations and webhooks
 *
 * ### Key Features
 * - B2B registration with CUI/IBAN validation
 * - Multi-step approval workflow (PENDING -> UNDER_REVIEW -> APPROVED/REJECTED)
 * - Credit limit management with transaction audit trail
 * - Tier-based pricing (STANDARD, SILVER, GOLD, PLATINUM)
 * - Saved cart management with duplication
 * - Bulk order processing with CSV validation
 * - Payment terms flexibility (0, 15, 30, 45, 60 days)
 * - External B2B Portal integration with bidirectional sync
 * - Order status synchronization from B2B Portal
 * - Invoice status synchronization from B2B Portal
 * - Webhook support for real-time B2B Portal updates
 *
 * ### Dependencies
 * - `inventory`: For stock validation in bulk orders
 * - `pricing-engine`: For tier pricing and discounts
 * - `orders`: For order creation from carts
 * - `notifications`: For customer/admin notifications
 *
 * @class B2BPortalModule
 * @implements {ICypherModule}
 */
export default class B2BPortalModule implements ICypherModule {
  /**
   * Unique module identifier
   */
  readonly name = 'b2b';

  /**
   * Module version (semantic versioning)
   */
  readonly version = '1.0.0';

  /**
   * Human-readable module description
   */
  readonly description =
    'B2B customer portal with registration, approval workflow, saved carts, bulk ordering, and credit management';

  /**
   * Dependencies on other modules
   */
  readonly dependencies: string[] = [];

  /**
   * Events published by this module
   */
  readonly publishedEvents = [
    'b2b.registration_submitted',
    'b2b.registration_approved',
    'b2b.registration_rejected',
    'b2b.order_from_cart',
    'b2b.bulk_order',
    'b2b.credit_adjusted',
    'b2b.order_synced',
    'b2b.order_status_changed',
    'b2b.invoice_synced',
    'b2b.invoice_status_changed',
  ];

  /**
   * Events subscribed to by this module
   */
  readonly subscribedEvents = ['order.completed', 'order.cancelled', 'pricing.tier_updated', 'b2b.bulk_order'];

  /**
   * Optional feature flag for gradual rollout
   */
  readonly featureFlag = 'enable_b2b_portal';

  /**
   * Module context (injected during initialization)
   */
  private context!: IModuleContext;

  /**
   * B2B Portal configuration (optional)
   */
  private b2bPortalConfig?: B2BPortalModuleConfig;

  /**
   * Configure B2B Portal integration
   *
   * @param config - B2B Portal configuration
   */
  configureB2BPortal(config: B2BPortalModuleConfig): void {
    this.b2bPortalConfig = config;
    logger.info('B2B Portal integration configured', {
      hasBaseUrl: !!config.b2bPortal?.baseUrl,
      hasApiKey: !!config.b2bPortal?.apiKey,
    });
  }

  /**
   * Express router (set during initialization)
   */
  private router!: Router;

  /**
   * Module startup flag
   */
  private isStarted = false;

  /**
   * Metrics tracking
   */
  private metrics = {
    requestCount: 0,
    errorCount: 0,
    responseTimes: [] as number[],
    eventCount: { published: 0, received: 0 },
    activeWorkers: 0,
  };

  /**
   * Initialize the B2B Portal module.
   * Sets up database tables, repositories, and composition root.
   *
   * This method:
   * 1. Validates database connection
   * 2. Creates/verifies B2B-related tables
   * 3. Initializes repositories
   * 4. Sets up domain services
   * 5. Creates composition root for DI
   * 6. Creates and stores Express router
   *
   * @param context - Module context with database and event bus
   * @throws {Error} If database initialization fails
   */
  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Initializing B2B Portal module');

    try {
      // Verify database connection
      if (!context.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      logger.debug('Verifying database tables');
      // Tables are created via TypeORM migrations in infrastructure/

      // Create composition root and router
      logger.debug('Creating composition root');
      this.router = createB2BPortalRouter(
        context.dataSource,
        context.eventBus,
        this.b2bPortalConfig
      );

      logger.info('B2B Portal module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize B2B Portal module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Start the B2B Portal module.
   * Subscribes to events and starts background jobs.
   *
   * This method:
   * 1. Subscribes to relevant events
   * 2. Starts background jobs (tier recalculation, abandoned cart notifications)
   * 3. Warms up any caches
   *
   * Completes quickly, delegates long-running work to background tasks.
   */
  async start(): Promise<void> {
    logger.info('Starting B2B Portal module');

    try {
      // Subscribe to events
      logger.debug('Subscribing to events');

      await this.context.eventBus.subscribe('order.completed', (data) => {
        this.onOrderCompleted(data).catch((err) => {
          logger.error('Error handling order.completed event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('order.cancelled', (data) => {
        this.onOrderCancelled(data).catch((err) => {
          logger.error('Error handling order.cancelled event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('pricing.tier_updated', (data) => {
        this.onTierUpdated(data).catch((err) => {
          logger.error('Error handling pricing.tier_updated event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('b2b.bulk_order', (data) => {
        this.onBulkOrder(data).catch((err) => {
          logger.error('Error handling b2b.bulk_order event', { error: err });
          this.metrics.errorCount++;
        });
      });

      // TODO: Start background jobs
      // - TierRecalculationJob (weekly Sunday 02:00)
      // - CreditCleanupJob (daily 04:00)
      // - AbandonedCartNotificationJob (daily 10:00)

      this.isStarted = true;
      logger.info('B2B Portal module started successfully');
    } catch (error) {
      logger.error('Failed to start B2B Portal module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the B2B Portal module gracefully.
   * Unsubscribes from events and stops background jobs.
   *
   * This method:
   * 1. Unsubscribes from events
   * 2. Stops background workers
   * 3. Flushes pending operations
   * 4. Cleans up resources
   *
   * Must complete within timeout (~30 seconds).
   */
  async stop(): Promise<void> {
    logger.info('Stopping B2B Portal module');

    try {
      this.isStarted = false;

      // TODO: Stop background jobs and workers
      // TODO: Unsubscribe from events

      logger.info('B2B Portal module stopped successfully');
    } catch (error) {
      logger.warn('Error stopping B2B Portal module', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw on shutdown
    }
  }

  /**
   * Get health status of the B2B Portal module.
   * Checks database and dependencies.
   *
   * @returns Module health status
   */
  async getHealth(): Promise<IModuleHealth> {
    const details: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check database
    try {
      const startTime = Date.now();
      await this.context.dataSource.query('SELECT 1');
      const latency = Date.now() - startTime;

      details['database'] = {
        status: 'up',
        latency,
        message: 'Database connection healthy',
      };
    } catch (error) {
      overallStatus = 'unhealthy';
      details['database'] = {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database error',
      };
    }

    // Module status
    details['module'] = {
      status: this.isStarted ? 'up' : 'down',
      message: this.isStarted ? 'Module started' : 'Module not started',
    };

    return {
      status: overallStatus,
      details,
      lastChecked: new Date(),
    };
  }

  /**
   * Get Express router for this module.
   * Routes are automatically mounted at /api/v1/b2b/
   *
   * Router includes endpoints for:
   * - POST /register - B2B registration
   * - GET /registrations - List registrations (admin)
   * - POST /registrations/:id/review - Review registration (admin)
   * - GET /customers - List customers
   * - GET /customers/:id - Get customer profile
   * - GET /carts - List saved carts
   * - POST /carts - Create saved cart
   * - POST /carts/:id/convert - Convert cart to order
   * - POST /bulk-orders - Submit bulk order
   * - POST /orders - Create order
   * - GET /orders - List orders
   * - GET /orders/:id - Get order details
   * - GET /invoices - List invoices
   * - GET /invoices/:id - Get invoice details
   * - POST /webhooks/b2b/order - Handle order status webhook from B2B Portal
   * - POST /webhooks/b2b/invoice - Handle invoice status webhook from B2B Portal
   * - POST /webhooks/b2b - Handle generic webhook from B2B Portal
   * - GET /webhooks/b2b/verify - Verify B2B Portal webhook endpoint
   *
   * @returns Configured Express router
   */
  getRouter(): Router {
    if (!this.router) {
      // Create empty router as fallback
      this.router = Router();
    }
    return this.router;
  }

  /**
   * Get metrics collected by this module.
   *
   * @returns Module metrics
   */
  getMetrics(): IModuleMetrics {
    const avgResponseTime =
      this.metrics.responseTimes.length > 0
        ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) /
        this.metrics.responseTimes.length
        : 0;

    return {
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      avgResponseTime,
      activeWorkers: this.metrics.activeWorkers,
      cacheHitRate: 0,
      eventCount: this.metrics.eventCount,
    };
  }

  /**
   * Handle order completed event.
   * Updates credit usage status.
   *
   * @internal
   */
  private async onOrderCompleted(data: unknown): Promise<void> {
    logger.debug('Order completed event received', { data });
    this.metrics.eventCount.received++;
    // TODO: Implement order completion handling
  }

  /**
   * Handle order cancelled event.
   * Releases held credit.
   *
   * @internal
   */
  private async onOrderCancelled(data: unknown): Promise<void> {
    logger.debug('Order cancelled event received', { data });
    this.metrics.eventCount.received++;
    // TODO: Implement order cancellation handling
  }

  /**
   * Handle tier updated event.
   * Updates customer pricing if applicable.
   *
   * @internal
   */
  private async onTierUpdated(data: unknown): Promise<void> {
    logger.debug('Tier updated event received', { data });
    this.metrics.eventCount.received++;
    // TODO: Implement tier update handling
  }

  /**
   * Handle bulk order event.
   *
   * @internal
   */
  private async onBulkOrder(data: unknown): Promise<void> {
    logger.debug('B2B bulk order event received', { data });
    this.metrics.eventCount.received++;
  }
}

// Export the module for auto-discovery
export { B2BPortalModule };
