/**
 * CYPHER ERP Module System - Core Interfaces
 *
 * Provides standardized interfaces and contracts for all modules in the CYPHER ERP system.
 * Ensures consistent module lifecycle management, health monitoring, metrics collection,
 * and inter-module communication through event bus and dependency injection.
 *
 * @module shared/module-system/module.interface
 * @example
 * // Import interfaces for module implementation
 * import { ICypherModule, IModuleContext, IModuleHealth } from '@cypher/module-system';
 */

import { Router } from 'express';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Logger } from 'winston';

/**
 * Event bus interface for pub/sub messaging.
 * Modules use this to publish and subscribe to domain events.
 * Provides Redis-backed pub/sub with direct client access for custom operations.
 *
 * @interface IEventBus
 * @example
 * // Publish order created event
 * await eventBus.publish('order.created', { orderId: 123, amount: 1000 });
 *
 * // Subscribe to order events
 * await eventBus.subscribe('order.created', (data) => {
 *   console.log('New order:', data);
 * });
 */
export interface IEventBus {
    /**
     * Publish an event to subscribers
     * @param channel - Event channel (e.g., 'order.created')
     * @param data - Event payload
     * @returns Promise that resolves when event is published
     */
    publish(channel: string, data: unknown): Promise<void>;

    /**
     * Subscribe to events on a channel
     * @param channel - Event channel (e.g., 'order.created')
     * @param handler - Function to handle the event
     * @returns Promise that resolves when subscription is established
     */
    subscribe(channel: string, handler: (data: unknown) => void): Promise<void>;

    /**
     * Unsubscribe from a channel
     * @param channel - Event channel
     * @param handler - Handler function to remove
     * @returns Promise that resolves when unsubscription is complete
     */
    unsubscribe(channel: string, handler: (data: unknown) => void): Promise<void>;

    /**
     * Get the Redis client for custom operations
     * @returns Redis client instance
     */
    readonly client: Redis;
}

/**
 * Cache manager interface for multi-layer caching.
 * Implements L1 (in-memory), L2 (Redis), L3 (database) strategy.
 * Modules use this for application-level caching with TTL support and pattern-based invalidation.
 *
 * @interface ICacheManager
 * @example
 * // Get with fallback to database
 * const product = await cache.get('product:123', async () => {
 *   return await db.products.findById(123);
 * });
 *
 * // Set with custom TTL
 * await cache.set('product:123', product, 600);
 *
 * // Invalidate by pattern
 * await cache.delPattern('product:*');
 */
export interface ICacheManager {
    /**
     * Get a value from cache
     * @param key - Cache key
     * @returns Cached value or null
     */
    get<T = unknown>(key: string): Promise<T | null>;

    /**
     * Set a value in cache
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttlSeconds - Time to live in seconds (optional)
     * @returns Promise that resolves when value is cached
     */
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

    /**
     * Delete a cache key
     * @param key - Cache key
     * @returns Promise that resolves when key is deleted
     */
    del(key: string): Promise<void>;

    /**
     * Delete multiple keys matching a pattern
     * @param pattern - Pattern with * wildcards
     * @returns Promise that resolves with number of deleted keys
     */
    delPattern(pattern: string): Promise<number>;

    /**
     * Clear entire cache
     * @returns Promise that resolves when cache is cleared
     */
    flush(): Promise<void>;

    /**
     * Get cache statistics
     * @returns Cache stats
     */
    getStats(): Promise<{
        hitRate: number;
        size: number;
        keys: number;
    }>;
}

/**
 * Feature flag service interface for feature toggle management.
 * Enables gradual rollouts, A/B testing, and dynamic behavior configuration.
 *
 * @interface IFeatureFlagService
 * @example
 * // Check if feature is enabled
 * if (featureFlags.isEnabled('new_pricing_engine')) {
 *   // Use new pricing logic
 * }
 *
 * // Get all flags
 * const allFlags = featureFlags.getAll();
 */
