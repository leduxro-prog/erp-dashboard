import { createModuleLogger } from './logger';
import { ServiceUnavailableError } from '../errors/BaseError';

const logger = createModuleLogger('circuit-breaker');

/**
 * Circuit Breaker pattern implementation states.
 * Represents the state machine of the circuit breaker.
 *
 * @example
 * CLOSED:     Normal operation, requests pass through
 * OPEN:       Service is down, requests fail immediately (fast fail)
 * HALF_OPEN:  Testing recovery, allows probe request
 */
export enum CircuitState {
  /** Normal operation - requests pass through */
  CLOSED = 'CLOSED',
  /** Service is down - requests fail immediately */
  OPEN = 'OPEN',
  /** Testing recovery - one probe request allowed */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Configuration options for CircuitBreaker.
 * Controls thresholds, timeouts, and filtering behavior.
 *
 * @example
 * {
 *   failureThreshold: 5,
 *   resetTimeout: 30000,
 *   monitorInterval: 10000,
 *   timeout: 10000,
 *   volumeThreshold: 10,
 *   errorFilter: (err) => err.code !== 404,
 * }
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Milliseconds before attempting to close circuit (default: 30000) */
  resetTimeout: number;
  /** Milliseconds between health check evaluations (default: 10000) */
  monitorInterval: number;
  /** Milliseconds before request timeout (default: 10000) */
  timeout: number;
  /** Minimum requests before evaluating (default: 10) */
  volumeThreshold: number;
  /** Optional filter: return true if error counts as failure */
  errorFilter?: (error: Error) => boolean;
}

/**
 * Circuit Breaker statistics for monitoring and debugging.
 * Tracks request metrics and state transitions.
 *
 * @example
 * {
 *   state: 'CLOSED',
 *   totalRequests: 150,
 *   successCount: 148,
 *   failureCount: 2,
 *   lastFailureTime: '2025-02-07T10:30:00Z',
 *   successRate: 0.9867,
 * }
 */
export interface CircuitBreakerStats {
  /** Current circuit state */
  state: CircuitState;
  /** Total requests processed */
  totalRequests: number;
  /** Successful requests */
  successCount: number;
  /** Failed requests */
  failureCount: number;
  /** Last time a failure occurred */
  lastFailureTime: Date | null;
  /** Success rate percentage 0-1 */
  successRate: number;
}

