import { Router } from 'express';
import { DataSource } from 'typeorm';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '../../../shared/module-system/module.interface';
import { B2BAdminController } from './api/controllers/B2BAdminController';
import { authenticate } from '../../../shared/middleware/auth.middleware';

export class B2BAdminModule implements ICypherModule {
  readonly name = 'b2b-admin';
  readonly version = '1.0.0';
  readonly description = 'B2B Customer Management for ERP Admins';
  readonly dependencies: string[] = ['b2b-portal'];
  readonly publishedEvents: string[] = [];
  readonly subscribedEvents: string[] = [];

  private router!: Router;
  private context!: IModuleContext;
  private dataSource!: DataSource;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    this.dataSource = context.dataSource;

    // Create controller
    const controller = new B2BAdminController(this.dataSource);

    // Create router with authentication
    this.router = Router();
    this.router.use(authenticate);
    this.router.use('/', controller.getRouter());

    console.log(`[${this.name}] Module initialized successfully`);
  }

  async start(): Promise<void> {
    console.log(`[${this.name}] Module started successfully`);
  }

  async stop(): Promise<void> {
    console.log(`[${this.name}] Module stopped`);
  }

  getRouter(): Router {
    return this.router;
  }

  async getHealth(): Promise<IModuleHealth> {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'healthy',
        details: {
          database: {
            status: 'up',
            message: 'Connected',
          },
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

export default new B2BAdminModule();
