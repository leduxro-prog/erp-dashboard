/**
 * Customers Module
 *
 * Provides unified customer search across ERP, B2B, and SmartBill sources.
 * Mounted at /api/v1/customers
 */


import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { Router } from 'express';

import { CustomerController } from './api/controllers/CustomerController';
import { Customer360Service } from './application/services/Customer360Service';
import { UnifiedCustomerSearchService } from './application/services/UnifiedCustomerSearchService';

export class CustomersModule implements ICypherModule {
  public readonly name = 'customers';
  public readonly version = '1.0.0';
  public readonly description = 'Unified Customer Search (ERP, B2B, SmartBill)';
  public readonly dependencies = [];
  public readonly publishedEvents: string[] = [];
  public readonly subscribedEvents: string[] = [];

  private router: Router;
  private logger = createModuleLogger('customers');

  constructor() {
    this.router = Router();
  }

  async initialize(context: IModuleContext): Promise<void> {
    this.logger.info('Initializing CustomersModule...');

    const searchService = new UnifiedCustomerSearchService(context.dataSource);
    const customer360Service = new Customer360Service(context.dataSource);
    const controller = new CustomerController(searchService, customer360Service);

    this.router = controller.getRouter();

    this.logger.info('CustomersModule initialized.');
  }

  async start(): Promise<void> {
    this.logger.info('CustomersModule started.');
  }

  async stop(): Promise<void> {
    this.logger.info('CustomersModule stopped.');
  }

  getRouter(): Router {
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
      eventCount: { published: 0, received: 0 },
    };
  }
}

// Default export for module loader auto-discovery
export default new CustomersModule();
