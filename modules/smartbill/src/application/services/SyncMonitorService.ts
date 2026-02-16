import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('SyncMonitorService');

export interface SyncJobRun {
  id: number;
  jobType: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  resultSummary: Record<string, any>;
  errorMessage: string | null;
  errorStack: string | null;
  retryCount: number;
  triggeredBy: string;
  createdAt: Date;
}

export interface JobStats {
  jobType: string;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
}

export interface DashboardData {
  lastRuns: Record<string, SyncJobRun | null>;
  stats: JobStats[];
}

export interface SyncAlert {
  jobType: string;
  severity: 'warning' | 'critical';
  message: string;
  detectedAt: Date;
}

/**
 * SyncMonitorService - Monitors sync job execution and provides dashboard data
 *
 * Uses raw queries against the sync_job_runs table to record job lifecycle
 * events and provide monitoring/alerting capabilities.
 */
export class SyncMonitorService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Record the start of a sync job run
   *
   * @param jobType - Type of job ('stock_sync', 'customer_sync', 'price_sync')
   * @param triggeredBy - How the job was triggered ('scheduler', 'manual', 'api')
   * @returns The run ID for subsequent updates
   */
  async recordJobStart(jobType: string, triggeredBy: string = 'scheduler'): Promise<number> {
    try {
      const result = await this.dataSource.query(
        `INSERT INTO sync_job_runs (job_type, status, started_at, triggered_by)
         VALUES ($1, 'running', NOW(), $2)
         RETURNING id`,
        [jobType, triggeredBy],
      );
      const runId = result[0].id;
      logger.info('Recorded job start', { jobType, triggeredBy, runId });
      return runId;
    } catch (error) {
      logger.error('Failed to record job start', {
        jobType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Record the successful completion of a sync job run
   *
   * @param runId - The run ID returned from recordJobStart
   * @param resultSummary - Summary of the job results
   */
  async recordJobComplete(runId: number, resultSummary: Record<string, any>): Promise<void> {
    try {
      await this.dataSource.query(
        `UPDATE sync_job_runs
         SET status = 'completed',
             completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER * 1000,
             result_summary = $1
         WHERE id = $2`,
        [JSON.stringify(resultSummary), runId],
      );
      logger.info('Recorded job completion', { runId, resultSummary });
    } catch (error) {
      logger.error('Failed to record job completion', {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Record a job failure
   *
   * @param runId - The run ID returned from recordJobStart
   * @param error - The error that caused the failure
   * @param retryCount - Number of retries attempted
   */
  async recordJobFailure(runId: number, error: Error | string, retryCount: number): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack || null : null;

    try {
      await this.dataSource.query(
        `UPDATE sync_job_runs
         SET status = 'failed',
             completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER * 1000,
             error_message = $1,
             error_stack = $2,
             retry_count = $3
         WHERE id = $4`,
        [errorMessage, errorStack, retryCount, runId],
      );
      logger.warn('Recorded job failure', { runId, errorMessage, retryCount });
    } catch (dbError) {
      logger.error('Failed to record job failure', {
        runId,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
      throw dbError;
    }
  }

  /**
   * Get dashboard data: last run for each job type + 7-day stats
   */
  async getDashboard(): Promise<DashboardData> {
    const jobTypes = ['stock_sync', 'customer_sync', 'price_sync'];

    // Get last run for each job type
    const lastRunRows = await this.dataSource.query(
      `SELECT DISTINCT ON (job_type)
         id, job_type, status, started_at, completed_at, duration_ms,
         result_summary, error_message, error_stack, retry_count, triggered_by, created_at
       FROM sync_job_runs
       WHERE job_type = ANY($1)
       ORDER BY job_type, started_at DESC`,
      [jobTypes],
    );

    const lastRuns: Record<string, SyncJobRun | null> = {};
    for (const jobType of jobTypes) {
      const row = lastRunRows.find((r: any) => r.job_type === jobType);
      lastRuns[jobType] = row ? this.mapRow(row) : null;
    }

    // Get 7-day stats
    const statsRows = await this.dataSource.query(
      `SELECT
         job_type,
         COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS success_count,
         COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failure_count,
         COALESCE(AVG(duration_ms) FILTER (WHERE status = 'completed'), 0)::INTEGER AS avg_duration_ms
       FROM sync_job_runs
       WHERE started_at >= NOW() - INTERVAL '7 days'
         AND job_type = ANY($1)
       GROUP BY job_type`,
      [jobTypes],
    );

    const stats: JobStats[] = jobTypes.map((jobType) => {
      const row = statsRows.find((r: any) => r.job_type === jobType);
      return {
        jobType,
        successCount: row ? row.success_count : 0,
        failureCount: row ? row.failure_count : 0,
        avgDurationMs: row ? row.avg_duration_ms : 0,
      };
    });

    return { lastRuns, stats };
  }

  /**
   * Get recent job history for a specific job type
   *
   * @param jobType - The job type to query
   * @param limit - Maximum number of records to return (default: 20)
   */
  async getJobHistory(jobType: string, limit: number = 20): Promise<SyncJobRun[]> {
    const rows = await this.dataSource.query(
      `SELECT
         id, job_type, status, started_at, completed_at, duration_ms,
         result_summary, error_message, error_stack, retry_count, triggered_by, created_at
       FROM sync_job_runs
       WHERE job_type = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [jobType, limit],
    );

    return rows.map((row: any) => this.mapRow(row));
  }

  /**
   * Get active alerts based on sync job health
   *
   * Checks for:
   * - Jobs that haven't run in 48 hours
   * - Jobs that failed 3+ times in a row
   */
  async getActiveAlerts(): Promise<SyncAlert[]> {
    const alerts: SyncAlert[] = [];
    const jobTypes = ['stock_sync', 'customer_sync', 'price_sync'];
    const now = new Date();

    for (const jobType of jobTypes) {
      // Check if job hasn't run in 48 hours
      const lastRunRows = await this.dataSource.query(
        `SELECT started_at
         FROM sync_job_runs
         WHERE job_type = $1
         ORDER BY started_at DESC
         LIMIT 1`,
        [jobType],
      );

      if (lastRunRows.length === 0) {
        alerts.push({
          jobType,
          severity: 'warning',
          message: `${jobType} has never run`,
          detectedAt: now,
        });
      } else {
        const lastStarted = new Date(lastRunRows[0].started_at);
        const hoursSinceLast = (now.getTime() - lastStarted.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast > 48) {
          alerts.push({
            jobType,
            severity: 'critical',
            message: `${jobType} has not run in ${Math.round(hoursSinceLast)} hours`,
            detectedAt: now,
          });
        }
      }

      // Check for 3+ consecutive failures
      const recentRows = await this.dataSource.query(
        `SELECT status
         FROM sync_job_runs
         WHERE job_type = $1
         ORDER BY started_at DESC
         LIMIT 3`,
        [jobType],
      );

      if (recentRows.length >= 3) {
        const allFailed = recentRows.every((r: any) => r.status === 'failed');
        if (allFailed) {
          alerts.push({
            jobType,
            severity: 'critical',
            message: `${jobType} failed 3 times in a row`,
            detectedAt: now,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Map a database row to a SyncJobRun object
   */
  private mapRow(row: any): SyncJobRun {
    return {
      id: row.id,
      jobType: row.job_type,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at || null,
      durationMs: row.duration_ms || null,
      resultSummary: row.result_summary || {},
      errorMessage: row.error_message || null,
      errorStack: row.error_stack || null,
      retryCount: row.retry_count || 0,
      triggeredBy: row.triggered_by || 'scheduler',
      createdAt: row.created_at,
    };
  }
}
