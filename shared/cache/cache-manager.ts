/**
 * Advanced Multi-Layer Cache Manager
 *
 * Implements sophisticated L1 (in-memory LRU), L2 (Redis), and L3 (Database)
 * caching strategy with advanced features:
 * - Automatic compression for large values
 * - Tag-based pattern invalidation
 * - Multiple write strategies (write-through, write-behind, write-around)
 * - Detailed statistics and metrics collection
 * - Cache warming and preloading support
 *
 * @module shared/cache/cache-manager
 * @example
 * // Create cache manager
 * const cache = new CacheManager<Product>({
 *   moduleName: 'products',
 *   ttlSeconds: 300,
 *   l1MaxSize: 10000,
 *   strategy: 'write-through'
 * });
 *
 * // Get with fallback
 * const product = await cache.get('product:123', async () => {
 *   return await db.products.findById(123);
 * });
 *
 * // Set with strategy
 * await cache.set('product:123', product, 'write-through', 600);
 *
 * // Invalidate by pattern
 * const count = await cache.invalidateTag('product:*');
 *
 * // Get metrics
 * const metrics = cache.getMetrics();
 * console.log(`Hit rate: ${metrics.hitRate.overall.toFixed(2)}%`);
 */

import { LRUCache } from './lru-cache';
import { RedisPool } from './redis-pool';
import { createModuleLogger } from '../utils/logger';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const logger = createModuleLogger('cache-manager');

/**
 * Cache write strategy enumeration
 *
 * @typedef CacheStrategy
 * @type {'write-through'|'write-behind'|'write-around'}
 * @description
 * - write-through: Write to L1 and L2 before returning (safest, slower)
 * - write-behind: Write to L1 immediately, L2 asynchronously (fast, less safe)
 * - write-around: Write only to L2, bypass L1 (for large values)
 */
export type CacheStrategy = 'write-through' | 'write-behind' | 'write-around';

/**
 * Cache invalidation pattern configuration
 *
 * @interface InvalidationPattern
 * @property {string} tag - Tag for pattern matching (supports * wildcard)
 * @property {string} pattern - Regex pattern for matching (alternative to tag)
 */
export interface InvalidationPattern {
  tag?: string;
  pattern?: string;
}

/**
 * Detailed cache performance metrics across all layers
 *
 * @interface CacheMetrics
 * @property {Object} cacheHits - Hit counts per cache layer
 * @property {Object} cacheMisses - Miss counts per cache layer
 * @property {number} cacheEvictions - Total evictions from cache
 * @property {Object} hitRate - Hit rate percentages (0-100)
 * @property {Object} averageLatency - Average response latency per layer
 */
export interface CacheMetrics {
  cacheHits: {
    l1: number;
    l2: number;
    l3: number;
    total: number;
  };
  cacheMisses: {
    l1: number;
    l2: number;
    l3: number;
    total: number;
  };
  cacheEvictions: number;
  hitRate: {
    l1: number;
    l2: number;
    l3: number;
    overall: number;
  };
  averageLatency: {
    l1Ms: number;
    l2Ms: number;
    l3Ms: number;
  };
}

/**
 * Cache statistics interface (legacy - use CacheMetrics for new code)
 * Maintained for backward compatibility with existing code
 *
 * @interface CacheStats
 */
export interface CacheStats {
  l1: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    capacity: number;
  };
  l2: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  l3: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  averageLatency: {
    l1Ms: number;
    l2Ms: number;
    l3Ms: number;
  };
}

/**
 * Serialization and compression configuration
 *
 * @interface SerializationOptions
 * @private
 * @property {boolean} useCompression - Enable gzip compression for large values
 * @property {number} compressionThresholdBytes - Compress values larger than this
 */
interface SerializationOptions {
  useCompression?: boolean;
  compressionThresholdBytes?: number;
}

