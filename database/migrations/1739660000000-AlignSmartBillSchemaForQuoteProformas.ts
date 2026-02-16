import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align SmartBill tables with current entities and WS4 requirements.
 *
 * - Stores orderId as varchar in invoices/proformas
 * - Adds smartBillStatus columns when missing
 * - Adds quoteId reference on proformas
 */
export class AlignSmartBillSchemaForQuoteProformas1739660000000 implements MigrationInterface {
  name = 'AlignSmartBillSchemaForQuoteProformas1739660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'smartbill_invoices' AND column_name = 'orderId'
        ) THEN
          ALTER TABLE smartbill_invoices
          ALTER COLUMN "orderId" TYPE VARCHAR USING "orderId"::text;
        END IF;
      END
      $$;

      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'smartbill_proformas' AND column_name = 'orderId'
        ) THEN
          ALTER TABLE smartbill_proformas
          ALTER COLUMN "orderId" TYPE VARCHAR USING "orderId"::text;
        END IF;
      END
      $$;

      ALTER TABLE smartbill_invoices
        ADD COLUMN IF NOT EXISTS "smartBillStatus" VARCHAR;

      ALTER TABLE smartbill_proformas
        ADD COLUMN IF NOT EXISTS "smartBillStatus" VARCHAR,
        ADD COLUMN IF NOT EXISTS "quoteId" BIGINT;

      CREATE INDEX IF NOT EXISTS idx_smartbill_invoices_smartbill_status
        ON smartbill_invoices("smartBillStatus");

      CREATE INDEX IF NOT EXISTS idx_smartbill_proformas_smartbill_status
        ON smartbill_proformas("smartBillStatus");

      CREATE INDEX IF NOT EXISTS idx_smartbill_proformas_quote_id
        ON smartbill_proformas("quoteId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_smartbill_proformas_quote_id;
      DROP INDEX IF EXISTS idx_smartbill_proformas_smartbill_status;
      DROP INDEX IF EXISTS idx_smartbill_invoices_smartbill_status;

      ALTER TABLE smartbill_proformas
        DROP COLUMN IF EXISTS "quoteId",
        DROP COLUMN IF EXISTS "smartBillStatus";

      ALTER TABLE smartbill_invoices
        DROP COLUMN IF EXISTS "smartBillStatus";
    `);
  }
}
