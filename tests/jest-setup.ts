// Jest setup file — runs before test modules are loaded
// Sets required environment variables for tests

process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-unit-tests-minimum-32-characters';
process.env.NODE_ENV = 'test';
