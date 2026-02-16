/**
 * Central registry of all external API integrations.
 *
 * Pre-registers known APIs with their configurations and allows
 * runtime registration of custom APIs.
 *
 * Provides centralized configuration management for all integrations
 * with environment variable support and sensible defaults.
 *
 * @module shared/api/api-registry
 */

import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('api-registry');

/**
 * Authentication configuration for API.
 *
 * @interface ApiAuthConfig
 */
export interface ApiAuthConfig {
  /** Authentication type */
  type: 'bearer' | 'basic' | 'apikey' | 'oauth2' | 'custom';
  /** Token for bearer auth */
  token?: string;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
  /** API key for apikey auth */
  apiKey?: string;
  /** Header name for API key (default: X-API-Key) */
  headerName?: string;
  /** Custom headers for custom auth */
  customHeaders?: Record<string, string>;
  /** OAuth2 refresh strategy */
  refreshStrategy?: 'auto' | 'manual';
}

/**
 * Full API configuration.
 *
 * @interface ApiConfig
 */
export interface ApiConfig {
  /** Unique identifier (e.g., 'smartbill', 'woocommerce') */
  name: string;
  /** Display name for logging */
  displayName: string;
  /** API base URL */
  baseUrl: string;
  /** Authentication configuration */
  auth: ApiAuthConfig;
  /** Rate limiting config */
  rateLimit: {
    /** Max concurrent requests or tokens */
    maxTokens: number;
    /** Requests per second refill rate */
    refillRate: number;
    /** Refill interval in milliseconds */
    refillIntervalMs: number;
  };
  /** Circuit breaker config */
  circuitBreaker: {
    /** Failure threshold before opening */
    failureThreshold: number;
    /** Reset timeout in milliseconds */
    resetTimeout: number;
  };
  /** Retry configuration */
  retry: {
    /** Maximum retry attempts */
    attempts: number;
    /** Backoff strategy */
    backoff: 'linear' | 'exponential';
    /** Base delay in milliseconds */
    baseDelay: number;
  };
  /** Request timeout in milliseconds */
  timeout: number;
  /** Default headers */
  headers?: Record<string, string>;
  /** Health check configuration */
  healthCheck?: {
    /** Health check endpoint path */
    endpoint: string;
    /** Check interval in milliseconds */
    intervalMs: number;
  };
  /** Whether API is enabled */
  enabled: boolean;
  /** API category for organization */
  category: 'erp' | 'ecommerce' | 'supplier' | 'payment' | 'shipping' | 'email' | 'scraper' | 'other';
}

/**
 * API Registry for managing all API integrations.
 *
 * Provides:
 * - Pre-registered configs for known APIs
 * - Runtime registration for custom APIs
 * - Environment variable support
 * - Configuration validation
 * - Global access to all API configs
 *
 * @example
 * // Get config for known API
 * const smartbillConfig = ApiRegistry.getConfig('smartbill');
 *
 * // Register custom API
 * ApiRegistry.registerApi({
 *   name: 'custom-api',
 *   displayName: 'Custom API',
 *   baseUrl: 'https://api.custom.com',
 *   // ... rest of config
 * });
 *
 * // Get all enabled APIs
 * const enabled = ApiRegistry.getEnabledApis();
 */
export class ApiRegistry {
  private static readonly configs: Map<string, ApiConfig> = new Map();
  private static initialized = false;

  /**
   * Initialize the registry with all known APIs.
   *
   * Must be called once at startup before using registry.
   *
   * @internal
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // ERP APIs
    this.registerBuiltinApi(this.createSmartBillConfig());

    // E-commerce APIs
    this.registerBuiltinApi(this.createWooCommerceConfig());

    // Supplier/Scraper APIs
    this.registerBuiltinApi(this.createAcaLightingConfig());
    this.registerBuiltinApi(this.createMasterledConfig());
    this.registerBuiltinApi(this.createAreluxConfig());
    this.registerBuiltinApi(this.createBraytonConfig());
    this.registerBuiltinApi(this.createFslConfig());

    // Placeholder APIs for future integration
    this.registerBuiltinApi(this.createFanCourierConfig());
    this.registerBuiltinApi(this.createSameDayConfig());
    this.registerBuiltinApi(this.createDpdConfig());
    this.registerBuiltinApi(this.createStripeConfig());
    this.registerBuiltinApi(this.createNetopiaConfig());
    this.registerBuiltinApi(this.createMailgunConfig());
    this.registerBuiltinApi(this.createSendGridConfig());

    this.initialized = true;

    logger.info('API Registry initialized', {
      totalApis: this.configs.size,
      enabledApis: Array.from(this.configs.values()).filter((c) => c.enabled).length,
    });
  }

  /**
   * Register a built-in API configuration.
   *
   * @param config - API configuration
   *
   * @internal
   */
  private static registerBuiltinApi(config: ApiConfig): void {
    this.configs.set(config.name, config);
  }

