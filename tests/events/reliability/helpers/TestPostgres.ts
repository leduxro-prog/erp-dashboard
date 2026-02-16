/**
 * Test Postgres setup for chaos and reliability testing.
 *
 * Provides utilities for managing test Postgres instances,
 * creating test tables, simulating failures,
 * and validating data consistency.
 *
 * @module TestPostgres
 */

import * as pg from 'pg';
import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Postgres configuration
 */
export interface TestPostgresConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Table schema definition
 */
export interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    constraints?: string[];
    nullable?: boolean;
    default?: string;
  }>;
  primaryKey?: string[];
  indexes?: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;
}

/**
 * Test statistics
 */
export interface TestStats {
  queriesExecuted: number;
  queriesFailed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsDeleted: number;
  avgQueryLatency: number;
  connectionErrors: number;
  reconnections: number;
  deadlocksDetected: number;
}

/**
 * Query result wrapper with timing
 */
export interface TimedQueryResult<T extends QueryResultRow = any> {
  result: QueryResult<T>;
  duration: number;
  success: boolean;
  error?: Error;
}

/**
 * Deadlock information
 */
export interface DeadlockInfo {
  timestamp: Date;
  query: string;
  tables: string[];
  pid: number;
}

/**
 * Test Postgres instance for chaos testing
 */
export class TestPostgres {
  private pool: Pool;
  private readonly config: TestPostgresConfig;
  private readonly schema: string;

  private queryLatencies: number[] = [];
  private queriesFailed: number = 0;
  private queriesExecuted: number = 0;
  private rowsInserted: number = 0;
  private rowsUpdated: number = 0;
  private rowsDeleted: number = 0;
  private connectionErrors: number = 0;
  private reconnections: number = 0;
  private deadlocksDetected: number = 0;

  private tables: Set<string> = new Set();
  private isSimulatingFailure: boolean = false;

  constructor(config: TestPostgresConfig = {}, schema: string = 'test') {
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || parseInt(process.env.DB_PORT || '5432', 10),
      database: config.database || process.env.DB_NAME || 'cypher_erp_test',
      username: config.username || process.env.DB_USER || 'cypher_user',
      password: config.password || process.env.DB_PASSWORD || 'cypher_secret',
      ssl: config.ssl || false,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
    };

    this.schema = schema;

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

    this.pool.on('error', (err) => {
      this.connectionErrors++;
      console.error('[TestPostgres] Pool error:', err.message);
    });

    this.pool.on('connect', () => {
      console.log('[TestPostgres] New client connected');
    });

