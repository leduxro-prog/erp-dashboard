/**
 * Transaction Logger
 *
 * Comprehensive transaction logging for:
 * - Request tracking and correlation
 * - Operation timing and performance
 * - Error details and debugging
 * - Audit trail compliance
 */

import { TransactionMetadata } from '../services/TransactionManager';

/**
 * Transaction log entry structure
 */
export interface TransactionLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  transactionId: string;
  parentId?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  event: string;
  isolationLevel: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

/**
 * Transaction logger configuration
 */
export interface TransactionLoggerConfig {
  enableConsole?: boolean;
  enableFile?: boolean;
  enableDatabase?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  includeStackTrace?: boolean;
  maxLogEntries?: number;
}

/**
 * Transaction Logger class
 *
 * Provides structured logging for all transaction operations
 */
export class TransactionLogger {
  private readonly config: TransactionLoggerConfig;
  private readonly logBuffer: TransactionLogEntry[] = [];
  private readonly logLevelPriority: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: TransactionLoggerConfig = {}) {
    this.config = {
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      enableDatabase: config.enableDatabase ?? false,
      logLevel: config.logLevel ?? 'info',
      includeStackTrace: config.includeStackTrace ?? true,
      maxLogEntries: config.maxLogEntries ?? 1000,
    };
  }

  /**
   * Log transaction start
   */
  logStart(metadata: TransactionMetadata): void {
    this.log({
      timestamp: new Date(),
      level: 'info',
      transactionId: metadata.transactionId,
      parentId: metadata.parentId,
      operation: metadata.operation,
      userId: metadata.userId,
      requestId: metadata.requestId,
      event: 'TRANSACTION_START',
      isolationLevel: metadata.isolationLevel,
      metadata: {
        retryCount: metadata.retryCount,
      },
    });
  }

  /**
   * Log transaction commit
   */
  logCommit(metadata: TransactionMetadata): void {
    this.log({
      timestamp: new Date(),
      level: 'info',
      transactionId: metadata.transactionId,
      parentId: metadata.parentId,
      operation: metadata.operation,
      userId: metadata.userId,
      requestId: metadata.requestId,
      event: 'TRANSACTION_COMMIT',
      isolationLevel: metadata.isolationLevel,
      duration: metadata.duration,
      metadata: {
        savepoints: metadata.savepoints,
        retryCount: metadata.retryCount,
      },
    });
  }

  /**
   * Log transaction rollback
   */
  logRollback(metadata: TransactionMetadata, reason: string): void {
    this.log({
      timestamp: new Date(),
      level: 'warn',
      transactionId: metadata.transactionId,
      parentId: metadata.parentId,
      operation: metadata.operation,
      userId: metadata.userId,
      requestId: metadata.requestId,
      event: 'TRANSACTION_ROLLBACK',
      isolationLevel: metadata.isolationLevel,
      duration: metadata.duration,
      metadata: {
        reason,
        savepoints: metadata.savepoints,
        retryCount: metadata.retryCount,
      },
    });
  }

  /**
   * Log transaction error
   */
  logError(metadata: TransactionMetadata, error: Error): void {
    this.log({
      timestamp: new Date(),
      level: 'error',
      transactionId: metadata.transactionId,
      parentId: metadata.parentId,
      operation: metadata.operation,
      userId: metadata.userId,
      requestId: metadata.requestId,
      event: 'TRANSACTION_ERROR',
      isolationLevel: metadata.isolationLevel,
      duration: metadata.duration,
      error: {
        code: (error as any).code,
        message: error.message,
        stack: this.config.includeStackTrace ? error.stack : undefined,
      },
    });
  }

  /**
   * Log savepoint operation
   */
  logSavepoint(
    transactionId: string,
    savepointId: string,
    action: 'created' | 'released' | 'rollback'
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'info',
      transactionId,
      event: 'SAVEPOINT',
      metadata: {
        savepointId,
        action,
      },
      isolationLevel: 'N/A',
    });
  }

  /**
   * Log nested transaction start
   */
  logNestedStart(transactionId: string, parentId: string, operation?: string): void {
    this.log({
      timestamp: new Date(),
      level: 'info',
      transactionId,
      parentId,
      operation,
      event: 'NESTED_TRANSACTION_START',
      isolationLevel: 'N/A',
    });
  }

  /**
   * Log compensation transaction
   */
  logCompensation(
    transactionId: string,
    operation: string,
    reason: string,
    duration?: number
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'warn',
      transactionId,
      event: 'COMPENSATION_TRANSACTION',
      operation,
      isolationLevel: 'N/A',
      duration,
      metadata: { reason },
    });
  }

  /**
   * Log distributed transaction phase
   */
  logDistributedPhase(
    transactionId: string,
    phase: 'PREPARE' | 'COMMIT' | 'ROLLBACK',
    participantId?: string
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'info',
      transactionId,
      event: 'DISTRIBUTED_TRANSACTION_PHASE',
      isolationLevel: 'N/A',
      metadata: {
        phase,
        participantId,
      },
    });
  }

  /**
   * Log deadlock detected
   */
  logDeadlock(
    transactionId: string,
    retryCount: number,
    errorMessage: string
  ): void {
    this.log({
      timestamp: new Date(),
      level: 'warn',
      transactionId,
      event: 'DEADLOCK_DETECTED',
      isolationLevel: 'N/A',
      metadata: {
        retryCount,
        errorMessage,
      },
    });
  }

  /**
   * Log transaction timeout
   */
  logTimeout(transactionId: string, timeoutMs: number): void {
    this.log({
      timestamp: new Date(),
      level: 'error',
      transactionId,
      event: 'TRANSACTION_TIMEOUT',
      isolationLevel: 'N/A',
      metadata: {
        timeoutMs,
      },
    });
  }

  /**
   * Get log entries for a specific transaction
   */
  getTransactionLogs(transactionId: string): TransactionLogEntry[] {
    return this.logBuffer.filter((entry) => entry.transactionId === transactionId);
  }

  /**
   * Get all buffered logs
   */
  getAllLogs(): TransactionLogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer.length = 0;
  }

  /**
   * Internal log method
   */
  private log(entry: TransactionLogEntry): void {
    // Check log level
    const entryLevelPriority = this.logLevelPriority[entry.level];
    const configLevelPriority = this.logLevelPriority[this.config.logLevel!];

    if (entryLevelPriority < configLevelPriority) {
      return;
    }

    // Add to buffer
    this.addToBuffer(entry);

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // File logging (placeholder - would implement actual file writing)
    if (this.config.enableFile) {
      // TODO: Implement file logging
    }

    // Database logging (placeholder - would implement async DB writes)
    if (this.config.enableDatabase) {
      // TODO: Implement database logging
    }
  }

  /**
   * Add entry to buffer with size limit
   */
  private addToBuffer(entry: TransactionLogEntry): void {
    this.logBuffer.push(entry);

    if (this.logBuffer.length > this.config.maxLogEntries!) {
      this.logBuffer.shift();
    }
  }

  /**
   * Log to console with structured format
   */
  private logToConsole(entry: TransactionLogEntry): void {
    const prefix = `[TX:${entry.transactionId}]`;
    const timestamp = entry.timestamp.toISOString();
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';

    const message = `${prefix} ${entry.event}${duration} ${entry.operation || ''}`;

    const logData = {
      timestamp,
      transactionId: entry.transactionId,
      parentId: entry.parentId,
      requestId: entry.requestId,
      userId: entry.userId,
      event: entry.event,
      isolationLevel: entry.isolationLevel,
      duration: entry.duration,
      ...entry.metadata,
    };

    switch (entry.level) {
      case 'error':
        console.error(message, entry.error ? { error: entry.error, ...logData } : logData);
        break;
      case 'warn':
        console.warn(message, logData);
        break;
      case 'info':
      default:
        console.log(message, logData);
        break;
    }
  }
}

