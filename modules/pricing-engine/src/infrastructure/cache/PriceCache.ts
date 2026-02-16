import Redis from 'ioredis';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('price-cache');

export interface CacheOptions {
  ttl?: number;
}

/**
 * Enterprise-grade Price Cache with Redis backend
 * 
 * Provides caching for pricing data with TTL-based expiration,
 * cache warming, and hit rate monitoring.
 */
export class PriceCache {
  private readonly redisClient: Redis;
  private readonly defaultTTL: number = 3600; // 1 hour in seconds
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(redisClient: Redis) {
    this.redisClient = redisClient;
  }

  /**
   * Initialize cache connection and verify connectivity
   */
  async initialize(): Promise<void> {
    try {
      await this.redisClient.ping();
      logger.info('PriceCache initialized successfully');
    } catch (error) {
      logger.error('PriceCache initialization failed', { error });
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisClient.get(key);
      if (!value) {
        this.cacheMisses++;
        return null;
      }
      this.cacheHits++;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, { error });
      this.cacheMisses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const expiryTime = ttl || this.defaultTTL;
      await this.redisClient.setex(key, expiryTime, JSON.stringify(value));
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, { error });
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      logger.error(`Cache invalidate error for key ${key}:`, { error });
    }
  }

  async invalidateProduct(productId: number): Promise<void> {
    try {
      const keys = await this.scanKeys(`price:product:${productId}*`);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error) {
      logger.error(`Cache invalidateProduct error for productId ${productId}:`, { error });
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, foundKeys] = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');
    return keys;
  }

  async invalidateCustomerTier(customerId: number): Promise<void> {
    try {
      const key = `price:tier:${customerId}`;
      await this.redisClient.del(key);
    } catch (error) {
      logger.error(`Cache invalidateCustomerTier error for customerId ${customerId}:`, { error });
    }
  }

  async invalidatePromotion(productId: number): Promise<void> {
    try {
      const key = `price:promotion:${productId}`;
      await this.redisClient.del(key);
    } catch (error) {
      logger.error(`Cache invalidatePromotion error for productId ${productId}:`, { error });
    }
  }

  /**
   * Warm up cache with popular/frequently accessed prices
   * @param productIds - Array of product IDs to pre-cache
   * @param prices - Map of product ID to price data
   */
  async warmUpPopularPrices(productIds: number[], prices: Map<number, unknown>): Promise<void> {
    try {
      const pipeline = this.redisClient.pipeline();

      for (const productId of productIds) {
        const priceData = prices.get(productId);
        if (priceData) {
          const key = `price:product:${productId}`;
          pipeline.setex(key, this.defaultTTL, JSON.stringify(priceData));
        }
      }

      await pipeline.exec();
      logger.info(`Warmed up cache for ${productIds.length} products`);
    } catch (error) {
      logger.error('Cache warm-up failed', { error });
    }
  }

  /**
   * Flush all pricing-related cache entries
   */
  async flush(): Promise<void> {
    try {
      const keys = await this.scanKeys('price:*');
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        logger.info(`Flushed ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Cache flush failed', { error });
    }
  }

  /**
   * Get cache hit rate as percentage
   */
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    if (total === 0) return 0;
    return (this.cacheHits / total) * 100;
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}
