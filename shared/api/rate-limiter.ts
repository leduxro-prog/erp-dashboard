/**
 * Token Bucket Rate Limiter for external API compliance.
 *
 * Each API integration has its own rate limiter with configurable fill rate and capacity.
 * Uses token bucket algorithm for smooth request flow with burst support.
 *
 * Example configurations:
 * - SmartBill: 10 req/min = 0.167 req/sec
 * - WooCommerce: 50 req/min = 0.833 req/sec
 * - Supplier APIs: 5 req/min = 0.083 req/sec
 *
 * @module shared/api/rate-limiter
 */

import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('rate-limiter');

/**
 * Configuration for token bucket rate limiter.
 *
 * @interface TokenBucketConfig
 *
 * @property {number} maxTokens - Maximum tokens in bucket (capacity)
 * @property {number} refillRate - Tokens to add per refill interval
 * @property {number} refillIntervalMs - Milliseconds between refills
 * @property {string} [name] - Optional name for logging
 */
export interface TokenBucketConfig {
  /** Maximum tokens bucket can hold (burst capacity) */
  maxTokens: number;
  /** Number of tokens to add per refill interval */
  refillRate: number;
  /** Milliseconds between token refills */
  refillIntervalMs: number;
  /** Optional name for logging and debugging */
  name?: string;
}

/**
 * Metrics collected by the rate limiter.
 *
 * @interface RateLimiterMetrics
 */
export interface RateLimiterMetrics {
  /** Current tokens available in bucket */
  currentTokens: number;
  /** Total requests that acquired tokens */
  totalAcquired: number;
  /** Total requests that were rejected (bucket empty) */
  totalRejected: number;
  /** Average wait time for token acquisition in milliseconds */
  avgWaitTimeMs: number;
  /** Queue depth (requests waiting for tokens) */
  queueDepth: number;
  /** Effective requests per second being allowed */
  effectiveRatePerSecond: number;
}

/**
 * Token Bucket Rate Limiter implementation.
 *
 * Provides token bucket algorithm for rate limiting external API calls.
 * Supports blocking (async/await) and non-blocking (tryAcquire) token acquisition.
 *
 * The bucket fills at a configurable rate, allowing up to maxTokens tokens.
 * When empty, requests either queue (acquire) or immediately return false (tryAcquire).
 *
 * @example
 * const limiter = new TokenBucketRateLimiter({
 *   maxTokens: 10,           // Burst capacity
 *   refillRate: 0.167,       // 0.167 tokens/sec = 10/minute
 *   refillIntervalMs: 1000,  // Refill every 1 second
 *   name: 'smartbill-limiter'
 * });
 *
 * // Blocking acquisition (waits until tokens available)
 * await limiter.acquire();
 * await makeApiCall();
 *
 * // Non-blocking check
 * if (limiter.tryAcquire()) {
 *   await makeApiCall();
 * }
 *
 * // Get metrics
 * const metrics = limiter.getMetrics();
 * console.log(`Current rate: ${metrics.effectiveRatePerSecond} req/sec`);
 */
export class TokenBucketRateLimiter {
  private currentTokens: number;
  private lastRefillTime: number;
  private refillIntervalId: NodeJS.Timeout | null = null;
  private readonly config: Required<TokenBucketConfig>;
  private readonly waitQueue: Array<{
    resolve: () => void;
    tokens: number;
  }> = [];

  // Metrics tracking
  private totalAcquired: number = 0;
  private totalRejected: number = 0;
  private readonly waitTimes: number[] = [];
  private readonly maxWaitTimeSamples = 100;

  /**
   * Create a new token bucket rate limiter.
   *
   * @param config - Rate limiter configuration
   *
   * @example
   * new TokenBucketRateLimiter({
   *   maxTokens: 50,
   *   refillRate: 0.833,       // 50 tokens per 60 seconds
   *   refillIntervalMs: 1000,
   *   name: 'woocommerce'
   * })
   */
  constructor(config: TokenBucketConfig) {
    this.config = {
      name: 'rate-limiter',
      ...config,
    };

    this.currentTokens = this.config.maxTokens;
    this.lastRefillTime = Date.now();

    this.startRefillTimer();

    logger.info('Rate limiter created', {
      name: this.config.name,
      maxTokens: this.config.maxTokens,
      refillRate: this.config.refillRate,
      refillIntervalMs: this.config.refillIntervalMs,
    });
  }

  /**
   * Start the periodic refill timer.
   *
   * @internal
   */
  private startRefillTimer(): void {
    this.refillIntervalId = setInterval(
      () => this.refill(),
      this.config.refillIntervalMs
    );

    if (this.refillIntervalId.unref) {
      this.refillIntervalId.unref();
    }
  }

  /**
   * Refill tokens up to max capacity.
   *
   * @internal
   */
  private refill(): void {
    this.currentTokens = Math.min(
      this.config.maxTokens,
      this.currentTokens + this.config.refillRate
    );

    logger.debug('Rate limiter refilled', {
      name: this.config.name,
      currentTokens: this.currentTokens,
      maxTokens: this.config.maxTokens,
    });

    // Process waiting requests
    this.processQueue();
  }

