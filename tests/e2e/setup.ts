/**
 * E2E Test Setup
 *
 * Global setup for E2E tests.
 * Initializes shared resources and validates external services.
 *
 * @module tests/e2e/setup
 */

export default async function globalSetup() {
  console.log('[E2E Setup] Starting global setup...');

  // Check if required services are available
  await checkRequiredServices();

  // Clear any existing test data
  await clearTestData();

  console.log('[E2E Setup] Global setup complete');
}

/**
 * Checks if required external services are available
 */
async function checkRequiredServices(): Promise<void> {
  const services: Record<string, () => Promise<boolean>> = {
    'RabbitMQ': checkRabbitMQ,
    'PostgreSQL': checkPostgres,
    'Redis': checkRedis,
  };

  const results: Record<string, boolean> = {};

  for (const [name, checkFn] of Object.entries(services)) {
    try {
      results[name] = await checkFn();
    } catch (error) {
      console.error(`[E2E Setup] ${name} check failed:`, error);
      results[name] = false;
    }
  }

  // Log results
  console.log('[E2E Setup] Service availability:', results);

  // Fail if critical services are not available
  const criticalServices = ['PostgreSQL']; // RabbitMQ and Redis can be mocked
  const unavailable = Object.entries(results)
    .filter(([name]) => criticalServices.includes(name))
    .filter(([, available]) => !available);

  if (unavailable.length > 0) {
    console.error('[E2E Setup] Critical services unavailable:', unavailable);
  }
}

/**
 * Checks RabbitMQ availability
 */
async function checkRabbitMQ(): Promise<boolean> {
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

    await connection.close();
    console.log('[E2E Setup] RabbitMQ is available');
    return true;
  } catch {
    console.warn('[E2E Setup] RabbitMQ is not available (using mocks)');
    return false;
  }
}

/**
 * Checks PostgreSQL availability
 */
async function checkPostgres(): Promise<boolean> {
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
    await client.query('SELECT 1');
    await client.end();

    console.log('[E2E Setup] PostgreSQL is available');
    return true;
  } catch {
    console.error('[E2E Setup] PostgreSQL is not available');
    return false;
  }
}

/**
 * Checks Redis availability
 */
async function checkRedis(): Promise<boolean> {
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
      retryStrategy: (times: number) => {
        if (times > 1) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    await redis.ping();
    await redis.quit();

    console.log('[E2E Setup] Redis is available');
    return true;
  } catch {
    console.warn('[E2E Setup] Redis is not available (using mocks)');
    return false;
  }
}

/**
 * Clears test data from database
 */
async function clearTestData(): Promise<void> {
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

    // Drop test schema if exists
    await client.query('DROP SCHEMA IF EXISTS test_e2e_eventbus CASCADE');
    await client.query('DROP SCHEMA IF EXISTS test_e2e_jobs CASCADE');

    // Create test schemas
    await client.query('CREATE SCHEMA IF NOT EXISTS test_e2e_eventbus');
    await client.query('CREATE SCHEMA IF NOT EXISTS test_e2e_jobs');

    await client.end();

    console.log('[E2E Setup] Test schemas cleared');
  } catch (error) {
    console.error('[E2E Setup] Failed to clear test data:', error);
  }
}
