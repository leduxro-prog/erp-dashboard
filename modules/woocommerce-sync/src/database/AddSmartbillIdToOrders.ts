/**
 * Migration to add smartbill_id column to orders table
 * This allows linking WooCommerce orders to SmartBill invoices
 */

import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddSmartbillIdToOrders1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists first
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'smartbill_id'
      )
    `);

    if (!columnExists[0].exists) {
      await queryRunner.query(`
        ALTER TABLE orders
        ADD COLUMN smartbill_id VARCHAR(100) NULL
      `);

      await queryRunner.query(`
        CREATE INDEX idx_orders_smartbill_id ON orders(smartbill_id)
      `);

      console.log('Added smartbill_id column to orders table');
    }

    // Add woo_order_id for direct WooCommerce order reference
    const wooIdColumnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'woo_order_id'
      )
    `);

    if (!wooIdColumnExists[0].exists) {
      await queryRunner.query(`
        ALTER TABLE orders
        ADD COLUMN woo_order_id BIGINT NULL
      `);

      await queryRunner.query(`
        CREATE INDEX idx_orders_woo_order_id ON orders(woo_order_id)
      `);

      console.log('Added woo_order_id column to orders table');
    }

    // Add woo_webhook_id for tracking
    const webhookIdColumnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'woo_webhook_id'
      )
    `);

    if (!webhookIdColumnExists[0].exists) {
      await queryRunner.query(`
        ALTER TABLE orders
        ADD COLUMN woo_webhook_id VARCHAR(255) NULL
      `);

      console.log('Added woo_webhook_id column to orders table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_smartbill_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_woo_order_id`);

    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS smartbill_id`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS woo_order_id`);
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN IF EXISTS woo_webhook_id`);

    console.log('Removed smartbill tracking columns from orders table');
  }
}
