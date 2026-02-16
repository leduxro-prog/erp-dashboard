/**
 * E2E Test Teardown
 *
 * Global teardown for E2E tests.
 * Cleans up shared resources and test data.
 *
 * @module tests/e2e/teardown
 */

export default async function globalTeardown() {
  console.log('[E2E Teardown] Starting global teardown...');

  // Close any open connections
  await closeConnections();

  // Clean up test data
  await cleanupTestData();

  console.log('[E2E Teardown] Global teardown complete');
}

/**
 * Closes any open connections
 */
async function closeConnections(): Promise<void> {
  // Close RabbitMQ connections
  try {
    const amqp = require('amqplib');
    // Note: Connections are managed by individual tests
    console.log('[E2E Teardown] RabbitMQ connections cleanup');
  } catch (error) {
    console.error('[E2E Teardown] Failed to close RabbitMQ connections:', error);
  }

  // Close Redis connections
  try {
    console.log('[E2E Teardown] Redis connections cleanup');
  } catch (error) {
    console.error('[E2E Teardown] Failed to close Redis connections:', error);
  }

  // Close PostgreSQL connections
  try {
    const pg = require('pg');
    console.log('[E2E Teardown] PostgreSQL connections cleanup');
  } catch (error) {
    console.error('[E2E Teardown] Failed to close PostgreSQL connections:', error);
  }
}

/**
 * Cleans up test data
 */
async function cleanupTestData(): Promise<void> {
  const pg = require('pg');
  const { host, port, database, user, password } = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cypher_erp_test',
    user: process.env.DB_USER || 'cypher_user',
    password: process.env.DB_PASSWORD || 'cypher_secret',
  };

  try {
    const client = new pg.Client({
      host,
      port,
      database,
      user,
      password,
    });

    await client.connect();

    // Drop test schemas
    await client.query('DROP SCHEMA IF EXISTS test_e2e_eventbus CASCADE');
    await client.query('DROP SCHEMA IF EXISTS test_e2e_jobs CASCADE');

    // Clean up test queues in Redis
    await cleanupRedisQueues();

    // Clean up test queues/exchanges in RabbitMQ
    await cleanupRabbitMQQueues();

    await client.end();

    console.log('[E2E Teardown] Test data cleaned up');
  } catch (error) {
    console.error('[E2E Teardown] Failed to clean up test data:', error);
  }
}

/**
 * Cleans up test queues in Redis
 */
async function cleanupRedisQueues(): Promise<void> {
  const IORedis = require('ioredis');
  const { host, port, password } = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  try {
    const redis = new IORedis({
      host,
      port,
      password,
      maxRetriesPerRequest: 1,
    });

    // Delete test queue keys
    const patterns = ['bull:e2e-test-jobs:*', 'bull:e2e-test-jobs-dlq:*'];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    await redis.quit();

    console.log('[E2E Teardown] Redis queues cleaned up');
  } catch (error) {
    console.error('[E2E Teardown] Failed to clean up Redis queues:', error);
  }
}

/**
 * Cleans up test queues and exchanges in RabbitMQ
 */
async function cleanupRabbitMQQueues(): Promise<void> {
  const amqp = require('amqplib');
  const { hostname, port, username, password, vhost } = {
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASS || 'guest',
    vhost: process.env.RABBITMQ_VHOST || '/',
  };

  try {
    const connection = await amqp.connect({
      protocol: 'amqp',
      hostname,
      port,
      username,
      password,
      vhost,
      timeout: 5000,
    });

    const channel = await connection.createChannel();

    // Delete test queues
    const testQueues = [
      'e2e-test-order',
      'e2e-test-order-dlq',
      'e2e-test-inventory',
      'e2e-test-inventory-dlq',
      'e2e-test-payment',
      'e2e-test-payment-dlq',
      'e2e-test-jobs',
      'e2e-test-jobs-dlq',
      'e2e-test-jobs-dlq-test',
      'e2e-eventbus-test',
    ];

    for (const queue of testQueues) {
      try {
        await channel.deleteQueue(queue);
      } catch {
        // Queue might not exist
      }
    }

    // Delete test exchanges
    const testExchanges = [
      'e2e-eventbus-order',
      'e2e-eventbus-order-dlq',
      'e2e-eventbus-inventory',
      'e2e-eventbus-inventory-dlq',
      'e2e-eventbus-payment',
      'e2e-eventbus-payment-dlq',
    ];

    for (const exchange of testExchanges) {
      try {
        await channel.deleteExchange(exchange);
      } catch {
        // Exchange might not exist
      }
    }

    await channel.close();
    await connection.close();

    console.log('[E2E Teardown] RabbitMQ queues and exchanges cleaned up');
  } catch (error) {
    console.error('[E2E Teardown] Failed to clean up RabbitMQ resources:', error);
  }
}
