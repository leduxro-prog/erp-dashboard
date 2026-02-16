/**
 * Type-safe generic API client with built-in resilience patterns.
 *
 * Wraps axios with circuit breaker, rate limiting, retry logic,
 * request deduplication, response caching, and structured logging.
 *
 * Provides unified interface for all external API integrations.
 *
 * @module shared/api/api-client
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { CircuitBreaker, CircuitBreakerStats, CircuitState } from '../utils/circuit-breaker';
import { TokenBucketRateLimiter, RateLimiterMetrics } from './rate-limiter';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('api-client');

/**
 * Standardized API response structure.
 *
 * @interface ApiResponse
 * @template T - Response data type
 */
export interface ApiResponse<T> {
  /** Response payload */
  data: T;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Request duration in milliseconds */
  duration: number;
  /** Number of retries attempted */
  retryCount: number;
  /** Whether response came from cache */
  fromCache: boolean;
}

/**
 * Single API request in a batch.
 *
 * @interface ApiRequest
 */
export interface ApiRequest {
  /** HTTP method */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Request path (relative to baseURL) */
  path: string;
  /** Query parameters for GET requests */
  params?: Record<string, unknown>;
  /** Request body for POST/PUT/PATCH */
  data?: unknown;
}

/**
 * Batch request response.
 *
 * @interface BatchResponse
 */
export interface BatchResponse {
  /** HTTP method that was used */
  method: string;
  /** Request path */
  path: string;
  /** HTTP status code */
  status: number;
  /** Response data */
  data: unknown;
  /** Error if request failed */
  error?: string;
}

/**
 * API client health status.
 *
 * @interface ApiClientHealth
 */
export interface ApiClientHealth {
  /** Whether client is healthy (circuit not open) */
  isHealthy: boolean;
  /** Circuit breaker state */
  circuitState: CircuitState;
  /** Circuit breaker statistics */
  circuitStats: CircuitBreakerStats;
  /** Rate limiter metrics */
  rateLimitMetrics: RateLimiterMetrics;
}

/**
 * API client performance metrics.
 *
 * @interface ApiClientMetrics
 */
export interface ApiClientMetrics {
  /** Total requests made */
  totalRequests: number;
  /** Successful requests */
  successCount: number;
  /** Failed requests */
  errorCount: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** 95th percentile response time */
  p95ResponseTime: number;
  /** Current circuit breaker state */
  circuitBreakerState: string;
  /** Tokens remaining in rate limit bucket */
  rateLimitRemaining: number;
  /** Total cache hits */
  cacheHits: number;
  /** Total cache misses */
  cacheMisses: number;
}

/**
 * Generic API Client Interface.
 *
 * Defines contract for type-safe API calls with built-in resilience.
 *
 * @interface IApiClient
 */
export interface IApiClient {
  /**
   * Make a GET request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param params - Query parameters
   * @returns Response promise
   */
  get<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>>;

  /**
   * Make a POST request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param data - Request body
   * @returns Response promise
   */
  post<T>(path: string, data: unknown): Promise<ApiResponse<T>>;

  /**
   * Make a PUT request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param data - Request body
   * @returns Response promise
   */
  put<T>(path: string, data: unknown): Promise<ApiResponse<T>>;

  /**
   * Make a PATCH request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param data - Request body
   * @returns Response promise
   */
  patch<T>(path: string, data: unknown): Promise<ApiResponse<T>>;

  /**
   * Make a DELETE request.
   *
   * @template T - Response type
   * @param path - Request path
   * @returns Response promise
   */
  delete<T>(path: string): Promise<ApiResponse<T>>;

  /**
   * Execute multiple requests with controlled concurrency.
   *
   * @template T - Response type
   * @param requests - Array of requests to execute
   * @param concurrency - Max concurrent requests (default: 5)
   * @returns Array of responses in same order as requests
   */
  batch<T>(requests: ApiRequest[], concurrency?: number): Promise<BatchResponse[]>;

  /**
   * Stream large responses as async generator.
   *
   * @param path - Request path
   * @param params - Query parameters
   * @returns Async generator yielding buffers
   */
  stream(path: string, params?: Record<string, unknown>): AsyncGenerator<Buffer>;

