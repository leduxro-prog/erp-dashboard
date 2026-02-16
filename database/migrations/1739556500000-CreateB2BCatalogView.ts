import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create B2B catalog view for read-only product access
 *
 * This view provides B2B customers with a read-only view of the product catalog
 * including stock availability, without exposing internal pricing or cost data.
 *
 * View includes:
 * - Product basic info (id, sku, name, description)
 * - Base pricing
 * - Category information
 * - Aggregated stock availability
 * - Stock status flag
 */
export class CreateB2BCatalogView1739556500000 implements MigrationInterface {
  name = 'CreateB2BCatalogView1739556500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW b2b_catalog_view AS
      SELECT
        p.id,
        p.sku,
        p.name,
        p.description,
        p.base_price,
        c.name as category,
        c.slug as category_slug,
        COALESCE(SUM(sl.quantity_available), 0) as stock_available,
        CASE
          WHEN COALESCE(SUM(sl.quantity_available), 0) > 0 THEN true
          ELSE false
        END as in_stock,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      WHERE p.is_active = true
      GROUP BY p.id, p.sku, p.name, p.description, p.base_price, c.name, c.slug, p.created_at, p.updated_at
    `);

    // Grant SELECT permission on view to public (application users)
    await queryRunner.query(`
      GRANT SELECT ON b2b_catalog_view TO PUBLIC
    `);

    console.log('✅ B2B catalog view created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP VIEW IF EXISTS b2b_catalog_view
    `);

    console.log('✅ B2B catalog view dropped successfully');
  }
}
