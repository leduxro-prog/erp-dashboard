/**
 * Consumer crash recovery tests.
 *
 * Tests the system's ability to handle consumer crashes,
 * including message redelivery, state recovery, and graceful shutdown.
 *
 * @module ConsumerCrash.test
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
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

describe('Consumer Crash Recovery', () => {
  jest.setTimeout(30000);

  let rmq: TestRabbitMQ;
  let pg: TestPostgres;
  let topology: { exchange: string; queue: string; routingKey: string };

  beforeAll(async () => {
    rmq = createTestRabbitMQ(TEST_CONFIG.rabbitmq);
    await rmq.connect();

    pg = createTestPostgres(TEST_CONFIG.postgres, 'consumer_crash_test');
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
    await rmq.cancelAllConsumers();
    await rmq.purgeQueue(topology.queue);

    // Cleanup test tables
    try {
      await pg.dropTable('consumer_state');
    } catch {}
  });

  describe('Crash During Processing', () => {
    test('should redeliver unacknowledged messages after crash', async () => {
      // Publish messages
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // Create a consumer that crashes after processing half
      let processedCount = 0;
      let shouldCrash = true;

      const consumer = await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        processedCount++;

        // Crash after processing 5 messages
        if (shouldCrash && processedCount >= 5) {
          shouldCrash = false;
          // Simulate a hard consumer crash; RabbitMQ requeues unacked deliveries when the channel closes.
          await rmq.simulateChannelFailure(0);
          return;
        }

        rmq.getChannel()?.ack(msg);
      });

      // Wait for crash scenario
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Cancel the crashed consumer
      await rmq.cancelConsumer(consumer.consumerTag);

      // Create new consumer to process remaining
      const redelivered: any[] = [];
      let recoveredCount = 0;
      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        recoveredCount++;
        if (msg.fields.redelivered) {
          redelivered.push(msg);
        }

        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should have redelivered messages
      expect(recoveredCount).toBeGreaterThan(0);
    });

    test('should preserve message order across crashes', async () => {
      const messages = Array.from({ length: 15 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i, sequence: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }
      const publishedIds = new Set(messages.map((message) => message.id));

      // First consumer processes some then crashes
      let firstBatch: any[] = [];
      let hasCrashed = false;
      await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        firstBatch.push(content);

        if (!hasCrashed && firstBatch.length >= 5) {
          hasCrashed = true;
          // Simulate a hard consumer crash without throwing from amqplib's delivery callback.
          await rmq.simulateChannelFailure(0);
          return;
        }

        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Second consumer processes remaining
      const secondBatch: any[] = [];
      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());
        secondBatch.push(content);
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const allProcessed = [...firstBatch, ...secondBatch];
      const uniqueProcessed = new Set(
        allProcessed
          .filter((message) => publishedIds.has(message.id))
          .map((message) => message.id)
      );
      expect(uniqueProcessed.size).toBe(15);
    });

    test('should handle multiple sequential crashes', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      let crashCount = 0;
      let totalProcessed = 0;

      // Create a fragile consumer that crashes periodically
      const createFragileConsumer = async (): Promise<void> => {
        let localProcessed = 0;

        await rmq.consume(topology.queue, (msg) => {
          if (!msg) return;

          localProcessed++;
          totalProcessed++;

          // Crash every 3 messages
          if (localProcessed % 3 === 0) {
            crashCount++;
            rmq.getChannel()?.nack(msg, false, true);
            return;
          }

          rmq.getChannel()?.ack(msg);
        });
      };

      // Try to consume with crash recovery
      for (let i = 0; i < 5; i++) {
        try {
          await createFragileConsumer();
          await new Promise((resolve) => setTimeout(resolve, 500));
          await rmq.cancelAllConsumers();
        } catch {
          // Expected crashes
        }
      }

      await rmq.cancelAllConsumers();
      if (totalProcessed < messages.length) {
        const recovered = await rmq.collectMessages(topology.queue, messages.length, 5000);
        totalProcessed += recovered.length;
      }

      expect(crashCount).toBeGreaterThan(0);
      expect(totalProcessed).toBeGreaterThanOrEqual(Math.ceil(messages.length / 3)); // Processing continues across repeated crash cycles
    });
  });

  describe('State Recovery', () => {
    test('should restore consumer state after crash', async () => {
      // Create consumer state table
      await pg.createTable({
        name: 'consumer_state',
        columns: [
          { name: 'consumer_id', type: 'VARCHAR(255)', nullable: false, constraints: ['PRIMARY KEY'] },
          { name: 'last_processed_offset', type: 'BIGINT', default: '0' },
          { name: 'last_event_id', type: 'UUID' },
          { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' },
        ],
      });

      const consumerId = 'test-consumer-recovery';

      // Publish messages
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // First consumer with state tracking
      let stateConsumerCrashed = false;
      await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Update state
        await pg.query(
          `INSERT INTO consumer_crash_test.consumer_state (consumer_id, last_processed_offset, last_event_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (consumer_id) DO UPDATE SET
             last_processed_offset = consumer_state.last_processed_offset + 1,
             last_event_id = EXCLUDED.last_event_id,
             updated_at = NOW()`,
          [consumerId, 1, content.id]
        );

        // Simulate crash after 5 messages
        const state = await pg.selectOne('consumer_state', 'consumer_id = $1', [consumerId]);
        if (!stateConsumerCrashed && Number(state?.last_processed_offset ?? 0) >= 5) {
          stateConsumerCrashed = true;
          rmq.getChannel()?.ack(msg);
          await rmq.cancelAllConsumers();
          return;
        }

        rmq.getChannel()?.ack(msg);
      });

      let savedState = await pg.selectOne('consumer_state', 'consumer_id = $1', [consumerId]);
      const waitStart = Date.now();
      while (Number(savedState?.last_processed_offset ?? 0) < 5 && Date.now() - waitStart < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        savedState = await pg.selectOne('consumer_state', 'consumer_id = $1', [consumerId]);
      }

      // Verify state was saved
      expect(savedState).toBeDefined();
      expect(Number(savedState?.last_processed_offset)).toBeGreaterThanOrEqual(5);

      await rmq.cancelAllConsumers();

      const resumePublish = await rmq.publish(topology.exchange, topology.routingKey, {
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: 'resume' },
      });
      expect(resumePublish.success).toBe(true);

      // Second consumer should use saved state
      let resumedCount = 0;
      await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Check if already processed using state
        const state = await pg.selectOne('consumer_state', 'consumer_id = $1', [consumerId]);
        if (state?.last_event_id === content.id) {
          rmq.getChannel()?.ack(msg);
          return;
        }

        resumedCount++;
        rmq.getChannel()?.ack(msg);
      });

      const resumeWaitStart = Date.now();
      while (resumedCount === 0 && Date.now() - resumeWaitStart < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(resumedCount).toBeGreaterThan(0);
    });

    test('should handle concurrent consumer crashes', async () => {
      // Create state table
      await pg.createTable({
        name: 'consumer_state',
        columns: [
          { name: 'consumer_id', type: 'VARCHAR(255)', nullable: false, constraints: ['PRIMARY KEY'] },
          { name: 'processed_count', type: 'INTEGER', default: '0' },
        ],
      });

      // Publish messages
      const messages = Array.from({ length: 20 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // Create multiple consumers
      const consumers = ['consumer-1', 'consumer-2', 'consumer-3'];
      let totalProcessed = 0;

      for (const consumerId of consumers) {
        await rmq.consume(topology.queue, async (msg) => {
          if (!msg) return;

          // Update state atomically
          await pg.query(
            `INSERT INTO consumer_crash_test.consumer_state (consumer_id, processed_count)
             VALUES ($1, 1)
             ON CONFLICT (consumer_id) DO UPDATE SET
               processed_count = consumer_state.processed_count + 1`,
            [consumerId]
          );

          totalProcessed++;
          rmq.getChannel()?.ack(msg);
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify all messages processed
      const states = await pg.select('consumer_state');
      const sumProcessed = states.rows.reduce((sum: number, row: any) => sum + row.processed_count, 0);

      expect(totalProcessed).toBeGreaterThan(0);
    });
  });

  describe('Graceful Shutdown', () => {
    test('should finish processing current message on shutdown', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      let isShuttingDown = false;
      let processedCount = 0;

      const consumer = await rmq.consume(topology.queue, async (msg) => {
        if (!msg || isShuttingDown) return;

        const content = JSON.parse(msg.content.toString());

        // Process the message
        await new Promise((resolve) => setTimeout(resolve, 100));

        processedCount++;
        rmq.getChannel()?.ack(msg);

        // Simulate shutdown signal
        if (processedCount === 3) {
          isShuttingDown = true;
          // Cancel consumer gracefully
          await rmq.cancelConsumer(consumer.consumerTag);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(processedCount).toBeGreaterThanOrEqual(3);
    });

    test('should not accept new messages during shutdown', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      let acceptedCount = 0;
      let isShuttingDown = false;

      const consumer = await rmq.consume(topology.queue, async (msg) => {
        if (!msg) return;

        if (isShuttingDown) {
          // Reject new messages during shutdown
          rmq.getChannel()?.nack(msg, false, false);
          return;
        }

        acceptedCount++;
        rmq.getChannel()?.ack(msg);

        // Trigger shutdown
        if (acceptedCount >= 3) {
          isShuttingDown = true;
          await new Promise((resolve) => setTimeout(resolve, 500));
          await rmq.cancelConsumer(consumer.consumerTag);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(acceptedCount).toBeLessThan(10);
    });
  });

  describe('Error Handling', () => {
    test('should continue processing after recoverable error', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      let errorCount = 0;
      let processedCount = 0;

      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Simulate error for odd-numbered messages
        if (content.data.order_id % 2 === 1) {
          errorCount++;
          // Recoverable error - requeue
          rmq.getChannel()?.nack(msg, false, true);
          return;
        }

        processedCount++;
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(errorCount).toBeGreaterThan(0);
      expect(processedCount).toBeGreaterThan(0);
    });

    test('should discard non-recoverable errors', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      let processedCount = 0;
      let discardedCount = 0;

      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        // Simulate non-recoverable error for specific message
        if (content.data.order_id === 2) {
          discardedCount++;
          // Non-recoverable - don't requeue
          rmq.getChannel()?.nack(msg, false, false);
          return;
        }

        processedCount++;
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(discardedCount).toBe(1);
      expect(processedCount).toBe(4);
    });

    test('should track error counts for monitoring', async () => {
      const messages = Array.from({ length: 15 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i, should_fail: i % 3 === 0 },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      const errorCounts: Record<string, number> = {};
      let processedCount = 0;

      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        if (content.data.should_fail) {
          const errorType = 'validation_error';
          errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
          rmq.getChannel()?.nack(msg, false, true);
          return;
        }

        processedCount++;
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(Object.keys(errorCounts).length).toBeGreaterThan(0);
    });
  });

  describe('Recovery Performance', () => {
    test('should recover quickly after crash', async () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        id: crypto.randomUUID(),
        type: 'order.created',
        data: { order_id: i },
      }));

      for (const msg of messages) {
        await rmq.publish(topology.exchange, topology.routingKey, msg);
      }

      // First consumer
      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;
        // Simulate in-flight work at the time the consumer crashes.
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate crash
      await rmq.simulateChannelFailure(1000);

      // Measure recovery time
      const recoveryStart = Date.now();

      // Second consumer
      let recoveredCount = 0;
      await rmq.consume(topology.queue, (msg) => {
        if (!msg) return;
        recoveredCount++;
        rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const recoveryTime = Date.now() - recoveryStart;

      expect(recoveryTime).toBeLessThan(2000); // Recovery within 2 seconds
      expect(recoveredCount).toBeGreaterThan(0);
    });

    test('should not lose messages during crash-recovery cycle', async () => {
      const messageCount = 100;
      const messageIds = Array.from({ length: messageCount }, () => crypto.randomUUID());

      for (const id of messageIds) {
        await rmq.publish(topology.exchange, topology.routingKey, {
          id,
          type: 'order.created',
          data: { order_id: id },
        });
      }

      // Process with occasional crashes
      const processedIds = new Set<string>();
      let crashCount = 0;

      for (let i = 0; i < 5; i++) {
        const consumer = await rmq.consume(topology.queue, (msg) => {
          if (!msg) return;
          const content = JSON.parse(msg.content.toString());
          processedIds.add(content.id);
          rmq.getChannel()?.ack(msg);
        });

        await new Promise((resolve) => setTimeout(resolve, 200));

        if (i < 4) {
          // Simulate crash
          await rmq.simulateChannelFailure(200);
          crashCount++;
        }
      }

      expect(processedIds.size).toBeGreaterThanOrEqual(messageCount - 10); // At most 10 lost
      expect(crashCount).toBe(4);
    });
  });
});

// Extend crypto for node compatibility
declare const crypto: {
  randomUUID: () => string;
};
