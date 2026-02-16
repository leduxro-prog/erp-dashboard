/**
 * @file Event SDK Main Entry Point
 * @module event-sdk
 * @description Enterprise-grade event consumer SDK with middleware pipeline,
 * schema validation, idempotency, and reliable message handling
 *
 * @example
 * ```typescript
 * import { createEventConsumer } from '@cypher/event-sdk';
 *
 * const consumer = createEventConsumer({
 *   connection: {
 *     hostname: 'localhost',
 *     port: 5672,
 *     username: 'guest',
 *     password: 'guest',
 *   },
 *   consumer: {
 *     consumerName: 'order-processor',
 *     prefetch: 10,
 *   },
 *   queue: {
 *     name: 'orders',
 *     durable: true,
 *   },
 * });
 *
 * await consumer.connect();
 * await consumer.subscribe({ queue: 'orders' });
 * ```
 */

// Main classes
export { EventConsumer, createEventConsumer } from './EventConsumer';
export { EventProcessor, createEventProcessor } from './EventProcessor';

// Middleware
export {
  DeserializerMiddleware,
  createDeserializer,
  deserializeMessage,
  DeserializationError,
  MessageSizeError,
} from './middleware/Deserializer';

export {
  SchemaValidatorMiddleware,
  createSchemaValidator,
  validateEvent,
  SchemaValidationError,
  ValidationResult,
  ValidationError,
} from './middleware/SchemaValidator';

export {
  IdempotencyMiddleware,
  createIdempotency,
  DuplicateEventError,
  ProcessedEventRecord,
  IdempotencyCheckResult,
} from './middleware/Idempotency';

export {
  AckHandlerMiddleware,
  createAckHandler,
  acknowledgeMessage,
  rejectMessage,
  AcknowledgmentError,
  AckStrategy,
  DLQOptions,
} from './middleware/AckHandler';

export {
  ErrorHandlerMiddleware,
  createErrorHandler,
  classifyError,
  getBuiltInClassifiers,
  ErrorClassificationError,
} from './middleware/ErrorHandler';

export {
  CorrelationHandlerMiddleware,
  createCorrelationHandler,
  generateCorrelationId,
  generateTraceId,
  extractCorrelationId,
  extractTraceId,
  CorrelationContext,
  DEFAULT_HEADERS,
} from './middleware/CorrelationHandler';

// Utilities
export {
  RetryPolicy,
  calculateRetryDelay,
  isRetryable,
  DEFAULT_RETRY_CONFIG,
} from './utils/RetryPolicy';

// Types
export * from './types';

// Re-export from @cypher/events for convenience
export {
  EventEnvelope,
  EventEnvelopeFactory,
  EventEnvelopeUtils,
  EventPriority,
  EventMetadata,
  EventEnvelopeOptions,
  ValidationResult as EventValidationResult,
  isEventEnvelope,
  isEventPriority,
} from '@cypher/events';

export {
  SchemaRegistry,
  createSchemaRegistry,
  getSchemaRegistry,
} from '@cypher/events';

// Version
export const VERSION = '1.0.0';
