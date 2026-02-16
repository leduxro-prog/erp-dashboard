import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add dedicated SmartBill ID columns to orders table
 *
 * Replaces the previous approach of storing smartbill_id in the notes JSON field
 * with proper indexed columns for reliable querying and referential integrity.
 *
 * Also adds woocommerce_order_id for WooCommerce<->ERP mapping and
 * smartbill_invoice_id to ar_invoices for SmartBill<->Financial linking.
 */
export class AddSmartBillColumnsToOrders1739590000000 implements MigrationInterface {
  name = 'AddSmartBillColumnsToOrders1739590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add SmartBill columns to orders table
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS smartbill_invoice_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS smartbill_proforma_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS woocommerce_order_id VARCHAR(50);
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_smartbill_invoice_id
        ON orders(smartbill_invoice_id) WHERE smartbill_invoice_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_smartbill_proforma_id
        ON orders(smartbill_proforma_id) WHERE smartbill_proforma_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_woocommerce_order_id
        ON orders(woocommerce_order_id) WHERE woocommerce_order_id IS NOT NULL;
    `);

    // Add SmartBill invoice ID to ar_invoices for financial linking
    await queryRunner.query(`
      ALTER TABLE ar_invoices
        ADD COLUMN IF NOT EXISTS smartbill_invoice_id VARCHAR(100);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ar_invoices_smartbill_id
        ON ar_invoices(smartbill_invoice_id) WHERE smartbill_invoice_id IS NOT NULL;
    `);

    // Migrate existing smartbill data from notes JSON to dedicated columns
    await queryRunner
      .query(
        `
      UPDATE orders
      SET smartbill_invoice_id = (notes::jsonb -> 'smartbill' ->> 'invoiceId'),
          smartbill_proforma_id = (notes::jsonb -> 'smartbill' ->> 'proformaId')
      WHERE notes IS NOT NULL
        AND notes::jsonb ? 'smartbill'
        AND smartbill_invoice_id IS NULL;
    `,
      )
      .catch(() => {
        // Ignore if notes is not valid JSON or smartbill key doesn't exist
      });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_smartbill_invoice_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_smartbill_proforma_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_woocommerce_order_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ar_invoices_smartbill_id;`);

    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN IF EXISTS smartbill_invoice_id,
        DROP COLUMN IF EXISTS smartbill_proforma_id,
        DROP COLUMN IF EXISTS woocommerce_order_id;
    `);

    await queryRunner.query(`
      ALTER TABLE ar_invoices
        DROP COLUMN IF EXISTS smartbill_invoice_id;
    `);
  }
}