export interface IFeatureFlagService {
    /**
     * Check if a feature is enabled
     * @param featureName - Name of the feature flag
     * @returns Whether the feature is enabled
     */
    isEnabled(featureName: string): boolean;

    /**
     * Get all feature flags
     * @returns Object mapping feature names to enabled status
     */
    getAll(): Record<string, boolean>;

    /**
     * Set a feature flag
     * @param featureName - Name of the feature flag
     * @param enabled - Whether the feature is enabled
     * @returns Promise that resolves when flag is set
     */
    set(featureName: string, enabled: boolean): Promise<void>;
}

/**
 * API client factory for making external API calls.
 * Provides pre-configured clients for known services (WooCommerce, SmartBill, etc.)
 * and factory method for creating custom clients.
 *
 * @interface IApiClientFactory
 * @example
 * // Get pre-configured client for WooCommerce
 * const wooClient = await apiClientFactory.getServiceClient('woocommerce');
 *
 * // Create custom client for external API
 * const customClient = await apiClientFactory.createHttpClient('https://api.example.com', {
 *   timeout: 5000,
 *   retryAttempts: 3
 * });
 */
export interface IApiClientFactory {
    /**
     * Create an HTTP client for external API calls
     * @param baseUrl - Base URL for the API
     * @param options - Additional options
     * @returns Promise resolving to the client
     */
    createHttpClient(
        baseUrl: string,
        options?: Record<string, unknown>
    ): Promise<unknown>;

    /**
     * Get a pre-configured client for a known service
     * @param serviceName - Name of the service (e.g., 'woocommerce', 'smartbill')
     * @returns Promise resolving to the client
     */
    getServiceClient(serviceName: string): Promise<unknown>;
}

/**
 * Module context provided to all modules during initialization.
 * Contains all required dependencies and configuration for module operation.
 * Injected during module lifecycle initialization.
 *
 * @interface IModuleContext
 * @example
 * // Access context in module initialization
 * async initialize(context: IModuleContext): Promise<void> {
 *   const db = context.dataSource;
 *   const cache = context.cacheManager;
 *   const logger = context.logger;
 *   // Setup module...
 * }
 */
export interface IModuleContext {
    /** TypeORM DataSource for database access */
    dataSource: DataSource;

    /** Event bus for pub/sub messaging */
    eventBus: IEventBus;

    /** Cache manager for multi-layer caching */
    cacheManager: ICacheManager;

    /** Module-scoped logger instance */
    logger: Logger;

    /** Module-specific configuration from environment */
    config: Record<string, string>;

    /** Factory for creating API clients */
    apiClientFactory: IApiClientFactory;

    /** Feature flag service */
    featureFlags: IFeatureFlagService;
}

/**
 * Health status for a module component or subsystem.
 * Provides detailed status information for dependency checks (database, cache, external services).
 *
 * @interface IHealthStatus
 * @example
 * {
 *   status: 'up',
 *   latency: 25,
 *   message: 'Database connection established'
 * }
 */
export interface IHealthStatus {
    /** Status of the component */
    status: 'up' | 'down';

    /** Response time in milliseconds (optional) */
    latency?: number;

    /** Additional status message (optional) */
    message?: string;
}

/**
 * Overall health status of a module combining all component statuses.
 * Used for monitoring and determining module operational status.
 *
 * @interface IModuleHealth
 * @example
 * {
 *   status: 'degraded',
 *   details: {
 *     database: { status: 'up', latency: 12 },
 *     cache: { status: 'up', latency: 3 },
 *     externalService: { status: 'down', message: 'Connection timeout' }
 *   },
 *   lastChecked: new Date()
 * }
 */
export interface IModuleHealth {
    /** Overall module status */
    status: 'healthy' | 'degraded' | 'unhealthy';

    /** Health status of module components/subsystems */
    details: Record<string, IHealthStatus>;

