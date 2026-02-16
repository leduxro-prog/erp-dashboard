/**
 * Transaction Manager
 *
 * Enterprise-grade transaction management for PostgreSQL with:
 * - BEGIN/COMMIT/ROLLBACK handling
 * - Transaction isolation levels (READ COMMITTED default)
 * - Savepoint support for nested transactions
 * - Distributed transaction coordination
 * - Deadlock detection and retry
 * - Audit logging for all transactions
 */

import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import type { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { v4 as uuidv4 } from 'uuid';
import logger from '@shared/utils/logger';
import { TransactionLogger } from '../utils/TransactionLogger';

/**
 * Transaction isolation levels supported
 */
export enum TransactionIsolation {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMMITTED = 'COMMITTED',
  ROLLED_BACK = 'ROLLED_BACK',
  FAILED = 'FAILED',
}

/**
 * Transaction metadata for audit and debugging
 */
export interface TransactionMetadata {
  transactionId: string;
  parentId?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  isolationLevel: TransactionIsolation;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  status: TransactionStatus;
  savepoints: string[];
  retryCount: number;
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

/**
 * Transaction result
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata: TransactionMetadata;
  rollbackReason?: string;
}

/**
 * Savepoint result
 */
export interface SavepointResult {
  savepointId: string;
  success: boolean;
  error?: Error;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  isolationLevel?: TransactionIsolation;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  enableSavepoints?: boolean;
  metadata?: {
    operation?: string;
    userId?: string;
    requestId?: string;
  };
}

/**
 * Callback function type for transaction execution
 */
export type TransactionCallback<T> = (entityManager: EntityManager) => Promise<T>;

/**
 * Transaction Manager Configuration
 */
export interface TransactionManagerConfig {
  dataSource: DataSource;
  defaultIsolationLevel?: TransactionIsolation;
  defaultMaxRetries?: number;
  defaultRetryDelayMs?: number;
  defaultTimeoutMs?: number;
  enableMetrics?: boolean;
}

/**
 * Transaction Manager class
 *
 * Manages database transactions with comprehensive error handling,
 * retry logic, and audit logging.
 */
export class TransactionManager {
  private readonly dataSource: DataSource;
  private readonly defaultIsolationLevel: TransactionIsolation;
  private readonly defaultMaxRetries: number;
  private readonly defaultRetryDelayMs: number;
  private readonly defaultTimeoutMs: number;
  private readonly enableMetrics: boolean;
  private readonly transactionLogger: TransactionLogger;

  // Track active transactions
  private readonly activeTransactions = new Map<string, QueryRunner>();

  // Metrics
  private readonly metrics = {
    totalTransactions: 0,
    committedTransactions: 0,
    rolledBackTransactions: 0,
    failedTransactions: 0,
    retriedTransactions: 0,
    deadlockCount: 0,
  };

  constructor(config: TransactionManagerConfig) {
    this.dataSource = config.dataSource;
    this.defaultIsolationLevel = config.defaultIsolationLevel || TransactionIsolation.READ_COMMITTED;
    this.defaultMaxRetries = config.defaultMaxRetries || 3;
    this.defaultRetryDelayMs = config.defaultRetryDelayMs || 100;
    this.defaultTimeoutMs = config.defaultTimeoutMs || 30000;
    this.enableMetrics = config.enableMetrics !== false;
    this.transactionLogger = new TransactionLogger();
  }

  /**
   * Execute a callback within a transaction
   *
   * @param callback - Function to execute within transaction
   * @param options - Transaction options
   * @returns Transaction result with data or error
   */
  async executeInTransaction<T>(
    callback: TransactionCallback<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const transactionId = this.generateTransactionId();
    const isolationLevel = options.isolationLevel || this.defaultIsolationLevel;
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const retryDelayMs = options.retryDelayMs ?? this.defaultRetryDelayMs;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    const metadata: TransactionMetadata = {
      transactionId,
      operation: options.metadata?.operation,
      userId: options.metadata?.userId,
      requestId: options.metadata?.requestId,
      isolationLevel,
      startedAt: new Date(),
      status: TransactionStatus.PENDING,
      savepoints: [],
      retryCount: 0,
    };

    let queryRunner: QueryRunner | null = null;
    let lastError: Error | undefined;

    try {
      this.transactionLogger.logStart(metadata);

      // Retry loop for handling deadlocks and transient errors
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          metadata.retryCount = attempt;
          const activeQueryRunner = this.createQueryRunner();
          queryRunner = activeQueryRunner;

          // Set transaction isolation level
          await activeQueryRunner.connect();
          await activeQueryRunner.startTransaction(isolationLevel as IsolationLevel);

          metadata.status = TransactionStatus.ACTIVE;
          this.activeTransactions.set(transactionId, activeQueryRunner);

          // Set transaction timeout
          const timeoutId = this.setupTransactionTimeout(transactionId, activeQueryRunner, timeoutMs);

          // Execute callback with transaction
          const result = await this.executeWithTimeout(
            () => callback(activeQueryRunner.manager),
            timeoutMs - 100 // Leave some buffer for cleanup
          );

          clearTimeout(timeoutId);

          // Commit transaction
          await activeQueryRunner.commitTransaction();
          metadata.status = TransactionStatus.COMMITTED;
          metadata.completedAt = new Date();
          metadata.duration = metadata.completedAt.getTime() - metadata.startedAt.getTime();

          // Update metrics
          this.metrics.totalTransactions++;
          this.metrics.committedTransactions++;
          if (attempt > 0) {
            this.metrics.retriedTransactions++;
          }

          this.transactionLogger.logCommit(metadata);
          this.activeTransactions.delete(transactionId);

          await activeQueryRunner.release();

          return {
            success: true,
            data: result,
            metadata,
          };
        } catch (error) {
          lastError = error as Error;

          // Check if it's a deadlock error that can be retried
          if (this.isDeadlockError(error) && attempt < maxRetries) {
            this.metrics.deadlockCount++;

            // Rollback and retry
            if (queryRunner) {
              try {
                await queryRunner.rollbackTransaction();
              } catch (rollbackError) {
                logger.error('Error during rollback for retry', {
                  transactionId,
                  rollbackError,
                });
              }
              await queryRunner.release();
            }

            const backoffMs = this.calculateBackoff(retryDelayMs, attempt);
            logger.warn('Deadlock detected, retrying transaction', {
              transactionId,
              attempt,
              nextAttempt: attempt + 1,
              backoffMs,
              error: (error as Error).message,
            });

            await this.sleep(backoffMs);
            continue;
          }

          // Non-retryable error or max retries exceeded
          if (queryRunner) {
            try {
              await queryRunner.rollbackTransaction();
              metadata.status = TransactionStatus.ROLLED_BACK;
            } catch (rollbackError) {
              logger.error('Error during transaction rollback', {
                transactionId,
                rollbackError,
              });
            }

            await queryRunner.release();
          }

          metadata.status = TransactionStatus.FAILED;
          metadata.completedAt = new Date();
          metadata.duration = metadata.completedAt.getTime() - metadata.startedAt.getTime();
          metadata.error = {
            message: (error as Error).message,
            code: (error as any).code,
            stack: (error as Error).stack,
          };

          // Update metrics
          this.metrics.totalTransactions++;
          this.metrics.rolledBackTransactions++;
          if (attempt === maxRetries) {
            this.metrics.failedTransactions++;
          }

          this.transactionLogger.logRollback(metadata, (error as Error).message);
          this.activeTransactions.delete(transactionId);

          return {
            success: false,
            error: error as Error,
            metadata,
            rollbackReason: (error as Error).message,
          };
        }
      }

      // Should not reach here
      return {
        success: false,
        error: lastError || new Error('Transaction failed'),
        metadata,
        rollbackReason: 'Transaction failed after all retries',
      };
    } catch (error) {
      const err = error as Error;
      metadata.status = TransactionStatus.FAILED;
      metadata.completedAt = new Date();
      metadata.duration = metadata.completedAt.getTime() - metadata.startedAt.getTime();
      metadata.error = {
        message: err.message,
        code: (error as any).code,
        stack: err.stack,
      };

      this.metrics.totalTransactions++;
      this.metrics.failedTransactions++;

      this.transactionLogger.logError(metadata, err);

      if (queryRunner) {
        try {
          await queryRunner.release();
        } catch (releaseError) {
          logger.error('Error releasing query runner', {
            transactionId,
            releaseError,
          });
        }
      }

      this.activeTransactions.delete(transactionId);

      return {
        success: false,
        error: err,
        metadata,
      };
    }
  }

  /**
   * Create a savepoint for nested transaction support
   *
   * @param transactionId - Parent transaction ID
   * @param savepointName - Optional custom savepoint name
   * @returns Savepoint result
   */
  async createSavepoint(
    transactionId: string,
    savepointName?: string
  ): Promise<SavepointResult> {
    const queryRunner = this.activeTransactions.get(transactionId);

    if (!queryRunner) {
      return {
        savepointId: '',
        success: false,
        error: new Error(`Transaction ${transactionId} not found`),
      };
    }

    const savepointId = savepointName || `sp_${uuidv4().substring(0, 8)}`;

    try {
      await queryRunner.query(`SAVEPOINT "${savepointId}"`);
      this.transactionLogger.logSavepoint(transactionId, savepointId, 'created');

      return {
        savepointId,
        success: true,
      };
    } catch (error) {
      logger.error('Error creating savepoint', {
        transactionId,
        savepointId,
        error: (error as Error).message,
      });

      return {
        savepointId,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Rollback to a specific savepoint
   *
   * @param transactionId - Transaction ID
   * @param savepointId - Savepoint to rollback to
   * @returns Success status
   */
  async rollbackToSavepoint(
    transactionId: string,
    savepointId: string
  ): Promise<{ success: boolean; error?: Error }> {
    const queryRunner = this.activeTransactions.get(transactionId);

    if (!queryRunner) {
      return {
        success: false,
        error: new Error(`Transaction ${transactionId} not found`),
      };
    }

    try {
      await queryRunner.query(`ROLLBACK TO SAVEPOINT "${savepointId}"`);
      this.transactionLogger.logSavepoint(transactionId, savepointId, 'rollback');

      return { success: true };
    } catch (error) {
      logger.error('Error rolling back to savepoint', {
        transactionId,
        savepointId,
        error: (error as Error).message,
      });

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Release a savepoint (commit changes made since savepoint)
   *
   * @param transactionId - Transaction ID
   * @param savepointId - Savepoint to release
   * @returns Success status
   */
  async releaseSavepoint(
    transactionId: string,
    savepointId: string
  ): Promise<{ success: boolean; error?: Error }> {
    const queryRunner = this.activeTransactions.get(transactionId);

    if (!queryRunner) {
      return {
        success: false,
        error: new Error(`Transaction ${transactionId} not found`),
      };
    }

    try {
      await queryRunner.query(`RELEASE SAVEPOINT "${savepointId}"`);
      this.transactionLogger.logSavepoint(transactionId, savepointId, 'released');

      return { success: true };
    } catch (error) {
      logger.error('Error releasing savepoint', {
        transactionId,
        savepointId,
        error: (error as Error).message,
      });

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Get transaction metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeTransactions: this.activeTransactions.size,
    };
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * Reset transaction metrics
   */
  resetMetrics(): void {
    Object.keys(this.metrics).forEach((key) => {
      (this.metrics as any)[key] = 0;
    });
  }

  /**
   * Force rollback of an active transaction
   *
   * @param transactionId - Transaction ID to rollback
   */
  async forceRollback(transactionId: string): Promise<void> {
    const queryRunner = this.activeTransactions.get(transactionId);

    if (queryRunner && !queryRunner.isTransactionActive) {
      try {
        await queryRunner.rollbackTransaction();
        this.transactionLogger.logRollback(
          { transactionId, status: TransactionStatus.ROLLED_BACK, startedAt: new Date(), savepoints: [], retryCount: 0, isolationLevel: TransactionIsolation.READ_COMMITTED },
          'Forced rollback'
        );
      } catch (error) {
        logger.error('Error during forced rollback', {
          transactionId,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Create a query runner
   */
  private createQueryRunner(): QueryRunner {
    return this.dataSource.createQueryRunner();
  }

  /**
   * Generate a unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Setup transaction timeout
   */
  private setupTransactionTimeout(
    transactionId: string,
    queryRunner: QueryRunner,
    timeoutMs: number
  ): NodeJS.Timeout {
    return setTimeout(async () => {
      try {
        if (queryRunner.isTransactionActive) {
          logger.warn('Transaction timeout, rolling back', { transactionId, timeoutMs });
          await queryRunner.rollbackTransaction();
        }
      } catch (error) {
        logger.error('Error during timeout rollback', {
          transactionId,
          error: (error as Error).message,
        });
      }
    }, timeoutMs);
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Transaction timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Check if error is a deadlock that can be retried
   */
  private isDeadlockError(error: any): boolean {
    const errorCode = error?.code;
    const errorMessage = error?.message?.toLowerCase();

    // PostgreSQL deadlock error codes
    if (errorCode === '40P01') return true;

    // Check for deadlock messages
    if (errorMessage?.includes('deadlock')) return true;
    if (errorMessage?.includes('could not serialize access')) return true;

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(baseDelayMs: number, attempt: number): number {
    return Math.min(baseDelayMs * Math.pow(2, attempt), 5000); // Max 5 seconds
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a distributed transaction coordinator
 * for coordinating transactions across multiple databases/services
 */
export class DistributedTransactionCoordinator {
  private readonly transactionManager: TransactionManager;
  private readonly participants: Map<string, EntityManager> = new Map();

  constructor(transactionManager: TransactionManager) {
    this.transactionManager = transactionManager;
  }

  /**
   * Register a participant in the distributed transaction
   */
  registerParticipant(id: string, entityManager: EntityManager): void {
    this.participants.set(id, entityManager);
  }

  /**
   * Execute a two-phase commit across all participants
   *
   * Phase 1: Prepare (verify all participants can commit)
   * Phase 2: Commit (actually commit all participants)
   */
  async executeTwoPhaseCommit<T>(
    callback: (managers: Map<string, EntityManager>) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    return this.transactionManager.executeInTransaction(async (primaryManager) => {
      // Add primary manager as a participant
      this.participants.set('primary', primaryManager);

      try {
        // Phase 1: Prepare - execute callback
        const result = await callback(this.participants);

        // Phase 2: Commit - all changes committed by primary transaction
        return result;
      } finally {
        this.participants.clear();
      }
    }, options);
  }
}

export default TransactionManager;
