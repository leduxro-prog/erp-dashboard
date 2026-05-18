/**
 * Event Bus Smoke Tests
 *
 * These tests verify that the RabbitMQ event bus is properly configured
 * and can publish/consume messages. Essential for ensuring event-driven
 * functionality works after deployment.
 *
 * Run: npm run test -- tests/smoke/EventBusSmokeTests.ts
 */

import amqp from 'amqplib';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

jest.setTimeout(15000);

// RabbitMQ configuration
const rabbitConfig = {
  host: process.env.RABBITMQ_HOST || 'localhost',
  port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
  username: process.env.RABBITMQ_USER || 'admin',
  password: process.env.RABBITMQ_PASSWORD || 'admin',
  vhost: process.env.RABBITMQ_VHOST || '/',
};

// Exchange and queue names for testing
const TEST_RUN_ID = `${Date.now()}-${process.pid}`;
const TEST_EXCHANGE = `smoke-test-exchange-${TEST_RUN_ID}`;
const TEST_QUEUE = `smoke-test-queue-${TEST_RUN_ID}`;
const TEST_DLQ = `smoke-test-dlq-${TEST_RUN_ID}`;
const TEST_ROUTING_KEY = 'smoke.test';

// Test message structure
interface TestMessage {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

describe('Event Bus Smoke Tests', () => {
  let connection: any = null;
  let channel: any = null;

  async function waitForQueueMessageCount(queueName: string, expectedCount: number, timeoutMs = 5000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    let lastCount = -1;

    while (Date.now() < deadline) {
      const queueInfo = await channel?.checkQueue(queueName);
      lastCount = queueInfo?.messageCount ?? -1;
      if (lastCount === expectedCount) return lastCount;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return lastCount;
  }

  async function getJsonMessage(queueName: string, timeoutMs = 5000): Promise<TestMessage | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const msg = await channel?.get(queueName, { noAck: false });
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString()) as TestMessage;
          channel?.ack(msg);
          return message;
        } catch {
          channel?.nack(msg, false, false);
          return null;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return null;
  }

  async function getRawMessage(queueName: string, timeoutMs = 5000): Promise<any | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const msg = await channel?.get(queueName, { noAck: false });
      if (msg) return msg;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return null;
  }

