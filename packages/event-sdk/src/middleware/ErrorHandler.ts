/**
 * @file Error Handler Middleware
 * @module event-sdk/middleware/ErrorHandler
 * @description Error classification and handling middleware
 */

import {
  MiddlewareFunction,
  MiddlewareContext,
  ErrorHandlerConfig,
  Logger,
  ErrorType,
  ErrorSeverity,
  ClassifiedError,
} from '../types';
import { EventEnvelope } from '@cypher/events';

/**
 * Error classifier function
 */
export type ErrorClassifierFunction = (
  error: unknown,
  context?: MiddlewareContext
) => ErrorType | null;

/**
 * Built-in error classifiers
 */
export const ERROR_CLASSIFIERS: Record<
  string,
  ErrorClassifierFunction
> = {
  // Network/timeout errors
  isNetworkError: (error) => {
    if (error instanceof Error) {
      return (
        error.name === 'NetworkError' ||
        error.name === 'TimeoutError' ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ECONNRESET')
      )
        ? ErrorType.TRANSIENT_ERROR
        : null;
    }
    return null;
  },

  // Database errors
  isDatabaseError: (error) => {
    if (error instanceof Error) {
      return (
        error.name === 'DatabaseError' ||
        error.message.includes('database') ||
        error.message.includes('connection') ||
        error.message.includes('query')
      )
        ? ErrorType.DATABASE_ERROR
        : null;
    }
    return null;
  },

  // Timeout errors
  isTimeoutError: (error) => {
    if (error instanceof Error) {
      return error.name === 'TimeoutError' ||
        error.message.toLowerCase().includes('timeout')
        ? ErrorType.TIMEOUT_ERROR
        : null;
    }
    return null;
  },

  // Validation errors
  isValidationError: (error) => {
    if (error instanceof Error) {
      return (
        error.name === 'ValidationError' ||
        error.name === 'SchemaValidationError' ||
        error.name === 'DeserializationError'
      )
        ? ErrorType.VALIDATION_ERROR
        : null;
    }
    return null;
  },

  // Business logic errors
  isBusinessError: (error, context) => {
    if (error instanceof Error) {
      const businessErrorPatterns = [
        'insufficient stock',
        'invalid state',
        'not allowed',
        'business rule',
        'constraint',
      ];

      return businessErrorPatterns.some((pattern) =>
        error.message.toLowerCase().includes(pattern)
      )
        ? ErrorType.BUSINESS_ERROR
        : null;
    }
    return null;
  },

  // External service errors
  isExternalServiceError: (error, context) => {
    if (error instanceof Error) {
      return (
        error.name === 'ExternalServiceError' ||
        error.message.includes('API') ||
        error.message.includes('service') ||
        error.message.includes('external')
      )
        ? ErrorType.EXTERNAL_SERVICE_ERROR
        : null;
    }
    return null;
  },
};

/**
 * Error mapping for specific error types
 */
const ERROR_TYPE_SEVERITY_MAP: Record<ErrorType, ErrorSeverity> = {
  [ErrorType.VALIDATION_ERROR]: ErrorSeverity.LOW,
  [ErrorType.SCHEMA_VALIDATION_ERROR]: ErrorSeverity.LOW,
  [ErrorType.DUPLICATE_EVENT]: ErrorSeverity.LOW,
  [ErrorType.TRANSIENT_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorType.BUSINESS_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorType.EXTERNAL_SERVICE_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorType.DATABASE_ERROR]: ErrorSeverity.HIGH,
  [ErrorType.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorType.CONFIGURATION_ERROR]: ErrorSeverity.HIGH,
  [ErrorType.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM,
};

/**
 * Default error handler configuration
 */
const DEFAULT_ERROR_HANDLER_CONFIG: Required<ErrorHandlerConfig> = {
  enabled: true,
  defaultErrorType: ErrorType.UNKNOWN_ERROR,
  defaultSeverity: ErrorSeverity.MEDIUM,
  autoClassify: true,
  errorClassifiers: Object.values(ERROR_CLASSIFIERS),
};

/**
 * Error thrown when error classification fails
 */
export class ErrorClassificationError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ErrorClassificationError';
  }
}

