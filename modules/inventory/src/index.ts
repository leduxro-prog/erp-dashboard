import { Router } from 'express';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { createInventoryRouter } from './infrastructure/composition-root';

// Export composition root
export { createInventoryRouter } from './infrastructure/composition-root';

// Export domain exports
export * from './domain';

// Export application exports
export * from './application';

/**
 * Inventory Module Implementation
 * Handles all stock management, reservations, movements, and low stock alerts
 */
export class InventoryModule implements ICypherModule {
  readonly name = 'inventory';
  readonly version = '1.0.0';
  readonly description = 'Manages product inventory, stock levels, reservations, and low stock alerts';
  readonly dependencies: string[] = [];
  readonly publishedEvents = [
    'inventory.stock_reserved',
    'inventory.stock_released',
    'inventory.stock_adjusted',
    'inventory.low_stock',
  ];
  readonly subscribedEvents: string[] = [];

  private context!: IModuleContext;
  private router!: Router;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    // Create composition root with dependencies
    this.router = createInventoryRouter(context.dataSource);
    this.context.logger.info('Inventory module initialized');
  }

  async start(): Promise<void> {
    this.context.logger.info('Inventory module started');
  }

  async stop(): Promise<void> {
    this.context.logger.info('Inventory module stopped');
  }

  async getHealth(): Promise<IModuleHealth> {
    try {
      // Test database connectivity
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

const inventoryModule = new InventoryModule();
export default inventoryModule;
