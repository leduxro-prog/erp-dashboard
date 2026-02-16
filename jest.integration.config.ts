import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    maxWorkers: 2,
    workerIdleMemoryLimit: '512MB',
    roots: ['<rootDir>/tests/integration'],
    testMatch: ['**/*.integration.test.ts'],
    moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '^@modules/(.*)$': '<rootDir>/modules/$1',
        '^@database/(.*)$': '<rootDir>/database/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
    testTimeout: 30000, // 30 seconds for DB operations
    verbose: true,
};

export default config;
