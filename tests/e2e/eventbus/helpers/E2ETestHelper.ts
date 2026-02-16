/**
 * E2E Test Helper
 *
 * Utilities for end-to-end testing of event bus operations.
 * Provides setup, teardown, event publishing, and DLQ management.
 *
 * @module tests/e2e/eventbus/helpers/E2ETestHelper
 */

import { TestRabbitMQ } from '../../../events/reliability/helpers/TestRabbitMQ';
import { TestPostgres } from '../../../events/reliability/helpers/TestPostgres';
import { v4 as uuidv4 } from 'uuid';
import { OutboxEventRecord } from '../AuditTrailValidator';

/**
 * Event configuration for publishing
 */
export interface EventConfig {
  /** Event type */
  eventType: string;
  /** Event domain */
  domain: string;
  /** Event version */
  version?: string;
  /** Source service */
  sourceService?: string;
  /** Source entity type */
  sourceEntityType?: string;
  /** Source entity ID */
  sourceEntityId?: string;
  /** Correlation ID */
  correlationId?: string;
  /** Causation ID */
  causationId?: string;
  /** Parent event ID */
  parentEventId?: string;
  /** Event priority */
  priority?: 'low' | 'normal' | 'high' | 'critical';
  /** Event payload */
  payload?: Record<string, unknown>;
  /** Exchange name */
  exchange?: string;
  /** Routing key */
  routingKey?: string;
}

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
  /** RabbitMQ configuration */
  rabbitmq?: {
    url?: string;
    hostname?: string;
    port?: number;
    username?: string;
    password?: string;
    vhost?: string;
  };
  /** Postgres configuration */
  postgres?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    schema?: string;
  };
  /** Test schema name */
  testSchema?: string;
  /** Test exchange prefix */
  exchangePrefix?: string;
  /** Test queue prefix */
  queuePrefix?: string;
}

/**
 * Test topology configuration
 */
export interface TestTopology {
  /** Exchange name */
  exchange: string;
  /** Exchange type */
  exchangeType: 'direct' | 'topic' | 'fanout';
  /** Main queue name */
  queue: string;
  /** DLQ name */
  dlq?: string;
  /** Binding routing key */
  routingKey: string;
}

/**
 * Event publication result
 */
export interface EventPublicationResult {
  /** Event ID */
  eventId: string;
  /** Publication success */
  success: boolean;
  /** Error if failed */
  error?: Error;
  /** Publication timestamp */
  timestamp: Date;
  /** RabbitMQ delivery tag */
  deliveryTag?: number;
}

/**
 * Event consumption result
 */
export interface EventConsumptionResult {
  /** Event ID */
  eventId: string;
  /** Event type */
  eventType: string;
  /** Event domain */
  domain: string;
  /** Consumption success */
  success: boolean;
  /** Processing duration */
  processingDuration?: number;
  /** Error if failed */
  error?: Error;
  /** Number of retries */
  retryCount?: number;
  /** Consumer name */
  consumerName?: string;
}

/**
 * DLQ state
 */
export interface DLQState {
  /** DLQ name */
  name: string;
  /** Message count */
  messageCount: number;
  /** Messages in DLQ */
  messages: Array<{
    eventId: string;
    eventType: string;
    errorReason?: string;
    retryCount: number;
    originalQueue: string;
    timestamp: Date;
  }>;
}

/**
 * E2E Test Helper class
 */
export class E2ETestHelper {
  public rabbitmq: TestRabbitMQ;
  private postgres: TestPostgres;
  private config: Required<Omit<TestEnvironmentConfig, 'testSchema'>> & { testSchema: string };
  private topology: TestTopology | null = null;
  private consumers: Map<string, any> = new Map();
  private publishedEvents: Map<string, EventPublicationResult> = new Map();

  constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      rabbitmq: {
        url: config.rabbitmq?.url || process.env.RABBITMQ_URL,
        hostname: config.rabbitmq?.hostname || process.env.RABBITMQ_HOST || 'localhost',
        port: config.rabbitmq?.port || parseInt(process.env.RABBITMQ_PORT || '5672', 10),
        username: config.rabbitmq?.username || process.env.RABBITMQ_USER || 'guest',
        password: config.rabbitmq?.password || process.env.RABBITMQ_PASS || 'guest',
        vhost: config.rabbitmq?.vhost || process.env.RABBITMQ_VHOST || '/',
      },
      postgres: {
        host: config.postgres?.host || process.env.DB_HOST || 'localhost',
        port: config.postgres?.port || parseInt(process.env.DB_PORT || '5432', 10),
        database: config.postgres?.database || process.env.DB_NAME || 'cypher_erp_test',
        username: config.postgres?.username || process.env.DB_USER || 'cypher_user',
        password: config.postgres?.password || process.env.DB_PASSWORD || 'cypher_secret',
        schema: config.postgres?.schema || process.env.DB_SCHEMA || 'shared',
      },
      testSchema: config.testSchema || 'test_e2e',
      exchangePrefix: config.exchangePrefix || 'e2e-test',
      queuePrefix: config.queuePrefix || 'e2e-test',
    };

    this.rabbitmq = new TestRabbitMQ(this.config.rabbitmq);
    this.postgres = new TestPostgres(this.config.postgres, this.config.testSchema);
  }

  /**
   * Initializes the test environment
   *
   * @param createOutboxTable - Whether to create outbox table
   * @param createProcessedEventsTable - Whether to create processed events table
   */
  async initialize(
    createOutboxTable: boolean = true,
    createProcessedEventsTable: boolean = true
  ): Promise<void> {
    console.log('[E2ETestHelper] Initializing test environment...');

    // Initialize PostgreSQL
    await this.postgres.initialize();

    // Create test schema
    await this.postgres.query(`CREATE SCHEMA IF NOT EXISTS ${this.config.testSchema}`);

    // Enable UUID extension
    await this.postgres.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create tables if requested
    if (createOutboxTable) {
      await this.createOutboxTable();
    }

    if (createProcessedEventsTable) {
      await this.createProcessedEventsTable();
    }

    // Initialize RabbitMQ
    await this.rabbitmq.connect();

    console.log('[E2ETestHelper] Test environment initialized');
  }

  /**
   * Sets up test topology (exchange, queue, DLQ)
   *
   * @param eventType - Event type for naming
   * @param exchangeType - Exchange type
   * @param enableDLQ - Whether to enable DLQ
   * @returns Test topology configuration
   */
  async setupTopology(
    eventType: string = 'test',
    exchangeType: 'direct' | 'topic' | 'fanout' = 'topic',
    enableDLQ: boolean = true
  ): Promise<TestTopology> {
    const exchangeName = `${this.config.exchangePrefix}-${eventType}`;
    const queueName = `${this.config.queuePrefix}-${eventType}`;
    const dlqName = enableDLQ ? `${queueName}-dlq` : undefined;
    const routingKey = `${eventType}.#`;

    // Declare DLQ exchange and queue if enabled
    if (enableDLQ && dlqName) {
      await this.rabbitmq.declareExchange({
        name: `${exchangeName}-dlq`,
        type: exchangeType,
      });

      await this.rabbitmq.declareQueue({
        name: dlqName,
        options: { durable: true },
      });
    }

    // Declare main exchange
    await this.rabbitmq.declareExchange({
      name: exchangeName,
      type: exchangeType,
      options: { durable: true },
    });

    // Declare main queue with DLQ argument
    await this.rabbitmq.declareQueue({
      name: queueName,
      options: {
        durable: true,
        arguments: enableDLQ && dlqName
          ? {
              'x-dead-letter-exchange': `${exchangeName}-dlq`,
              'x-dead-letter-routing-key': dlqName,
            }
          : undefined,
      },
    });

    // Bind queue to exchange
    await this.rabbitmq.getChannel()!.bindQueue(queueName, exchangeName, routingKey);

    this.topology = {
      exchange: exchangeName,
      exchangeType,
      queue: queueName,
      dlq: dlqName,
      routingKey,
    };

    console.log('[E2ETestHelper] Test topology setup:', this.topology);

    return this.topology;
  }

  /**
   * Creates an outbox table for testing
   */
  private async createOutboxTable(): Promise<void> {
    const schema = this.config.testSchema;
    const tableName = 'outbox_events';

    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.${tableName} (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_id UUID NOT NULL UNIQUE,
        event_type VARCHAR(255) NOT NULL,
        event_version VARCHAR(50) NOT NULL DEFAULT '1.0',
        event_domain VARCHAR(100) NOT NULL,
        source_service VARCHAR(255) NOT NULL,
        source_entity_type VARCHAR(255),
        source_entity_id VARCHAR(255),
        correlation_id UUID,
        causation_id UUID,
        parent_event_id UUID,
        payload JSONB NOT NULL,
        payload_size INTEGER,
        metadata JSONB DEFAULT '{}',
        content_type VARCHAR(100) DEFAULT 'application/json',
        priority VARCHAR(20) DEFAULT 'normal',
        publish_to VARCHAR(100) DEFAULT 'rabbitmq',
        exchange VARCHAR(255),
        routing_key VARCHAR(255),
        topic VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending' NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        next_attempt_at TIMESTAMP DEFAULT NOW(),
        occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        published_at TIMESTAMP,
        failed_at TIMESTAMP,
        error_message TEXT,
        error_code VARCHAR(100),
        error_details JSONB,
        version INTEGER DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes
    await this.postgres.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_status
      ON ${schema}.${tableName} (status, next_attempt_at)
    `);

    await this.postgres.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_event_id
      ON ${schema}.${tableName} (event_id)
    `);

    await this.postgres.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_correlation_id
      ON ${schema}.${tableName} (correlation_id)
    `);

    console.log(`[E2ETestHelper] Created ${schema}.${tableName}`);
  }

  /**
   * Creates a processed events table for testing
   */
  private async createProcessedEventsTable(): Promise<void> {
    const schema = this.config.testSchema;
    const tableName = 'processed_events';

    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.${tableName} (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_id UUID NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        consumer_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'completed' NOT NULL,
        result JSONB,
        output JSONB,
        error_message TEXT,
        error_code VARCHAR(100),
        processing_duration_ms INTEGER,
        processing_attempts INTEGER DEFAULT 1,
        processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (consumer_name, event_id)
      )
    `);

    // Create indexes
    await this.postgres.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_event_consumer
      ON ${schema}.${tableName} (event_id, consumer_name)
    `);

    await this.postgres.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_status
      ON ${schema}.${tableName} (status)
    `);

    console.log(`[E2ETestHelper] Created ${schema}.${tableName}`);
  }

  /**
   * Publishes an event to the test exchange
   *
   * @param config - Event configuration
   * @returns Publication result
   */
  async publishEvent(config: EventConfig): Promise<EventPublicationResult> {
    const eventId = uuidv4();
    const correlationId = config.correlationId || uuidv4();

    const payload = config.payload || { test: 'data' };

    const event = {
      id: eventId,
      type: config.eventType,
      version: config.version || '1.0',
      domain: config.domain,
      source: {
        service: config.sourceService || 'e2e-test',
        entityType: config.sourceEntityType,
        entityId: config.sourceEntityId,
      },
      correlationId,
      causationId: config.causationId,
      parentEventId: config.parentEventId,
      payload,
      metadata: config.payload ? {} : { test: true },
      timestamp: new Date().toISOString(),
    };

    const exchange = config.exchange || this.topology?.exchange || this.config.exchangePrefix;
    const routingKey = config.routingKey || `${config.eventType}.${config.domain}`;

    // Insert into outbox table
    await this.insertOutboxEvent({
      event_id: eventId,
      event_type: config.eventType,
      event_version: config.version || '1.0',
      event_domain: config.domain,
      source_service: config.sourceService || 'e2e-test',
      source_entity_type: config.sourceEntityType,
      source_entity_id: config.sourceEntityId,
      correlation_id: correlationId,
      causation_id: config.causationId,
      parent_event_id: config.parentEventId,
      payload,
      metadata: { test: true },
      exchange,
      routing_key: routingKey,
      priority: config.priority || 'normal',
    });

    // Publish to RabbitMQ
    const publishResult = await this.rabbitmq.publish(
      exchange,
      routingKey,
      event
    );

    const result: EventPublicationResult = {
      eventId,
      success: publishResult.success,
      error: publishResult.error,
      timestamp: new Date(),
      deliveryTag: publishResult.deliveryTag,
    };

    this.publishedEvents.set(eventId, result);

    console.log('[E2ETestHelper] Published event:', {
      eventId,
      eventType: config.eventType,
      success: publishResult.success,
    });

    return result;
  }

  /**
   * Publishes multiple events
   *
   * @param configs - Array of event configurations
   * @returns Array of publication results
   */
  async publishEvents(configs: EventConfig[]): Promise<EventPublicationResult[]> {
    const results: EventPublicationResult[] = [];

    for (const config of configs) {
      const result = await this.publishEvent(config);
      results.push(result);
    }

    return results;
  }

  /**
   * Inserts an event into the outbox table
   *
   * @param eventData - Event data
   */
  private async insertOutboxEvent(eventData: Record<string, unknown>): Promise<void> {
    const schema = this.config.testSchema;
    const tableName = 'outbox_events';

    const columns = Object.keys(eventData).map((k) => `"${k}"`).join(', ');
    const values = Object.values(eventData);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    await this.postgres.query(
      `INSERT INTO ${schema}.${tableName} (${columns}) VALUES (${placeholders})`,
      values
    );
  }

  /**
   * Consumes events from the test queue
   *
   * @param count - Number of events to consume
   * @param timeout - Timeout in milliseconds
   * @returns Array of consumption results
   */
  async consumeEvents(
    count: number = 1,
    timeout: number = 10000
  ): Promise<EventConsumptionResult[]> {
    const queue = this.topology?.queue || `${this.config.queuePrefix}-test`;
    const consumedMessages = await this.rabbitmq.collectMessages(queue, count, timeout);

    return consumedMessages.map((msg) => ({
      eventId: msg.content.id,
      eventType: msg.content.type,
      domain: msg.content.domain,
      success: true,
      timestamp: new Date(msg.timestamp),
    }));
  }

  /**
   * Registers a consumer for a specific queue
   *
   * @param queueName - Queue name
   * @param handler - Message handler
   * @returns Consumer tag
   */
  async registerConsumer(
    queueName: string,
    handler: (message: any) => Promise<void>
  ): Promise<string> {
    const consumerTag = await this.rabbitmq.consume(queueName, async (msg) => {
      if (!msg) {
        return;
      }

      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        this.rabbitmq.getChannel()?.ack(msg);
      } catch (error) {
        console.error('[E2ETestHelper] Consumer error:', error);
        this.rabbitmq.getChannel()?.nack(msg, false, false);
      }
    });

    this.consumers.set(consumerTag, { queueName, handler });

    console.log('[E2ETestHelper] Registered consumer:', consumerTag);

    return consumerTag;
  }

  /**
   * Gets DLQ state
   *
   * @returns DLQ state
   */
  async getDLQState(): Promise<DLQState | null> {
    const dlqName = this.topology?.dlq;

    if (!dlqName) {
      return null;
    }

    const messageCount = await this.rabbitmq.getQueueMessageCount(dlqName);

    // Collect messages from DLQ
    const messages = await this.rabbitmq.collectMessages(dlqName, messageCount, 5000);

    return {
      name: dlqName,
      messageCount,
      messages: messages.map((msg) => ({
        eventId: msg.content.id,
        eventType: msg.content.type,
        errorReason: msg.properties.headers?.['x-death']?.[0]?.reason,
        retryCount: msg.properties.headers?.['x-death']?.[0]?.count || 0,
        originalQueue: msg.properties.headers?.['x-death']?.[0]?.queue,
        timestamp: new Date(msg.timestamp),
      })),
    };
  }

  /**
   * Redrives messages from DLQ to main queue
   *
   * @returns Number of messages redriven
   */
  async redriveFromDLQ(): Promise<number> {
    const dlqState = await this.getDLQState();

    if (!dlqState || dlqState.messages.length === 0) {
      return 0;
    }

    const mainQueue = this.topology?.queue;
    let redrivenCount = 0;

    for (const message of dlqState.messages) {
      // Republish to main queue
      const result = await this.rabbitmq.publish(
        '',
        mainQueue,
        message
      );

      if (result.success) {
        redrivenCount++;
      }
    }

    // Purge DLQ after redriving
    await this.rabbitmq.purgeQueue(dlqState.name);

    console.log('[E2ETestHelper] Redriven messages from DLQ:', redrivenCount);

    return redrivenCount;
  }

  /**
   * Gets outbox event by ID
   *
   * @param eventId - Event ID
   * @returns Outbox event record or null
   */
  async getOutboxEvent(eventId: string): Promise<OutboxEventRecord | null> {
    const result = await this.postgres.query(
      `SELECT * FROM ${this.config.testSchema}.outbox_events WHERE event_id = $1`,
      [eventId]
    );

    return result.rows[0] || null;
  }

  /**
   * Gets processed events by event ID
   *
   * @param eventId - Event ID
   * @returns Array of processed event records
   */
  async getProcessedEvents(eventId: string): Promise<Array<{
    id: string;
    event_id: string;
    event_type: string;
    consumer_name: string;
    status: string;
    result?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error_message?: string;
    error_code?: string;
    processing_duration_ms?: number;
    processing_attempts: number;
    processed_at: Date;
    updated_at: Date;
  }>> {
    const result = await this.postgres.query(
      `SELECT * FROM ${this.config.testSchema}.processed_events WHERE event_id = $1 ORDER BY processed_at ASC`,
      [eventId]
    );

    return result.rows;
  }

  /**
   * Marks event as published in outbox
   *
   * @param eventId - Event ID
   */
  async markEventPublished(eventId: string): Promise<void> {
    await this.postgres.query(
      `UPDATE ${this.config.testSchema}.outbox_events
       SET status = 'published', published_at = NOW(), updated_at = NOW()
       WHERE event_id = $1`,
      [eventId]
    );
  }

  /**
   * Marks event as failed in outbox
   *
   * @param eventId - Event ID
   * @param errorMessage - Error message
   * @param errorCode - Error code
   */
  async markEventFailed(
    eventId: string,
    errorMessage: string,
    errorCode?: string
  ): Promise<void> {
    await this.postgres.query(
      `UPDATE ${this.config.testSchema}.outbox_events
       SET status = 'failed', failed_at = NOW(), error_message = $2, error_code = $3, updated_at = NOW()
       WHERE event_id = $1`,
      [eventId, errorMessage, errorCode || null]
    );
  }

  /**
   * Simulates consumer failure
   *
   * @param consumerTag - Consumer tag to stop
   */
  async simulateConsumerFailure(consumerTag: string): Promise<void> {
    await this.rabbitmq.cancelConsumer(consumerTag);
    this.consumers.delete(consumerTag);
    console.log('[E2ETestHelper] Simulated consumer failure:', consumerTag);
  }

  /**
   * Restarts a consumer
   *
   * @param queueName - Queue name
   * @param handler - Message handler
   * @returns New consumer tag
   */
  async restartConsumer(
    queueName: string,
    handler: (message: any) => Promise<void>
  ): Promise<string> {
    return await this.registerConsumer(queueName, handler);
  }

  /**
   * Cleans up test data
   *
   * @param correlationId - Correlation ID to clean up (optional)
   */
  async cleanup(correlationId?: string): Promise<void> {
    console.log('[E2ETestHelper] Cleaning up test data...');

    // Cancel all consumers
    for (const consumerTag of Array.from(this.consumers.keys())) {
      await this.rabbitmq.cancelConsumer(consumerTag);
    }
    this.consumers.clear();

    // Clean up database
    if (correlationId) {
      await this.postgres.query(
        `DELETE FROM ${this.config.testSchema}.processed_events
         WHERE event_id IN (SELECT event_id FROM ${this.config.testSchema}.outbox_events WHERE correlation_id = $1)`,
        [correlationId]
      );

      await this.postgres.query(
        `DELETE FROM ${this.config.testSchema}.outbox_events WHERE correlation_id = $1`,
        [correlationId]
      );
    } else {
      await this.postgres.query(`TRUNCATE TABLE ${this.config.testSchema}.processed_events CASCADE`);
      await this.postgres.query(`TRUNCATE TABLE ${this.config.testSchema}.outbox_events CASCADE`);
    }

    // Purge queues
    if (this.topology) {
      await this.rabbitmq.purgeQueue(this.topology.queue);
      if (this.topology.dlq) {
        await this.rabbitmq.purgeQueue(this.topology.dlq);
      }
    }

    console.log('[E2ETestHelper] Cleanup complete');
  }

  /**
   * Tears down the test environment
   */
  async teardown(): Promise<void> {
    console.log('[E2ETestHelper] Tearing down test environment...');

    // Cleanup test data
    await this.cleanup();

    // Drop test schema
    await this.postgres.query(`DROP SCHEMA IF EXISTS ${this.config.testSchema} CASCADE`);

    // Close RabbitMQ connection
    await this.rabbitmq.cleanup();

    // Close Postgres connection
    await this.postgres.cleanup();

    console.log('[E2ETestHelper] Teardown complete');
  }

  /**
   * Gets RabbitMQ test instance
   */
  getRabbitMQ(): TestRabbitMQ {
    return this.rabbitmq;
  }

  /**
   * Gets Postgres test instance
   */
  getPostgres(): TestPostgres {
    return this.postgres;
  }

  /**
   * Gets test topology
   */
  getTopology(): TestTopology | null {
    return this.topology;
  }

  /**
   * Gets published events
   */
  getPublishedEvents(): Map<string, EventPublicationResult> {
    return new Map(this.publishedEvents);
  }
}

/**
 * Factory function to create an E2E test helper
 *
 * @param config - Test environment configuration
 * @returns E2ETestHelper instance
 */
export function createE2ETestHelper(config?: TestEnvironmentConfig): E2ETestHelper {
  return new E2ETestHelper(config);
}

export default E2ETestHelper;
