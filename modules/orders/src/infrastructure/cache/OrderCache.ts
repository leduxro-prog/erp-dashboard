import { Injectable } from '@nestjs/common';
import { RedisPool } from '@shared/cache/redis-pool';
import { OrderEntity, OrderStatus } from '../entities/OrderEntity';

@Injectable()
export class OrderCache {
  private redisPool: RedisPool;

  constructor() {
    this.redisPool = RedisPool.getInstance();
  }

  private readonly RECENT_ORDERS_KEY = 'orders:recent';
  private readonly ORDER_COUNT_KEY = 'orders:count:status';
  private readonly ORDER_KEY = 'order:';
  private readonly RECENT_TTL = 15 * 60; // 15 minutes
  private readonly COUNT_TTL = 5 * 60; // 5 minutes

  private get client() {
    return this.redisPool.getClient();
  }

  async cacheOrder(order: OrderEntity): Promise<void> {
    const key = `${this.ORDER_KEY}${order.id}`;
    await this.client.setEx(
      key,
      this.RECENT_TTL,
      JSON.stringify(order)
    );

    // Add to recent orders list
    await this.client.lPush(
      this.RECENT_ORDERS_KEY,
      order.id
    );
    await this.client.lTrim(
      this.RECENT_ORDERS_KEY,
      0,
      99
    );
    await this.client.expire(
      this.RECENT_ORDERS_KEY,
      this.RECENT_TTL
    );
  }

  async getOrder(orderId: string): Promise<OrderEntity | null> {
    const key = `${this.ORDER_KEY}${orderId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateOrder(orderId: string): Promise<void> {
    const key = `${this.ORDER_KEY}${orderId}`;
    await this.client.del(key);
    await this.client.lRem(this.RECENT_ORDERS_KEY, 1, orderId);
  }

  async getOrderCountByStatus(status: OrderStatus): Promise<number> {
    const key = `${this.ORDER_COUNT_KEY}:${status}`;
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async setOrderCountByStatus(status: OrderStatus, count: number): Promise<void> {
    const key = `${this.ORDER_COUNT_KEY}:${status}`;
    await this.client.setEx(
      key,
      this.COUNT_TTL,
      count.toString()
    );
  }

  async invalidateStatusCounts(): Promise<void> {
    const statuses = Object.values(OrderStatus);
    for (const status of statuses) {
      const key = `${this.ORDER_COUNT_KEY}:${status}`;
      await this.client.del(key);
    }
  }

  async invalidateRecentOrders(): Promise<void> {
    await this.client.del(this.RECENT_ORDERS_KEY);
  }

  async getRecentOrderIds(limit: number = 50): Promise<string[]> {
    const ids = await this.client.lRange(
      this.RECENT_ORDERS_KEY,
      0,
      limit - 1
    );
    return ids || [];
  }

  async clearAll(): Promise<void> {
    await this.client.del(this.RECENT_ORDERS_KEY);
    const statuses = Object.values(OrderStatus);
    for (const status of statuses) {
      const key = `${this.ORDER_COUNT_KEY}:${status}`;
      await this.client.del(key);
    }
  }
}
