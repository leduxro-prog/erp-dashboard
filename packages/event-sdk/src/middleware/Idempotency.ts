/**
 * @file Idempotency Middleware
 * @module event-sdk/middleware/Idempotency
 * @description Idempotency check middleware using shared.processed_events table
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import {
  MiddlewareFunction,
  MiddlewareContext,
  IdempotencyConfig,
  Logger,
  ErrorType,
  ErrorSeverity,
  ClassifiedError,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Processed event record from database
 */
export interface ProcessedEventRecord {
  id: string;
  event_id: string;
  event_type: string;
  consumer_name: string;
  consumer_group?: string;
  status: string;
  processed_at: Date;
  processing_duration_ms?: number;
  processing_attempts: number;
  result?: string;
  output?: unknown;
  error_message?: string;
  retry_count: number;
  next_retry_at?: Date;
  max_retries: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Error thrown when duplicate event is detected
 */
export class DuplicateEventError extends Error {
  constructor(
    message: string,
    public readonly eventId: string,
    public readonly consumerName: string,
    public readonly originalProcessedAt?: Date
  ) {
    super(message);
    this.name = 'DuplicateEventError';
  }
}

/**
 * Default idempotency configuration
 */
const DEFAULT_IDEMPOTENCY_CONFIG: Required<IdempotencyConfig> = {
  enabled: true,
  connectionString: '',
  tableName: 'processed_events',
  schema: 'shared',
  ttl: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  enableBatching: false,
  batchSize: 100,
  maxConcurrentChecks: 10,
};

/**
 * Idempotency check result
 */
export interface IdempotencyCheckResult {
  /** Whether event was already processed */
  alreadyProcessed: boolean;
  /** Original processing time if already processed */
  originalProcessedAt?: Date;
  /** Number of times event was processed */
  processingCount?: number;
  /** Original output if available */
  originalOutput?: unknown;
}

/**
 * Idempotency Middleware
 *
 * Checks if an event has already been processed by this consumer
 * using the shared.processed_events table. Ensures exactly-once semantics.
 */
export class IdempotencyMiddleware {
  private config: Required<IdempotencyConfig>;
  private logger?: Logger;
  private pool?: Pool;
  private consumerName: string;
  private consumerGroup?: string;
  private cache: Map<string, ProcessedEventRecord> = new Map();
  private cacheEnabled: boolean = true;
  private cacheSize: number = 1000;

  constructor(
    consumerName: string,
    config: Partial<IdempotencyConfig> = {},
    logger?: Logger
  ) {
    this.consumerName = consumerName;
    this.consumerGroup = config.consumerGroup;
    this.config = {
      ...DEFAULT_IDEMPOTENCY_CONFIG,
      ...config,
      connectionString: config.connectionString ?? DEFAULT_IDEMPOTENCY_CONFIG.connectionString,
      tableName: config.tableName ?? DEFAULT_IDEMPOTENCY_CONFIG.tableName,
      schema: config.schema ?? DEFAULT_IDEMPOTENCY_CONFIG.schema,
      ttl: config.ttl ?? DEFAULT_IDEMPOTENCY_CONFIG.ttl,
      enableBatching: config.enableBatching ?? DEFAULT_IDEMPOTENCY_CONFIG.enableBatching,
      batchSize: config.batchSize ?? DEFAULT_IDEMPOTENCY_CONFIG.batchSize,
      maxConcurrentChecks:
        config.maxConcurrentChecks ?? DEFAULT_IDEMPOTENCY_CONFIG.maxConcurrentChecks,
    };
    this.logger = logger;

    // Initialize connection pool if connection string is provided
    if (this.config.connectionString) {
      this.initializePool();
    }
  }

