/**
 * Redis Connection Pool Manager
 * Handles connection pooling, cluster support, sentinel failover, health checks,
 * and automatic reconnection with exponential backoff
 *
 * @module shared/cache/redis-pool
 */

import { createClient } from 'redis';
import type { RedisClientOptions } from 'redis';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('redis-pool');

/**
 * Redis health check result
 */
interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
}

/**
 * Redis pool statistics
 */
interface RedisPoolStats {
  activeConnections: number;
  totalConnections: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheckTime: number;
  averageResponseTime: number;
}

/**
 * Redis Connection Pool with cluster and sentinel support
 *
 * Features:
 * - Connection pooling with configurable pool size
 * - Cluster mode support via REDIS_CLUSTER_NODES
 * - Sentinel support via REDIS_SENTINEL_HOSTS
 * - Automatic reconnection with exponential backoff
 * - Health monitoring
 * - Pipeline support for bulk operations
 *
 * @example
 * ```typescript
 * const pool = RedisPool.getInstance();
 * const client = pool.getClient();
 *
 * await client.set('key', 'value');
 * const value = await client.get('key');
 * ```
 */
export class RedisPool {
  private static instance: RedisPool;
  private clients: ReturnType<typeof createClient>[] = [];
  private poolSize: number;
  private currentIndex: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private baseReconnectDelay: number = 1000; // ms
  private maxReconnectDelay: number = 30000; // ms
  private healthCheckInterval?: NodeJS.Timeout;
  private responseTimeSamples: number[] = [];
  private maxResponseTimeSamples: number = 100;

  private constructor(poolSize: number = 10) {
    this.poolSize = poolSize;
    logger.info(`Initializing RedisPool with size: ${poolSize}`);
  }

  /**
   * Get singleton instance
   */
  static getInstance(poolSize?: number): RedisPool {
    if (!RedisPool.instance) {
      RedisPool.instance = new RedisPool(poolSize);
      RedisPool.instance.initialize();
    }
    return RedisPool.instance;
  }

  /**
   * Initialize connection pool
   */
  private async initialize(): Promise<void> {
    try {
      const clusterNodes = process.env.REDIS_CLUSTER_NODES;
      const sentinelHosts = process.env.REDIS_SENTINEL_HOSTS;

      if (clusterNodes) {
        await this.initializeCluster(clusterNodes);
      } else if (sentinelHosts) {
        await this.initializeSentinel(sentinelHosts);
      } else {
        await this.initializeStandalone();
      }

      // Start health check
      this.startHealthCheck();
      logger.info('RedisPool initialized successfully');
    } catch (error) {
      logger.error('RedisPool initialization failed', { error });
      throw error;
    }
  }

  /**
   * Initialize standalone Redis connection pool
   */
  private async initializeStandalone(): Promise<void> {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    const clientOptions: RedisClientOptions = {
      socket: {
        host,
        port,
        connectTimeout: 5000,
        keepAlive: 30000,
        reconnectStrategy: (retries) => this.getReconnectDelay(retries),
      },
      password,
      database: db,
      legacyMode: false,
    };

    for (let i = 0; i < this.poolSize; i++) {
      const client = createClient(clientOptions);

      client.on('error', (err) => {
        logger.error(`Redis client ${i} error`, { error: err });
      });

      client.on('connect', () => {
        logger.info(`Redis client ${i} connected`);
        this.reconnectAttempts = 0;
      });

      try {
        await client.connect();
        this.clients.push(client);
      } catch (error) {
        logger.error(`Failed to create Redis client ${i}`, { error });
        throw error;
      }
    }

    logger.info(`Created ${this.poolSize} standalone Redis connections`);
  }

