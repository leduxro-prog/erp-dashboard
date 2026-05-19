import { createHash } from 'crypto';

import Redis from 'ioredis';

import {
  INVENTORY_FACETS_CACHE_VERSION_KEY,
  INVENTORY_LIST_CACHE_VERSION_KEY,
} from '@shared/constants/cache-keys';
import { createModuleLogger } from '@shared/utils/logger';

type JsonRecord = Record<string, unknown>;

export class InventoryListCache {
  private readonly logger = createModuleLogger('InventoryListCache');
  private readonly listTtlSeconds = 60;
  private readonly facetsTtlSeconds = 300;
  private readonly listVersionKey = INVENTORY_LIST_CACHE_VERSION_KEY;
  private readonly facetsVersionKey = INVENTORY_FACETS_CACHE_VERSION_KEY;

  constructor(private redis: Redis) {}

  async getList<T>(payload: JsonRecord): Promise<T | null> {
    return this.getCached<T>('list', payload, this.listVersionKey);
  }

  async setList(payload: JsonRecord, value: unknown): Promise<void> {
    await this.setCached('list', payload, value, this.listVersionKey, this.listTtlSeconds);
  }

  async getFacets<T>(payload: JsonRecord): Promise<T | null> {
    return this.getCached<T>('facets', payload, this.facetsVersionKey);
  }

  async setFacets(payload: JsonRecord, value: unknown): Promise<void> {
    await this.setCached('facets', payload, value, this.facetsVersionKey, this.facetsTtlSeconds);
  }

  async invalidateAll(): Promise<void> {
    try {
      await this.redis.multi().incr(this.listVersionKey).incr(this.facetsVersionKey).exec();
    } catch (error) {
      this.logger.warn('Failed to invalidate inventory list cache namespace', { error });
    }
  }

  private async getCached<T>(
    scope: 'list' | 'facets',
    payload: JsonRecord,
    versionKey: string,
  ): Promise<T | null> {
    try {
      const version = await this.getNamespaceVersion(versionKey);
      const key = this.buildCacheKey(scope, version, payload);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(`Failed to read inventory ${scope} cache`, { error });
      return null;
    }
  }

  private async setCached(
    scope: 'list' | 'facets',
    payload: JsonRecord,
    value: unknown,
    versionKey: string,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const version = await this.getNamespaceVersion(versionKey);
      const key = this.buildCacheKey(scope, version, payload);
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`Failed to write inventory ${scope} cache`, { error });
    }
  }

  private async getNamespaceVersion(versionKey: string): Promise<number> {
    const rawValue = await this.redis.get(versionKey);

    if (!rawValue) {
      await this.redis.setnx(versionKey, '1');
      return 1;
    }

    const parsed = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private buildCacheKey(scope: 'list' | 'facets', version: number, payload: JsonRecord): string {
    const serializedPayload = JSON.stringify(payload);
    const digest = createHash('sha1').update(serializedPayload).digest('hex');
    return `inventory:${scope}:v1:${version}:${digest}`;
  }
}