  /**
   * Create a middleware function for use in the pipeline
   *
   * @returns Middleware function
   */
  public middleware(): MiddlewareFunction {
    return async (context: MiddlewareContext, next: () => Promise<void>) => {
      // Skip if disabled or idempotency check was skipped
      if (!this.config.enabled || context.idempotencySkipped) {
        await next();
        return;
      }

      const eventId = context.envelope.event_id;

      // Check cache first
      if (this.cacheEnabled) {
        const cached = this.cache.get(eventId);
        if (cached) {
          this.handleDuplicate(context, cached);
          return;
        }
      }

      // Check database
      const result = await this.checkAlreadyProcessed(eventId);

      if (result.alreadyProcessed) {
        // Add to cache
        if (this.cacheEnabled && this.cache.size < this.cacheSize) {
          const record: ProcessedEventRecord = {
            id: uuidv4(),
            event_id: eventId,
            event_type: context.envelope.event_type,
            consumer_name: this.consumerName,
            consumer_group: this.consumerGroup,
            status: 'completed',
            processed_at: result.originalProcessedAt || new Date(),
            processing_attempts: result.processingCount || 1,
            retry_count: 0,
            max_retries: 3,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
          };
          this.cache.set(eventId, record);
        }

        this.handleDuplicate(context, undefined, result.originalProcessedAt);
        return;
      }

      // Mark as processing
      await this.markAsProcessing(eventId, context.envelope.event_type);

      try {
        // Continue with processing
        await next();

        // Record successful processing
        await this.recordProcessing(eventId, context.envelope.event_type, {
          status: 'completed',
          duration: Date.now() - context.startTime,
        });

        // Add to cache
        if (this.cacheEnabled && this.cache.size < this.cacheSize) {
          const record: ProcessedEventRecord = {
            id: uuidv4(),
            event_id: eventId,
            event_type: context.envelope.event_type,
            consumer_name: this.consumerName,
            consumer_group: this.consumerGroup,
            status: 'completed',
            processed_at: new Date(),
            processing_duration_ms: Date.now() - context.startTime,
            processing_attempts: 1,
            retry_count: context.retryAttempt,
            max_retries: 3,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
          };
          this.cache.set(eventId, record);
        }
      } catch (error) {
        // Record failed processing
        await this.recordProcessing(eventId, context.envelope.event_type, {
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        });
        throw error;
      }
    };
  }

  /**
   * Handle duplicate event
   *
   * @param context - Middleware context
   * @param record - Cached processed event record
   * @param originalProcessedAt - Original processing time
   */
  private handleDuplicate(
    context: MiddlewareContext,
    record?: ProcessedEventRecord,
    originalProcessedAt?: Date
  ): void {
    const processedAt = record?.processed_at || originalProcessedAt;

    this.debug('Duplicate event detected, skipping processing', {
      eventId: context.envelope.event_id,
      eventType: context.envelope.event_type,
      consumer: this.consumerName,
      originallyProcessedAt: processedAt,
    });

    // Set context to skip remaining middleware
    context.skipRemaining = true;

    // Create duplicate event error but don't throw
    const duplicateError = Object.assign(
      new DuplicateEventError(
        `Event ${context.envelope.event_id} was already processed by ${this.consumerName}`,
        context.envelope.event_id,
        this.consumerName,
        processedAt
      ),
      {
        type: ErrorType.DUPLICATE_EVENT,
        severity: ErrorSeverity.LOW,
        retryable: false,
      }
    );

    context.error = duplicateError as ClassifiedError;
  }

  /**
   * Check if event was already processed
   *
   * @param eventId - Event ID to check
   * @returns Check result
   */
  private async checkAlreadyProcessed(
    eventId: string
  ): Promise<IdempotencyCheckResult> {
    try {
      const result = await this.executeQuery(
        `SELECT event_id, processed_at, processing_attempts, output
         FROM ${this.config.schema}.${this.config.tableName}
         WHERE consumer_name = $1 AND event_id = $2
         LIMIT 1`,
        [this.consumerName, eventId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          alreadyProcessed: true,
          originalProcessedAt: row.processed_at,
          processingCount: row.processing_attempts,
          originalOutput: row.output,
        };
      }

      return { alreadyProcessed: false };
    } catch (error) {
      this.error('Failed to check idempotency:', error);
      // On error, allow processing to continue (fail open)
      return { alreadyProcessed: false };
    }
  }

  /**
   * Mark event as being processed
   *
   * @param eventId - Event ID
   * @param eventType - Event type
   */
  private async markAsProcessing(eventId: string, eventType: string): Promise<void> {
    try {
      await this.executeQuery(
        `INSERT INTO ${this.config.schema}.${this.config.tableName}
         (event_id, event_type, consumer_name, consumer_group, status, processed_at, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, 'in_progress', NOW(), 0, 3)
         ON CONFLICT (consumer_name, event_id) DO NOTHING`,
        [eventId, eventType, this.consumerName, this.consumerGroup || null]
      );
    } catch (error) {
      this.error('Failed to mark event as processing:', error);
    }
  }

  /**
   * Record event processing result
   *
   * @param eventId - Event ID
   * @param eventType - Event type
   * @param result - Processing result
   */
  private async recordProcessing(
    eventId: string,
    eventType: string,
    result: {
      status: 'completed' | 'failed';
      duration?: number;
      error?: Error;
      output?: unknown;
    }
  ): Promise<void> {
    try {
      const duration = result.duration || 0;
      const status = result.status;
      const errorMessage = result.error?.message;
      const errorCode = result.error?.name;

      await this.executeQuery(
        `UPDATE ${this.config.schema}.${this.config.tableName}
         SET status = $1,
             processing_duration_ms = COALESCE(processing_duration_ms, 0) + $2,
             processing_attempts = processing_attempts + 1,
             result = $3,
             output = $4,
             error_message = $5,
             error_code = $6,
             updated_at = NOW()
         WHERE consumer_name = $7 AND event_id = $8`,
        [
          status,
          duration,
          status === 'completed' ? 'success' : 'failed',
          result.output ? JSON.stringify(result.output) : null,
          errorMessage || null,
          errorCode || null,
          this.consumerName,
          eventId,
        ]
      );

      // Clean up old records if TTL is set
      if (this.config.ttl > 0) {
        this.cleanupOldRecords();
      }
    } catch (error) {
      this.error('Failed to record event processing:', error);
    }
  }

