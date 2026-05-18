import { MigrationInterface, QueryRunner } from "typeorm";

export class RealignProductEntitiesAndAddIndexes1742090000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add index on category_id for faster product filtering
        // We use IF NOT EXISTS to be safe in enterprise environments
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_category_id" ON "products" ("category_id")`);
        
        // 2. Add index on is_active for faster catalog listing
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_is_active" ON "products" ("is_active")`);
        
        // 3. Ensure product_specifications has a unique index on product_id
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_specifications_product_id" ON "product_specifications" ("product_id")`);
        
        // 4. Add index on brand for faceted search
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_product_specifications_brand" ON "product_specifications" ("brand")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_specifications_brand"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_specifications_product_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_is_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_category_id"`);
    }
}