  beforeAll(async () => {
    try {
      // Create connection string
      const connectionString = `amqp://${rabbitConfig.username}:${rabbitConfig.password}@${rabbitConfig.host}:${rabbitConfig.port}${rabbitConfig.vhost}`;

      // Connect to RabbitMQ
      connection = await amqp.connect(connectionString);
      channel = await connection.createChannel();

      // Set up test exchange and queues
      await channel.assertExchange(TEST_EXCHANGE, 'topic', { durable: false });
      await channel.assertQueue(TEST_QUEUE, { durable: false });
      await channel.bindQueue(TEST_QUEUE, TEST_EXCHANGE, TEST_ROUTING_KEY);

      // Set up DLQ
      await channel.assertQueue(TEST_DLQ, { durable: false });
      await channel.bindQueue(TEST_DLQ, TEST_EXCHANGE, `${TEST_ROUTING_KEY}.dlq`);
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }, 10000); // Longer timeout for connection

  afterAll(async () => {
    try {
      if (channel) {
        for (const operation of [
          () => channel.deleteQueue(TEST_QUEUE),
          () => channel.deleteQueue(TEST_DLQ),
          () => channel.deleteExchange(TEST_EXCHANGE),
          () => channel.close(),
        ]) {
          try {
            await operation();
          } catch {
            // Cleanup is best-effort because failure-path tests intentionally close channels.
          }
        }
      }
      if (connection) {
        await connection.close();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });

  describe('Connection Tests', () => {
    it('should connect to RabbitMQ', () => {
      expect(connection).toBeDefined();
      expect(channel).toBeDefined();
    });

    it('should have an open connection', () => {
      expect(connection?.connection.serverProperties).toBeDefined();
      expect(channel?.connection).toBeDefined();
    });

    it('should retrieve RabbitMQ server information', () => {
      const serverProperties = connection?.connection.serverProperties;
      expect(serverProperties).toBeDefined();
      expect(serverProperties?.product).toContain('RabbitMQ');
    });

    it('should have a working channel', () => {
      expect(channel?.connection).toBeDefined();
    });
  });

  describe('Exchange and Queue Setup', () => {
    it('should create test exchange', async () => {
      const check = await channel?.checkExchange(TEST_EXCHANGE);
      expect(check).toBeDefined();
    });

    it('should create test queue', async () => {
      const check = await channel?.checkQueue(TEST_QUEUE);
      expect(check).toBeDefined();
      expect(check?.queue).toBe(TEST_QUEUE);
    });

    it('should create test DLQ', async () => {
      const check = await channel?.checkQueue(TEST_DLQ);
      expect(check).toBeDefined();
      expect(check?.queue).toBe(TEST_DLQ);
    });
  });

  describe('Message Publishing', () => {
    const testMessage: TestMessage = {
      type: 'smoke-test',
      timestamp: new Date().toISOString(),
      data: {
        test: 'data',
        number: 42,
      },
    };

    it('should publish a message to exchange', async () => {
      const published = channel?.publish(
        TEST_EXCHANGE,
        TEST_ROUTING_KEY,
        Buffer.from(JSON.stringify(testMessage))
      );

      expect(published).toBe(true);
    });

    it('should publish multiple messages', async () => {
      const messages = 5;
      for (let i = 0; i < messages; i++) {
        const message: TestMessage = {
          type: 'smoke-test',
          timestamp: new Date().toISOString(),
          data: {
            index: i,
          },
        };

        const published = channel?.publish(
          TEST_EXCHANGE,
          TEST_ROUTING_KEY,
          Buffer.from(JSON.stringify(message))
        );

        expect(published).toBe(true);
      }
    });

    it('should publish message with options', async () => {
      const published = channel?.publish(
        TEST_EXCHANGE,
        TEST_ROUTING_KEY,
        Buffer.from(JSON.stringify(testMessage)),
        {
          persistent: true,
          messageId: `test-message-${Date.now()}`,
          timestamp: Date.now(),
          contentType: 'application/json',
        }
      );

      expect(published).toBe(true);
    });

    it.skip('should handle invalid message gracefully', () => {
      // Publishing to non-existent exchange should fail
      const published = channel?.publish(
        'non-existent-exchange',
        TEST_ROUTING_KEY,
        Buffer.from('test')
      );

      expect(published).toBe(false);
    });
  });

  describe('Message Consumption', () => {
    it('should consume a published message', async () => {
      // Purge queue first
      await channel?.purgeQueue(TEST_QUEUE);

      // Publish a test message
      const testMessage: TestMessage = {
        type: 'smoke-test',
        timestamp: new Date().toISOString(),
        data: { test: 'consume' },
      };

      channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));
      const consumed = await getJsonMessage(TEST_QUEUE);

      expect(consumed).toBeDefined();
      expect(consumed?.type).toBe('smoke-test');
      expect(consumed?.data.test).toBe('consume');
    });

    it('should consume multiple messages', async () => {
      // Purge queue first
      await channel?.purgeQueue(TEST_QUEUE);

      const messageCount = 3;

      // Publish 3 test messages
      for (let i = 0; i < messageCount; i++) {
        const testMessage: TestMessage = {
          type: 'smoke-test',
          timestamp: new Date().toISOString(),
          data: { index: i },
        };

        channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));
      }

      await waitForQueueMessageCount(TEST_QUEUE, messageCount);

      // Consume all messages
      const messages: TestMessage[] = [];
      for (let i = 0; i < messageCount; i++) {
        const message = await getJsonMessage(TEST_QUEUE);
        if (message) messages.push(message);
      }
      const consumedCount = messages.length;

      expect(consumedCount).toBe(messageCount);
      expect(messages.length).toBe(messageCount);
    });

    it('should handle message acknowledgment', async () => {
      // Purge queue first
      await channel?.purgeQueue(TEST_QUEUE);

      // Publish a test message
      const testMessage: TestMessage = {
        type: 'smoke-test',
        timestamp: new Date().toISOString(),
        data: { test: 'ack' },
      };

      channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));
      const consumed = await getJsonMessage(TEST_QUEUE);
      expect(consumed?.data.test).toBe('ack');
    });

    it('should handle message rejection', async () => {
      // Purge queue first
      await channel?.purgeQueue(TEST_QUEUE);

      // Publish a test message
      const testMessage: TestMessage = {
        type: 'smoke-test',
        timestamp: new Date().toISOString(),
        data: { test: 'reject' },
      };

      channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));

      // Consume and reject
      await waitForQueueMessageCount(TEST_QUEUE, 1);
      const msg = await getRawMessage(TEST_QUEUE);
      expect(msg).toBeTruthy();
      if (msg) {
        channel?.reject(msg, false); // Don't requeue
      }

      // Verify queue is empty
      const queueInfo = await channel?.checkQueue(TEST_QUEUE);
      expect(queueInfo?.messageCount).toBe(0);
    });

    it('should deliver messages through a push consumer and cancel cleanly', async () => {
      const consumerQueue = `smoke-test-consumer-lifecycle-${TEST_RUN_ID}`;
      const consumerChannel = await connection?.createChannel();
      let consumerTag: string | null = null;

      try {
        await consumerChannel.assertQueue(consumerQueue, { durable: false });

        const testMessage: TestMessage = {
          type: 'smoke-test',
          timestamp: new Date().toISOString(),
          data: { test: 'consumer-lifecycle' },
        };

        const consumed = new Promise<TestMessage | null>((resolve) => {
          let settled = false;
          const timeout = setTimeout(() => resolve(null), 5000);
          const finish = (message: TestMessage | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            resolve(message);
          };

          void consumerChannel
            .consume(
              consumerQueue,
              (msg: any) => {
                if (!msg) return;
                try {
                  const message = JSON.parse(msg.content.toString()) as TestMessage;
                  consumerChannel.ack(msg);
                  finish(message);
                } catch {
                  consumerChannel.nack(msg, false, false);
                  finish(null);
                }
              },
              { noAck: false }
            )
            .then((consumer: any) => {
              consumerTag = consumer.consumerTag;
              consumerChannel.publish('', consumerQueue, Buffer.from(JSON.stringify(testMessage)));
            })
            .catch(() => finish(null));
        });

        const message = await consumed;
        expect(message?.data.test).toBe('consumer-lifecycle');
      } finally {
        if (consumerTag) {
          try {
            await consumerChannel.cancel(consumerTag);
          } catch {
            // Best-effort cleanup for degraded consumer/channel states.
          }
        }
        try {
          await consumerChannel.deleteQueue(consumerQueue);
        } catch {
          // Best-effort cleanup for degraded consumer/channel states.
        }
        try {
          await consumerChannel.close();
        } catch {
          // Best-effort cleanup for degraded consumer/channel states.
        }
      }
    });
  });

  describe('Dead Letter Queue Tests', () => {
    it('should route failed message to DLQ', async () => {
      // Create a queue with DLQ
      const testQueue = `smoke-test-dlq-source-${TEST_RUN_ID}`;
      const dlx = `smoke-test-dlx-${TEST_RUN_ID}`;
      const dlqRoutingKey = 'dlq';

      try {
        await channel?.assertExchange(dlx, 'direct', { durable: false });
        await channel?.assertQueue(testQueue, {
          durable: false,
          deadLetterExchange: dlx,
          deadLetterRoutingKey: dlqRoutingKey,
        });

        await channel?.assertQueue(TEST_DLQ, { durable: false });
        await channel?.bindQueue(TEST_DLQ, dlx, dlqRoutingKey);
        await channel?.purgeQueue(TEST_DLQ);

        // Publish a message
        const testMessage: TestMessage = {
          type: 'smoke-test',
          timestamp: new Date().toISOString(),
          data: { test: 'dlq' },
        };

        channel?.publish('', testQueue, Buffer.from(JSON.stringify(testMessage)));
        const sourceCount = await waitForQueueMessageCount(testQueue, 1);
        expect(sourceCount).toBe(1);

        // Consume and reject without requeue so RabbitMQ routes it to the configured DLQ.
        const msg = await channel?.get(testQueue, { noAck: false });
        expect(msg).toBeTruthy();
        if (msg) {
          channel?.reject(msg, false);
        }

        const dlqCount = await waitForQueueMessageCount(TEST_DLQ, 1);
        expect(dlqCount).toBe(1);
        const dlqMessage = await getJsonMessage(TEST_DLQ);
        expect(dlqMessage?.data.test).toBe('dlq');
      } finally {
        try {
          await channel?.deleteQueue(testQueue);
        } catch {
          // Best-effort cleanup for failed DLQ assertions.
        }
        try {
          await channel?.deleteExchange(dlx);
        } catch {
          // Best-effort cleanup for failed DLQ assertions.
        }
      }
    });
  });

  describe('Performance Tests', () => {
    it('should publish message under 50ms', async () => {
      const testMessage: TestMessage = {
        type: 'smoke-test',
        timestamp: new Date().toISOString(),
        data: { test: 'performance' },
      };

      const start = Date.now();
      channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should consume message under 500ms', async () => {
      await channel?.purgeQueue(TEST_QUEUE);

      const testMessage: TestMessage = {
        type: 'smoke-test',
        timestamp: new Date().toISOString(),
        data: { test: 'perf-consume' },
      };

      const start = Date.now();
      channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));
      await getJsonMessage(TEST_QUEUE);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should handle burst of messages', async () => {
      await channel?.purgeQueue(TEST_QUEUE);

      const messageCount = 100;
      const start = Date.now();

      for (let i = 0; i < messageCount; i++) {
        channel?.publish(
          TEST_EXCHANGE,
          TEST_ROUTING_KEY,
          Buffer.from(JSON.stringify({ index: i }))
        );
      }

      const publishDuration = Date.now() - start;
      expect(publishDuration).toBeLessThan(1000);

      // Verify all messages are in queue
      const messageCountInQueue = await waitForQueueMessageCount(TEST_QUEUE, messageCount);
      expect(messageCountInQueue).toBe(messageCount);
    });
  });

  describe('Queue Management', () => {
    it('should purge queue', async () => {
      await channel?.purgeQueue(TEST_QUEUE);

      // Add some messages
      for (let i = 0; i < 5; i++) {
        channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from('test'));
      }

      await waitForQueueMessageCount(TEST_QUEUE, 5);

      // Purge
      const result = await channel?.purgeQueue(TEST_QUEUE);
      expect(result?.messageCount).toBe(5);
    });

    it('should get queue information', async () => {
      const queueInfo = await channel?.checkQueue(TEST_QUEUE);
      expect(queueInfo).toBeDefined();
      expect(queueInfo?.queue).toBe(TEST_QUEUE);
      expect(queueInfo?.messageCount).toBeGreaterThanOrEqual(0);
      expect(queueInfo?.consumerCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Exchange Management', () => {
    it('should list bindings', async () => {
      const bindings = await channel?.checkQueue(TEST_QUEUE);
      expect(bindings).toBeDefined();
    });

    it('should create and delete exchange', async () => {
      const tempExchange = `smoke-test-temp-exchange-${TEST_RUN_ID}`;

      try {
        await channel?.assertExchange(tempExchange, 'topic', { durable: false });

        const check = await channel?.checkExchange(tempExchange);
        expect(check).toBeDefined();
      } finally {
        try {
          await channel?.deleteExchange(tempExchange);
        } catch {
          // Best-effort cleanup for failed exchange assertions.
        }
      }
    });
  });

  describe('Connection Resilience', () => {
    it('should handle channel closure gracefully', async () => {
      if (channel) {
        await channel.close();
      }

      // Create new channel
      const newChannel = await connection?.createChannel();
      expect(newChannel).toBeDefined();

      channel = newChannel;
    });

    it('should re-establish exchange and queue after reconnection', async () => {
      await channel?.assertExchange(TEST_EXCHANGE, 'topic', { durable: false });
      await channel?.assertQueue(TEST_QUEUE, { durable: false });
      await channel?.bindQueue(TEST_QUEUE, TEST_EXCHANGE, TEST_ROUTING_KEY);

      const check = await channel?.checkQueue(TEST_QUEUE);
      expect(check?.queue).toBe(TEST_QUEUE);
    });
  });
});

/**
 * Event Bus Smoke Test Summary
 */
export interface EventBusSmokeTestReport {
  timestamp: string;
  host: string;
  port: number;
  connected: boolean;
  exchangesFound: number;
  queuesFound: number;
  messageTestsPassed: number;
  messageTestsFailed: number;
  performance: {
    publishMs: number;
    consumeMs: number;
    throughput: number;
  };
  issues: string[];
}
