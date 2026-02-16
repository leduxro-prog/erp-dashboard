/**
 * @file Event SDK Types
 * @module event-sdk/types
 * @description Complete TypeScript type definitions for the event consumer SDK
 */

import { Channel, Message, Connection } from 'amqplib';
import { EventEnvelope } from '@cypher/events';

/**
 * Message acknowledgment options
 */
export interface AckOptions {
  /** Whether to acknowledge all messages up to this one */
  allUpTo?: boolean;
  /** Requeue message on rejection */
  requeue?: boolean;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low severity - can be logged and continue */
  LOW = 'low',
  /** Medium severity - may need retry */
  MEDIUM = 'medium',
  /** High severity - requires attention */
  HIGH = 'high',
  /** Critical severity - system impact */
  CRITICAL = 'critical',
}

/**
 * Error classification types
 */
export enum ErrorType {
  /** Invalid message format or structure */
  VALIDATION_ERROR = 'validation_error',
  /** Schema validation failed */
  SCHEMA_VALIDATION_ERROR = 'schema_validation_error',
  /** Duplicate event (already processed) */
  DUPLICATE_EVENT = 'duplicate_event',
  /** Transient error - retry may succeed */
  TRANSIENT_ERROR = 'transient_error',
  /** Business logic error */
  BUSINESS_ERROR = 'business_error',
  /** External service error */
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  /** Database error */
  DATABASE_ERROR = 'database_error',
  /** Timeout occurred */
  TIMEOUT_ERROR = 'timeout_error',
  /** Configuration error */
  CONFIGURATION_ERROR = 'configuration_error',
  /** Unknown error type */
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Classified error object
 */
export interface ClassifiedError extends Error {
  /** Error type classification */
  type: ErrorType;
  /** Error severity */
  severity: ErrorSeverity;
  /** Whether error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryDelay?: number;
  /** Original error */
  originalError?: unknown;
  /** Additional error context */
  context?: Record<string, unknown>;
}

/**
 * Middleware context passed through the pipeline
 */
export interface MiddlewareContext<TPayload = any> {
  /** Raw RabbitMQ message */
  message: Message;
  /** AMQP channel */
  channel: Channel;
  /** Deserialized event envelope */
  envelope: EventEnvelope<TPayload>;
  /** Correlation ID for tracing */
  correlationId: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Processing start time */
  startTime: number;
  /** Current retry attempt */
  retryAttempt: number;
  /** Whether to skip remaining middleware */
  skipRemaining?: boolean;
  /** Whether to reject (NACK) instead of acknowledge (ACK) */
  shouldReject?: boolean;
  /** Rejection options */
  rejectOptions?: AckOptions;
  /** Error that occurred during processing */
  error?: ClassifiedError;
  /** Custom metadata for middleware */
  metadata: Map<string, unknown>;
  /** Whether idempotency check was skipped */
  idempotencySkipped?: boolean;
}

/**
 * Middleware function signature
 */
export type MiddlewareFunction<TPayload = any> = (
  context: MiddlewareContext<TPayload>,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Middleware configuration options
 */
export interface MiddlewareConfig {
  /** Whether this middleware is enabled */
  enabled: boolean;
  /** Custom name for the middleware */
  name?: string;
  /** Whether to stop pipeline on error */
  stopOnError?: boolean;
}

/**
 * Event handler function signature
 */
export type EventHandler<TPayload = any> = (
  context: MiddlewareContext<TPayload>
) => Promise<void>;

/**
 * Event handler registration
 */
export interface EventHandlerRegistration<TPayload = any> {
  /** Event type to handle */
  eventType: string;
  /** Event version (optional, defaults to latest) */
  eventVersion?: string;
  /** Handler function */
  handler: EventHandler<TPayload>;
  /** Consumer name for idempotency */
  consumerName: string;
  /** Consumer group (optional) */
  consumerGroup?: string;
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Middleware specific to this handler */
  middleware?: MiddlewareFunction<TPayload>[];
  /** Whether to enable idempotency check */
  enableIdempotency?: boolean;
}

/**
 * Retry policy types
 */
export enum RetryPolicyType {
  /** No retry - fail immediately */
  NONE = 'none',
  /** Fixed delay between retries */
  FIXED = 'fixed',
  /** Exponential backoff */
  EXPONENTIAL = 'exponential',
  /** Exponential backoff with jitter */
  EXPONENTIAL_WITH_JITTER = 'exponential_with_jitter',
  /** Linear backoff */
  LINEAR = 'linear',
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Retry policy type */
  policy: RetryPolicyType;
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Backoff multiplier for exponential */
  backoffMultiplier?: number;
  /** Jitter factor (0-1) for jittered exponential */
  jitterFactor?: number;
  /** Retry specific error types only */
  retryableErrors?: ErrorType[];
}

/**
 * Dead letter queue configuration
 */
export interface DLQConfig {
  /** Name of the dead letter exchange */
  exchange: string;
  /** Dead letter exchange type */
  exchangeType?: string;
  /** Routing key for dead letters */
  routingKey?: string;
  /** Message TTL in DLQ */
  messageTTL?: number;
  /** Maximum length of DLQ */
  maxLength?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Queue name */
  name: string;
  /** Whether queue is durable */
  durable?: boolean;
  /** Whether queue is exclusive to this connection */
  exclusive?: boolean;
  /** Whether queue auto-deletes when no consumers */
  autoDelete?: boolean;
  /** Queue arguments (x-dead-letter-exchange, etc.) */
  arguments?: Record<string, unknown>;
  /** Message TTL in milliseconds */
  messageTTL?: number;
  /** Maximum queue length */
  maxLength?: number;
  /** Dead letter queue configuration */
  deadLetter?: DLQConfig;
}

/**
 * Exchange configuration
 */
export interface ExchangeConfig {
  /** Exchange name */
  name: string;
  /** Exchange type (direct, topic, fanout, headers) */
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  /** Whether exchange is durable */
  durable?: boolean;
  /** Whether exchange auto-deletes */
  autoDelete?: boolean;
  /** Exchange arguments */
  arguments?: Record<string, unknown>;
}

/**
 * Binding configuration
 */
export interface BindingConfig {
  /** Queue name */
  queue: string;
  /** Exchange name */
  exchange: string;
  /** Routing key pattern */
  routingKey: string;
  /** Binding arguments */
  arguments?: Record<string, unknown>;
}

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  /** Consumer name for identification */
  consumerName: string;
  /** Consumer group (for load balancing) */
  consumerGroup?: string;
  /** Prefetch count (number of unacked messages) */
  prefetch?: number;
  /** Whether to acknowledge automatically */
  noAck?: boolean;
  /** Consumer priority */
  priority?: number;
  /** Consumer tag */
  consumerTag?: string;
}

/**
 * RabbitMQ connection options
 */
export interface ConnectionOptions {
  /** Connection URL (overrides host/port options) */
  url?: string;
  /** RabbitMQ hostname */
  hostname?: string;
  /** RabbitMQ port */
  port?: number;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** Virtual host */
  vhost?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Heartbeat interval in seconds */
  heartbeat?: number;
  /** Connection name for RabbitMQ admin */
  connectionName?: string;
  /** TLS options */
  tls?: {
    cert?: string;
    key?: string;
    ca?: string;
    passphrase?: string;
  };
  /** Frame max size */
  frameMax?: number;
  /** Channel max */
  channelMax?: number;
}

/**
 * Idempotency configuration
 */
export interface IdempotencyConfig {
  /** Whether idempotency is enabled */
  enabled: boolean;
  /** Database connection string */
  connectionString?: string;
  /** Table name for processed events */
  tableName?: string;
  /** Schema name */
  schema?: string;
  /** TTL for processed event records in milliseconds */
  ttl?: number;
  /** Whether to enable batching for idempotency checks */
  enableBatching?: boolean;
  /** Batch size for idempotency checks */
  batchSize?: number;
  /** Maximum number of concurrent checks */
  maxConcurrentChecks?: number;
}

/**
 * Schema validator configuration
 */
export interface SchemaValidatorConfig {
  /** Whether validation is enabled */
  enabled: boolean;
  /** Whether to throw on validation error or just log */
  throwOnError?: boolean;
  /** Custom schemas directory */
  schemasDir?: string;
  /** Whether to validate envelope structure */
  validateEnvelope?: boolean;
  /** Whether to validate payload against schema */
  validatePayload?: boolean;
}

/**
 * Deserializer configuration
 */
export interface DeserializerConfig {
  /** Whether deserialization is enabled */
  enabled: boolean;
  /** Maximum allowed message size in bytes */
  maxSizeBytes?: number;
  /** Content type to expect */
  expectedContentType?: string;
  /** Whether to enforce content type */
  enforceContentType?: boolean;
}

/**
 * Ack handler configuration
 */
export interface AckHandlerConfig {
  /** Whether to auto-ack on success */
  autoAckSuccess?: boolean;
  /** Whether to auto-nack on error */
  autoNackError?: boolean;
  /** Default requeue behavior on nack */
  defaultRequeue?: boolean;
  /** Whether to batch acknowledgments */
  enableBatchAck?: boolean;
  /** Batch acknowledgment window in milliseconds */
  batchAckWindowMs?: number;
  /** Maximum batch size for acknowledgments */
  maxBatchSize?: number;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Whether error handling is enabled */
  enabled: boolean;
  /** Default error handler for unclassified errors */
  defaultErrorType?: ErrorType;
  /** Default error severity */
  defaultSeverity?: ErrorSeverity;
  /** Whether to classify errors automatically */
  autoClassify?: boolean;
  /** Custom error classifiers */
  errorClassifiers?: Array<(error: unknown) => ErrorType | null>;
}

/**
 * Correlation handler configuration
 */
export interface CorrelationHandlerConfig {
  /** Whether correlation handling is enabled */
  enabled: boolean;
  /** Whether to generate trace ID if missing */
  generateTraceId?: boolean;
  /** Header name for correlation ID */
  correlationIdHeader?: string;
  /** Header name for trace ID */
  traceIdHeader?: string;
  /** Header name for causation ID */
  causationIdHeader?: string;
}

/**
 * Overall Event SDK configuration
 */
export interface EventSDKConfig {
  /** RabbitMQ connection options */
  connection: ConnectionOptions;
  /** Default queue configuration */
  queue?: QueueConfig;
  /** Default exchange configuration */
  exchange?: ExchangeConfig;
  /** Default bindings */
  bindings?: BindingConfig[];
  /** Consumer configuration */
  consumer?: ConsumerConfig;
  /** Idempotency configuration */
  idempotency?: IdempotencyConfig;
  /** Schema validator configuration */
  schemaValidation?: SchemaValidatorConfig;
  /** Deserializer configuration */
  deserializer?: DeserializerConfig;
  /** Ack handler configuration */
  ackHandler?: AckHandlerConfig;
  /** Error handler configuration */
  errorHandler?: ErrorHandlerConfig;
  /** Correlation handler configuration */
  correlationHandler?: CorrelationHandlerConfig;
  /** Global retry configuration */
  retryConfig?: RetryConfig;
  /** Dead letter queue configuration */
  dlq?: DLQConfig;
  /** Shutdown timeout in milliseconds */
  shutdownTimeout?: number;
  /** Whether to enable graceful shutdown */
  enableGracefulShutdown?: boolean;
  /** Logging level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Custom logger */
  logger?: Logger;
  /** Whether to enable metrics */
  enableMetrics?: boolean;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Event processing result
 */
export interface ProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Whether message was acknowledged */
  acknowledged: boolean;
  /** Processing duration in milliseconds */
  duration: number;
  /** Number of retries attempted */
  retryCount: number;
  /** Error that occurred (if any) */
  error?: ClassifiedError;
  /** Custom result data */
  data?: Record<string, unknown>;
}

/**
 * Consumer statistics
 */
export interface ConsumerStats {
  /** Number of messages received */
  messagesReceived: number;
  /** Number of messages successfully processed */
  messagesProcessed: number;
  /** Number of messages failed */
  messagesFailed: number;
  /** Number of messages retried */
  messagesRetried: number;
  /** Number of messages sent to DLQ */
  messagesToDLQ: number;
  /** Number of duplicate events skipped */
  duplicatesSkipped: number;
  /** Number of validation errors */
  validationErrors: number;
  /** Average processing time in milliseconds */
  avgProcessingTime: number;
  /** Current processing rate (messages/second) */
  processingRate: number;
  /** Current retry count */
  currentRetryCount: number;
  /** Consumer uptime in milliseconds */
  uptime: number;
  /** Last activity timestamp */
  lastActivityAt?: Date;
}

/**
 * Event processor options
 */
export interface EventProcessorOptions {
  /** Processor name */
  name: string;
  /** Middleware pipeline */
  middleware: MiddlewareFunction[];
  /** Event handlers */
  handlers: EventHandlerRegistration[];
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Whether to process messages in parallel */
  parallelProcessing?: boolean;
  /** Maximum parallel processing count */
  maxParallel?: number;
  /** Error handler */
  errorHandler?: (error: ClassifiedError, context: MiddlewareContext) => Promise<void>;
  /** Success handler */
  successHandler?: (context: MiddlewareContext) => Promise<void>;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Queue to subscribe to */
  queue: string;
  /** Event types to filter (empty = all) */
  eventTypes?: string[];
  /** Consumer tag */
  consumerTag?: string;
  /** Whether to subscribe exclusively */
  exclusive?: boolean;
  /** Arguments for subscription */
  arguments?: Record<string, unknown>;
}

/**
 * Connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

/**
 * Connection state information
 */
export interface ConnectionState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Connected at timestamp */
  connectedAt?: Date;
  /** Last reconnection timestamp */
  lastReconnectedAt?: Date;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Connection error (if any) */
  error?: Error;
}
