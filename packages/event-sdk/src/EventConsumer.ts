/**
 * @file Event Consumer
 * @module event-sdk/EventConsumer
 * @description Main consumer class with connection management, channel setup, graceful shutdown
 */

import {
  Connection,
  Channel,
  connect,
  Message,
  Options,
  Replies,
} from 'amqplib';
import {
  EventSDKConfig,
  QueueConfig,
  ExchangeConfig,
  BindingConfig,
  ConsumerConfig,
  ConnectionOptions,
  ConnectionStatus,
  ConnectionState,
  ConsumerStats,
  EventHandlerRegistration,
  Logger,
  SubscriptionOptions,
} from './types';
import { EventEnvelope, EventPriority } from '@cypher/events';
import { EventProcessor } from './EventProcessor';
import { v4 as uuidv4 } from 'uuid';

/**
 * Default SDK configuration
 */
const DEFAULT_SDK_CONFIG: Partial<EventSDKConfig> = {
  connection: {
    hostname: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
    vhost: '/',
    heartbeat: 60,
    timeout: 10000,
  },
  consumer: {
    prefetch: 10,
    noAck: false,
  },
  shutdownTimeout: 30000,
  enableGracefulShutdown: true,
  logLevel: 'info',
  enableMetrics: true,
};

/**
 * Default logger implementation
 */
class DefaultLogger implements Logger {
  private level: 'debug' | 'info' | 'warn' | 'error';

  constructor(level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.level = level;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

/**
 * Event Consumer Class
 *
 * Main consumer class for RabbitMQ event consumption.
 * Provides connection management, channel setup, queue subscription,
 * and graceful shutdown capabilities.
 */
export class EventConsumer {
  private config: Required<EventSDKConfig>;
  private logger: Logger;

  // Connection and channel
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  // Consumer state
  private consumerTags: Map<string, string> = new Map();
  private processor: EventProcessor;
  private isClosing: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  // Status and stats
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private connectedAt?: Date;
  private startTime: number = Date.now();

  // Event handlers
  private handlers: Map<string, EventHandlerRegistration[]> = new Map();

  // Stats
  private stats: ConsumerStats = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    messagesRetried: 0,
    messagesToDLQ: 0,
    duplicatesSkipped: 0,
    validationErrors: 0,
    avgProcessingTime: 0,
    processingRate: 0,
    currentRetryCount: 0,
    uptime: 0,
  };

  private processingTimes: number[] = [];

  constructor(config: EventSDKConfig) {
    this.config = {
      ...DEFAULT_SDK_CONFIG,
      ...config,
      connection: {
        ...DEFAULT_SDK_CONFIG.connection,
        ...config.connection,
      } as ConnectionOptions,
      consumer: {
        ...DEFAULT_SDK_CONFIG.consumer,
        ...config.consumer,
      } as ConsumerConfig,
      shutdownTimeout:
        config.shutdownTimeout ?? DEFAULT_SDK_CONFIG.shutdownTimeout!,
      enableGracefulShutdown:
        config.enableGracefulShutdown ??
        DEFAULT_SDK_CONFIG.enableGracefulShutdown!,
      logLevel: config.logLevel ?? DEFAULT_SDK_CONFIG.logLevel!,
      enableMetrics: config.enableMetrics ?? DEFAULT_SDK_CONFIG.enableMetrics!,
    } as Required<EventSDKConfig>;

    // Use provided logger or create default
    this.logger = this.config.logger || new DefaultLogger(this.config.logLevel);

    // Create event processor
    this.processor = new EventProcessor({
      name: this.config.consumer.consumerName,
      middleware: [],
      handlers: [],
      parallelProcessing: false,
      maxParallel: 10,
    });

    // Setup graceful shutdown
    if (this.config.enableGracefulShutdown) {
      this.setupShutdownHandlers();
    }

    this.info('EventConsumer initialized', {
      consumerName: this.config.consumer.consumerName,
      connectionName: this.config.connection.connectionName,
    });
  }

  /**
   * Connect to RabbitMQ
   *
   * @returns Promise that resolves when connected
   */
  public async connect(): Promise<void> {
    if (this.connection && this.connection.connection.serverProperties) {
      this.warn('Already connected');
      return;
    }

    this.status = ConnectionStatus.CONNECTING;
    this.info('Connecting to RabbitMQ', {
      hostname: this.config.connection.hostname,
      port: this.config.connection.port,
      vhost: this.config.connection.vhost,
    });

    try {
      // Build connection URL if not provided
      const url =
        this.config.connection.url ||
        this.buildConnectionUrl();

      // Connect
      this.connection = await connect({
        ...this.config.connection,
        url,
        connectionName: this.config.connection.connectionName,
      });

      // Setup error handlers
      this.setupConnectionHandlers();

      // Create channel
      await this.createChannel();

      // Setup topology
      await this.setupTopology();

      // Update status
      this.status = ConnectionStatus.CONNECTED;
      this.connectedAt = new Date();
      this.reconnectAttempts = 0;

      this.info('Connected to RabbitMQ successfully');
    } catch (error) {
      this.status = ConnectionStatus.DISCONNECTED;
      this.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Create and configure AMQP channel
   */
  private async createChannel(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not established');
    }

    this.channel = await this.connection.createChannel();

    // Set prefetch
    if (this.config.consumer.prefetch) {
      await this.channel.prefetch(this.config.consumer.prefetch);
      this.debug('Channel prefetch set', { count: this.config.consumer.prefetch });
    }

    // Setup channel error handler
    this.channel.on('error', (error) => {
      this.error('Channel error:', error);
    });

    this.debug('Channel created');
  }

  /**
   * Setup RabbitMQ topology (exchanges, queues, bindings)
   */
  private async setupTopology(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not created');
    }

    // Setup default exchange if configured
    if (this.config.exchange) {
      await this.assertExchange(this.config.exchange);
    }

    // Setup default queue if configured
    if (this.config.queue) {
      await this.assertQueue(this.config.queue);
    }

    // Setup bindings if configured
    if (this.config.bindings) {
      for (const binding of this.config.bindings) {
        await this.bindQueue(binding);
      }
    }

    this.debug('Topology setup complete');
  }

  /**
   * Assert an exchange exists
   *
   * @param exchangeConfig - Exchange configuration
   */
  public async assertExchange(exchangeConfig: ExchangeConfig): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not created');
    }

