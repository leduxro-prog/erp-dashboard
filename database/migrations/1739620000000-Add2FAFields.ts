import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Two-Factor Authentication (2FA) fields to users table
 *
 * Fields added:
 * 1. twofa_enabled - Boolean flag to enable/disable 2FA
 * 2. twofa_secret - Secret key for TOTP generation (encrypted)
 * 3. twofa_backup_codes - Array of hashed backup codes
 */
export class Add2FAFields1739620000000 implements MigrationInterface {
  name = 'Add2FAFields1739620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 2FA fields
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN twofa_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN twofa_secret TEXT NULL,
      ADD COLUMN twofa_backup_codes JSONB NULL
    `);

    console.log('✅ User 2FA fields added successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop 2FA fields
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS twofa_backup_codes,
      DROP COLUMN IF EXISTS twofa_secret,
      DROP COLUMN IF EXISTS twofa_enabled
    `);

    console.log('✅ User 2FA fields removed successfully');
  }
}
