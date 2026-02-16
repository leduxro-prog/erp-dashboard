import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create customer_external_links table
 *
 * Links internal customers (from `customers` or `b2b_customers`) to external
 * providers (SmartBill, WooCommerce, etc.) for unified customer management.
 * Supports deduplication via CUI/email matching and conflict detection.
 */
export class CreateCustomerExternalLinks1739650000000 implements MigrationInterface {
  name = 'CreateCustomerExternalLinks1739650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS customer_external_links (
        id              BIGSERIAL PRIMARY KEY,
        customer_id     BIGINT REFERENCES customers(id) ON DELETE SET NULL,
        provider        VARCHAR(50)  NOT NULL,  -- 'smartbill', 'woocommerce', etc.
        external_id     VARCHAR(255) NOT NULL,
        external_data   JSONB        NOT NULL DEFAULT '{}',
        sync_status     VARCHAR(20)  NOT NULL DEFAULT 'synced',
        last_sync_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT uq_customer_external_link UNIQUE (provider, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_cel_provider ON customer_external_links(provider);
      CREATE INDEX IF NOT EXISTS idx_cel_customer ON customer_external_links(customer_id);
      CREATE INDEX IF NOT EXISTS idx_cel_external_id ON customer_external_links(provider, external_id);
      CREATE INDEX IF NOT EXISTS idx_cel_sync_status ON customer_external_links(sync_status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS customer_external_links;`);
  }
}
