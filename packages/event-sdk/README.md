# @cypher/event-sdk

Enterprise-grade event consumer SDK for RabbitMQ with middleware pipeline, schema validation, idempotency, and reliable message handling.

## Features

- **Middleware Pipeline**: Composable middleware for event processing
- **Schema Validation**: JSON Schema validation using AJV
- **Idempotency**: Exactly-once processing guarantee with database tracking
- **ACK/NACK Handling**: Configurable acknowledgment strategies with dead letter queues
- **Error Classification**: Automatic error type and severity detection
- **Correlation Propagation**: Distributed tracing with correlation IDs and trace IDs
- **Retry Policies**: Configurable retry strategies (fixed, exponential, linear)
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **TypeScript**: Full type safety and IntelliSense support
- **Observability**: Built-in metrics and statistics

## Installation

```bash
npm install @cypher/event-sdk
```

## Quick Start

```typescript
import { createEventConsumer } from '@cypher/event-sdk';

// Create and configure consumer
const consumer = createEventConsumer({
  connection: {
    hostname: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
  },
  queue: {
    name: 'orders',
    durable: true,
  },
  consumer: {
    consumerName: 'order-processor',
    prefetch: 10,
  },
  idempotency: {
    enabled: true,
    connectionString: 'postgresql://localhost/cypher',
  },
});

// Connect and start consuming
await consumer.connect();
await consumer.subscribe({ queue: 'orders' });
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EventConsumer                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              EventProcessor                         │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │         Middleware Pipeline                 │  │   │
│  │  │  ┌──────────────────────────────────────┐ │  │   │
│  │  │  │ 1. CorrelationHandler               │ │  │   │
│  │  │  │    (Trace ID propagation)           │ │  │   │
│  │  │  └──────────────────────────────────────┘ │  │   │
│  │  │  ┌──────────────────────────────────────┐ │  │   │
│  │  │  │ 2. Deserializer                  │ │  │   │
│  │  │  │    (JSON parsing)                 │ │  │   │
│  │  │  └──────────────────────────────────────┘ │  │   │
│  │  │  ┌──────────────────────────────────────┐ │  │   │
│  │  │  │ 3. SchemaValidator               │ │  │   │
│  │  │  │    (JSON Schema validation)       │ │  │   │
│  │  │  └──────────────────────────────────────┘ │  │   │
│  │  │  ┌──────────────────────────────────────┐ │  │   │
│  │  │  │ 4. Idempotency                   │ │  │   │
│  │  │  │    (Duplicate check)               │ │  │   │
│  │  │  └──────────────────────────────────────┘ │  │   │
│  │  │  ┌──────────────────────────────────────┐ │  │   │
│  │  │  │ 5. ErrorHandler                 │ │  │   │
│  │  │  │    (Error classification)         │ │  │   │
│  │  │  └──────────────────────────────────────┘ │  │   │
│  │  │  ┌──────────────────────────────────────┐ │  │   │
│  │  │  │ 6. AckHandler                   │ │  │   │
│  │  │  │    (ACK/NACK/DLQ)               │ │  │   │
│  │  │  └──────────────────────────────────────┘ │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │         Event Handlers                    │    │   │
│  │  │  • order.created → handler               │    │   │
│  │  │  • inventory.updated → handler          │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           RabbitMQ Connection                    │   │
│  │  • Connection management                       │   │
│  │  • Channel setup                               │   │
│  │  • Queue binding                              │   │
│  │  • Graceful shutdown                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Middleware

### Correlation Handler

Extracts and propagates correlation IDs and trace IDs for distributed tracing.

```typescript
import { createCorrelationHandler } from '@cypher/event-sdk';

processor.use(createCorrelationHandler({
  generateTraceId: true,
  correlationIdHeader: 'x-correlation-id',
  traceIdHeader: 'x-trace-id',
}));
```

### Deserializer

Deserializes RabbitMQ messages into EventEnvelope objects.

```typescript
import { createDeserializer } from '@cypher/event-sdk';