/**
 * Error Handler Middleware
 *
 * Classifies errors into types and severity levels.
 * Determines whether errors are retryable.
 */
export class ErrorHandlerMiddleware {
  private config: Required<ErrorHandlerConfig>;
  private logger?: Logger;
  private customClassifiers: ErrorClassifierFunction[] = [];

  constructor(
    config: Partial<ErrorHandlerConfig> = {},
    logger?: Logger
  ) {
    this.config = {
      ...DEFAULT_ERROR_HANDLER_CONFIG,
      ...config,
      defaultErrorType:
        config.defaultErrorType ?? DEFAULT_ERROR_HANDLER_CONFIG.defaultErrorType,
      defaultSeverity:
        config.defaultSeverity ?? DEFAULT_ERROR_HANDLER_CONFIG.defaultSeverity,
      autoClassify:
        config.autoClassify ?? DEFAULT_ERROR_HANDLER_CONFIG.autoClassify,
      errorClassifiers:
        config.errorClassifiers ?? DEFAULT_ERROR_HANDLER_CONFIG.errorClassifiers,
    };
    this.logger = logger;

    // Add custom classifiers
    if (config.errorClassifiers) {
      this.customClassifiers.push(...config.errorClassifiers);
    }
  }

  /**
   * Create a middleware function for use in the pipeline
   *
   * @returns Middleware function
   */
  public middleware(): MiddlewareFunction {
    return async (context: MiddlewareContext, next: () => Promise<void>) => {
      // Skip if disabled
      if (!this.config.enabled) {
        await next();
        return;
      }

      try {
        await next();
      } catch (error) {
        // Classify the error
        const classifiedError = this.classifyError(error, context);

        // Store in context
        context.error = classifiedError;
        context.shouldReject = true;

        // Log the error
        this.logError(classifiedError, context);

        // Re-throw the error
        throw classifiedError;
      }
    };
  }

  /**
   * Classify an error into a ClassifiedError
   *
   * @param error - Error to classify
   * @param context - Optional middleware context
   * @returns Classified error
   */
  public classifyError(
    error: unknown,
    context?: MiddlewareContext
  ): ClassifiedError {
    // If already classified, return as-is
    if (this.isClassifiedError(error)) {
      return error as ClassifiedError;
    }

    // Create base error object
    const baseError =
      error instanceof Error
        ? error
        : new Error(String(error));

    // Determine error type
    let errorType = this.config.defaultErrorType;

    if (this.config.autoClassify) {
      // Try built-in classifiers first
      for (const classifier of this.config.errorClassifiers) {
        const result = classifier(error, context);
        if (result) {
          errorType = result;
          break;
        }
      }

      // Try custom classifiers
      if (errorType === this.config.defaultErrorType) {
        for (const classifier of this.customClassifiers) {
          const result = classifier(error, context);
          if (result) {
            errorType = result;
            break;
          }
        }
      }
    }

    // Determine severity
    const severity = ERROR_TYPE_SEVERITY_MAP[errorType] || this.config.defaultSeverity;

    // Determine if retryable
    const retryable = this.isRetryable(errorType);

    // Create context information
    const errorContext: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    };

    if (context) {
      errorContext.eventId = context.envelope.event_id;
      errorContext.eventType = context.envelope.event_type;
      errorContext.correlationId = context.correlationId;
      errorContext.retryAttempt = context.retryAttempt;
    }

