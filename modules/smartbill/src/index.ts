import { Repository } from 'typeorm';
import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system/module.interface';

import {
  SmartBillApiClient,
  SmartBillApiClientConfig,
} from './infrastructure/api-client/SmartBillApiClient';
import { TypeOrmSmartBillRepository } from './infrastructure/repositories/TypeOrmSmartBillRepository';
import { OrderServiceConnector } from './infrastructure/services/OrderServiceConnector';

import { CreateInvoiceUseCase } from './application/use-cases/CreateInvoice';
import { CreateProformaUseCase } from './application/use-cases/CreateProforma';
import { CreateProformaFromQuoteUseCase } from './application/use-cases/CreateProformaFromQuote';
import { SyncStockUseCase } from './application/use-cases/SyncStock';
import { GetWarehousesUseCase } from './application/use-cases/GetWarehouses';
import { SyncPricesFromInvoicesUseCase } from './application/use-cases/SyncPricesFromInvoices';
import { ImportPricesFromExcelUseCase } from './application/use-cases/ImportPricesFromExcel';
import { SyncSmartBillCustomers } from './application/use-cases/SyncSmartBillCustomers';
import { ConvertProformaToInvoiceUseCase } from './application/use-cases/ConvertProformaToInvoice';
import { SyncInvoiceStatusUseCase } from './application/use-cases/SyncInvoiceStatus';
import { CustomerMatchingService } from './application/services/CustomerMatchingService';
import { SyncMonitorService } from './application/services/SyncMonitorService';

import { SmartBillController } from './api/controllers/SmartBillController';
import { createSmartBillRoutes as createSmartBillRoutesFromController } from './api/routes/smartbill.routes';

import { StockSyncJob } from './infrastructure/jobs/StockSyncJob';
import { CustomerSyncJob } from './infrastructure/jobs/CustomerSyncJob';
import { PriceSyncJob } from './infrastructure/jobs/PriceSyncJob';
import { InvoiceStatusSyncJob } from './infrastructure/jobs/InvoiceStatusSyncJob';
import { SmartBillInvoiceEntity } from './infrastructure/entities/SmartBillInvoiceEntity';
import { SmartBillProformaEntity } from './infrastructure/entities/SmartBillProformaEntity';
import { SmartBillStockSyncEntity } from './infrastructure/entities/SmartBillStockSyncEntity';

// Convenience re-export (controller-based routes)
export { createSmartBillRoutes as createSmartBillRouter } from './infrastructure/composition-root';

export interface IEventBus {
  publish(eventName: string, payload: unknown): Promise<void>;
}

export interface IOrderService {
  getOrderById(orderId: string): Promise<unknown>;
  updateOrderWithSmartBillId?(params: {
    orderId: string;
    smartBillInvoiceId?: string;
    invoiceNumber?: string;
    invoiceSeries?: string;
    smartBillProformaId?: string;
    proformaNumber?: string;
    proformaSeries?: string;
    status?: string;
  }): Promise<{ success: boolean; orderNumber: string; message?: string }>;
}

export interface IRedisConnection {
  set(key: string, value: string, options?: unknown): Promise<unknown>;
  get(key: string): Promise<string | null>;
}

export interface SmartBillModuleConfig {
  apiConfig: SmartBillApiClientConfig;
  eventBus: IEventBus;
  orderService: IOrderService;
  redisConnection?: IRedisConnection;
}

export interface SmartBillModuleFactoryResult {
  apiClient: SmartBillApiClient;
  repository: TypeOrmSmartBillRepository;
  createInvoiceUseCase: CreateInvoiceUseCase;
  createProformaUseCase: CreateProformaUseCase;
  createProformaFromQuoteUseCase?: CreateProformaFromQuoteUseCase;
  syncStockUseCase: SyncStockUseCase;
  getWarehousesUseCase: GetWarehousesUseCase;
  syncPricesUseCase?: SyncPricesFromInvoicesUseCase;
  importExcelUseCase?: ImportPricesFromExcelUseCase;
  syncSmartBillCustomers?: SyncSmartBillCustomers;
  convertProformaToInvoiceUseCase?: ConvertProformaToInvoiceUseCase;
  syncInvoiceStatusUseCase?: SyncInvoiceStatusUseCase;
  customerMatchingService?: CustomerMatchingService;
  controller: SmartBillController;
  routes: Router;
  stockSyncJob: StockSyncJob;
  customerSyncJob?: CustomerSyncJob;
  priceSyncJob?: PriceSyncJob;
  invoiceStatusSyncJob?: InvoiceStatusSyncJob;
  syncMonitorService?: SyncMonitorService;
  orderService: OrderServiceConnector;
}

