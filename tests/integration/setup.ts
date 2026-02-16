/**
 * Integration Test Setup
 * 
 * This file is loaded before all integration tests.
 * It sets up the database connection and provides cleanup utilities.
 */

import { beforeAll, afterAll, afterEach } from '@jest/globals';
import { DataSource } from 'typeorm';

let testDataSource: DataSource | null = null;

/**
 * Get or create the test database connection.
 * Uses an isolated in-memory datasource for fast, deterministic tests.
 *
 * Note: current integration tests in this folder are contract-style and
 * factory-driven; they do not require real entity metadata.
 */
export async function getTestDataSource(): Promise<DataSource> {
    if (testDataSource && testDataSource.isInitialized) {
        return testDataSource;
    }

    testDataSource = new DataSource({
        type: 'sqlite',
        database: ':memory:',
        synchronize: false,
        dropSchema: false,
        entities: [],
        logging: false,
    });

    await testDataSource.initialize();
    return testDataSource;
}

/**
 * Close the test database connection.
 */
export async function closeTestDataSource(): Promise<void> {
    if (testDataSource && testDataSource.isInitialized) {
        await testDataSource.destroy();
        testDataSource = null;
    }
}

/**
 * Clear all data from the test database.
 * Useful between tests to ensure isolation.
 */
export async function clearTestData(): Promise<void> {
    if (!testDataSource || !testDataSource.isInitialized) {
        return;
    }

    const entities = testDataSource.entityMetadatas;
    for (const entity of entities) {
        const repository = testDataSource.getRepository(entity.name);
        await repository.clear();
    }
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
