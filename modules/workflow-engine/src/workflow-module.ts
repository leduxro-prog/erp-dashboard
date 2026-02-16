/**
 * Workflow/Approval Engine Module
 * Configurable workflow and approval engine for all modules
 */

import { Router } from 'express';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { WorkflowController } from './api/controllers/WorkflowController';
import { WorkflowTemplateRepository } from './infrastructure/repositories/WorkflowTemplateRepository';
import { WorkflowInstanceRepository } from './infrastructure/repositories/WorkflowInstanceRepository';
import { WorkflowTemplateEntity, WorkflowInstanceEntity, WorkflowDelegationEntity, WorkflowAnalyticsEntity } from './infrastructure/entities';
import { WorkflowCache } from './infrastructure/cache/WorkflowCache';

export class WorkflowEngineModule implements ICypherModule {
  readonly name = 'workflow-engine';
  readonly version = '1.0.0';
  readonly description = 'Configurable workflow and approval engine for all modules';
  readonly dependencies = ['users'];
  readonly publishedEvents = [
    'workflow.started',
    'workflow.step_completed',
    'workflow.approved',
    'workflow.rejected',
    'workflow.escalated',
  ];
  readonly subscribedEvents = ['po.created', 'leave.requested', 'journal.created', 'requisition.created'];
  readonly featureFlag = 'WORKFLOW_ENGINE';

  private logger = createModuleLogger('workflow-engine');
  private router!: Router;
  private context!: IModuleContext;
  private templateRepository!: WorkflowTemplateRepository;
  private instanceRepository!: WorkflowInstanceRepository;
  private workflowController!: WorkflowController;
  private workflowCache!: WorkflowCache;

  private metrics = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    eventsPublished: 0,
    eventsReceived: 0,
  };

  async initialize(context: IModuleContext): Promise<void> {
    this.logger.info('Initializing Workflow Engine Module...');
    this.context = context;

    // Create database entities if not exist
    const dataSource = context.dataSource;
    const entities = [WorkflowTemplateEntity, WorkflowInstanceEntity, WorkflowDelegationEntity, WorkflowAnalyticsEntity];

    /*
    for (const entity of entities) {
      try {
        const tableName = dataSource.getMetadata(entity)?.tableName;
        if (tableName) {
          const queryRunner = dataSource.createQueryRunner();
          const tableExists = await queryRunner.hasTable(tableName);
          if (!tableExists) {
            this.logger.info(`Creating table: ${tableName}`);
            // await queryRunner.createTable(await dataSource.driver.buildCreateTableSql(entity), true);
          }
          await queryRunner.release();
        }
      } catch (err) {
        this.logger.warn(`Error checking table for ${entity.name}: ${err}`);
      }
    }
    */

    // Initialize repositories
    this.templateRepository = new WorkflowTemplateRepository(dataSource);
    this.instanceRepository = new WorkflowInstanceRepository(dataSource);

    // Initialize cache
    this.workflowCache = new WorkflowCache(context.cacheManager);

    // Initialize controller
    this.workflowController = new WorkflowController(this.templateRepository, this.instanceRepository, context.eventBus);
    this.router = this.workflowController.getRouter();

    // Setup event listeners
    this.setupEventListeners();

    this.logger.info('Workflow Engine Module initialized successfully');
  }

  private setupEventListeners(): void {
    const subscribedEvents = this.subscribedEvents;

    subscribedEvents.forEach(event => {
      this.context.eventBus
        .subscribe(event, async (data: any) => {
          this.logger.info(`Received event: ${event}`, data);
          this.metrics.eventsReceived++;
          // Event handling would be implemented based on specific event types
        })
        .catch(err => {
          this.logger.error(`Failed to subscribe to ${event}`, err);
        });
    });
  }

  async start(): Promise<void> {
    this.logger.info('Starting Workflow Engine Module...');

    // Initialize escalation job checker (would run periodically)
    this.startEscalationChecker();

    this.logger.info('Workflow Engine Module started');
  }

  private startEscalationChecker(): void {
    // Check for overdue workflows every 5 minutes
    setInterval(async () => {
      try {
        const overdueWorkflows = await this.instanceRepository.findOverdue(30); // 30 minute timeout
        if (overdueWorkflows.length > 0) {
          this.logger.info(`Found ${overdueWorkflows.length} overdue workflows`);
          // Trigger escalation logic
        }
      } catch (err) {
        this.logger.error('Error checking for overdue workflows', err);
      }
    }, 5 * 60 * 1000);
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Workflow Engine Module...');

    // Cleanup cache
    await this.workflowCache.invalidateAll();

    this.logger.info('Workflow Engine Module stopped');
  }

  getRouter(): Router {
    return this.router;
  }

  async getHealth(): Promise<IModuleHealth> {
    try {
      const dataSource = this.context.dataSource;
      const dbHealthy = dataSource.isInitialized;

      const cacheStats = await this.context.cacheManager.getStats();

      return {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        details: {
          database: {
            status: dbHealthy ? 'up' : 'down',
            message: dbHealthy ? 'Database connection established' : 'Database connection lost',
          },
          cache: {
            status: 'up',
            message: `Cache hit rate: ${cacheStats.hitRate.toFixed(2)}%`,
          },
        },
        lastChecked: new Date(),
      };
    } catch (err) {
      this.logger.error('Health check failed', err);
      return {
        status: 'unhealthy',
        details: {
          error: {
            status: 'down',
            message: 'Health check failed',
          },
        },
        lastChecked: new Date(),
      };
    }
  }

  getMetrics(): IModuleMetrics {
    return {
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      avgResponseTime: this.metrics.requestCount > 0 ? this.metrics.totalResponseTime / this.metrics.requestCount : 0,
      activeWorkers: 0,
      cacheHitRate: 0,
      eventCount: {
        published: this.metrics.eventsPublished,
        received: this.metrics.eventsReceived,
      },
    };
  }
}
