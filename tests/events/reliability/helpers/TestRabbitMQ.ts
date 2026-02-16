/**
 * Test RabbitMQ setup for chaos and reliability testing.
 *
 * Provides utilities for managing test RabbitMQ instances,
 * creating test queues/exchanges, simulating failures,
 * and validating message delivery.
 *
 * @module TestRabbitMQ
 */

import * as amqp from 'amqplib';
import type {
  ChannelModel,
  Channel,
  ConfirmChannel,
  ConsumeMessage,
  Options,
  Replies,
  Message,
} from 'amqplib';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test exchange configuration
 */
export interface TestExchange {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  options?: Options.AssertExchange;
}

/**
 * Test queue configuration
 */
export interface TestQueue {
  name: string;
  options?: Options.AssertQueue;
  bindings?: Array<{ exchange: string; routingKey: string; args?: Record<string, unknown> }>;
}

/**
 * Message consumption result
 */
export interface ConsumedMessage {
  content: any;
  properties: any;
  fields: any;
  redelivered: boolean;
  timestamp: number;
  deliveryTag: number;
}

/**
 * Message publication result
 */
export interface PublishResult {
  success: boolean;
  sequence?: number;
  error?: Error;
  returned?: boolean;
  deliveryTag?: number;
}

/**
 * Test RabbitMQ configuration
 */
export interface TestRabbitMQConfig {
  url?: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  vhost?: string;
  connectionTimeout?: number;
}

/**
 * Test statistics
 */
export interface TestStats {
  messagesPublished: number;
  messagesConsumed: number;
  messagesFailed: number;
  connectionErrors: number;
  reconnections: number;
  avgPublishLatency: number;
  avgConsumeLatency: number;
}

/**
 * Test RabbitMQ instance for chaos testing
 */
export class TestRabbitMQ {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;

  private readonly config: TestRabbitMQConfig;
  private exchanges: Map<string, TestExchange> = new Map();
  private queues: Map<string, TestQueue> = new Map();
  private consumers: Map<string, (msg: ConsumeMessage | null) => void> = new Map();
  private consumedMessages: Map<string, ConsumedMessage[]> = new Map();
  private publishLatencies: number[] = [];
  private consumeLatencies: number[] = [];

  private connectionErrors: number = 0;
  private isSimulatingFailure: boolean = false;

  constructor(config: TestRabbitMQConfig = {}) {
    this.config = {
      url: config.url || process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
      hostname: config.hostname || 'localhost',
      port: config.port || 5672,
      username: config.username || 'guest',
      password: config.password || 'guest',
      vhost: config.vhost || '/',
      connectionTimeout: config.connectionTimeout || 10000,
    };
  }

  /**
   * Establishes connection to RabbitMQ
   */
  public async connect(): Promise<void> {
    const connectionString = this.buildConnectionString();
    this.connection = await amqp.connect(connectionString);

    this.connection.on('error', (err) => {
      this.connectionErrors++;
      console.error(`[TestRabbitMQ] Connection error:`, err.message);
      if (!this.isSimulatingFailure) {
        this.handleReconnect();
      }
    });

    this.connection.on('close', () => {
      console.log('[TestRabbitMQ] Connection closed');
      if (!this.isSimulatingFailure) {
        this.handleReconnect();
      }
    });

    this.channel = await this.connection.createConfirmChannel();

    this.channel.on('error', (err) => {
      console.error(`[TestRabbitMQ] Channel error:`, err.message);
    });

    this.channel.on('close', () => {
      console.log('[TestRabbitMQ] Channel closed');
    });

    await this.channel.prefetch(10);
    this.reconnectAttempts = 0;
  }

  /**
   * Builds connection string from config
   */
  private buildConnectionString(): string {
    if (this.config.url) {
      return this.config.url;
    }

    const { username, password, hostname, port, vhost } = this.config;
    const encodedVhost = encodeURIComponent(vhost || '/');
    return `amqp://${username}:${password}@${hostname}:${port}${encodedVhost}`;
  }