  /**
   * Process queued requests waiting for tokens.
   *
   * @internal
   */
  private processQueue(): void {
    while (this.waitQueue.length > 0 && this.currentTokens >= 1) {
      const request = this.waitQueue.shift();
      if (request) {
        this.currentTokens -= request.tokens;
        request.resolve();
      }
    }
  }

  /**
   * Acquire token(s) from bucket, waiting if necessary.
   *
   * Async method that waits until requested tokens are available.
   * Useful for sequential API calls that must respect rate limits.
   *
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns Promise that resolves when tokens are acquired
   *
   * @example
   * // Rate limit sequential requests
   * for (const item of items) {
   *   await limiter.acquire();
   *   await apiCall(item);
   * }
   *
   * @example
   * // Acquire multiple tokens for bulk request
   * await limiter.acquire(5);
   * await bulkApiCall(items);
   */
  async acquire(tokens: number = 1): Promise<void> {
    const startTime = Date.now();

    // Fast path: tokens immediately available
    if (this.currentTokens >= tokens) {
      this.currentTokens -= tokens;
      this.totalAcquired++;
      return;
    }

    // Slow path: queue the request
    return new Promise<void>((resolve) => {
      this.waitQueue.push({
        resolve: () => {
          const waitTime = Date.now() - startTime;
          this.waitTimes.push(waitTime);
          if (this.waitTimes.length > this.maxWaitTimeSamples) {
            this.waitTimes.shift();
          }
          this.totalAcquired++;
          resolve();
        },
        tokens,
      });

      logger.debug('Rate limit request queued', {
        name: this.config.name,
        queueDepth: this.waitQueue.length,
        currentTokens: this.currentTokens,
        tokensRequested: tokens,
      });

      // Try processing queue immediately in case refill just happened
      this.processQueue();
    });
  }

  /**
   * Try to acquire token(s) without waiting.
   *
   * Non-blocking method that immediately returns whether tokens were available.
   * Useful for checking rate limit status without blocking execution.
   *
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns true if tokens acquired, false if bucket empty
   *
   * @example
   * if (limiter.tryAcquire()) {
   *   // We have tokens, make the API call
   *   await apiCall();
   * } else {
   *   // Rate limited, skip or queue for later
   *   logger.warn('Rate limited, skipping call');
   * }
   */
  tryAcquire(tokens: number = 1): boolean {
    if (this.currentTokens >= tokens) {
      this.currentTokens -= tokens;
      this.totalAcquired++;
      return true;
    }

    this.totalRejected++;

    logger.debug('Rate limit tryAcquire rejected', {
      name: this.config.name,
      currentTokens: this.currentTokens,
      tokensRequested: tokens,
    });

    return false;
  }

  /**
   * Get current rate limiter metrics.
   *
   * @returns Metrics object with current state and statistics
   *
   * @example
   * const metrics = limiter.getMetrics();
   * if (metrics.queueDepth > 10) {
   *   logger.warn('High queue depth detected');
   * }
   */
  getMetrics(): RateLimiterMetrics {
    const avgWaitTimeMs =
      this.waitTimes.length > 0
        ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
        : 0;

    const secondsSinceLastRefill = (Date.now() - this.lastRefillTime) / 1000;
    const tokensPerSecond = this.config.refillRate / (this.config.refillIntervalMs / 1000);

    return {
      currentTokens: this.currentTokens,
      totalAcquired: this.totalAcquired,
      totalRejected: this.totalRejected,
      avgWaitTimeMs,
      queueDepth: this.waitQueue.length,
      effectiveRatePerSecond: tokensPerSecond,
    };
  }

  /**
   * Reset metrics while preserving bucket state.
   *
   * Clears acquired/rejected counters and wait time samples.
   * Useful for benchmarking or when metrics become stale.
   *
   * @internal
   */
  resetMetrics(): void {
    this.totalAcquired = 0;
    this.totalRejected = 0;
    this.waitTimes.length = 0;

    logger.debug('Rate limiter metrics reset', {
      name: this.config.name,
    });
  }

  /**
   * Reset bucket to full capacity.
   *
   * Clears the bucket back to maxTokens and processes any queued requests.
   *
   * @example
   * // Manual recovery after service restart
   * limiter.reset();
   */
  reset(): void {
    this.currentTokens = this.config.maxTokens;
    this.lastRefillTime = Date.now();
    this.waitQueue.length = 0;
    this.resetMetrics();

    logger.info('Rate limiter reset to full capacity', {
      name: this.config.name,
      maxTokens: this.config.maxTokens,
    });
  }

  /**
   * Clean up resources and stop refill timer.
   *
   * Call when rate limiter is no longer needed.
   *
   * @example
   * limiter.destroy();
   */
  destroy(): void {
    if (this.refillIntervalId) {
      clearInterval(this.refillIntervalId);
      this.refillIntervalId = null;
    }

    this.waitQueue.length = 0;

    logger.debug('Rate limiter destroyed', {
      name: this.config.name,
    });
  }
}

export default TokenBucketRateLimiter;
