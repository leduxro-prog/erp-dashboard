import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system';
import { createModuleLogger } from '@shared/utils/logger';
import { createConfiguratorsRouter } from './infrastructure/composition-root';

const logger = createModuleLogger('configurators');

/**
 * Configurators Module
 *
 * Handles product configuration for Ledux.ro:
 * 1. **Magnetic Track System** — customers build custom magnetic track lighting setups
 * 2. **LED Strip System** — customers configure custom LED strip installations
 *
 * ### Published Events
 * - `configuration.completed`: Configuration session completed
 * - `configuration.convert_to_quote`: Configuration converted to quotation
 *
 * ### Subscribed Events
 * - `pricing.updated`: Price changes (invalidates price cache)
 * - `inventory.stock_changed`: Stock updates (affects availability)
 *
 * ### Architecture
 * - **Domain**: ConfiguratorSession, ConfigurationItem, CompatibilityRule, ComponentCatalog
 * - **Application**: Use-cases for configuration operations
 * - **Infrastructure**: TypeORM repositories, price/inventory ports
 * - **API**: REST endpoints for configurators
 *
 * ### Performance
 * - Sessions expire after 24 hours
 * - Compatibility rules evaluated in-memory
 * - Prices cached and updated via events
 *
 * @version 1.0.0
 */
export default class ConfiguratorsModule implements ICypherModule {
  readonly name = 'configurators';
  readonly version = '1.0.0';
  readonly description = 'Product configurators for Magnetic Track and LED Strip systems';
  readonly dependencies = ['pricing-engine', 'inventory'];
  readonly publishedEvents = ['configuration.completed', 'configuration.convert_to_quote'];
  readonly subscribedEvents = ['pricing.updated', 'inventory.stock_changed'];
  readonly featureFlag?: string;

  private context!: IModuleContext;
  private router!: Router;
  private isStarted = false;

  // Metrics tracking
  private metrics = {
    requestCount: 0,
    errorCount: 0,
    responseTimes: [] as number[],
    eventCount: { published: 0, received: 0 },
    activeWorkers: 0,
  };

  /**
   * Initialize the Configurators module.
   * Sets up database tables and composition root.
   *
   * @param context - Module context with database and event bus
   * @throws {Error} If database initialization fails
   */
  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Initializing Configurators module');

    try {
      // Verify database connection
      if (!context.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      logger.debug('Verifying database tables');
      // Tables are created via TypeORM entities and migrations

      // Create composition root (dependency injection)
      logger.debug('Creating composition root');

      // Create port adapters for external dependencies
      const pricingPort = this._createPricingPortAdapter();
      const inventoryPort = this._createInventoryPortAdapter();

      this.router = createConfiguratorsRouter(
        context.dataSource,
        context.eventBus,
        context.logger,
        pricingPort,
        inventoryPort
      );

      logger.info('Configurators module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Configurators module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Start the Configurators module.
   * Subscribes to domain events.
   */
  async start(): Promise<void> {
    logger.info('Starting Configurators module');

    try {
      logger.debug('Subscribing to events');

      // Subscribe to pricing updates
      await this.context.eventBus.subscribe('pricing.updated', (data) => {
        this.onPricingUpdated(data).catch((err) => {
          logger.error('Error handling pricing.updated event', { error: err });
          this.metrics.errorCount++;
        });
      });

      // Subscribe to inventory changes
      await this.context.eventBus.subscribe('inventory.stock_changed', (data) => {
        this.onInventoryChanged(data).catch((err) => {
          logger.error('Error handling inventory.stock_changed event', { error: err });
          this.metrics.errorCount++;
        });
      });

      this.isStarted = true;
      logger.info('Configurators module started successfully');
    } catch (error) {
      logger.error('Failed to start Configurators module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the Configurators module gracefully.
   */
  async stop(): Promise<void> {
    logger.info('Stopping Configurators module');

    try {
      this.isStarted = false;

      logger.info('Configurators module stopped successfully');
    } catch (error) {
      logger.warn('Error stopping Configurators module', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw on shutdown
    }
  }

  /**
   * Get health status of the Configurators module.
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
   * Get Express router for this module.
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get metrics collected by this module.
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
   * Handle pricing updated event
   *
   * @private
   */
  private async onPricingUpdated(data: unknown): Promise<void> {
    logger.debug('Pricing updated event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Invalidate price cache for affected products
  }

  /**
   * Handle inventory changed event
   *
   * @private
   */
  private async onInventoryChanged(data: unknown): Promise<void> {
    logger.debug('Inventory changed event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Update component availability in catalog
  }

  /**
   * Create pricing port adapter
   *
   * @private
   * @returns Pricing port implementation
   */
  private _createPricingPortAdapter(): any {
    // TODO: Implement pricing port adapter that calls pricing module
    return {
      getCustomerTierDiscount: async (customerId: number) => 0,
      getProductPrice: async (productId: number) => 0,
      hasActivePromotion: async (productId: number) => false,
    };
  }

  /**
   * Create inventory port adapter
   *
   * @private
   * @returns Inventory port implementation
   */
  private _createInventoryPortAdapter(): any {
    // TODO: Implement inventory port adapter that calls inventory module
    return {
      checkStockAvailability: async (productIds: number[]) => new Map(),
      isInStock: async (productId: number) => true,
      getAvailableQuantity: async (productId: number) => 0,
    };
  }
}

// Export the module for auto-discovery
export { ConfiguratorsModule };
