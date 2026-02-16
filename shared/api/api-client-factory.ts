/**
 * Generic API Client Factory for managing 10+ external API integrations.
 *
 * Provides centralized factory pattern for creating and managing API clients
 * with consistent resilience patterns across all integrations.
 *
 * Each API gets its own:
 * - Circuit breaker for fault tolerance
 * - Rate limiter for API compliance
 * - Retry logic with exponential backoff
 * - Health monitoring and metrics
 * - Request/response logging
 *
 * Registered APIs:
 * - SmartBill (ERP invoicing)
 * - WooCommerce (e-commerce platform)
 * - Aca Lighting, Masterled, Arelux, Brayton, FSL (supplier scraping)
 * - FanCourier, SameDay, DPD (shipping APIs - placeholder)
 * - Stripe, Netopia (payment APIs - placeholder)
 * - Mailgun, SendGrid (email APIs - placeholder)
 *
 * @module shared/api/api-client-factory
 */

import { ApiClient, ApiClientConfig } from './api-client';
import ApiRegistry, { ApiConfig } from './api-registry';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('api-client-factory');

/**
 * API health report from factory.
 *
 * @interface ApiHealthReport
 */
export interface ApiHealthReport {
  /** Timestamp of report generation */
  timestamp: Date;
  /** Overall system health */
  healthy: boolean;
  /** Individual API statuses */
  apis: Array<{
    /** API name */
    name: string;
    /** Display name */
    displayName: string;
    /** Whether API is enabled */
    enabled: boolean;
    /** Whether API client is healthy */
    healthy: boolean;
    /** Circuit breaker state */
    circuitState: string;
    /** Current rate limit tokens remaining */
    rateLimitRemaining: number;
  }>;
}

/**
 * API Client Factory.
 *
 * Singleton factory for creating and managing API clients with
 * consistent configuration and resilience patterns.
 *
 * Features:
 * - Lazy loading of API clients
 * - Centralized configuration management
 * - Health monitoring for all APIs
 * - Metrics aggregation
 * - Dynamic API registration
 *
 * @example
 * // Initialize factory
 * ApiClientFactory.initialize();
 *
 * // Get client for known API
 * const smartbillClient = ApiClientFactory.getClient('smartbill');
 * const invoice = await smartbillClient.get('/invoices/123');
 *
 * // Get health report
 * const health = ApiClientFactory.getHealth();
 *
 * // Register custom API
 * ApiClientFactory.registerApi({
 *   name: 'custom-api',
 *   // ... config
 * });
 */
export class ApiClientFactory {
  private static readonly clients: Map<string, ApiClient> = new Map();
  private static initialized = false;

