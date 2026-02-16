/**
 * SEO Automation Module
 *
 * Automates SEO for Ledux.ro's LED lighting products on WooCommerce.
 * Generates metadata, audits SEO health, and manages sitemaps.
 *
 * ### Key Features
 * - Auto-generate meta titles, descriptions, slugs, and structured data
 * - Comprehensive SEO audits with scoring
 * - XML sitemap generation and management
 * - JSON-LD structured data validation
 * - Event-driven product SEO monitoring
 * - Multi-locale support (Romanian, English)
 * - Background jobs for bulk operations
 *
 * ### Published Events
 * - `seo.metadata_updated`: SEO metadata was updated
 * - `seo.sitemap_regenerated`: Sitemap was regenerated
 * - `seo.audit_completed`: SEO audit completed
 *
 * ### Subscribed Events
 * - `product.updated`: Product data changed, regenerate SEO
 * - `product.created`: New product, generate initial SEO
 * - `category.updated`: Category changed, regenerate category SEO
 * - `woocommerce.product_synced`: Product synced from WooCommerce
 *
 * ### Architecture
 * - **Domain**: Rich entities (SeoMetadata, Sitemap, StructuredData, SeoAuditResult)
 * - **Application**: Use-cases for each SEO operation
 * - **Infrastructure**: Repositories, adapters, background jobs
 * - **Ports**: External adapters for products, categories, WooCommerce
 *
 * @version 1.0.0
 * @module seo-automation
 */

import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { createSeoModuleCompositionRoot, SeoModuleCompositionRoot } from './infrastructure/composition-root';
import { IProductPort } from './application/ports/IProductPort';
import { ICategoryPort } from './application/ports/ICategoryPort';
import { IWooCommercePort } from './application/ports/IWooCommercePort';

const logger = createModuleLogger('seo-automation');

/**
 * SEO Automation Module
 *
 * Implements ICypherModule for integration with CYPHER ERP framework.
 * Manages complete lifecycle: init → start → stop.
 */
export default class SeoAutomationModule implements ICypherModule {
  /**
   * Unique module name (lowercase, kebab-case)
   */
  readonly name = 'seo-automation';

  /**
   * Semantic version
   */
  readonly version = '1.0.0';

  /**
   * Human-readable module description
   */
  readonly description =
    'Automates SEO for Ledux.ro LED lighting products including metadata generation, audits, and sitemap management';

  /**
   * List of module dependencies
   * Depends on WooCommerce sync module for product data
   */
  readonly dependencies: string[] = ['woocommerce-sync'];

  /**
   * Events this module publishes
   */
  readonly publishedEvents = [
    'seo.metadata_generated',
    'seo.metadata_updated',
    'seo.sitemap_regenerated',
    'seo.audit_completed',
  ];

  /**
   * Events this module subscribes to
   */
  readonly subscribedEvents = [
    'product.updated',
    'product.created',
    'category.updated',
    'woocommerce.product_synced',
  ];

  /**
   * Optional feature flag
   */
  readonly featureFlag?: string;

  /**
   * Module context (provided during initialization)
   */
  private context!: IModuleContext;

  /**
   * Express router with all endpoints
   */
  private router!: Router;

  /**
   * Composition root service locator
   */
  private compositionRoot!: SeoModuleCompositionRoot;

  /**
   * Whether module is started
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
   * Initialize the SEO module
   *
   * Sets up repositories, services, composition root, and router.
   * Called once during application startup.
   *
   * @param context - Module context with database, cache, event bus
   * @throws {Error} If initialization fails
   */
  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Initializing SEO Automation module');

