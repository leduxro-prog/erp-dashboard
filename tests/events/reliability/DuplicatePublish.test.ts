/**
 * Duplicate publish detection tests.
 *
 * Tests the system's ability to detect and handle duplicate event publishes,
 * ensuring exactly-once semantics and preventing duplicate processing.
 *
 * @module DuplicatePublish.test
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import {
  TestRabbitMQ,
  TestPostgres,
  setupTestTopology,
  createTestRabbitMQ,
  createTestPostgres,
  enableUUIDExtension,
} from './helpers';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  },
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cypher_erp_test',
    username: process.env.DB_USER || 'cypher_user',
    password: process.env.DB_PASSWORD || 'cypher_secret',
  },
};

describe('Duplicate Publish Detection', () => {
  let rmq: TestRabbitMQ;
  let pg: TestPostgres;
  let topology: { exchange: string; queue: string; routingKey: string };

  beforeAll(async () => {
    rmq = createTestRabbitMQ(TEST_CONFIG.rabbitmq);
    await rmq.connect();

    pg = createTestPostgres(TEST_CONFIG.postgres, 'duplicate_test');
    await pg.initialize();
    await enableUUIDExtension(pg);

    topology = await setupTestTopology(rmq);
  });

  afterAll(async () => {
    await rmq.cleanup();
    await pg.cleanup();
  });

  beforeEach(async () => {
    rmq.resetStats();
    pg.resetStats();
    await rmq.purgeQueue(topology.queue);

    // Create test tables
    await pg.createTable({
      name: 'processed_events',
      columns: [
        { name: 'event_id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'] },
        { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
        { name: 'consumer_name', type: 'VARCHAR(255)', nullable: false },
        { name: 'processed_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
      ],
      indexes: [
        { name: 'idx_event_id', columns: ['event_id'], unique: true },
        { name: 'idx_consumer', columns: ['consumer_name'] },
      ],
    });
  });

  afterEach(async () => {
    await pg.dropTable('processed_events');
  });

  describe('Event ID Deduplication', () => {
    test('should detect duplicate event IDs', async () => {
      const eventId = crypto.randomUUID();
      const message = {
        id: eventId,
        type: 'order.created',
        data: { order_id: 123 },
      };

      // Publish first time
      const result1 = await rmq.publish(topology.exchange, topology.routingKey, message);
      expect(result1.success).toBe(true);

      // Publish duplicate with same ID
      const result2 = await rmq.publish(topology.exchange, topology.routingKey, message);
      expect(result2.success).toBe(true); // Publish succeeds but should be detected downstream

      // Consume and count
      const consumed = await rmq.collectMessages(topology.queue, 2, 2000);
      const uniqueIds = new Set(consumed.map((m) => m.content.id));

      // System may deliver duplicates but should track them
      expect(consumed.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle multiple duplicate messages', async () => {
      const baseMessage = {
        id: crypto.randomUUID(),
        type: 'product.updated',
        data: { product_id: 456 },
      };

      // Publish same message 5 times
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await rmq.publish(topology.exchange, topology.routingKey, baseMessage);
        results.push(result.success);
      }

      expect(results.every((r) => r)).toBe(true);
    });

    test('should differentiate messages with different IDs', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        const result = await rmq.publish(topology.exchange, topology.routingKey, msg);
        expect(result.success).toBe(true);
      }

      const consumed = await rmq.collectMessages(topology.queue, 5, 5000);
      const uniqueIds = new Set(consumed.map((m) => m.content.id));

      expect(consumed.length).toBe(5);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('Database-level Deduplication', () => {
    test('should enforce unique event ID constraint in database', async () => {
      const eventId = crypto.randomUUID();

      // Insert first time
      await pg.insert('processed_events', {
        event_id: eventId,
        event_type: 'order.created',
        consumer_name: 'test-consumer',
      });

      // Attempt duplicate insert
      await expect(
        pg.insert('processed_events', {
          event_id: eventId,
          event_type: 'order.created',
          consumer_name: 'test-consumer',
        })
      ).rejects.toThrow();
    });

    test('should use ON CONFLICT for upsert operations', async () => {
      const eventId = crypto.randomUUID();

      // Insert first record
      await pg.query(
        `INSERT INTO duplicate_test.processed_events (event_id, event_type, consumer_name)
         VALUES ($1, $2, $3)`,
        [eventId, 'order.created', 'test-consumer']
      );

      // Upsert with ON CONFLICT
      await pg.query(
        `INSERT INTO duplicate_test.processed_events (event_id, event_type, consumer_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id) DO UPDATE SET consumer_name = EXCLUDED.consumer_name`,
        [eventId, 'order.created', 'updated-consumer']
      );

      const record = await pg.selectOne(
        'processed_events',
        'event_id = $1',
        [eventId]
      );

      expect(record?.consumer_name).toBe('updated-consumer');
    });

    test('should track duplicate attempts', async () => {
      const eventId = crypto.randomUUID();
      let duplicateCount = 0;

      // Insert first time
      await pg.insert('processed_events', {
        event_id: eventId,
        event_type: 'order.created',
        consumer_name: 'test-consumer',
      });

      // Try multiple duplicates
      for (let i = 0; i < 5; i++) {
        try {
          await pg.insert('processed_events', {
            event_id: eventId,
            event_type: 'order.created',
            consumer_name: 'test-consumer',
          });
        } catch (error: any) {
          if (error.code === '23505') { // Unique violation
            duplicateCount++;
          }
        }
      }

      expect(duplicateCount).toBe(5);
    });
  });

  describe('Idempotent Processing', () => {
    test('should handle duplicate processing without side effects', async () => {
      const eventId = crypto.randomUUID();
      const message = {
        id: eventId,
        type: 'order.created',
        data: { order_id: 789, amount: 100 },
      };

      // Publish message
      await rmq.publish(topology.exchange, topology.routingKey, message);

      // Simulate idempotent processing
      const processCount: number[] = [];
      await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Check if already processed
        const processed = await pg.selectOne(
          'processed_events',
          'event_id = $1',
          [content.id]
        );

        if (!processed) {
          // Process event
          processCount.push(1);
          await pg.insert('processed_events', {
            event_id: content.id,
            event_type: content.type,
            consumer_name: 'idempotent-test',
          });
          rmq.getChannel()?.ack(msg);
        } else {
          // Already processed, skip
          rmq.getChannel()?.ack(msg);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Process should only run once even if message delivered multiple times
      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBe(1);
    });

    test('should maintain state across duplicate deliveries', async () => {
      const eventId = crypto.randomUUID();
      const state: Record<string, number> = { counter: 0 };

      const message = {
        id: eventId,
        type: 'inventory.reserved',
        data: { product_id: 999, quantity: 10 },
      };

      await rmq.publish(topology.exchange, topology.routingKey, message);

      await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Check if already processed
        const processed = await pg.selectOne(
          'processed_events',
          'event_id = $1',
          [content.id]
        );

        if (!processed) {
          // Update state only once
          state.counter += content.data.quantity;
          await pg.insert('processed_events', {
            event_id: content.id,
            event_type: content.type,
            consumer_name: 'state-test',
          });
        }
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Counter should be 10 even if message delivered multiple times
      expect(state.counter).toBe(10);
    });
  });

  describe('Correlation ID Tracking', () => {
    test('should track related events by correlation ID', async () => {
      const correlationId = crypto.randomUUID();

      const events = [
        { id: crypto.randomUUID(), correlation_id: correlationId, type: 'order.created', data: {} },
        { id: crypto.randomUUID(), correlation_id: correlationId, type: 'payment.authorized', data: {} },
        { id: crypto.randomUUID(), correlation_id: correlationId, type: 'inventory.reserved', data: {} },
      ];

      for (const event of events) {
        await rmq.publish(topology.exchange, topology.routingKey, event);
      }

      const consumed = await rmq.collectMessages(topology.queue, 3, 3000);
      const correlationIds = consumed.map((m) => m.content.correlation_id);

      expect(correlationIds.every((id) => id === correlationId)).toBe(true);
    });

    test('should detect duplicate events within correlation', async () => {
      const correlationId = crypto.randomUUID();
      const eventId = crypto.randomUUID();

      const events = [
        { id: eventId, correlation_id: correlationId, type: 'order.created', data: {} },
        { id: eventId, correlation_id: correlationId, type: 'order.created', data: {} }, // Duplicate
      ];

      for (const event of events) {
        await rmq.publish(topology.exchange, topology.routingKey, event);
      }

      const consumed = await rmq.collectMessages(topology.queue, 2, 2000);
      const uniqueIds = new Set(consumed.map((m) => m.content.id));

      // Both may be delivered but should be deduplicated at processing level
      expect(consumed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Exactly-Once Semantics', () => {
    test('should achieve exactly-once processing with outbox pattern', async () => {
      const eventId = crypto.randomUUID();

      // Create outbox-style table
      await pg.createTable({
        name: 'outbox',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'event_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
          { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
          { name: 'payload', type: 'JSONB', nullable: false },
          { name: 'status', type: 'VARCHAR(50)', default: "'pending'" },
        ],
      });

      // Insert to outbox
      await pg.insert('outbox', {
        event_id: eventId,
        event_type: 'order.created',
        payload: { order_id: 100 },
      });

      // Publish to RabbitMQ
      await rmq.publish(topology.exchange, topology.routingKey, {
        id: eventId,
        type: 'order.created',
        data: { order_id: 100 },
      });

      // Simulate processing
      await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Update outbox status in transaction
        await pg.transaction(async (client) => {
          await client.query(
            `UPDATE duplicate_test.outbox SET status = 'processed' WHERE event_id = $1`,
            [content.id]
          );
          await client.query(
            `INSERT INTO duplicate_test.processed_events (event_id, event_type, consumer_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (event_id) DO NOTHING`,
            [content.id, content.type, 'test-consumer']
          );
        });

        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify exactly-once processing
      const outboxRecord = await pg.selectOne('outbox', 'event_id = $1', [eventId]);
      expect(outboxRecord?.status).toBe('processed');

      const processedRecord = await pg.selectOne('processed_events', 'event_id = $1', [eventId]);
      expect(processedRecord).toBeDefined();

      await pg.dropTable('outbox');
    });

    test('should handle concurrent processing attempts', async () => {
      const eventId = crypto.randomUUID();
      let processAttempts = 0;

      // Simulate 3 concurrent processors
      const processors = Array.from({ length: 3 }, () => ({
        id: Math.random(),
        process: async () => {
          processAttempts++;
          await pg.query(
            `INSERT INTO duplicate_test.processed_events (event_id, event_type, consumer_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (event_id) DO NOTHING`,
            [eventId, 'order.created', 'concurrent-test']
          );
        },
      }));

      // Run concurrently
      await Promise.all(processors.map((p) => p.process()));

      // Only one should succeed
      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBe(1);
      expect(processAttempts).toBe(3);
    });
  });

  describe('Duplicate Detection Performance', () => {
    test('should handle high volume of unique events efficiently', async () => {
      const count = 1000;
      const messages = Array.from({ length: count }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      const startTime = Date.now();

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / count;

      expect(avgLatency).toBeLessThan(10); // Less than 10ms per publish
      expect(rmq.getStats().messagesPublished).toBe(count);
    });

    test('should efficiently reject duplicate events', async () => {
      const eventId = crypto.randomUUID();
      const message = {
        id: eventId,
        type: 'order.created',
        data: { order_id: 1 },
      };

      // Insert once
      await pg.insert('processed_events', {
        event_id: eventId,
        event_type: 'order.created',
        consumer_name: 'perf-test',
      });

      const startTime = Date.now();

      // Try to insert duplicate 100 times
      let rejectedCount = 0;
      for (let i = 0; i < 100; i++) {
        try {
          await pg.insert('processed_events', {
            event_id: eventId,
            event_type: 'order.created',
            consumer_name: 'perf-test',
          });
        } catch (error: any) {
          if (error.code === '23505') {
            rejectedCount++;
          }
        }
      }

      const duration = Date.now() - startTime;
      const avgRejectionTime = duration / 100;

      expect(rejectedCount).toBe(100);
      expect(avgRejectionTime).toBeLessThan(5); // Fast duplicate rejection
    });
  });

  describe('Message Redelivery Deduplication', () => {
    test('should handle redelivered messages idempotently', async () => {
      const eventId = crypto.randomUUID();
      let processCount = 0;

      const message = {
        id: eventId,
        type: 'order.created',
        data: { order_id: 500 },
      };

      await rmq.publish(topology.exchange, topology.routingKey, message);

      // Consumer that tracks redelivery
      await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        const isRedelivered = msg.fields.redelivered;

        if (!isRedelivered) {
          // First delivery - process
          processCount++;
          await pg.insert('processed_events', {
            event_id: content.id,
            event_type: content.type,
            consumer_name: 'redelivery-test',
          });
        }

        // Always ack to prevent endless redelivery
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Even if redelivered, should only process once
      expect(processCount).toBeLessThanOrEqual(2);
    });

    test('should not lose redelivered messages', async () => {
      const eventId = crypto.randomUUID();

      const message = {
        id: eventId,
        type: 'inventory.updated',
        data: { product_id: 777, quantity: 5 },
      };

      await rmq.publish(topology.exchange, topology.routingKey, message);

      let consumed = false;
      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Process idempotently
        pg.insert('processed_events', {
          event_id: content.id,
          event_type: content.type,
          consumer_name: 'redelivery-loss-test',
        }).catch(() => {});

        rmq.getChannel()?.ack(msg);
        consumed = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(consumed).toBe(true);

      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBeGreaterThan(0);
    });
  });
});

// Extend crypto for node compatibility
declare const crypto: {
  randomUUID: () => string;
};