  /**
   * Get client health status and circuit state.
   *
   * @returns Health status object
   */
  getHealth(): ApiClientHealth;

  /**
   * Get performance metrics.
   *
   * @returns Metrics object
   */
  getMetrics(): ApiClientMetrics;
}

/**
 * Generic API Client Implementation.
 *
 * Provides type-safe API calls with automatic:
 * - Circuit breaker protection
 * - Rate limiting
 * - Retry with exponential backoff
 * - Request/response logging
 * - Response caching (configurable TTL)
 * - Request deduplication
 * - Timeout handling
 * - Batch operations
 * - Streaming support
 *
 * @example
 * const client = new ApiClient('smartbill', {
 *   baseURL: 'https://api.smartbill.ro',
 *   auth: { token: 'token123' },
 *   timeout: 30000,
 *   rateLimit: { maxTokens: 10, refillRate: 0.167, refillIntervalMs: 1000 },
 *   circuitBreaker: { failureThreshold: 5, resetTimeout: 30000 },
 *   retry: { attempts: 3, backoff: 'exponential', baseDelay: 1000 },
 * });
 *
 * const invoice = await client.post('/invoices', invoiceData);
 * const health = client.getHealth();
 */
export class ApiClient implements IApiClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly apiName: string;
  private readonly config: ApiClientConfig;

  // Metrics tracking
  private readonly responseTimes: number[] = [];
  private successCount: number = 0;
  private errorCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private readonly maxSamples = 1000;

  // Response caching
  private readonly cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly cacheTTL: Map<string, number> = new Map();

  // Request deduplication
  private readonly pendingRequests: Map<string, Promise<unknown>> = new Map();

  /**
   * Create a new API client instance.
   *
   * @param apiName - Name of the API (e.g., 'smartbill', 'woocommerce')
   * @param config - Client configuration
   *
   * @example
   * new ApiClient('smartbill', {
   *   baseURL: 'https://api.smartbill.ro',
   *   auth: { token: 'token123' },
   *   timeout: 30000,
   * })
   */
  constructor(apiName: string, config: ApiClientConfig) {
    this.apiName = apiName;
    this.config = config;

    // Initialize axios instance
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
        ...this.buildAuthHeaders(config.auth),
      },
    });

    // Add request/response interceptors
    this.setupInterceptors();

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(`${apiName}-api`, {
      failureThreshold: config.circuitBreaker?.failureThreshold || 5,
      resetTimeout: config.circuitBreaker?.resetTimeout || 30000,
      monitorInterval: 10000,
      timeout: config.timeout || 30000,
      volumeThreshold: 10,
      errorFilter: (err) => this.shouldCountAsCircuitBreakerFailure(err),
    });

    // Initialize rate limiter
    this.rateLimiter = new TokenBucketRateLimiter({
      maxTokens: config.rateLimit?.maxTokens || 100,
      refillRate: config.rateLimit?.refillRate || 1,
      refillIntervalMs: config.rateLimit?.refillIntervalMs || 1000,
      name: `${apiName}-limiter`,
    });

    logger.info('API client created', {
      apiName,
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      auth: config.auth?.type,
    });
  }

  /**
   * Build authentication headers based on auth config.
   *
   * @param auth - Authentication configuration
   * @returns Headers object
   *
   * @internal
   */
  private buildAuthHeaders(auth: ApiClientConfig['auth']): Record<string, string> {
    if (!auth) return {};

    const headers: Record<string, string> = {};

    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.token}`;
        break;
      case 'basic':
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;
      case 'apikey':
        headers[auth.headerName || 'X-API-Key'] = auth.token as string;
        break;
      case 'custom':
        return auth.customHeaders || {};
    }

    return headers;
  }

  /**
   * Setup request and response interceptors.
   *
   * @internal
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config.metadata?.startTime || Date.now());
        this.recordMetric(duration);
        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Determine if error should count as circuit breaker failure.
   *
   * @param error - The error to evaluate
   * @returns true if error counts as failure
   *
   * @internal
   */
  private shouldCountAsCircuitBreakerFailure(error: Error): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // Only count 5xx and network errors as failures
      // 4xx errors are client errors (not service issues)
      return status === undefined || status >= 500;
    }
    return true;
  }

  /**
   * Record response time metric.
   *
   * @param duration - Response duration in milliseconds
   *
   * @internal
   */
  private recordMetric(duration: number): void {
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }
  }

  /**
   * Get cache key for a GET request.
   *
   * @param path - Request path
   * @param params - Query parameters
   * @returns Cache key
   *
   * @internal
   */
  private getCacheKey(path: string, params?: Record<string, unknown>): string {
    const queryString = params ? JSON.stringify(params) : '';
    return `${path}:${queryString}`;
  }

  /**
   * Execute a request with resilience patterns.
   *
   * @param method - HTTP method
   * @param path - Request path
   * @param data - Request body
   * @param params - Query parameters
   * @returns API response
   *
   * @internal
   */
  private async executeRequest<T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    data?: unknown,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const maxAttempts = this.config.retry?.attempts || 3;
    const backoffType = this.config.retry?.backoff || 'exponential';
    const baseDelay = this.config.retry?.baseDelay || 1000;

    let lastError: any;

    // Rate limit before attempting
    await this.rateLimiter.acquire();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.circuitBreaker.execute(async () => {
          const axiosResponse = await this.axiosInstance.request<T>({
            method,
            url: path,
            data,
            params,
          });

          return axiosResponse;
        });

        const duration = Date.now() - startTime;
        this.successCount++;

        // Convert headers to Record<string, string>
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          headers[key] = String(value);
        }

        // Record response time
        this.responseTimes.push(duration);
        if (this.responseTimes.length > this.maxSamples) {
          this.responseTimes.shift();
        }

        return {
          data: response.data,
          status: response.status,
          headers,
          duration,
          retryCount: attempt,
          fromCache: false,
        };
      } catch (error: any) {
        lastError = error;
        this.errorCount++;

        // Check if should retry
        const isLastAttempt = attempt === maxAttempts - 1;
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || isLastAttempt) {
          logger.error(`Request failed (attempt ${attempt + 1}/${maxAttempts})`, {
            apiName: this.apiName,
            method,
            path,
            error: error.message,
            status: error.response?.status,
            code: error.code,
          });
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay =
          backoffType === 'exponential'
            ? baseDelay * Math.pow(2, attempt)
            : baseDelay * (attempt + 1);

        // Check for Retry-After header (rate limiting)
        const retryAfter = error.response?.headers?.['retry-after'];
        const actualDelay = retryAfter ? parseInt(retryAfter) * 1000 : delay;

        logger.warn(`Request failed, retrying...`, {
          apiName: this.apiName,
          method,
          path,
          attempt: attempt + 1,
          maxAttempts,
          delay: actualDelay,
          error: error.message,
          status: error.response?.status,
        });

        await this.sleep(actualDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable.
   *
   * @param error - Error to check
   * @returns True if error should trigger retry
   *
   * @internal
   */
  private isRetryableError(error: any): boolean {
    // Network errors (connection refused, timeout, etc.)
    if (error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ENETUNREACH' ||
        error.code === 'EAI_AGAIN') {
      return true;
    }

    // No response (network issue)
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Server errors (5xx) - likely transient
    if (status >= 500 && status < 600) {
      return true;
    }

    // Rate limiting (429)
    if (status === 429) {
      return true;
    }

    // Service unavailable (503)
    if (status === 503) {
      return true;
    }

    // Gateway timeout (504)
    if (status === 504) {
      return true;
    }

    // Don't retry client errors (4xx)
    return false;
  }

  /**
   * Sleep for specified milliseconds.
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   *
   * @internal
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make a GET request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param params - Query parameters
   * @returns API response
   *
   * @example
   * const response = await client.get<Invoice>('/invoices/123');
   */
  async get<T>(path: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey(path, params);
    const cached = this.cache.get(cacheKey);

    // Check cache validity
    if (cached) {
      const ttl = this.cacheTTL.get(cacheKey) || 0;
      if (Date.now() - cached.timestamp < ttl) {
        this.cacheHits++;
        const duration = Date.now() - cached.timestamp;

        return {
          data: cached.data as T,
          status: 200,
          headers: {},
          duration,
          retryCount: 0,
          fromCache: true,
        };
      }
    }

    // Check for pending identical requests (deduplication)
    if (this.pendingRequests.has(cacheKey)) {
      const pending = this.pendingRequests.get(cacheKey);
      return pending as Promise<ApiResponse<T>>;
    }

    // Execute new request
    this.cacheMisses++;
    const promise = this.executeRequest<T>('get', path, undefined, params);

    // Store pending request for deduplication
    this.pendingRequests.set(cacheKey, promise);

    try {
      const result = await promise;
      // Cache successful responses (default 60 second TTL)
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      });
      this.cacheTTL.set(cacheKey, 60000); // 60 second default TTL

      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Make a POST request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param data - Request body
   * @returns API response
   *
   * @example
   * const response = await client.post<Invoice>('/invoices', invoiceData);
   */
  async post<T>(path: string, data: unknown): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('post', path, data);
  }

  /**
   * Make a PUT request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param data - Request body
   * @returns API response
   *
   * @example
   * const response = await client.put<Invoice>('/invoices/123', updatedData);
   */
  async put<T>(path: string, data: unknown): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('put', path, data);
  }

  /**
   * Make a PATCH request.
   *
   * @template T - Response type
   * @param path - Request path
   * @param data - Request body
   * @returns API response
   *
   * @example
   * const response = await client.patch<Invoice>('/invoices/123', partialData);
   */
  async patch<T>(path: string, data: unknown): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('patch', path, data);
  }

  /**
   * Make a DELETE request.
   *
   * @template T - Response type
   * @param path - Request path
   * @returns API response
   *
   * @example
   * const response = await client.delete<void>('/invoices/123');
   */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('delete', path);
  }

  /**
   * Execute multiple requests with controlled concurrency.
   *
   * Processes requests in parallel with max concurrency limit to avoid
   * overwhelming the API or local resources.
   *
   * @template T - Response type
   * @param requests - Array of requests to execute
   * @param concurrency - Max concurrent requests (default: 5)
   * @returns Array of responses in same order as requests
   *
   * @example
   * const responses = await client.batch<Product>([
   *   { method: 'get', path: '/products/1' },
   *   { method: 'get', path: '/products/2' },
   *   { method: 'get', path: '/products/3' },
   * ], 2);
   */
  async batch<T>(requests: ApiRequest[], concurrency: number = 5): Promise<BatchResponse[]> {
    const results: BatchResponse[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < requests.length; i++) {
      const executeRequest = (async () => {
        const req = requests[i];
        try {
          const response = await this.executeRequest(req.method, req.path, req.data, req.params);
          results[i] = {
            method: req.method.toUpperCase(),
            path: req.path,
            status: response.status,
            data: response.data,
          };
        } catch (error) {
          results[i] = {
            method: req.method.toUpperCase(),
            path: req.path,
            status: 500,
            data: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })();

      executing.push(executeRequest);

      // Wait for oldest request to complete if we've queued enough
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex((p) => p === executeRequest), 1);
      }
    }

    // Wait for remaining requests
    await Promise.all(executing);

    return results;
  }

  /**
   * Stream large responses as async generator.
   *
   * Useful for downloading large files or streaming API responses
   * without loading entire response into memory.
   *
   * @param path - Request path
   * @param params - Query parameters
   * @returns Async generator yielding buffers
   *
   * @example
   * for await (const chunk of client.stream('/large-file')) {
   *   process.stdout.write(chunk);
   * }
   */
  async *stream(path: string, params?: Record<string, unknown>): AsyncGenerator<Buffer> {
    await this.rateLimiter.acquire();

    const response = await this.axiosInstance.get(path, {
      params,
      responseType: 'stream',
    });

    for await (const chunk of response.data) {
      yield Buffer.from(chunk);
    }
  }

  /**
   * Get client health status.
   *
   * @returns Health status including circuit state and rate limit status
   *
   * @example
   * const health = client.getHealth();
   * if (health.isHealthy) {
   *   console.log('API is healthy');
   * }
   */
  getHealth(): ApiClientHealth {
    const circuitStats = this.circuitBreaker.getStats();

    return {
      isHealthy: circuitStats.state !== CircuitState.OPEN,
      circuitState: circuitStats.state,
      circuitStats,
      rateLimitMetrics: this.rateLimiter.getMetrics(),
    };
  }

  /**
   * Get performance metrics.
   *
   * @returns Metrics including request counts, response times, and cache stats
   *
   * @example
   * const metrics = client.getMetrics();
   * console.log(`Avg response time: ${metrics.avgResponseTime}ms`);
   * console.log(`Cache hit rate: ${metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)}`);
   */
  getMetrics(): ApiClientMetrics {
    const totalRequests = this.successCount + this.errorCount;
    const avgResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
        : 0;

    // Calculate p95 (95th percentile)
    let p95ResponseTime = 0;
    if (this.responseTimes.length > 0) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.95);
      p95ResponseTime = sorted[index] || 0;
    }

    const circuitStats = this.circuitBreaker.getStats();
    const rateLimitMetrics = this.rateLimiter.getMetrics();

    return {
      totalRequests,
      successCount: this.successCount,
      errorCount: this.errorCount,
      avgResponseTime,
      p95ResponseTime,
      circuitBreakerState: circuitStats.state,
      rateLimitRemaining: Math.floor(rateLimitMetrics.currentTokens),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
    };
  }

  /**
   * Clear response cache.
   *
   * Useful when you know cached data is stale and needs refresh.
   *
   * @example
   * client.clearCache();
   *
   * @internal
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTTL.clear();
    logger.debug('API client cache cleared', { apiName: this.apiName });
  }

  /**
   * Reset metrics and health state.
   *
   * Call when you need to clear accumulated metrics or recover from errors.
   *
   * @example
   * client.reset();
   *
   * @internal
   */
  reset(): void {
    this.circuitBreaker.reset();
    this.rateLimiter.reset();
    this.responseTimes.length = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.clearCache();

    logger.info('API client reset', { apiName: this.apiName });
  }

  /**
   * Cleanup resources.
   *
   * Call when client is no longer needed.
   *
   * @example
   * client.destroy();
   *
   * @internal
   */
  destroy(): void {
    this.circuitBreaker.destroy();
    this.rateLimiter.destroy();
    this.cache.clear();
    this.pendingRequests.clear();

    logger.debug('API client destroyed', { apiName: this.apiName });
  }
}

/**
 * API client configuration.
 *
 * @interface ApiClientConfig
 */
export interface ApiClientConfig {
  /** API base URL */
  baseURL: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Authentication configuration */
  auth?: {
    /** Authentication type */
    type: 'bearer' | 'basic' | 'apikey' | 'custom';
    /** Bearer token or API key */
    token?: string;
    /** Basic auth username */
    username?: string;
    /** Basic auth password */
    password?: string;
    /** Header name for API key (default: X-API-Key) */
    headerName?: string;
    /** Custom headers for custom auth */
    customHeaders?: Record<string, string>;
  };
  /** Default headers */
  headers?: Record<string, string>;
  /** Rate limiting configuration */
  rateLimit?: {
    /** Max tokens in bucket */
    maxTokens?: number;
    /** Tokens to add per interval */
    refillRate?: number;
    /** Refill interval in milliseconds */
    refillIntervalMs?: number;
  };
  /** Circuit breaker configuration */
  circuitBreaker?: {
    /** Failures before opening circuit */
    failureThreshold?: number;
    /** Milliseconds before attempting recovery */
    resetTimeout?: number;
  };
  /** Retry configuration */
  retry?: {
    /** Max retry attempts */
    attempts?: number;
    /** Backoff strategy */
    backoff?: 'linear' | 'exponential';
    /** Base delay in milliseconds */
    baseDelay?: number;
  };
}

// Type augmentation for request metadata
declare global {
  namespace Express {
    interface Request {
      metadata?: {
        startTime: number;
      };
    }
  }
}

// Augment axios config to include metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}

export default ApiClient;
