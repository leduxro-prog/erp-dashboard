import { Router } from 'express';
import {
    ICypherModule,
    IModuleContext,
    IModuleHealth,
    IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { SettingsService } from './application/services/SettingsService';
import { SettingsController } from './api/controllers/SettingsController';

const logger = createModuleLogger('settings');

export default class SettingsModule implements ICypherModule {
    readonly name = 'settings';
    readonly version = '1.0.0';
    readonly description = 'Application configuration and settings management';
    readonly dependencies: string[] = [];
    readonly publishedEvents = [];
    readonly subscribedEvents = [];
    readonly featureFlag: string | undefined = undefined;

    private context!: IModuleContext;
    private router!: Router;
    private isStarted = false;
    private settingsService!: SettingsService;
    private settingsController!: SettingsController;

    async initialize(context: IModuleContext): Promise<void> {
        this.context = context;
        logger.info('Initializing Settings module');

        try {
            // Initialize Service and Controller
            // We pass the logger from context
            this.settingsService = new SettingsService(context.logger);
            this.settingsController = new SettingsController(this.settingsService);

            // Create Express router
            this.router = Router();
            this.setupRoutes();

            logger.info('Settings module initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Settings module', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    private setupRoutes(): void {
        this.router.get('/', this.settingsController.getSettings);
        this.router.put('/', this.settingsController.updateSettings);
        // Add health check for this module
        this.router.get('/health', (req, res) => res.json({ status: 'ok' }));
    }

    async start(): Promise<void> {
        this.isStarted = true;
        logger.info('Settings module started');
    }

    async stop(): Promise<void> {
        this.isStarted = false;
        logger.info('Settings module stopped');
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

export { SettingsModule };
