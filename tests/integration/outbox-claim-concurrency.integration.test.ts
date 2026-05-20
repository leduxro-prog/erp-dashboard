import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'crypto';

import { OutboxRepository } from '../../modules/outbox-relay/src/OutboxRepository';
import { PostgresConfig } from '../../modules/outbox-relay/src/Config';

const testDatabase = process.env.TEST_DB_DATABASE || 'cypher_erp_test';
const config: PostgresConfig = {
  host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || process.env.DB_PORT || '5432', 10),
  database: testDatabase,
  username: process.env.TEST_DB_USERNAME || process.env.DB_USER || 'cypher_user',
  password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || 'cypher_secret',
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

describe('OutboxRepository concurrent atomic claim', () => {
  let repositoryA: OutboxRepository;
  let repositoryB: OutboxRepository;
  const eventIds: string[] = [];

  beforeAll(async () => {
    if (!testDatabase.includes('test')) {
      throw new Error(`Refusing to run outbox concurrency test against non-test database: ${testDatabase}`);
    }

    process.env.NODE_ENV = 'development';
    repositoryA = new OutboxRepository(config);
    repositoryB = new OutboxRepository(config);
    await repositoryA.initialize();
    await repositoryB.initialize();

    await repositoryA.query('CREATE SCHEMA IF NOT EXISTS shared');
    await repositoryA.query(`
      CREATE TABLE IF NOT EXISTS shared.outbox_events (
        id UUID PRIMARY KEY,
        event_id UUID NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        event_version VARCHAR(50) NOT NULL,
        event_domain VARCHAR(100) NOT NULL,
        source_service VARCHAR(255) NOT NULL,
        source_entity_type VARCHAR(255),
        source_entity_id VARCHAR(255),
        correlation_id UUID,
        causation_id UUID,
        parent_event_id UUID,
        payload JSONB NOT NULL,
        payload_size INTEGER,
        metadata JSONB DEFAULT '{}'::jsonb,
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
        occurred_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        published_at TIMESTAMP,
        failed_at TIMESTAMP,
        error_message TEXT,
        error_code VARCHAR(100),
        error_details JSONB,
        version INTEGER DEFAULT 1,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await repositoryA.query(`
      CREATE TABLE IF NOT EXISTS shared.processed_events (
        id UUID PRIMARY KEY,
        event_id UUID NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        consumer_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        result JSONB,
        output JSONB,
        error_message TEXT,
        error_code VARCHAR(100),
        processing_duration_ms INTEGER,
        processing_attempts INTEGER DEFAULT 1,
        processed_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE (consumer_name, event_id)
      )
    `);
  });

  afterAll(async () => {
    if (repositoryA && eventIds.length > 0) {
      await repositoryA.query('DELETE FROM shared.processed_events WHERE event_id = ANY($1)', [eventIds]);
      await repositoryA.query('DELETE FROM shared.outbox_events WHERE event_id = ANY($1)', [eventIds]);
    }
    await repositoryA?.close();
    await repositoryB?.close();
  });

  it('does not return the same pending row to competing claimers', async () => {
    const rows = Array.from({ length: 20 }, () => ({ id: randomUUID(), eventId: randomUUID() }));
    eventIds.push(...rows.map((row) => row.eventId));

    for (const row of rows) {
      await repositoryA.query(
        `INSERT INTO shared.outbox_events (
          id, event_id, event_type, event_version, event_domain, source_service,
          payload, metadata, priority, publish_to, status, attempts, max_attempts,
          next_attempt_at, occurred_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'order.created', 'v1', 'order', 'outbox-test',
          '{}'::jsonb, '{}'::jsonb, 'normal', 'rabbitmq', 'pending', 0, 3,
          NOW(), NOW(), NOW(), NOW()
        )`,
        [row.id, row.eventId]
      );
    }

    const [claimedA, claimedB] = await Promise.all([
      repositoryA.claimPendingEvents(20, 'outbox-concurrency-test', 3),
      repositoryB.claimPendingEvents(20, 'outbox-concurrency-test', 3),
    ]);

    const claimedIds = [...claimedA, ...claimedB].map((event) => event.event_id);
    const uniqueClaimedIds = new Set(claimedIds);

    expect(claimedIds).toHaveLength(20);
    expect(uniqueClaimedIds.size).toBe(20);

    const state = await repositoryA.query(
      `SELECT status, attempts, COUNT(*)::int AS count
       FROM shared.outbox_events
       WHERE event_id = ANY($1)
       GROUP BY status, attempts`,
      [eventIds]
    );

    expect(state.rows).toEqual([{ status: 'processing', attempts: 1, count: 20 }]);
  });
});