/**
 * Multi-Layer Cache Manager Class
 *
 * Implements three-tier caching strategy:
 * - L1: In-memory LRU cache (process-local, <1ms latency)
 * - L2: Redis cache (shared across instances, <5ms latency)
 * - L3: Database/source (authoritative source of truth)
 *
 * Features:
 * - Automatic compression for large values (>1KB)
 * - Transparent serialization/deserialization
 * - Pattern-based tag invalidation
 * - Multiple write strategies
 * - Detailed metrics and statistics
 * - Cache warming for preloading data
 *
 * @class CacheManager
 * @typeParam T - Type of cached objects
 *
 * @example
 * ```typescript
 * const cache = new CacheManager<Product>({
 *   moduleName: 'products',
 *   ttlSeconds: 300,
 *   l1MaxSize: 10000,
 *   strategy: 'write-through',
 *   useCompression: true
 * });
 *
 * // Get with multi-layer fallback
 * const product = await cache.get('product:123', async () => {
 *   return await db.products.findById(123);
 * });
 *
 * // Set with custom TTL
 * await cache.set('product:123', product, 'write-through', 600);
 *
 * // Invalidate by pattern
 * const deleted = await cache.invalidateTag('product:*');
 *
 * // Get metrics
 * const metrics = cache.getMetrics();
 * console.log(`Hit rate: ${metrics.hitRate.overall}%`);
 *
 * // Warm cache
 * await cache.warmCache([
 *   { key: 'product:1', value: product1 },
 *   { key: 'product:2', value: product2 }
 * ]);
 * ```
 */
export class CacheManager<T = any> {
  private l1Cache: LRUCache<T>;
  private redisPool: RedisPool;
  private moduleName: string;
  private ttlSeconds: number;
  private strategy: CacheStrategy;
  private serialization: SerializationOptions;

  // Statistics tracking
  private stats = {
    l1: { hits: 0, misses: 0 },
    l2: { hits: 0, misses: 0 },
    l3: { hits: 0, misses: 0 },
    evictions: 0,
    timings: {
      l1: [] as number[],
      l2: [] as number[],
      l3: [] as number[],
    },
  };

  private maxTimingSamples = 100;

  /**
   * Initialize cache manager with configuration
   *
   * @constructor
   * @param {Object} config - Configuration object
   * @param {string} config.moduleName - Module name for key prefixing
   * @param {number} [config.ttlSeconds=300] - Default TTL in seconds
   * @param {number} [config.l1MaxSize=10000] - L1 cache max items
   * @param {CacheStrategy} [config.strategy='write-through'] - Write strategy
   * @param {boolean} [config.useCompression=true] - Enable compression
   * @param {number} [config.compressionThresholdBytes=1024] - Compression threshold
   */
  constructor({
    moduleName,
    ttlSeconds = 300,
    l1MaxSize = 10000,
    strategy = 'write-through',
    useCompression = true,
    compressionThresholdBytes = 1024,
  }: {
    moduleName: string;
    ttlSeconds?: number;
    l1MaxSize?: number;
    strategy?: CacheStrategy;
    useCompression?: boolean;
    compressionThresholdBytes?: number;
  }) {
    this.moduleName = moduleName;
    this.ttlSeconds = ttlSeconds;
    this.strategy = strategy;
    this.serialization = {
      useCompression,
      compressionThresholdBytes,
    };

    this.l1Cache = new LRUCache<T>({
      maxSize: l1MaxSize,
      defaultTTLMs: ttlSeconds * 1000,
    });

    this.redisPool = RedisPool.getInstance();

    logger.info(`CacheManager initialized for module: ${moduleName}`, {
      ttlSeconds,
      l1MaxSize,
      strategy,
    });
  }

