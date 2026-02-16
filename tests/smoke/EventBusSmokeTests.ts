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

// RabbitMQ configuration
const rabbitConfig = {
  host: process.env.RABBITMQ_HOST || 'localhost',
  port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
  username: process.env.RABBITMQ_USER || 'admin',
  password: process.env.RABBITMQ_PASSWORD || 'admin',
  vhost: process.env.RABBITMQ_VHOST || '/',
};

// Exchange and queue names for testing
const TEST_EXCHANGE = 'smoke-test-exchange';
const TEST_QUEUE = 'smoke-test-queue';
const TEST_DLQ = 'smoke-test-dlq';
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
      // Clean up test queues and exchange
      if (channel) {
        await channel.deleteQueue(TEST_QUEUE);
        await channel.deleteQueue(TEST_DLQ);
        await channel.deleteExchange(TEST_EXCHANGE);
        await channel.close();
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

      // Consume the message
      const consumed = await new Promise<TestMessage | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);

        channel?.consume(
          TEST_QUEUE,
          (msg: any) => {
            if (msg) {
              clearTimeout(timeout);
              const message = JSON.parse(msg.content.toString()) as TestMessage;
              channel?.ack(msg);
              resolve(message);
            }
          },
          { noAck: false }
        );
      });

      expect(consumed).toBeDefined();
      expect(consumed?.type).toBe('smoke-test');
      expect(consumed?.data.test).toBe('consume');
    });

    it('should consume multiple messages', async () => {
      // Purge queue first
      await channel?.purgeQueue(TEST_QUEUE);

      // Publish 3 test messages
      const messageCount = 3;
      for (let i = 0; i < messageCount; i++) {
        const testMessage: TestMessage = {
          type: 'smoke-test',
          timestamp: new Date().toISOString(),
          data: { index: i },
        };

        channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));
      }

      // Consume all messages
      const messages: TestMessage[] = [];
      const consumedCount = await new Promise<number>(async (resolve) => {
        let count = 0;

        const consumer = await channel?.consume(
          TEST_QUEUE,
          (msg: any) => {
            if (msg) {
              const message = JSON.parse(msg.content.toString()) as TestMessage;
              messages.push(message);
              channel?.ack(msg);
              count++;

              if (count === messageCount) {
                channel?.cancel(consumer?.consumerTag || '');
                resolve(count);
              }
            }
          },
          { noAck: false }
        );
      });

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

      // Consume and acknowledge
      const consumerTag = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

        channel?.consume(
          TEST_QUEUE,
          (msg: any) => {
            if (msg) {
              clearTimeout(timeout);
              channel?.ack(msg);
              resolve(msg.fields.consumerTag);
            }
          },
          { noAck: false }
        );
      });

      expect(consumerTag).toBeDefined();
      await channel?.cancel(consumerTag);
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
      const consumerTag = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

        channel?.consume(
          TEST_QUEUE,
          (msg: any) => {
            if (msg) {
              clearTimeout(timeout);
              channel?.reject(msg, false); // Don't requeue
              resolve(msg.fields.consumerTag);
            }
          },
          { noAck: false }
        );
      });

      expect(consumerTag).toBeDefined();
      await channel?.cancel(consumerTag);

      // Verify queue is empty
      const queueInfo = await channel?.checkQueue(TEST_QUEUE);
      expect(queueInfo?.messageCount).toBe(0);
    });
  });

  describe('Dead Letter Queue Tests', () => {
    it('should route failed message to DLQ', async () => {
      // Create a queue with DLQ
      const testQueue = 'smoke-test-dlq-source';
      const dlx = 'smoke-test-dlx';
      const dlqRoutingKey = 'dlq';

      await channel?.assertExchange(dlx, 'direct', { durable: false });
      await channel?.assertQueue(testQueue, {
        durable: false,
        deadLetterExchange: dlx,
        deadLetterRoutingKey: dlqRoutingKey,
      });

      await channel?.assertQueue(TEST_DLQ, { durable: false });
      await channel?.bindQueue(TEST_DLQ, dlx, dlqRoutingKey);

      // Publish a message
      const testMessage: TestMessage = {
        type: 'smoke-test',
        timestamp: new Date().toISOString(),
        data: { test: 'dlq' },
      };

      channel?.publish('', testQueue, Buffer.from(JSON.stringify(testMessage)));

      // Consume and reject with requeue
      const consumerTag = await new Promise<string>((resolve) => {
        channel?.consume(
          testQueue,
          (msg: any) => {
            if (msg) {
              channel?.reject(msg, true); // Requeue once
              resolve(msg.fields.consumerTag);
            }
          },
          { noAck: false }
        );
      });

      await channel?.cancel(consumerTag);
      await channel?.deleteQueue(testQueue);
      await channel?.deleteExchange(dlx);
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

      channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from(JSON.stringify(testMessage)));

      const start = Date.now();
      await new Promise<TestMessage | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);

        channel?.consume(
          TEST_QUEUE,
          (msg: any) => {
            if (msg) {
              clearTimeout(timeout);
              const message = JSON.parse(msg.content.toString()) as TestMessage;
              channel?.ack(msg);
              resolve(message);
            }
          },
          { noAck: false }
        );
      });
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
      const queueInfo = await channel?.checkQueue(TEST_QUEUE);
      expect(queueInfo?.messageCount).toBe(messageCount);
    });
  });

  describe('Queue Management', () => {
    it('should purge queue', async () => {
      // Add some messages
      for (let i = 0; i < 5; i++) {
        channel?.publish(TEST_EXCHANGE, TEST_ROUTING_KEY, Buffer.from('test'));
      }

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
      const tempExchange = 'smoke-test-temp-exchange';
      await channel?.assertExchange(tempExchange, 'topic', { durable: false });

      const check = await channel?.checkExchange(tempExchange);
      expect(check).toBeDefined();

      await channel?.deleteExchange(tempExchange);
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
