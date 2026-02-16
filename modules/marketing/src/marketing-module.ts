/**
 * Marketing Module
 * Main module implementation of ICypherModule
 * Handles campaigns, discount codes, and email sequences
 *
 * @module Marketing
 * @version 1.0.0
 */

import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { MarketingCompositionRoot } from './infrastructure/composition-root';
import { MarketingController } from './api/controllers/MarketingController';
import { createMarketingRoutes } from './api/routes/marketing.routes';

const logger = createModuleLogger('marketing');

/**
 * Marketing Module
 *
 * Manages marketing campaigns, discount codes, and email sequences.
 * Provides analytics, audience segmentation, and discount code validation.
 *
 * ### Published Events
 * - `marketing.discount_applied`: Discount code applied to order
 * - `marketing.campaign_activated`: Campaign activated
 * - `marketing.campaign_paused`: Campaign paused
 * - `marketing.campaign_completed`: Campaign completed
 * - `marketing.email_sent`: Email sequence step sent
 * - `marketing.customer_enrolled`: Customer enrolled in sequence
 *
 * ### Subscribed Events
 * - `order.completed`: Track conversions for campaigns
 * - `customer.registered`: Enroll in welcome email sequence
 * - `b2b.registration_approved`: Send B2B welcome sequence
 * - `cart.abandoned`: Send cart recovery emails
 *
 * ### Architecture
 * - **Domain**: Campaign, DiscountCode, EmailSequence entities
 * - **Application**: Use-cases for campaign management and discount validation
 * - **Infrastructure**: TypeORM repositories, background jobs
 * - **API**: REST endpoints for campaign and discount management
 *
 * ### Performance
 * - Async discount code validation and application
 * - Background job processing for email sequences (BullMQ)
 * - Campaign metrics aggregation every 6 hours
 * - Automatic expiration handling for codes and campaigns
 *
 * @class MarketingModule
 * @implements ICypherModule
 */
export default class MarketingModule implements ICypherModule {
  readonly name = 'marketing';
  readonly version = '1.0.0';
  readonly description =
    'Marketing campaigns, discount codes, and email sequences with analytics';
  readonly dependencies: string[] = ['notifications'];
  readonly publishedEvents = [
    'marketing.discount_applied',
    'marketing.campaign_activated',
    'marketing.campaign_paused',
    'marketing.campaign_completed',
    'marketing.email_sent',
    'marketing.customer_enrolled',
  ];
  readonly subscribedEvents = [
    'order.completed',
    'customer.registered',
    'b2b.registration_approved',
    'cart.abandoned',
  ];
  readonly featureFlag: string | undefined = undefined;

  private context!: IModuleContext;
  private compositionRoot!: MarketingCompositionRoot;
  private router!: Router;
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
   * Initialize the Marketing module
   *
   * Creates database tables, composition root, and API routes.
   *
   * @param context - Module context with database and event bus
   * @throws Error if database initialization fails
   */
  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Initializing Marketing module');

    try {
      // Verify database connection
      if (!context.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      logger.debug('Creating composition root');
      // Create composition root (dependency injection)
      this.compositionRoot = new MarketingCompositionRoot({
        dataSource: context.dataSource,
        logger: context.logger,
        eventBus: context.eventBus,
      });

      // Create Express router
      logger.debug('Creating API routes');
      this.router = Router();
      const controller = new MarketingController(this.compositionRoot);
      this.router.use('/', createMarketingRoutes(controller));

      logger.info('Marketing module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Marketing module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Start the Marketing module
   *
   * Subscribes to domain events and starts background jobs.
   */
  async start(): Promise<void> {
    logger.info('Starting Marketing module');

    try {
      // Subscribe to domain events
      logger.debug('Subscribing to events');

      await this.context.eventBus.subscribe('order.completed', (data) => {
        this.onOrderCompleted(data).catch((err) => {
          logger.error('Error handling order.completed event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('customer.registered', (data) => {
        this.onCustomerRegistered(data).catch((err) => {
          logger.error('Error handling customer.registered event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('b2b.registration_approved', (data) => {
        this.onB2bRegistrationApproved(data).catch((err) => {
          logger.error('Error handling b2b.registration_approved event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('cart.abandoned', (data) => {
        this.onCartAbandoned(data).catch((err) => {
          logger.error('Error handling cart.abandoned event', { error: err });
          this.metrics.errorCount++;
        });
      });

      // TODO: Start background jobs
      // - SequenceProcessorJob (hourly)
      // - CampaignExpirationJob (daily at 01:00)
      // - CodeCleanupJob (daily at 02:00)
      // - AnalyticsAggregationJob (every 6 hours)

      this.isStarted = true;
      logger.info('Marketing module started successfully');
    } catch (error) {
      logger.error('Failed to start Marketing module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the Marketing module gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping Marketing module');

    try {
      this.isStarted = false;
      // TODO: Stop background jobs
      logger.info('Marketing module stopped successfully');
    } catch (error) {
      logger.warn('Error stopping Marketing module', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw on shutdown
    }
  }

  /**
   * Get health status of the Marketing module
   */
  async getHealth(): Promise<IModuleHealth> {
    const details: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check database
    try {
      const startTime = Date.now();
      await this.context.dataSource.query('SELECT 1');
      const latency = Date.now() - startTime;

      details.database = {
        status: 'up',
        latency,
        message: 'Database connection healthy',
      };
    } catch (error) {
      overallStatus = 'unhealthy';
      details.database = {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database error',
      };
    }

    // Module status
    details.module = {
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
   * Get Express router for this module
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get metrics collected by this module
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
   * Handle order completed event
   * Track conversion for associated campaign and discount code
   *
   * @internal
   */
  private async onOrderCompleted(data: unknown): Promise<void> {
    logger.debug('Order completed event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Track conversion for campaigns
    // TODO: Update campaign revenue metrics
    // TODO: Publish marketing.order_converted event
  }

  /**
   * Handle customer registered event
   * Enroll customer in welcome email sequence
   *
   * @internal
   */
  private async onCustomerRegistered(data: unknown): Promise<void> {
    logger.debug('Customer registered event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Find welcome sequences with REGISTRATION trigger
    // TODO: Enroll customer in sequences
    // TODO: Send first email step
  }

  /**
   * Handle B2B registration approved event
   * Send B2B welcome sequence
   *
   * @internal
   */
  private async onB2bRegistrationApproved(data: unknown): Promise<void> {
    logger.debug('B2B registration approved event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Send B2B welcome sequence
  }

  /**
   * Handle cart abandoned event
   * Send cart recovery email sequence
   *
   * @internal
   */
  private async onCartAbandoned(data: unknown): Promise<void> {
    logger.debug('Cart abandoned event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Find cart recovery sequences
    // TODO: Enroll customer if not already enrolled
    // TODO: Send recovery emails
  }
}

// Export the module for auto-discovery
export { MarketingModule };