processor.use(createDeserializer({
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  expectedContentType: 'application/json',
  enforceContentType: false,
}));
```

### Schema Validator

Validates event envelopes and payloads against JSON schemas.

```typescript
import { createSchemaValidator } from '@cypher/event-sdk';

processor.use(createSchemaValidator({
  enabled: true,
  throwOnError: false,
  validateEnvelope: true,
  validatePayload: true,
}));
```

### Idempotency

Ensures each event is processed exactly once using database tracking.

```typescript
import { createIdempotency } from '@cypher/event-sdk';

processor.use(createIdempotency('my-consumer', {
  enabled: true,
  connectionString: 'postgresql://localhost/cypher',
  tableName: 'processed_events',
  schema: 'shared',
  ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
}));
```

### Error Handler

Classifies errors by type and determines retryability.

```typescript
import { createErrorHandler, ErrorType } from '@cypher/event-sdk';

processor.use(createErrorHandler({
  enabled: true,
  autoClassify: true,
  defaultSeverity: 'medium',
  errorClassifiers: [
    (error) => {
      if (error instanceof Error && error.message.includes('timeout')) {
        return ErrorType.TIMEOUT_ERROR;
      }
      return null;
    },
  ],
}));
```

### Ack Handler

Handles message acknowledgment with retry and DLQ support.

```typescript
import { createAckHandler } from '@cypher/event-sdk';

processor.use(createAckHandler({
  autoAckSuccess: true,
  autoNackError: true,
  defaultRequeue: false,
}));
```

## Event Handlers

Register handlers for specific event types:

```typescript
import { EventHandlerRegistration } from '@cypher/event-sdk';

const handler: EventHandlerRegistration = {
  eventType: 'order.created',
  eventVersion: 'v1',
  consumerName: 'order-processor',
  consumerGroup: 'order-handlers',
  enableIdempotency: true,
  handler: async (context) => {
    const { envelope, correlationId } = context;
    console.log(`Processing order: ${envelope.payload.order_id}`);
    console.log(`Correlation ID: ${correlationId}`);

    // Business logic here
  },
  retryConfig: {
    policy: 'exponential_with_jitter',
    maxAttempts: 3,
    initialDelayMs: 1000,
  },
};

consumer.registerHandler(handler);
```

## Retry Policies

Configure retry behavior for transient errors:

```typescript
import { RetryPolicy } from '@cypher/event-sdk';

// Exponential backoff with jitter
const retryPolicy = RetryPolicy.exponential(5, 2000, 3);

// Fixed delay
const fixedPolicy = RetryPolicy.fixedDelay(3, 5000);

// No retry
const noRetryPolicy = RetryPolicy.noRetry();

// Immediate retry
const immediatePolicy = RetryPolicy.immediate(3);

// Use with ack handler
const ackHandler = createAckHandler(
  {},
  undefined,
  undefined,
  retryPolicy
);
processor.use(ackHandler);
```

## Dead Letter Queue

Configure DLQ for failed messages:

```typescript
const consumer = createEventConsumer({
  queue: {
    name: 'orders',
    durable: true,
    deadLetter: {
      exchange: 'orders.dlq',
      routingKey: 'orders',
      messageTTL: 86400000, // 24 hours
    },
  },
  dlq: {
    exchange: 'events.dlq',
    routingKey: 'events',
    messageTTL: 86400000,
  },
});
```

## Graceful Shutdown

The SDK handles graceful shutdown automatically:

```typescript
// Connect
await consumer.connect();

// ... consumer runs ...

// Shutdown (also handled on SIGTERM/SIGINT)
await consumer.shutdown();
```

## Statistics

Get consumer statistics:

```typescript
const stats = consumer.getStats();

