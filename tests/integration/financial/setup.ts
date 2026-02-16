/**
 * Financial Integration Test Setup
 *
 * Sets up test database connection with PostgreSQL
 * for financial transaction tests.
 */

import { beforeAll, afterAll, afterEach, beforeEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { B2BCustomerEntity } from '@modules/b2b-portal/src/infrastructure/entities/B2BCustomerEntity';
import { CreditTransactionEntity } from '@modules/b2b-portal/src/infrastructure/entities/CreditTransactionEntity';
import { CartEntity } from '@modules/checkout/src/domain/entities/CartEntity';
import { CreditReservationEntity } from '@modules/checkout/src/domain/entities/CreditReservationEntity';
import { OrderEntity } from '@modules/orders/src/infrastructure/entities/OrderEntity';
import { OrderItemEntity } from '@modules/orders/src/infrastructure/entities/OrderItemEntity';
import { StockReservationEntity } from '@modules/inventory/src/infrastructure/entities/StockReservationEntity';
import { StockItemEntity } from '@modules/inventory/src/infrastructure/entities/StockItemEntity';

let testDataSource: DataSource | null = null;

/**
 * Get or create the test database connection.
 */
export async function getTestDataSource(): Promise<DataSource> {
  if (testDataSource && testDataSource.isInitialized) {
    return testDataSource;
  }

  const dbHost = process.env.TEST_DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.TEST_DB_PORT || '5432', 10);
  const dbUsername = process.env.TEST_DB_USERNAME || 'postgres';
  const dbPassword = process.env.TEST_DB_PASSWORD || 'postgres';
  const dbDatabase = process.env.TEST_DB_DATABASE || 'cypher_erp_test';

  testDataSource = new DataSource({
    type: 'postgres',
    host: dbHost,
    port: dbPort,
    username: dbUsername,
    password: dbPassword,
    database: dbDatabase,
    synchronize: false,
    dropSchema: false,
    logging: false,
    entities: [
      B2BCustomerEntity,
      CreditTransactionEntity,
      CartEntity,
      CreditReservationEntity,
      OrderEntity,
      OrderItemEntity,
      StockReservationEntity,
      StockItemEntity,
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

  // Clear tables in dependency order (child tables first)
  const repositories = [
    testDataSource.getRepository(StockReservationEntity),
    testDataSource.getRepository(CreditReservationEntity),
    testDataSource.getRepository(OrderItemEntity),
    testDataSource.getRepository(OrderEntity),
    testDataSource.getRepository(CreditTransactionEntity),
    testDataSource.getRepository(CartEntity),
    testDataSource.getRepository(StockItemEntity),
    testDataSource.getRepository(B2BCustomerEntity),
  ];

  for (const repo of repositories) {
    try {
      await repo.clear();
    } catch (error) {
      console.warn(`Failed to clear table: ${(error as Error).message}`);
    }
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
