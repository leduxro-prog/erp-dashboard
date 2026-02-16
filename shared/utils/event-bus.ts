import Redis from 'ioredis';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('event-bus');

/**
 * Internal subscriber record containing event handler.
 *
 * @internal
 */
interface Subscriber {
  /** Event handler function */
  handler: (data: unknown) => void;
}

/**
 * Map of channel names to subscriber arrays.
 *
 * @internal
 */
type SubscriberMap = Map<string, Subscriber[]>;

/**
 * EventBus class - Pub/Sub event system backed by Redis.
 * Provides decoupled event-driven communication between services.
 *
 * Uses Redis for reliable message delivery across service boundaries.
 * Supports multiple subscribers per channel and automatic reconnection.
 *
 * Channel naming convention: `entity.event` (e.g., `order.created`, `product.updated`)
 *
 * @example
 * const eventBus = getEventBus();
 * await eventBus.subscribe('order.created', (data) => {
 *   console.log('Order created:', data);
 * });
 * await eventBus.publish('order.created', { orderId: 123, status: 'confirmed' });
 */
class EventBus {
  private publisherClient: Redis | null = null;
  private subscriberClient: Redis | null = null;
  private subscribers: SubscriberMap = new Map();
  private isConnected = false;
  private messageHandlerRegistered = false;

  get client(): Redis | null {
    return this.publisherClient;
  }

  private getRedisConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    };
  }

  /**
   * Initialize Redis connections (separate publish and subscribe clients).
   * Sets up error handlers and verifies connectivity.
   *
   * @returns Promise that resolves when connections are established
   * @throws {Error} If Redis connection fails
   *
   * @internal
   */
  private async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const redisConfig = this.getRedisConfig();

      // Create separate clients for publishing and subscribing
      this.publisherClient = new Redis(redisConfig);
      this.subscriberClient = new Redis(redisConfig);

      // Set up error handlers
      this.publisherClient.on('error', (err) => {
        logger.error('Publisher Redis error', { error: err.message });
      });

      this.subscriberClient.on('error', (err) => {
        logger.error('Subscriber Redis error', { error: err.message });
      });

      // Wait for connections to be ready
      await Promise.all([this.publisherClient.ping(), this.subscriberClient.ping()]);

      this.isConnected = true;
      logger.info('EventBus: Redis connections established');

      // Re-subscribe to existing channels
      await this.resubscribeAll();
    } catch (error) {
      logger.error('Failed to connect to Redis', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Re-subscribe to all channels after reconnection with exponential backoff retry.
   * Recovers subscriptions after Redis connection is restored.
   *
   * @returns Promise that resolves when all channels are re-subscribed
   *
   * @internal
   */
  private async resubscribeAll(): Promise<void> {
    const maxRetries = 3;
    const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

    for (const channel of this.subscribers.keys()) {
      let retryCount = 0;
      let lastError: Error | null = null;

      while (retryCount < maxRetries) {
        try {
          await this.subscriberClient!.subscribe(channel, (err, count) => {
            if (err) {
              logger.error('Subscribe error', { channel, error: err.message });
            } else {
              logger.debug(`Subscribed to channel: ${channel} (${count} total)`);
            }
          });
          // Success, break out of retry loop
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          retryCount++;

          if (retryCount < maxRetries) {
            const delayMs = delays[retryCount - 1];
            logger.warn('Resubscribe failed, retrying...', {
              channel,
              attempt: retryCount,
              maxAttempts: maxRetries,
              delayMs,
              error: lastError.message,
            });
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            logger.error('Resubscribe failed after max retries', {
              channel,
              attempts: maxRetries,
              error: lastError.message,
            });
          }
        }
      }
    }
  }

  /**
   * Publish an event to a channel.
   * Broadcasts event data to all subscribers on the channel.
   * Automatically connects if not yet connected.
   *
   * @param channel - Channel name (e.g., 'order.created', 'product.updated')
   * @param data - Event payload (automatically serialized to JSON)
   * @returns Promise that resolves when event is published
   * @throws {Error} If publishing fails
   *
   * @example
   * await eventBus.publish('order.created', {
   *   orderId: 123,
   *   customerId: 456,
   *   status: 'confirmed'
   * });
   */
  async publish(channel: string, data: unknown): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const serialized = JSON.stringify(data);
      await this.publisherClient!.publish(channel, serialized);
      logger.debug(`Event published`, { channel, dataSize: serialized.length });
    } catch (error) {
      logger.error('Failed to publish event', {
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Subscribe to a channel.
   * Registers a handler to receive events published on the channel.
   * Automatically connects if not yet connected.
   * Multiple handlers can be registered on the same channel.
   *
   * @param channel - Channel name (e.g., 'order.created', 'product.updated')
   * @param handler - Async or sync callback to handle received events
   * @returns Promise that resolves when subscription is confirmed
   * @throws {Error} If subscription fails
   *
   * @example
   * await eventBus.subscribe('order.created', (event) => {
   *   console.log('Order created event received:', event);
   *   // event is automatically deserialized from JSON
   * });
   */
  async subscribe(channel: string, handler: (data: unknown) => void): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Store handler locally
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, []);
      }
      this.subscribers.get(channel)!.push({ handler });

      // Register the message listener only once
      if (!this.messageHandlerRegistered) {
        this.messageHandlerRegistered = true;
        this.subscriberClient!.on('message', (subscribedChannel, message) => {
          const channelSubscribers = this.subscribers.get(subscribedChannel);
          if (channelSubscribers) {
            for (const subscriber of channelSubscribers) {
              try {
                const data = JSON.parse(message);
                subscriber.handler(data);
              } catch (error) {
                logger.error('Failed to process event', {
                  channel: subscribedChannel,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
        });
      }

      await this.subscriberClient!.subscribe(channel, (err, count) => {
        if (err) {
          logger.error('Subscribe error', { channel, error: err.message });
        } else {
          logger.info(`Subscribed to channel: ${channel} (${count} total)`);
        }
      });
    } catch (error) {
      logger.error('Failed to subscribe', {
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unsubscribe from a channel.
   * Removes all handlers registered for this channel.
   * Gracefully handles disconnected state.
   *
   * @param channel - Channel name to unsubscribe from
   * @returns Promise that resolves when unsubscription is confirmed
   * @throws {Error} If unsubscription fails while connected
   *
   * @example
   * await eventBus.unsubscribe('order.created');
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      if (!this.isConnected) {
        return;
      }

      this.subscribers.delete(channel);
      await this.subscriberClient!.unsubscribe(channel);
      logger.info(`Unsubscribed from channel: ${channel}`);
    } catch (error) {
      logger.error('Failed to unsubscribe', {
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Disconnect from Redis.
   * Closes both publisher and subscriber connections.
   * Clears all registered subscriptions.
   *
   * @returns Promise that resolves when connections are closed
   * @throws {Error} If disconnection fails
   *
   * @example
   * await eventBus.disconnect();
   */
  async disconnect(): Promise<void> {
    try {
      if (this.publisherClient) {
        await this.publisherClient.quit();
      }
      if (this.subscriberClient) {
        await this.subscriberClient.quit();
      }
      this.isConnected = false;
      this.subscribers.clear();
      logger.info('EventBus: Redis connections closed');
    } catch (error) {
      logger.error('Failed to disconnect', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

/**
 * Get or create the singleton EventBus instance.
 * Initializes EventBus on first call, returns cached instance thereafter.
 * Thread-safe for use across multiple modules.
 *
 * @returns Singleton EventBus instance
 *
 * @example
 * const eventBus = getEventBus();
 * await eventBus.subscribe('product.created', handler);
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

export default getEventBus();
