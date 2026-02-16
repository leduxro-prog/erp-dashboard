import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds cost_price_snapshot and cost_source columns to both order_items and b2b_order_items tables.
 * This captures the product cost at the moment of sale, making historical profit/COGS calculations
 * stable regardless of future product cost updates.
 */
export class AddCostPriceSnapshotToOrderItems1739670000000 implements MigrationInterface {
  name = 'AddCostPriceSnapshotToOrderItems1739670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add cost_price_snapshot and cost_source to order_items
    await queryRunner.query(`
      ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS cost_price_snapshot DECIMAL(12,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS cost_source VARCHAR(50) DEFAULT NULL
    `);

    // Add cost_price_snapshot and cost_source to b2b_order_items
    await queryRunner.query(`
      ALTER TABLE b2b_order_items
        ADD COLUMN IF NOT EXISTS cost_price_snapshot DECIMAL(12,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS cost_source VARCHAR(50) DEFAULT NULL
    `);

    // Backfill existing order_items with best available cost data
    // Priority: metadata->>'cost' from product, else base_price * 0.7 heuristic
    await queryRunner.query(`
      UPDATE order_items oi
      SET
        cost_price_snapshot = COALESCE(
          (SELECT (p.metadata->>'cost')::numeric FROM products p WHERE p.id = oi.product_id),
          (SELECT p.base_price * 0.7 FROM products p WHERE p.id = oi.product_id)
        ),
        cost_source = CASE
          WHEN (SELECT p.metadata->>'cost' FROM products p WHERE p.id = oi.product_id) IS NOT NULL
            THEN 'backfill_metadata'
          ELSE 'backfill_estimated'
        END
      WHERE oi.cost_price_snapshot IS NULL
    `);

    // Backfill existing b2b_order_items similarly
    await queryRunner.query(`
      UPDATE b2b_order_items oi
      SET
        cost_price_snapshot = COALESCE(
          (SELECT (p.metadata->>'cost')::numeric FROM products p WHERE p.id = oi.product_id),
          (SELECT p.base_price * 0.7 FROM products p WHERE p.id = oi.product_id)
        ),
        cost_source = CASE
          WHEN (SELECT p.metadata->>'cost' FROM products p WHERE p.id = oi.product_id) IS NOT NULL
            THEN 'backfill_metadata'
          ELSE 'backfill_estimated'
        END
      WHERE oi.cost_price_snapshot IS NULL
    `);

    // Add index for COGS reporting queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_cost_snapshot
        ON order_items (cost_price_snapshot)
        WHERE cost_price_snapshot IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_order_items_cost_snapshot
        ON b2b_order_items (cost_price_snapshot)
        WHERE cost_price_snapshot IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_b2b_order_items_cost_snapshot`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_order_items_cost_snapshot`);
    await queryRunner.query(`ALTER TABLE b2b_order_items DROP COLUMN IF EXISTS cost_source`);
    await queryRunner.query(
      `ALTER TABLE b2b_order_items DROP COLUMN IF EXISTS cost_price_snapshot`,
    );
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS cost_source`);
    await queryRunner.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS cost_price_snapshot`);
  }
}
