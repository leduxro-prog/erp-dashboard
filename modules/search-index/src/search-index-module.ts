import { Router } from 'express';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '@shared/module-system/module.interface';

import { createImageSearchAdminRoutes } from './api/image-search-admin.routes';
import { ImageSearchAdminController } from './api/ImageSearchAdminController';
import { ImageSearchIndexer } from './services/ImageSearchIndexer';
import { ImageSearchIndexJob } from './jobs/ImageSearchIndexJob';

type ImageSearchJobRunner = {
  enqueueFullReindex(jobKey: string): Promise<void>;
  enqueueProductReindex(jobKey: string, productId: number): Promise<void>;
  close(): Promise<void>;
};

export default class SearchIndexModule implements ICypherModule {
  readonly name = 'search-index';
  readonly version = '1.0.0';
  readonly description = 'Image search indexing, admin health, and reindex controls';
  readonly dependencies: string[] = [];
  readonly publishedEvents = [];
  readonly subscribedEvents = [];
  readonly featureFlag: string | undefined = undefined;

  private context!: IModuleContext;
  private router!: Router;
  private started = false;
  private jobRunner!: ImageSearchJobRunner;

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;

    const source = {
      fetchActiveAssetsBatch: async () => ({ items: [], nextCursor: null }),
      fetchAssetsForProduct: async () => [],
    };
    const embedder = {
      embedFromUrl: async () => {
        throw new Error('Image embedding integration pending');
      },
    };
    const writer = {
      upsertPoints: async () => undefined,
    };
    const failures = {
      recordFailure: async () => undefined,
    };

    const indexer = new ImageSearchIndexer({
      source,
      embedder,
      writer,
      failures,
      indexVersion: process.env['IMAGE_SEARCH_INDEX_VERSION'] || 'v1',
      modelVersion: process.env['IMAGE_EMBEDDING_MODEL_VERSION'] || 'siglip-lite-v1',
    });

    const redisConnection = this.context.eventBus.client;
    if (redisConnection) {
      this.jobRunner = new ImageSearchIndexJob(redisConnection, indexer);
    } else {
      this.jobRunner = {
        enqueueFullReindex: async () => {
          throw new Error('Image search queue is unavailable: Redis connection not initialized');
        },
        enqueueProductReindex: async () => {
          throw new Error('Image search queue is unavailable: Redis connection not initialized');
        },
        close: async () => undefined,
      };
    }

    const auditRepo = {
      createRun: async ({ id }: { id: string }) => ({ id }),
    };

    const healthProvider = {
      getHealth: async () => ({
        qdrant: {
          ok: await this.pingUrl(process.env['QDRANT_URL'] || 'http://localhost:6333/collections'),
        },
        embedding: {
          ok: await this.pingUrl(process.env['IMAGE_EMBEDDING_URL'] || 'http://localhost:8002/health'),
        },
        queue: {
          pending: 0,
          failed: redisConnection ? 0 : 1,
        },
      }),
    };

    const controller = new ImageSearchAdminController(this.jobRunner, auditRepo, healthProvider);
    this.router = Router();
    this.router.use('/admin/image-search', createImageSearchAdminRoutes(controller));
  }

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
    if (this.jobRunner) {
      await this.jobRunner.close();
    }
  }

  async getHealth(): Promise<IModuleHealth> {
    return {
      status: this.started ? 'healthy' : 'unhealthy',
      details: {
        module: { status: this.started ? 'up' : 'down' },
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
      activeWorkers: this.started ? 1 : 0,
      cacheHitRate: 0,
      eventCount: { published: 0, received: 0 },
    };
  }

  private async pingUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export { SearchIndexModule };
