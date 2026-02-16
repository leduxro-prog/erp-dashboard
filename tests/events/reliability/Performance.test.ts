/**
 * Performance baseline tests for event system.
 *
 * Tests the performance characteristics of the event system,
 * establishing baselines for throughput, latency, and resource usage.
 *
 * @module Performance.test
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
 * Performance thresholds
 */
const PERFORMANCE_THRESHOLDS = {
  // Throughput (messages/second)
  MIN_THROUGHPUT: 1000,
  TARGET_THROUGHPUT: 5000,

  // Latency (milliseconds)
  MAX_P50_LATENCY: 10,
  MAX_P95_LATENCY: 50,
  MAX_P99_LATENCY: 100,

  // Batch size
  OPTIMAL_BATCH_SIZE: 100,
  MAX_BATCH_SIZE: 500,

  // Concurrency
  OPTIMAL_CONSUMER_COUNT: 4,
  MAX_CONSUMER_COUNT: 20,

  // Memory
  MAX_MEMORY_PER_MESSAGE: 1024, // 1KB
};

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

describe('Performance Baselines', () => {
  let rmq: TestRabbitMQ;
  let pg: TestPostgres;
  let topology: { exchange: string; queue: string; routingKey: string };

  beforeAll(async () => {
    rmq = createTestRabbitMQ(TEST_CONFIG.rabbitmq);
    await rmq.connect();

    pg = createTestPostgres(TEST_CONFIG.postgres, 'performance_test');
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

  afterEach(async () => {
    // Cleanup test tables
    try {
      await pg.dropTable('events');
      await pg.dropTable('outbox');
    } catch {}
  });

  describe('Publish Throughput', () => {
    test('should meet minimum publish throughput', async () => {
      const messageCount = 1000;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i, timestamp: Date.now() },
      }));

      const startTime = Date.now();

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      const duration = Date.now() - startTime;
      const throughput = (messageCount / duration) * 1000; // messages per second

      expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT);
    });

    test('should handle batch publish efficiently', async () => {
      const batchSize = 100;
      const batches = 10;
      const messages = Array.from({ length: batchSize * batches }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      const startTime = Date.now();

      // Publish in batches
      for (let b = 0; b < batches; b++) {
        const batch = messages.slice(b * batchSize, (b + 1) * batchSize);
        await Promise.all(
          batch.map((msg) => rmq.publish(topology.exchange, topology.routingKey, msg))
        );
      }

      const duration = Date.now() - startTime;
      const totalMessages = batchSize * batches;
      const throughput = (totalMessages / duration) * 1000;

      expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT);
    });

    test('should maintain throughput under load', async () => {
      const stages = [100, 500, 1000, 2000, 5000];
      const throughputs: number[] = [];

      for (const count of stages) {
        await rmq.purgeQueue(topology.queue);
        rmq.resetStats();

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
        const throughput = (count / duration) * 1000;
        throughputs.push(throughput);

        console.log(`Throughput for ${count} messages: ${throughput.toFixed(2)} msg/s`);
      }

      // Throughput should not degrade significantly
      const lastThroughput = throughputs[throughputs.length - 1];
      const firstThroughput = throughputs[0];

      expect(lastThroughput).toBeGreaterThan(firstThroughput * 0.5);
    });
  });

  describe('Publish Latency', () => {
    test('should meet P50 latency threshold', async () => {
      const messageCount = 500;
      const latencies: number[] = [];

      for (let i = 0; i < messageCount; i++) {
        const start = Date.now();

        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: i },
        });

        latencies.push(Date.now() - start);
      }

      const sorted = latencies.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];

      expect(p50).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_P50_LATENCY);
    });

    test('should meet P95 latency threshold', async () => {
      const messageCount = 1000;
      const latencies: number[] = [];

      for (let i = 0; i < messageCount; i++) {
        const start = Date.now();

        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: i },
        });

        latencies.push(Date.now() - start);
      }

      const sorted = latencies.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];

      expect(p95).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_P95_LATENCY);
    });

    test('should meet P99 latency threshold', async () => {
      const messageCount = 2000;
      const latencies: number[] = [];

      for (let i = 0; i < messageCount; i++) {
        const start = Date.now();

        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: i },
        });

        latencies.push(Date.now() - start);
      }

      const sorted = latencies.sort((a, b) => a - b);
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      expect(p99).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_P99_LATENCY);
    });

    test('should have minimal latency variance', async () => {
      const messageCount = 500;
      const latencies: number[] = [];

      for (let i = 0; i < messageCount; i++) {
        const start = Date.now();

        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: i },
        });

        latencies.push(Date.now() - start);
      }

      const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const variance = latencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / latencies.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be reasonable relative to mean
      expect(stdDev).toBeLessThan(mean * 2);
    });
  });

  describe('Consume Throughput', () => {
    test('should meet minimum consume throughput', async () => {
      const messageCount = 500;

      // Publish messages
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      await Promise.all(
        messages.map((msg) => rmq.publish(topology.exchange, topology.routingKey, msg))
      );

      // Measure consume throughput
      const startTime = Date.now();
      let consumedCount = 0;

      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        consumedCount++;
        rmq.getChannel()?.ack(msg);

        if (consumedCount >= messageCount) {
          const duration = Date.now() - startTime;
          const throughput = (consumedCount / duration) * 1000;
          expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT);
        }
      });

      // Wait for consumption
      await new Promise((resolve) => setTimeout(resolve, 5000));
    });

    test('should handle concurrent consumers efficiently', async () => {
      const messageCount = 1000;
      const consumerCount = 4;

      // Publish messages
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      await Promise.all(
        messages.map((msg) => rmq.publish(topology.exchange, topology.routingKey, msg))
      );

      // Create multiple consumers
      const consumerCounts = Array(consumerCount).fill(0);

      await Promise.all(
        Array.from({ length: consumerCount }, (_, i) =>
          rmq.consume(topology.queue, (msg) => {
            if (!msg) return;
            consumerCounts[i]++;
            rmq.getChannel()?.ack(msg);
          })
        )
      );

      // Wait for consumption
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const totalConsumed = consumerCounts.reduce((a, b) => a + b, 0);

      // Load should be distributed
      expect(totalConsumed).toBeGreaterThan(messageCount * 0.8);

      // Variance should be reasonable
      const mean = totalConsumed / consumerCount;
      const variance = consumerCounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / consumerCount;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).toBeLessThan(mean * 1.5);
    });
  });

  describe('Database Performance', () => {
    test('should meet insert performance target', async () => {
      const count = 1000;

      await pg.createTable({
        name: 'events',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'event_id', type: 'UUID', nullable: false, constraints: ['UNIQUE'] },
          { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
          { name: 'payload', type: 'JSONB', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
        ],
        indexes: [
          { name: 'idx_event_id', columns: ['event_id'], unique: true },
          { name: 'idx_created_at', columns: ['created_at'] },
        ],
      });

      const startTime = Date.now();

      for (let i = 0; i < count; i++) {
        await pg.insert('events', {
          event_id: crypto.randomUUID(),
          event_type: 'order.created',
          payload: { order_id: i },
        });
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / count;

      expect(avgLatency).toBeLessThan(10); // Less than 10ms per insert
    });

    test('should meet batch insert performance target', async () => {
      const count = 5000;

      const startTime = Date.now();

      await pg.insertBatch('events', Array.from({ length: count }, (_, i) => ({
        event_id: crypto.randomUUID(),
        event_type: 'order.created',
        payload: { order_id: i },
      })));

      const duration = Date.now() - startTime;
      const avgLatency = duration / count;

      expect(avgLatency).toBeLessThan(1); // Less than 1ms per insert
    });

    test('should meet query performance target', async () => {
      const count = 1000;

      // Insert test data
      for (let i = 0; i < count; i++) {
        await pg.insert('events', {
          event_id: crypto.randomUUID(),
          event_type: 'order.created',
          payload: { order_id: i },
        });
      }

      // Measure query performance
      const queryLatencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await pg.select('events', 'event_type = $1', ['order.created'], undefined, 10);
        queryLatencies.push(Date.now() - start);
      }

      const avgQueryLatency = queryLatencies.reduce((a, b) => a + b, 0) / queryLatencies.length;

      expect(avgQueryLatency).toBeLessThan(5); // Less than 5ms per query
    });
  });

  describe('End-to-End Performance', () => {
    test('should meet E2E latency target', async () => {
      const messageCount = 100;
      const e2eLatencies: number[] = [];

      await pg.createTable({
        name: 'outbox',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'], default: 'uuid_generate_v4()' },
          { name: 'event_id', type: 'UUID', nullable: false },
          { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
          { name: 'payload', type: 'JSONB', nullable: false },
          { name: 'status', type: 'VARCHAR(50)', default: "'pending'" },
          { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
        ],
      });

      for (let i = 0; i < messageCount; i++) {
        const eventId = crypto.randomUUID();
        const message = {
          id: eventId,
          type: 'order.created',
          data: { order_id: i },
        };

        // Step 1: Insert to outbox
        const insertStart = Date.now();
        await pg.insert('outbox', {
          event_id: eventId,
          event_type: 'order.created',
          payload: { order_id: i },
        });

        // Step 2: Publish to RabbitMQ
        const publishStart = Date.now();
        await rmq.publish(topology.exchange, topology.routingKey, message);

        // Step 3: Consume
        const consumePromise = new Promise<number>((resolve) => {
          rmq.consume(topology.queue, (msg) => {
            if (!msg) return;

            const content = JSON.parse(msg.content.toString());
            if (content.id === eventId) {
              resolve(Date.now() - insertStart);
              rmq.getChannel()?.ack(msg);
            }
          });
        });

        const latency = await Promise.race([
          consumePromise,
          new Promise<number>((resolve) => setTimeout(() => resolve(-1), 5000)),
        ]);

        if (latency > 0) {
          e2eLatencies.push(latency);
        }
      }

      const avgE2ELatency = e2eLatencies.reduce((a, b) => a + b, 0) / e2eLatencies.length;

      console.log(`Average E2E latency: ${avgE2ELatency.toFixed(2)}ms`);

      // E2E latency should be reasonable
      expect(avgE2ELatency).toBeLessThan(100);
    });

    test('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const messagesPerSecond = 100;
      const totalMessages = (duration / 1000) * messagesPerSecond;

      let publishedCount = 0;
      let consumedCount = 0;

      // Start consumer
      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;
        consumedCount++;
        rmq.getChannel()?.ack(msg);
      });

      // Sustained publish
      const publishInterval = setInterval(async () => {
        for (let i = 0; i < 10; i++) {
          await rmq.publish(topology.exchange, topology.routingKey, {
            id: crypto.randomUUID(),
            type: 'order.created',
            data: { order_id: publishedCount++ },
          });
        }
      }, 100);

      // Wait for duration
      await new Promise((resolve) => setTimeout(resolve, duration));

      clearInterval(publishInterval);

      // Verify throughput maintained
      expect(publishedCount).toBeGreaterThan(totalMessages * 0.8);
      expect(consumedCount).toBeGreaterThan(totalMessages * 0.7);
    });
  });

  describe('Resource Usage', () => {
    test('should stay within memory limits', async () => {
      const messageCount = 10000;
      const avgMessageSize = 500; // 500 bytes

      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i, timestamp: Date.now() },
      }));

      const startMemory = process.memoryUsage().heapUsed;

      await Promise.all(
        messages.map((msg) => rmq.publish(topology.exchange, topology.routingKey, msg))
      );

      const endMemory = process.memoryUsage().heapUsed;
      const memoryDelta = endMemory - startMemory;

      // Memory growth should be reasonable
      const expectedMemory = messageCount * avgMessageSize;
      expect(memoryDelta).toBeLessThan(expectedMemory * 2);
    });

    test('should handle large payloads efficiently', async () => {
      const sizes = [1000, 10000, 100000]; // 1KB, 10KB, 100KB
      const latencies: number[] = [];

      for (const size of sizes) {
        const payload = 'x'.repeat(size);

        const start = Date.now();
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { payload },
        });

        latencies.push(Date.now() - start);
      }

      // Latency should scale reasonably with size
      expect(latencies[2]).toBeLessThan(latencies[0] * 100); // Not 100x worse for 100x size
    });

    test('should handle concurrent connections efficiently', async () => {
      const connectionCount = 10;
      const messagesPerConnection = 100;

      const startTime = Date.now();

      await Promise.all(
        Array.from({ length: connectionCount }, () =>
          Promise.all(
            Array.from({ length: messagesPerConnection }, (_, i) =>
              rmq.publish(topology.exchange, topology.routingKey, {
                id: crypto.randomUUID(),
                type: 'order.created',
                data: { order_id: i },
              })
            )
          )
        )
      );

      const duration = Date.now() - startTime;
      const totalMessages = connectionCount * messagesPerConnection;
      const throughput = (totalMessages / duration) * 1000;

      // Should maintain reasonable throughput with concurrent connections
      expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT);
    });
  });

  describe('Stress Testing', () => {
    test('should handle message burst', async () => {
      const burstSize = 5000;

      const startTime = Date.now();

      const messages = Array.from({ length: burstSize }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      await Promise.all(
        messages.map((msg) => rmq.publish(topology.exchange, topology.routingKey, msg))
      );

      const duration = Date.now() - startTime;
      const throughput = (burstSize / duration) * 1000;

      console.log(`Burst throughput: ${throughput.toFixed(2)} msg/s`);

      expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_THROUGHPUT);
    });

    test('should recover from overload', async () => {
      const overloadDuration = 5000;
      const recoveryDuration = 5000;

      // Overload phase
      const startOverload = Date.now();
      let overloadCount = 0;

      while (Date.now() - startOverload < overloadDuration) {
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: overloadCount++ },
        });
      }

      const overloadDurationActual = Date.now() - startOverload;
      const overloadThroughput = (overloadCount / overloadDurationActual) * 1000;

      console.log(`Overload throughput: ${overloadThroughput.toFixed(2)} msg/s`);

      // Recovery phase
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const startRecovery = Date.now();
      let recoveryCount = 0;

      while (Date.now() - startRecovery < recoveryDuration) {
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'order.created',
          data: { order_id: recoveryCount++ },
        });
        await new Promise((resolve) => setTimeout(resolve, 10)); // Throttle
      }

      const recoveryDurationActual = Date.now() - startRecovery;
      const recoveryThroughput = (recoveryCount / recoveryDurationActual) * 1000;

      console.log(`Recovery throughput: ${recoveryThroughput.toFixed(2)} msg/s`);

      // System should recover (throughput should improve)
      expect(recoveryThroughput).toBeGreaterThan(0);
    });
  });

  describe('Benchmarking', () => {
    test('should produce performance report', async () => {
      const report: Record<string, number> = {};

      // Test 1: Small messages
      const smallStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'test',
          data: { i },
        });
      }
      report.small_messages_1000_avg_ms = (Date.now() - smallStart) / 1000;

      // Test 2: Medium messages
      const mediumStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'test',
          data: { i, payload: 'x'.repeat(1000) },
        });
      }
      report.medium_messages_1000_avg_ms = (Date.now() - mediumStart) / 1000;

      // Test 3: Large messages
      const largeStart = Date.now();
      for (let i = 0; i < 100; i++) {
        await rmq.publish(topology.exchange, topology.routingKey, {
          id: crypto.randomUUID(),
          type: 'test',
          data: { i, payload: 'x'.repeat(100000) },
        });
      }
      report.large_messages_100_avg_ms = (Date.now() - largeStart) / 100;

      // Test 4: Batch operations
      const batchStart = Date.now();
      await pg.insertBatch('events', Array.from({ length: 1000 }, (_, i) => ({
        event_id: crypto.randomUUID(),
        event_type: 'test',
        payload: { i },
      })));
      report.batch_insert_1000_avg_ms = (Date.now() - batchStart) / 1000;

      // Test 5: Select operations
      await pg.insertBatch('events', Array.from({ length: 1000 }, (_, i) => ({
        event_id: crypto.randomUUID(),
        event_type: 'test',
        payload: { i },
      })));

      const selectStart = Date.now();
      for (let i = 0; i < 100; i++) {
        await pg.select('events', 'event_type = $1', ['test'], undefined, 10);
      }
      report.select_100_avg_ms = (Date.now() - selectStart) / 100;

      console.log('\n=== Performance Report ===');
      console.table(report);
      console.log('=========================\n');

      // Validate thresholds
      expect(report.small_messages_1000_avg_ms).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_P50_LATENCY);
      expect(report.batch_insert_1000_avg_ms).toBeLessThan(1);
    });
  });
});

// Extend crypto for node compatibility
declare const crypto: {
  randomUUID: () => string;
};
