import type { Config } from 'jest';

/**
 * Jest configuration for E2E tests
 *
 * E2E tests require longer timeouts and specific setup for
 * external services (RabbitMQ, Redis, Prometheus).
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  testMatch: ['**/*Test.ts', '**/*.test.ts', '**/*.e2e.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@event-sdk/(.*)$': '<rootDir>/packages/event-sdk/src/$1',
  },
  maxWorkers: 1, // Run E2E tests serially to avoid resource conflicts
  workerIdleMemoryLimit: '512MB',
  testTimeout: 60000, // 60 second timeout for E2E operations
  globalSetup: '<rootDir>/tests/e2e/setup.ts',
  globalTeardown: '<rootDir>/tests/e2e/teardown.ts',
  verbose: true,
  collectCoverageFrom: [
    'tests/e2e/**/*.ts',
    '!tests/e2e/**/*.d.ts',
  ],
  coverageDirectory: 'coverage/e2e',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tests/e2e/helpers/',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};

export default config;