    /** Timestamp of last health check */
    lastChecked: Date;
}

/**
 * Metrics collected by a module for monitoring and observability.
 * Tracks request counts, errors, response times, worker activity, and cache performance.
 *
 * @interface IModuleMetrics
 * @example
 * {
 *   requestCount: 15234,
 *   errorCount: 12,
 *   avgResponseTime: 145,
 *   activeWorkers: 3,
 *   cacheHitRate: 87.5,
 *   eventCount: {
 *     published: 450,
 *     received: 380
 *   }
 * }
 */
export interface IModuleMetrics {
    /** Total number of requests handled */
    requestCount: number;

    /** Total number of errors */
    errorCount: number;

    /** Average response time in milliseconds */
    avgResponseTime: number;

    /** Number of active background workers/jobs */
    activeWorkers: number;

    /** Cache hit rate percentage (0-100) */
    cacheHitRate: number;

    /** Event metrics */
    eventCount: {
        /** Number of events published */
        published: number;

        /** Number of events received */
        received: number;
    };
}

/**
 * Standard interface that ALL CYPHER ERP modules must implement.
 * This contract ensures consistent module behavior, lifecycle management,
 * health monitoring, and inter-module communication.
 *
 * ### Lifecycle Flow
 * 1. Module instantiation
 * 2. Registry.register(module) - called during app startup
 * 3. Registry.initializeAll() - topological sort by dependencies, then initialize each
 * 4. Registry.startAll() - start all initialized modules
 * 5. Registry.stopAll() - graceful shutdown (reverse order)
 *
 * ### Module Naming
 * - Use lowercase kebab-case: 'pricing-engine', 'woocommerce-sync', 'order-management'
 * - Must be unique across all modules
 *
 * ### Dependencies
 * - List modules this module depends on by name
 * - Registry performs topological sort to ensure correct initialization order
 * - Circular dependencies are detected and rejected with error
 *
 * ### Events
 * - Define publishedEvents that this module emits
 * - Define subscribedEvents that this module listens for
 * - Use channel naming: 'entity.event' (e.g., 'order.created', 'inventory.updated')
 *
 * ### Feature Flags
 * - Optionally specify a featureFlag to control module loading
 * - If flag is disabled, module is skipped but not removed from registry
 * - Useful for A/B testing and gradual rollouts
 *
 * @interface ICypherModule
 *
 * @example
 * // Creating a new module
 * class NotificationsModule implements ICypherModule {
 *   readonly name = 'notifications';
 *   readonly version = '1.0.0';
 *   readonly description = 'Sends email and SMS notifications';
 *   readonly dependencies = ['orders', 'quotations'];
 *   readonly publishedEvents = [];
 *   readonly subscribedEvents = ['order.created', 'order.shipped'];
 *   readonly featureFlag = 'enable_notifications';
 *
 *   private context!: IModuleContext;
 *   private router!: Router;
 *
 *   async initialize(context: IModuleContext): Promise<void> {
 *     this.context = context;
 *     // Create composition root, set up services
 *     const { compositionRoot } = await this.createCompositionRoot();
 *     this.router = compositionRoot.createRouter();
 *   }
 *
 *   async start(): Promise<void> {
 *     // Subscribe to events
 *     await this.context.eventBus.subscribe('order.created', (data) => {
 *       this.onOrderCreated(data);
 *     });
 *   }
 *
 *   async stop(): Promise<void> {
 *     // Cleanup workers
 *   }
 *
 *   async getHealth(): Promise<IModuleHealth> {
 *     // Check database, Redis, external services
 *     return { status: 'healthy', details: {}, lastChecked: new Date() };
 *   }
 *
 *   getRouter(): Router {
 *     return this.router;
 *   }
 *
 *   async getMetrics(): Promise<IModuleMetrics> {
 *     // Return collected metrics
 *   }
 *
 *   private async onOrderCreated(data: unknown): Promise<void> {
 *     // Handle order created event
 *   }
 * }
 */
