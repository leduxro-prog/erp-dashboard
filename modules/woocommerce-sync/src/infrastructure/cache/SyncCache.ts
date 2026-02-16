import * as redis from 'redis';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('sync-cache');

export class SyncCache {
  private client: ReturnType<typeof redis.createClient>;

  constructor(redisUrl: string) {
    this.client = redis.createClient({
      url: redisUrl,
    });

    this.client.on('error', (err: Error) => {
      logger.error('Redis Client Error', { error: err });
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async setMapping(
    internalProductId: string,
    wooCommerceProductId: number,
    ttlSeconds: number = 86400
  ): Promise<void> {
    const key = `wc_mapping:${internalProductId}`;
    await this.client.setEx(key, ttlSeconds, wooCommerceProductId.toString());
  }

  async getMapping(internalProductId: string): Promise<number | null> {
    const key = `wc_mapping:${internalProductId}`;
    const value = await this.client.get(key);

    if (!value) return null;

    return parseInt(value, 10);
  }

  async invalidateMapping(internalProductId: string): Promise<void> {
    const key = `wc_mapping:${internalProductId}`;
    await this.client.del(key);
  }

  async setSyncStatus(
    productId: string,
    status: string,
    ttlSeconds: number = 300
  ): Promise<void> {
    const key = `wc_sync_status:${productId}`;
    await this.client.setEx(key, ttlSeconds, status);
  }

  async getSyncStatus(productId: string): Promise<string | null> {
    const key = `wc_sync_status:${productId}`;
    return this.client.get(key);
  }

  async invalidateSyncStatus(productId: string): Promise<void> {
    const key = `wc_sync_status:${productId}`;
    await this.client.del(key);
  }

  async incrementSyncAttempts(productId: string): Promise<number> {
    const key = `wc_sync_attempts:${productId}`;
    return this.client.incr(key);
  }

  async getSyncAttempts(productId: string): Promise<number> {
    const key = `wc_sync_attempts:${productId}`;
    const value = await this.client.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  async resetSyncAttempts(productId: string): Promise<void> {
    const key = `wc_sync_attempts:${productId}`;
    await this.client.del(key);
  }

  async cacheLastSync(
    productId: string,
    timestamp: Date,
    ttlSeconds: number = 86400
  ): Promise<void> {
    const key = `wc_last_sync:${productId}`;
    await this.client.setEx(
      key,
      ttlSeconds,
      timestamp.toISOString()
    );
  }

  async getLastSync(productId: string): Promise<Date | null> {
    const key = `wc_last_sync:${productId}`;
    const value = await this.client.get(key);

    if (!value) return null;

    return new Date(value);
  }

  async flushAll(): Promise<void> {
    await this.client.flushDb();
  }
}
