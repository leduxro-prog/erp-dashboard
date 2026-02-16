import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { Router } from 'express';
import { BankingController } from '../api/controllers/BankingController';
import { createBankingRoutes } from '../api/routes/banking.routes';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('banking-module');

export class BankingModuleLoader implements ICypherModule {
  readonly name = 'banking';
  readonly version = '1.0.0';
  readonly description = 'Handles bank statement imports, transaction parsing, and payment reconciliation';
  readonly dependencies: string[] = [];
  readonly publishedEvents: string[] = [];
  readonly subscribedEvents: string[] = [];

  private controller?: BankingController;
  private router?: Router;

  async initialize(context: IModuleContext): Promise<void> {
    logger.info('Initializing Banking module...');

    if (!context.dataSource) {
      throw new Error('DataSource is required for Banking module');
    }

    this.controller = new BankingController(context.dataSource);
    this.router = createBankingRoutes(this.controller);

    logger.info('Banking module initialized successfully');
  }

  async start(): Promise<void> {
    logger.info('Banking module started');
  }

  async stop(): Promise<void> {
    logger.info('Banking module stopped');
  }

  getRouter(): Router {
    if (!this.router) {
      throw new Error('Banking module not initialized. Call initialize() first.');
    }
    return this.router;
  }

  async getHealth(): Promise<IModuleHealth> {
    return {
      status: 'healthy',
      details: {},
      lastChecked: new Date(),
    };
  }

  getMetrics(): IModuleMetrics {
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
}
