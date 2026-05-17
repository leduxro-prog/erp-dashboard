/**
 * Financial Integration Test Setup
 *
 * Sets up test database connection with PostgreSQL
 * for financial transaction tests.
 */

import { beforeAll, afterAll, afterEach, beforeEach } from '@jest/globals';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { B2BCustomerEntity } from '@modules/b2b-portal/src/infrastructure/entities/B2BCustomerEntity';
import { CreditTransactionEntity } from '@modules/b2b-portal/src/infrastructure/entities/CreditTransactionEntity';
import { CartEntity } from '@modules/checkout/src/domain/entities/CartEntity';
import { CreditReservationEntity } from '@modules/checkout/src/domain/entities/CreditReservationEntity';
import { OrderEntity } from '@modules/orders/src/infrastructure/entities/OrderEntity';
import { OrderItemEntity } from '@modules/orders/src/infrastructure/entities/OrderItemEntity';
import { OrderStatusHistoryEntity } from '@modules/orders/src/infrastructure/entities/OrderStatusHistoryEntity';
import { StockReservationEntity } from '@modules/inventory/src/infrastructure/entities/StockReservationEntity';
import { StockItemEntity } from '@modules/inventory/src/infrastructure/entities/StockItemEntity';
import { WarehouseEntity } from '@modules/inventory/src/infrastructure/entities/WarehouseEntity';

let testDataSource: DataSource | null = null;

function assertSafeTestDatabaseConfig(config: { host: string; database: string }): void {
  const safeHosts = new Set(['localhost', '127.0.0.1', '::1']);

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Refusing to initialize test database outside NODE_ENV=test`);
  }

  if (!safeHosts.has(config.host)) {
    throw new Error(`Refusing to initialize test database on non-local host: ${config.host}`);
  }

  if (!/^[a-zA-Z0-9_]+$/.test(config.database) || !config.database.endsWith('_test')) {
    throw new Error(`Refusing to initialize non-test database: ${config.database}`);
  }
}

async function ensureTestDatabaseExists(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}): Promise<void> {
  assertSafeTestDatabaseConfig(config);

  const maintenanceClient = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: process.env.TEST_DB_MAINTENANCE_DATABASE || 'postgres',
  });

  await maintenanceClient.connect();
  try {
    const existing = await maintenanceClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      config.database,
    ]);
    if (existing.rowCount === 0) {
      await maintenanceClient.query(`CREATE DATABASE ${config.database}`);
    }
  } finally {
    await maintenanceClient.end();
  }
}

/**
 * Get or create the test database connection.
 */
export async function getTestDataSource(): Promise<DataSource> {
  if (testDataSource && testDataSource.isInitialized) {
    return testDataSource;
  }

  const dbHost = process.env.TEST_DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.TEST_DB_PORT || '5432', 10);
  const dbUsername = process.env.TEST_DB_USERNAME || process.env.DB_USER || 'cypher_user';
  const dbPassword = process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || 'cypher_secret';
  const dbDatabase = process.env.TEST_DB_DATABASE || 'cypher_erp_test';

  await ensureTestDatabaseExists({
    host: dbHost,
    port: dbPort,
    username: dbUsername,
    password: dbPassword,
    database: dbDatabase,
  });

  testDataSource = new DataSource({
    type: 'postgres',
    host: dbHost,
    port: dbPort,
    username: dbUsername,
    password: dbPassword,
    database: dbDatabase,
    synchronize: true,
    dropSchema: false,
    logging: false,
    entities: [
      B2BCustomerEntity,
      CreditTransactionEntity,
      CartEntity,
      CreditReservationEntity,
      OrderEntity,
      OrderItemEntity,
      OrderStatusHistoryEntity,
      StockReservationEntity,
      StockItemEntity,
      WarehouseEntity,
    ],
  });

  await testDataSource.initialize();
  console.log(`Test database connected: ${dbDatabase}@${dbHost}:${dbPort}`);
  return testDataSource;
}

/**
 * Close the test database connection.
 */
export async function closeTestDataSource(): Promise<void> {
  if (testDataSource && testDataSource.isInitialized) {
    await testDataSource.destroy();
    testDataSource = null;
    console.log('Test database connection closed');
  }
}

/**
 * Clear all data from the test database.
 */
export async function clearTestData(): Promise<void> {
  if (!testDataSource || !testDataSource.isInitialized) {
    return;
  }

  const dbDatabase = process.env.TEST_DB_DATABASE || 'cypher_erp_test';
  assertSafeTestDatabaseConfig({
    host: process.env.TEST_DB_HOST || 'localhost',
    database: dbDatabase,
  });

  const tableNames = testDataSource.entityMetadatas
    .map((metadata) => `"${metadata.tablePath}"`)
    .join(', ');

  if (tableNames.length > 0) {
    await testDataSource.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
  }
}

/**
 * Begin a test transaction for isolation.
 */
export async function beginTestTransaction(): Promise<any> {
  if (!testDataSource || !testDataSource.isInitialized) {
    throw new Error('Test data source not initialized');
  }

  const queryRunner = testDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  return queryRunner;
}

/**
 * Rollback a test transaction.
 */
export async function rollbackTestTransaction(queryRunner: any): Promise<void> {
  if (queryRunner.isTransactionActive) {
    await queryRunner.rollbackTransaction();
  }
  await queryRunner.release();
}

/**
 * Commit a test transaction.
 */
export async function commitTestTransaction(queryRunner: any): Promise<void> {
  if (queryRunner.isTransactionActive) {
    await queryRunner.commitTransaction();
  }
  await queryRunner.release();
}

// Global setup
beforeAll(async () => {
  await getTestDataSource();
});

// Global teardown
afterAll(async () => {
  await closeTestDataSource();
});

// Clean between tests
afterEach(async () => {
  await clearTestData();
});
