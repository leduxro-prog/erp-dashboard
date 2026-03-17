import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { createFinancialAccountingRoutes } from './api/routes/financialAccountingRoutes';
import { ChartOfAccountRepository } from './infrastructure/repositories/ChartOfAccountRepository';
import { JournalEntryRepository } from './infrastructure/repositories/JournalEntryRepository';
import { FiscalPeriodRepository } from './infrastructure/repositories/FiscalPeriodRepository';
import { ArInvoiceRepository } from './infrastructure/repositories/ArInvoiceRepository';
import { ApInvoiceRepository } from './infrastructure/repositories/ApInvoiceRepository';
import { ChartOfAccountEntity } from './infrastructure/entities/ChartOfAccountEntity';
import { JournalEntryEntity } from './infrastructure/entities/JournalEntryEntity';
import { FiscalPeriodEntity } from './infrastructure/entities/FiscalPeriodEntity';
import { ArInvoiceEntity } from './infrastructure/entities/ArInvoiceEntity';
import { ApInvoiceEntity } from './infrastructure/entities/ApInvoiceEntity';
import { OnPurchasingInvoiceApproved } from './application/handlers/OnPurchasingInvoiceApproved';

const logger = createModuleLogger('financial-accounting');

export class FinancialAccountingModule implements ICypherModule {
  readonly name = 'financial-accounting';
  readonly version = '1.0.0';
  readonly description = 'Financial accounting module: chart of accounts, journal entries, AR/AP invoices, fiscal periods';
  readonly dependencies: string[] = [];
  readonly publishedEvents: string[] = [];
  readonly subscribedEvents: string[] = ['purchasing.invoice.approved'];

  private context!: IModuleContext;
  private router!: Router;
  private isStarted = false;
  private metrics = {
    requestCount: 0,
    errorCount: 0,
    responseTimes: [] as number[],
    eventCount: { published: 0, received: 0 },
    activeWorkers: 0,
  };

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    logger.info('Initializing FinancialAccounting module');

    try {
      if (!context.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      const chartOfAccountRepo = new ChartOfAccountRepository(
        context.dataSource.getRepository(ChartOfAccountEntity),
      );
      const journalEntryRepo = new JournalEntryRepository(
        context.dataSource.getRepository(JournalEntryEntity),
      );
      const fiscalPeriodRepo = new FiscalPeriodRepository(
        context.dataSource.getRepository(FiscalPeriodEntity),
      );
      const arInvoiceRepo = new ArInvoiceRepository(
        context.dataSource.getRepository(ArInvoiceEntity),
      );
      const apInvoiceRepo = new ApInvoiceRepository(
        context.dataSource.getRepository(ApInvoiceEntity),
      );
      this.router = createFinancialAccountingRoutes(
        chartOfAccountRepo,
        journalEntryRepo,
        fiscalPeriodRepo,
        arInvoiceRepo,
        apInvoiceRepo,
        null, // costCenterRepository — not yet implemented
      );

      const eventBus = (context as any)?.eventBus;
      if (eventBus && typeof eventBus.subscribe === 'function') {
        const handler = new OnPurchasingInvoiceApproved(apInvoiceRepo);
        await eventBus.subscribe('purchasing.invoice.approved', async (event: unknown) => {
          await handler.handle(event as any);
        });
      }

      logger.info('FinancialAccounting module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize FinancialAccounting module', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async start(): Promise<void> {
    this.isStarted = true;
    logger.info('FinancialAccounting module started');
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    logger.info('FinancialAccounting module stopped');
  }

  async getHealth(): Promise<IModuleHealth> {
    try {
      await this.context.dataSource.query('SELECT 1');
      return {
        status: 'healthy',
        details: { database: { status: 'up' }, module: { status: this.isStarted ? 'up' : 'down' } },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { database: { status: 'down', message: error instanceof Error ? error.message : String(error) } },
        lastChecked: new Date(),
      };
    }
  }

  getRouter(): Router {
    return this.router;
  }

  getMetrics(): IModuleMetrics {
    return {
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      avgResponseTime: 0,
      activeWorkers: 0,
      cacheHitRate: 0,
      eventCount: this.metrics.eventCount,
    };
  }
}
