import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create marketing module tables
 */
export class CreateMarketingTables1739640000000 implements MigrationInterface {
  name = 'CreateMarketingTables1739640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Campaigns table
    await queryRunner.query(`
      CREATE TYPE campaign_type_enum AS ENUM (
        'EMAIL_BLAST', 'DISCOUNT_CODE', 'PRODUCT_LAUNCH', 'SEASONAL', 'FLASH_SALE', 'NEWSLETTER'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE campaign_status_enum AS ENUM (
        'DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type campaign_type_enum NOT NULL,
        status campaign_status_enum NOT NULL DEFAULT 'DRAFT',
        description TEXT NOT NULL,
        target_audience JSONB DEFAULT '{}',
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        budget DECIMAL(12, 2),
        spent_budget DECIMAL(12, 2) DEFAULT 0,
        metrics JSONB DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "converted": 0, "revenue": 0}',
        created_by UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Discount codes table
    await queryRunner.query(`
      CREATE TYPE discount_type_enum AS ENUM (
        'PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE discount_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) UNIQUE NOT NULL,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        type discount_type_enum NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        max_usage_count INTEGER,
        used_count INTEGER DEFAULT 0,
        max_usage_per_customer INTEGER,
        min_order_value DECIMAL(12, 2),
        start_date TIMESTAMP WITH TIME ZONE NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        restrictions JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX idx_campaigns_status ON campaigns(status)`);
    await queryRunner.query(`CREATE INDEX idx_discount_codes_code ON discount_codes(code)`);
    await queryRunner.query(`CREATE INDEX idx_discount_codes_campaign_id ON discount_codes(campaign_id)`);

    console.log('✅ Marketing tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS discount_codes`);
    await queryRunner.query(`DROP TABLE IF EXISTS campaigns`);
    await queryRunner.query(`DROP TYPE IF EXISTS discount_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS campaign_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS campaign_type_enum`);
    console.log('✅ Marketing tables removed successfully');
  }
}
