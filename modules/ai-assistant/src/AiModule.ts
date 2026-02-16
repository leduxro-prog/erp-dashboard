import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '../../../shared/module-system/module.interface';
import { createModuleLogger } from '../../../shared/utils/logger';
import { AiController } from './AiController';
import { AiService } from './AiService';

export class AiModule implements ICypherModule {
  public readonly name = 'ai-assistant';
  public readonly version = '1.0.0';
  public readonly description = 'AI Assistant and Strategic Analysis Module';
  public readonly dependencies = [];
  public readonly publishedEvents = [];
  public readonly subscribedEvents = [];

  private router: Router;
  private logger = createModuleLogger('ai-assistant');
  private aiService: AiService | null = null;
  private aiController!: AiController;

  constructor() {
    this.router = Router();
  }

  async initialize(context: IModuleContext): Promise<void> {
    this.logger.info('Initializing AiModule...');

    const apiKey = context.config['GEMINI_API_KEY'];
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is missing. AI features will be disabled.');
    } else {
      this.aiService = new AiService(apiKey);
    }

    this.aiController = new AiController(this.aiService);

    // Initialize Router
    this.router = this.aiController.getRouter();

    this.logger.info('AiModule initialized.');
  }

  async start(): Promise<void> {
    this.logger.info('AiModule started.');
  }

  async stop(): Promise<void> {
    this.logger.info('AiModule stopped.');
  }

  getRouter(): Router {
    return this.router;
  }

  async getHealth(): Promise<IModuleHealth> {
    return {
      status: 'healthy',
      details: {
        ai: {
          status: this.aiService ? 'up' : 'down',
          message: this.aiService
            ? 'AI service initialized'
            : 'AI service disabled due to missing API key',
        },
      },
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
      eventCount: {
        published: 0,
        received: 0,
      },
    };
  }
}