  /**
   * Get value from cache with multi-layer fallback strategy
   *
   * Attempts to fetch value from L1 → L2 → L3 (fallback function).
   * Automatically populates higher layers on miss.
   *
   * @typeParam R - Result type (must extend T)
   * @param {string} key - Cache key
   * @param {Function} [fallback] - Async function to fetch from source on cache miss
   * @returns {Promise<R|undefined>} Cached or freshly fetched value, or undefined if not found
   *
   * @example
   * ```typescript
   * const user = await cache.get('user:42', async () => {
   *   return await db.users.findById(42);
   * });
   * ```
   */
  async get<R extends T = T>(
    key: string,
    fallback?: () => Promise<R>
  ): Promise<R | undefined> {
    const fullKey = this.getFullKey(key);

    // L1: Check in-memory cache
    const startL1 = Date.now();
    const l1Value = this.l1Cache.get(fullKey);
    this.recordTiming('l1', Date.now() - startL1);

    if (l1Value !== undefined) {
      this.stats.l1.hits++;
      logger.debug(`L1 cache hit for key: ${key}`);
      return l1Value as R;
    }

    this.stats.l1.misses++;

    // L2: Check Redis cache
    const startL2 = Date.now();
    const l2Value = await this.getFromRedis<R>(fullKey);
    this.recordTiming('l2', Date.now() - startL2);

    if (l2Value !== undefined) {
      this.stats.l2.hits++;
      logger.debug(`L2 cache hit for key: ${key}`);
      // Populate L1 from L2
      this.l1Cache.set(fullKey, l2Value as T);
      return l2Value;
    }

    this.stats.l2.misses++;

    // L3: Fetch from source
    if (fallback) {
      const startL3 = Date.now();
      const l3Value = await fallback();
      this.recordTiming('l3', Date.now() - startL3);

      if (l3Value !== undefined) {
        this.stats.l3.hits++;
        logger.debug(`L3 source hit for key: ${key}`);

        // Populate L1 and L2
        await this.setMultiLayer(fullKey, l3Value);
        return l3Value;
      }

      this.stats.l3.misses++;
    }

    return undefined;
  }

  /**
   * Get value from cache without fallback (cache-only lookup)
   *
   * Returns value only if present in L1 or L2, does not fetch from source.
   *
   * @typeParam R - Result type
   * @param {string} key - Cache key
   * @returns {Promise<R|undefined>} Cached value or undefined
   */
  async getSync<R extends T = T>(key: string): Promise<R | undefined> {
    const fullKey = this.getFullKey(key);

    // Try L1 first
    const l1Value = this.l1Cache.get(fullKey);
    if (l1Value !== undefined) {
      this.stats.l1.hits++;
      return l1Value as R;
    }

    this.stats.l1.misses++;

    // Try L2
    const l2Value = await this.getFromRedis<R>(fullKey);
    if (l2Value !== undefined) {
      this.stats.l2.hits++;
      this.l1Cache.set(fullKey, l2Value as T);
      return l2Value;
    }

    this.stats.l2.misses++;
    return undefined;
  }

  /**
   * Set value in cache with specified write strategy
   *
   * Stores value in L1 and/or L2 based on selected strategy.
   *
   * @typeParam R - Value type
   * @param {string} key - Cache key
   * @param {R} value - Value to cache
   * @param {CacheStrategy} [strategyOverride] - Override default strategy
   * @param {number} [ttlSecondsOverride] - Override default TTL
   * @returns {Promise<void>}
   */
  async set<R extends T = T>(
    key: string,
    value: R,
    strategyOverride?: CacheStrategy,
    ttlSecondsOverride?: number
  ): Promise<void> {
    const fullKey = this.getFullKey(key);
    const strategy = strategyOverride || this.strategy;
    const ttlSeconds = ttlSecondsOverride || this.ttlSeconds;

    logger.debug(`Setting cache for key: ${key} with strategy: ${strategy}`);

    switch (strategy) {
      case 'write-through':
        // Write to L1 and L2 before returning
        await this.setMultiLayer(fullKey, value, ttlSeconds);
        break;

      case 'write-behind':
        // Write to L1 immediately, L2 asynchronously
        this.l1Cache.set(fullKey, value as T, ttlSeconds * 1000);
        this.setToRedis(fullKey, value as T, ttlSeconds).catch((err) => {
          logger.error(`Failed to write to L2 for key: ${key}`, { error: err });
        });
        break;

      case 'write-around':
        // Write only to L2, bypass L1
        await this.setToRedis(fullKey, value as T, ttlSeconds);
        break;
    }
  }

