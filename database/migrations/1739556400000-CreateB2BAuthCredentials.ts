import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create b2b_auth_credentials table for B2B customer authentication
 *
 * This migration creates a separate authentication credentials table for B2B customers,
 * enabling independent authentication realm from the main ERP users.
 *
 * Features:
 * - Separate JWT secrets (JWT_SECRET_B2B)
 * - Account lockout after 5 failed attempts (15-minute lockout)
 * - Password change enforcement
 * - Last login tracking
 */
export class CreateB2BAuthCredentials1739556400000 implements MigrationInterface {
  name = 'CreateB2BAuthCredentials1739556400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create b2b_auth_credentials table
    await queryRunner.query(`
      CREATE TABLE b2b_auth_credentials (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        must_change_password BOOLEAN DEFAULT false,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP NULL,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Add foreign key constraint to b2b_customers
    await queryRunner.query(`
      ALTER TABLE b2b_auth_credentials
      ADD CONSTRAINT fk_b2b_auth_customer
      FOREIGN KEY (customer_id)
      REFERENCES b2b_customers(id)
      ON DELETE CASCADE
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX idx_b2b_auth_email
      ON b2b_auth_credentials(email)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_b2b_auth_customer
      ON b2b_auth_credentials(customer_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_b2b_auth_locked_until
      ON b2b_auth_credentials(locked_until)
      WHERE locked_until IS NOT NULL
    `);

    // Add company_email column to b2b_customers if not exists
    await queryRunner.query(`
      ALTER TABLE b2b_customers
      ADD COLUMN IF NOT EXISTS company_email VARCHAR(255)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_b2b_customers_email
      ON b2b_customers(company_email)
    `);

    console.log('✅ B2B auth credentials table created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_b2b_auth_email
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_b2b_auth_customer
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_b2b_auth_locked_until
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_b2b_customers_email
    `);

    // Remove company_email column from b2b_customers
    await queryRunner.query(`
      ALTER TABLE b2b_customers
      DROP COLUMN IF EXISTS company_email
    `);

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE b2b_auth_credentials
      DROP CONSTRAINT IF EXISTS fk_b2b_auth_customer
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS b2b_auth_credentials
    `);

    console.log('✅ B2B auth credentials table dropped successfully');
  }
}
