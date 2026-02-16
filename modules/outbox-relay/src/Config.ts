/**
 * Configuration management for the outbox-relay service.
 *
 * Handles Postgres connection settings, RabbitMQ connection settings,
 * batch processing settings, retry/backoff settings, health check settings,
 * and metrics configuration.
 *
 * @module Config
 */

import { z } from 'zod';
import dotenv from 'dotenv';

/**
 * Load environment variables
 */
dotenv.config();

/**
 * Zod schema for Postgres configuration
 */
const PostgresConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.coerce.number().int().positive().default(5432),
  database: z.string().default('cypher_erp'),
  username: z.string().default('cypher_user'),
  password: z.string().default('cypher_secret'),
  ssl: z.coerce.boolean().default(false),
  max: z.coerce.number().int().positive().default(20),
  idleTimeoutMillis: z.coerce.number().int().positive().default(30000),
  connectionTimeoutMillis: z.coerce.number().int().positive().default(10000),
});

/**
 * Zod schema for RabbitMQ configuration
 */
const RabbitMQConfigSchema = z.object({
  url: z.string().default('amqp://localhost:5672'),
  hostname: z.string().default('localhost'),
  port: z.coerce.number().int().positive().default(5672),
  username: z.string().optional(),
  password: z.string().optional(),
  vhost: z.string().default('/'),
  protocol: z.enum(['amqp', 'amqps']).default('amqp'),
  frameMax: z.coerce.number().int().positive().default(0),
  heartbeat: z.coerce.number().int().nonnegative().default(60),
  connectionTimeout: z.coerce.number().int().positive().default(10000),
  requestTimeout: z.coerce.number().int().positive().default(30000),
  socketTimeout: z.coerce.number().int().positive().default(30000),
  prefetchCount: z.coerce.number().int().positive().default(10),
  publisherConfirms: z.coerce.boolean().default(true),
  mandatory: z.coerce.boolean().default(true),
  retryDelay: z.coerce.number().int().positive().default(5000),
  maxRetries: z.coerce.number().int().positive().default(5),
});

/**
 * Zod schema for batch processing configuration
 */
const BatchConfigSchema = z.object({
  size: z.coerce.number().int().positive().default(100),
  intervalMs: z.coerce.number().int().positive().default(5000),
  maxWaitMs: z.coerce.number().int().positive().default(60000),
  maxSize: z.coerce.number().int().positive().default(500),
});

/**
 * Zod schema for retry and backoff configuration
 */
const RetryConfigSchema = z.object({
  maxAttempts: z.coerce.number().int().positive().default(3),
  initialDelayMs: z.coerce.number().int().positive().default(1000),
  maxDelayMs: z.coerce.number().int().positive().default(60000),
  backoffMultiplier: z.coerce.number().positive().default(2),
  jitter: z.coerce.boolean().default(true),
  jitterRatio: z.coerce.number().min(0).max(1).default(0.1),
});

/**
 * Zod schema for circuit breaker configuration
 */
const CircuitBreakerConfigSchema = z.object({
  enabled: z.coerce.boolean().default(true),
  failureThreshold: z.coerce.number().int().positive().default(5),
  successThreshold: z.coerce.number().int().positive().default(2),
  timeoutMs: z.coerce.number().int().positive().default(30000),
  halfOpenMaxCalls: z.coerce.number().int().positive().default(3),
});

/**
 * Zod schema for health check configuration
 */
const HealthCheckConfigSchema = z.object({
  enabled: z.coerce.boolean().default(true),
  port: z.coerce.number().int().positive().default(9090),
  path: z.string().default('/health'),
  readinessPath: z.string().default('/ready'),
  livenessPath: z.string().default('/live'),
  startupPath: z.string().default('/startup'),
  intervalMs: z.coerce.number().int().positive().default(10000),
  timeoutMs: z.coerce.number().int().positive().default(5000),
  startupTimeoutMs: z.coerce.number().int().positive().default(120000),
});

/**
 * Zod schema for metrics configuration
 */
const MetricsConfigSchema = z.object({
  enabled: z.coerce.boolean().default(true),
  port: z.coerce.number().int().positive().default(9091),
  path: z.string().default('/metrics'),
  defaultLabels: z.record(z.string(), z.string()).default({}),
  collectDefaultMetrics: z.coerce.boolean().default(true),
  pushgatewayUrl: z.string().optional(),
  pushgatewayIntervalMs: z.coerce.number().int().positive().default(15000),
  pushgatewayJobName: z.string().default('outbox-relay'),
});

/**
 * Zod schema for relay configuration
 */
const RelayConfigSchema = z.object({
  mode: z.enum(['polling', 'continuous']).default('continuous'),
  consumerName: z.string().default('outbox-relay'),
  processOnStartup: z.coerce.boolean().default(true),
  gracefulShutdownTimeoutMs: z.coerce.number().int().positive().default(30000),
});

/**
 * Zod schema for complete configuration
 */
