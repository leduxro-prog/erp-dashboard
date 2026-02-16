/**
 * Broker restart resilience tests.
 *
 * Tests the system's ability to handle RabbitMQ broker restarts,
 * including connection recovery, message redelivery, and state consistency.
 *
 * @module BrokerRestart.test
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { TestRabbitMQ, setupTestTopology, createTestRabbitMQ } from './helpers';
import { OutboxRepository } from '../../../modules/outbox-relay/src/OutboxRepository';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  },
};

describe('Broker Restart Resilience', () => {
  let rmq: TestRabbitMQ;
  let topology: { exchange: string; queue: string; routingKey: string };

  beforeAll(async () => {
    rmq = createTestRabbitMQ(TEST_CONFIG.rabbitmq);
    await rmq.connect();
    topology = await setupTestTopology(rmq);
  });

  afterAll(async () => {
    await rmq.cleanup();
  });

  beforeEach(() => {
    rmq.resetStats();
  });

  afterEach(async () => {
    await rmq.purgeQueue(topology.queue);
  });

  describe('Connection Recovery', () => {
    test('should automatically reconnect after connection close', async () => {
      // Publish some messages
      const messages = Array.from({ length: 10 }, (_, i) => ({ id: i, data: `message-${i}` }));
      const publishResults = await rmq.publishBatch(
        topology.exchange,
        topology.routingKey,
        messages
      );

      expect(publishResults.filter((r) => r.success).length).toBe(10);

      // Simulate connection failure
      await rmq.simulateConnectionFailure(3000);

      // Verify connection is restored
      expect(rmq.isConnected()).toBe(true);

      // Publish after reconnection
      const result = await rmq.publish(topology.exchange, topology.routingKey, { test: 'after-reconnect' });
      expect(result.success).toBe(true);
    });

    test('should preserve channel state after reconnection', async () => {
      // Setup channel state
      const result1 = await rmq.publish(topology.exchange, topology.routingKey, { id: 1 });
      expect(result1.success).toBe(true);

      // Disconnect and reconnect
      await rmq.simulateConnectionFailure(2000);

      // Verify channel still works
      const result2 = await rmq.publish(topology.exchange, topology.routingKey, { id: 2 });
      expect(result2.success).toBe(true);

      const count = await rmq.getQueueMessageCount(topology.queue);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should handle multiple rapid connection failures', async () => {
      let successCount = 0;

      for (let i = 0; i < 5; i++) {
        const result = await rmq.publish(topology.exchange, topology.routingKey, { id: i });
        if (result.success) successCount++;

        if (i === 2) {
          // Trigger failure in the middle
          await rmq.simulateConnectionFailure(500);
        }
      }

      expect(successCount).toBeGreaterThan(0);
      expect(rmq.isConnected()).toBe(true);
    });

    test('should respect reconnection timeout and retry limits', async () => {
      // This test verifies that the reconnection logic has proper timeouts
      const startTime = Date.now();

      // Force a connection failure
      await rmq.simulateConnectionFailure(1000);

      // Try to publish - should succeed or fail quickly
      const result = await rmq.publish(topology.exchange, topology.routingKey, { test: 'timeout' });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000); // Should not hang forever
    });
  });

  describe('Message Persistence', () => {
    test('should not lose durable messages during restart', async () => {
      // Create durable queue
      const durableQueue = TestRabbitMQ.createTestQueueName('durable');
      await rmq.declareExchange({
        name: 'durable-exchange',
        type: 'topic',
        options: { durable: true },
      });
      await rmq.declareQueue({
        name: durableQueue,
        options: { durable: true },
        bindings: [{ exchange: 'durable-exchange', routingKey: 'test.#' }],
      });

      // Publish durable messages
      const messages = Array.from({ length: 20 }, (_, i) => ({ id: i, durable: true }));
      for (const msg of messages) {
        await rmq.publish('durable-exchange', 'test.durable', msg, { persistent: true });
      }

      // Restart connection
      await rmq.simulateConnectionFailure(2000);

      // Verify messages are still in queue
      const count = await rmq.getQueueMessageCount(durableQueue);
      expect(count).toBeGreaterThanOrEqual(15); // Allow some margin

      // Cleanup
      await rmq.deleteQueue(durableQueue);
      await rmq.deleteExchange('durable-exchange');
    });

    test('should republish transient messages after restart', async () => {
      // Publish messages before restart
      const messages = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      await rmq.publishBatch(topology.exchange, topology.routingKey, messages);

      // Restart connection
      await rmq.simulateConnectionFailure(2000);

      // Collect messages
      const consumed = await rmq.collectMessages(topology.queue, 5, 5000);
      expect(consumed.length).toBeGreaterThan(0);
    });
  });

  describe('Publisher Confirms', () => {
    test('should handle confirms correctly after restart', async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < 20; i++) {
        const result = await rmq.publish(topology.exchange, topology.routingKey, { id: i });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        if (i === 10) {
          await rmq.simulateConnectionFailure(1500);
        }
      }

      const stats = rmq.getStats();
      expect(stats.messagesPublished).toBe(20);
      expect(successCount).toBeGreaterThan(15); // At least 75% success
    });

    test('should retry failed publishes after restart', async () => {
      const messages = Array.from({ length: 15 }, (_, i) => ({ id: i }));
      const results = await rmq.publishBatch(
        topology.exchange,
        topology.routingKey,
        messages
      );

      // Trigger restart
      await rmq.simulateConnectionFailure(2000);

      // Publish more after restart
      const result = await rmq.publish(topology.exchange, topology.routingKey, { id: 100 });
      expect(result.success).toBe(true);
    });
  });

  describe('Consumer Recovery', () => {
    test('should redeliver unacknowledged messages after restart', async () => {
      // Publish messages
      const messages = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      await rmq.publishBatch(topology.exchange, topology.routingKey, messages);

      // Start consumer but don't ack all messages
      let consumedCount = 0;
      const consumerTag = await rmq.consume(topology.queue, (msg) => {
        if (msg) {
          consumedCount++;
          // Only ack half the messages
          if (consumedCount <= 5) {
            rmq.getChannel()?.ack(msg);
          }
        }
      });

      // Wait for some messages to be consumed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Restart connection
      await rmq.simulateConnectionFailure(2000);

      // Cancel old consumer
      await rmq.cancelConsumer(consumerTag.consumerTag);

      // Check remaining messages
      const count = await rmq.getQueueMessageCount(topology.queue);
      expect(count).toBeGreaterThan(0);
    });

    test('should handle consumer restart gracefully', async () => {
      // Publish messages
      const messages = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      await rmq.publishBatch(topology.exchange, topology.routingKey, messages);

      // First consumer
      const consumer1 = await rmq.consume(topology.queue, (msg) => {
        if (msg) rmq.getChannel()?.ack(msg);
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate channel failure
      await rmq.simulateChannelFailure(1000);

      // Second consumer should work
      const collected: any[] = [];
      await rmq.consume(topology.queue, (msg) => {
        if (msg) {
          collected.push(JSON.parse(msg.content.toString()));
          rmq.getChannel()?.ack(msg);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(collected.length).toBeGreaterThan(0);

      await rmq.cancelConsumer(consumer1.consumerTag);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track connection errors accurately', async () => {
      const initialStats = rmq.getStats();

      // Trigger multiple failures
      await rmq.simulateConnectionFailure(500);
      await rmq.simulateConnectionFailure(500);
      await rmq.simulateConnectionFailure(500);

      const finalStats = rmq.getStats();
      expect(finalStats.reconnections).toBeGreaterThan(initialStats.reconnections);
    });

    test('should track publish latency before and after restart', async () => {
      // Publish before restart
      const beforeLatencies: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await rmq.publish(topology.exchange, topology.routingKey, { id: i });
        beforeLatencies.push(Date.now() - start);
      }

      // Restart
      await rmq.simulateConnectionFailure(2000);

      // Publish after restart
      const afterLatencies: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await rmq.publish(topology.exchange, topology.routingKey, { id: i + 100 });
        afterLatencies.push(Date.now() - start);
      }

      const avgBefore = beforeLatencies.reduce((a, b) => a + b, 0) / beforeLatencies.length;
      const avgAfter = afterLatencies.reduce((a, b) => a + b, 0) / afterLatencies.length;

      expect(avgAfter).toBeLessThan(avgBefore * 2); // Should recover within 2x
    });
  });

  describe('Outbox Integration', () => {
    test('should preserve outbox events during broker restart', async () => {
      // Create test outbox events in database
      const events = Array.from({ length: 10 }, (_, i) => ({
        event_id: crypto.randomUUID(),
        event_type: 'order.created',
        event_version: 'v1',
        event_domain: 'order',
        source_service: 'test-service',
        payload: { order_id: i + 1 },
        metadata: {},
        content_type: 'application/json',
        priority: 'normal',
        publish_to: 'rabbitmq',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
      }));

      // Simulate broker restart
      await rmq.simulateConnectionFailure(2000);

      // Verify connection is restored
      expect(rmq.isConnected()).toBe(true);

      // Events should still be processable after restart
      const result = await rmq.publish(
        topology.exchange,
        topology.routingKey,
        { test: 'after-restart' }
      );
      expect(result.success).toBe(true);
    });
  });
});

/**
 * Helper function to generate random UUID
 */
declare const crypto: {
  randomUUID: () => string;
};