export function createSmartBillModule(
  invoiceRepository: Repository<SmartBillInvoiceEntity>,
  proformaRepository: Repository<SmartBillProformaEntity>,
  stockSyncRepository: Repository<SmartBillStockSyncEntity>,
  config: SmartBillModuleConfig,
  dataSource?: any,
): SmartBillModuleFactoryResult {
  const apiClient = new SmartBillApiClient(config.apiConfig);
  const repository = new TypeOrmSmartBillRepository(
    invoiceRepository,
    proformaRepository,
    stockSyncRepository,
  );

  // Create real OrderService connector if dataSource is available
  const orderService = dataSource
    ? new OrderServiceConnector(dataSource)
    : (config.orderService as any);

  const createInvoiceUseCase = new CreateInvoiceUseCase(
    repository,
    apiClient as unknown as SmartBillApiClient,
    config.eventBus,
    orderService,
  );

  const createProformaUseCase = new CreateProformaUseCase(
    repository,
    apiClient as unknown as SmartBillApiClient,
    config.eventBus,
    orderService,
  );

  const syncStockUseCase = new SyncStockUseCase(
    repository,
    apiClient as unknown as SmartBillApiClient,
    config.eventBus,
    dataSource,
  );
  const getWarehousesUseCase = new GetWarehousesUseCase(apiClient as unknown as SmartBillApiClient);

  const syncPricesUseCase = dataSource
    ? new SyncPricesFromInvoicesUseCase(apiClient as any as any, dataSource)
    : undefined;
  const importExcelUseCase = dataSource ? new ImportPricesFromExcelUseCase(dataSource) : undefined;

  // WS3: SmartBill customer sync from invoices
  const syncSmartBillCustomers = dataSource
    ? new SyncSmartBillCustomers(
        dataSource,
        apiClient,
        config.eventBus
          ? (event: string, data: unknown) => config.eventBus.publish(event, data)
          : undefined,
      )
    : undefined;

  // WS4: Proforma from quotation
  const createProformaFromQuoteUseCase = dataSource
    ? new CreateProformaFromQuoteUseCase(
        repository,
        apiClient as unknown as any,
        config.eventBus,
        dataSource,
      )
    : undefined;

  // Customer matching service for intelligent auto-match scoring
  const customerMatchingService = dataSource ? new CustomerMatchingService(dataSource) : undefined;

  // Proforma-to-invoice conversion use case
  const convertProformaToInvoiceUseCase = dataSource
    ? new ConvertProformaToInvoiceUseCase(
        repository,
        apiClient as unknown as any,
        config.eventBus,
        orderService,
        dataSource,
      )
    : undefined;

  // Invoice status sync use case (bidirectional status polling)
  const syncInvoiceStatusUseCase = new SyncInvoiceStatusUseCase(
    repository,
    apiClient as unknown as any,
    config.eventBus,
    orderService,
  );

  // Sync monitoring service
  const syncMonitorService = dataSource ? new SyncMonitorService(dataSource) : undefined;

  const controller = new SmartBillController(
    createInvoiceUseCase,
    createProformaUseCase,
    syncStockUseCase,
    getWarehousesUseCase,
    repository,
    apiClient,
    syncPricesUseCase,
    importExcelUseCase,
    syncSmartBillCustomers,
    createProformaFromQuoteUseCase,
    dataSource,
    customerMatchingService,
    syncMonitorService,
    convertProformaToInvoiceUseCase,
    syncInvoiceStatusUseCase,
  );

  const routes = createSmartBillRoutesFromController(controller);
  const stockSyncJob = new StockSyncJob(syncStockUseCase, config.redisConnection);

  // Customer sync job (daily at 2 AM Bucharest time)
  const customerSyncJob =
    syncSmartBillCustomers && config.redisConnection
      ? new CustomerSyncJob(syncSmartBillCustomers, config.redisConnection)
      : undefined;

  // Price sync job (daily at 3 AM Bucharest time)
  const priceSyncJob =
    syncPricesUseCase && config.redisConnection
      ? new PriceSyncJob(syncPricesUseCase, config.redisConnection)
      : undefined;

  // Invoice status sync job (every 30 minutes)
  const invoiceStatusSyncJob = config.redisConnection
    ? new InvoiceStatusSyncJob(syncInvoiceStatusUseCase, config.redisConnection)
    : undefined;

  return {
    apiClient,
    repository,
    createInvoiceUseCase,
    createProformaUseCase,
    createProformaFromQuoteUseCase,
    syncStockUseCase,
    getWarehousesUseCase,
    syncPricesUseCase,
    importExcelUseCase,
    syncSmartBillCustomers,
    convertProformaToInvoiceUseCase,
    syncInvoiceStatusUseCase,
    customerMatchingService,
    controller,
    routes,
    stockSyncJob,
    customerSyncJob,
    priceSyncJob,
    invoiceStatusSyncJob,
    syncMonitorService,
    orderService,
  };
}

