/**
 * @file Example Event Consumer
 * @description Example implementation of an event consumer using the SDK
 */

import {
  createEventConsumer,
  createDeserializer,
  createSchemaValidator,
  createIdempotency,
  createAckHandler,
  createErrorHandler,
  createCorrelationHandler,
  EventHandlerRegistration,
  RetryPolicy,
  EventEnvelope,
} from '../src';
import { Pool } from 'pg';

// Initialize database connection pool for idempotency
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/cypher',
});

// Create event consumer
const consumer = createEventConsumer({
  connection: {
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    vhost: process.env.RABBITMQ_VHOST || '/',
    heartbeat: 60,
    connectionName: 'order-processor',
  },
  queue: {
    name: 'orders',
    durable: true,
    deadLetter: {
      exchange: 'orders.dlq',
      routingKey: 'orders',
      messageTTL: 86400000, // 24 hours
    },
  },
  consumer: {
    consumerName: 'order-processor',
    consumerGroup: 'order-handlers',
    prefetch: 10,
    noAck: false,
  },
  idempotency: {
    enabled: true,
    tableName: 'processed_events',
    schema: 'shared',
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  retryConfig: {
    policy: 'exponential_with_jitter' as const,
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  dlq: {
    exchange: 'events.dlq',
    routingKey: 'events',
    messageTTL: 86400000, // 24 hours
  },
  shutdownTimeout: 30000,
  enableGracefulShutdown: true,
  logLevel: 'info',
  enableMetrics: true,
});

// Get the event processor and set up middleware
const processor = consumer.getProcessor();

// 1. Correlation Handler - Must be first for tracing
processor.use(createCorrelationHandler({
  generateTraceId: true,
}));

// 2. Deserializer Middleware - Parse JSON messages
processor.use(createDeserializer({
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  expectedContentType: 'application/json',
  enforceContentType: false, // Be lenient
}));

// 3. Schema Validator Middleware - Validate against schemas
processor.use(createSchemaValidator({
  enabled: true,
  throwOnError: false, // Don't throw, just mark as failed
  validateEnvelope: true,
  validatePayload: true,
}));

// 4. Idempotency Middleware - Check if already processed
processor.use(createIdempotency('order-processor', {
  enabled: true,
  connectionString: process.env.DATABASE_URL,
}));

// 5. Error Handler Middleware - Classify errors
processor.use(createErrorHandler({
  enabled: true,
  autoClassify: true,
  defaultSeverity: 'medium' as const,
}));

// 6. ACK Handler Middleware - Handle message acknowledgment
processor.use(createAckHandler({
  autoAckSuccess: true,
  autoNackError: true,
  defaultRequeue: false, // Send to DLQ on error
}));

// Define event handler for order.created events
const orderCreatedHandler: EventHandlerRegistration = {
  eventType: 'order.created',
  eventVersion: 'v1',
  handler: async (context) => {
    const { envelope } = context;
    const payload = envelope.payload as {
      order_id: string;
      order_number: string;
      customer_id: string;
      items: Array<{
        product_id: string;
        quantity: number;
      }>;
    };

    console.log(`[Order Created] Processing order ${payload.order_number}`);

    // Business logic here
    // For example: Update inventory, send confirmation email, etc.

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`[Order Created] Order ${payload.order_number} processed successfully`);
  },
  consumerName: 'order-processor',
  consumerGroup: 'order-handlers',
  enableIdempotency: true,
  retryConfig: {
    policy: 'exponential_with_jitter' as const,
    maxAttempts: 3,
    initialDelayMs: 1000,
  },
};

// Define event handler for inventory.updated events
const inventoryUpdatedHandler: EventHandlerRegistration = {
  eventType: 'inventory.updated',
  eventVersion: 'v1',
  handler: async (context) => {
    const { envelope } = context;
    const payload = envelope.payload as {
      product_id: string;
      quantity: number;
      warehouse_id: string;
    };

    console.log(`[Inventory Updated] Product ${payload.product_id} stock: ${payload.quantity}`);

    // Update local cache, trigger notifications, etc.

    console.log(`[Inventory Updated] Update complete`);
  },
  consumerName: 'inventory-updater',
  consumerGroup: 'inventory-handlers',
};

// Register handlers
consumer.registerHandlers([
  orderCreatedHandler,
  inventoryUpdatedHandler,
]);

// Define custom middleware for logging
const loggingMiddleware = async (context: any, next: () => Promise<void>) => {
  console.log(`[Middleware] Processing event: ${context.envelope.event_type}`);
  console.log(`[Middleware] Correlation ID: ${context.correlationId}`);
  console.log(`[Middleware] Trace ID: ${context.traceId}`);

  const startTime = Date.now();
  await next();
  const duration = Date.now() - startTime;

  console.log(`[Middleware] Event processed in ${duration}ms`);
};

// Add custom middleware
processor.use(loggingMiddleware);

// Main execution
async function main() {
  try {
    console.log('Starting event consumer...');

    // Connect to RabbitMQ
    await consumer.connect();
    console.log('Connected to RabbitMQ');

    // Subscribe to queue
    await consumer.subscribe({
      queue: 'orders',
      consumerTag: 'order-processor-1',
    });
    console.log('Subscribed to queue: orders');

    // Set up interval to print stats
    setInterval(() => {
      const stats = consumer.getStats();
      console.log('\n=== Consumer Statistics ===');
      console.log(`Messages Received: ${stats.messagesReceived}`);
      console.log(`Messages Processed: ${stats.messagesProcessed}`);
      console.log(`Messages Failed: ${stats.messagesFailed}`);
      console.log(`Messages Retried: ${stats.messagesRetried}`);
      console.log(`Duplicates Skipped: ${stats.duplicatesSkipped}`);
      console.log(`Validation Errors: ${stats.validationErrors}`);
      console.log(`Avg Processing Time: ${stats.avgProcessingTime.toFixed(2)}ms`);
      console.log(`Processing Rate: ${stats.processingRate.toFixed(2)} msg/s`);
      console.log(`Uptime: ${(stats.uptime / 1000).toFixed(0)}s`);
      console.log('========================\n');
    }, 30000); // Every 30 seconds

    console.log('Consumer is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Failed to start consumer:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await consumer.shutdown();
  await dbPool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await consumer.shutdown();
  await dbPool.end();
  process.exit(0);
});

// Start the consumer
main();

/**
 * Example of publishing events (for testing)
 */
async function publishExampleEvent() {
  const { EventEnvelopeFactory } = await import('@cypher/events');

  const envelope = EventEnvelopeFactory.create({
    event_type: 'order.created',
    event_version: 'v1',
    producer: 'order-service',
    producer_version: '1.0.0',
    payload: {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      order_number: 'ORD-00012345',
      customer_id: 'CUST-001',
      customer_type: 'b2b',
      created_at: new Date().toISOString(),
      status: 'pending',
      items: [
        {
          item_id: '660e8400-e29b-41d4-a716-446655440001',
          product_id: 'PRD-001',
          quantity: 10,
          unit_price: 150.00,
        },
      ],
      totals: {
        subtotal: 1500.00,
        tax_amount: 285.00,
        total: 1785.00,
      },
    },
    metadata: {
      user_id: 'user-123',
      source: 'admin-panel',
    },
  });

  console.log('Example event envelope:', JSON.stringify(envelope, null, 2));
}

/**
 * Example of using custom error classifiers
 */
function setupCustomErrorClassifiers() {
  const { createErrorHandler, ErrorType, ErrorSeverity } = require('../src');

  const customErrorHandler = createErrorHandler({
    autoClassify: true,
    errorClassifiers: [
      (error) => {
        // Custom classifier for inventory errors
        if (error instanceof Error && error.message.includes('out of stock')) {
          return ErrorType.BUSINESS_ERROR;
        }
        return null;
      },
    ],
  });

  processor.use(customErrorHandler);
}

/**
 * Example of using custom retry policy
 */
function createCustomRetryPolicy() {
  const retryPolicy = RetryPolicy.exponential(5, 2000, 3); // 5 retries, 2s initial, 3x multiplier

  const ackHandler = require('../src').createAckHandler({
    autoAckSuccess: true,
    autoNackError: true,
  }, undefined, undefined, retryPolicy);

  processor.use(ackHandler);
}

export { main, publishExampleEvent, setupCustomErrorClassifiers, createCustomRetryPolicy };
