import { Router } from 'express';
import { ICypherModule, IModuleContext, IModuleHealth, IModuleMetrics } from '@shared/module-system/module.interface';
import { SchedulerService } from './services/SchedulerService';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('scheduler-module');

/**
 * Scheduler Module
 * Central cron job orchestrator for daily reports, ads sentinel, and inventory analysis.
 * 
 * Jobs:
 * - Daily Close (23:59 Bucharest): Financial KPI → Smart Inventory → WhatsApp Report
 * - Ads Sentinel (every 30 min): Position monitoring → 30/40 profit protection
 */
export class SchedulerModule implements ICypherModule {
    readonly name = 'scheduler';
    readonly version = '1.0.0';
    readonly description = 'Central cron scheduler for daily reports, ads monitoring, and inventory analysis';
    readonly dependencies = ['financial-accounting', 'inventory', 'whatsapp', 'google-shopping'];
    readonly publishedEvents = [
        'scheduler.daily_close_completed',
        'scheduler.ads_sentinel_completed',
        'scheduler.report_sent',
        'scheduler.error',
    ];
    readonly subscribedEvents: string[] = [];

    private context!: IModuleContext;
    private schedulerService!: SchedulerService;
    private router!: Router;

    async initialize(context: IModuleContext): Promise<void> {
        this.context = context;
        this.router = Router();

        this.schedulerService = new SchedulerService(context.dataSource);

        // API endpoint: manually trigger daily close (for testing)
        this.router.post('/trigger/daily-close', async (_req, res) => {
            try {
                logger.info('Manual daily close triggered via API');
                await this.schedulerService.runDailyClose();
                res.json({ success: true, message: 'Daily close executed successfully' });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });

        // API endpoint: manually trigger sentinel check (for testing)
        this.router.post('/trigger/ads-sentinel', async (_req, res) => {
            try {
                logger.info('Manual ads sentinel triggered via API');
                await this.schedulerService.runAdsSentinel();
                res.json({ success: true, message: 'Ads sentinel check executed successfully' });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });

        // API endpoint: get scheduler status
        this.router.get('/status', (_req, res) => {
            res.json({
                enabled: this.schedulerService.getConfig().enabled,
                running: this.schedulerService.isRunning(),
                config: this.schedulerService.getConfig(),
            });
        });

        logger.info('Scheduler module initialized');
    }

    async start(): Promise<void> {
        // Start cron jobs
        this.schedulerService.start();
        logger.info('Scheduler module started');
    }

    async stop(): Promise<void> {
        this.schedulerService.stop();
        logger.info('Scheduler module stopped');
    }

    async getHealth(): Promise<IModuleHealth> {
        try {
            return {
                status: 'healthy',
                details: {
                    scheduler: {
                        status: this.schedulerService.isRunning() ? 'up' : 'down',
                        message: this.schedulerService.isRunning()
                            ? 'Scheduler running with cron jobs active'
                            : 'Scheduler not running (SCHEDULER_ENABLED=false or not started)',
                    },
                },
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    scheduler: {
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