  /**
   * Delete value from all cache layers
   *
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if value was deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    logger.debug(`Deleting cache for key: ${key}`);

    const l1Deleted = this.l1Cache.delete(fullKey);
    const l2Deleted = await this.deleteFromRedis(fullKey);

    if (l1Deleted || l2Deleted) {
      this.stats.evictions++;
    }

    return l1Deleted || l2Deleted;
  }

  /**
   * Invalidate cache entries matching a pattern
   *
   * Deletes all keys matching the glob pattern from both L1 and L2.
   * Uses SCAN command for efficient Redis operations.
   *
   * @param {string} pattern - Pattern with * wildcard
   * @returns {Promise<number>} Number of deleted entries
   *
   * @example
   * ```typescript
   * const count = await cache.invalidateTag('product:*');
   * await cache.invalidateTag('customer:123:*');
   * await cache.invalidateTag('order:pending:*');
   * ```
   */
  async invalidateTag(pattern: string): Promise<number> {
    logger.debug(`Invalidating tag pattern: ${pattern}`);

    const fullPattern = this.getFullKey(pattern);

    // L1: Clear matching keys from in-memory cache
    let l1Count = 0;
    for (const key of this.l1Cache.keys()) {
      if (this.matchesPattern(key, fullPattern)) {
        this.l1Cache.delete(key);
        l1Count++;
      }
    }

    // L2: Clear matching keys from Redis using SCAN
    let l2Count = 0;
    try {
      const client = this.redisPool.getPrimaryClient();
      const cursor = 0;
      const result = await client.scan(cursor, {
        MATCH: fullPattern,
        COUNT: 1000,
      });

      if (result.keys) {
        const deletePromises = result.keys.map((key) =>
          client.del(key).catch((err) => {
            logger.warn(`Failed to delete key from Redis: ${key}`, { error: err });
          })
        );
        await Promise.all(deletePromises);
        l2Count = result.keys.length;
      }
    } catch (error) {
      logger.error(`Failed to invalidate tag pattern in Redis: ${pattern}`, {
        error,
      });
    }

    const totalInvalidated = l1Count + l2Count;
    logger.info(
      `Invalidated ${totalInvalidated} entries (L1: ${l1Count}, L2: ${l2Count}) for pattern: ${pattern}`
    );

    return totalInvalidated;
  }

  /**
   * Clear all cache entries for this module
   *
   * Completely wipes L1 and L2 caches for this module.
   * Does not affect other modules' caches.
   *
   * @returns {Promise<void>}
   */
  async clear(): Promise<void> {
    logger.info(`Clearing all cache for module: ${this.moduleName}`);

    // Clear L1
    this.l1Cache.clear();

    // Clear L2
    try {
      const client = this.redisPool.getPrimaryClient();
      const pattern = this.getFullKey('*');
      const cursor = 0;
      const result = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 10000,
      });