    this.pool.on('remove', () => {
      console.log('[TestPostgres] Client removed');
    });
  }

  /**
   * Initializes the test database
   */
  public async initialize(): Promise<void> {
    // Test connection
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();

    // Create test schema if not exists
    await this.query(`
      CREATE SCHEMA IF NOT EXISTS ${this.schema}
    `);

    console.log('[TestPostgres] Initialized', {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      schema: this.schema,
    });
  }

  /**
   * Creates a table from schema definition
   */
  public async createTable(schema: TableSchema): Promise<void> {
    const fullTableName = `${this.schema}.${schema.name}`;

    // Build column definitions
    const columnDefs = schema.columns
      .map((col) => {
        const constraints = col.constraints ? col.constraints.join(' ') : '';
        const nullable = col.nullable === false ? ' NOT NULL' : '';
        const defaultVal = col.default !== undefined ? ` DEFAULT ${col.default}` : '';
        return `"${col.name}" ${col.type}${nullable}${defaultVal} ${constraints}`;
      })
      .join(',\n    ');

    // Build primary key constraint
    const pkConstraint = schema.primaryKey
      ? `,\n    PRIMARY KEY (${schema.primaryKey.map((c) => `"${c}"`).join(', ')})`
      : '';

    const query = `
      CREATE TABLE IF NOT EXISTS ${fullTableName} (
        ${columnDefs}${pkConstraint}
      )
    `;

    await this.query(query);

    // Create indexes
    if (schema.indexes) {
      for (const index of schema.indexes) {
        await this.createIndex(schema.name, index);
      }
    }

    this.tables.add(schema.name);
    console.log(`[TestPostgres] Created table: ${fullTableName}`);
  }

  /**
   * Creates an index on a table
   */
  public async createIndex(
    tableName: string,
    index: { name: string; columns: string[]; unique?: boolean }
  ): Promise<void> {
    const fullTableName = `${this.schema}.${tableName}`;
    const unique = index.unique ? 'UNIQUE ' : '';
    const columns = index.columns.map((c) => `"${c}"`).join(', ');

    const query = `
      CREATE INDEX IF NOT EXISTS "${index.name}"
      ON ${fullTableName}
      (${columns})
    `;

    await this.query(query);
    console.log(`[TestPostgres] Created index: ${index.name}`);
  }

  /**
   * Drops a table
   */
  public async dropTable(tableName: string): Promise<void> {
    const fullTableName = `${this.schema}.${tableName}`;

    await this.query(`DROP TABLE IF EXISTS ${fullTableName} CASCADE`);
    this.tables.delete(tableName);

    console.log(`[TestPostgres] Dropped table: ${fullTableName}`);
  }

  /**
   * Executes a query with timing
   */
  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      this.queriesExecuted++;
      const result = await this.pool.query<T>(text, params);
      this.queryLatencies.push(Date.now() - startTime);

      // Track row counts
      if (result.command === 'INSERT') {
        this.rowsInserted += result.rowCount || 0;
      } else if (result.command === 'UPDATE') {
        this.rowsUpdated += result.rowCount || 0;
      } else if (result.command === 'DELETE') {
        this.rowsDeleted += result.rowCount || 0;
      }

      return result;
    } catch (error) {
      this.queriesFailed++;
      this.queryLatencies.push(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Executes a timed query
   */
  public async timedQuery<T extends QueryResultRow = any>(
    text: string,
    params?: unknown[]
  ): Promise<TimedQueryResult<T>> {
    const startTime = Date.now();

    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - startTime;

      return {
        result,
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        result: { rows: [], rowCount: 0, command: '', fields: [] } as any,
        duration,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Inserts a row into a table
   */
  public async insert(
    tableName: string,
    data: Record<string, unknown>
  ): Promise<QueryResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const quotedColumns = columns.map((c) => `"${c}"`).join(', ');

    const query = `
      INSERT INTO ${this.schema}.${tableName} (${quotedColumns})
      VALUES (${placeholders})
      RETURNING *
    `;

    return this.query(query, values);
  }

  /**
   * Inserts multiple rows into a table
   */
  public async insertBatch(
    tableName: string,
    rows: Array<Record<string, unknown>>
  ): Promise<QueryResult> {
    if (rows.length === 0) {
      return { rows: [], rowCount: 0, command: '', fields: [] } as any;
    }

    const columns = Object.keys(rows[0]);
    const quotedColumns = columns.map((c) => `"${c}"`).join(', ');

    // Build value placeholders for all rows
    const values: unknown[] = [];
    const valuePlaceholders: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowValues = columns.map((_, j) => `$${values.length + j + 1}`);
      values.push(...Object.values(rows[i]));
      valuePlaceholders.push(`(${rowValues.join(', ')})`);
    }

    const query = `
      INSERT INTO ${this.schema}.${tableName} (${quotedColumns})
      VALUES ${valuePlaceholders.join(', ')}
      RETURNING *
    `;

    return this.query(query, values);
  }

  /**
   * Updates rows in a table
   */
  public async update(
    tableName: string,
    data: Record<string, unknown>,
    where: string,
    whereParams: unknown[] = []
  ): Promise<QueryResult> {
    const setClauses = Object.keys(data).map((col, i) => `"${col}" = $${i + 1}`).join(', ');
    const params = [...Object.values(data), ...whereParams];

    const query = `
      UPDATE ${this.schema}.${tableName}
      SET ${setClauses}
      WHERE ${where}
      RETURNING *
    `;

    return this.query(query, params);
  }

  /**
   * Deletes rows from a table
   */
  public async delete(
    tableName: string,
    where: string,
    whereParams: unknown[] = []
  ): Promise<QueryResult> {
    const query = `
      DELETE FROM ${this.schema}.${tableName}
      WHERE ${where}
      RETURNING *
    `;

    return this.query(query, whereParams);
  }

  /**
   * Selects rows from a table
   */
  public async select<T = any>(
    tableName: string,
    where?: string,
    whereParams: unknown[] = [],
    orderBy?: string,
    limit?: number
  ): Promise<QueryResult<T>> {
    let query = `SELECT * FROM ${this.schema}.${tableName}`;

    if (where) {
      query += ` WHERE ${where}`;
    }

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    return this.query<T>(query, whereParams);
  }

  /**
   * Selects a single row from a table
   */
  public async selectOne<T = any>(
    tableName: string,
    where: string,
    whereParams: unknown[] = []
  ): Promise<T | null> {
    const result = await this.select<T>(tableName, where, whereParams, undefined, 1);
    return result.rows[0] || null;
  }

  /**
   * Counts rows in a table
   */
  public async count(tableName: string, where?: string, whereParams: unknown[] = []): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.schema}.${tableName}`;

    if (where) {
      query += ` WHERE ${where}`;
    }

    const result = await this.query(query, whereParams);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Gets table row count
   */
  public async getTableRowCount(tableName: string): Promise<number> {
    return this.count(tableName);
  }

  /**
   * Truncates a table (removes all rows)
   */
  public async truncate(tableName: string): Promise<void> {
    await this.query(`TRUNCATE TABLE ${this.schema}.${tableName} RESTART IDENTITY CASCADE`);
    console.log(`[TestPostgres] Truncated table: ${tableName}`);
  }

  /**
   * Begins a transaction
   */
  public async beginTransaction(): Promise<pg.PoolClient> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commits a transaction
   */
  public async commitTransaction(client: pg.PoolClient): Promise<void> {
    await client.query('COMMIT');
    client.release();
  }

  /**
   * Rolls back a transaction
   */
  public async rollbackTransaction(client: pg.PoolClient): Promise<void> {
    await client.query('ROLLBACK');
    client.release();
  }

  /**
   * Executes a function in a transaction
   */
  public async transaction<T>(
    fn: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Locks a row using SELECT FOR UPDATE
   */
  public async lockRow(
    tableName: string,
    id: string,
    idColumn: string = 'id'
  ): Promise<pg.PoolClient> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    await client.query(
      `SELECT * FROM ${this.schema}.${tableName} WHERE "${idColumn}" = $1 FOR UPDATE`,
      [id]
    );
    return client;
  }

  /**
   * Locks a row using SELECT FOR UPDATE SKIP LOCKED
   */
  public async lockRowSkipLocked(
    tableName: string,
    id: string,
    idColumn: string = 'id'
  ): Promise<pg.PoolClient | null> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT * FROM ${this.schema}.${tableName} WHERE "${idColumn}" = $1 FOR UPDATE SKIP LOCKED`,
      [id]
    );

    if (result.rows.length === 0) {
      client.release();
      await client.query('ROLLBACK');
      return null;
    }

    return client;
  }

  /**
   * Locks multiple rows using SELECT FOR UPDATE SKIP LOCKED
   */
  public async lockRowsSkipLocked(
    tableName: string,
    limit: number,
    where: string = 'TRUE',
    whereParams: unknown[] = []
  ): Promise<{ client: pg.PoolClient; rows: any[] } | null> {
    const client = await this.pool.connect();
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT * FROM ${this.schema}.${tableName} WHERE ${where} FOR UPDATE SKIP LOCKED LIMIT $1`,
      [...whereParams, limit]
    );

    if (result.rows.length === 0) {
      client.release();
      await client.query('ROLLBACK');
      return null;
    }

    return { client, rows: result.rows };
  }

  /**
   * Simulates connection failure
   */
  public async simulateConnectionFailure(duration: number = 5000): Promise<void> {
    this.isSimulatingFailure = true;
    console.log(`[TestPostgres] Simulating connection failure for ${duration}ms`);

    // Close all connections
    await this.pool.end();

    await new Promise((resolve) => setTimeout(resolve, duration));

    // Recreate pool
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
    this.isSimulatingFailure = false;

    await this.initialize();
    console.log('[TestPostgres] Connection restored');
  }

  /**
   * Simulates network partition
   */
  public async simulateNetworkPartition(duration: number = 5000): Promise<void> {
    await this.simulateConnectionFailure(duration);
  }

  /**
   * Simulates high latency
   */
  public async simulateHighLatency(duration: number = 5000, latencyMs: number = 1000): Promise<void> {
    console.log(`[TestPostgres] Simulating high latency for ${duration}ms (${latencyMs}ms per query)`);

    const originalQuery: typeof this.query = this.query.bind(this);
    const endTime = Date.now() + duration;

    this.query = async <T extends QueryResultRow = any>(
      text: string,
      params?: unknown[]
    ): Promise<QueryResult<T>> => {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
      return originalQuery<T>(text, params);
    };

    await new Promise((resolve) => setTimeout(resolve, duration));

    // Restore original query
    this.query = originalQuery.bind(this);
    console.log('[TestPostgres] High latency simulation ended');
  }

  /**
   * Simulates deadlock scenario
   */
  public async simulateDeadlock(
    fn1: () => Promise<void>,
    fn2: () => Promise<void>
  ): Promise<void> {
    console.log('[TestPostgres] Simulating deadlock scenario');

    const client1 = await this.pool.connect();
    const client2 = await this.pool.connect();

    await client1.query('BEGIN');
    await client2.query('BEGIN');

    try {
      // Both transactions attempt to lock resources in different order
      await Promise.all([
        fn1().catch(() => {}),
        fn2().catch(() => {}),
      ]);
    } catch (error) {
      this.deadlocksDetected++;
      console.log('[TestPostgres] Deadlock detected');
    } finally {
      try {
        await client1.query('ROLLBACK');
        client1.release();
      } catch {}

      try {
        await client2.query('ROLLBACK');
        client2.release();
      } catch {}
    }
  }

  /**
   * Gets test statistics
   */
  public getStats(): TestStats {
    const totalLatency = this.queryLatencies.reduce((a, b) => a + b, 0);

    return {
      queriesExecuted: this.queriesExecuted,
      queriesFailed: this.queriesFailed,
      rowsInserted: this.rowsInserted,
      rowsUpdated: this.rowsUpdated,
      rowsDeleted: this.rowsDeleted,
      avgQueryLatency: this.queryLatencies.length > 0
        ? totalLatency / this.queryLatencies.length
        : 0,
      connectionErrors: this.connectionErrors,
      reconnections: this.reconnections,
      deadlocksDetected: this.deadlocksDetected,
    };
  }

  /**
   * Resets statistics
   */
  public resetStats(): void {
    this.queryLatencies = [];
    this.queriesExecuted = 0;
    this.queriesFailed = 0;
    this.rowsInserted = 0;
    this.rowsUpdated = 0;
    this.rowsDeleted = 0;
    this.connectionErrors = 0;
    this.reconnections = 0;
    this.deadlocksDetected = 0;
  }

  /**
   * Pings the database
   */
  public async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets the connection pool
   */
  public getPool(): Pool {
    return this.pool;
  }

  /**
   * Cleans up test resources
   */
  public async cleanup(): Promise<void> {
    console.log('[TestPostgres] Cleaning up test resources');

    // Drop all test tables
    for (const tableName of Array.from(this.tables)) {
      try {
        await this.dropTable(tableName);
      } catch (error) {
        console.error(`[TestPostgres] Failed to drop table ${tableName}:`, error);
      }
    }

    // Drop schema
    try {
      await this.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
    } catch (error) {
      console.error(`[TestPostgres] Failed to drop schema:`, error);
    }

    // Close pool
    await this.pool.end();

    this.tables.clear();
    this.resetStats();

    console.log('[TestPostgres] Cleanup complete');
  }

  /**
   * Creates an outbox table for testing
   */
  public async createOutboxTable(): Promise<void> {
    const schema: TableSchema = {
      name: 'outbox_events',
      columns: [
        { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY'], nullable: false, default: 'uuid_generate_v4()' },
        { name: 'event_id', type: 'UUID', nullable: false },
        { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
        { name: 'event_version', type: 'VARCHAR(50)', nullable: false },
        { name: 'event_domain', type: 'VARCHAR(100)', nullable: false },
        { name: 'source_service', type: 'VARCHAR(255)', nullable: false },
        { name: 'source_entity_type', type: 'VARCHAR(255)' },
        { name: 'source_entity_id', type: 'VARCHAR(255)' },
        { name: 'correlation_id', type: 'UUID' },
        { name: 'causation_id', type: 'UUID' },
        { name: 'parent_event_id', type: 'UUID' },
        { name: 'payload', type: 'JSONB', nullable: false },
        { name: 'payload_size', type: 'INTEGER' },
        { name: 'metadata', type: 'JSONB', default: "'{}'::jsonb" },
        { name: 'content_type', type: 'VARCHAR(100)', default: "'application/json'" },
        { name: 'priority', type: 'VARCHAR(20)', default: "'normal'" },
        { name: 'publish_to', type: 'VARCHAR(100)', default: "'rabbitmq'" },
        { name: 'exchange', type: 'VARCHAR(255)' },
        { name: 'routing_key', type: 'VARCHAR(255)' },
        { name: 'topic', type: 'VARCHAR(255)' },
        { name: 'status', type: 'VARCHAR(20)', default: "'pending'", nullable: false },
        { name: 'attempts', type: 'INTEGER', default: '0' },
        { name: 'max_attempts', type: 'INTEGER', default: '3' },
        { name: 'next_attempt_at', type: 'TIMESTAMP', default: 'NOW()' },
        { name: 'occurred_at', type: 'TIMESTAMP', nullable: false },
        { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
        { name: 'published_at', type: 'TIMESTAMP' },
        { name: 'failed_at', type: 'TIMESTAMP' },
        { name: 'error_message', type: 'TEXT' },
        { name: 'error_code', type: 'VARCHAR(100)' },
        { name: 'error_details', type: 'JSONB' },
        { name: 'version', type: 'INTEGER', default: '1' },
        { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
      ],
      indexes: [
        { name: 'idx_outbox_status', columns: ['status', 'next_attempt_at'] },
        { name: 'idx_outbox_event_id', columns: ['event_id'], unique: true },
        { name: 'idx_outbox_correlation_id', columns: ['correlation_id'] },
        { name: 'idx_outbox_priority', columns: ['priority', 'occurred_at'] },
        { name: 'idx_outbox_created_at', columns: ['created_at'] },
      ],
    };

    await this.createTable(schema);
  }

  /**
   * Creates a processed events table for testing
   */
  public async createProcessedEventsTable(): Promise<void> {
    const schema: TableSchema = {
      name: 'processed_events',
      columns: [
        { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY'], nullable: false, default: 'uuid_generate_v4()' },
        { name: 'event_id', type: 'UUID', nullable: false },
        { name: 'event_type', type: 'VARCHAR(255)', nullable: false },
        { name: 'consumer_name', type: 'VARCHAR(255)', nullable: false },
        { name: 'status', type: 'VARCHAR(50)', default: "'completed'" },
        { name: 'result', type: 'JSONB' },
        { name: 'output', type: 'JSONB' },
        { name: 'error_message', type: 'TEXT' },
        { name: 'error_code', type: 'VARCHAR(100)' },
        { name: 'processing_duration_ms', type: 'INTEGER' },
        { name: 'processing_attempts', type: 'INTEGER', default: '1' },
        { name: 'processed_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
        { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()', nullable: false },
      ],
      indexes: [
        { name: 'idx_processed_event_consumer', columns: ['event_id', 'consumer_name'], unique: true },
        { name: 'idx_processed_status', columns: ['status'] },
        { name: 'idx_processed_consumer', columns: ['consumer_name', 'processed_at'] },
      ],
    };

    await this.createTable(schema);
  }
}

/**
 * Factory function for creating test Postgres instances
 */
export function createTestPostgres(config?: TestPostgresConfig, schema?: string): TestPostgres {
  return new TestPostgres(config, schema);
}

/**
 * Creates a UUID extension for the database
 */
export async function enableUUIDExtension(pg: TestPostgres): Promise<void> {
  await pg.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
}
