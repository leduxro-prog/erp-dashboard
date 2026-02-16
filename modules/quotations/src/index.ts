import { Router } from 'express';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { createQuotationsRouter } from './infrastructure/composition-root';

// Export composition root
export { createQuotationsRouter } from './infrastructure/composition-root';

// Domain Layer
export * from './domain';

// Application Layer
export * from './application';

// Infrastructure Layer
export * from './infrastructure';

// API Layer
export * from './api';

/**
 * Quotations Module Implementation
 * Handles quotation management with conversion to orders
 */
export class QuotationsModule implements ICypherModule {
  readonly name = 'quotations';
  readonly version = '1.0.0';
  readonly description = 'Manages customer quotations with conversion to orders and approval workflows';
  readonly dependencies = ['inventory', 'pricing-engine'];
  readonly publishedEvents = [
    'quotation.created',
    'quotation.updated',
    'quotation.sent',
    'quotation.accepted',
    'quotation.rejected',
    'quotation.expired',
  ];
  readonly subscribedEvents = ['inventory.low_stock'];

  private context!: IModuleContext;
  private router!: Router;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;

    // Create stub services for module initialization
    // These should be replaced with real implementations from the IoC container
    const stubEmailService = {
      sendEmail: async () => ({ success: true }),
    };

    const stubOrderService = {
      createOrder: async (quoteId: string) => ({ orderId: `order-${quoteId}`, success: true }),
    };

    const stubEventPublisher = {
      publish: async () => { },
    };

    const stubCompanyDetailsProvider = {
      getCompanyDetails: async () => ({
        name: 'Company',
        address: 'Address',
        phone: '000-000-0000',
        email: 'info@company.com',
      }),
    };

    this.router = createQuotationsRouter(
      context.dataSource,
      stubEmailService as any,
      stubOrderService as any,
      stubEventPublisher as any,
      stubCompanyDetailsProvider as any,
    );
    this.context.logger.info('Quotations module initialized');
  }

  async start(): Promise<void> {
    this.context.logger.info('Quotations module started');
  }

  async stop(): Promise<void> {
    this.context.logger.info('Quotations module stopped');
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

// Default export for ModuleLoader
export default QuotationsModule;