  /**
   * Initialize the factory.
   *
   * Must be called once at application startup before creating clients.
   * Validates all enabled API configurations.
   *
   * @example
   * ApiClientFactory.initialize();
   */
  static initialize(): void {
    if (this.initialized) {
      logger.debug('API Client Factory already initialized');
      return;
    }

    // Validate enabled APIs
    const enabledApis = ApiRegistry.getEnabledApis();
    logger.info('Initializing API Client Factory', {
      enabledApis: enabledApis.length,
      apis: enabledApis.map((a) => a.name),
    });

    // Pre-create clients for all enabled APIs
    for (const config of enabledApis) {
      try {
        this.createClient(config.name, config);
      } catch (error) {
        logger.warn('Failed to initialize API client', {
          api: config.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.initialized = true;
    logger.info('API Client Factory initialized', {
      createdClients: this.clients.size,
    });
  }

  /**
   * Create an API client instance.
   *
   * Private helper that creates a new client with resolved configuration.
   *
   * @param apiName - API name
   * @param config - API configuration
   * @returns Created API client
   *
   * @internal
   */
  private static createClient(apiName: string, config: ApiConfig): ApiClient {
    if (this.clients.has(apiName)) {
      return this.clients.get(apiName)!;
    }

    // Convert ApiConfig to ApiClientConfig
    const clientConfig: ApiClientConfig = {
      baseURL: config.baseUrl,
      timeout: config.timeout,
      auth: {
        type: config.auth.type as any,
        token: config.auth.token,
        username: config.auth.username,
        password: config.auth.password,
        headerName: config.auth.headerName,
        customHeaders: config.auth.customHeaders,
      },
      headers: config.headers,
      rateLimit: {
        maxTokens: config.rateLimit.maxTokens,
        refillRate: config.rateLimit.refillRate,
        refillIntervalMs: config.rateLimit.refillIntervalMs,
      },
      circuitBreaker: {
        failureThreshold: config.circuitBreaker.failureThreshold,
        resetTimeout: config.circuitBreaker.resetTimeout,
      },
      retry: {
        attempts: config.retry.attempts,
        backoff: config.retry.backoff,
        baseDelay: config.retry.baseDelay,
      },
    };

    const client = new ApiClient(apiName, clientConfig);
    this.clients.set(apiName, client);

    logger.info('API client created', {
      apiName,
      baseURL: config.baseUrl,
    });

    return client;
  }

  /**
   * Get client for an API.
   *
   * Returns existing client or creates new one if first request.
   * Supports both registered and custom APIs.
   *
   * @param apiName - API name (e.g., 'smartbill', 'woocommerce')
   * @returns API client instance
   * @throws If API not registered
   *
   * @example
   * const client = ApiClientFactory.getClient('smartbill');
   * const warehouses = await client.get('/warehouses');
   */
  static getClient(apiName: string): ApiClient {
    // Return existing client
    if (this.clients.has(apiName)) {
      return this.clients.get(apiName)!;
    }

    // Get config and create new client
    const config = ApiRegistry.getConfig(apiName);
    return this.createClient(apiName, config);
  }

  /**
   * Register a custom API at runtime.
   *
   * Adds new API configuration and creates corresponding client.
   *
   * @param config - API configuration
   * @throws If API already registered
   *
   * @example
   * ApiClientFactory.registerApi({
   *   name: 'my-custom-api',
   *   displayName: 'My Custom API',
   *   baseUrl: 'https://api.custom.com',
   *   auth: { type: 'bearer', token: 'token123' },
   *   // ... rest of config
   * });
   *
   * const client = ApiClientFactory.getClient('my-custom-api');
   */
  static registerApi(config: ApiConfig): void {
    ApiRegistry.registerApi(config);
    this.createClient(config.name, config);

    logger.info('Custom API registered via factory', {
      name: config.name,
      displayName: config.displayName,
    });
  }

  /**
   * Get all active API clients.
   *
   * @returns Map of API name to client
   *
   * @example
   * const allClients = ApiClientFactory.getAllClients();
   * for (const [name, client] of allClients) {
   *   console.log(`${name}: ${client.getMetrics().avgResponseTime}ms`);
   * }
   */
  static getAllClients(): Map<string, ApiClient> {
    const result = new Map<string, ApiClient>();
    for (const [key, value] of Array.from(this.clients.entries())) {
      result.set(key, value);
    }
    return result;
  }

  /**
   * Get health status of all registered APIs.
   *
   * @returns Comprehensive health report
   *
   * @example
   * const health = ApiClientFactory.getHealth();
   * if (!health.healthy) {
   *   logger.error('Some APIs are down', health.apis);
   * }
   */
  static getHealth(): ApiHealthReport {
    const entries = Array.from(this.clients.entries());
    const apis = entries.map(([name, client]) => {
      const health = client.getHealth();
      const metrics = client.getMetrics();
      const registryConfig = ApiRegistry.getConfig(name);

      return {
        name,
        displayName: registryConfig.displayName,
        enabled: registryConfig.enabled,
        healthy: health.isHealthy,
        circuitState: health.circuitState,
        rateLimitRemaining: metrics.rateLimitRemaining,
      };
    });

    const healthy = apis.every((a) => !a.enabled || a.healthy);

    return {
      timestamp: new Date(),
      healthy,
      apis,
    };
  }

  /**
   * Get aggregated metrics from all clients.
   *
   * @returns Aggregated metrics object
   *
   * @example
   * const metrics = ApiClientFactory.getAggregateMetrics();
   * console.log(`Total requests: ${metrics.totalRequests}`);
   * console.log(`Avg response time: ${metrics.avgResponseTime}ms`);
   */
  static getAggregateMetrics(): {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseTime: number;
    cacheHits: number;
    cacheMisses: number;
    circuitOpenCount: number;
  } {
    let totalRequests = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalResponseTime = 0;
    let cacheHits = 0;
    let cacheMisses = 0;
    let circuitOpenCount = 0;

    const entries = Array.from(this.clients.entries());
    for (const [, client] of entries) {
      const metrics = client.getMetrics();
      totalRequests += metrics.totalRequests;
      successCount += metrics.successCount;
      errorCount += metrics.errorCount;
      totalResponseTime += metrics.avgResponseTime * metrics.totalRequests;
      cacheHits += metrics.cacheHits;
      cacheMisses += metrics.cacheMisses;

      if (metrics.circuitBreakerState === 'OPEN') {
        circuitOpenCount++;
      }
    }

    return {
      totalRequests,
      successCount,
      errorCount,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      cacheHits,
      cacheMisses,
      circuitOpenCount,
    };
  }

  /**
   * Reset all API clients.
   *
   * Clears metrics, resets circuit breakers, and flushes caches.
   * Useful after recovering from service issues or for testing.
   *
   * @example
   * ApiClientFactory.resetAll();
   */
  static resetAll(): void {
    for (const client of this.clients.values()) {
      client.reset();
    }

    logger.info('All API clients reset');
  }

  /**
   * Destroy all API clients and clean up resources.
   *
   * Call when factory is no longer needed (e.g., application shutdown).
   *
   * @example
   * ApiClientFactory.destroy();
   */
  static destroy(): void {
    for (const client of this.clients.values()) {
      client.destroy();
    }

    this.clients.clear();
    this.initialized = false;

    logger.info('API Client Factory destroyed');
  }

  /**
   * Check if an API is currently healthy and available.
   *
   * @param apiName - API name
   * @returns true if API is healthy
   *
   * @example
   * if (ApiClientFactory.isHealthy('smartbill')) {
   *   // Safe to make requests
   * }
   */
  static isHealthy(apiName: string): boolean {
    const client = this.clients.get(apiName);
    if (!client) {
      return false;
    }

    return client.getHealth().isHealthy;
  }

  /**
   * Check if factory has been initialized.
   *
   * @returns true if initialized
   *
   * @internal
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
}

export default ApiClientFactory;
