import { Router } from 'express';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { createSuppliersRouter } from './infrastructure/composition-root';

// Export composition root
export { createSuppliersRouter } from './infrastructure/composition-root';

// Domain exports
export * from './domain';

// Application exports
export * from './application';

// Infrastructure exports
export { BaseScraper, type ScrapedProduct } from './infrastructure/scrapers/BaseScraper';
export { ScraperFactory } from './infrastructure/scrapers/ScraperFactory';
export { AcaLightingScraper } from './infrastructure/scrapers/AcaLightingScraper';
export { MasterledScraper } from './infrastructure/scrapers/MasterledScraper';
export { AreluxScraper } from './infrastructure/scrapers/AreluxScraper';
export { BraytronScraper } from './infrastructure/scrapers/BraytronScraper';
export { FslScraper } from './infrastructure/scrapers/FslScraper';
export { TypeOrmSupplierRepository } from './infrastructure/repositories/TypeOrmSupplierRepository';
export { SupplierSyncJob, type SyncJobData, type SyncJobResult } from './infrastructure/jobs/SupplierSyncJob';

// API exports
export { SupplierController } from './api/controllers/SupplierController';
export { createSupplierRoutes } from './api/routes/supplier.routes';

// TypeORM entities
export { SupplierEntityDb } from './infrastructure/entities/SupplierEntityDb';
export { SupplierProductEntityDb } from './infrastructure/entities/SupplierProductEntityDb';
export { SkuMappingEntityDb } from './infrastructure/entities/SkuMappingEntityDb';
export { SupplierOrderEntityDb } from './infrastructure/entities/SupplierOrderEntityDb';

/**
 * Suppliers Module Implementation
 * Handles supplier management, product sourcing, and supplier data synchronization
 */
export class SuppliersModule implements ICypherModule {
  readonly name = 'suppliers';
  readonly version = '1.0.0';
  readonly description = 'Manages supplier relationships, product catalogs, and supplier data synchronization';
  readonly dependencies: string[] = [];
  readonly publishedEvents = [
    'supplier.created',
    'supplier.updated',
    'supplier.product_synced',
    'supplier.order_placed',
  ];
  readonly subscribedEvents = ['order.created'];

  private context!: IModuleContext;
  private router!: Router;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    this.router = createSuppliersRouter(context.dataSource);
    this.context.logger.info('Suppliers module initialized');
  }

  async start(): Promise<void> {
    this.context.logger.info('Suppliers module started');
  }

  async stop(): Promise<void> {
    this.context.logger.info('Suppliers module stopped');
  }

  async getHealth(): Promise<IModuleHealth> {
    try {
      await this.context.dataSource.query('SELECT 1');

      return {
        status: 'healthy',
        details: {
          database: { status: 'up', message: 'Connected to database' },
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          database: {
            status: 'down',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        lastChecked: new Date(),
      };
    }
  }

  getRouter(): Router {
    return this.router;
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

const suppliersModule = new SuppliersModule();
export default suppliersModule;