export default class SmartBillModule implements ICypherModule {
  readonly name = 'smartbill';
  readonly version = '1.0.0';
  readonly description =
    'Integration with SmartBill accounting system for invoicing and stock sync';
  readonly dependencies = ['orders'];
  readonly publishedEvents = [
    'smartbill.invoice_created',
    'smartbill.proforma_created',
    'smartbill.proforma_converted',
    'smartbill.invoice_status_changed',
    'smartbill.stock_synced',
  ];
  readonly subscribedEvents = ['order.created', 'order.paid'];

  private context!: IModuleContext;
  private router!: Router;
  private factory!: SmartBillModuleFactoryResult;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    context.logger.info('Initializing SmartBill module...');

    // Get SmartBill company VAT for API calls
    const companyVat = process.env.SMARTBILL_COMPANY_VAT || '';

    const config: SmartBillModuleConfig = {
      apiConfig: {
        baseUrl: process.env.SMARTBILL_API_URL || 'https://ws.smartbill.ro/SBORO/api',
        username: process.env.SMARTBILL_USERNAME || '',
        password: process.env.SMARTBILL_TOKEN || '',
        maxRetries: parseInt(process.env.SMARTBILL_MAX_RETRIES || '3', 10),
        retryDelayMs: parseInt(process.env.SMARTBILL_RETRY_DELAY_MS || '1000', 10),
        rateLimitPerMinute: parseInt(process.env.SMARTBILL_RATE_LIMIT || '10', 10),
      },
      eventBus: context.eventBus,
      // OrderServiceConnector is created internally from dataSource.
      // This placeholder is never reached when dataSource is present.
      orderService: new OrderServiceConnector(context.dataSource),
      redisConnection: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      } as any,
    };

    const invoiceRepo = context.dataSource.getRepository(SmartBillInvoiceEntity);
    const proformaRepo = context.dataSource.getRepository(SmartBillProformaEntity);
    const stockSyncRepo = context.dataSource.getRepository(SmartBillStockSyncEntity);

    const factory = createSmartBillModule(
      invoiceRepo,
      proformaRepo,
      stockSyncRepo,
      config,
      context.dataSource,
    );
    this.factory = factory;
    this.router = factory.routes;

    context.logger.info('SmartBill module initialized', {
      companyVat: companyVat ? 'configured' : 'not configured',
    });
  }

  async start(): Promise<void> {
    // Start the periodic stock sync job (BullMQ, every 15 min)
    try {
      await this.factory.stockSyncJob.start();
      this.context.logger.info('SmartBill stock sync job started');
    } catch (error) {
      this.context.logger.warn('SmartBill stock sync job failed to start', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Start the periodic customer sync job (BullMQ, daily at 2 AM)
    if (this.factory.customerSyncJob) {
      try {
        await this.factory.customerSyncJob.start();
        this.context.logger.info('SmartBill customer sync job started');
      } catch (error) {
        this.context.logger.warn('SmartBill customer sync job failed to start', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Start the periodic price sync job (BullMQ, daily at 3 AM)
    if (this.factory.priceSyncJob) {
      try {
        await this.factory.priceSyncJob.start();
        this.context.logger.info('SmartBill price sync job started');
      } catch (error) {
        this.context.logger.warn('SmartBill price sync job failed to start', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Start the periodic invoice status sync job (BullMQ, every 30 min)
    if (this.factory.invoiceStatusSyncJob) {
      try {
        await this.factory.invoiceStatusSyncJob.start();
        this.context.logger.info('SmartBill invoice status sync job started');
      } catch (error) {
        this.context.logger.warn('SmartBill invoice status sync job failed to start', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.context.logger.info('SmartBill module started (all sync jobs active)');
  }

  async stop(): Promise<void> {
    try {
      await this.factory.stockSyncJob.stop();
    } catch (error) {
      this.context.logger.warn('Error stopping stock sync job', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (this.factory.customerSyncJob) {
      try {
        await this.factory.customerSyncJob.stop();
      } catch (error) {
        this.context.logger.warn('Error stopping customer sync job', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (this.factory.priceSyncJob) {
      try {
        await this.factory.priceSyncJob.stop();
      } catch (error) {
        this.context.logger.warn('Error stopping price sync job', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (this.factory.invoiceStatusSyncJob) {
      try {
        await this.factory.invoiceStatusSyncJob.stop();
      } catch (error) {
        this.context.logger.warn('Error stopping invoice status sync job', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.context.logger.info('SmartBill module stopped');
  }

  getRouter(): Router {
    if (!this.router) throw new Error('SmartBill module not initialized');
    return this.router;
  }

  async getHealth(): Promise<IModuleHealth> {
    return { status: 'healthy', details: {}, lastChecked: new Date() };
  }

  getMetrics(): IModuleMetrics {
    return {
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      activeWorkers: 0,
      cacheHitRate: 0,
      eventCount: { published: 0, received: 0 },
    };
  }
}