/**
 * Transaction performance metrics
 */
export interface TransactionPerformanceMetrics {
  transactionId: string;
  operation?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  queryCount: number;
  slowQueries: Array<{ query: string; duration: number }>;
  savepoints: number;
  retries: number;
}

/**
 * Performance tracker for transaction analysis
 */
export class TransactionPerformanceTracker {
  private readonly metrics = new Map<string, TransactionPerformanceMetrics>();

  /**
   * Start tracking a transaction
   */
  startTracking(transactionId: string, operation?: string): void {
    this.metrics.set(transactionId, {
      transactionId,
      operation,
      startTime: new Date(),
      queryCount: 0,
      slowQueries: [],
      savepoints: 0,
      retries: 0,
    });
  }

  /**
   * End tracking a transaction
   */
  endTracking(transactionId: string): TransactionPerformanceMetrics | null {
    const metrics = this.metrics.get(transactionId);
    if (!metrics) return null;

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();

    this.metrics.delete(transactionId);
    return metrics;
  }

  /**
   * Record a query execution
   */
  recordQuery(transactionId: string, query: string, duration: number): void {
    const metrics = this.metrics.get(transactionId);
    if (!metrics) return;

    metrics.queryCount++;

    // Track slow queries (threshold: 100ms)
    if (duration > 100) {
      metrics.slowQueries.push({ query, duration });
    }
  }

  /**
   * Record a savepoint
   */
  recordSavepoint(transactionId: string): void {
    const metrics = this.metrics.get(transactionId);
    if (metrics) {
      metrics.savepoints++;
    }
  }

  /**
   * Record a retry
   */
  recordRetry(transactionId: string): void {
    const metrics = this.metrics.get(transactionId);
    if (metrics) {
      metrics.retries++;
    }
  }

  /**
   * Get metrics for a transaction
   */
  getMetrics(transactionId: string): TransactionPerformanceMetrics | undefined {
    return this.metrics.get(transactionId);
  }

  /**
   * Get all active metrics
   */
  getAllMetrics(): TransactionPerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }
}

export default TransactionLogger;
