/**
 * Outbox Event Publisher
 * Publishes WooCommerce-derived events to the unified outbox table for replay capability
 */

import pg, { Pool } from 'pg';
import { ERPDomainEvent } from '../../application/transformers/WebhookEventTransformer';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('outbox-event-publisher');

/**
 * Outbox event publisher configuration
 */
export interface OutboxPublisherConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  max?: number;
}

/**
 * Default configuration from environment
 */
function getDefaultConfig(): OutboxPublisherConfig {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'cypher_erp',
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    max: parseInt(process.env.POSTGRES_POOL_MAX || '20', 10),
  };
}

/**
 * Publisher result
 */
export interface PublisherResult {
  success: boolean;
  outboxEventId?: string;
  error?: string;
}

/**
 * Outbox event publisher for WooCommerce integration
 * Writes events to shared.outbox_events table for unified replay
 */
export class OutboxEventPublisher {
  private pool: Pool;
  private isConnected = false;

  constructor(config?: OutboxPublisherConfig) {
    const finalConfig = config || getDefaultConfig();

    this.pool = new Pool({
      host: finalConfig.host,
      port: finalConfig.port,
      database: finalConfig.database,
      user: finalConfig.username,
      password: finalConfig.password,
      max: finalConfig.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('connect', () => {
      this.isConnected = true;
      logger.debug('OutboxEventPublisher: Database connection established');
    });

    this.pool.on('error', (err) => {
      logger.error('OutboxEventPublisher: Database pool error', { error: err.message });
      this.isConnected = false;
    });
  }

  /**
   * Initialize the publisher
   */
  async initialize(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      logger.info('OutboxEventPublisher initialized');
    } catch (error) {
      logger.error('Failed to initialize OutboxEventPublisher', error as Error);
      throw error;
    }
  }

  /**
   * Publish an ERP domain event to the outbox table
   */
  async publish(event: ERPDomainEvent): Promise<PublisherResult> {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        // Insert event into shared.outbox_events
        const query = `
          INSERT INTO shared.outbox_events (
            event_id,
            event_type,
            event_version,
            event_domain,
            source_service,
            source_entity_type,
            source_entity_id,
            correlation_id,
            causation_id,
            payload,
            payload_size,
            metadata,
            content_type,
            priority,
            publish_to,
            status,
            attempts,
            max_attempts,
            next_attempt_at,
            occurred_at,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
          RETURNING id
        `;

        const payloadJson = JSON.stringify(event.payload);
        const metadataJson = JSON.stringify(event.metadata);

        const result = await client.query(query, [
          event.event_id,
          event.event_type,
          event.event_version,
          event.event_domain,
          event.source_service,
          event.source_entity_type || null,
          event.source_entity_id || null,
          event.correlation_id || null,
          event.causation_id || null,
          payloadJson,
          Buffer.byteLength(payloadJson),
          metadataJson,
          event.content_type,
          event.priority,
          event.publish_to,
          'pending', // status
          0, // attempts
          3, // max_attempts
          event.occurred_at, // next_attempt_at
          event.occurred_at, // occurred_at
        ]);

        await client.query('COMMIT');

        const outboxEventId = result.rows[0].id;

        logger.info('Event published to outbox', {
          outboxEventId,
          eventId: event.event_id,
          eventType: event.event_type,
          sourceEntityId: event.source_entity_id,
        });

        return {
          success: true,
          outboxEventId,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error('Failed to publish event to outbox', {
        eventId: event.event_id,
        eventType: event.event_type,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch(events: ERPDomainEvent[]): Promise<PublisherResult[]> {
    const results: PublisherResult[] = [];

    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        for (const event of events) {
          try {
            const payloadJson = JSON.stringify(event.payload);
            const metadataJson = JSON.stringify(event.metadata);

            const query = `
              INSERT INTO shared.outbox_events (
                event_id,
                event_type,
                event_version,
                event_domain,
                source_service,
                source_entity_type,
                source_entity_id,
                correlation_id,
                causation_id,
                payload,
                payload_size,
                metadata,
                content_type,
                priority,
                publish_to,
                status,
                attempts,
                max_attempts,
                next_attempt_at,
                occurred_at,
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
              RETURNING id
            `;

            const result = await client.query(query, [
              event.event_id,
              event.event_type,
              event.event_version,
              event.event_domain,
              event.source_service,
              event.source_entity_type || null,
              event.source_entity_id || null,
              event.correlation_id || null,
              event.causation_id || null,
              payloadJson,
              Buffer.byteLength(payloadJson),
              metadataJson,
              event.content_type,
              event.priority,
              event.publish_to,
              'pending',
              0,
              3,
              event.occurred_at,
              event.occurred_at,
            ]);

            results.push({
              success: true,
              outboxEventId: result.rows[0].id,
            });
          } catch (error: any) {
            logger.error('Failed to publish individual event in batch', {
              eventId: event.event_id,
              error: error.message,
            });
            results.push({
              success: false,
              error: error.message,
            });
          }
        }

        await client.query('COMMIT');

        logger.info('Batch published to outbox', {
          total: events.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        });

        return results;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error('Failed to publish batch to outbox', {
        total: events.length,
        error: error.message,
      });

      return events.map((e) => ({
        success: false,
        error: error.message,
      }));
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('OutboxEventPublisher connection pool closed');
    } catch (error) {
      logger.error('Failed to close OutboxEventPublisher', error as Error);
      throw error;
    }
  }

  /**
   * Check if publisher is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get the connection pool
   */
  getPool(): Pool {
    return this.pool;
  }
}