export interface ICypherModule {
    /**
     * Unique module identifier (lowercase, kebab-case).
     * Must be unique across all modules.
     * Examples: 'pricing-engine', 'order-management', 'woocommerce-sync'
     */
    readonly name: string;

    /**
     * Semantic version of the module.
     * Used for compatibility checking and migrations.
     * Example: '1.0.0', '2.1.3'
     */
    readonly version: string;

    /**
     * Human-readable description of what this module does.
     * Example: 'Handles product pricing, discounts, and tier management'
     */
    readonly description: string;

    /**
     * List of other module names this module depends on.
     * All dependencies must be registered before this module.
     * Registry performs topological sort based on this.
     * Example: ['orders', 'inventory']
     */
    readonly dependencies: string[];

    /**
     * List of events this module publishes.
     * Use 'entity.event' naming convention.
     * Examples: ['order.created', 'order.shipped', 'price.updated']
     */
    readonly publishedEvents: string[];

    /**
     * List of events this module subscribes to.
     * Use 'entity.event' naming convention.
     * Examples: ['inventory.updated', 'order.created']
     */
    readonly subscribedEvents: string[];

    /**
     * Optional feature flag that controls module loading.
     * If specified and disabled, module is skipped during initialization.
     * Useful for gradual rollouts and A/B testing.
     * Example: 'enable_notifications', 'use_new_pricing_engine'
     */
    readonly featureFlag?: string;

    /**
     * Initialize the module.
     * Called once during application startup, before module start().
     *
     * Use this to:
     * - Create database tables/migrations
     * - Initialize caches
     * - Create composition root
     * - Set up dependency injection
     * - Validate configuration
     *
     * Must complete before other modules can start.
     * If initialization fails, module loading fails and app may not start.
     *
     * @param context - Module context with all dependencies
     * @returns Promise that resolves when initialization is complete
     * @throws {Error} If initialization fails (e.g., DB connection, config validation)
     *
     * @example
     * async initialize(context: IModuleContext): Promise<void> {
     *   this.context = context;
     *   this.logger = context.logger;
     *   await this.createTablesIfNotExist();
     *   this.compositionRoot = await this.setupDependencies();
     * }
     */
    initialize(context: IModuleContext): Promise<void>;

    /**
     * Start the module.
     * Called after all modules are initialized, in dependency order.
     *
     * Use this to:
     * - Register event subscribers
     * - Start background workers/jobs
     * - Begin polling operations
     * - Warm up caches
     *
     * Should complete quickly. Long-running operations should be delegated
     * to background workers that can be stopped gracefully.
     *
     * @returns Promise that resolves when module is fully started
     * @throws {Error} If startup fails
     *
     * @example
     * async start(): Promise<void> {
     *   await this.context.eventBus.subscribe('order.created', (data) => {
     *     this.onOrderCreated(data);
     *   });
     *   this.startBackgroundWorker();
     * }
     */
    start(): Promise<void>;

    /**
     * Stop the module gracefully.
     * Called during application shutdown, in reverse order (last started, first stopped).
     *
     * Must complete within reasonable timeout (typically 30 seconds).
     * Must not throw errors that prevent shutdown.
     *
     * Use this to:
     * - Unsubscribe from events
     * - Stop background workers
     * - Flush pending writes to cache/DB
     * - Close external connections
     *
     * @returns Promise that resolves when shutdown is complete
     *
     * @example
     * async stop(): Promise<void> {
     *   await this.context.eventBus.unsubscribe('order.created', this.onOrderCreated);
     *   await this.backgroundWorker?.stop();
     *   await this.context.cacheManager.flush();
     * }
     */
    stop(): Promise<void>;