const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('production'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  postgres: PostgresConfigSchema,
  rabbitmq: RabbitMQConfigSchema,
  batch: BatchConfigSchema,
  retry: RetryConfigSchema,
  circuitBreaker: CircuitBreakerConfigSchema,
  healthCheck: HealthCheckConfigSchema,
  metrics: MetricsConfigSchema,
  relay: RelayConfigSchema,
});

/**
 * Postgres configuration interface
 */
export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

/**
 * RabbitMQ configuration interface
 */
export interface RabbitMQConfig {
  url: string;
  hostname: string;
  port: number;
  username?: string;
  password?: string;
  vhost: string;
  protocol: 'amqp' | 'amqps';
  frameMax: number;
  heartbeat: number;
  connectionTimeout: number;
  requestTimeout: number;
  socketTimeout: number;
  prefetchCount: number;
  publisherConfirms: boolean;
  mandatory: boolean;
  retryDelay: number;
  maxRetries: number;
}

/**
 * Batch processing configuration interface
 */
export interface BatchConfig {
  size: number;
  intervalMs: number;
  maxWaitMs: number;
  maxSize: number;
}

/**
 * Retry and backoff configuration interface
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  jitterRatio: number;
}

/**
 * Circuit breaker configuration interface
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxCalls: number;
}

/**
 * Health check configuration interface
 */
export interface HealthCheckConfig {
  enabled: boolean;
  port: number;
  path: string;
  readinessPath: string;
  livenessPath: string;
  startupPath: string;
  intervalMs: number;
  timeoutMs: number;
  startupTimeoutMs: number;
}

/**
 * Metrics configuration interface
 */
export interface MetricsConfig {
  enabled: boolean;
  port: number;
  path: string;
  defaultLabels: Record<string, string>;
  collectDefaultMetrics: boolean;
  pushgatewayUrl?: string;
  pushgatewayIntervalMs: number;
  pushgatewayJobName: string;
}

/**
 * Relay configuration interface
 */
export interface RelayConfig {
  mode: 'polling' | 'continuous';
  consumerName: string;
  processOnStartup: boolean;
  gracefulShutdownTimeoutMs: number;
}

/**
 * Complete configuration interface
 */
export interface Config {
  env: 'development' | 'staging' | 'production';
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  postgres: PostgresConfig;
  rabbitmq: RabbitMQConfig;
  batch: BatchConfig;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  healthCheck: HealthCheckConfig;
  metrics: MetricsConfig;
  relay: RelayConfig;
}

/**
 * Configuration class with validation and environment loading
 */
export class OutboxRelayConfig {
  private static instance: OutboxRelayConfig | null = null;
  private readonly config: Config;

  private constructor() {
    this.config = this.loadAndValidateConfig();
  }

  /**
   * Gets the singleton instance of the configuration
   *
   * @returns Configuration instance
   */
  public static getInstance(): OutboxRelayConfig {
    if (!OutboxRelayConfig.instance) {
      OutboxRelayConfig.instance = new OutboxRelayConfig();
    }
    return OutboxRelayConfig.instance;
  }

  /**
   * Gets the complete configuration
   *
   * @returns Complete configuration object
   */
  public getConfig(): Config {
    return this.config;
  }

