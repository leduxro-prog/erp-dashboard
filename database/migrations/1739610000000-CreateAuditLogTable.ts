import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create audit_logs table for comprehensive audit trail
 *
 * Stores all user and system actions with before/after change tracking,
 * IP addresses, user agents, and arbitrary metadata for compliance reporting.
 */
export class CreateAuditLogTable1739610000000 implements MigrationInterface {
  name = 'CreateAuditLogTable1739610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid-ossp extension is available
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NULL,
        user_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent TEXT,
        changes JSONB,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes for common query patterns
    await queryRunner.query(`CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id)`);
    await queryRunner.query(`CREATE INDEX idx_audit_logs_action ON audit_logs (action)`);
    await queryRunner.query(
      `CREATE INDEX idx_audit_logs_resource_type ON audit_logs (resource_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC)`,
    );

    // Composite index for filtered queries
    await queryRunner.query(
      `CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id)`,
    );

    console.log('✅ audit_logs table created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    console.log('✅ audit_logs table dropped successfully');
  }
}
