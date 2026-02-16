import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create sync_job_runs table
 *
 * Tracks execution history for all SmartBill sync jobs (stock, customer, price).
 * Supports monitoring dashboard with job status, duration, results, and error tracking.
 */
export class CreateSyncDashboardTable1739680000000 implements MigrationInterface {
  name = 'CreateSyncDashboardTable1739680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_job_runs (
        id              BIGSERIAL PRIMARY KEY,
        job_type        VARCHAR(50)  NOT NULL,
        status          VARCHAR(20)  NOT NULL DEFAULT 'running',
        started_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        completed_at    TIMESTAMP WITH TIME ZONE,
        duration_ms     INTEGER,
        result_summary  JSONB        DEFAULT '{}',
        error_message   TEXT,
        error_stack     TEXT,
        retry_count     INTEGER      DEFAULT 0,
        triggered_by    VARCHAR(50)  DEFAULT 'scheduler',
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sync_job_runs_type_status
        ON sync_job_runs(job_type, status);

      CREATE INDEX IF NOT EXISTS idx_sync_job_runs_started
        ON sync_job_runs(started_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sync_job_runs;`);
  }
}
