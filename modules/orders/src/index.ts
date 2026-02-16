/**
 * CYPHER ERP - Orders Module
 * Complete order management with complex status machine, partial delivery, invoicing, and proforma support
 *
 * Module exports for both Domain, Application and Infrastructure layers
 */

import { Router } from 'express';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { createOrdersRouter } from './infrastructure/composition-root';

// Export composition root
export { createOrdersRouter } from './infrastructure/composition-root';

// Domain Layer
export * from './domain';

// Application Layer
export * from './application';

/**
 * Orders Module Implementation
 * Handles complete order management with status machines, partial delivery, invoicing
 */
export class OrdersModule implements ICypherModule {
  readonly name = 'orders';
  readonly version = '1.0.0';
  readonly description = 'Complete order management with complex status machine, partial delivery, invoicing, and proforma support';
  readonly dependencies = ['inventory'];
  readonly publishedEvents = [
    'order.created',
    'order.updated',
    'order.shipped',
    'order.delivered',
    'order.cancelled',
    'order.paid',
  ];
  readonly subscribedEvents = ['inventory.stock_reserved', 'inventory.stock_released'];

  private context!: IModuleContext;
  private router!: Router;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    this.router = createOrdersRouter(context.dataSource);
    this.context.logger.info('Orders module initialized');
  }

  async start(): Promise<void> {
    this.context.logger.info('Orders module started');
  }

  async stop(): Promise<void> {
    this.context.logger.info('Orders module stopped');
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

const ordersModule = new OrdersModule();
export default ordersModule;