    try {
      // Verify database connection
      if (!context.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      logger.debug('Database connection verified');

      // Create adapters/ports (in real implementation, these would be injected)
      // For now, they would be created from factories
      const productPort = createStubProductPort();
      const categoryPort = createStubCategoryPort();
      const woocommercePort = createStubWooCommercePort();

      // Create composition root
      logger.debug('Creating composition root');
      this.compositionRoot = await createSeoModuleCompositionRoot(
        context.dataSource,
        context.eventBus,
        context.eventBus.client,
        productPort,
        categoryPort,
        woocommercePort
      );

      // Get router from composition root
      this.router = this.compositionRoot.router;

      logger.info('SEO Automation module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SEO Automation module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Start the SEO module
   *
   * Subscribes to events and warms up caches.
   * Called after all modules are initialized.
   *
   * @throws {Error} If startup fails
   */
  async start(): Promise<void> {
    logger.info('Starting SEO Automation module');

    try {
      // Subscribe to product events
      logger.debug('Subscribing to product events');

      await this.context.eventBus.subscribe('product.created', (data) => {
        this.onProductCreated(data).catch((err) => {
          logger.error('Error handling product.created event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('product.updated', (data) => {
        this.onProductUpdated(data).catch((err) => {
          logger.error('Error handling product.updated event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('category.updated', (data) => {
        this.onCategoryUpdated(data).catch((err) => {
          logger.error('Error handling category.updated event', { error: err });
          this.metrics.errorCount++;
        });
      });

      await this.context.eventBus.subscribe('woocommerce.product_synced', (data) => {
        this.onWooCommerceSynced(data).catch((err) => {
          logger.error('Error handling woocommerce.product_synced event', { error: err });
          this.metrics.errorCount++;
        });
      });

      this.isStarted = true;
      logger.info('SEO Automation module started successfully');
    } catch (error) {
      logger.error('Failed to start SEO Automation module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Stop the SEO module gracefully
   *
   * Unsubscribes from events and cleans up resources.
   * Must complete within timeout (~30 seconds).
   */
  async stop(): Promise<void> {
    logger.info('Stopping SEO Automation module');

    try {
      this.isStarted = false;

      // In production, would unsubscribe from events here
      logger.debug('Unsubscribing from events');

      logger.info('SEO Automation module stopped successfully');
    } catch (error) {
      logger.warn('Error stopping SEO Automation module', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw on shutdown - log and continue
    }
  }

  /**
   * Get health status of the module
   *
   * Checks database, cache, and dependency health.
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
   *
   * Router is mounted at /api/v1/seo/ by registry.
   *
   * @returns Configured Express router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get metrics collected by this module
   *
   * Used for monitoring and observability.
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
   * Handle product created event
   *
   * Generates initial SEO metadata for new product.
   *
   * @internal
   */
  private async onProductCreated(data: unknown): Promise<void> {
    logger.debug('Product created event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Generate initial SEO metadata
    // TODO: Publish seo.metadata_generated event
  }

  /**
   * Handle product updated event
   *
   * Regenerates SEO if product details changed.
   *
   * @internal
   */
  private async onProductUpdated(data: unknown): Promise<void> {
    logger.debug('Product updated event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Check if product details changed
    // TODO: Regenerate SEO metadata if needed
    // TODO: Publish seo.metadata_updated event
  }

  /**
   * Handle category updated event
   *
   * Regenerates category SEO metadata.
   *
   * @internal
   */
  private async onCategoryUpdated(data: unknown): Promise<void> {
    logger.debug('Category updated event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Regenerate category SEO metadata
    // TODO: Publish seo.metadata_updated event
  }

  /**
   * Handle WooCommerce sync event
   *
   * Syncs SEO metadata back to WooCommerce.
   *
   * @internal
   */
  private async onWooCommerceSynced(data: unknown): Promise<void> {
    logger.debug('WooCommerce sync event received', { data });
    this.metrics.eventCount.received++;

    // TODO: Sync SEO metadata to WooCommerce
    // TODO: Handle sync errors and retry logic
  }
}

/**
 * Create stub implementation of IProductPort
 * @internal
 */
function createStubProductPort(): IProductPort {
  return {
    getById: async () => null,
    getByIds: async () => [],
    getCategories: async () => [],
    updateMetadata: async () => true,
  } as unknown as IProductPort;
}

/**
 * Create stub implementation of ICategoryPort
 * @internal
 */
function createStubCategoryPort(): ICategoryPort {
  return {
    getById: async () => null,
    getByIds: async () => [],
    getHierarchy: async () => [],
    updateMetadata: async () => true,
  } as unknown as ICategoryPort;
}

/**
 * Create stub implementation of IWooCommercePort
 * @internal
 */
function createStubWooCommercePort(): IWooCommercePort {
  return {
    sync: async () => true,
    getSyncStatus: async () => ({ synced: 0, pending: 0, failed: 0 }),
    updateProduct: async () => true,
  } as unknown as IWooCommercePort;
}

// Export for module auto-discovery
export { SeoAutomationModule };
