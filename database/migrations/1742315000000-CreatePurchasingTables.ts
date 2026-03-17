import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchasingTables1742315000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE purchase_requisitions (
        id uuid PRIMARY KEY,
        requisition_number varchar(64) NOT NULL,
        department_id varchar(64) NOT NULL,
        status varchar(32) NOT NULL,
        priority varchar(32) NOT NULL,
        title text NOT NULL,
        required_by timestamptz,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_orders (
        id uuid PRIMARY KEY,
        po_number varchar(64) NOT NULL,
        requisition_id varchar(64),
        vendor_id varchar(64) NOT NULL,
        status varchar(32) NOT NULL,
        type varchar(32) NOT NULL,
        required_by_date timestamptz,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE goods_receipt_notes (
        id uuid PRIMARY KEY,
        grn_number varchar(64) NOT NULL,
        po_id varchar(64) NOT NULL,
        vendor_id varchar(64) NOT NULL,
        status varchar(32) NOT NULL,
        receive_date timestamptz,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE vendor_invoices (
        id uuid PRIMARY KEY,
        invoice_number varchar(64) NOT NULL,
        vendor_id varchar(64) NOT NULL,
        po_id varchar(64),
        status varchar(32) NOT NULL,
        invoice_date date NOT NULL,
        due_date date NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE three_way_matches (
        id uuid PRIMARY KEY,
        po_id varchar(64) NOT NULL,
        grn_id varchar(64) NOT NULL,
        invoice_id varchar(64) NOT NULL,
        status varchar(32) NOT NULL,
        matched_at timestamptz,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_req_number_unique
      ON purchase_requisitions (requisition_number)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_req_department_status
      ON purchase_requisitions (department_id, status)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_po_number_unique
      ON purchase_orders (po_number)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_po_vendor_status
      ON purchase_orders (vendor_id, status)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_grn_number_unique
      ON goods_receipt_notes (grn_number)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_grn_po_status
      ON goods_receipt_notes (po_id, status)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_vendor_invoice_number_unique
      ON vendor_invoices (invoice_number)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_inv_vendor_due
      ON vendor_invoices (vendor_id, due_date)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_inv_status
      ON vendor_invoices (status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_match_invoice
      ON three_way_matches (invoice_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_match_status
      ON three_way_matches (status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_match_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_match_invoice');
    await queryRunner.query('DROP INDEX IF EXISTS idx_inv_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_inv_vendor_due');
    await queryRunner.query('DROP INDEX IF EXISTS idx_vendor_invoice_number_unique');
    await queryRunner.query('DROP INDEX IF EXISTS idx_grn_po_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_grn_number_unique');
    await queryRunner.query('DROP INDEX IF EXISTS idx_po_vendor_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_po_number_unique');
    await queryRunner.query('DROP INDEX IF EXISTS idx_req_department_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_req_number_unique');

    await queryRunner.query('DROP TABLE IF EXISTS three_way_matches');
    await queryRunner.query('DROP TABLE IF EXISTS vendor_invoices');
    await queryRunner.query('DROP TABLE IF EXISTS goods_receipt_notes');
    await queryRunner.query('DROP TABLE IF EXISTS purchase_orders');
    await queryRunner.query('DROP TABLE IF EXISTS purchase_requisitions');
  }
}
