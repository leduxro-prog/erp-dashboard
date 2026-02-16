import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  maxWorkers: process.env.JEST_MAX_WORKERS || '50%',
  workerIdleMemoryLimit: '512MB',
  setupFiles: ['<rootDir>/tests/jest-setup.ts'],
  roots: ['<rootDir>/shared', '<rootDir>/modules', '<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts', '**/*SmokeTests.ts', '**/RollbackDrillTests.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/**/types.ts',
    '!src/**/types/**',
  ],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
