/**
 * Jobs E2E Tests Module
 *
 * Main entry point for jobs end-to-end tests.
 *
 * @module tests/e2e/jobs
 */

export { default as JobsE2ETest } from './JobsE2ETest';

export type {
  Queue,
  Worker,
  Job,
  JobsOptions,
  QueueOptions,
  WorkerOptions,
} from 'bullmq';

export type IORedis from 'ioredis';

/**
 * Job test configuration
 */
export interface JobTestConfig {
  /** Job name */
  name: string;
  /** Job data */
  data: Record<string, unknown>;
  /** Job options */
  options?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    delay?: number;
    priority?: number;
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
  };
}

/**
 * Job test result
 */
export interface JobTestResult {
  /** Job ID */
  jobId: string;
  /** Success status */
  success: boolean;
  /** Attempts made */
  attempts: number;
  /** Processing time */
  processingTime?: number;
  /** Result */
  result?: any;
  /** Error */
  error?: Error;
}

/**
 * Job test helpers
 */
export class JobTestHelpers {
  /**
   * Creates a test job configuration
   */
  static createJobConfig(name: string, data: Record<string, unknown>): JobTestConfig {
    return { name, data };
  }

  /**
   * Creates a failing job configuration
   */
  static createFailingJobConfig(name: string, failOnAttempt: number = 1): JobTestConfig {
    return {
      name,
      data: { failOnAttempt, shouldFail: true },
      options: { attempts: 3 },
    };
  }

  /**
   * Waits for job completion
   */
  static async waitForJobCompletion(
    job: any,
    timeoutMs: number = 10000
  ): Promise<JobTestResult> {
    const startTime = Date.now();

    try {
      const completedJob = await job.waitUntilFinished(timeoutMs);

      return {
        jobId: job.id!,
        success: completedJob.finishedOn !== undefined,
        attempts: completedJob.attemptsMade || 0,
        result: completedJob.returnvalue,
        error: completedJob.failedReason ? new Error(completedJob.failedReason) : undefined,
      };
    } catch (error) {
      return {
        jobId: job.id!,
        success: false,
        attempts: 0,
        processingTime: Date.now() - startTime,
        error: error as Error,
      };
    }
  }
}

export { JobTestHelpers };
export default JobTestHelpers;
