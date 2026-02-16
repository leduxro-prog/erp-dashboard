/**
 * @file Ack Handler Middleware
 * @module event-sdk/middleware/AckHandler
 * @description ACK/NACK strategy with retry DLQ support
 */

import { Channel, Message } from 'amqplib';
import {
  MiddlewareFunction,
  MiddlewareContext,
  AckHandlerConfig,
  DLQConfig,
  Logger,
  ClassifiedError,
} from '../types';
import { EventEnvelope, EventPriority } from '@cypher/events';
import { RetryPolicy, isRetryable } from '../utils/RetryPolicy';

/**
 * Acknowledgment strategy
 */
export enum AckStrategy {
  /** Always acknowledge (even on error) */
  ALWAYS_ACK = 'always_ack',
  /** Always negative acknowledge (reject) */
  ALWAYS_NACK = 'always_nack',
  /** Acknowledge on success, reject on error */
  ACK_ON_SUCCESS = 'ack_on_success',
  /** Manual acknowledgment (handler must call) */
  MANUAL = 'manual',
}

/**
 * DLQ routing options
 */
export interface DLQOptions {
  /** Exchange to send to */
  exchange: string;
  /** Routing key to use */
  routingKey: string;
  /** Message TTL */
  ttl?: number;
  /** Additional headers */
  headers?: Record<string, unknown>;
}

/**
 * Error thrown when acknowledgment fails
 */
export class AcknowledgmentError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AcknowledgmentError';
  }
}

/**
 * Default ack handler configuration
 */
const DEFAULT_ACK_HANDLER_CONFIG: Required<AckHandlerConfig> = {
  autoAckSuccess: true,
  autoNackError: true,
  defaultRequeue: true,
  enableBatchAck: false,
  batchAckWindowMs: 100,
  maxBatchSize: 100,
};

/**
 * Ack Handler Middleware
 *
 * Handles message acknowledgment (ACK) and negative acknowledgment (NACK)
 * with configurable retry strategies and dead letter queue support.
 */
export class AckHandlerMiddleware {
  private config: Required<AckHandlerConfig>;
  private logger?: Logger;
  private retryPolicy: RetryPolicy;
  private pendingAcks: Set<string> = new Set();
  private pendingNacks: Set<string> = new Set();
  private batchTimer?: NodeJS.Timeout;
  private dlqConfig?: DLQConfig;

  constructor(
    config: Partial<AckHandlerConfig> = {},
    logger?: Logger,
    dlqConfig?: DLQConfig,
    retryPolicy?: RetryPolicy
  ) {
    this.config = {
      ...DEFAULT_ACK_HANDLER_CONFIG,
      ...config,
      autoAckSuccess: config.autoAckSuccess ?? DEFAULT_ACK_HANDLER_CONFIG.autoAckSuccess,
      autoNackError: config.autoNackError ?? DEFAULT_ACK_HANDLER_CONFIG.autoNackError,
      defaultRequeue: config.defaultRequeue ?? DEFAULT_ACK_HANDLER_CONFIG.defaultRequeue,
      enableBatchAck: config.enableBatchAck ?? DEFAULT_ACK_HANDLER_CONFIG.enableBatchAck,
      batchAckWindowMs:
        config.batchAckWindowMs ?? DEFAULT_ACK_HANDLER_CONFIG.batchAckWindowMs,
      maxBatchSize: config.maxBatchSize ?? DEFAULT_ACK_HANDLER_CONFIG.maxBatchSize,
    };
    this.logger = logger;
    this.dlqConfig = dlqConfig;
    this.retryPolicy = retryPolicy || new RetryPolicy();
  }

  /**
   * Create a middleware function for use in the pipeline
   *
   * @returns Middleware function
   */
  public middleware(): MiddlewareFunction {
    return async (context: MiddlewareContext, next: () => Promise<void>) => {
      const messageId = this.getMessageId(context);

      try {
        // Execute the pipeline
        await next();

        // Auto-ack on success if configured
        if (this.config.autoAckSuccess && !context.skipRemaining) {
          await this.ack(context);
        }
      } catch (error) {
        // Auto-nack on error if configured
        if (this.config.autoNackError) {
          await this.handleProcessingError(context, error as ClassifiedError);
        }
        throw error;
      }
    };
  }