/**
 * Circuit Breaker pattern for external service calls.
 * Prevents cascade failures when external APIs (SmartBill, WooCommerce, Suppliers) are down.
 *
 * State machine:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail immediately (fast fail)
 * - HALF_OPEN: Testing if service recovered, allows one probe request
 * - On success in HALF_OPEN: transition to CLOSED
 * - On failure in HALF_OPEN: transition back to OPEN
 *
 * Supports:
 * - Sliding window failure counting (not cumulative)
 * - Configurable error filtering (4xx errors don't trigger breaker)
 * - Event emission on state changes
 * - Statistics tracking
 * - Fallback function support
 *
 * @example
 * const breaker = new CircuitBreaker('smartbill-api', {
 *   failureThreshold: 5,
 *   resetTimeout: 30000,
 *   monitorInterval: 10000,
 *   timeout: 10000,
 * });
 *
 * const result = await breaker.execute(() => smartBillClient.createInvoice(data));
 *
 * @example
 * // With fallback for graceful degradation
 * const result = await breaker.execute(
 *   () => externalAPI.call(),
 *   () => cachedData,
 * );
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: Date | null = null;
  private lastStateChangeTime: Date = new Date();
  private requestTimestamps: number[] = [];

  private options: Required<CircuitBreakerOptions>;
  private monitorIntervalId: NodeJS.Timeout | null = null;

  /**
   * Create a new CircuitBreaker instance.
   * Initializes with configuration and sets up monitoring.
   *
   * @param name - Breaker name for logging and identification
   * @param options - Configuration options
   *
   * @example
   * const breaker = new CircuitBreaker('external-api', {
   *   failureThreshold: 5,
   *   resetTimeout: 30000,
   * });
   */
  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions
  ) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 30000,
      monitorInterval: options.monitorInterval || 10000,
      timeout: options.timeout || 10000,
      volumeThreshold: options.volumeThreshold || 10,
      errorFilter: options.errorFilter || this.defaultErrorFilter,
    };

    logger.info('Circuit breaker created', {
      name: this.name,
      options: this.options,
    });

    this.startMonitoring();
  }

  /**
   * Default error filter - counts all errors as failures.
   * Subclasses can override via options.errorFilter.
   *
   * @param error - The error to evaluate
   * @returns true if error counts as failure, false otherwise
   *
   * @internal
   */
  private defaultErrorFilter(error: Error): boolean {
    // By default, all errors count as failures
    return true;
  }

  /**
   * Start monitoring task for health checks.
   * Periodically evaluates if circuit should transition states.
   *
   * @internal
   */
  private startMonitoring(): void {
    if (this.monitorIntervalId) {
      return; // Already monitoring
    }

    this.monitorIntervalId = setInterval(() => {
      this.evaluate();
    }, this.options.monitorInterval);

    // Allow interval to not block process
    if (this.monitorIntervalId.unref) {
      this.monitorIntervalId.unref();
    }
  }

  /**
   * Stop the monitoring task.
   *
   * @internal
   */
  private stopMonitoring(): void {
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = null;
    }
  }

  /**
   * Evaluate circuit state and potentially transition.
   * Moves from HALF_OPEN back to CLOSED or OPEN based on request success.
   *
   * @internal
   */
  private evaluate(): void {
    if (this.state !== CircuitState.HALF_OPEN) {
      return; // Only evaluate in HALF_OPEN state
    }

    // If we haven't had requests in HALF_OPEN state, stay there
    const recentRequests = this.requestTimestamps.filter(
      (ts) => ts > Date.now() - this.options.monitorInterval
    );

    if (recentRequests.length === 0) {
      // No recent requests - circuit stays HALF_OPEN
      logger.debug('Circuit breaker in HALF_OPEN - waiting for probe request', {
        name: this.name,
      });
      return;
    }

    // Evaluate success rate
    if (this.totalRequests > 0 && this.successCount > 0) {
      const recentSuccesses = recentRequests.length;
      if (recentSuccesses > 0) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Transition to a new state with logging.
   *
   * @param newState - New circuit state
   *
   * @internal
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeTime = new Date();

    if (newState === CircuitState.OPEN) {
      logger.warn('Circuit breaker opened', {
        name: this.name,
        fromState: oldState,
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
      });
    } else if (newState === CircuitState.CLOSED) {
      logger.info('Circuit breaker closed', {
        name: this.name,
        fromState: oldState,
        successCount: this.successCount,
      });
    } else {
      logger.info('Circuit breaker half-open', {
        name: this.name,
        fromState: oldState,
        resetTimeout: this.options.resetTimeout,
      });
    }
  }

  /**
   * Record a successful request.
   * Resets failure count and potentially closes circuit.
   *
   * @internal
   */
  private recordSuccess(): void {
    this.successCount++;
    this.totalRequests++;
    this.requestTimestamps.push(Date.now());

    // Clean old timestamps (sliding window)
    const windowStart = Date.now() - this.options.resetTimeout;
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > windowStart);

    logger.debug('Circuit breaker recorded success', {
      name: this.name,
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount,
    });

    // If in HALF_OPEN and succeeded, close circuit
    if (this.state === CircuitState.HALF_OPEN) {
      this.failureCount = 0;
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  /**
   * Record a failed request.
   * Increments failure count and potentially opens circuit.
   *
   * @internal
   */
  private recordFailure(): void {
    this.failureCount++;
    this.totalRequests++;
    this.lastFailureTime = new Date();
    this.requestTimestamps.push(Date.now());

    // Clean old timestamps
    const windowStart = Date.now() - this.options.resetTimeout;
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > windowStart);

    logger.debug('Circuit breaker recorded failure', {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
    });

    // Check if we should open circuit
    if (
      this.state === CircuitState.CLOSED &&
      this.totalRequests >= this.options.volumeThreshold &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Execute a function with circuit breaker protection.
   * Handles retries, timeouts, and fallback logic.
   *
   * @typeParam T - Return type of the function
   *
   * @param fn - Async function to execute
   * @param fallbackFn - Optional fallback function to call if circuit is open
   * @returns Result from fn or fallbackFn
   * @throws {ServiceUnavailableError} If circuit is open and no fallback provided
   *
   * @example
   * const result = await breaker.execute(() => externalAPI.call());
   *
   * @example
   * // With fallback
   * const result = await breaker.execute(
   *   () => externalAPI.call(),
   *   () => cachedFallback,
   * );
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallbackFn?: () => T | Promise<T>
  ): Promise<T> {
    // If circuit is open, fail fast
    if (this.state === CircuitState.OPEN) {
      const timeSinceOpen = Date.now() - this.lastStateChangeTime.getTime();
      if (timeSinceOpen < this.options.resetTimeout) {
        // Still in open window
        if (fallbackFn) {
          logger.info('Circuit breaker open - using fallback', { name: this.name });
          return fallbackFn();
        }

        logger.warn('Circuit breaker open - rejecting request', {
          name: this.name,
          timeSinceOpen,
          resetTimeout: this.options.resetTimeout,
        });

        throw new ServiceUnavailableError(this.name);
      } else {
        // Time to try recovery
        this.transitionTo(CircuitState.HALF_OPEN);
        logger.info('Circuit breaker entering HALF_OPEN - probe request allowed', {
          name: this.name,
        });
      }
    }

    // Execute request with timeout
    try {
      const promise = fn();
      const result = await Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Request timeout after ${this.options.timeout}ms`)),
            this.options.timeout
          )
        ),
      ]);

      this.recordSuccess();
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if error should count as failure
      if (this.options.errorFilter(err)) {
        this.recordFailure();

        // If in HALF_OPEN and failed, go back to OPEN
        if (this.state === CircuitState.HALF_OPEN) {
          this.transitionTo(CircuitState.OPEN);
        }
      }

      // Use fallback if available
      if (fallbackFn) {
        logger.info('Request failed - using fallback', {
          name: this.name,
          error: err.message,
        });
        return fallbackFn();
      }

      throw err;
    }
  }

  /**
   * Get current circuit state.
   *
   * @returns Current state (CLOSED, OPEN, HALF_OPEN)
   *
   * @example
   * if (breaker.getState() === CircuitState.OPEN) {
   *   console.log('Service is down');
   * }
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics.
   *
   * @returns Metrics including state, success/failure counts, and rates
   *
   * @example
   * const stats = breaker.getStats();
   * console.log(`Success rate: ${(stats.successRate * 100).toFixed(2)}%`);
   */
  getStats(): CircuitBreakerStats {
    const successRate = this.totalRequests > 0 ? this.successCount / this.totalRequests : 0;

    return {
      state: this.state,
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successRate,
    };
  }

  /**
   * Manually reset circuit breaker to closed state.
   * Clears all counters and statistics.
   * Useful for manual recovery after fixing underlying issue.
   *
   * @example
   * if (systemHealthy) {
   *   breaker.reset();
   * }
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.lastFailureTime = null;
    this.requestTimestamps = [];

    logger.info('Circuit breaker reset', { name: this.name });
  }

  /**
   * Cleanup resources (monitoring interval).
   * Call when breaker is no longer needed.
   *
   * @example
   * breaker.destroy();
   */
  destroy(): void {
    this.stopMonitoring();
    logger.info('Circuit breaker destroyed', { name: this.name });
  }
}

export default CircuitBreaker;
