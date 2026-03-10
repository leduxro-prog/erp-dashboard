import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupplierPricingRules202603100010 implements MigrationInterface {
  name = 'CreateSupplierPricingRules202603100010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS supplier_pricing_rules (
        id BIGSERIAL PRIMARY KEY,
        supplier_code VARCHAR(50) NOT NULL,
        category_key VARCHAR(255) NOT NULL,
        markup_percent NUMERIC(7, 2) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_supplier_pricing_rules_supplier_category
          UNIQUE (supplier_code, category_key)
      );

      CREATE INDEX IF NOT EXISTS idx_supplier_pricing_rules_supplier_code
        ON supplier_pricing_rules(supplier_code);

      CREATE INDEX IF NOT EXISTS idx_supplier_pricing_rules_active
        ON supplier_pricing_rules(active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_pricing_rules;`);
  }
}
