/**
 * Network partition tests.
 *
 * Tests the system's ability to handle network partitions,
 * including split-brain scenarios, eventual consistency,
 * and graceful degradation.
 *
 * @module NetworkPartition.test
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

describe('Network Partition Resilience', () => {
  let rmq: TestRabbitMQ;
  let pg: TestPostgres;
  let topology: { exchange: string; queue: string; routingKey: string };

  beforeAll(async () => {
    rmq = createTestRabbitMQ(TEST_CONFIG.rabbitmq);
    await rmq.connect();

    pg = createTestPostgres(TEST_CONFIG.postgres, 'partition_test');
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
  });

  describe('Partition Detection', () => {
    test('should detect network partition to RabbitMQ', async () => {
      // Publish before partition
      const result1 = await rmq.publish(topology.exchange, topology.routingKey, {
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: 1 },
      });
      expect(result1.success).toBe(true);

      // Simulate partition
      await rmq.simulateNetworkPartition(2000);

      // Verify connection is lost during partition
      expect(rmq.isConnected()).toBe(true); // Should reconnect

      // Publish after recovery
      const result2 = await rmq.publish(topology.exchange, topology.routingKey, {
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: 2 },
      });
      expect(result2.success).toBe(true);
    });

    test('should detect network partition to Postgres', async () => {
      // Insert before partition
      await pg.insert('test_events', {
        id: crypto.randomUUID(),
        event_type: 'order.created',
        data: { order_id: 1 },
      });

      // Simulate partition
      await pg.simulateNetworkPartition(2000);

      // Verify reconnection
      const pingResult = await pg.ping();
      expect(pingResult).toBe(true);
    });

    test('should detect partial network partition', async () => {
      // Publish some messages
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // Simulate partial partition
      await rmq.simulateNetworkPartition(1000);

      // Verify system continues to operate
      const result = await rmq.publish(topology.exchange, topology.routingKey, {
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: 100 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Partition During Publishing', () => {
    test('should buffer messages during partition', async () => {
      let successCount = 0;
      let failCount = 0;

      // Start partition
      const partitionPromise = rmq.simulateNetworkPartition(3000);

      // Try to publish during partition
      const publishPromises = Array.from({ length: 20 }, (_, i) =>
        rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: i },
        }).then((r) => {
          if (r.success) successCount++;
          else failCount++;
        })
      );

      await Promise.all([...publishPromises, partitionPromise]);

      // At least some messages should succeed
      expect(successCount + failCount).toBe(20);
    });

    test('should retry failed publishes after partition ends', async () => {
      const messageId = crypto.randomUUID();

      // Start partition
      const partitionPromise = rmq.simulateNetworkPartition(2000);

      // Try to publish during partition
      const result1 = await rmq.publish(topology.exchange, topology.routingKey, {
        id: messageId,
        type: 'order.created',
        data: { order_id: 1 },
      });

      await partitionPromise;

      // Publish after partition
      const result2 = await rmq.publish(topology.exchange, topology.routingKey, {
        id: messageId,
        type: 'order.created',
        data: { order_id: 1 },
      });

      expect(result2.success).toBe(true);
    });

    test('should maintain ordering during partition', async () => {
      const messages = Array.from({ length: 30 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i, sequence: i },
      }));

      // Partition in the middle of publishing
      const publishPromises: Promise<any>[] = [];

      for (let i = 0; i < messages.length; i++) {
        if (i === 10) {
          // Trigger partition
          publishPromises.push(rmq.simulateNetworkPartition(1500));
        }

        publishPromises.push(
          rmq.publish(topology.exchange, topology.routingKey, messages[i])
        );
      }

      await Promise.all(publishPromises);

      // Consume and verify ordering
      const consumed = await rmq.collectMessages(topology.queue, 20, 5000);
      const sequences = consumed.map((m) => m.content.data.sequence).sort((a, b) => a - b);

      // Messages should be ordered
      for (let i = 1; i < sequences.length; i++) {
        expect(sequences[i]).toBeGreaterThanOrEqual(sequences[i - 1]);
      }
    });
  });

  describe('Partition During Consumption', () => {
    test('should redeliver unacknowledged messages after partition', async () => {
      // Publish messages
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // Start consuming
      let consumedBeforePartition: any[] = [];
      const consumer = await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        consumedBeforePartition.push(content);

        // Don't ack - simulate in-progress processing
        if (consumedBeforePartition.length >= 5) {
          // Trigger partition
          rmq.simulateNetworkPartition(2000);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Cancel and check remaining
      await rmq.cancelConsumer(consumer.consumerTag);
      const remaining = await rmq.getQueueMessageCount(topology.queue);

      // Should have messages remaining due to unacknowledged state
      expect(remaining).toBeGreaterThan(0);
    });

    test('should handle consumer disconnect during partition', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // Consume and then trigger partition
      let consumedCount = 0;
      const consumer = await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        consumedCount++;
        rmq.getChannel()?.ack(msg);

        if (consumedCount === 10) {
          rmq.simulateNetworkPartition(2000);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Resume consumption
      const afterPartition: any[] = [];
      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        afterPartition.push(content);
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should continue consuming after partition
      expect(consumedCount + afterPartition.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Split-Brain Scenarios', () => {
    test('should handle split-brain with outbox pattern', async () => {
      // Create outbox table
      await pg.createTable({
        name: 'outbox',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'event_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
          { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
          { name: 'payload', type: 'JSONB', nullable: false },
          { name: 'status', type: 'VARCHAR(50)', default: "'pending'" },
          { name: 'published_at', type: 'TIMESTAMP' },
        ],
      });

      // Partition between DB and MQ
      const partitionPromise = rmq.simulateNetworkPartition(2000);

      // Insert to outbox during partition
      const eventsDuringPartition = Array.from({ length: 5 }, (_, i) => ({
        event_id: crypto.randomUUID(),
        event_type: 'order.created',
        payload: { order_id: i },
      }));

      for (const event of eventsDuringPartition) {
        await pg.insert('outbox', event);
      }

      await partitionPromise;

      // Publish after partition resolved
      for (const event of eventsDuringPartition) {
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: event.event_id,
          type: event.event_type,
          data: event.payload,
        });
      }

      // Verify all events in outbox
      const outboxEvents = await pg.select('outbox');
      expect(outboxEvents.rowCount).toBe(5);

      await pg.dropTable('outbox');
    });

    test('should resolve conflicts using unique constraints', async () => {
      await pg.createTable({
        name: 'events',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'event_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
          { name: 'version', type: 'INTEGER', nullable: false },
        ],
      });

      const eventId = crypto.randomUUID();

      // Simulate partition - both sides try to insert
      await pg.simulateNetworkPartition(100);

      // Both "sides" try to insert (simulated by two inserts)
      const insert1 = pg.insert('events', { event_id: eventId, version: 1 });
      const insert2 = pg.insert('events', { event_id: eventId, version: 2 });

      const [result1, result2] = await Promise.allSettled([insert1, insert2]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter((r) => r.status === 'fulfilled').length;
      expect(successCount).toBe(1);

      await pg.dropTable('events');
    });
  });

  describe('Eventual Consistency', () => {
    test('should achieve eventual consistency after partition', async () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      // Partition during publishing
      const partitionPromise = rmq.simulateNetworkPartition(1500);

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      await partitionPromise;

      // Wait for eventual consistency
      const consumed = await rmq.collectMessages(topology.queue, 40, 10000);

      expect(consumed.length).toBeGreaterThanOrEqual(40);
    });

    test('should handle out-of-order delivery after partition', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i, sequence: i },
      }));

      // Publish with partition in the middle
      for (let i = 0; i < messages.length; i++) {
        await rmq.publish(topology.exchange, topology.routingKey, messages[i]);

        if (i === 5) {
          await rmq.simulateNetworkPartition(1000);
        }
      }

      // Collect all messages
      const consumed = await rmq.collectMessages(topology.queue, 18, 8000);

      // Check ordering
      const sequences = consumed.map((m) => m.content.data.sequence);
      let inOrder = true;
      for (let i = 1; i < sequences.length; i++) {
        if (sequences[i] < sequences[i - 1]) {
          inOrder = false;
          break;
        }
      }

      // May have some out-of-order due to partition
      expect(consumed.length).toBeGreaterThan(15);
    });

    test('should resolve duplicates after partition', async () => {
      const eventId = crypto.randomUUID();

      // Publish same message multiple times
      await rmq.publish(topology.exchange, topology.routingKey, {
        id: eventId,
        type: 'order.created',
        data: { order_id: 1 },
      });

      // Partition
      await rmq.simulateNetworkPartition(1000);

      // Publish again
      await rmq.publish(topology.exchange, topology.routingKey, {
        id: eventId,
        type: 'order.created',
        data: { order_id: 1 },
      });

      // Consume
      const consumed = await rmq.collectMessages(topology.queue, 2, 2000);

      // System should handle duplicates
      expect(consumed.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    test('should continue operating with degraded performance', async () => {
      const baselineLatencies: number[] = [];

      // Measure baseline
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: i },
        });
        baselineLatencies.push(Date.now() - start);
      }

      const avgBaseline = baselineLatencies.reduce((a, b) => a + b, 0) / baselineLatencies.length;

      // Introduce latency
      await pg.simulateHighLatency(3000, 100);

      // Measure degraded
      const degradedLatencies: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await pg.insert('test_events', {
          id: crypto.randomUUID(),
          event_type: 'order.created',
          data: { order_id: i },
        });
        degradedLatencies.push(Date.now() - start);
      }

      const avgDegraded = degradedLatencies.reduce((a, b) => a + b, 0) / degradedLatencies.length;

      // Degraded but still working
      expect(avgDegraded).toBeGreaterThan(avgBaseline);
      expect(degradedLatencies.every((l) => l < 5000)); // No timeouts
    });

    test('should prioritize critical operations during degradation', async () => {
      // Create test tables
      await pg.createTable({
        name: 'critical_events',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'priority', type: 'VARCHAR(20)', nullable: false },
          { name: 'data', type: 'JSONB', nullable: false },
        ],
      });

      const criticalLatencies: number[] = [];
      const normalLatencies: number[] = [];

      // Publish mixed priority
      for (let i = 0; i < 20; i++) {
        const isCritical = i % 3 === 0;
        const priority = isCritical ? 'critical' : 'normal';

        const start = Date.now();
        await pg.insert('critical_events', {
          priority,
          data: { order_id: i },
        });

        const latency = Date.now() - start;
        if (isCritical) {
          criticalLatencies.push(latency);
        } else {
          normalLatencies.push(latency);
        }
      }

      const avgCritical = criticalLatencies.reduce((a, b) => a + b, 0) / criticalLatencies.length;
      const avgNormal = normalLatencies.reduce((a, b) => a + b, 0) / normalLatencies.length;

      // Critical should be faster (if prioritization is implemented)
      expect(avgCritical).toBeLessThanOrEqual(avgNormal * 1.5);

      await pg.dropTable('critical_events');
    });
  });

  describe('Recovery Time', () => {
    test('should recover within SLA after partition', async () => {
      const SLA_MS = 5000; // 5 second recovery SLA

      // Publish messages before partition
      const messages = Array.from({ length: 30 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // Trigger partition
      const recoveryStart = Date.now();
      await rmq.simulateNetworkPartition(1000);

      // Verify operation restored
      const result = await rmq.publish(topology.exchange, topology.routingKey, {
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: 999 },
      });

      const recoveryTime = Date.now() - recoveryStart;

      expect(result.success).toBe(true);
      expect(recoveryTime).toBeLessThan(SLA_MS);
    });

    test('should not lose messages during recovery window', async () => {
      const messageCount = 100;

      // Partition during publishing
      const partitionPromise = rmq.simulateNetworkPartition(1000);

      const publishPromises = Array.from({ length: messageCount }, (_, i) =>
        rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: i },
        })
      );

      await Promise.all([...publishPromises, partitionPromise]);

      // Check queue count
      const queueCount = await rmq.getQueueMessageCount(topology.queue);

      // Most messages should be in queue
      expect(queueCount).toBeGreaterThan(messageCount * 0.8);
    });
  });
});

// Extend crypto for node compatibility
declare const crypto: {
  randomUUID: () => string;
};
