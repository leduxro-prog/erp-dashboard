/**
 * @file Retry Policy
 * @module event-sdk/utils/RetryPolicy
 * @description Configurable retry policies with backoff strategies for event processing
 */

import {
  RetryConfig,
  RetryPolicyType,
  ClassifiedError,
  ErrorType,
} from '../types';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  policy: RetryPolicyType.EXPONENTIAL_WITH_JITTER,
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: [
    ErrorType.TRANSIENT_ERROR,
    ErrorType.EXTERNAL_SERVICE_ERROR,
    ErrorType.TIMEOUT_ERROR,
  ],
};

/**
 * Error types that are considered retryable by default
 */
const DEFAULT_RETRYABLE_ERRORS = new Set<ErrorType>([
  ErrorType.TRANSIENT_ERROR,
  ErrorType.EXTERNAL_SERVICE_ERROR,
  ErrorType.TIMEOUT_ERROR,
  ErrorType.DATABASE_ERROR,
]);

/**
 * Retry Policy Class
 *
 * Provides configurable retry strategies with various backoff algorithms.
 * Supports fixed, exponential, linear, and jittered backoff.
 */
export class RetryPolicy {
  private config: Required<RetryConfig>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
      maxAttempts: config.maxAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts,
      initialDelayMs: config.initialDelayMs ?? DEFAULT_RETRY_CONFIG.initialDelayMs,
      maxDelayMs: config.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
      backoffMultiplier:
        config.backoffMultiplier ?? DEFAULT_RETRY_CONFIG.backoffMultiplier,
      jitterFactor: config.jitterFactor ?? DEFAULT_RETRY_CONFIG.jitterFactor,
      retryableErrors:
        config.retryableErrors ?? DEFAULT_RETRY_CONFIG.retryableErrors,
    };
  }

  /**
   * Check if an error is retryable based on configuration
   *
   * @param error - Classified error to check
   * @returns True if error should be retried
   */
  public isRetryable(error: ClassifiedError): boolean {
    // If no retry configuration, use default
    if (this.config.retryableErrors.length === 0) {
      return DEFAULT_RETRYABLE_ERRORS.has(error.type);
    }
    return this.config.retryableErrors.includes(error.type);
  }

  /**
   * Get the next retry delay based on attempt number and policy
   *
   * @param attempt - Current retry attempt (1-based)
   * @returns Delay in milliseconds before next retry
   */
  public getRetryDelay(attempt: number): number {
    if (attempt <= 0) {
      return this.config.initialDelayMs;
    }

    let delay: number;

    switch (this.config.policy) {
      case RetryPolicyType.NONE:
        delay = 0;
        break;

      case RetryPolicyType.FIXED:
        delay = this.config.initialDelayMs;
        break;

      case RetryPolicyType.EXPONENTIAL:
        delay = this.calculateExponentialDelay(attempt);
        break;

      case RetryPolicyType.EXPONENTIAL_WITH_JITTER:
        delay = this.calculateExponentialWithJitterDelay(attempt);
        break;

      case RetryPolicyType.LINEAR:
        delay = this.calculateLinearDelay(attempt);
        break;

      default:
        delay = this.config.initialDelayMs;
    }

    // Cap at max delay
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Calculate exponential backoff delay
   *
   * @param attempt - Retry attempt number
   * @returns Delay in milliseconds
   */
  private calculateExponentialDelay(attempt: number): number {
    return Math.floor(
      this.config.initialDelayMs *
        Math.pow(this.config.backoffMultiplier, attempt - 1)
    );
  }

  /**
   * Calculate exponential backoff with jitter delay
   *
   * @param attempt - Retry attempt number
   * @returns Delay in milliseconds
   */
  private calculateExponentialWithJitterDelay(attempt: number): number {
    const baseDelay = this.calculateExponentialDelay(attempt);
    const jitterRange = baseDelay * this.config.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Calculate linear backoff delay
   *
   * @param attempt - Retry attempt number
   * @returns Delay in milliseconds
   */
  private calculateLinearDelay(attempt: number): number {
    return Math.floor(
      this.config.initialDelayMs + (attempt - 1) * this.config.initialDelayMs * 0.5
    );
  }

  /**
   * Check if more retries are allowed
   *
   * @param attempt - Current retry attempt
   * @returns True if retries are still available
   */
  public canRetry(attempt: number): boolean {
    return attempt <= this.config.maxAttempts;
  }

  /**
   * Get the maximum number of retry attempts
   *
   * @returns Maximum retry attempts
   */
  public getMaxAttempts(): number {
    return this.config.maxAttempts;
  }

  /**
   * Calculate total timeout for all retries
   *
   * @returns Total timeout in milliseconds
   */
  public getTotalTimeout(): number {
    let total = 0;
    for (let i = 1; i <= this.config.maxAttempts; i++) {
      total += this.getRetryDelay(i);
    }
    return total;
  }

  /**
   * Execute an async function with retry logic
   *
   * @param fn - Async function to execute
   * @param onRetry - Optional callback before each retry
   * @returns Result of the function
   * @throws Error if all retries are exhausted
   */
  public async executeWithRetry<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: unknown, delay: number) => void
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if this is the last attempt
        if (attempt === this.config.maxAttempts) {
          break;
        }

        // Calculate delay
        const delay = this.getRetryDelay(attempt);

        // Call onRetry callback
        if (onRetry) {
          onRetry(attempt, error, delay);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for a specified duration
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the current configuration
   *
   * @returns Current retry configuration
   */
  public getConfig(): Readonly<Required<RetryConfig>> {
    return { ...this.config };
  }

  /**
   * Update the retry configuration
   *
   * @param config - New configuration values
   */
  public updateConfig(config: Partial<RetryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      maxAttempts: config.maxAttempts ?? this.config.maxAttempts,
      initialDelayMs:
        config.initialDelayMs ?? this.config.initialDelayMs,
      maxDelayMs: config.maxDelayMs ?? this.config.maxDelayMs,
      backoffMultiplier:
        config.backoffMultiplier ?? this.config.backoffMultiplier,
      jitterFactor: config.jitterFactor ?? this.config.jitterFactor,
      retryableErrors:
        config.retryableErrors ?? this.config.retryableErrors,
    };
  }

  /**
   * Create a retry policy from a simple configuration
   *
   * @param maxRetries - Maximum number of retries
   * @param initialDelay - Initial delay in seconds
   * @returns New RetryPolicy instance
   *
   * @example
   * ```typescript
   * const policy = RetryPolicy.simple(3, 1); // 3 retries, 1 second initial delay
   * ```
   */
  public static simple(
    maxRetries: number,
    initialDelay: number = 1
  ): RetryPolicy {
    return new RetryPolicy({
      policy: RetryPolicyType.EXPONENTIAL_WITH_JITTER,
      maxAttempts: maxRetries,
      initialDelayMs: initialDelay * 1000,
    });
  }

  /**
   * Create a no-retry policy
   *
   * @returns RetryPolicy with no retries
   */
  public static noRetry(): RetryPolicy {
    return new RetryPolicy({
      policy: RetryPolicyType.NONE,
      maxAttempts: 0,
    });
  }

  /**
   * Create an immediate retry policy (no delay between retries)
   *
   * @param maxRetries - Maximum number of retries
   * @returns RetryPolicy with immediate retries
   */
  public static immediate(maxRetries: number): RetryPolicy {
    return new RetryPolicy({
      policy: RetryPolicyType.FIXED,
      maxAttempts: maxRetries,
      initialDelayMs: 0,
    });
  }

  /**
   * Create a fixed delay retry policy
   *
   * @param maxRetries - Maximum number of retries
   * @param delayMs - Fixed delay between retries
   * @returns RetryPolicy with fixed delay
   */
  public static fixedDelay(
    maxRetries: number,
    delayMs: number
  ): RetryPolicy {
    return new RetryPolicy({
      policy: RetryPolicyType.FIXED,
      maxAttempts: maxRetries,
      initialDelayMs: delayMs,
    });
  }

  /**
   * Create an exponential backoff retry policy
   *
   * @param maxRetries - Maximum number of retries
   * @param initialDelayMs - Initial delay in milliseconds
   * @param multiplier - Backoff multiplier
   * @returns RetryPolicy with exponential backoff
   */
  public static exponential(
    maxRetries: number,
    initialDelayMs: number = 1000,
    multiplier: number = 2
  ): RetryPolicy {
    return new RetryPolicy({
      policy: RetryPolicyType.EXPONENTIAL,
      maxAttempts: maxRetries,
      initialDelayMs,
      backoffMultiplier: multiplier,
    });
  }
}

/**
 * Calculate retry delay as a standalone function
 *
 * @param attempt - Retry attempt number
 * @param policy - Retry policy type
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicyType,
  config: Pick<
    Required<RetryConfig>,
    'initialDelayMs' | 'backoffMultiplier' | 'jitterFactor'
  >
): number {
  const retryPolicy = new RetryPolicy({ policy, ...config });
  return retryPolicy.getRetryDelay(attempt);
}

/**
 * Check if error is retryable as a standalone function
 *
 * @param error - Error to check
 * @param retryableErrors - List of retryable error types
 * @returns True if error is retryable
 */
export function isRetryable(
  error: ClassifiedError | ErrorType,
  retryableErrors: ErrorType[] = []
): boolean {
  const errorType =
    typeof error === 'string' ? error : (error as ClassifiedError).type;

  if (retryableErrors.length === 0) {
    return DEFAULT_RETRYABLE_ERRORS.has(errorType);
  }
  return retryableErrors.includes(errorType);
}
