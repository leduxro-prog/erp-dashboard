// Jest setup file — runs before test modules are loaded
// Sets required environment variables for tests

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Runtime .env may provide local Docker credentials, but DB host/name are forced below.
const runtimeEnvPath = process.env.CYPHER_ERP_ENV_FILE || '/opt/cypher-erp/.env';
if (runtimeEnvPath && fs.existsSync(runtimeEnvPath)) {
  dotenv.config({ path: runtimeEnvPath });
}

process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-unit-tests-minimum-32-characters';
process.env.NODE_ENV = 'test';

process.env.RABBITMQ_HOST = process.env.RABBITMQ_HOST || 'localhost';
process.env.RABBITMQ_PORT = process.env.RABBITMQ_PORT || '5672';
process.env.RABBITMQ_USER = process.env.RABBITMQ_USER || 'admin';
process.env.RABBITMQ_PASSWORD = process.env.RABBITMQ_PASSWORD || 'admin';
process.env.RABBITMQ_VHOST = process.env.RABBITMQ_VHOST || '/';
process.env.RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  `amqp://${encodeURIComponent(process.env.RABBITMQ_USER)}:${encodeURIComponent(
    process.env.RABBITMQ_PASSWORD,
  )}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}/${encodeURIComponent(
    process.env.RABBITMQ_VHOST,
  )}`;

process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.DB_USER = process.env.TEST_DB_USERNAME || process.env.DB_USER || process.env.DB_USERNAME || 'cypher_user';
process.env.DB_USERNAME = process.env.DB_USER;
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || 'cypher_secret';
process.env.DB_NAME = process.env.DB_NAME || 'cypher_erp';
process.env.TEST_DB_HOST = process.env.TEST_DB_HOST || process.env.DB_HOST;
process.env.TEST_DB_PORT = process.env.TEST_DB_PORT || process.env.DB_PORT;
process.env.TEST_DB_USERNAME = process.env.TEST_DB_USERNAME || process.env.DB_USER;
process.env.TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD;
process.env.TEST_DB_DATABASE = process.env.TEST_DB_DATABASE || 'cypher_erp_test';
