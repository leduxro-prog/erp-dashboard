/**
 * Checkout Module
 *
 * Provides transaction management for checkout flow with:
 * - PostgreSQL transaction handling
 * - Credit reservation and capture
 * - Order creation with ACID compliance
 * - Compensation transactions for rollback
 */

import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system';
import { Router } from 'express';
import { DataSource } from 'typeorm';
import logger from '@shared/utils/logger';
import {
  TransactionManager,
  FinancialTransactionService,
  TransactionOrchestrator,
  TransactionLogger,
} from './src';

/**
 * Checkout Module
 *
 * Core module for managing checkout transactions with enterprise-grade
 * transaction handling, compensation logic, and comprehensive audit logging.
 */
export class CheckoutModule implements ICypherModule {
  name = 'checkout';
  version = '1.0.0';
  description = 'Enterprise checkout transaction management with ACID compliance';

  dependencies: string[] = ['users', 'orders', 'b2b-portal'];

  publishedEvents = [
    'checkout.started',
    'checkout.completed',
    'checkout.failed',
    'credit.reserved',
    'credit.captured',
    'credit.released',
  ];

  subscribedEvents = [];

  featureFlag = 'ENABLE_CHECKOUT_MODULE';

  private transactionManager?: TransactionManager;
  private financialTransactionService?: FinancialTransactionService;
  private transactionOrchestrator?: TransactionOrchestrator;
  private transactionLogger?: TransactionLogger;

  /**
   * Initialize the module
   */
  async initialize(context: IModuleContext): Promise<void> {
    logger.info('Initializing checkout module...');

    const dataSource = context.dataSource as DataSource;

    // Initialize transaction manager
    this.transactionManager = new TransactionManager({
      dataSource,
      defaultIsolationLevel: 'READ COMMITTED' as any,
      defaultMaxRetries: 3,
      defaultRetryDelayMs: 100,
      defaultTimeoutMs: 30000,
      enableMetrics: true,
    });

    // Initialize transaction logger
    this.transactionLogger = new TransactionLogger({
      enableConsole: true,
      enableFile: false,
      enableDatabase: false,
      logLevel: 'info',
      includeStackTrace: true,
    });

    // Initialize financial transaction service
    this.financialTransactionService = new FinancialTransactionService({
      transactionManager: this.transactionManager,
      reservationTimeoutMinutes: 30,
    });

    // Initialize transaction orchestrator
    this.transactionOrchestrator = new TransactionOrchestrator({
      financialTransactionService: this.financialTransactionService,
      enableCompensation: true,
      enableRetry: true,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    logger.info('Checkout module initialized successfully');
  }

  /**
   * Start the module
   */
  async start(): Promise<void> {
    logger.info('Starting checkout module...');
    // Module is ready, no background tasks needed
  }

  /**
   * Stop the module
   */
  async stop(): Promise<void> {
    logger.info('Stopping checkout module...');
    // Cleanup resources if needed
  }

  /**
   * Get module health
   */
  async getHealth(): Promise<IModuleHealth> {
    const lastChecked = new Date();

    if (!this.transactionManager) {
      return {
        status: 'unhealthy',
        details: {
          transactionManager: {
            status: 'down',
            message: 'Transaction manager not initialized',
          },
        },
        lastChecked,
      };
    }

    const metrics = this.transactionManager.getMetrics() as Record<string, any>;

    return {
      status: 'healthy',
      details: {
        transactionManager: {
          status: 'up',
          message: `activeTransactions=${metrics.activeTransactions ?? 0}`,
        },
        orchestrator: {
          status: this.transactionOrchestrator ? 'up' : 'down',
        },
        financialService: {
          status: this.financialTransactionService ? 'up' : 'down',
        },
      },
      lastChecked,
    };
  }

  /**
   * Get module metrics
   */
  getMetrics(): IModuleMetrics {
    if (!this.transactionManager) {
      return {
        requestCount: 0,
        errorCount: 0,
        avgResponseTime: 0,
        activeWorkers: 0,
        cacheHitRate: 0,
        eventCount: {
          published: 0,
          received: 0,
        },
      };
    }

    const metrics = this.transactionManager.getMetrics() as Record<string, any>;
    return {
      requestCount: metrics.transactionsStarted ?? 0,
      errorCount: metrics.rollbackCount ?? 0,
      avgResponseTime: metrics.averageDurationMs ?? 0,
      activeWorkers: metrics.activeTransactions ?? 0,
      cacheHitRate: 0,
      eventCount: {
        published: 0,
        received: 0,
      },
    };
  }

  /**
   * Get module router
   */
  getRouter(): Router {
    const router = Router();

    // Health check endpoint
    router.get('/health', async (_req, res) => {
      const health = await this.getHealth();
      res.json(health);
    });

    // Metrics endpoint
    router.get('/metrics', (_req, res) => {
      res.json(this.getMetrics());
    });

    return router;
  }

  /**
   * Get transaction manager instance
   */
  getTransactionManager(): TransactionManager | undefined {
    return this.transactionManager;
  }

  /**
   * Get financial transaction service instance
   */
  getFinancialTransactionService(): FinancialTransactionService | undefined {
    return this.financialTransactionService;
  }

  /**
   * Get transaction orchestrator instance
   */
  getTransactionOrchestrator(): TransactionOrchestrator | undefined {
    return this.transactionOrchestrator;
  }
}

export default CheckoutModule;