  /**
   * Register a custom API configuration.
   *
   * @param config - API configuration
   * @throws If API already registered
   *
   * @example
   * ApiRegistry.registerApi({
   *   name: 'my-api',
   *   displayName: 'My Custom API',
   *   baseUrl: 'https://api.myservice.com',
   *   // ... rest of config
   * });
   */
  static registerApi(config: ApiConfig): void {
    if (this.configs.has(config.name)) {
      throw new Error(`API '${config.name}' is already registered`);
    }

    this.configs.set(config.name, config);

    logger.info('Custom API registered', {
      name: config.name,
      displayName: config.displayName,
      category: config.category,
    });
  }

  /**
   * Get configuration for an API.
   *
   * @param apiName - API name
   * @returns API configuration
   * @throws If API not found
   *
   * @example
   * const config = ApiRegistry.getConfig('smartbill');
   */
  static getConfig(apiName: string): ApiConfig {
    const config = this.configs.get(apiName);
    if (!config) {
      throw new Error(`API '${apiName}' not found in registry`);
    }
    return config;
  }

  /**
   * Get all enabled API configurations.
   *
   * @returns Array of enabled API configs
   *
   * @example
   * const enabled = ApiRegistry.getEnabledApis();
   */
  static getEnabledApis(): ApiConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.enabled);
  }

  /**
   * Get APIs by category.
   *
   * @param category - API category
   * @returns Matching API configurations
   *
   * @example
   * const shippingApis = ApiRegistry.getByCategory('shipping');
   */
  static getByCategory(category: ApiConfig['category']): ApiConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.category === category && c.enabled);
  }

  /**
   * Check if API is registered.
   *
   * @param apiName - API name
   * @returns true if registered
   */
  static has(apiName: string): boolean {
    return this.configs.has(apiName);
  }

  /**
   * List all registered APIs (enabled and disabled).
   *
   * @returns Array of API names
   */
  static listAll(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Update API configuration.
   *
   * @param apiName - API name
   * @param updates - Partial config updates
   * @throws If API not found
   *
   * @example
   * ApiRegistry.updateConfig('smartbill', {
   *   baseUrl: 'https://new.api.url'
   * });
   */
  static updateConfig(apiName: string, updates: Partial<ApiConfig>): void {
    const config = this.getConfig(apiName);
    Object.assign(config, updates);

    logger.info('API config updated', {
      name: apiName,
      updates: Object.keys(updates),
    });
  }

  /**
   * Enable an API.
   *
   * @param apiName - API name
   * @throws If API not found
   */
  static enableApi(apiName: string): void {
    const config = this.getConfig(apiName);
    config.enabled = true;

    logger.info('API enabled', { name: apiName });
  }

  /**
   * Disable an API.
   *
   * @param apiName - API name
   * @throws If API not found
   */
  static disableApi(apiName: string): void {
    const config = this.getConfig(apiName);
    config.enabled = false;

    logger.info('API disabled', { name: apiName });
  }

  // ==================== Built-in API Configs ====================

  /**
   * SmartBill API configuration.
   *
   * @returns SmartBill API config
   *
   * @internal
   */
  private static createSmartBillConfig(): ApiConfig {
    return {
      name: 'smartbill',
      displayName: 'SmartBill',
      baseUrl: process.env.SMARTBILL_API_URL || 'https://ws.smartbill.ro/SBORO/api',
      auth: {
        type: 'basic',
        username: process.env.SMARTBILL_USERNAME || '',
        password: process.env.SMARTBILL_TOKEN || '',
      },
      rateLimit: {
        maxTokens: 10,
        refillRate: 0.167, // 10 per minute
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 30000,
      enabled: Boolean(process.env.SMARTBILL_ENABLED !== 'false'),
      category: 'erp',
      healthCheck: {
        endpoint: '/warehouses',
        intervalMs: 300000, // 5 minutes
      },
    };
  }

  /**
   * WooCommerce API configuration.
   *
   * @returns WooCommerce API config
   *
   * @internal
   */
  private static createWooCommerceConfig(): ApiConfig {
    return {
      name: 'woocommerce',
      displayName: 'WooCommerce',
      baseUrl: process.env.WOOCOMMERCE_URL || '',
      auth: {
        type: 'basic',
        username: process.env.WOOCOMMERCE_KEY || '',
        password: process.env.WOOCOMMERCE_SECRET || '',
      },
      rateLimit: {
        maxTokens: 50,
        refillRate: 0.833, // 50 per minute
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 15000,
      enabled: Boolean(process.env.WOOCOMMERCE_ENABLED !== 'false'),
      category: 'ecommerce',
      healthCheck: {
        endpoint: '/wp-json/wc/v3/system_status',
        intervalMs: 300000,
      },
    };
  }

  /**
   * Aca Lighting API configuration (scraper).
   *
   * @returns Aca Lighting config
   *
   * @internal
   */
  private static createAcaLightingConfig(): ApiConfig {
    return {
      name: 'aca-lighting',
      displayName: 'Aca Lighting',
      baseUrl: process.env.ACA_LIGHTING_URL || 'https://www.acalighting.com',
      auth: { type: 'custom' },
      rateLimit: {
        maxTokens: 5,
        refillRate: 0.083, // 5 per minute
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 60000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 2000,
      },
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cypher ERP)',
      },
      enabled: Boolean(process.env.ACA_LIGHTING_ENABLED !== 'false'),
      category: 'scraper',
    };
  }

  /**
   * Masterled API configuration (scraper).
   *
   * @returns Masterled config
   *
   * @internal
   */
  private static createMasterledConfig(): ApiConfig {
    return {
      name: 'masterled',
      displayName: 'Masterled',
      baseUrl: process.env.MASTERLED_URL || 'https://www.masterled.ro',
      auth: { type: 'custom' },
      rateLimit: {
        maxTokens: 5,
        refillRate: 0.083,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 60000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 2000,
      },
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cypher ERP)',
      },
      enabled: Boolean(process.env.MASTERLED_ENABLED !== 'false'),
      category: 'scraper',
    };
  }

  /**
   * Arelux API configuration (scraper).
   *
   * @returns Arelux config
   *
   * @internal
   */
  private static createAreluxConfig(): ApiConfig {
    return {
      name: 'arelux',
      displayName: 'Arelux',
      baseUrl: process.env.ARELUX_URL || 'https://www.arelux.com',
      auth: { type: 'custom' },
      rateLimit: {
        maxTokens: 5,
        refillRate: 0.083,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 60000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 2000,
      },
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cypher ERP)',
      },
      enabled: Boolean(process.env.ARELUX_ENABLED !== 'false'),
      category: 'scraper',
    };
  }

  /**
   * Brayton API configuration (scraper).
   *
   * @returns Brayton config
   *
   * @internal
   */
  private static createBraytonConfig(): ApiConfig {
    return {
      name: 'brayton',
      displayName: 'Brayton',
      baseUrl: process.env.BRAYTON_URL || 'https://www.brayton.ro',
      auth: { type: 'custom' },
      rateLimit: {
        maxTokens: 5,
        refillRate: 0.083,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 60000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 2000,
      },
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cypher ERP)',
      },
      enabled: Boolean(process.env.BRAYTON_ENABLED !== 'false'),
      category: 'scraper',
    };
  }

  /**
   * FSL API configuration (scraper).
   *
   * @returns FSL config
   *
   * @internal
   */
  private static createFslConfig(): ApiConfig {
    return {
      name: 'fsl',
      displayName: 'FSL',
      baseUrl: process.env.FSL_URL || 'https://www.fsl.ro',
      auth: { type: 'custom' },
      rateLimit: {
        maxTokens: 5,
        refillRate: 0.083,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 60000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 2000,
      },
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cypher ERP)',
      },
      enabled: Boolean(process.env.FSL_ENABLED !== 'false'),
      category: 'scraper',
    };
  }

  // ==================== Placeholder Configs ====================

  /**
   * FanCourier shipping API configuration (placeholder).
   *
   * @returns FanCourier config
   *
   * @internal
   */
  private static createFanCourierConfig(): ApiConfig {
    return {
      name: 'fancourier',
      displayName: 'FanCourier',
      baseUrl: process.env.FANCOURIER_API_URL || 'https://api.fancourier.ro',
      auth: {
        type: 'apikey',
        apiKey: process.env.FANCOURIER_API_KEY || '',
      },
      rateLimit: {
        maxTokens: 30,
        refillRate: 0.5,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 15000,
      enabled: Boolean(process.env.FANCOURIER_ENABLED === 'true'),
      category: 'shipping',
    };
  }

  /**
   * SameDay shipping API configuration (placeholder).
   *
   * @returns SameDay config
   *
   * @internal
   */
  private static createSameDayConfig(): ApiConfig {
    return {
      name: 'sameday',
      displayName: 'SameDay',
      baseUrl: process.env.SAMEDAY_API_URL || 'https://api.sameday.ro',
      auth: {
        type: 'apikey',
        apiKey: process.env.SAMEDAY_API_KEY || '',
      },
      rateLimit: {
        maxTokens: 30,
        refillRate: 0.5,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 15000,
      enabled: Boolean(process.env.SAMEDAY_ENABLED === 'true'),
      category: 'shipping',
    };
  }

  /**
   * DPD shipping API configuration (placeholder).
   *
   * @returns DPD config
   *
   * @internal
   */
  private static createDpdConfig(): ApiConfig {
    return {
      name: 'dpd',
      displayName: 'DPD',
      baseUrl: process.env.DPD_API_URL || 'https://api.dpd.ro',
      auth: {
        type: 'apikey',
        apiKey: process.env.DPD_API_KEY || '',
      },
      rateLimit: {
        maxTokens: 30,
        refillRate: 0.5,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 15000,
      enabled: Boolean(process.env.DPD_ENABLED === 'true'),
      category: 'shipping',
    };
  }

  /**
   * Stripe payment API configuration (placeholder).
   *
   * @returns Stripe config
   *
   * @internal
   */
  private static createStripeConfig(): ApiConfig {
    return {
      name: 'stripe',
      displayName: 'Stripe',
      baseUrl: 'https://api.stripe.com/v1',
      auth: {
        type: 'bearer',
        token: process.env.STRIPE_SECRET_KEY || '',
      },
      rateLimit: {
        maxTokens: 100,
        refillRate: 1,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 20000,
      enabled: Boolean(process.env.STRIPE_ENABLED === 'true'),
      category: 'payment',
    };
  }

  /**
   * Netopia payment API configuration (placeholder).
   *
   * @returns Netopia config
   *
   * @internal
   */
  private static createNetopiaConfig(): ApiConfig {
    return {
      name: 'netopia',
      displayName: 'Netopia',
      baseUrl: process.env.NETOPIA_API_URL || 'https://api.netopia.com',
      auth: {
        type: 'apikey',
        apiKey: process.env.NETOPIA_API_KEY || '',
      },
      rateLimit: {
        maxTokens: 100,
        refillRate: 1,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 20000,
      enabled: Boolean(process.env.NETOPIA_ENABLED === 'true'),
      category: 'payment',
    };
  }

  /**
   * Mailgun email API configuration (placeholder).
   *
   * @returns Mailgun config
   *
   * @internal
   */
  private static createMailgunConfig(): ApiConfig {
    return {
      name: 'mailgun',
      displayName: 'Mailgun',
      baseUrl: process.env.MAILGUN_API_URL || 'https://api.mailgun.net/v3',
      auth: {
        type: 'bearer',
        token: process.env.MAILGUN_API_KEY || '',
      },
      rateLimit: {
        maxTokens: 600,
        refillRate: 10,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 10000,
      enabled: Boolean(process.env.MAILGUN_ENABLED === 'true'),
      category: 'email',
    };
  }

  /**
   * SendGrid email API configuration (placeholder).
   *
   * @returns SendGrid config
   *
   * @internal
   */
  private static createSendGridConfig(): ApiConfig {
    return {
      name: 'sendgrid',
      displayName: 'SendGrid',
      baseUrl: 'https://api.sendgrid.com/v3',
      auth: {
        type: 'bearer',
        token: process.env.SENDGRID_API_KEY || '',
      },
      rateLimit: {
        maxTokens: 600,
        refillRate: 10,
        refillIntervalMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        baseDelay: 1000,
      },
      timeout: 10000,
      enabled: Boolean(process.env.SENDGRID_ENABLED === 'true'),
      category: 'email',
    };
  }
}

// Initialize registry on module load
ApiRegistry.initialize();

export default ApiRegistry;
