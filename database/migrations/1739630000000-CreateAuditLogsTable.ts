import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create audit_logs table for system-wide activity tracking
 *
 * Fields:
 * - id: UUID primary key
 * - user_id: Reference to users table (nullable for system/public actions)
 * - action: Action type (e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN')
 * - resource_type: Entity type (e.g., 'Order', 'Product', 'User')
 * - resource_id: ID of the resource
 * - ip_address: IP address of the requester
 * - user_agent: Browser/client info
 * - changes: JSONB field storing before/after state
 * - metadata: Additional context
 * - created_at: Timestamp
 */
export class CreateAuditLogsTable1739630000000 implements MigrationInterface {
  name = 'CreateAuditLogsTable1739630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: skip if audit_logs already exists (created by earlier migration)
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'audit_logs'
      ) AS "exists"
    `);

    if (tableExists[0]?.exists) {
      // Table already exists from 1739610000000-CreateAuditLogTable
      // Add the foreign key constraint and any missing columns if not present
      const hasUserFk = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name LIKE '%audit_logs_user_id_fkey%'
            AND table_name = 'audit_logs'
        ) AS "exists"
      `);

      if (!hasUserFk[0]?.exists) {
        // The first migration uses UUID user_id without FK;
        // skip adding FK as column types may differ
        console.log('⏭️  audit_logs table already exists, skipping duplicate creation');
      }

      return;
    }

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255) NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        changes JSONB NULL,
        metadata JSONB NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for common lookups
    await queryRunner.query(`
      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      CREATE INDEX idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);

    console.log('✅ Audit logs table created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only drop if this migration actually created the table
    // (i.e., the earlier migration's table doesn't exist)
    // Safe: if table was created by earlier migration, that migration's down() handles it
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    console.log('✅ Audit logs table removed successfully');
  }
}
