/**
 * Postgres repository for outbox event operations.
 *
 * Provides functions for fetching pending events, marking events as processing,
 * marking events as published, marking events as failed, and getting batch statistics.
 * Uses FOR UPDATE SKIP LOCKED for concurrent processing.
 *
 * @module OutboxRepository
 */

import pg, { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { OutboxLogger } from './logger';
import { getConfig, Config, PostgresConfig } from './Config';

/**
 * Outbox event status enum
 */
export enum OutboxStatus {
  Pending = 'pending',
  Processing = 'processing',
  Published = 'published',
  Failed = 'failed',
  Discarded = 'discarded',
}

/**
 * Outbox event priority enum
 */
export enum EventPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical',
}

/**
 * Outbox event domain enum
 */
export enum EventDomain {
  Catalog = 'catalog',
  Customer = 'customer',
  Order = 'order',
  Payment = 'payment',
  Credit = 'credit',
  Inventory = 'inventory',
  Shipping = 'shipping',
  Notification = 'notification',
  System = 'system',
}

/**
 * Outbox event interface
 */
export interface OutboxEvent {
  id: string;
  event_id: string;
  event_type: string;
  event_version: string;
  event_domain: EventDomain;
  source_service: string;
  source_entity_type?: string;
  source_entity_id?: string;
  correlation_id?: string;
  causation_id?: string;
  parent_event_id?: string;
  payload: Record<string, unknown>;
  payload_size?: number;
  metadata: Record<string, unknown>;
  content_type: string;
  priority: EventPriority;
  publish_to: string;
  exchange?: string;
  routing_key?: string;
  topic?: string;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  occurred_at: Date;
  created_at: Date;
  published_at?: Date;
  failed_at?: Date;
  error_message?: string;
  error_code?: string;
  error_details?: Record<string, unknown>;
  version: number;
  updated_at: Date;
}

/**
 * Batch statistics interface
 */
export interface BatchStatistics {
  pending: number;
  processing: number;
  published: number;
  failed: number;
  discarded: number;
  total: number;
  oldestPending?: Date;
  newestPending?: Date;
}

/**
 * Repository configuration interface
 */
export interface RepositoryConfig {
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}

/**
 * Postgres repository for outbox events
 */
export class OutboxRepository {
  private readonly pool: Pool;
  private readonly logger: OutboxLogger;
  private readonly config: PostgresConfig;
  private isConnected: boolean = false;

