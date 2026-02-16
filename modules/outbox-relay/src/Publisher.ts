/**
 * RabbitMQ publisher with connection management and enterprise features.
 *
 * Provides connection management with auto-reconnect, publisher confirms,
 * mandatory publish flag, message ordering per correlation_id, tracing,
 * metrics integration, and error handling.
 *
 * @module Publisher
 */

import amqp, {
  ChannelModel,
  Channel,
  ConfirmChannel,
  Options,
  Replies,
  Message,
} from 'amqplib';
import { OutboxLogger } from './logger';
import { OutboxMetrics, CircuitBreakerState } from './Metrics';
import { getConfig, RabbitMQConfig, CircuitBreakerConfig } from './Config';

/**
 * Message publish options
 */
export interface PublishOptions {
  exchange?: string;
  routingKey?: string;
  correlationId?: string;
  messageId?: string;
  timestamp?: number;
  expiration?: string;
  priority?: number;
  contentType?: string;
  contentEncoding?: string;
  headers?: Record<string, unknown>;
  deliveryMode?: 1 | 2;
  mandatory?: boolean;
  persistent?: boolean;
}

/**
 * Publisher confirm result
 */
export interface PublishResult {
  success: boolean;
  error?: Error;
  returned?: boolean;
  returnReply?: {
    fields: Record<string, unknown>;
    properties: Message['properties'];
    content: Buffer;
  };
}

/**
 * Circuit breaker state tracking
 */
interface CircuitBreakerRuntimeState {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

/**
 * RabbitMQ publisher class
 */
export class RabbitMQPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | ConfirmChannel | null = null;
  private readonly logger: OutboxLogger;
  private readonly metrics?: OutboxMetrics;
  private readonly config: RabbitMQConfig;
  private readonly circuitBreakerConfig: CircuitBreakerConfig;

  // Circuit breaker state
  private cbState: CircuitBreakerRuntimeState = {
    state: CircuitBreakerState.Closed,
    failureCount: 0,
    successCount: 0,
  };

  // Connection tracking
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer?: NodeJS.Timeout;

  private confirmChannel: boolean = false;

  /**
   * Creates a new RabbitMQPublisher instance
   *
   * @param config - RabbitMQ configuration
   * @param logger - Logger instance
   * @param metrics - Metrics instance
   */
  constructor(
    config?: RabbitMQConfig,
    logger?: OutboxLogger,
    metrics?: OutboxMetrics
  ) {
    this.config = config || getConfig().rabbitmq;
    this.logger = logger || new OutboxLogger().forComponent('Publisher');
    this.metrics = metrics;

    // Load circuit breaker config
    this.circuitBreakerConfig = getConfig().circuitBreaker;
  }

