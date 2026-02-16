/**
 * Migration: Add B2B Portal Reference IDs
 *
 * This migration adds b2b_order_id and b2b_invoice_id columns to the
 * orders and invoices tables to store external B2B Portal reference IDs.
 *
 * @module B2B Portal - Infrastructure Migrations
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddB2BReferenceIds1700000000000 implements MigrationInterface {
  name = 'AddB2BReferenceIds1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add b2b_order_id column to b2b_orders table
    await queryRunner.query(`
      ALTER TABLE b2b_orders
      ADD COLUMN IF NOT EXISTS b2b_order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS b2b_synced_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS b2b_sync_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS b2b_last_error TEXT
    `);

    // Add indexes for B2B reference columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_orders_b2b_order_id ON b2b_orders(b2b_order_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_orders_b2b_sync_status ON b2b_orders(b2b_sync_status)
    `);

    // Add b2b_invoice_id column to invoices table
    // Note: This assumes invoices exist. If not, the migration will log but not fail.
    try {
      await queryRunner.query(`
        ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS b2b_invoice_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS b2b_synced_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS b2b_sync_status VARCHAR(50) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS b2b_last_error TEXT
      `);

      // Add indexes for B2B reference columns on invoices
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_invoices_b2b_invoice_id ON invoices(b2b_invoice_id)
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_invoices_b2b_sync_status ON invoices(b2b_sync_status)
      `);
    } catch (error) {
      // Log but don't fail if invoices table doesn't exist
      console.warn('Note: Invoices table may not exist, skipping invoice columns:', error);
    }

    // Create table for B2B sync events (for idempotency and audit trail)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS b2b_sync_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        b2b_entity_id VARCHAR(255),
        event_type VARCHAR(50) NOT NULL,
        direction VARCHAR(20) NOT NULL, -- 'outbound' or 'inbound'
        payload JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
        error_message TEXT,
        retry_count INT DEFAULT 0,
        idempotency_key VARCHAR(255) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Add indexes for b2b_sync_events table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_sync_events_entity ON b2b_sync_events(entity_type, entity_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_sync_events_b2b_entity ON b2b_sync_events(b2b_entity_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_sync_events_status ON b2b_sync_events(status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_sync_events_idempotency_key ON b2b_sync_events(idempotency_key)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_sync_events_created_at ON b2b_sync_events(created_at)
    `);

    // Add comment to b2b_orders table
    await queryRunner.query(`
      COMMENT ON COLUMN b2b_orders.b2b_order_id IS 'External B2B Portal order identifier'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN b2b_orders.b2b_synced_at IS 'Last sync timestamp with B2B Portal'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN b2b_orders.b2b_sync_status IS 'Sync status with B2B Portal (pending, synced, failed)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN b2b_orders.b2b_last_error IS 'Last error message from B2B Portal sync'
    `);

    // Add comment to b2b_sync_events table
    await queryRunner.query(`
      COMMENT ON TABLE b2b_sync_events IS 'Audit trail for B2B Portal synchronization events'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN b2b_sync_events.idempotency_key IS 'Unique key for idempotent operations'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN b2b_sync_events.direction IS 'Direction of sync: outbound (ERP->B2B), inbound (B2B->ERP)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_orders_b2b_order_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_orders_b2b_sync_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_b2b_invoice_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_b2b_sync_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_sync_events_entity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_sync_events_b2b_entity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_sync_events_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_sync_events_idempotency_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_sync_events_created_at`);

    // Remove columns from b2b_orders table
    await queryRunner.query(`
      ALTER TABLE b2b_orders
      DROP COLUMN IF EXISTS b2b_order_id,
      DROP COLUMN IF EXISTS b2b_synced_at,
      DROP COLUMN IF EXISTS b2b_sync_status,
      DROP COLUMN IF EXISTS b2b_last_error
    `);

    // Remove columns from invoices table
    try {
      await queryRunner.query(`
        ALTER TABLE invoices
        DROP COLUMN IF EXISTS b2b_invoice_id,
        DROP COLUMN IF EXISTS b2b_synced_at,
        DROP COLUMN IF EXISTS b2b_sync_status,
        DROP COLUMN IF EXISTS b2b_last_error
      `);
    } catch (error) {
      // Ignore if invoices table doesn't exist
      console.warn('Note: Invoices table may not exist, skipping column removal:', error);
    }

    // Drop b2b_sync_events table
    await queryRunner.query(`DROP TABLE IF EXISTS b2b_sync_events`);
  }
}
