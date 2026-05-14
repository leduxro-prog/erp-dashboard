import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSmartBillB2BProformaActiveUniqueIndex1747110000000
  implements MigrationInterface
{
  name = 'AddSmartBillB2BProformaActiveUniqueIndex1747110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM smartbill_proformas
          WHERE "orderId" LIKE 'B2B-%'
            AND status IN ('draft', 'pending_external', 'requires_reconciliation', 'issued', 'sent', 'converted')
          GROUP BY "orderId"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot create SmartBill B2B idempotency index: duplicate active B2B proformas exist';
        END IF;
      END
      $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_smartbill_b2b_proformas_active_order_unique
        ON smartbill_proformas("orderId")
        WHERE "orderId" LIKE 'B2B-%'
          AND status IN ('draft', 'pending_external', 'requires_reconciliation', 'issued', 'sent', 'converted');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_smartbill_b2b_proformas_active_order_unique;
    `);
  }
}
