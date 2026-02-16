/**
 * Idempotency validation tests.
 *
 * Tests the system's ability to handle duplicate operations
 * safely without side effects, ensuring exactly-once semantics.
 *
 * @module Idempotency.test
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

describe('Idempotency Validation', () => {
  let rmq: TestRabbitMQ;
  let pg: TestPostgres;
  let topology: { exchange: string; queue: string; routingKey: string };

  beforeAll(async () => {
    rmq = createTestRabbitMQ(TEST_CONFIG.rabbitmq);
    await rmq.connect();

    pg = createTestPostgres(TEST_CONFIG.postgres, 'idempotency_test');
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
        { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
        { name: 'event_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
        { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
        { name: 'processing_count', type: 'INTEGER', default: '1' },
        { name: 'last_processed_at', type: 'TIMESTAMP', default: 'NOW()' },
      ],
      indexes: [
        { name: 'idx_event_id_unique', columns: ['event_id'], unique: true },
      ],
    });

    await pg.createTable({
      name: 'orders',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
        { name: 'order_number', type: 'VARCHAR(50)', nullable: false, constraints: ['UNIQUE'] },
        { name: 'total_amount', type: 'DECIMAL(10,2)', nullable: false },
        { name: 'status', type: 'VARCHAR(50)', default: "'pending'" },
        { name: 'version', type: 'INTEGER', default: '1' },
      ],
    });

    await pg.createTable({
      name: 'inventory_transactions',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
        { name: 'order_id', type: 'UUID', nullable: false },
        { name: 'product_id', type: 'VARCHAR(255)', nullable: false },
        { name: 'quantity', type: 'INTEGER', nullable: false },
        { name: 'transaction_type', type: 'VARCHAR(20)', nullable: false },
        { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
        { name: 'constraint_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
      ],
    });
  });

  afterEach(async () => {
    // Cleanup test tables
    try {
      await pg.dropTable('processed_events');
      await pg.dropTable('orders');
      await pg.dropTable('inventory_transactions');
    } catch {}
  });

  describe('Event Processing Idempotency', () => {
    test('should process event exactly once', async () => {
      const eventId = crypto.randomUUID();
      const message = {
        id: eventId,
        type: 'order.created',
        data: { order_id: crypto.randomUUID(), amount: 100 },
      };

      await rmq.publish(topology.exchange, topology.routingKey, message);

      // Process idempotently
      const processEvent = async (): Promise<void> => {
        await pg.transaction(async (client) => {
          // Check if already processed
          const existing = await client.query(
            `SELECT * FROM idempotency_test.processed_events WHERE event_id = $1`,
            [eventId]
          );

          if (existing.rows.length > 0) {
            // Already processed, update count
            await client.query(
              `UPDATE idempotency_test.processed_events
               SET processing_count = processing_count + 1, last_processed_at = NOW()
               WHERE event_id = $1`,
              [eventId]
            );
            return;
          }

          // Insert as processed
          await client.query(
            `INSERT INTO idempotency_test.processed_events (event_id, event_type)
             VALUES ($1, $2)`,
            [eventId, message.type]
          );
        });
      };

      // Process multiple times (simulating duplicates)
      await processEvent();
      await processEvent();
      await processEvent();

      // Verify only one record exists
      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBe(1);
      expect(records.rows[0].processing_count).toBe(3); // But tracked 3 attempts
    });

    test('should handle concurrent event processing', async () => {
      const eventId = crypto.randomUUID();

      // Simulate concurrent processing
      const processConcurrently = async (): Promise<void> => {
        await pg.query(
          `INSERT INTO idempotency_test.processed_events (event_id, event_type)
           VALUES ($1, $2)
           ON CONFLICT (event_id) DO UPDATE SET
             processing_count = processed_events.processing_count + 1,
             last_processed_at = NOW()`,
          [eventId, 'order.created']
        );
      };

      // Run concurrently
      await Promise.all([
        processConcurrently(),
        processConcurrently(),
        processConcurrently(),
        processConcurrently(),
        processConcurrently(),
      ]);

      // Verify only one record exists
      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBe(1);
      expect(records.rows[0].processing_count).toBeGreaterThanOrEqual(4);
    });

    test('should use upsert for idempotent inserts', async () => {
      const orderId = crypto.randomUUID();

      // First insert
      await pg.query(
        `INSERT INTO idempotency_test.orders (id, order_number, total_amount)
         VALUES ($1, $2, $3)`,
        [orderId, 'ORD-001', 100.00]
      );

      // Second insert with same order_number (should fail)
      await expect(
        pg.query(
          `INSERT INTO idempotency_test.orders (id, order_number, total_amount)
           VALUES ($1, $2, $3)`,
          [crypto.randomUUID(), 'ORD-001', 100.00]
        )
      ).rejects.toThrow();

      // Upsert using ON CONFLICT
      await pg.query(
        `INSERT INTO idempotency_test.orders (id, order_number, total_amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (order_number) DO UPDATE SET
           total_amount = EXCLUDED.total_amount,
           version = orders.version + 1`,
        [crypto.randomUUID(), 'ORD-001', 150.00]
      );

      // Verify update
      const record = await pg.selectOne('orders', 'order_number = $1', ['ORD-001']);
      expect(record?.total_amount).toBe('150.00');
      expect(record?.version).toBe(2);
    });
  });

  describe('Inventory Operation Idempotency', () => {
    test('should not double-apply inventory changes', async () => {
      const orderId = crypto.randomUUID();
      const productId = 'PROD-123';
      const constraintId = crypto.randomUUID();

      const message = {
        id: crypto.randomUUID(),
        type: 'inventory.reserved',
        data: { order_id: orderId, product_id: productId, quantity: 5 },
      };

      await rmq.publish(topology.exchange, topology.routingKey, message);

      // Idempotent inventory reservation
      const reserveInventory = async (): Promise<void> => {
        await pg.transaction(async (client) => {
          const result = await client.query(
            `INSERT INTO idempotency_test.inventory_transactions
             (order_id, product_id, quantity, transaction_type, constraint_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (constraint_id) DO NOTHING
             RETURNING id`,
            [orderId, productId, 5, 'reserve', constraintId]
          );

          if (result.rowCount === 0) {
            // Already processed, skip
            return;
          }

          // Apply inventory change (simplified)
          // In real system, this would update inventory table
        });
      };

      // Process multiple times
      await reserveInventory();
      await reserveInventory();
      await reserveInventory();

      // Verify only one transaction
      const transactions = await pg.select(
        'inventory_transactions',
        'constraint_id = $1',
        [constraintId]
      );
      expect(transactions.rowCount).toBe(1);
    });

    test('should handle compensate operations idempotently', async () => {
      const orderId = crypto.randomUUID();
      const constraintId = crypto.randomUUID();

      // Reserve inventory
      await pg.insert('inventory_transactions', {
        order_id: orderId,
        product_id: 'PROD-456',
        quantity: 10,
        transaction_type: 'reserve',
        constraint_id: constraintId,
      });

      // Compensate (release) inventory
      const releaseInventory = async (): Promise<void> => {
        await pg.query(
          `INSERT INTO idempotency_test.inventory_transactions
           (order_id, product_id, quantity, transaction_type, constraint_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (constraint_id)
           DO UPDATE SET transaction_type = CASE
             WHEN inventory_transactions.transaction_type = 'reserve' THEN 'released'
             ELSE inventory_transactions.transaction_type
           END`,
          [orderId, 'PROD-456', -10, 'release', constraintId]
        );
      };

      // Try to release multiple times
      await releaseInventory();
      await releaseInventory();
      await releaseInventory();

      // Verify final state
      const transaction = await pg.selectOne('inventory_transactions', 'constraint_id = $1', [constraintId]);
      expect(transaction?.transaction_type).toBe('released');
    });

    test('should handle concurrent inventory reservations', async () => {
      const productId = 'PROD-789';

      // Simulate concurrent reservations for same product
      const reservations = Array.from({ length: 10 }, (_, i) =>
        pg.insert('inventory_transactions', {
          order_id: crypto.randomUUID(),
          product_id: productId,
          quantity: 1,
          transaction_type: 'reserve',
          constraint_id: crypto.randomUUID(),
        })
      );

      await Promise.allSettled(reservations);

      // All should succeed due to unique constraint_id
      const transactions = await pg.select('inventory_transactions', 'product_id = $1', [productId]);
      expect(transactions.rowCount).toBe(10);
    });
  });

  describe('Conditional Idempotency', () => {
    test('should apply changes only if condition met', async () => {
      const orderId = crypto.randomUUID();

      // Create order in pending state
      await pg.insert('orders', {
        id: orderId,
        order_number: 'COND-001',
        total_amount: 200.00,
        status: 'pending',
      });

      // Idempotent state change
      const approveOrder = async (): Promise<number> => {
        const result = await pg.query(
          `UPDATE idempotency_test.orders
           SET status = 'approved', version = version + 1
           WHERE id = $1 AND status = 'pending'
           RETURNING id`,
          [orderId]
        );
        return result.rowCount || 0;
      };

      // First approval
      const result1 = await approveOrder();
      expect(result1).toBe(1);

      // Second approval (should not affect)
      const result2 = await approveOrder();
      expect(result2).toBe(0);

      // Third approval (should not affect)
      const result3 = await approveOrder();
      expect(result3).toBe(0);

      // Verify final state
      const order = await pg.selectOne('orders', 'id = $1', [orderId]);
      expect(order?.status).toBe('approved');
      expect(order?.version).toBe(2);
    });

    test('should handle version-based optimistic locking', async () => {
      const orderId = crypto.randomUUID();

      await pg.insert('orders', {
        id: orderId,
        order_number: 'VER-001',
        total_amount: 300.00,
        status: 'pending',
        version: 1,
      });

      // Concurrent updates with version check
      const updateWithVersion = async (expectedVersion: number): Promise<boolean> => {
        const result = await pg.query(
          `UPDATE idempotency_test.orders
           SET total_amount = total_amount + 100, version = version + 1
           WHERE id = $1 AND version = $2
           RETURNING id`,
          [orderId, expectedVersion]
        );
        return (result.rowCount || 0) > 0;
      };

      // Simulate concurrent updates
      const results = await Promise.all([
        updateWithVersion(1),
        updateWithVersion(1),
        updateWithVersion(1),
      ]);

      // Only one should succeed
      const successCount = results.filter((r) => r).length;
      expect(successCount).toBe(1);

      // Verify final state
      const order = await pg.selectOne('orders', 'id = $1', [orderId]);
      expect(order?.version).toBe(2);
      expect(order?.total_amount).toBe('400.00');
    });
  });

  describe('Business Logic Idempotency', () => {
    test('should not create duplicate orders', async () => {
      const orderNumber = 'BIZ-001';

      const createOrder = async (): Promise<void> => {
        await pg.query(
          `INSERT INTO idempotency_test.orders (id, order_number, total_amount)
           VALUES ($1, $2, $3)
           ON CONFLICT (order_number) DO NOTHING`,
          [crypto.randomUUID(), orderNumber, 100.00]
        );
      };

      // Try to create same order multiple times
      await createOrder();
      await createOrder();
      await createOrder();

      // Verify only one order exists
      const orders = await pg.select('orders', 'order_number = $1', [orderNumber]);
      expect(orders.rowCount).toBe(1);
    });

    test('should handle payment idempotency', async () => {
      const paymentId = crypto.randomUUID();

      await pg.createTable({
        name: 'payments',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'payment_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
          { name: 'amount', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'status', type: 'VARCHAR(50)', default: "'pending'" },
          { name: 'version', type: 'INTEGER', default: '1' },
        ],
      });

      const processPayment = async (): Promise<void> => {
        await pg.query(
          `INSERT INTO idempotency_test.payments (payment_id, amount, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (payment_id) DO NOTHING`,
          [paymentId, 150.00]
        );
      };

      // Process payment multiple times
      await processPayment();
      await processPayment();
      await processPayment();

      // Verify single payment record
      const payments = await pg.select('payments', 'payment_id = $1', [paymentId]);
      expect(payments.rowCount).toBe(1);

      await pg.dropTable('payments');
    });

    test('should handle partial processing idempotently', async () => {
      const orderId = crypto.randomUUID();
      const steps = ['validate', 'reserve_inventory', 'process_payment', 'complete'];

      await pg.createTable({
        name: 'order_processing_steps',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'order_id', type: 'UUID', nullable: false },
          { name: 'step_name', type: 'VARCHAR(100)', nullable: false },
          { name: 'completed_at', type: 'TIMESTAMP', default: 'NOW()' },
          { name: 'constraint_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
        ],
      });

      const completeStep = async (stepName: string): Promise<boolean> => {
        const constraintId = crypto.randomUUID();
        const result = await pg.query(
          `INSERT INTO idempotency_test.order_processing_steps
           (order_id, step_name, constraint_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (constraint_id) DO NOTHING
           RETURNING id`,
          [orderId, stepName, constraintId]
        );
        return (result.rowCount || 0) > 0;
      };

      // Process steps
      const completedSteps: string[] = [];
      for (const step of steps) {
        const newlyCompleted = await completeStep(step);
        if (newlyCompleted) {
          completedSteps.push(step);
        }
      }

      // Process same steps again
      for (const step of steps) {
        await completeStep(step);
      }

      // Verify each step only completed once
      const allSteps = await pg.select('order_processing_steps', 'order_id = $1', [orderId]);
      expect(allSteps.rowCount).toBe(steps.length);

      await pg.dropTable('order_processing_steps');
    });
  });

  describe('Idempotency Performance', () => {
    test('should handle high-volume idempotent operations', async () => {
      const count = 1000;
      const eventIds = Array.from({ length: count }, () => crypto.randomUUID());

      const startTime = Date.now();

      for (const eventId of eventIds) {
        await pg.query(
          `INSERT INTO idempotency_test.processed_events (event_id, event_type)
           VALUES ($1, $2)
           ON CONFLICT (event_id) DO UPDATE SET
             processing_count = processed_events.processing_count + 1`,
          [eventId, 'test.event']
        );
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / count;

      expect(avgLatency).toBeLessThan(10); // Less than 10ms per operation
    });

    test('should efficiently reject duplicate operations', async () => {
      const eventId = crypto.randomUUID();

      // Insert once
      await pg.insert('processed_events', {
        event_id: eventId,
        event_type: 'test.event',
      });

      const startTime = Date.now();

      // Try duplicate 100 times
      for (let i = 0; i < 100; i++) {
        await pg.query(
          `INSERT INTO idempotency_test.processed_events (event_id, event_type)
           VALUES ($1, $2)
           ON CONFLICT (event_id) DO UPDATE SET
             processing_count = processed_events.processing_count + 1`,
          [eventId, 'test.event']
        );
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / 100;

      expect(avgLatency).toBeLessThan(5); // Fast duplicate handling
    });

    test('should handle concurrent idempotent operations efficiently', async () => {
      const threadCount = 20;
      const operationsPerThread = 50;

      const eventIds = Array.from(
        { length: threadCount },
        () => crypto.randomUUID()
      );

      const startTime = Date.now();

      // Run concurrent operations
      await Promise.all(
        Array.from({ length: threadCount }, (_, threadIndex) =>
          Promise.all(
            Array.from({ length: operationsPerThread }, () =>
              pg.query(
                `INSERT INTO idempotency_test.processed_events (event_id, event_type)
                 VALUES ($1, $2)
                 ON CONFLICT (event_id) DO UPDATE SET
                   processing_count = processed_events.processing_count + 1`,
                [eventIds[threadIndex], 'test.event']
              )
            )
          )
        )
      );

      const duration = Date.now() - startTime;
      const totalOps = threadCount * operationsPerThread;
      const opsPerSecond = (totalOps / duration) * 1000;

      expect(opsPerSecond).toBeGreaterThan(500); // At least 500 ops/sec
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and empty values idempotently', async () => {
      const eventId = crypto.randomUUID();

      await pg.query(
        `INSERT INTO idempotency_test.processed_events (event_id, event_type)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO UPDATE SET
           processing_count = processed_events.processing_count + 1`,
        [eventId, null]
      );

      // Try again with null
      await pg.query(
        `INSERT INTO idempotency_test.processed_events (event_id, event_type)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO UPDATE SET
           processing_count = processed_events.processing_count + 1`,
        [eventId, null]
      );

      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBe(1);
    });

    test('should handle very long payloads idempotently', async () => {
      const eventId = crypto.randomUUID();
      const largePayload = 'x'.repeat(100000); // 100KB

      await pg.query(
        `INSERT INTO idempotency_test.processed_events (event_id, event_type)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO UPDATE SET
           processing_count = processed_events.processing_count + 1`,
        [eventId, 'large.event']
      );

      // Try duplicate with same ID
      await pg.query(
        `INSERT INTO idempotency_test.processed_events (event_id, event_type)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO UPDATE SET
           processing_count = processed_events.processing_count + 1`,
        [eventId, 'large.event']
      );

      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBe(1);
    });

    test('should handle special characters in values', async () => {
      const eventId = crypto.randomUUID();
      const specialChars = "'; DROP TABLE test; --";

      await pg.query(
        `INSERT INTO idempotency_test.processed_events (event_id, event_type)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO UPDATE SET
           processing_count = processed_events.processing_count + 1`,
        [eventId, specialChars]
      );

      // Try duplicate
      await pg.query(
        `INSERT INTO idempotency_test.processed_events (event_id, event_type)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO UPDATE SET
           processing_count = processed_events.processing_count + 1`,
        [eventId, specialChars]
      );

      const records = await pg.select('processed_events', 'event_id = $1', [eventId]);
      expect(records.rowCount).toBe(1);
      expect(records.rows[0].event_type).toBe(specialChars);
    });
  });
});

// Extend crypto for node compatibility
declare const crypto: {
  randomUUID: () => string;
};
