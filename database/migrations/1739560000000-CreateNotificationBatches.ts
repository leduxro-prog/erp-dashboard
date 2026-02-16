import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationBatches1739560000000 implements MigrationInterface {
  name = 'CreateNotificationBatches1739560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_batches_status_enum') THEN
          CREATE TYPE notification_batches_status_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_batches (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        notifications UUID[] NOT NULL DEFAULT '{}',
        status notification_batches_status_enum NOT NULL DEFAULT 'PENDING',
        total_count INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_batches_status
      ON notification_batches(status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_batches_created_at
      ON notification_batches(created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notification_batches_created_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notification_batches_status;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_batches;`);
    await queryRunner.query(`DROP TYPE IF EXISTS notification_batches_status_enum;`);
  }
}
