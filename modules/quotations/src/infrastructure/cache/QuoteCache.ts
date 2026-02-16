import { Redis } from 'ioredis';
import { Quote } from '../../domain/entities/Quote';

export class QuoteCache {
  private readonly TTL = 3600; // 1 hour in seconds
  private readonly KEY_PREFIX = 'quote:';

  constructor(private redis: Redis) {}

  async get(quoteId: string): Promise<Quote | null> {
    const cached = await this.redis.get(`${this.KEY_PREFIX}${quoteId}`);
    if (!cached) {
      return null;
    }
    return JSON.parse(cached) as Quote;
  }

  async set(quote: Quote): Promise<void> {
    await this.redis.setex(
      `${this.KEY_PREFIX}${quote.id}`,
      this.TTL,
      JSON.stringify(quote),
    );
  }

  async delete(quoteId: string): Promise<void> {
    await this.redis.del(`${this.KEY_PREFIX}${quoteId}`);
  }

  async invalidateCustomerQuotes(customerId: string): Promise<void> {
    const pattern = `quote:*`;
    const keys = await this.scanKeys(pattern);

    for (const key of keys) {
      const cached = await this.redis.get(key);
      if (cached) {
        const quote = JSON.parse(cached) as Quote;
        if (quote.customerId === customerId) {
          await this.redis.del(key);
        }
      }
    }
  }

  async clear(): Promise<void> {
    const pattern = `${this.KEY_PREFIX}*`;
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
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
}
