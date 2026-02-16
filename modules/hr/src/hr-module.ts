import { Router } from 'express';
import {
    ICypherModule,
    IModuleContext,
    IModuleHealth,
    IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { createHRRouter } from './api/routes';

const logger = createModuleLogger('hr');

export default class HRModule implements ICypherModule {
    readonly name = 'hr';
    readonly version = '1.0.0';
    readonly description = 'Human Resources - Employees, Attendance, Leave, Performance, Payroll';
    readonly dependencies: string[] = ['users'];
    readonly publishedEvents = [
        'employee.created',
        'employee.updated',
        'employee.terminated',
        'leave.requested',
        'leave.approved',
        'leave.rejected',
        'attendance.clocked-in',
        'attendance.clocked-out',
        'payroll.created',
        'payroll.processed',
        'performance.review.created',
        'performance.review.completed',
    ];
    readonly subscribedEvents = ['user.created'];
    readonly featureFlag: string | undefined = 'HR_MODULE';

    private context!: IModuleContext;
    private router!: Router;
    private isStarted = false;

    async initialize(context: IModuleContext): Promise<void> {
        this.context = context;
        logger.info('Initializing HR module');

        try {
            const dataSource = context.dataSource;

            if (!dataSource) {
                throw new Error('DataSource not available in module context');
            }

            this.router = createHRRouter(dataSource);

            logger.info('HR module initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize HR module', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async start(): Promise<void> {
        this.isStarted = true;
        logger.info('HR module started');
    }

    async stop(): Promise<void> {
        this.isStarted = false;
        logger.info('HR module stopped');
    }

    async getHealth(): Promise<IModuleHealth> {
        return {
            status: 'healthy',
            details: {
                module: { status: this.isStarted ? 'up' : 'down' },
            },
            lastChecked: new Date(),
        };
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
            eventCount: { published: 0, received: 0 },
        };
    }
}

export { HRModule };