console.log(`Messages Received: ${stats.messagesReceived}`);
console.log(`Messages Processed: ${stats.messagesProcessed}`);
console.log(`Messages Failed: ${stats.messagesFailed}`);
console.log(`Avg Processing Time: ${stats.avgProcessingTime}ms`);
console.log(`Processing Rate: ${stats.processingRate} msg/s`);
console.log(`Uptime: ${(stats.uptime / 1000).toFixed(0)}s`);
```

## Configuration Reference

### EventSDKConfig

| Property | Type | Default | Description |
|----------|-------|----------|-------------|
| connection | ConnectionOptions | - | RabbitMQ connection options |
| queue | QueueConfig | - | Default queue configuration |
| exchange | ExchangeConfig | - | Default exchange configuration |
| bindings | BindingConfig[] | - | Queue-exchange bindings |
| consumer | ConsumerConfig | - | Consumer options |
| idempotency | IdempotencyConfig | - | Idempotency options |
| schemaValidation | SchemaValidatorConfig | - | Schema validation options |
| deserializer | DeserializerConfig | - | Deserialization options |
| ackHandler | AckHandlerConfig | - | ACK handler options |
| errorHandler | ErrorHandlerConfig | - | Error handler options |
| correlationHandler | CorrelationHandlerConfig | - | Correlation options |
| retryConfig | RetryConfig | - | Retry policy |
| dlq | DLQConfig | - | Dead letter queue |
| shutdownTimeout | number | 30000 | Shutdown timeout (ms) |
| enableGracefulShutdown | boolean | true | Enable graceful shutdown |
| logLevel | 'debug' \| 'info' \| 'warn' \| 'error' | 'info' | Logging level |
| logger | Logger | - | Custom logger |
| enableMetrics | boolean | true | Enable metrics collection |

### ConnectionOptions

| Property | Type | Default | Description |
|----------|-------|----------|-------------|
| url | string | - | Connection URL (overrides host/port) |
| hostname | string | 'localhost' | RabbitMQ hostname |
| port | number | 5672 | RabbitMQ port |
| username | string | 'guest' | Username |
| password | string | 'guest' | Password |
| vhost | string | '/' | Virtual host |
| heartbeat | number | 60 | Heartbeat interval (s) |
| timeout | number | 10000 | Connection timeout (ms) |
| connectionName | string | - | Connection name for monitoring |

### ConsumerConfig

| Property | Type | Default | Description |
|----------|-------|----------|-------------|
| consumerName | string | - | Unique consumer name |
| consumerGroup | string | - | Consumer group for load balancing |
| prefetch | number | 10 | Prefetch count |
| noAck | boolean | false | Auto-acknowledge |
| priority | number | - | Consumer priority |

## Error Types

| Type | Description | Retryable |
|------|-------------|------------|
| VALIDATION_ERROR | Invalid message format | No |
| SCHEMA_VALIDATION_ERROR | Schema validation failed | No |
| DUPLICATE_EVENT | Already processed | No |
| TRANSIENT_ERROR | Network/timeout error | Yes |
| BUSINESS_ERROR | Business rule violation | No |
| EXTERNAL_SERVICE_ERROR | External service failure | Yes |
| DATABASE_ERROR | Database error | Yes |
| TIMEOUT_ERROR | Operation timeout | Yes |
| CONFIGURATION_ERROR | Misconfiguration | No |
| UNKNOWN_ERROR | Unclassified error | No |

## Error Severity Levels

| Level | Description |
|-------|-------------|
| LOW | Low severity, can be logged and continue |
| MEDIUM | May need retry or attention |
| HIGH | Requires investigation |
| CRITICAL | System impact, immediate attention needed |

## Best Practices

1. **Always enable idempotency** for production consumers
2. **Use correlation IDs** for distributed tracing
3. **Configure appropriate DLQ** for failed messages
4. **Set reasonable prefetch** to avoid overwhelming consumers
5. **Monitor statistics** for performance insights
6. **Test retry logic** with transient errors
7. **Clean up old records** from processed_events table
8. **Use appropriate error classification** for retry decisions

## Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| RABBITMQ_HOST | RabbitMQ hostname | localhost |
| RABBITMQ_PORT | RabbitMQ port | 5672 |
| RABBITMQ_USER | RabbitMQ username | guest |
| RABBITMQ_PASSWORD | RabbitMQ password | guest |
| RABBITMQ_VHOST | RabbitMQ vhost | / |
| DATABASE_URL | PostgreSQL connection string | - |

## License

MIT

## Support

For issues and questions, please use the GitHub issue tracker.