  /**
   * Loads and validates configuration from environment variables
   *
   * @returns Validated configuration
   * @throws Error if configuration is invalid
   * @private
   */
  private loadAndValidateConfig(): Config {
    const rawConfig = {
      env: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL,
      postgres: {
        host: process.env.DB_HOST || process.env.POSTGRES_HOST,
        port: process.env.DB_PORT || process.env.POSTGRES_PORT,
        database: process.env.DB_NAME || process.env.POSTGRES_DB,
        username: process.env.DB_USER || process.env.DB_USERNAME || process.env.POSTGRES_USER,
        password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
        ssl: process.env.DB_SSL,
        max: process.env.DB_POOL_MAX,
        idleTimeoutMillis: process.env.DB_POOL_IDLE_TIMEOUT,
        connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT,
      },
      rabbitmq: {
        url: process.env.RABBITMQ_URL,
        hostname: process.env.RABBITMQ_HOST,
        port: process.env.RABBITMQ_PORT,
        username: process.env.RABBITMQ_USER,
        password: process.env.RABBITMQ_PASSWORD,
        vhost: process.env.RABBITMQ_VHOST,
        protocol: process.env.RABBITMQ_PROTOCOL,
        frameMax: process.env.RABBITMQ_FRAME_MAX,
        heartbeat: process.env.RABBITMQ_HEARTBEAT,
        connectionTimeout: process.env.RABBITMQ_CONNECTION_TIMEOUT,
        requestTimeout: process.env.RABBITMQ_REQUEST_TIMEOUT,
        socketTimeout: process.env.RABBITMQ_SOCKET_TIMEOUT,
        prefetchCount: process.env.RABBITMQ_PREFETCH_COUNT,
        publisherConfirms: process.env.RABBITMQ_PUBLISHER_CONFIRMS,
        mandatory: process.env.RABBITMQ_MANDATORY,
        retryDelay: process.env.RABBITMQ_RETRY_DELAY,
        maxRetries: process.env.RABBITMQ_MAX_RETRIES,
      },
      batch: {
        size: process.env.OUTBOX_BATCH_SIZE,
        intervalMs: process.env.OUTBOX_BATCH_INTERVAL_MS,
        maxWaitMs: process.env.OUTBOX_BATCH_MAX_WAIT_MS,
        maxSize: process.env.OUTBOX_BATCH_MAX_SIZE,
      },
      retry: {
        maxAttempts: process.env.OUTBOX_RETRY_MAX_ATTEMPTS,
        initialDelayMs: process.env.OUTBOX_RETRY_INITIAL_DELAY_MS,
        maxDelayMs: process.env.OUTBOX_RETRY_MAX_DELAY_MS,
        backoffMultiplier: process.env.OUTBOX_RETRY_BACKOFF_MULTIPLIER,
        jitter: process.env.OUTBOX_RETRY_JITTER,
        jitterRatio: process.env.OUTBOX_RETRY_JITTER_RATIO,
      },
      circuitBreaker: {
        enabled: process.env.CIRCUIT_BREAKER_ENABLED,
        failureThreshold: process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        successThreshold: process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
        timeoutMs: process.env.CIRCUIT_BREAKER_TIMEOUT_MS,
        halfOpenMaxCalls: process.env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS,
      },
      healthCheck: {
        enabled: process.env.HEALTH_CHECK_ENABLED,
        port: process.env.HEALTH_CHECK_PORT,
        path: process.env.HEALTH_CHECK_PATH,
        readinessPath: process.env.HEALTH_CHECK_READINESS_PATH,
        livenessPath: process.env.HEALTH_CHECK_LIVENESS_PATH,
        startupPath: process.env.HEALTH_CHECK_STARTUP_PATH,
        intervalMs: process.env.HEALTH_CHECK_INTERVAL_MS,
        timeoutMs: process.env.HEALTH_CHECK_TIMEOUT_MS,
        startupTimeoutMs: process.env.HEALTH_CHECK_STARTUP_TIMEOUT_MS,
      },
      metrics: {
        enabled: process.env.METRICS_ENABLED,
        port: process.env.METRICS_PORT,
        path: process.env.METRICS_PATH,
        defaultLabels: process.env.METRICS_DEFAULT_LABELS
          ? JSON.parse(process.env.METRICS_DEFAULT_LABELS)
          : {},
        collectDefaultMetrics: process.env.METRICS_COLLECT_DEFAULT,
        pushgatewayUrl: process.env.METRICS_PUSHGATEWAY_URL,
        pushgatewayIntervalMs: process.env.METRICS_PUSHGATEWAY_INTERVAL_MS,
        pushgatewayJobName: process.env.METRICS_PUSHGATEWAY_JOB_NAME,
      },
      relay: {
        mode: process.env.OUTBOX_RELAY_MODE,
        consumerName: process.env.OUTBOX_CONSUMER_NAME,
        processOnStartup: process.env.OUTBOX_PROCESS_ON_STARTUP,
        gracefulShutdownTimeoutMs: process.env.OUTBOX_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
      },
    };

    try {
      return ConfigSchema.parse(rawConfig);
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  /**
   * Gets the Postgres connection string
   *
   * @returns Postgres connection string
   */
  public getPostgresConnectionString(): string {
    const pg = this.config.postgres;
    const ssl = pg.ssl ? '?sslmode=require' : '';
    return `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}${ssl}`;
  }

  /**
   * Gets the RabbitMQ connection string
   *
   * @returns RabbitMQ connection string
   */
  public getRabbitMQConnectionString(): string {
    return this.config.rabbitmq.url;
  }

  /**
   * Checks if running in development mode
   *
   * @returns True if development mode
   */
  public isDevelopment(): boolean {
    return this.config.env === 'development';
  }

  /**
   * Checks if running in production mode
   *
   * @returns True if production mode
   */
  public isProduction(): boolean {
    return this.config.env === 'production';
  }

  /**
   * Validates the configuration
   *
   * @returns True if configuration is valid
   */
  public validate(): boolean {
    try {
      ConfigSchema.parse(this.config);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets a specific configuration value by path
   *
   * @param path - Dot-notation path to the value (e.g., 'postgres.host')
   * @returns Configuration value or undefined
   */
  public get(path: string): unknown {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }
}

/**
 * Gets the global configuration instance
 *
 * @returns Configuration instance
 */
export function getConfig(): Config {
  return OutboxRelayConfig.getInstance().getConfig();
}

/**
 * Gets the configuration manager instance
 *
 * @returns Configuration manager
 */
export function getConfigManager(): OutboxRelayConfig {
  return OutboxRelayConfig.getInstance();
}

export default OutboxRelayConfig;