  /**
   * Clean up old processed event records
   */
  private async cleanupOldRecords(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.ttl);

    try {
      await this.executeQuery(
        `DELETE FROM ${this.config.schema}.${this.config.tableName}
         WHERE consumer_name = $1 AND updated_at < $2`,
        [this.consumerName, cutoffDate]
      );

      this.debug('Cleaned up old processed event records', { cutoffDate });
    } catch (error) {
      this.error('Failed to cleanup old records:', error);
    }
  }

  /**
   * Execute a database query
   *
   * @param query - SQL query
   * @param params - Query parameters
   * @returns Query result
   */
  private async executeQuery(
    query: string,
    params: unknown[] = []
  ): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Provide a connection string.');
    }

    const client = await this.pool.connect();
    try {
      return await client.query(query, params);
    } finally {
      client.release();
    }
  }

  /**
   * Initialize database connection pool
   */
  private initializePool(): void {
    try {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      this.pool.on('error', (err) => {
        this.error('Unexpected error on idle client:', err);
      });

      this.debug('Database connection pool initialized');
    } catch (error) {
      this.error('Failed to initialize database pool:', error);
    }
  }

  /**
   * Set a custom database pool
   *
   * @param pool - PG pool instance
   */
  public setPool(pool: Pool): void {
    this.pool = pool;
  }

  /**
   * Enable or disable the cache
   *
   * @param enabled - Whether to enable cache
   */
  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.cache.clear();
    }
  }

  /**
   * Set the maximum cache size
   *
   * @param size - Maximum cache size
   */
  public setCacheSize(size: number): void {
    this.cacheSize = size;
    this.pruneCache();
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Prune cache to fit within size limit
   */
  private pruneCache(): void {
    while (this.cache.size > this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Get the current configuration
   *
   * @returns Current idempotency configuration
   */
  public getConfig(): Readonly<Required<IdempotencyConfig>> {
    return { ...this.config };
  }

  /**
   * Update the configuration
   *
   * @param config - New configuration values
   */
  public updateConfig(config: Partial<IdempotencyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      connectionString: config.connectionString ?? this.config.connectionString,
      tableName: config.tableName ?? this.config.tableName,
      schema: config.schema ?? this.config.schema,
      ttl: config.ttl ?? this.config.ttl,
      enableBatching: config.enableBatching ?? this.config.enableBatching,
      batchSize: config.batchSize ?? this.config.batchSize,
      maxConcurrentChecks:
        config.maxConcurrentChecks ?? this.config.maxConcurrentChecks,
    };
  }

  /**
   * Set the logger
   *
   * @param logger - Logger instance
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  public getCacheStats(): { size: number; maxSize: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxSize: this.cacheSize,
      enabled: this.cacheEnabled,
    };
  }

  /**
   * Check if an event has already been processed (standalone)
   *
   * @param eventId - Event ID to check
   * @returns Whether event was already processed
   */
  public async isProcessed(eventId: string): Promise<boolean> {
    const result = await this.checkAlreadyProcessed(eventId);
    return result.alreadyProcessed;
  }

  /**
   * Reset an event's processing status (for manual retries)
   *
   * @param eventId - Event ID to reset
   */
  public async resetProcessing(eventId: string): Promise<void> {
    await this.executeQuery(
      `DELETE FROM ${this.config.schema}.${this.config.tableName}
       WHERE consumer_name = $1 AND event_id = $2`,
      [this.consumerName, eventId]
    );
    this.cache.delete(eventId);
  }

  /**
   * Close database connection pool
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
  }

  private debug(message: string, ...args: unknown[]): void {
    this.logger?.debug(`[Idempotency] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]): void {
    this.logger?.warn(`[Idempotency] ${message}`, ...args);
  }

  private error(message: string, ...args: unknown[]): void {
    this.logger?.error(`[Idempotency] ${message}`, ...args);
  }

}

/**
 * Create an idempotency middleware factory function
 *
 * @param consumerName - Consumer name
 * @param config - Optional configuration
 * @param logger - Optional logger
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const idempotency = createIdempotency('my-consumer', {
 *   connectionString: 'postgres://...',
 *   ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
 * });
 * processor.use(idempotency);
 * ```
 */
export function createIdempotency(
  consumerName: string,
  config: Partial<IdempotencyConfig> = {},
  logger?: Logger
): MiddlewareFunction {
  const middleware = new IdempotencyMiddleware(consumerName, config, logger);
  return middleware.middleware();
}