      if (result.keys && result.keys.length > 0) {
        await Promise.all(result.keys.map((key) => client.del(key)));
      }
    } catch (error) {
      logger.error(`Failed to clear L2 cache`, { error });
    }
  }

  /**
   * Preload cache with provided keys and values
   *
   * Efficiently populates L1 and L2 caches in parallel.
   * Useful for warming cache at startup or after invalidation.
   *
   * @param {Object[]} entries - Array of key-value pairs
   * @param {string} entries[].key - Cache key
   * @param {T} entries[].value - Value to cache
   * @param {number} [ttlSecondsOverride] - Override default TTL
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * await cache.warmCache([
   *   { key: 'product:1', value: product1 },
   *   { key: 'product:2', value: product2 },
   *   { key: 'product:3', value: product3 }
   * ], 600);
   * ```
   */
  async warmCache(
    entries: Array<{ key: string; value: T }>,
    ttlSecondsOverride?: number
  ): Promise<void> {
    logger.info(`Warming cache with ${entries.length} entries for module: ${this.moduleName}`);

    const ttlSeconds = ttlSecondsOverride || this.ttlSeconds;

    const promises = entries.map(({ key, value }) =>
      this.setMultiLayer(this.getFullKey(key), value, ttlSeconds)
    );

    try {
      await Promise.all(promises);
      logger.info(`Cache warming completed for ${entries.length} entries`);
    } catch (error) {
      logger.error(`Cache warming failed`, { error });
    }
  }

  /**
   * Get cache statistics (legacy method)
   *
   * Maintained for backward compatibility. Use getMetrics() for new code.
   *
   * @returns {CacheStats} Statistics object
   */
  getStats(): CacheStats {
    const l1Stats = this.l1Cache.getStats();
    const l1Hits = this.stats.l1.hits;
    const l1Misses = this.stats.l1.misses;
    const l1Total = l1Hits + l1Misses;

    const l2Hits = this.stats.l2.hits;
    const l2Misses = this.stats.l2.misses;
    const l2Total = l2Hits + l2Misses;

    const l3Hits = this.stats.l3.hits;
    const l3Misses = this.stats.l3.misses;
    const l3Total = l3Hits + l3Misses;

    return {
      l1: {
        hits: l1Hits,
        misses: l1Misses,
        hitRate: l1Total > 0 ? (l1Hits / l1Total) * 100 : 0,
        size: l1Stats.size,
        capacity: l1Stats.capacity,
      },
      l2: {
        hits: l2Hits,
        misses: l2Misses,
        hitRate: l2Total > 0 ? (l2Hits / l2Total) * 100 : 0,
      },
      l3: {
        hits: l3Hits,
        misses: l3Misses,
        hitRate: l3Total > 0 ? (l3Hits / l3Total) * 100 : 0,
      },
      averageLatency: {
        l1Ms:
          this.stats.timings.l1.length > 0
            ? this.stats.timings.l1.reduce((a, b) => a + b, 0) / this.stats.timings.l1.length
            : 0,
        l2Ms:
          this.stats.timings.l2.length > 0
            ? this.stats.timings.l2.reduce((a, b) => a + b, 0) / this.stats.timings.l2.length
            : 0,
        l3Ms:
          this.stats.timings.l3.length > 0
            ? this.stats.timings.l3.reduce((a, b) => a + b, 0) / this.stats.timings.l3.length
            : 0,
      },
    };
  }

  /**
   * Get detailed cache performance metrics
   *
   * Returns comprehensive metrics including hit rates, latency,
   * evictions, and per-layer statistics.
   *
   * @returns {CacheMetrics} Detailed metrics object
   */
  getMetrics(): CacheMetrics {
    const l1Stats = this.l1Cache.getStats();
    const l1Hits = this.stats.l1.hits;
    const l1Misses = this.stats.l1.misses;
    const l1Total = l1Hits + l1Misses;

    const l2Hits = this.stats.l2.hits;
    const l2Misses = this.stats.l2.misses;
    const l2Total = l2Hits + l2Misses;

    const l3Hits = this.stats.l3.hits;
    const l3Misses = this.stats.l3.misses;
    const l3Total = l3Hits + l3Misses;

    const totalHits = l1Hits + l2Hits + l3Hits;
    const totalMisses = l1Misses + l2Misses + l3Misses;
    const totalRequests = totalHits + totalMisses;

    return {
      cacheHits: {
        l1: l1Hits,
        l2: l2Hits,
        l3: l3Hits,
        total: totalHits,
      },
      cacheMisses: {
        l1: l1Misses,
        l2: l2Misses,
        l3: l3Misses,
        total: totalMisses,
      },
      cacheEvictions: this.stats.evictions,
      hitRate: {
        l1: l1Total > 0 ? (l1Hits / l1Total) * 100 : 0,
        l2: l2Total > 0 ? (l2Hits / l2Total) * 100 : 0,
        l3: l3Total > 0 ? (l3Hits / l3Total) * 100 : 0,
        overall: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      },
      averageLatency: {
        l1Ms:
          this.stats.timings.l1.length > 0
            ? this.stats.timings.l1.reduce((a, b) => a + b, 0) / this.stats.timings.l1.length
            : 0,
        l2Ms:
          this.stats.timings.l2.length > 0
            ? this.stats.timings.l2.reduce((a, b) => a + b, 0) / this.stats.timings.l2.length
            : 0,
        l3Ms:
          this.stats.timings.l3.length > 0
            ? this.stats.timings.l3.reduce((a, b) => a + b, 0) / this.stats.timings.l3.length
            : 0,
      },
    };
  }

  /**
   * Reset all statistics counters
   *
   * @returns {void}
   */
  resetStats(): void {
    this.stats = {
      l1: { hits: 0, misses: 0 },
      l2: { hits: 0, misses: 0 },
      l3: { hits: 0, misses: 0 },
      evictions: 0,
      timings: {
        l1: [],
        l2: [],
        l3: [],
      },
    };
  }

  /**
   * Get overall cache hit rate percentage
   *
   * @returns {number} Hit rate 0-100
   */
  getHitRate(): number {
    const stats = this.getMetrics();
    return stats.hitRate.overall;
  }

  /**
   * Get overall cache miss rate percentage
   *
   * @returns {number} Miss rate 0-100
   */
  getMissRate(): number {
    return 100 - this.getHitRate();
  }

  /**
   * Get total cache hits across all layers
   *
   * @returns {number} Total hit count
   */
  getTotalHits(): number {
    return this.getMetrics().cacheHits.total;
  }

  /**
   * Get total cache misses across all layers
   *
   * @returns {number} Total miss count
   */
  getTotalMisses(): number {
    return this.getMetrics().cacheMisses.total;
  }

  /**
   * Get total cache evictions
   *
   * @returns {number} Total eviction count
   */
  getTotalEvictions(): number {
    return this.stats.evictions;
  }

  /**
   * Export metrics as JSON for monitoring/alerting systems
   *
   * @returns {string} JSON-serialized metrics with timestamp
   */
  exportMetricsJson(): string {
    const metrics = this.getMetrics();
    return JSON.stringify(
      {
        module: this.moduleName,
        timestamp: new Date().toISOString(),
        metrics,
      },
      null,
      2
    );
  }

  /**
   * Get human-readable metrics summary as formatted text
   *
   * @returns {string} Formatted text summary of all metrics
   */
  getMetricsSummary(): string {
    const metrics = this.getMetrics();
    return `
Cache Metrics for ${this.moduleName}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hits:
  L1: ${metrics.cacheHits.l1}
  L2: ${metrics.cacheHits.l2}
  L3: ${metrics.cacheHits.l3}
  Total: ${metrics.cacheHits.total}

Misses:
  L1: ${metrics.cacheMisses.l1}
  L2: ${metrics.cacheMisses.l2}
  L3: ${metrics.cacheMisses.l3}
  Total: ${metrics.cacheMisses.total}

Hit Rates:
  L1: ${metrics.hitRate.l1.toFixed(2)}%
  L2: ${metrics.hitRate.l2.toFixed(2)}%
  L3: ${metrics.hitRate.l3.toFixed(2)}%
  Overall: ${metrics.hitRate.overall.toFixed(2)}%

Evictions: ${metrics.cacheEvictions}

Average Latency:
  L1: ${metrics.averageLatency.l1Ms.toFixed(2)}ms
  L2: ${metrics.averageLatency.l2Ms.toFixed(2)}ms
  L3: ${metrics.averageLatency.l3Ms.toFixed(2)}ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get full cache key with module prefix
   *
   * @private
   * @param {string} key - Base key
   * @returns {string} Prefixed key
   */
  private getFullKey(key: string): string {
    return `${this.moduleName}:${key}`;
  }

  /**
   * Retrieve value from Redis L2 cache
   *
   * @private
   * @typeParam R - Value type
   * @param {string} key - Cache key
   * @returns {Promise<R|undefined>} Deserialized value or undefined
   */
  private async getFromRedis<R extends T = T>(key: string): Promise<R | undefined> {
    try {
      const client = this.redisPool.getClient();
      const serialized = await client.get(key);

      if (!serialized) {
        return undefined;
      }

      const deserialized = await this.deserialize<R>(serialized);
      return deserialized;
    } catch (error) {
      logger.warn(`Failed to get from Redis: ${key}`, { error });
      return undefined;
    }
  }

  /**
   * Store value in Redis L2 cache
   *
   * @private
   * @typeParam R - Value type
   * @param {string} key - Cache key
   * @param {R} value - Value to cache
   * @param {number} ttlSeconds - Time-to-live in seconds
   * @returns {Promise<void>}
   */
  private async setToRedis<R extends T = T>(
    key: string,
    value: R,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const client = this.redisPool.getPrimaryClient();
      const serialized = await this.serialize(value);

      await client.setEx(key, ttlSeconds, serialized);
    } catch (error) {
      logger.warn(`Failed to set to Redis: ${key}`, { error });
    }
  }

  /**
   * Delete value from Redis L2 cache
   *
   * @private
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted, false otherwise
   */
  private async deleteFromRedis(key: string): Promise<boolean> {
    try {
      const client = this.redisPool.getPrimaryClient();
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      logger.warn(`Failed to delete from Redis: ${key}`, { error });
      return false;
    }
  }

  /**
   * Set value to both L1 (in-memory) and L2 (Redis) caches
   *
   * @private
   * @typeParam R - Value type
   * @param {string} key - Cache key
   * @param {R} value - Value to cache
   * @param {number} [ttlSeconds] - Time-to-live override
   * @returns {Promise<void>}
   */
  private async setMultiLayer<R extends T = T>(
    key: string,
    value: R,
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds || this.ttlSeconds;

    // Set to L1
    this.l1Cache.set(key, value as T, ttl * 1000);

    // Set to L2
    await this.setToRedis(key, value, ttl);
  }

  /**
   * Serialize and optionally compress value for Redis storage
   *
   * @private
   * @param {any} value - Value to serialize
   * @returns {Promise<string>} Serialized (and optionally compressed) string
   */
  private async serialize(value: any): Promise<string> {
    let serialized = JSON.stringify(value);

    // Apply compression if enabled and threshold exceeded
    if (this.serialization.useCompression) {
      const threshold = this.serialization.compressionThresholdBytes || 1024;

      if (serialized.length > threshold) {
        const compressed = await gzip(serialized);
        // Prefix with 'z:' to indicate compression
        return 'z:' + compressed.toString('base64');
      }
    }

    return serialized;
  }

  /**
   * Deserialize and decompress value from Redis storage
   *
   * @private
   * @typeParam R - Result type
   * @param {string} serialized - Serialized value string
   * @returns {Promise<R>} Deserialized value
   */
  private async deserialize<R = any>(serialized: string): Promise<R> {
    // Check if compressed
    if (serialized.startsWith('z:')) {
      const compressedData = serialized.slice(2);
      const decompressed = await gunzip(Buffer.from(compressedData, 'base64'));
      return JSON.parse(decompressed.toString());
    }

    return JSON.parse(serialized);
  }

  /**
   * Record timing sample for latency metrics
   *
   * @private
   * @param {'l1'|'l2'|'l3'} layer - Cache layer
   * @param {number} ms - Latency in milliseconds
   */
  private recordTiming(layer: 'l1' | 'l2' | 'l3', ms: number): void {
    this.stats.timings[layer].push(ms);
    if (this.stats.timings[layer].length > this.maxTimingSamples) {
      this.stats.timings[layer].shift();
    }
  }

  /**
   * Check if key matches glob pattern with * wildcard
   *
   * @private
   * @param {string} key - Key to test
   * @param {string} pattern - Pattern with * wildcards
   * @returns {boolean} True if matches
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(key);
  }
}

export default CacheManager;
