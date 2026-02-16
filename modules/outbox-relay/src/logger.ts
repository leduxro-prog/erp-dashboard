/**
 * Structured logger configuration for outbox-relay service.
 *
 * Provides correlation ID propagation, structured logging, different log levels,
 * and error context for enterprise-grade observability.
 *
 * @module logger
 */

import pino, {
  Logger,
  LoggerOptions,
  Bindings,
  Level,
  LevelWithSilent,
  DestinationStream,
} from 'pino';
import pinoPretty from 'pino-pretty';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logger levels mapping
 */
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

/**
 * Log context type for structured logging
 */
export interface LogContext {
  correlationId?: string;
  component?: string;
  action?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Error details for logging
 */
export interface ErrorContext {
  error: Error;
  code?: string;
  stack?: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

/**
 * Logger class with correlation ID support and enterprise features
 */
export class OutboxLogger {
  private readonly logger: Logger;
  private readonly baseContext: Bindings;
  private readonly isPretty: boolean;

  /**
   * Creates a new OutboxLogger instance
   *
   * @param options - Logger options
   * @param context - Base context to include in all logs
   */
  constructor(options?: LoggerOptions, context: Bindings = {}) {
    const defaultOptions: LoggerOptions = {
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
      ...options,
    };

    this.baseContext = {
      service: 'outbox-relay',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      ...context,
    };

    this.isPretty = process.env.NODE_ENV !== 'production';

    if (this.isPretty) {
      const prettyStream = pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
        levelFirst: true,
      });

      this.logger = pino(defaultOptions, prettyStream as DestinationStream);
    } else {
      this.logger = pino(defaultOptions);
    }

    this.logger = this.logger.child(this.baseContext);
  }

  /**
   * Gets the underlying Pino logger
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Creates a child logger with additional context
   *
   * @param context - Additional context to add
   * @returns New child logger
   */
  public child(context: Bindings): OutboxLogger {
    return new OutboxLogger(
      undefined,
      { ...this.baseContext, ...context }
    );
  }

  /**
   * Creates a child logger with a correlation ID
   *
   * @param correlationId - Correlation ID to use (auto-generated if not provided)
   * @returns Child logger with correlation ID
   */
  public withCorrelationId(correlationId?: string): OutboxLogger {
    const cid = correlationId || uuidv4();
    return this.child({ correlationId: cid });
  }

  /**
   * Creates a child logger for a specific component
   *
   * @param component - Component name
   * @returns Child logger for component
   */
  public forComponent(component: string): OutboxLogger {
    return this.child({ component });
  }

  /**
   * Logs a trace level message
   *
   * @param message - Message to log
   * @param context - Additional context
   */
  public trace(message: string, context?: LogContext): void {
    this.logger.trace(context, message);
  }

  /**
   * Logs a debug level message
   *
   * @param message - Message to log
   * @param context - Additional context
   */
  public debug(message: string, context?: LogContext): void {
    this.logger.debug(context, message);
  }

  /**
   * Logs an info level message
   *
   * @param message - Message to log
   * @param context - Additional context
   */
  public info(message: string, context?: LogContext): void {
    this.logger.info(context, message);
  }

  /**
   * Logs a warning message
   *
   * @param message - Message to log
   * @param context - Additional context
   */
  public warn(message: string, context?: LogContext): void {
    this.logger.warn(context, message);
  }

  /**
   * Logs an error message
   *
   * @param message - Message to log
   * @param errorOrContext - Error object or context
   * @param context - Additional context if error was provided
   */
  public error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    if (errorOrContext instanceof Error) {
      const errorContext: ErrorContext = {
        error: errorOrContext,
        code: (errorOrContext as any).code,
        stack: errorOrContext.stack,
      };
      this.logger.error({ ...errorContext, ...context }, message);
    } else {
      this.logger.error(errorOrContext, message);
    }
  }

  /**
   * Logs a fatal error message
   *
   * @param message - Message to log
   * @param error - Error object
   * @param context - Additional context
   */
  public fatal(message: string, error: Error, context?: LogContext): void {
    const errorContext: ErrorContext = {
      error,
      code: (error as any).code,
      stack: error.stack,
    };
    this.logger.fatal({ ...errorContext, ...context }, message);
  }

  /**
   * Measures and logs the duration of an async operation
   *
   * @param label - Label for the timing
   * @param fn - Async function to measure
   * @returns Result of the function
   */
  public async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.debug(`Starting: ${label}`);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`Completed: ${label}`, { duration, label });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Failed: ${label}`, error as Error, { duration, label });
      throw error;
    }
  }

  /**
   * Sets the log level
   *
   * @param level - New log level
   */
  public setLevel(level: LevelWithSilent): void {
    this.logger.level = level;
  }

  /**
   * Gets the current log level
   *
   * @returns Current log level
   */
  public getLevel(): Level {
    return this.logger.level as Level;
  }

  /**
   * Flushes any buffered logs
   *
   * @returns Promise that resolves when logs are flushed
   */
  public async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.flush(() => {
        resolve();
      });
    });
  }
}

/**
 * Default logger instance
 */
let defaultLogger: OutboxLogger | null = null;

/**
 * Gets the default logger instance
 *
 * @returns Default OutboxLogger
 */
export function getLogger(): OutboxLogger {
  if (!defaultLogger) {
    defaultLogger = new OutboxLogger();
  }
  return defaultLogger;
}

/**
 * Creates a new logger instance with options
 *
 * @param options - Logger options
 * @param context - Base context
 * @returns New OutboxLogger
 */
export function createLogger(options?: LoggerOptions, context?: Bindings): OutboxLogger {
  return new OutboxLogger(options, context);
}

/**
 * Extracts correlation ID from headers or generates a new one
 *
 * @param headers - Request headers
 * @returns Correlation ID
 */
export function extractCorrelationId(headers: Record<string, string | undefined>): string {
  const cid =
    headers['x-correlation-id'] ||
    headers['x-request-id'] ||
    headers['correlation-id'] ||
    headers['request-id'];
  return cid || uuidv4();
}

/**
 * Middleware for Express that adds correlation ID to request context
 *
 * @param logger - Logger instance
 * @returns Express middleware
 */
export function correlationIdMiddleware(logger: OutboxLogger) {
  return (req: any, res: any, next: () => void) => {
    const correlationId = extractCorrelationId(req.headers);
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    req.log = logger.withCorrelationId(correlationId);
    next();
  };
}

/**
 * Creates an async context for logging
 *
 * @param correlationId - Correlation ID
 * @param action - Action being performed
 * @returns Log context
 */
export function createAsyncContext(
  correlationId?: string,
  action?: string
): LogContext {
  return {
    correlationId: correlationId || uuidv4(),
    action,
  };
}

export default OutboxLogger;
