/**
 * @file Deserializer Middleware
 * @module event-sdk/middleware/Deserializer
 * @description Message deserialization middleware for the event consumer pipeline
 */

import { MiddlewareFunction, MiddlewareContext, DeserializerConfig, Logger } from '../types';
import { EventEnvelope } from '@cypher/events';

/**
 * Default deserializer configuration
 */
const DEFAULT_DESERIALIZER_CONFIG: Required<DeserializerConfig> = {
  enabled: true,
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  expectedContentType: 'application/json',
  enforceContentType: true,
};

/**
 * Error thrown when deserialization fails
 */
export class DeserializationError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'DeserializationError';
  }
}

/**
 * Error thrown when message size exceeds limit
 */
export class MessageSizeError extends Error {
  constructor(message: string, public readonly actualSize: number, public readonly maxSize: number) {
    super(message);
    this.name = 'MessageSizeError';
  }
}

/**
 * Deserializer Middleware
 *
 * Deserializes RabbitMQ messages into EventEnvelope objects.
 * Handles content-type validation, size limits, and JSON parsing.
 */
export class DeserializerMiddleware {
  private config: Required<DeserializerConfig>;
  private logger?: Logger;

  constructor(config: Partial<DeserializerConfig> = {}, logger?: Logger) {
    this.config = {
      ...DEFAULT_DESERIALIZER_CONFIG,
      ...config,
      maxSizeBytes: config.maxSizeBytes ?? DEFAULT_DESERIALIZER_CONFIG.maxSizeBytes,
      expectedContentType:
        config.expectedContentType ?? DEFAULT_DESERIALIZER_CONFIG.expectedContentType,
      enforceContentType:
        config.enforceContentType ?? DEFAULT_DESERIALIZER_CONFIG.enforceContentType,
    };
    this.logger = logger;
  }

  /**
   * Create a middleware function for use in the pipeline
   *
   * @returns Middleware function
   */
  public middleware(): MiddlewareFunction {
    return async (context: MiddlewareContext, next: () => Promise<void>) => {
      // Skip if disabled
      if (!this.config.enabled) {
        this.debug('Deserialization disabled, skipping');
        await next();
        return;
      }

      // Check message size
      this.validateMessageSize(context.message);

      // Validate content type
      this.validateContentType(context.message);

      // Deserialize message content
      const envelope = this.deserialize(context.message);

      // Store in context
      context.envelope = envelope;

      this.debug('Message deserialized successfully', {
        eventId: envelope.event_id,
        eventType: envelope.event_type,
      });

      await next();
    };
  }

  /**
   * Validate message size against configured limit
   *
   * @param message - RabbitMQ message
   * @throws MessageSizeError if size exceeds limit
   */
  private validateMessageSize(message: { content?: Buffer }): void {
    const content = message.content;

    if (!content) {
      throw new DeserializationError('Message content is empty');
    }

    const size = Buffer.byteLength(content);

    if (size > this.config.maxSizeBytes) {
      throw new MessageSizeError(
        `Message size ${size} bytes exceeds maximum allowed size of ${this.config.maxSizeBytes} bytes`,
        size,
        this.config.maxSizeBytes
      );
    }
  }

  /**
   * Validate message content type
   *
   * @param message - RabbitMQ message
   * @throws DeserializationError if content type doesn't match expected
   */
  private validateContentType(message: { properties?: { contentType?: string } }): void {
    if (!this.config.enforceContentType) {
      return;
    }

    const contentType = message.properties?.contentType;

    if (!contentType) {
      this.warn('Message has no content-type header');
      return;
    }

    // Allow for charset suffix (e.g., "application/json; charset=utf-8")
    const baseContentType = contentType.split(';')[0].trim();

    if (baseContentType !== this.config.expectedContentType) {
      throw new DeserializationError(
        `Unsupported content-type: ${contentType}. Expected: ${this.config.expectedContentType}`
      );
    }
  }

  /**
   * Deserialize message content to EventEnvelope
   *
   * @param message - RabbitMQ message
   * @returns Deserialized EventEnvelope
   * @throws DeserializationError if deserialization fails
   */
  private deserialize(message: { content?: Buffer }): EventEnvelope {
    try {
      const content = message.content;

      if (!content) {
        throw new DeserializationError('Message content is empty');
      }

      // Parse JSON
      const jsonString = content.toString('utf8');
      const parsed = JSON.parse(jsonString);

      // Validate basic structure
      if (typeof parsed !== 'object' || parsed === null) {
        throw new DeserializationError('Deserialized content is not an object');
      }

      if (!parsed.event_id || !parsed.event_type || !parsed.payload) {
        throw new DeserializationError(
          'Message is missing required event envelope fields (event_id, event_type, payload)'
        );
      }

      return parsed as EventEnvelope;
    } catch (error) {
      if (error instanceof DeserializationError) {
        throw error;
      }

      throw new DeserializationError(
        `Failed to deserialize message: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Get the current configuration
   *
   * @returns Current deserializer configuration
   */
  public getConfig(): Readonly<Required<DeserializerConfig>> {
    return { ...this.config };
  }

  /**
   * Update the configuration
   *
   * @param config - New configuration values
   */
  public updateConfig(config: Partial<DeserializerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      maxSizeBytes: config.maxSizeBytes ?? this.config.maxSizeBytes,
      expectedContentType:
        config.expectedContentType ?? this.config.expectedContentType,
      enforceContentType:
        config.enforceContentType ?? this.config.enforceContentType,
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

  private debug(message: string, ...args: unknown[]): void {
    this.logger?.debug(`[Deserializer] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]): void {
    this.logger?.warn(`[Deserializer] ${message}`, ...args);
  }

  private error(message: string, ...args: unknown[]): void {
    this.logger?.error(`[Deserializer] ${message}`, ...args);
  }

}

/**
 * Create a deserializer middleware factory function
 *
 * @param config - Optional configuration
 * @param logger - Optional logger
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const deserializer = createDeserializer({ maxSizeBytes: 5 * 1024 * 1024 });
 * processor.use(deserializer);
 * ```
 */
export function createDeserializer(
  config: Partial<DeserializerConfig> = {},
  logger?: Logger
): MiddlewareFunction {
  const middleware = new DeserializerMiddleware(config, logger);
  return middleware.middleware();
}

/**
 * Standalone function to deserialize a message
 *
 * @param message - RabbitMQ message
 * @param config - Optional configuration
 * @returns Deserialized EventEnvelope
 */
export function deserializeMessage(
  message: { content?: Buffer; properties?: { contentType?: string } },
  config: Partial<DeserializerConfig> = {}
): EventEnvelope {
  const middleware = new DeserializerMiddleware(config);
  return middleware.deserialize(message);
}
