import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add account lockout fields to users table
 *
 * Fields added:
 * 1. failed_login_attempts - Counter for failed login attempts
 * 2. locked_until - Timestamp when account lockout expires
 *
 * Lockout logic:
 * - After 5 failed login attempts, account is locked for 15 minutes
 * - On successful login, counter is reset to 0
 */
export class AddUserLockoutFields1739470000000 implements MigrationInterface {
  name = 'AddUserLockoutFields1739470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add failed_login_attempts column
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0
    `);

    // Add locked_until column
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN locked_until TIMESTAMP NULL
    `);

    // Add index on locked_until for faster lookups
    await queryRunner.query(`
      CREATE INDEX idx_users_locked_until
      ON users (locked_until)
      WHERE locked_until IS NOT NULL
    `);

    console.log('✅ User lockout fields added successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_locked_until
    `);

    // Drop columns in reverse order
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS locked_until
    `);

    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS failed_login_attempts
    `);

    console.log('✅ User lockout fields removed successfully');
  }
}