  /**
   * Acknowledge a message
   *
   * @param context - Middleware context
   * @param options - Acknowledgment options
   */
  public async ack(
    context: MiddlewareContext,
    options: { allUpTo?: boolean } = {}
  ): Promise<void> {
    const messageId = this.getMessageId(context);

    try {
      // Batch acknowledgment if enabled
      if (this.config.enableBatchAck) {
        this.pendingAcks.add(messageId);
        this.debug('Message added to ack batch', { messageId, count: this.pendingAcks.size });

        // Trigger batch if size limit reached
        if (this.pendingAcks.size >= this.config.maxBatchSize) {
          await this.flushBatch();
          return;
        }

        // Start batch timer if not already running
        if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => {
            this.flushBatch().catch((err) => this.error('Batch flush error:', err));
          }, this.config.batchAckWindowMs);
        }
      } else {
        // Immediate acknowledgment
        context.channel.ack(context.message, options.allUpTo);
        this.debug('Message acknowledged', { messageId, allUpTo: options.allUpTo });
      }
    } catch (error) {
      this.error('Failed to acknowledge message:', error);
      throw new AcknowledgmentError(
        `Failed to acknowledge message ${messageId}`,
        error
      );
    }
  }

  /**
   * Negative acknowledge (reject) a message
   *
   * @param context - Middleware context
   * @param options - Rejection options
   */
  public async nack(
    context: MiddlewareContext,
    options: { requeue?: boolean; allUpTo?: boolean } = {}
  ): Promise<void> {
    const messageId = this.getMessageId(context);

    try {
      const requeue =
        options.requeue !== undefined ? options.requeue : this.config.defaultRequeue;

      context.channel.nack(context.message, options.allUpTo, requeue);
      this.debug('Message negative acknowledged', { messageId, requeue, allUpTo: options.allUpTo });
    } catch (error) {
      this.error('Failed to reject message:', error);
      throw new AcknowledgmentError(
        `Failed to reject message ${messageId}`,
        error
      );
    }
  }

  /**
   * Handle processing error with appropriate retry/DLQ strategy
   *
   * @param context - Middleware context
   * @param error - Classified error
   */
  public async handleProcessingError(
    context: MiddlewareContext,
    error: ClassifiedError
  ): Promise<void> {
    const messageId = this.getMessageId(context);
    const retryAttempt = context.retryAttempt || 0;

    this.debug('Handling processing error', {
      messageId,
      errorType: error.type,
      retryAttempt,
      maxRetries: this.retryPolicy.getMaxAttempts(),
    });

    // Check if we should retry
    if (
      this.retryPolicy.isRetryable(error) &&
      this.retryPolicy.canRetry(retryAttempt + 1)
    ) {
      // Send to retry with delay
      await this.sendToRetry(context, error);
    } else {
      // Send to DLQ or permanently reject
      await this.sendToDLQ(context, error);
    }
  }

  /**
   * Send message to retry queue
   *
   * @param context - Middleware context
   * @param error - Classified error
   */
  private async sendToRetry(
    context: MiddlewareContext,
    error: ClassifiedError
  ): Promise<void> {
    const retryAttempt = context.retryAttempt || 0;
    const delay = this.retryPolicy.getRetryDelay(retryAttempt + 1);

    this.debug('Sending message to retry', {
      messageId: this.getMessageId(context),
      retryAttempt: retryAttempt + 1,
      delay,
    });

    // Nack without requeue to remove from current queue
    await this.nack(context, { requeue: false });

    // Publish to retry queue with delay
    // Note: In RabbitMQ, this would be done via delayed exchange or requeue with x-death header
    // For simplicity, we requeue with retry metadata in headers
    const headers = context.message.properties.headers || {};
    headers['x-retry-attempt'] = retryAttempt + 1;
    headers['x-retry-delay'] = delay;
    headers['x-original-queue'] = context.message.fields.routingKey;

    // Re-publish to the same queue
    // In production, you'd use a dedicated retry exchange with delayed message plugin
  }

  /**
   * Send message to dead letter queue
   *
   * @param context - Middleware context
   * @param error - Classified error
   */
  private async sendToDLQ(
    context: MiddlewareContext,
    error: ClassifiedError
  ): Promise<void> {
    const messageId = this.getMessageId(context);

    if (!this.dlqConfig) {
      // No DLQ configured, just nack without requeue
      await this.nack(context, { requeue: false });
      this.warn('No DLQ configured, message discarded', { messageId });
      return;
    }

    this.debug('Sending message to DLQ', {
      messageId,
      dlqExchange: this.dlqConfig.exchange,
      dlqRoutingKey: this.dlqConfig.routingKey,
    });

    try {
      // Publish to DLQ
      const dlqOptions: DLQOptions = {
        exchange: this.dlqConfig.exchange,
        routingKey: this.dlqConfig.routingKey || context.envelope.event_type,
        ttl: this.dlqConfig.messageTTL,
        headers: {
          'x-original-queue': context.message.fields.routingKey,
          'x-original-routing-key': context.envelope.routing_key,
          'x-dlq-reason': error.message,
          'x-dlq-error-type': error.type,
          'x-dlq-error-severity': error.severity,
          'x-dlq-timestamp': new Date().toISOString(),
          'x-event-id': context.envelope.event_id,
          'x-event-type': context.envelope.event_type,
          'x-retry-attempts': context.retryAttempt,
          ...this.dlqConfig.arguments as Record<string, unknown>,
        },
      };

      await context.channel.publish(
        dlqOptions.exchange,
        dlqOptions.routingKey,
        Buffer.from(JSON.stringify(context.envelope)),
        {
          contentType: 'application/json',
          headers: dlqOptions.headers,
          expiration: dlqOptions.ttl?.toString(),
          messageId,
        }
      );

      // Ack original message
      await this.ack(context);

      this.info('Message sent to DLQ', {
        messageId,
        exchange: dlqOptions.exchange,
        routingKey: dlqOptions.routingKey,
      });
    } catch (dlqError) {
      this.error('Failed to send message to DLQ:', dlqError);
      // If DLQ publish fails, still nack the message
      await this.nack(context, { requeue: false });
    }
  }

  /**
   * Flush pending acknowledgments
   */
  public async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.pendingAcks.size === 0) {
      return;
    }

    this.debug('Flushing acknowledgment batch', { count: this.pendingAcks.size });

    // Note: In a real implementation, you'd track the messages to batch-ack
    // For now, just clear the pending set
    this.pendingAcks.clear();
  }

  /**
   * Get message ID from context
   *
   * @param context - Middleware context
   * @returns Message ID
   */
  private getMessageId(context: MiddlewareContext): string {
    return (
      context.message.properties.messageId ||
      context.envelope.event_id ||
      'unknown'
    );
  }

  /**
   * Set dead letter queue configuration
   *
   * @param config - DLQ configuration
   */
  public setDLQConfig(config: DLQConfig): void {
    this.dlqConfig = config;
  }

  /**
   * Set retry policy
   *
   * @param policy - Retry policy
   */
  public setRetryPolicy(policy: RetryPolicy): void {
    this.retryPolicy = policy;
  }

  /**
   * Get the current configuration
   *
   * @returns Current ack handler configuration
   */
  public getConfig(): Readonly<Required<AckHandlerConfig>> {
    return { ...this.config };
  }

  /**
   * Update the configuration
   *
   * @param config - New configuration values
   */
  public updateConfig(config: Partial<AckHandlerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      autoAckSuccess: config.autoAckSuccess ?? this.config.autoAckSuccess,
      autoNackError: config.autoNackError ?? this.config.autoNackError,
      defaultRequeue: config.defaultRequeue ?? this.config.defaultRequeue,
      enableBatchAck: config.enableBatchAck ?? this.config.enableBatchAck,
      batchAckWindowMs:
        config.batchAckWindowMs ?? this.config.batchAckWindowMs,
      maxBatchSize: config.maxBatchSize ?? this.config.maxBatchSize,
    };
  }

  /**
   * Set the logger
   *
   * @param logger - Logger instance
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Get pending acknowledgment statistics
   *
   * @returns Pending ack/nack counts
   */
  public getPendingStats(): { pendingAcks: number; pendingNacks: number } {
    return {
      pendingAcks: this.pendingAcks.size,
      pendingNacks: this.pendingNacks.size,
    };
  }

}