    // Create classified error
    return Object.assign(baseError, {
      type: errorType,
      severity,
      retryable,
      originalError: error,
      context: errorContext,
    }) as ClassifiedError;
  }

  /**
   * Check if an error is already classified
   *
   * @param error - Error to check
   * @returns True if error is classified
   */
  private isClassifiedError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'severity' in error &&
      'retryable' in error
    );
  }

  /**
   * Check if an error type is retryable
   *
   * @param errorType - Error type to check
   * @returns True if retryable
   */
  private isRetryable(errorType: ErrorType): boolean {
    const retryableTypes = new Set<ErrorType>([
      ErrorType.TRANSIENT_ERROR,
      ErrorType.EXTERNAL_SERVICE_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.DATABASE_ERROR,
    ]);
    return retryableTypes.has(errorType);
  }

  /**
   * Log an error with appropriate level
   *
   * @param error - Classified error
   * @param context - Middleware context
   */
  private logError(error: ClassifiedError, context: MiddlewareContext): void {
    const logData = {
      errorType: error.type,
      severity: error.severity,
      retryable: error.retryable,
      eventId: context.envelope.event_id,
      eventType: context.envelope.event_type,
      correlationId: context.correlationId,
      retryAttempt: context.retryAttempt,
      message: error.message,
      context: error.context,
    };

    switch (error.severity) {
      case ErrorSeverity.LOW:
        this.debug('Processing error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.warn('Processing error', logData);
        break;
      case ErrorSeverity.HIGH:
        this.error('Processing error', logData);
        break;
      case ErrorSeverity.CRITICAL:
        this.error('CRITICAL processing error', logData);
        break;
    }
  }

  /**
   * Register a custom error classifier
   *
   * @param classifier - Classifier function
   */
  public registerClassifier(classifier: ErrorClassifierFunction): void {
    this.customClassifiers.push(classifier);
  }

  /**
   * Register multiple custom error classifiers
   *
   * @param classifiers - Array of classifier functions
   */
  public registerClassifiers(classifiers: ErrorClassifierFunction[]): void {
    this.customClassifiers.push(...classifiers);
  }

  /**
   * Clear custom classifiers
   */
  public clearCustomClassifiers(): void {
    this.customClassifiers = [];
  }

  /**
   * Get the current configuration
   *
   * @returns Current error handler configuration
   */
  public getConfig(): Readonly<Required<ErrorHandlerConfig>> {
    return { ...this.config };
  }

  /**
   * Update the configuration
   *
   * @param config - New configuration values
   */
  public updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      defaultErrorType:
        config.defaultErrorType ?? this.config.defaultErrorType,
      defaultSeverity:
        config.defaultSeverity ?? this.config.defaultSeverity,
      autoClassify:
        config.autoClassify ?? this.config.autoClassify,
      errorClassifiers:
        config.errorClassifiers ?? this.config.errorClassifiers,
    };
  }

  /**
   * Set the logger
   *
   * @param logger - Logger instance
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Create a classified error from a regular error
   *
   * @param error - Error to classify
   * @param context - Optional context
   * @returns Classified error
   */
  public createClassifiedError(
    error: unknown,
    context?: MiddlewareContext
  ): ClassifiedError {
    return this.classifyError(error, context);
  }

  private debug(message: string, ...args: unknown[]): void {
    this.logger?.debug(`[ErrorHandler] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]): void {
    this.logger?.warn(`[ErrorHandler] ${message}`, ...args);
  }

  private error(message: string, ...args: unknown[]): void {
    this.logger?.error(`[ErrorHandler] ${message}`, ...args);
  }

}

/**
 * Create an error handler middleware factory function
 *
 * @param config - Optional configuration
 * @param logger - Optional logger
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const errorHandler = createErrorHandler({
 *   autoClassify: true,
 *   defaultSeverity: ErrorSeverity.MEDIUM
 * });
 * processor.use(errorHandler);
 * ```
 */
export function createErrorHandler(
  config: Partial<ErrorHandlerConfig> = {},
  logger?: Logger
): MiddlewareFunction {
  const middleware = new ErrorHandlerMiddleware(config, logger);
  return middleware.middleware();
}

/**
 * Standalone function to classify an error
 *
 * @param error - Error to classify
 * @param config - Optional configuration
 * @param context - Optional middleware context
 * @returns Classified error
 */
export function classifyError(
  error: unknown,
  config: Partial<ErrorHandlerConfig> = {},
  context?: MiddlewareContext
): ClassifiedError {
  const middleware = new ErrorHandlerMiddleware(config);
  return middleware.classifyError(error, context);
}

/**
 * Get all built-in error classifiers
 *
 * @returns Object of error classifiers
 */
export function getBuiltInClassifiers(): Record<
  string,
  ErrorClassifierFunction
> {
  return { ...ERROR_CLASSIFIERS };
}
