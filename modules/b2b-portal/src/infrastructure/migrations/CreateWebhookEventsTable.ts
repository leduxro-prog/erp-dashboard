/**
 * Migration: Create B2B Webhook Events Table
 *
 * Creates a table for storing incoming webhook events from B2B Portal
 * for idempotency and audit trail purposes.
 *
 * @module B2B Portal - Infrastructure Migrations
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookEventsTable1700000000001 implements MigrationInterface {
  name = 'CreateWebhookEventsTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS b2b_webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id VARCHAR(255) NOT NULL UNIQUE,
        event_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        payload JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'received', -- 'received', 'processed', 'failed'
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_webhook_events_event_id ON b2b_webhook_events(event_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_webhook_events_status ON b2b_webhook_events(status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_webhook_events_entity_type ON b2b_webhook_events(entity_type)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_webhook_events_created_at ON b2b_webhook_events(created_at)
    `);

    // Add comments
    await queryRunner.query(`
      COMMENT ON TABLE b2b_webhook_events IS 'Audit trail for B2B Portal webhook events'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN b2b_webhook_events.event_id IS 'Unique identifier for the webhook event (for idempotency)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN b2b_webhook_events.status IS 'Processing status: received, processed, failed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_webhook_events_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_webhook_events_entity_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_webhook_events_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_webhook_events_event_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS b2b_webhook_events`);
  }
}
