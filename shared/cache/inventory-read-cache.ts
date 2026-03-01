import Redis from 'ioredis';

import {
  INVENTORY_FACETS_CACHE_VERSION_KEY,
  INVENTORY_LIST_CACHE_VERSION_KEY,
} from '@shared/constants/cache-keys';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('inventory-read-cache');

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  return redisClient;
}

export async function invalidateInventoryReadCacheNamespace(): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis
      .multi()
      .incr(INVENTORY_LIST_CACHE_VERSION_KEY)
      .incr(INVENTORY_FACETS_CACHE_VERSION_KEY)
      .exec();
  } catch (error) {
    logger.warn('Failed to invalidate inventory read cache namespace', { error });
  }
}
