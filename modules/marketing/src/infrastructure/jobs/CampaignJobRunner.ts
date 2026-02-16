/**
 * CampaignJobRunner
 * Infrastructure job runner for scheduled marketing campaign tasks
 *
 * @module Infrastructure/Jobs
 */
import { DataSource } from 'typeorm';
import { Logger } from 'winston';

/**
 * Record of a failed job execution stored in the Dead Letter Queue
 */
export interface DLQRecord {
  /** Job name that failed */
  jobName: string;
  /** Error message */
  error: string;
  /** Stack trace (if available) */
  stack?: string;
  /** When the failure occurred */
  failedAt: Date;
  /** Number of times this job has failed */
  attemptNumber: number;
}

/**
 * Internal representation of a scheduled job
 */
interface ScheduledJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
  timer: ReturnType<typeof setInterval>;
}

/**
 * CampaignJobRunner
 *
 * Manages scheduled background jobs for the marketing module.
 * Provides built-in jobs for common campaign operations and
 * supports custom job scheduling via scheduleJob().
 *
 * Includes a simple DLQ (Dead Letter Queue) that captures
 * failed job execution records with timestamps for monitoring.
 */
export class CampaignJobRunner {
  private readonly jobs: Map<string, ScheduledJob> = new Map();
  private readonly dlq: DLQRecord[] = [];
  private readonly attemptCounts: Map<string, number> = new Map();

  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  /**
   * Schedule a named job to run at a fixed interval
   * @param name - Unique job name
   * @param intervalMs - Interval in milliseconds
   * @param handler - Async handler function
   */
  scheduleJob(name: string, intervalMs: number, handler: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      this.logger.warn(`Job "${name}" already scheduled, replacing`, { job: name });
      const existing = this.jobs.get(name)!;
      clearInterval(existing.timer);
    }

    const wrappedHandler = async (): Promise<void> => {
      try {
        await handler();
        // Reset attempt count on success
        this.attemptCounts.set(name, 0);
      } catch (err) {
        const attempt = (this.attemptCounts.get(name) ?? 0) + 1;
        this.attemptCounts.set(name, attempt);

        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error(`Job "${name}" failed (attempt ${attempt})`, {
          job: name,
          attempt,
          error: error.message,
        });

        this.dlq.push({
          jobName: name,
          error: error.message,
          stack: error.stack,
          failedAt: new Date(),
          attemptNumber: attempt,
        });
      }
    };

    const timer = setInterval(wrappedHandler, intervalMs);

    this.jobs.set(name, {
      name,
      intervalMs,
      handler,
      timer,
    });

    this.logger.info(`Scheduled job "${name}" every ${intervalMs}ms`, {
      job: name,
      intervalMs,
    });
  }

  /**
   * Stop all scheduled jobs and clear timers
   */
  stopAll(): void {
    for (const [name, job] of this.jobs) {
      clearInterval(job.timer);
      this.logger.info(`Stopped job "${name}"`, { job: name });
    }
    this.jobs.clear();
    this.logger.info('All jobs stopped');
  }

  /**
   * Process pending channel deliveries
   * Finds queued deliveries and processes them
   */
  async processPendingDeliveries(): Promise<void> {
    this.logger.info('Processing pending deliveries...', { job: 'processPendingDeliveries' });

    // Stub: In production, this would:
    // 1. Query ChannelDeliveryEntity for status = 'QUEUED'
    // 2. Send via appropriate channel (email, SMS, etc.)
    // 3. Update delivery status to SENT/FAILED
    this.logger.info('Pending deliveries processing complete (stub)', {
      job: 'processPendingDeliveries',
    });
  }

  /**
   * Check for campaigns that have passed their end date
   * Marks ACTIVE campaigns past endDate as COMPLETED
   */
  async checkCampaignExpiration(): Promise<void> {
    this.logger.info('Checking for expired campaigns...', { job: 'checkCampaignExpiration' });

    // Stub: In production, this would:
    // 1. Query CampaignEntity for status = 'ACTIVE' AND endDate < NOW()
    // 2. Update each campaign status to 'COMPLETED'
    // 3. Emit campaign.completed events
    this.logger.info('Campaign expiration check complete (stub)', {
      job: 'checkCampaignExpiration',
    });
  }

  /**
   * Clean up old marketing events
   * @param olderThanDays - Delete events older than this many days
   */
  async cleanupOldEvents(olderThanDays: number): Promise<void> {
    this.logger.info(`Cleaning up events older than ${olderThanDays} days...`, {
      job: 'cleanupOldEvents',
      olderThanDays,
    });

    // Stub: In production, this would:
    // 1. Call MarketingEventRepository.deleteOlderThan(olderThanDays)
    // 2. Log how many events were deleted
    this.logger.info('Old events cleanup complete (stub)', {
      job: 'cleanupOldEvents',
      olderThanDays,
    });
  }

  /**
   * Retry failed channel deliveries
   * Finds deliveries with status FAILED that are eligible for retry
   */
  async retryFailedDeliveries(): Promise<void> {
    this.logger.info('Retrying failed deliveries...', { job: 'retryFailedDeliveries' });

    // Stub: In production, this would:
    // 1. Query ChannelDeliveryEntity for status = 'FAILED' AND retryCount < maxRetries
    // 2. Re-queue them for processing
    // 3. Increment retryCount
    // 4. Move permanently failed items to DLQ
    this.logger.info('Failed deliveries retry complete (stub)', {
      job: 'retryFailedDeliveries',
    });
  }

  /**
   * Start all built-in jobs with default intervals
   */
  start(): void {
    this.logger.info('Starting CampaignJobRunner built-in jobs...');

    // Process pending deliveries every 30 seconds
    this.scheduleJob('processPendingDeliveries', 30_000, () => this.processPendingDeliveries());

    // Check campaign expiration every 5 minutes
    this.scheduleJob('checkCampaignExpiration', 5 * 60_000, () => this.checkCampaignExpiration());

    // Cleanup old events once per day (24h interval, keeps last 90 days)
    this.scheduleJob('cleanupOldEvents', 24 * 60 * 60_000, () => this.cleanupOldEvents(90));

    // Retry failed deliveries every 2 minutes
    this.scheduleJob('retryFailedDeliveries', 2 * 60_000, () => this.retryFailedDeliveries());

    this.logger.info('CampaignJobRunner started with all built-in jobs');
  }

  /**
   * Stop all jobs
   */
  stop(): void {
    this.logger.info('Stopping CampaignJobRunner...');
    this.stopAll();
    this.logger.info('CampaignJobRunner stopped');
  }

  /**
   * Get the Dead Letter Queue records
   * @returns Copy of DLQ records
   */
  getDLQ(): DLQRecord[] {
    return [...this.dlq];
  }

  /**
   * Get DLQ records for a specific job
   * @param jobName - Job name to filter by
   * @returns Filtered DLQ records
   */
  getDLQByJob(jobName: string): DLQRecord[] {
    return this.dlq.filter((r) => r.jobName === jobName);
  }

  /**
   * Clear the Dead Letter Queue
   * @returns Number of records cleared
   */
  clearDLQ(): number {
    const count = this.dlq.length;
    this.dlq.length = 0;
    this.logger.info(`Cleared ${count} DLQ records`);
    return count;
  }

  /**
   * Get names of all currently scheduled jobs
   */
  getScheduledJobs(): string[] {
    return Array.from(this.jobs.keys());
  }
}