  /**
   * Initializes the publisher by establishing connection
   *
   * @returns Promise that resolves when initialized
   */
  public async initialize(): Promise<void> {
    if (this.connection && this.channel) {
      return;
    }

    if (this.isConnecting) {
      this.logger.debug('Connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      await this.connect();
      this.logger.info('RabbitMQ publisher initialized', {
        host: this.config.hostname,
        port: this.config.port,
        vhost: this.config.vhost,
      });

      if (this.metrics) {
        this.metrics.setRabbitMQConnectionStatus(true);
      }
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ publisher', error as Error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Establishes connection to RabbitMQ
   *
   * @returns Promise that resolves when connected
   * @private
   */
  private async connect(): Promise<void> {
    const connectionOptions: Options.Connect = {
      protocol: this.config.protocol,
      hostname: this.config.hostname,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      vhost: this.config.vhost,
      frameMax: this.config.frameMax || undefined,
      heartbeat: this.config.heartbeat,
    };

    this.connection = await amqp.connect(connectionOptions);
    const connection = this.connection;

    // Setup connection error handling
    connection.on('error', (error) => {
      this.logger.error('RabbitMQ connection error', error);
      this.handleConnectionError();
    });

    connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.handleConnectionClose();
    });

    // Create channel
    if (this.config.publisherConfirms) {
      this.channel = await connection.createConfirmChannel();
      this.confirmChannel = true;
    } else {
      this.channel = await connection.createChannel();
      this.confirmChannel = false;
    }
    const channel = this.channel;

    // Setup channel error handling
    channel.on('error', (error) => {
      this.logger.error('RabbitMQ channel error', error);
    });

    channel.on('close', () => {
      this.logger.debug('RabbitMQ channel closed');
      this.channel = null;
      this.confirmChannel = false;
    });

    // Set prefetch count
    await channel.prefetch(this.config.prefetchCount);

    // Setup publisher confirms if enabled
    if (this.confirmChannel) {
      await this.setupPublisherConfirms();
    }

    // Setup return listener for undeliverable messages
    if (this.config.mandatory) {
      this.setupReturnListener();
    }

    // Reset reconnection tracking
    this.reconnectAttempts = 0;
  }

  /**
   * Sets up publisher confirms on the channel
   *
   * @returns Promise that resolves when setup is complete
   * @private
   */
  private async setupPublisherConfirms(): Promise<void> {
    if (!this.channel || !isConfirmChannel(this.channel)) {
      throw new Error('Channel not established');
    }

    this.logger.debug('Publisher confirms enabled');
  }

  /**
   * Sets up return listener for undeliverable messages
   *
   * @private
   */
  private setupReturnListener(): void {
    if (!this.channel) {
      return;
    }

    this.channel.on('return', (msg: Message) => {
      const returned = msg as Message & {
        fields: Message['fields'] & { replyCode?: number; replyText?: string };
      };
      const replyText = msg.content.toString();
      this.logger.warn('Message returned by broker', {
        replyCode: returned.fields.replyCode,
        replyText,
        exchange: msg.fields.exchange,
        routingKey: msg.fields.routingKey,
      });

      if (this.metrics) {
        this.metrics.recordPublishError('returned', String(returned.fields.replyCode ?? 'unknown'));
      }
    });
  }

  /**
   * Handles connection errors with circuit breaker logic
   *
   * @private
   */
  private handleConnectionError(): void {
    this.circuitBreakerRecordFailure();

    if (this.metrics) {
      this.metrics.setRabbitMQConnectionStatus(false);
    }

    // Trigger reconnection attempt
    this.scheduleReconnect();
  }

  /**
   * Handles connection close events
   *
   * @private
   */
  private handleConnectionClose(): void {
    this.channel = null;
    this.confirmChannel = false;

    if (this.metrics) {
      this.metrics.setRabbitMQConnectionStatus(false);
    }

    // Schedule reconnection
    this.scheduleReconnect();
  }

  /**
   * Schedules a reconnection attempt
   *
   * @private
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxRetries) {
      this.logger.error('Max reconnection attempts reached, giving up');
      return;
    }

    const delay = this.config.retryDelay * Math.pow(2, this.reconnectAttempts);
    this.logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      this.reconnectAttempts++;

      try {
        await this.connect();
        this.circuitBreakerRecordSuccess();
        this.logger.info('Reconnection successful');
      } catch (error) {
        this.logger.error('Reconnection attempt failed', error as Error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Records a circuit breaker failure
   *
   * @private
   */
  private circuitBreakerRecordFailure(): void {
    const config = this.circuitBreakerConfig;
    if (!config?.enabled) {
      return;
    }

    this.cbState.failureCount++;
    this.cbState.successCount = 0;
    this.cbState.lastFailureTime = Date.now();

    if (
      this.cbState.state === CircuitBreakerState.Closed &&
      this.cbState.failureCount >= config.failureThreshold
    ) {
      this.cbState.state = CircuitBreakerState.Open;
      this.cbState.nextAttemptTime = Date.now() + config.timeoutMs;

      if (this.metrics) {
        this.metrics.recordCircuitBreakerTrip('rabbitmq', 'closed', 'open');
        this.metrics.setCircuitBreakerState('rabbitmq', CircuitBreakerState.Open);
      }

      this.logger.warn('Circuit breaker opened due to failures', {
        failureCount: this.cbState.failureCount,
        threshold: config.failureThreshold,
      });
    }
  }

  /**
   * Records a circuit breaker success
   *
   * @private
   */
  private circuitBreakerRecordSuccess(): void {
    const config = this.circuitBreakerConfig;
    if (!config?.enabled) {
      return;
    }

    if (this.cbState.state === CircuitBreakerState.Open) {
      // Check if timeout has passed
      if (this.cbState.nextAttemptTime && Date.now() >= this.cbState.nextAttemptTime) {
        this.cbState.state = CircuitBreakerState.HalfOpen;
        this.cbState.successCount = 0;

        if (this.metrics) {
          this.metrics.setCircuitBreakerState('rabbitmq', CircuitBreakerState.HalfOpen);
        }

        this.logger.info('Circuit breaker moved to half-open state');
      }
    } else if (this.cbState.state === CircuitBreakerState.HalfOpen) {
      this.cbState.successCount++;

      if (this.cbState.successCount >= config.successThreshold) {
        this.cbState.state = CircuitBreakerState.Closed;
        this.cbState.failureCount = 0;

        if (this.metrics) {
          this.metrics.recordCircuitBreakerTrip('rabbitmq', 'half_open', 'closed');
          this.metrics.setCircuitBreakerState('rabbitmq', CircuitBreakerState.Closed);
        }

        this.logger.info('Circuit breaker closed after successful recovery');
      }
    } else {
      // Reset failure count on success in closed state
      this.cbState.failureCount = Math.max(0, this.cbState.failureCount - 1);
    }
  }

  /**
   * Checks if the circuit breaker allows operations
   *
   * @returns True if operations are allowed
   * @private
   */
  private canProceed(): boolean {
    if (!this.circuitBreakerConfig?.enabled) {
      return true;
    }

    if (this.cbState.state === CircuitBreakerState.Open) {
      if (this.cbState.nextAttemptTime && Date.now() >= this.cbState.nextAttemptTime) {
        return true; // Allow single attempt to check state
      }
      return false;
    }

    return true;
  }

  /**
   * Publishes a message to RabbitMQ
   *
   * @param content - Message content
   * @param options - Publish options
   * @returns Promise resolving to publish result
   */
  public async publish(
    content: Buffer | string,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    // Check circuit breaker
    if (!this.canProceed()) {
      const error = new Error('Circuit breaker is open, rejecting operation');
      this.logger.warn('Publish rejected by circuit breaker');
      if (this.metrics) {
        this.metrics.recordPublishError('circuit_breaker_open', 'OPEN');
      }
      return { success: false, error };
    }

    // Ensure connection exists
    if (!this.channel) {
      await this.initialize();
    }

    if (!this.channel) {
      const error = new Error('Channel not available');
      this.circuitBreakerRecordFailure();
      return { success: false, error };
    }

    // Prepare publish options
    const publishOptions: Options.Publish = {
      contentType: options.contentType || 'application/json',
      contentEncoding: options.contentEncoding || 'utf-8',
      headers: options.headers || {},
      deliveryMode: options.deliveryMode || (options.persistent ? 2 : 1),
      priority: options.priority || undefined,
      correlationId: options.correlationId,
      messageId: options.messageId,
      timestamp: options.timestamp || Math.floor(Date.now() / 1000),
      expiration: options.expiration,
      mandatory: this.config.mandatory,
    };

    const routingKey = options.routingKey || '';
    const exchange = options.exchange || '';
    const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content;

    const startTime = Date.now();

    try {
      let result: PublishResult;

      if (this.confirmChannel) {
        // Use publisher confirms
        result = await this.publishWithConfirm(contentBuffer, exchange, routingKey, publishOptions);
      } else {
        // Publish without confirm (fire and forget)
        this.channel.publish(exchange, routingKey, contentBuffer, publishOptions);
        result = { success: true };
      }

      const duration = Date.now() - startTime;

      if (result.success) {
        this.circuitBreakerRecordSuccess();
        if (this.metrics) {
          this.metrics.recordPublishDuration(duration / 1000, exchange, routingKey);
        }
      } else {
        this.circuitBreakerRecordFailure();
        if (this.metrics) {
          this.metrics.recordPublishError(result.error?.name || 'unknown', result.error?.message);
        }
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.circuitBreakerRecordFailure();

      this.logger.error('Publish failed', error as Error, {
        exchange,
        routingKey,
        duration,
      });

      if (this.metrics) {
        this.metrics.recordPublishError((error as Error).name, (error as Error).message);
        this.metrics.recordPublishDuration(duration / 1000, exchange, routingKey);
      }

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Publishes a message with publisher confirms
   *
   * @param content - Message content
   * @param routingKey - Routing key
   * @param options - Publish options
   * @returns Promise resolving to publish result
   * @private
   */
  private async publishWithConfirm(
    content: Buffer,
    exchange: string,
    routingKey: string,
    options: Options.Publish
  ): Promise<PublishResult> {
    if (!this.channel || !isConfirmChannel(this.channel)) {
      return { success: false, error: new Error('Confirm channel not available') };
    }

    const channel = this.channel;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: new Error('Publish confirm timeout') });
      }, this.config.requestTimeout);

      channel.publish(
        exchange,
        routingKey,
        content,
        options,
        (err: Error | null) => {
          clearTimeout(timeout);
          if (err) {
            resolve({ success: false, error: err });
            return;
          }
          resolve({ success: true });
        }
      );
    });
  }

  /**
   * Publishes a batch of messages
   *
   * @param messages - Array of messages with content and options
   * @returns Promise resolving to results for each message
   */
  public async publishBatch(
    messages: Array<{ content: Buffer | string; options: PublishOptions }>
  ): Promise<PublishResult[]> {
    if (!this.channel) {
      await this.initialize();
    }

    const results: PublishResult[] = [];
    const startTime = Date.now();

    for (const msg of messages) {
      const result = await this.publish(msg.content, msg.options);
      results.push(result);
    }

    // Wait for all confirms if using confirms
    if (this.confirmChannel) {
      try {
        if (this.channel && isConfirmChannel(this.channel)) {
          await this.channel.waitForConfirms();
        }
      } catch (error) {
        this.logger.error('Batch publish confirm failed', error as Error);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.debug('Batch publish completed', {
      count: messages.length,
      duration,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * Declares an exchange
   *
   * @param name - Exchange name
   * @param type - Exchange type
   * @param options - Exchange options
   * @returns Promise that resolves when exchange is declared
   */
  public async declareExchange(
    name: string,
    type: 'direct' | 'topic' | 'headers' | 'fanout',
    options: Options.AssertExchange = {}
  ): Promise<void> {
    if (!this.channel) {
      await this.initialize();
    }

    await this.channel!.assertExchange(name, type, options);
    this.logger.debug('Exchange declared', { name, type });
  }

  /**
   * Declares a queue
   *
   * @param name - Queue name
   * @param options - Queue options
   * @returns Promise resolving to queue info
   */
  public async declareQueue(name: string, options: Options.AssertQueue = {}): Promise<Replies.AssertQueue> {
    if (!this.channel) {
      await this.initialize();
    }

    const result = await this.channel!.assertQueue(name, options);
    this.logger.debug('Queue declared', { name, messageCount: result.messageCount });
    return result;
  }

  /**
   * Binds a queue to an exchange
   *
   * @param queue - Queue name
   * @param exchange - Exchange name
   * @param routingKey - Routing key
   * @param args - Additional binding arguments
   * @returns Promise that resolves when bound
   */
  public async bindQueue(
    queue: string,
    exchange: string,
    routingKey: string,
    args?: Record<string, unknown>
  ): Promise<void> {
    if (!this.channel) {
      await this.initialize();
    }

    await this.channel!.bindQueue(queue, exchange, routingKey, args);
    this.logger.debug('Queue bound to exchange', { queue, exchange, routingKey });
  }

  /**
   * Gets the current channel
   *
   * @returns The current channel or null
   */
  public getChannel(): Channel | null {
    return this.channel;
  }

  /**
   * Gets the current connection
   *
   * @returns The current connection or null
   */
  public getConnection(): ChannelModel['connection'] | null {
    return this.connection?.connection ?? null;
  }

  /**
   * Checks if the publisher is connected
   *
   * @returns True if connected
   */
  public isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Checks if the circuit breaker is open
   *
   * @returns True if circuit breaker is open
   */
  public isCircuitBreakerOpen(): boolean {
    return this.cbState.state === CircuitBreakerState.Open;
  }

  /**
   * Gets the circuit breaker state
   *
   * @returns Circuit breaker state
   */
  public getCircuitBreakerState(): CircuitBreakerState {
    return this.cbState.state;
  }

  /**
   * Resets the circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.cbState = {
      state: CircuitBreakerState.Closed,
      failureCount: 0,
      successCount: 0,
    };

    if (this.metrics) {
      this.metrics.setCircuitBreakerState('rabbitmq', CircuitBreakerState.Closed);
    }

    this.logger.info('Circuit breaker reset');
  }

  /**
   * Pings the RabbitMQ connection
   *
   * @returns Promise resolving to true if successful
   */
  public async ping(): Promise<boolean> {
    try {
      if (!this.channel) {
        await this.initialize();
      }

      // Check connection by checking channel
      return this.connection !== null && this.channel !== null;
    } catch (error) {
      this.logger.error('RabbitMQ ping failed', error as Error);
      return false;
    }
  }

  /**
   * Closes the publisher connection
   *
   * @returns Promise that resolves when closed
   */
  public async close(): Promise<void> {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.confirmChannel = false;

      if (this.metrics) {
        this.metrics.setRabbitMQConnectionStatus(false);
      }

      this.logger.info('RabbitMQ publisher closed');
    } catch (error) {
      this.logger.error('Failed to close RabbitMQ publisher', error as Error);
      throw error;
    }
  }
}

function isConfirmChannel(channel: Channel | ConfirmChannel): channel is ConfirmChannel {
  return typeof (channel as ConfirmChannel).waitForConfirms === 'function';
}

/**
 * Default publisher instance
 */
let defaultPublisher: RabbitMQPublisher | null = null;

/**
 * Gets the default publisher instance
 *
 * @param config - RabbitMQ configuration
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @returns Publisher instance
 */
export function getPublisher(
  config?: RabbitMQConfig,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics
): RabbitMQPublisher {
  if (!defaultPublisher) {
    defaultPublisher = new RabbitMQPublisher(config, logger, metrics);
  }
  return defaultPublisher;
}

/**
 * Creates a new publisher instance
 *
 * @param config - RabbitMQ configuration
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @returns New publisher instance
 */
export function createPublisher(
  config?: RabbitMQConfig,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics
): RabbitMQPublisher {
  return new RabbitMQPublisher(config, logger, metrics);
}

export default RabbitMQPublisher;