    /**
     * Get health status of this module.
     * Called periodically to monitor module health.
     *
     * Must complete within a few seconds (typically < 5s).
     * Should check:
     * - Database connectivity
     * - Cache/Redis connectivity
     * - External service connectivity (for integration modules)
     * - Dependency health (if applicable)
     *
     * Status levels:
     * - 'healthy': All systems operational
     * - 'degraded': Core functionality works but some features are impaired
     * - 'unhealthy': Module cannot function
     *
     * @returns Promise resolving to health status
     *
     * @example
     * async getHealth(): Promise<IModuleHealth> {
     *   const details: Record<string, IHealthStatus> = {
     *     database: { status: 'up', latency: 12 },
     *     cache: { status: 'up', latency: 3 },
     *     externalService: { status: 'down', message: 'Connection timeout' }
     *   };
     *
     *   return {
     *     status: 'degraded', // 'up' means 'healthy'
     *     details,
     *     lastChecked: new Date()
     *   };
     * }
     */
    getHealth(): Promise<IModuleHealth>;

    /**
     * Get Express router for this module.
     * Called during app startup to mount module routes.
     *
     * Router is mounted at `/api/v1/{moduleName}/`
     * Example: /api/v1/orders/list, /api/v1/pricing/calculate
     *
     * Router should NOT include the base path - that's added by registry.
     * All routes should be relative to root: /list not /orders/list
     *
     * @returns Express Router with all module endpoints
     *
     * @example
     * getRouter(): Router {
     *   const router = Router();
     *   router.get('/list', this.listOrdersHandler.bind(this));
     *   router.post('/create', this.createOrderHandler.bind(this));
     *   return router;
     * }
     */
    getRouter(): Router;

    /**
     * Get metrics collected by this module.
     * Called for monitoring and observability.
     *
     * Should be lightweight and not perform I/O.
     * Return metrics collected since last call (or from in-memory counters).
     *
     * @returns Module metrics
     *
     * @example
     * getMetrics(): IModuleMetrics {
     *   return {
     *     requestCount: this.metrics.requests,
     *     errorCount: this.metrics.errors,
     *     avgResponseTime: this.metrics.avgTime,
     *     activeWorkers: this.backgroundWorker?.activeCount || 0,
     *     cacheHitRate: this.cache.hitRate,
     *     eventCount: {
     *       published: this.metrics.eventsPublished,
     *       received: this.metrics.eventsReceived
     *     }
     *   };
     * }
     */
    getMetrics(): IModuleMetrics;
}

/**
 * System-level health status combining status from all loaded modules.
 * Provides aggregate view of system operational status.
 *
 * @interface ISystemHealth
 * @example
 * {
 *   status: 'degraded',
 *   modules: {
 *     'orders': { status: 'healthy', lastChecked: new Date() },
 *     'payments': { status: 'unhealthy', lastChecked: new Date() }
 *   },
 *   checkedAt: new Date()
 * }
 */
export interface ISystemHealth {
    /** Overall system status */
    status: 'healthy' | 'degraded' | 'unhealthy';

    /** Health of each loaded module */
    modules: Record<
        string,
        {
            status: 'healthy' | 'degraded' | 'unhealthy';
            lastChecked: Date;
        }
    >;

    /** Timestamp of this health check */
    checkedAt: Date;
}

/**
 * System-level metrics combining statistics from all loaded modules.
 * Provides aggregate performance view across the entire system.
 *
 * @interface ISystemMetrics
 * @example
 * {
 *   totalRequests: 125000,
 *   totalErrors: 89,
 *   avgResponseTime: 234,
 *   modules: { ... },
 *   collectedAt: new Date()
 * }
 */
export interface ISystemMetrics {
    /** Total requests across all modules */
    totalRequests: number;

    /** Total errors across all modules */
    totalErrors: number;

    /** System-wide average response time */
    avgResponseTime: number;

    /** Metrics per module */
    modules: Record<string, IModuleMetrics>;

    /** Timestamp of metrics collection */
    collectedAt: Date;
}
