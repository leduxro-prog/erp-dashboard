import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { createRoutes } from './api/routes';
import { RequisitionController } from './api/controllers/RequisitionController';
import { PurchaseOrderController } from './api/controllers/PurchaseOrderController';
import { GRNController } from './api/controllers/GRNController';
import { InvoiceController } from './api/controllers/InvoiceController';
import { MatchingController } from './api/controllers/MatchingController';
import { RequisitionUseCases } from './application/use-cases/RequisitionUseCases';
import { PurchaseOrderUseCases } from './application/use-cases/PurchaseOrderUseCases';
import { GRNUseCases } from './application/use-cases/GRNUseCases';
import { InvoiceUseCases } from './application/use-cases/InvoiceUseCases';
import { MatchingUseCases } from './application/use-cases/MatchingUseCases';
import { RequisitionService } from './domain/services/RequisitionService';
import { PurchaseOrderService } from './domain/services/PurchaseOrderService';
import { GRNService } from './domain/services/GRNService';
import { InvoiceService } from './domain/services/InvoiceService';
import { MatchingService } from './domain/services/MatchingService';
import { PURCHASING_INVOICE_APPROVED_EVENT } from './application/events/PurchasingEvents';
import {
  InMemoryBudgetRepository,
  InMemoryGRNRepository,
  InMemoryInvoiceRepository,
  InMemoryMatchRepository,
  InMemoryPurchaseOrderRepository,
  InMemoryRequisitionRepository,
} from './infrastructure/repositories/InMemoryRepositories';
import { TypeOrmRequisitionRepository } from './infrastructure/repositories/TypeOrmRequisitionRepository';
import { TypeOrmPurchaseOrderRepository } from './infrastructure/repositories/TypeOrmPurchaseOrderRepository';
import { TypeOrmGRNRepository } from './infrastructure/repositories/TypeOrmGRNRepository';
import { TypeOrmInvoiceRepository } from './infrastructure/repositories/TypeOrmInvoiceRepository';
import { TypeOrmMatchRepository } from './infrastructure/repositories/TypeOrmMatchRepository';
import { PurchaseRequisitionEntity } from './infrastructure/entities/PurchaseRequisitionEntity';
import { PurchaseOrderEntity } from './infrastructure/entities/PurchaseOrderEntity';
import { GoodsReceiptNoteEntity } from './infrastructure/entities/GoodsReceiptNoteEntity';
import { VendorInvoiceEntity } from './infrastructure/entities/VendorInvoiceEntity';
import { ThreeWayMatchEntity } from './infrastructure/entities/ThreeWayMatchEntity';

const logger = createModuleLogger('purchasing');

export class PurchasingModule implements ICypherModule {
  readonly name = 'purchasing';
  readonly version = '1.0.0';
  readonly description = 'Purchasing module: requisitions, purchase orders, GRN, invoices, 3-way matching';
  readonly dependencies: string[] = [];
  readonly publishedEvents: string[] = [];
  readonly subscribedEvents: string[] = [];

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
    logger.info('Initializing Purchasing module');

    const runtimeMode = (process.env.PURCHASING_RUNTIME_MODE || 'in_memory').toLowerCase();
    const canUseTypeOrm = runtimeMode === 'typeorm' && context.dataSource?.isInitialized;

    const requisitionRepository = canUseTypeOrm
      ? new TypeOrmRequisitionRepository(context.dataSource.getRepository(PurchaseRequisitionEntity))
      : new InMemoryRequisitionRepository();
    const purchaseOrderRepository = canUseTypeOrm
      ? new TypeOrmPurchaseOrderRepository(context.dataSource.getRepository(PurchaseOrderEntity))
      : new InMemoryPurchaseOrderRepository();
    const grnRepository = canUseTypeOrm
      ? new TypeOrmGRNRepository(context.dataSource.getRepository(GoodsReceiptNoteEntity))
      : new InMemoryGRNRepository();
    const invoiceRepository = canUseTypeOrm
      ? new TypeOrmInvoiceRepository(context.dataSource.getRepository(VendorInvoiceEntity))
      : new InMemoryInvoiceRepository();
    const matchRepository = canUseTypeOrm
      ? new TypeOrmMatchRepository(context.dataSource.getRepository(ThreeWayMatchEntity))
      : new InMemoryMatchRepository();
    const budgetRepository = new InMemoryBudgetRepository();

    const requisitionService = new RequisitionService(requisitionRepository, budgetRepository);
    const purchaseOrderService = new PurchaseOrderService(purchaseOrderRepository, budgetRepository);
    const grnService = new GRNService(grnRepository, purchaseOrderRepository);
    const invoiceService = new InvoiceService(invoiceRepository);
    const matchingService = new MatchingService(
      matchRepository,
      purchaseOrderRepository,
      grnRepository,
      invoiceRepository,
    );

    const requisitionUseCases = new RequisitionUseCases(requisitionService, requisitionRepository);
    const purchaseOrderUseCases = new PurchaseOrderUseCases(purchaseOrderService, purchaseOrderRepository);
    const grnUseCases = new GRNUseCases(grnService, grnRepository);
    const eventBus = (context as any)?.eventBus;
    const invoiceUseCases = new InvoiceUseCases(
      invoiceService,
      invoiceRepository,
      eventBus && typeof eventBus.publish === 'function'
        ? {
            publishInvoiceApproved: async (event) => {
              await eventBus.publish(PURCHASING_INVOICE_APPROVED_EVENT, event);
            },
          }
        : undefined,
    );
    const matchingUseCases = new MatchingUseCases(matchingService, matchRepository);

    const requisitionController = new RequisitionController(requisitionUseCases);
    const purchaseOrderController = new PurchaseOrderController(purchaseOrderUseCases);
    const grnController = new GRNController(grnUseCases);
    const invoiceController = new InvoiceController(invoiceUseCases);
    const matchingController = new MatchingController(matchingUseCases);

    this.router = createRoutes(
      requisitionController,
      purchaseOrderController,
      grnController,
      invoiceController,
      matchingController,
    );

    logger.info('Purchasing module initialized successfully', {
      runtimeMode: canUseTypeOrm ? 'typeorm' : 'in_memory',
    });
  }

  async start(): Promise<void> {
    this.isStarted = true;
    logger.info('Purchasing module started');
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    logger.info('Purchasing module stopped');
  }

  async getHealth(): Promise<IModuleHealth> {
    return {
      status: this.isStarted ? 'healthy' : 'degraded',
      details: {
        module: {
          status: this.isStarted ? 'up' : 'down',
          message: 'In-memory purchasing runtime active',
        },
      },
      lastChecked: new Date(),
    };
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