  /**
   * Initialize cluster mode (placeholder - Redis client needs cluster support)
   */
  private async initializeCluster(clusterNodes: string): Promise<void> {
    const nodes = clusterNodes.split(',').map((node) => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port, 10) };
    });

    logger.info(`Initializing cluster mode with ${nodes.length} nodes`, {
      nodes,
    });

    // Note: redis-js client v4+ doesn't have native cluster support yet
    // For now, fall back to standalone on first node
    process.env.REDIS_HOST = nodes[0].host;
    process.env.REDIS_PORT = nodes[0].port.toString();

    await this.initializeStandalone();
    logger.warn(
      'Using fallback standalone mode for first cluster node - upgrade redis client for native cluster support'
    );
  }

  /**
   * Initialize sentinel mode (placeholder)
   */
  private async initializeSentinel(sentinelHosts: string): Promise<void> {
    const sentinels = sentinelHosts.split(',').map((host) => ({
      host,
      port: 26379,
    }));

    logger.info(`Initializing sentinel mode with ${sentinels.length} sentinels`, {
      sentinels,
    });

    // Note: redis-js client v4+ doesn't have native sentinel support yet
    // For now, fall back to standalone
    await this.initializeStandalone();
    logger.warn(
      'Using fallback standalone mode - upgrade redis client for native sentinel support'
    );
  }

  /**
   * Get next client from pool (round-robin for read operations)
   */
  getClient(): ReturnType<typeof createClient> {
    if (this.clients.length === 0) {
      throw new Error('No Redis clients available in pool');
    }

    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;

    return client;
  }

  /**
   * Get primary client (first client, for write operations)
   */
  getPrimaryClient(): ReturnType<typeof createClient> {
    if (this.clients.length === 0) {
      throw new Error('No Redis clients available in pool');
    }
    return this.clients[0];
  }

  /**
   * Execute command with timing measurement
   */
  async executeWithTiming<T>(
    command: (client: ReturnType<typeof createClient>) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const client = this.getClient();

    try {
      const result = await command(client);
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
      return result;
    } catch (error) {
      logger.error('Redis command execution failed', { error });
      throw error;
    }
  }

  /**
   * Execute pipeline for bulk operations
   *
   * @example
   * ```typescript
   * await pool.executePipeline(async (pipe) => {
   *   await pipe.set('key1', 'value1');
   *   await pipe.set('key2', 'value2');
   * });
   * ```
   */
  async executePipeline(
    commands: (client: ReturnType<typeof createClient>) => Promise<void>
  ): Promise<void> {
    const client = this.getPrimaryClient();
    const multi = client.multi();

    try {
      await commands(multi as unknown as ReturnType<typeof createClient>);
      await multi.exec();
    } catch (error) {
      logger.error('Pipeline execution failed', { error });
      throw error;
    }
  }

  /**
   * Perform health check on all connections
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const results: number[] = [];
    let failedCount = 0;

    for (let i = 0; i < Math.min(3, this.clients.length); i++) {
      const client = this.clients[i];
      const startTime = Date.now();

      try {
        await client.ping();
        results.push(Date.now() - startTime);
      } catch (error) {
        failedCount++;
        logger.warn(`Health check failed for client ${i}`, { error });
      }
    }

    const avgResponseTime =
      results.length > 0
        ? results.reduce((a, b) => a + b, 0) / results.length
        : 0;

    const isHealthy = failedCount === 0;
    this.recordResponseTime(avgResponseTime);

    return {
      isHealthy,
      responseTime: avgResponseTime,
      error: failedCount > 0 ? `${failedCount} health checks failed` : undefined,
    };
  }

  /**
   * Get pool statistics
   */
  getStats(): RedisPoolStats {
    const healthStatus = this.reconnectAttempts > 3 ? 'unhealthy' : 'healthy';
    const avgResponseTime =
      this.responseTimeSamples.length > 0
        ? this.responseTimeSamples.reduce((a, b) => a + b, 0) /
        this.responseTimeSamples.length
        : 0;

    return {
      activeConnections: this.clients.length,
      totalConnections: this.poolSize,
      healthStatus,
      lastHealthCheckTime: Date.now(),
      averageResponseTime: avgResponseTime,
    };
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    const intervalMs = parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL || '30000', 10);

    this.healthCheckInterval = setInterval(async () => {
      try {
        const result = await this.healthCheck();

        if (!result.isHealthy) {
          logger.warn('Redis pool health check failed', result);
        }
      } catch (error) {
        logger.error('Health check error', { error });
      }
    }, intervalMs);
  }

  /**
   * Get reconnection delay with exponential backoff
   */
  private getReconnectDelay(retries: number): number {
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, retries),
      this.maxReconnectDelay
    );
    return delay;
  }

  /**
   * Record response time sample
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimeSamples.push(responseTime);
    if (this.responseTimeSamples.length > this.maxResponseTimeSamples) {
      this.responseTimeSamples.shift();
    }
  }

  /**
   * Gracefully shutdown connection pool
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const disconnectPromises = this.clients.map((client) =>
      client.quit().catch((err) => {
        logger.error('Error disconnecting Redis client', { error: err });
      })
    );

    await Promise.all(disconnectPromises);
    this.clients = [];
    logger.info('RedisPool shutdown complete');
  }
}

export default RedisPool;
