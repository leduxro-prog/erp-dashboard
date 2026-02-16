import Redis from 'ioredis';
import { createModuleLogger } from '@shared/utils/logger';
import { StockLevel } from '../../domain/ports/IInventoryRepository';

export class StockCache {
  private readonly TTL = 300; // 5 minutes
  private readonly logger = createModuleLogger('StockCache');

  constructor(private redis: Redis) { }

  async getStock(productId: string): Promise<StockLevel[] | null> {
    try {
      const key = this.getKey(productId);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      this.logger.warn(`Failed to get stock from cache for product ${productId}:`, error);
      return null;
    }
  }

  async setStock(productId: string, levels: StockLevel[]): Promise<void> {
    try {
      const key = this.getKey(productId);
      await this.redis.setex(key, this.TTL, JSON.stringify(levels));
    } catch (error) {
      this.logger.warn(`Failed to set stock in cache for product ${productId}:`, error);
    }
  }

  async invalidate(productId: string): Promise<void> {
    try {
      const key = this.getKey(productId);
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for product ${productId}:`, error);
    }
  }

  async invalidateWarehouse(warehouseId: string): Promise<void> {
    try {
      const pattern = `stock:product:*`;
      const keys = await this.scanKeys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate warehouse cache for ${warehouseId}:`, error);
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, foundKeys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');
    return keys;
  }

  private getKey(productId: string): string {
    return `stock:product:${productId}`;
  }
}