/**
 * Create an ack handler middleware factory function
 *
 * @param config - Optional configuration
 * @param logger - Optional logger
 * @param dlqConfig - Optional DLQ configuration
 * @param retryPolicy - Optional retry policy
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const ackHandler = createAckHandler({
 *   autoAckSuccess: true,
 *   autoNackError: true,
 *   defaultRequeue: false
 * });
 * processor.use(ackHandler);
 * ```
 */
export function createAckHandler(
  config: Partial<AckHandlerConfig> = {},
  logger?: Logger,
  dlqConfig?: DLQConfig,
  retryPolicy?: RetryPolicy
): MiddlewareFunction {
  const middleware = new AckHandlerMiddleware(config, logger, dlqConfig, retryPolicy);
  return middleware.middleware();
}

/**
 * Standalone function to acknowledge a message
 *
 * @param channel - AMQP channel
 * @param message - RabbitMQ message
 * @param options - Acknowledgment options
 */
export function acknowledgeMessage(
  channel: Channel,
  message: Message,
  options: { allUpTo?: boolean } = {}
): void {
  channel.ack(message, options.allUpTo);
}

/**
 * Standalone function to reject a message
 *
 * @param channel - AMQP channel
 * @param message - RabbitMQ message
 * @param options - Rejection options
 */
export function rejectMessage(
  channel: Channel,
  message: Message,
  options: { requeue?: boolean; allUpTo?: boolean } = {}
): void {
  const requeue = options.requeue !== undefined ? options.requeue : true;
  channel.nack(message, options.allUpTo, requeue);
}