  /**
   * Creates a new OutboxRepository instance
   *
   * @param config - Postgres configuration
   * @param logger - Logger instance
   */
  constructor(config?: PostgresConfig, logger?: OutboxLogger) {
    this.config = config || getConfig().postgres;
    this.logger = logger || new OutboxLogger();

    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      max: this.config.max,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('connect', () => {
      this.isConnected = true;
      this.logger.debug('PostgreSQL pool connection established');
    });

    this.pool.on('error', (err) => {
      this.logger.error('PostgreSQL pool error', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      if (this.pool.totalCount === 0) {
        this.isConnected = false;
        this.logger.debug('All PostgreSQL pool connections removed');
      }
    });
  }

  /**
   * Initializes the repository by testing the connection
   *
   * @returns Promise that resolves when initialized
   */
  public async initialize(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      this.logger.info('OutboxRepository initialized', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
      });
    } catch (error) {
      this.logger.error('Failed to initialize OutboxRepository', error as Error);
      throw error;
    }
  }

  /**
   * Fetches pending events from the outbox table
   *
   * Uses FOR UPDATE SKIP LOCKED to allow concurrent processing
   *
   * @param batchSize - Maximum number of events to fetch
   * @param consumerName - Name of the consumer
   * @param maxAttempts - Maximum number of attempts to consider
   * @returns Promise resolving to array of outbox events
   */
  public async fetchPendingEvents(
    batchSize: number,
    consumerName: string = 'outbox-relay',
    maxAttempts: number = 3
  ): Promise<OutboxEvent[]> {
    const startTime = Date.now();

    try {
      const query = `
        SELECT
          id,
          event_id,
          event_type,
          event_version,
          event_domain,
          source_service,
          source_entity_type,
          source_entity_id,
          correlation_id,
          causation_id,
          parent_event_id,
          payload,
          payload_size,
          metadata,
          content_type,
          priority,
          publish_to,
          exchange,
          routing_key,
          topic,
          status,
          attempts,
          max_attempts,
          next_attempt_at,
          occurred_at,
          created_at,
          published_at,
          failed_at,
          error_message,
          error_code,
          error_details,
          version,
          updated_at
        FROM shared.outbox_events
        WHERE status = 'pending'
          AND next_attempt_at <= NOW()
          AND attempts < $1
          AND NOT EXISTS (
            SELECT 1 FROM shared.processed_events pe
            WHERE pe.event_id = shared.outbox_events.event_id
              AND pe.consumer_name = $2
              AND pe.status = 'completed'
          )
        ORDER BY priority DESC, occurred_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      `;

      const result = await this.pool.query<OutboxEvent>(query, [maxAttempts, consumerName, batchSize]);

      const duration = Date.now() - startTime;
      this.logger.debug('Fetched pending events', {
        count: result.rows.length,
        batchSize,
        duration,
      });

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch pending events', error as Error, {
        batchSize,
        consumerName,
      });
      throw error;
    }
  }

  /**
   * Marks events as processing
   *
   * @param eventIds - Array of event IDs to mark
   * @returns Promise resolving to number of events marked
   */
  public async markEventsProcessing(eventIds: string[]): Promise<number> {
    if (eventIds.length === 0) {
      return 0;
    }

    try {
      const query = `
        UPDATE shared.outbox_events
        SET status = 'processing',
            attempts = attempts + 1,
            updated_at = NOW()
        WHERE id = ANY($1)
          AND status = 'pending'
      `;

      const result = await this.pool.query(query, [eventIds]);
      const count = result.rowCount || 0;

      this.logger.debug('Marked events as processing', {
        eventIds,
        count,
      });

      return count;
    } catch (error) {
      this.logger.error('Failed to mark events as processing', error as Error, {
        eventIds,
      });
      throw error;
    }
  }

  /**
   * Marks events as published successfully
   *
   * @param eventIds - Array of event IDs to mark
   * @returns Promise resolving to number of events marked
   */
  public async markEventsPublished(eventIds: string[]): Promise<number> {
    if (eventIds.length === 0) {
      return 0;
    }

    try {
      const query = `
        UPDATE shared.outbox_events
        SET status = 'published',
            published_at = NOW(),
            updated_at = NOW()
        WHERE id = ANY($1)
          AND status = 'processing'
      `;

      const result = await this.pool.query(query, [eventIds]);
      const count = result.rowCount || 0;

      this.logger.debug('Marked events as published', {
        eventIds,
        count,
      });

      return count;
    } catch (error) {
      this.logger.error('Failed to mark events as published', error as Error, {
        eventIds,
      });
      throw error;
    }
  }

  /**
   * Marks events as failed
   *
   * @param eventIds - Array of event IDs to mark
   * @param errorMessage - Error message
   * @param errorCode - Error code (optional)
   * @param retryAfterMs - Retry delay in milliseconds (default: 60000)
   * @returns Promise resolving to number of events marked
   */
  public async markEventsFailed(
    eventIds: string[],
    errorMessage: string,
    errorCode?: string,
    retryAfterMs: number = 60000
  ): Promise<{ failed: number; discarded: number }> {
    if (eventIds.length === 0) {
      return { failed: 0, discarded: 0 };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check which events should be discarded (max attempts reached)
      const discardCheckQuery = `
        SELECT id
        FROM shared.outbox_events
        WHERE id = ANY($1)
          AND attempts >= max_attempts
      `;
      const discardResult = await client.query(discardCheckQuery, [eventIds]);
      const discardIds = discardResult.rows.map((row) => row.id);

      // Mark events that should be discarded
      let discardedCount = 0;
      if (discardIds.length > 0) {
        const discardQuery = `
          UPDATE shared.outbox_events
          SET status = 'discarded',
              error_message = $2,
              error_code = $3,
              failed_at = NOW(),
              updated_at = NOW()
          WHERE id = ANY($1)
        `;
        const discardResult = await client.query(discardQuery, [discardIds, errorMessage, errorCode]);
        discardedCount = discardResult.rowCount || 0;
      }

      // Mark remaining events as failed
      let failedCount = 0;
      if (eventIds.length > discardIds.length) {
        const failedQuery = `
          UPDATE shared.outbox_events
          SET status = 'failed',
              attempts = attempts + 1,
              error_message = $2,
              error_code = $3,
              failed_at = NOW(),
              next_attempt_at = NOW() + ($4 || 'ms')::INTERVAL,
              updated_at = NOW()
          WHERE id = ANY($1)
            AND id != ALL($5)
        `;
        const failedResult = await client.query(failedQuery, [
          eventIds,
          errorMessage,
          errorCode,
          retryAfterMs,
          discardIds.length > 0 ? discardIds : [],
        ]);
        failedCount = failedResult.rowCount || 0;
      }

      await client.query('COMMIT');

      this.logger.debug('Marked events as failed/discarded', {
        failed: failedCount,
        discarded: discardedCount,
        total: eventIds.length,
      });

      return { failed: failedCount, discarded: discardedCount };
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to mark events as failed', error as Error, {
        eventIds,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Gets batch statistics for the outbox table
   *
   * @returns Promise resolving to batch statistics
   */
  public async getBatchStatistics(): Promise<BatchStatistics> {
    try {
      const query = `
        SELECT
          status,
          COUNT(*) AS count,
          MIN(occurred_at) AS oldest,
          MAX(occurred_at) AS newest
        FROM shared.outbox_events
        GROUP BY status
      `;

      const result = await this.pool.query(query);

      const stats: BatchStatistics = {
        pending: 0,
        processing: 0,
        published: 0,
        failed: 0,
        discarded: 0,
        total: 0,
      };

      for (const row of result.rows) {
        const status = row.status as OutboxStatus;
        const count = parseInt(row.count, 10);

        stats.total += count;

        switch (status) {
          case OutboxStatus.Pending:
            stats.pending = count;
            stats.oldestPending = row.oldest ? new Date(row.oldest) : undefined;
            stats.newestPending = row.newest ? new Date(row.newest) : undefined;
            break;
          case OutboxStatus.Processing:
            stats.processing = count;
            break;
          case OutboxStatus.Published:
            stats.published = count;
            break;
          case OutboxStatus.Failed:
            stats.failed = count;
            break;
          case OutboxStatus.Discarded:
            stats.discarded = count;
            break;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get batch statistics', error as Error);
      throw error;
    }
  }

  /**
   * Gets events by status
   *
   * @param status - Event status
   * @param limit - Maximum number of events to return
   * @param offset - Offset for pagination
   * @returns Promise resolving to array of outbox events
   */
  public async getEventsByStatus(
    status: OutboxStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<OutboxEvent[]> {
    try {
      const query = `
        SELECT
          id,
          event_id,
          event_type,
          event_version,
          event_domain,
          source_service,
          source_entity_type,
          source_entity_id,
          correlation_id,
          causation_id,
          parent_event_id,
          payload,
          payload_size,
          metadata,
          content_type,
          priority,
          publish_to,
          exchange,
          routing_key,
          topic,
          status,
          attempts,
          max_attempts,
          next_attempt_at,
          occurred_at,
          created_at,
          published_at,
          failed_at,
          error_message,
          error_code,
          error_details,
          version,
          updated_at
        FROM shared.outbox_events
        WHERE status = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query<OutboxEvent>(query, [status, limit, offset]);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get events by status', error as Error, { status });
      throw error;
    }
  }

  /**
   * Gets an event by ID
   *
   * @param id - Event ID
   * @returns Promise resolving to the event or null if not found
   */
  public async getEventById(id: string): Promise<OutboxEvent | null> {
    try {
      const query = `
        SELECT
          id,
          event_id,
          event_type,
          event_version,
          event_domain,
          source_service,
          source_entity_type,
          source_entity_id,
          correlation_id,
          causation_id,
          parent_event_id,
          payload,
          payload_size,
          metadata,
          content_type,
          priority,
          publish_to,
          exchange,
          routing_key,
          topic,
          status,
          attempts,
          max_attempts,
          next_attempt_at,
          occurred_at,
          created_at,
          published_at,
          failed_at,
          error_message,
          error_code,
          error_details,
          version,
          updated_at
        FROM shared.outbox_events
        WHERE id = $1
      `;

      const result = await this.pool.query<OutboxEvent>(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to get event by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * Gets the last processed event ID for a consumer
   *
   * @param consumerName - Name of the consumer
   * @returns Promise resolving to the last processed event ID or null
   */
  public async getLastProcessedEventId(consumerName: string): Promise<string | null> {
    try {
      const query = `
        SELECT event_id
        FROM shared.processed_events
        WHERE consumer_name = $1
          AND status = 'completed'
        ORDER BY processed_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [consumerName]);
      return result.rows[0]?.event_id || null;
    } catch (error) {
      this.logger.error('Failed to get last processed event ID', error as Error, {
        consumerName,
      });
      throw error;
    }
  }

  /**
   * Records that an event has been processed
   *
   * @param eventId - Event ID
   * @param eventType - Event type
   * @param consumerName - Consumer name
   * @param result - Processing result
   * @param output - Processing output (optional)
   * @param durationMs - Processing duration in milliseconds
   * @param errorMessage - Error message (if failed)
   * @param errorCode - Error code (if failed)
   * @returns Promise resolving to the record ID
   */
  public async recordEventProcessing(
    eventId: string,
    eventType: string,
    consumerName: string,
    result: string = 'success',
    output?: Record<string, unknown>,
    durationMs?: number,
    errorMessage?: string,
    errorCode?: string
  ): Promise<string> {
    try {
      const query = `
        INSERT INTO shared.processed_events (
          event_id,
          event_type,
          consumer_name,
          status,
          result,
          output,
          error_message,
          error_code,
          processing_duration_ms
        ) VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, $8)
        ON CONFLICT (consumer_name, event_id) DO UPDATE SET
          status = EXCLUDED.status,
          result = EXCLUDED.result,
          output = EXCLUDED.output,
          error_message = EXCLUDED.error_message,
          error_code = EXCLUDED.error_code,
          processing_attempts = processed_events.processing_attempts + 1,
          processing_duration_ms = EXCLUDED.processing_duration_ms,
          updated_at = NOW()
        RETURNING id
      `;

      const resultQuery = await this.pool.query(query, [
        eventId,
        eventType,
        consumerName,
        result,
        output ? JSON.stringify(output) : null,
        errorMessage || null,
        errorCode || null,
        durationMs || null,
      ]);

      return resultQuery.rows[0].id;
    } catch (error) {
      this.logger.error('Failed to record event processing', error as Error, {
        eventId,
        consumerName,
      });
      throw error;
    }
  }

  /**
   * Checks if the repository is connected
   *
   * @returns True if connected
   */
  public isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Pings the database to verify connection
   *
   * @returns Promise resolving to true if successful
   */
  public async ping(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Database ping failed', error as Error);
      return false;
    }
  }

  /**
   * Closes the database connection pool
   *
   * @returns Promise that resolves when closed
   */
  public async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      this.logger.info('OutboxRepository connection pool closed');
    } catch (error) {
      this.logger.error('Failed to close OutboxRepository', error as Error);
      throw error;
    }
  }

  /**
   * Gets the connection pool
   *
   * @returns The connection pool
   */
  public getPool(): Pool {
    return this.pool;
  }

  /**
   * Executes a raw query
   *
   * @param text - Query text
   * @param params - Query parameters
   * @returns Promise resolving to query result
   */
  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }
}

/**
 * Default repository instance
 */
let defaultRepository: OutboxRepository | null = null;

/**
 * Gets the default repository instance
 *
 * @param config - Postgres configuration
 * @param logger - Logger instance
 * @returns Repository instance
 */
export function getRepository(config?: PostgresConfig, logger?: OutboxLogger): OutboxRepository {
  if (!defaultRepository) {
    defaultRepository = new OutboxRepository(config, logger);
  }
  return defaultRepository;
}

/**
 * Creates a new repository instance
 *
 * @param config - Postgres configuration
 * @param logger - Logger instance
 * @returns New repository instance
 */
export function createRepository(config?: PostgresConfig, logger?: OutboxLogger): OutboxRepository {
  return new OutboxRepository(config, logger);
}

export default OutboxRepository;