    await this.channel.assertExchange(
      exchangeConfig.name,
      exchangeConfig.type,
      {
        durable: exchangeConfig.durable ?? true,
        autoDelete: exchangeConfig.autoDelete ?? false,
        arguments: exchangeConfig.arguments,
      }
    );

    this.debug('Exchange asserted', { name: exchangeConfig.name, type: exchangeConfig.type });
  }

  /**
   * Assert a queue exists
   *
   * @param queueConfig - Queue configuration
   * @returns Queue info
   */
  public async assertQueue(queueConfig: QueueConfig): Promise<Replies.AssertQueue> {
    if (!this.channel) {
      throw new Error('Channel not created');
    }

    // Build queue arguments
    const arguments_: Record<string, unknown> = {
      ...queueConfig.arguments,
    };

    // Add dead letter exchange if configured
    if (queueConfig.deadLetter) {
      arguments_['x-dead-letter-exchange'] = queueConfig.deadLetter.exchange;
      if (queueConfig.deadLetter.routingKey) {
        arguments_['x-dead-letter-routing-key'] = queueConfig.deadLetter.routingKey;
      }
      if (queueConfig.deadLetter.messageTTL) {
        arguments_['x-message-ttl'] = queueConfig.deadLetter.messageTTL;
      }
    }

    // Add message TTL if configured
    if (queueConfig.messageTTL) {
      arguments_['x-message-ttl'] = queueConfig.messageTTL;
    }

    // Add max length if configured
    if (queueConfig.maxLength) {
      arguments_['x-max-length'] = queueConfig.maxLength;
    }

    const result = await this.channel.assertQueue(queueConfig.name, {
      durable: queueConfig.durable ?? true,
      exclusive: queueConfig.exclusive ?? false,
      autoDelete: queueConfig.autoDelete ?? false,
      arguments: arguments_,
    });

    this.debug('Queue asserted', { name: queueConfig.name });

    return result;
  }

  /**
   * Bind a queue to an exchange
   *
   * @param bindingConfig - Binding configuration
   */
  public async bindQueue(bindingConfig: BindingConfig): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not created');
    }

    await this.channel.bindQueue(
      bindingConfig.queue,
      bindingConfig.exchange,
      bindingConfig.routingKey,
      bindingConfig.arguments
    );

    this.debug('Queue bound', {
      queue: bindingConfig.queue,
      exchange: bindingConfig.exchange,
      routingKey: bindingConfig.routingKey,
    });
  }

  /**
   * Subscribe to a queue
   *
   * @param options - Subscription options
   * @returns Consumer tag
   */
  public async subscribe(options: SubscriptionOptions): Promise<string> {
    if (!this.channel) {
      throw new Error('Channel not created');
    }

    // Ensure queue exists
    await this.assertQueue({ name: options.queue, durable: true });

    // Consume from queue
    const consumerTag = await this.channel.consume(
      options.queue,
      async (message) => {
        if (!message) {
          return;
        }

        await this.handleMessage(message, options.queue);
      },
      {
        consumerTag: options.consumerTag,
        noAck: this.config.consumer.noAck,
        exclusive: options.exclusive,
        arguments: options.arguments,
        priority: this.config.consumer.priority,
      }
    );

    this.consumerTags.set(consumerTag!, options.queue);

    this.info('Subscribed to queue', {
      queue: options.queue,
      consumerTag,
    });

    return consumerTag!;
  }

  /**
   * Handle an incoming message
   *
   * @param message - RabbitMQ message
   * @param queue - Queue name
   */
  private async handleMessage(message: Message, queue: string): Promise<void> {
    const startTime = Date.now();
    this.stats.messagesReceived++;

    try {
      // Deserialize message
      const envelope: EventEnvelope = JSON.parse(message.content.toString());

      // Update stats
      this.stats.lastActivityAt = new Date();

      // Process through processor
      const result = await this.processor.process(message, envelope, this.channel!);

      // Update stats based on result
      if (result.success) {
        this.stats.messagesProcessed++;
        const processingTime = result.duration;
        this.processingTimes.push(processingTime);

        // Keep only last 1000 times
        if (this.processingTimes.length > 1000) {
          this.processingTimes.shift();
        }

        this.updateAvgProcessingTime();
      } else {
        this.stats.messagesFailed++;

        if (result.error?.type === 'duplicate_event') {
          this.stats.duplicatesSkipped++;
        } else if (result.error?.type === 'schema_validation_error' ||
                   result.error?.type === 'validation_error') {
          this.stats.validationErrors++;
        }

        if (result.retryCount > 0) {
          this.stats.messagesRetried++;
        }
      }

      // Update uptime
      this.stats.uptime = Date.now() - this.startTime;
      this.stats.currentRetryCount = result.retryCount;

      this.debug('Message processed', {
        eventId: envelope.event_id,
        eventType: envelope.event_type,
        success: result.success,
        duration: result.duration,
      });
    } catch (error) {
      this.error('Error handling message:', error);
      this.stats.messagesFailed++;

      // Negative acknowledge if configured
      if (this.config.consumer.noAck === false) {
        this.channel?.nack(message, false, false);
      }
    }
  }

  /**
   * Update average processing time
   */
  private updateAvgProcessingTime(): void {
    if (this.processingTimes.length === 0) {
      this.stats.avgProcessingTime = 0;
      return;
    }

    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    this.stats.avgProcessingTime = sum / this.processingTimes.length;
    this.stats.processingRate = this.stats.messagesProcessed / (this.stats.uptime / 1000);
  }

  /**
   * Unsubscribe from a queue
   *
   * @param consumerTag - Consumer tag to cancel
   */
  public async unsubscribe(consumerTag: string): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not created');
    }

    await this.channel.cancel(consumerTag);
    this.consumerTags.delete(consumerTag);

    this.info('Unsubscribed from queue', { consumerTag });
  }

  /**
   * Register an event handler
   *
   * @param handler - Event handler registration
   */
  public registerHandler(handler: EventHandlerRegistration): void {
    this.handlers.set(handler.eventType, []);
    this.processor.registerHandler(handler);
    this.info('Event handler registered', {
      eventType: handler.eventType,
      consumer: handler.consumerName,
    });
  }

  /**
   * Register multiple event handlers
   *
   * @param handlers - Array of handler registrations
   */
  public registerHandlers(handlers: EventHandlerRegistration[]): void {
    for (const handler of handlers) {
      this.registerHandler(handler);
    }
  }

  /**
   * Get the event processor
   *
   * @returns EventProcessor instance
   */
  public getProcessor(): EventProcessor {
    return this.processor;
  }

  /**
   * Get consumer statistics
   *
   * @returns Consumer statistics
   */
  public getStats(): ConsumerStats {
    // Update uptime
    this.stats.uptime = Date.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * Get connection state
   *
   * @returns Connection state
   */
  public getConnectionState(): ConnectionState {
    return {
      status: this.status,
      connectedAt: this.connectedAt,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Check if connected
   *
   * @returns True if connected
   */
  public isConnected(): boolean {
    return this.status === ConnectionStatus.CONNECTED;
  }

  /**
   * Reconnect to RabbitMQ
   *
   * @returns Promise that resolves when reconnected
   */
  public async reconnect(): Promise<void> {
    this.status = ConnectionStatus.RECONNECTING;
    this.info('Reconnecting to RabbitMQ...');

    try {
      await this.disconnect();
      await this.connect();

      // Resubscribe to queues
      for (const [consumerTag, queue] of this.consumerTags.entries()) {
        await this.subscribe({ queue, consumerTag });
      }

      this.info('Reconnected successfully');
    } catch (error) {
      this.reconnectAttempts++;
      this.error('Reconnection failed:', error);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.error('Max reconnection attempts reached');
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.reconnect();
    }
  }

  /**
   * Disconnect from RabbitMQ
   *
   * @returns Promise that resolves when disconnected
   */
  public async disconnect(): Promise<void> {
    this.status = ConnectionStatus.CLOSING;
    this.info('Disconnecting from RabbitMQ...');

    try {
      // Cancel all consumers
      for (const consumerTag of this.consumerTags.keys()) {
        try {
          await this.unsubscribe(consumerTag);
        } catch (error) {
          this.warn('Error canceling consumer:', error);
        }
      }

      // Close channel
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      // Close connection
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.status = ConnectionStatus.CLOSED;
      this.info('Disconnected from RabbitMQ');
    } catch (error) {
      this.error('Error disconnecting:', error);
      this.status = ConnectionStatus.CLOSED;
      throw error;
    }
  }

  /**
   * Graceful shutdown
   *
   * @returns Promise that resolves when shutdown is complete
   */
  public async shutdown(): Promise<void> {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;
    this.info('Starting graceful shutdown...');

    try {
      // Stop accepting new messages
      if (this.channel) {
        await this.channel.prefetch(0);
      }

      // Wait for in-flight messages to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Disconnect
      await this.disconnect();

      this.info('Graceful shutdown complete');
    } catch (error) {
      this.error('Error during shutdown:', error);
      throw error;
    } finally {
      this.isClosing = false;
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.connection) {
      return;
    }

    this.connection.on('error', async (error) => {
      this.error('Connection error:', error);
      this.status = ConnectionStatus.DISCONNECTED;

      // Attempt to reconnect
      if (!this.isClosing) {
        await this.reconnect();
      }
    });

    this.connection.on('close', async () => {
      this.info('Connection closed');
      this.status = ConnectionStatus.DISCONNECTED;

      // Attempt to reconnect
      if (!this.isClosing) {
        await this.reconnect();
      }
    });

    this.connection.on('blocked', (reason) => {
      this.warn('Connection blocked:', reason);
    });

    this.connection.on('unblocked', () => {
      this.info('Connection unblocked');
    });
  }

  /**
   * Setup shutdown handlers for graceful exit
   */
  private setupShutdownHandlers(): void {
    const shutdownHandler = async (signal: string): Promise<void> => {
      this.info(`Received ${signal}, initiating graceful shutdown...`);

      try {
        await Promise.race([
          this.shutdown(),
          new Promise<void>((resolve, reject) =>
            setTimeout(() => reject(new Error('Shutdown timeout')), this.config.shutdownTimeout)
          ),
        ]);
        process.exit(0);
      } catch (error) {
        this.error('Shutdown error:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
  }

  /**
   * Build connection URL from configuration
   *
   * @returns Connection URL
   */
  private buildConnectionUrl(): string {
    const { hostname, port, username, password, vhost } = this.config.connection;

    const encodedPassword = password.replace(/@/g, '%40').replace(/:/g, '%3A');
    const encodedVhost = vhost.replace(/\//g, '%2F');

    return `amqp://${username}:${encodedPassword}@${hostname}:${port}${encodedVhost}`;
  }

  private debug(message: string, ...args: unknown[]): void {
    this.logger.debug(`[EventConsumer] ${message}`, ...args);
  }

  private info(message: string, ...args: unknown[]): void {
    this.logger.info(`[EventConsumer] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]): void {
    this.logger.warn(`[EventConsumer] ${message}`, ...args);
  }

  private error(message: string, ...args: unknown[]): void {
    this.logger.error(`[EventConsumer] ${message}`, ...args);
  }
}

/**
 * Create an event consumer with default configuration
 *
 * @param config - SDK configuration
 * @returns EventConsumer instance
 */
export function createEventConsumer(config: EventSDKConfig): EventConsumer {
  return new EventConsumer(config);
}
