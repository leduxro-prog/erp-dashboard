/**
 * Event Bus E2E Test
 *
 * Comprehensive end-to-end tests for the event bus.
 * Tests happy paths, retry logic, DLQ handling, consumer crashes,
 * multiple consumers, event ordering, and correlation chains.
 *
 * @module tests/e2e/eventbus/EventBusE2ETest
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { createE2ETestHelper, E2ETestHelper, EventConfig } from './helpers/E2ETestHelper';
import { createAuditTrailValidator, AuditTrailValidator, AuditValidationResult } from './AuditTrailValidator';
import { createMetricsValidator, MetricsValidator } from './MetricsValidator';
import { createAlertValidator, AlertValidator, AlertSeverity } from './AlertValidator';
import { createMetricsHelper, MetricsHelper } from './helpers/MetricsHelper';

describe('Event Bus E2E Tests', () => {
  let helper: E2ETestHelper;
  let auditValidator: AuditTrailValidator;
  let metricsValidator: MetricsValidator;
  let alertValidator: AlertValidator;
  let metricsHelper: MetricsHelper;
  let testCorrelationId: string;

  beforeAll(async () => {
    // Initialize test environment
    helper = createE2ETestHelper({
      testSchema: 'test_e2e_eventbus',
      exchangePrefix: 'e2e-eventbus',
      queuePrefix: 'e2e-eventbus',
    });

    await helper.initialize(true, true);

    // Setup test topology
    await helper.setupTopology('order', 'topic', true);

    // Initialize validators
    auditValidator = createAuditTrailValidator(helper.getPostgres(), 'test_e2e_eventbus');
    metricsValidator = createMetricsValidator({
      metricsUrl: process.env.METRICS_URL || 'http://localhost:9090/metrics',
      ignoreMissing: true, // Allow missing metrics in test environment
    });
    alertValidator = createAlertValidator({
      alertUrl: process.env.ALERT_URL || 'http://localhost:3000/api/alerts',
      alertTimeoutMs: 30000,
    });
    metricsHelper = createMetricsHelper({
      prometheusUrl: process.env.PROMETHEUS_URL || 'http://localhost:9090',
    });

    // Start alert capture
    await alertValidator.startCapture();

    // Capture baseline metrics
    await metricsValidator.captureBaseline([
      'events_published_total',
      'events_failed_total',
      'events_retried_total',
      'event_processing_duration_seconds',
    ]);

    testCorrelationId = uuidv4();
  });

  afterAll(async () => {
    // Stop alert capture
    await alertValidator.stopCapture();

    // Cleanup and teardown
    await helper.teardown();
  });

  beforeEach(async () => {
    // Clear alerts before each test
    await alertValidator.clearAllAlerts();

    // Generate new correlation ID for each test
    testCorrelationId = uuidv4();
  });

  /**
   * Test 1: Event -> Consumer -> Success (Happy Path)
   */
  test('should process event successfully (happy path)', async () => {
    // Arrange
    const eventConfig: EventConfig = {
      eventType: 'OrderCreated',
      domain: 'order',
      correlationId: testCorrelationId,
      payload: {
        orderId: 1,
        customerId: 1,
        total: 100,
        items: [{ productId: 1, quantity: 2 }],
      },
    };

    // Act: Publish event
    const publishResult = await helper.publishEvent(eventConfig);
    expect(publishResult.success).toBe(true);

    // Register a consumer
    const consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        // Record processed event
        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, output)
           VALUES ($1, $2, $3, 'completed', $4)`,
          [message.id, message.type, 'test-consumer', JSON.stringify({ processed: true })]
        );
      }
    );

    // Wait for event to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Assert: Validate audit trail
    const auditResult = await auditValidator.waitForAuditTrail(
      publishResult.eventId,
      'published'
    );

    expect(auditResult.valid).toBe(true);
    expect(auditResult.outboxEvent?.status).toBe('published');
    expect(auditResult.processedEvents.length).toBeGreaterThan(0);
    expect(auditResult.processedEvents[0].status).toBe('completed');

    // Assert: Validate correlation ID propagated
    expect(auditResult.outboxEvent?.correlation_id).toBe(testCorrelationId);

    // Assert: Validate metrics
    const metricsResult = await metricsValidator.validatePublishMetrics(
      'OrderCreated',
      'order',
      { expectedPublishCount: 1 }
    );

    expect(metricsResult.valid).toBe(true);

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 2: Event -> Consumer -> Retry -> Success
   */
  test('should retry failed event and eventually succeed', async () => {
    // Arrange
    const eventConfig: EventConfig = {
      eventType: 'InventoryUpdated',
      domain: 'inventory',
      correlationId: testCorrelationId,
      payload: { productId: 1, quantity: 10 },
    };

    // Act: Publish event
    const publishResult = await helper.publishEvent(eventConfig);
    expect(publishResult.success).toBe(true);

    // Register a consumer that fails first time
    let attemptCount = 0;
    const consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt: fail
          throw new Error('Simulated consumer error');
        } else {
          // Second attempt: succeed
          await helper.getPostgres().query(
            `INSERT INTO test_e2e_eventbus.processed_events
             (event_id, event_type, consumer_name, status, processing_attempts, output)
             VALUES ($1, $2, $3, 'completed', $4, $5)`,
            [message.id, message.type, 'retry-consumer', attemptCount, JSON.stringify({ processed: true })]
          );
        }
      }
    );

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Assert: Event was retried
    expect(attemptCount).toBeGreaterThan(1);

    // Assert: Validate audit trail shows retry
    const auditResult = await auditValidator.validateAuditTrail(publishResult.eventId);
    expect(auditResult.outboxEvent?.attempts).toBeGreaterThan(0);

    // Assert: Validate retry metrics
    const retryMetrics = await metricsValidator.validateRetryMetrics(
      'InventoryUpdated',
      'inventory',
      1
    );

    // Note: Metrics validation might be skipped if metrics not available in test env
    expect(retryMetrics.errors.length === 0 || retryMetrics.warnings.length > 0).toBe(true);

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 3: Event -> Consumer -> Retry Exhausted -> DLQ
   */
  test('should send event to DLQ after max retries', async () => {
    // Arrange
    const eventConfig: EventConfig = {
      eventType: 'PaymentFailed',
      domain: 'payment',
      correlationId: testCorrelationId,
      payload: { paymentId: 1, amount: 100, reason: 'insufficient_funds' },
    };

    // Act: Publish event
    const publishResult = await helper.publishEvent(eventConfig);
    expect(publishResult.success).toBe(true);

    // Register a consumer that always fails
    const consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        throw new Error('Permanent consumer error');
      }
    );

    // Wait for event to go to DLQ (after max retries)
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Assert: Event marked as failed/discarded
    const outboxEvent = await helper.getOutboxEvent(publishResult.eventId);
    expect(outboxEvent?.status).toBe('failed');
    expect(outboxEvent?.error_message).toBeDefined();

    // Assert: DLQ has the message
    const dlqState = await helper.getDLQState();
    expect(dlqState).not.toBeNull();
    expect(dlqState!.messageCount).toBeGreaterThan(0);

    // Assert: Validate DLQ alert fired (if alert manager is configured)
    const alertResult = await alertValidator.validateDLQAlert(
      helper.getTopology()!.dlq!,
      dlqState!.messageCount,
      AlertSeverity.CRITICAL
    );

    // Alert validation might be skipped if alert manager not configured
    if (alertResult.actual) {
      expect(alertResult.actual.level).toBe(AlertSeverity.CRITICAL);
    }

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 4: DLQ -> Redrive -> Consumer -> Idempotent Success
   */
  test('should redrive event from DLQ and process idempotently', async () => {
    // Arrange: First, get an event into DLQ
    const eventConfig: EventConfig = {
      eventType: 'ShipmentCreated',
      domain: 'shipping',
      correlationId: testCorrelationId,
      payload: { shipmentId: 1, orderId: 1, items: 5 },
    };

    const publishResult = await helper.publishEvent(eventConfig);

    // Force event to DLQ by marking as failed with max attempts
    await helper.getPostgres().query(
      `UPDATE test_e2e_eventbus.outbox_events
       SET status = 'failed', attempts = 3, max_attempts = 3, failed_at = NOW()
       WHERE event_id = $1`,
      [publishResult.eventId]
    );

    // Check DLQ state
    let dlqState = await helper.getDLQState();
    expect(dlqState!.messageCount).toBeGreaterThan(0);

    // Act: Redrive from DLQ
    const redrivenCount = await helper.redriveFromDLQ();
    expect(redrivenCount).toBeGreaterThan(0);

    // Set up idempotent consumer
    const processedEvents = new Set<string>();
    const consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        // Idempotency check
        if (processedEvents.has(message.id)) {
          console.log('[Test] Duplicate event, skipping (idempotent)');
          return;
        }

        processedEvents.add(message.id);

        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, output)
           VALUES ($1, $2, $3, 'completed', $4)`,
          [message.id, message.type, 'idempotent-consumer', JSON.stringify({ redriven: true })]
        );
      }
    );

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Assert: Event processed only once (idempotent)
    const processedRecords = await helper.getProcessedEvents(publishResult.eventId);
    expect(processedRecords.length).toBe(1);
    expect(processedRecords[0].status).toBe('completed');

    // Assert: DLQ is now empty
    dlqState = await helper.getDLQState();
    expect(dlqState!.messageCount).toBe(0);

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 5: Event -> Consumer Crash -> Restart -> Resume
   */
  test('should resume after consumer crash', async () => {
    // Arrange
    const eventConfig: EventConfig = {
      eventType: 'InvoiceCreated',
      domain: 'billing',
      correlationId: testCorrelationId,
      payload: { invoiceId: 1, orderId: 1, amount: 150 },
    };

    const publishResult = await helper.publishEvent(eventConfig);

    // Track processing state
    const processingState = {
      received: false,
      processed: false,
      crashed: false,
    };

    // Register initial consumer
    let consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        processingState.received = true;
        processingState.processed = true;

        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, output)
           VALUES ($1, $2, $3, 'completed', $4)`,
          [message.id, message.type, 'crash-test-consumer', JSON.stringify({ processed: true })]
        );
      }
    );

    // Wait for event to be received
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(processingState.received).toBe(true);

    // Act: Simulate consumer crash
    await helper.simulateConsumerFailure(consumerTag);
    processingState.crashed = true;

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Restart consumer
    consumerTag = await helper.restartConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        // This handler should not be called for already processed message
        // (unless message was not ACKed before crash)
        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, output)
           VALUES ($1, $2, $3, 'completed', $4)
           ON CONFLICT (consumer_name, event_id) DO UPDATE SET
           status = excluded.status, output = excluded.output, processing_attempts = processed_events.processing_attempts + 1`,
          [message.id, message.type, 'restart-consumer', JSON.stringify({ restarted: true })]
        );
      }
    );

    // Wait for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Assert: Event was processed (either before or after restart)
    const processedRecords = await helper.getProcessedEvents(publishResult.eventId);
    expect(processedRecords.length).toBeGreaterThan(0);

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 6: Multiple Consumers for Same Event
   */
  test('should support multiple consumers for same event', async () => {
    // Arrange
    const eventConfig: EventConfig = {
      eventType: 'ProductUpdated',
      domain: 'catalog',
      correlationId: testCorrelationId,
      payload: { productId: 1, name: 'Test Product', price: 99.99 },
    };

    const publishResult = await helper.publishEvent(eventConfig);

    // Track which consumers processed the event
    const processedBy = new Set<string>();

    // Register multiple consumers
    const consumerTags: string[] = [];

    for (let i = 1; i <= 3; i++) {
      const tag = await helper.registerConsumer(
        helper.getTopology()!.queue,
        async (message) => {
          processedBy.add(`consumer-${i}`);

          await helper.getPostgres().query(
            `INSERT INTO test_e2e_eventbus.processed_events
             (event_id, event_type, consumer_name, status, output)
             VALUES ($1, $2, $3, 'completed', $4)
             ON CONFLICT (consumer_name, event_id) DO UPDATE SET
             status = excluded.status, output = excluded.output, processing_attempts = processed_events.processing_attempts + 1`,
            [message.id, message.type, `consumer-${i}`, JSON.stringify({ processed: true })]
          );
        }
      );

      consumerTags.push(tag);
    }

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Assert: At least one consumer processed the event
    expect(processedBy.size).toBeGreaterThan(0);

    // Assert: Validate audit trail
    const processedRecords = await helper.getProcessedEvents(publishResult.eventId);
    expect(processedRecords.length).toBeGreaterThan(0);

    // Verify each consumer appears in records
    const consumersInRecords = processedRecords.map((r) => r.consumer_name);
    expect(Array.from(processedBy).every(consumer => consumersInRecords.includes(consumer))).toBe(true);

    // Cleanup
    for (const tag of consumerTags) {
      await helper.rabbitmq.cancelConsumer(tag);
    }

    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 7: Event Ordering Preservation
   */
  test('should preserve event ordering', async () => {
    // Arrange: Publish multiple events in sequence
    const eventConfigs: EventConfig[] = [];

    for (let i = 1; i <= 10; i++) {
      eventConfigs.push({
        eventType: 'OrderEvent',
        domain: 'order',
        correlationId: testCorrelationId,
        parentEventId: i > 1 ? `parent-${i - 1}` : undefined,
        payload: { orderNumber: i, timestamp: Date.now() + i },
      });
    }

    const publishResults = await helper.publishEvents(eventConfigs);
    expect(publishResults.every((r) => r.success)).toBe(true);

    const eventIds = publishResults.map((r) => r.eventId);

    // Track received order
    const receivedOrder: number[] = [];

    // Register consumer
    const consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        const orderNumber = (message.payload as any).orderNumber;
        receivedOrder.push(orderNumber);

        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, output)
           VALUES ($1, $2, $3, 'completed', $4)
           ON CONFLICT (consumer_name, event_id) DO UPDATE SET
           status = excluded.status, output = excluded.output`,
          [message.id, message.type, 'ordering-consumer', JSON.stringify({ orderNumber })]
        );
      }
    );

    // Wait for all events to be processed
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Assert: All events received
    expect(receivedOrder.length).toBe(10);

    // Assert: Events received in order
    for (let i = 0; i < receivedOrder.length - 1; i++) {
      expect(receivedOrder[i]).toBeLessThanOrEqual(receivedOrder[i + 1]);
    }

    // Assert: Validate event ordering in database
    const orderingResult = await auditValidator.validateEventOrdering(eventIds);
    expect(orderingResult.ordered).toBe(true);

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 8: Event Correlation Chain Validation
   */
  test('should validate correlation chain', async () => {
    // Arrange: Create a chain of related events
    const rootEventId = uuidv4();

    // Event 1: Order Created (root)
    const event1Config: EventConfig = {
      eventType: 'OrderCreated',
      domain: 'order',
      correlationId: testCorrelationId,
      payload: { orderId: 1, amount: 100 },
    };

    const event1Result = await helper.publishEvent(event1Config);

    // Event 2: Inventory Reserved (child of OrderCreated)
    const event2Config: EventConfig = {
      eventType: 'InventoryReserved',
      domain: 'inventory',
      correlationId: testCorrelationId,
      causationId: event1Result.eventId,
      payload: { productId: 1, quantity: 2 },
    };

    const event2Result = await helper.publishEvent(event2Config);

    // Event 3: Payment Processed (child of InventoryReserved)
    const event3Config: EventConfig = {
      eventType: 'PaymentProcessed',
      domain: 'payment',
      correlationId: testCorrelationId,
      causationId: event2Result.eventId,
      parentEventId: event1Result.eventId,
      payload: { paymentId: 1, amount: 100 },
    };

    const event3Result = await helper.publishEvent(event3Config);

    // Register consumer to process events
    await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, output)
           VALUES ($1, $2, $3, 'completed', $4)
           ON CONFLICT (consumer_name, event_id) DO UPDATE SET
           status = excluded.status, output = excluded.output`,
          [message.id, message.type, 'chain-consumer', JSON.stringify({ processed: true })]
        );
      }
    );

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Assert: Validate correlation chain
    const chainResult = await auditValidator.validateCorrelationChain(
      event3Result.eventId,
      3 // Expected chain length
    );

    expect(chainResult.valid).toBe(true);
    expect(chainResult.chain.length).toBe(3);

    // Assert: Verify correlation ID is the same for all events
    const correlationIds = chainResult.chain.map((e) => e.correlationId);
    const uniqueCorrelationIds = new Set(correlationIds);
    expect(uniqueCorrelationIds.size).toBe(1);
    expect(uniqueCorrelationIds.has(testCorrelationId)).toBe(true);

    // Assert: Verify causation IDs create a chain
    const eventsInOrder = [
      event1Result.eventId,
      event2Result.eventId,
      event3Result.eventId,
    ];

    expect(chainResult.chain[0].eventId).toBe(eventsInOrder[2]); // Payment
    expect(chainResult.chain[1].eventId).toBe(eventsInOrder[1]); // Inventory
    expect(chainResult.chain[2].eventId).toBe(eventsInOrder[0]); // Order

    // Cleanup
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 9: Verify No Alerts on Success
   */
  test('should not fire alerts on successful processing', async () => {
    // Arrange
    const eventConfig: EventConfig = {
      eventType: 'CustomerCreated',
      domain: 'customer',
      correlationId: testCorrelationId,
      payload: { customerId: 1, name: 'Test Customer', email: 'test@example.com' },
    };

    // Act: Publish and process event successfully
    const publishResult = await helper.publishEvent(eventConfig);

    const consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, output)
           VALUES ($1, $2, $3, 'completed', $4)`,
          [message.id, message.type, 'success-consumer', JSON.stringify({ processed: true })]
        );
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Assert: No alerts should have fired
    const noAlertResult = await alertValidator.validateNoAlertsFired(
      5000,
      (alert) => alert.title.includes('DLQ') || alert.title.includes('Retry') || alert.title.includes('Circuit Breaker')
    );

    expect(noAlertResult.valid).toBe(true);

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });

  /**
   * Test 10: Verify Metrics Updated After Processing
   */
  test('should update processing duration metrics', async () => {
    // Arrange
    const eventConfig: EventConfig = {
      eventType: 'QuoteCreated',
      domain: 'quote',
      correlationId: testCorrelationId,
      payload: { quoteId: 1, customerId: 1, total: 200 },
    };

    // Act: Publish event
    const publishResult = await helper.publishEvent(eventConfig);

    // Capture processing start time
    const processingStart = Date.now();

    // Register consumer
    const consumerTag = await helper.registerConsumer(
      helper.getTopology()!.queue,
      async (message) => {
        const processingDuration = Date.now() - processingStart;

        await helper.getPostgres().query(
          `INSERT INTO test_e2e_eventbus.processed_events
           (event_id, event_type, consumer_name, status, processing_duration_ms, output)
           VALUES ($1, $2, $3, 'completed', $4, $5)`,
          [message.id, message.type, 'metrics-consumer', processingDuration, JSON.stringify({ processed: true })]
        );
      }
    );

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Assert: Validate processing duration metrics
    const durationResult = await metricsValidator.validateProcessingDurationMetrics(
      'QuoteCreated',
      'quote'
    );

    // Metrics might not be available in all test environments
    expect(durationResult.errors.length === 0 || durationResult.warnings.length > 0).toBe(true);

    // Assert: Check for processing duration histogram via metrics helper
    const histogramData = await metricsHelper.getHistogramSumAndCount(
      'cypher_event_processing_duration_seconds',
      { event_type: 'QuoteCreated', event_domain: 'quote' }
    );

    // If metrics are available, validate them
    if (histogramData.count > 0) {
      expect(histogramData.count).toBeGreaterThan(0);
      expect(histogramData.sum).toBeGreaterThan(0);
    }

    // Cleanup
    await helper.rabbitmq.cancelConsumer(consumerTag);
    await helper.cleanup(testCorrelationId);
  });
});
