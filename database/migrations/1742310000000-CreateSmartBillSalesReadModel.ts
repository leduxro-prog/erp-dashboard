import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSmartBillSalesReadModel1742310000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE smartbill_sales_documents (
        id bigserial PRIMARY KEY,
        document_key varchar(191) NOT NULL,
        document_type varchar(32) NOT NULL,
        smartbill_id varchar(128),
        series varchar(32),
        number varchar(64),
        issue_date date NOT NULL,
        due_date date,
        customer_name varchar(255),
        customer_vat varchar(64),
        currency varchar(8) NOT NULL DEFAULT 'RON',
        total_without_vat numeric(14, 2) NOT NULL DEFAULT 0,
        vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
        total_with_vat numeric(14, 2) NOT NULL DEFAULT 0,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        source_updated_at timestamptz,
        ingested_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE sales_kpi_daily (
        id bigserial PRIMARY KEY,
        period_date date NOT NULL,
        orders_count integer NOT NULL DEFAULT 0,
        customers_count integer NOT NULL DEFAULT 0,
        total_revenue numeric(14, 2) NOT NULL DEFAULT 0,
        total_without_vat numeric(14, 2) NOT NULL DEFAULT 0,
        vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
        average_order_value numeric(14, 2) NOT NULL DEFAULT 0,
        currency varchar(8) NOT NULL DEFAULT 'RON',
        top_products jsonb NOT NULL DEFAULT '[]'::jsonb,
        computed_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_smartbill_sales_documents_document_key
      ON smartbill_sales_documents (document_key)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_smartbill_sales_documents_issue_date
      ON smartbill_sales_documents (issue_date)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_smartbill_sales_documents_type_issue_date
      ON smartbill_sales_documents (document_type, issue_date)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_sales_kpi_daily_period_date_currency
      ON sales_kpi_daily (period_date, currency)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_sales_kpi_daily_computed_at
      ON sales_kpi_daily (computed_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_sales_kpi_daily_computed_at');
    await queryRunner.query('DROP INDEX IF EXISTS idx_sales_kpi_daily_period_date_currency');
    await queryRunner.query('DROP INDEX IF EXISTS idx_smartbill_sales_documents_type_issue_date');
    await queryRunner.query('DROP INDEX IF EXISTS idx_smartbill_sales_documents_issue_date');
    await queryRunner.query('DROP INDEX IF EXISTS idx_smartbill_sales_documents_document_key');

    await queryRunner.query('DROP TABLE IF EXISTS sales_kpi_daily');
    await queryRunner.query('DROP TABLE IF EXISTS smartbill_sales_documents');
  }
}