  /**
   * Handles reconnection
   */
  private async handleReconnect(): Promise<void> {
    if (this.isSimulatingFailure) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[TestRabbitMQ] Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`[TestRabbitMQ] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect();
      this.reconnectAttempts++;
      console.log('[TestRabbitMQ] Reconnection successful');
    } catch (error) {
      this.reconnectAttempts++;
      this.handleReconnect();
    }
  }

  /**
   * Declares a test exchange
   */
  public async declareExchange(exchange: TestExchange): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    await this.channel!.assertExchange(
      exchange.name,
      exchange.type,
      exchange.options || {}
    );

    this.exchanges.set(exchange.name, exchange);
    console.log(`[TestRabbitMQ] Exchange declared: ${exchange.name} (${exchange.type})`);
  }

  /**
   * Declares a test queue
   */
  public async declareQueue(queue: TestQueue): Promise<Replies.AssertQueue> {
    if (!this.channel) {
      await this.connect();
    }

    const result = await this.channel!.assertQueue(
      queue.name,
      queue.options || {}
    );

    // Create bindings
    if (queue.bindings) {
      for (const binding of queue.bindings) {
        await this.channel!.bindQueue(
          queue.name,
          binding.exchange,
          binding.routingKey,
          binding.args
        );
        console.log(`[TestRabbitMQ] Queue ${queue.name} bound to ${binding.exchange} with ${binding.routingKey}`);
      }
    }

    this.queues.set(queue.name, queue);
    this.consumedMessages.set(queue.name, []);

    console.log(`[TestRabbitMQ] Queue declared: ${queue.name} (${result.messageCount} messages)`);
    return result;
  }

  /**
   * Publishes a message
   */
  public async publish(
    exchange: string,
    routingKey: string,
    content: any,
    options: Options.Publish = {}
  ): Promise<PublishResult> {
    if (!this.channel) {
      await this.connect();
    }

    const startTime = Date.now();

    try {
      const contentBuffer = Buffer.from(JSON.stringify(content));
      const sequence = this.channel!.publish(
        exchange,
        routingKey,
        contentBuffer,
        {
          contentType: 'application/json',
          ...options,
        }
      );

      this.publishLatencies.push(Date.now() - startTime);

      if (!sequence) {
        return {
          success: false,
          error: new Error('Publish failed - buffer full or channel closed'),
        };
      }

      return { success: true };
    } catch (error) {
      this.publishLatencies.push(Date.now() - startTime);
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Publishes multiple messages
   */
  public async publishBatch(
    exchange: string,
    routingKey: string,
    messages: any[],
    options: Options.Publish = {}
  ): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const msg of messages) {
      const result = await this.publish(exchange, routingKey, msg, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Starts consuming from a queue
   */
  public async consume(
    queue: string,
    handler: (msg: ConsumeMessage | null) => void,
    options: Options.Consume = {}
  ): Promise<Replies.Consume> {
    if (!this.channel) {
      await this.connect();
    }

    const result = await this.channel!.consume(queue, handler, options);
    this.consumers.set(result.consumerTag, handler);

    console.log(`[TestRabbitMQ] Started consuming from queue: ${queue} (${result.consumerTag})`);
    return result;
  }

  /**
   * Collects consumed messages from a queue
   */
  public async collectMessages(
    queue: string,
    count: number,
    timeout: number = 10000
  ): Promise<ConsumedMessage[]> {
    const messages: ConsumedMessage[] = [];

    await this.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) {
        return;
      }

      const startTime = Date.now();
      const content = JSON.parse(msg.content.toString());

      messages.push({
        content,
        properties: msg.properties,
        fields: msg.fields,
        redelivered: msg.fields.redelivered,
        timestamp: Date.now(),
        deliveryTag: msg.fields.deliveryTag,
      });

      this.consumeLatencies.push(Date.now() - startTime);

      // Acknowledge message
      this.channel?.ack(msg);

      if (messages.length >= count) {
        // Cancel consumer after collecting enough messages
        await this.cancelConsumer(msg.fields.consumerTag);
      }
    });

    // Wait for messages or timeout
    const startTime = Date.now();
    while (messages.length < count && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return messages;
  }

  /**
   * Cancels a consumer
   */
  public async cancelConsumer(consumerTag: string): Promise<void> {
    if (!this.channel) {
      return;
    }

    try {
      await this.channel.cancel(consumerTag);
      this.consumers.delete(consumerTag);
      console.log(`[TestRabbitMQ] Cancelled consumer: ${consumerTag}`);
    } catch (error) {
      console.error(`[TestRabbitMQ] Failed to cancel consumer:`, error);
    }
  }

  /**
   * Gets message count in a queue
   */
  public async getQueueMessageCount(queue: string): Promise<number> {
    if (!this.channel) {
      await this.connect();
    }

    try {
      const result = await this.channel!.checkQueue(queue);
      return result.messageCount;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Purges a queue
   */
  public async purgeQueue(queue: string): Promise<number> {
    if (!this.channel) {
      await this.connect();
    }

    try {
      const result = await this.channel!.purgeQueue(queue);
      console.log(`[TestRabbitMQ] Purged queue: ${queue} (${result.messageCount} messages)`);
      return result.messageCount;
    } catch (error) {
      console.error(`[TestRabbitMQ] Failed to purge queue:`, error);
      return 0;
    }
  }

  /**
   * Deletes a queue
   */
  public async deleteQueue(queue: string, options: Options.DeleteQueue = {}): Promise<Replies.DeleteQueue> {
    if (!this.channel) {
      await this.connect();
    }

    const result = await this.channel!.deleteQueue(queue, options);
    this.queues.delete(queue);
    this.consumedMessages.delete(queue);

    console.log(`[TestRabbitMQ] Deleted queue: ${queue}`);
    return result;
  }

  /**
   * Deletes an exchange
   */
  public async deleteExchange(exchange: string, options: Options.DeleteExchange = {}): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    await this.channel!.deleteExchange(exchange, options);
    this.exchanges.delete(exchange);

    console.log(`[TestRabbitMQ] Deleted exchange: ${exchange}`);
  }

  /**
   * Simulates connection failure
   */
  public async simulateConnectionFailure(duration: number = 5000): Promise<void> {
    this.isSimulatingFailure = true;

    if (this.connection) {
      console.log(`[TestRabbitMQ] Simulating connection failure for ${duration}ms`);
      await this.connection.close();
      this.channel = null;
    }

    await new Promise((resolve) => setTimeout(resolve, duration));
    this.isSimulatingFailure = false;

    console.log('[TestRabbitMQ] Restoring connection');
    await this.connect();
  }

  /**
   * Simulates channel failure
   */
  public async simulateChannelFailure(duration: number = 3000): Promise<void> {
    if (!this.channel) {
      return;
    }

    console.log(`[TestRabbitMQ] Simulating channel failure for ${duration}ms`);
    const originalChannel = this.channel;
    this.channel = null;

    await new Promise((resolve) => setTimeout(resolve, duration));

    console.log('[TestRabbitMQ] Recreating channel');
    this.channel = await this.connection!.createConfirmChannel();
    await this.channel.prefetch(10);
  }

  /**
   * Blocks network traffic simulation
   * Note: This is a simulation that affects the connection state
   */
  public async simulateNetworkPartition(duration: number = 5000): Promise<void> {
    console.log(`[TestRabbitMQ] Simulating network partition for ${duration}ms`);
    this.isSimulatingFailure = true;

    if (this.connection) {
      await this.connection.close();
      this.channel = null;
    }

    await new Promise((resolve) => setTimeout(resolve, duration));

    this.isSimulatingFailure = false;
    await this.connect();

    console.log('[TestRabbitMQ] Network partition ended, connection restored');
  }

  /**
   * Gets test statistics
   */
  public getStats(): TestStats {
    const totalPublishLatency = this.publishLatencies.reduce((a, b) => a + b, 0);
    const totalConsumeLatency = this.consumeLatencies.reduce((a, b) => a + b, 0);

    return {
      messagesPublished: this.publishLatencies.length,
      messagesConsumed: this.consumeLatencies.length,
      messagesFailed: this.connectionErrors,
      connectionErrors: this.connectionErrors,
      reconnections: this.reconnectAttempts,
      avgPublishLatency: this.publishLatencies.length > 0
        ? totalPublishLatency / this.publishLatencies.length
        : 0,
      avgConsumeLatency: this.consumeLatencies.length > 0
        ? totalConsumeLatency / this.consumeLatencies.length
        : 0,
    };
  }

  /**
   * Resets statistics
   */
  public resetStats(): void {
    this.publishLatencies = [];
    this.consumeLatencies = [];
    this.connectionErrors = 0;
    this.reconnectAttempts = 0;
  }

  /**
   * Cleans up test resources
   */
  public async cleanup(): Promise<void> {
    console.log('[TestRabbitMQ] Cleaning up test resources');

    // Cancel all consumers
    for (const consumerTag of Array.from(this.consumers.keys())) {
      await this.cancelConsumer(consumerTag);
    }

    // Delete all queues
    for (const queueName of Array.from(this.queues.keys())) {
      try {
        await this.deleteQueue(queueName);
      } catch (error) {
        console.error(`[TestRabbitMQ] Failed to delete queue ${queueName}:`, error);
      }
    }

    // Delete all exchanges (excluding default)
    for (const exchangeName of Array.from(this.exchanges.keys())) {
      if (!exchangeName.startsWith('amq.')) {
        try {
          await this.deleteExchange(exchangeName);
        } catch (error) {
          console.error(`[TestRabbitMQ] Failed to delete exchange ${exchangeName}:`, error);
        }
      }
    }

    // Close connection
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.exchanges.clear();
    this.queues.clear();
    this.consumers.clear();
    this.consumedMessages.clear();
    this.resetStats();

    console.log('[TestRabbitMQ] Cleanup complete');
  }

  /**
   * Checks if connected
   */
  public isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Gets the channel
   */
  public getChannel(): ConfirmChannel | null {
    return this.channel;
  }

  /**
   * Gets the connection
   */
  public getConnection(): ChannelModel | null {
    return this.connection;
  }

  /**
   * Creates a unique test queue name
   */
  public static createTestQueueName(prefix: string = 'test'): string {
    const uuid = uuidv4().substring(0, 8);
    return `${prefix}-${uuid}`;
  }

  /**
   * Creates a unique test exchange name
   */
  public static createTestExchangeName(prefix: string = 'test'): string {
    const uuid = uuidv4().substring(0, 8);
    return `${prefix}-${uuid}`;
  }
}

/**
 * Factory function for creating test RabbitMQ instances
 */
export function createTestRabbitMQ(config?: TestRabbitMQConfig): TestRabbitMQ {
  return new TestRabbitMQ(config);
}

/**
 * Setup function for standard test topology
 */
export async function setupTestTopology(
  rmq: TestRabbitMQ,
  exchangeName?: string,
  queueName?: string
): Promise<{ exchange: string; queue: string; routingKey: string }> {
  const exchange = exchangeName || TestRabbitMQ.createTestExchangeName('events');
  const queue = queueName || TestRabbitMQ.createTestQueueName('events');
  const routingKey = 'test.event';

  // Declare exchange
  await rmq.declareExchange({
    name: exchange,
    type: 'topic',
    options: { durable: true },
  });

  // Declare queue
  await rmq.declareQueue({
    name: queue,
    options: { durable: true },
    bindings: [{ exchange, routingKey }],
  });

  return { exchange, queue, routingKey };
}
