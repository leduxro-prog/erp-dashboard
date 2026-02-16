/**
 * Cache Service
 * Provides caching layer for frequently accessed data to improve performance.
 */

import Redis from 'ioredis';

export interface CacheConfig {
    host: string;
    port: number;
    password?: string;
    keyPrefix?: string;
    defaultTTL?: number;
}

export class CacheService {
    private redis: Redis | null = null;
    private memoryCache: Map<string, { value: any; expiresAt: number }> = new Map();
    private defaultTTL: number;
    private keyPrefix: string;

    constructor(config?: CacheConfig) {
        this.defaultTTL = config?.defaultTTL || 300; // 5 minutes default
        this.keyPrefix = config?.keyPrefix || 'cypher:';

        if (config?.host) {
            try {
                this.redis = new Redis({
                    host: config.host,
                    port: config.port,
                    password: config.password,
                    keyPrefix: this.keyPrefix,
                    lazyConnect: true,
                });
            } catch {
                console.warn('Redis not available, using in-memory cache');
            }
        }
    }

    /**
     * Get a cached value.
     */
    async get<T>(key: string): Promise<T | null> {
        const fullKey = this.keyPrefix + key;

        // Try Redis first
        if (this.redis) {
            try {
                const value = await this.redis.get(key);
                return value ? JSON.parse(value) : null;
            } catch {
                // Fall through to memory cache
            }
        }

        // Memory cache fallback
        const cached = this.memoryCache.get(fullKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value as T;
        }

        if (cached) {
            this.memoryCache.delete(fullKey);
        }

        return null;
    }

    /**
     * Set a cached value.
     */
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const fullKey = this.keyPrefix + key;
        const ttl = ttlSeconds || this.defaultTTL;

        // Try Redis first
        if (this.redis) {
            try {
                await this.redis.setex(key, ttl, JSON.stringify(value));
                return;
            } catch {
                // Fall through to memory cache
            }
        }

        // Memory cache fallback
        this.memoryCache.set(fullKey, {
            value,
            expiresAt: Date.now() + ttl * 1000,
        });
    }

    /**
     * Delete a cached value.
     */
    async delete(key: string): Promise<void> {
        const fullKey = this.keyPrefix + key;

        if (this.redis) {
            try {
                await this.redis.del(key);
            } catch {
                // Ignore
            }
        }

        this.memoryCache.delete(fullKey);
    }

    /**
     * Delete by pattern (only full key prefix match for memory cache).
     */
    async deleteByPattern(pattern: string): Promise<void> {
        if (this.redis) {
            try {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                }
            } catch {
                // Ignore
            }
        }

        // Memory cache: delete matching keys
        const fullPattern = this.keyPrefix + pattern.replace('*', '');
        for (const key of this.memoryCache.keys()) {
            if (key.startsWith(fullPattern)) {
                this.memoryCache.delete(key);
            }
        }
    }

    /**
     * Get or set with callback.
     */
    async getOrSet<T>(key: string, callback: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await callback();
        await this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Clear all cache.
     */
    async clear(): Promise<void> {
        if (this.redis) {
            try {
                await this.redis.flushdb();
            } catch {
                // Ignore
            }
        }

        this.memoryCache.clear();
    }

    /**
     * Get cache stats.
     */
    getStats() {
        return {
            memoryEntries: this.memoryCache.size,
            redisConnected: this.redis?.status === 'ready',
        };
    }
}

// Common cache key patterns
export const CacheKeys = {
    product: (id: string) => `product:${id}`,
    productList: (page: number, limit: number) => `products:list:${page}:${limit}`,
    inventory: (productId: string, warehouseId: string) => `inventory:${productId}:${warehouseId}`,
    customerLoyalty: (customerId: string) => `loyalty:${customerId}`,
    pricingTier: (tierId: string) => `pricing:tier:${tierId}`,
    orderSummary: (orderId: string) => `order:summary:${orderId}`,
};
