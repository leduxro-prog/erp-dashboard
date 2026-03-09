import compression from 'compression';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import path from 'path';
import { AppDataSource } from './data-source';
import { validateEnv, ConfigSchema } from './config/env.validation';
import { rateLimiter, authRateLimiter } from './middleware/rate-limiter';
import logger, { createModuleLogger } from '../shared/utils/logger';
import { getEventBus } from '../shared/utils/event-bus';
import { createRequestIdMiddleware } from '../shared/middleware/request-id.middleware';
import { createAuditMiddleware } from '../shared/middleware/audit-trail.middleware';
import { createCSRFMiddleware } from '../shared/middleware/csrf.middleware';
import { tracingMiddleware } from '../shared/middleware/tracing.middleware';
import { sanitizeMiddleware } from '../shared/middleware/sanitize.middleware';
import { createAuditLogger } from '../shared/utils/audit-logger';
import { registerApiDocsRoutes } from './api-docs/routes';
import { ModuleRegistry, ModuleLoader, IModuleContext } from '../shared/module-system';
import { createMetricsMiddleware, createMetricsEndpoint } from '../shared/metrics';
import { formatPrometheusMetrics, collectPrometheusMetrics } from '../shared/metrics/prometheus-exporter';
import { createWebsiteSyncRouter } from './routes/website-sync.routes';

dotenv.config();

const bootstrapLogger = createModuleLogger('bootstrap');

/**
 * Create module context with all dependencies.
 * Provided to modules during initialization.
 */
async function createModuleContext(
  dataSource: any,
  eventBus: any,
  config: ConfigSchema
): Promise<IModuleContext> {
  // TODO: Implement CacheManager interface with multi-layer caching
  const cacheManager = {
    get: async (key: string) => null,
    set: async (key: string, value: unknown, ttl?: number) => { },
    del: async (key: string) => { },
    delPattern: async (pattern: string) => 0,
    flush: async () => { },
    getStats: async () => ({ hitRate: 0, size: 0, keys: 0 }),
  };

  // TODO: Implement ApiClientFactory interface
  const apiClientFactory = {
    createHttpClient: async (baseUrl: string, options?: any) => ({}),
    getServiceClient: async (serviceName: string) => ({}),
  };

  // TODO: Implement IFeatureFlagService interface
  const featureFlags = {
    isEnabled: (featureName: string): boolean => {
      // Read from environment or database
      const envValue = process.env[`FEATURE_FLAG_${featureName.toUpperCase()}`];
      return envValue === 'true' || envValue === '1';
    },
    getAll: () => ({}),
    set: async (featureName: string, enabled: boolean) => { },
  };

  return {
    dataSource,
    eventBus,
    cacheManager,
    logger,
    config: process.env as Record<string, string>,
    apiClientFactory,
    featureFlags,
  };
}

/**
 * Load and register all modules.
 */
async function loadAndRegisterModules(): Promise<void> {
  bootstrapLogger.info('Loading modules...');

  const modulesPath = path.join(__dirname, '..', 'modules');
  const loader = new ModuleLoader();
  const modules = await loader.loadModules(modulesPath);

  const registry = ModuleRegistry.getInstance();
  for (const module of modules) {
    registry.register(module);
  }

  bootstrapLogger.info(`Registered ${modules.length} modules`);
}

/**
 * Bootstrap the application with module system
 */
async function bootstrap(): Promise<void> {
  try {
    // Step 1: Validate environment variables
    bootstrapLogger.info('Validating environment variables...');
    const config = validateEnv();
    bootstrapLogger.info('Environment variables validated successfully');

    // Step 2: Create Express application
    const app: Express = express();

    // Step 3: Initialize TypeORM DataSource
    bootstrapLogger.info('Initializing database connection...');
    await AppDataSource.initialize();
    bootstrapLogger.info('Database connection established');

    // Step 4: Initialize event bus
    bootstrapLogger.info('Initializing event bus...');
    const eventBus = getEventBus();
    // Note: EventBus automatically connects on first subscribe/publish - no need to call connect()
    bootstrapLogger.info('Event bus initialized');

    // Step 5: Configure CORS
    const corsOrigins = config.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001';
    const allowedOrigins = corsOrigins.split(',').map((origin) => origin.trim());

    const corsOptions: CorsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl requests, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400, // 24 hours preflight cache
    };

    // Step 6: Configure security middleware (helmet)
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        noSniff: true,
        xssFilter: true,
        permittedCrossDomainPolicies: {
          permittedPolicies: 'none',
        },
        frameguard: {
          action: 'deny',
        },
      })
    );

    // Step 7: Configure standard middleware
    app.use(cors(corsOptions));
    app.use(compression());
    app.disable('x-powered-by'); // Disable X-Powered-By header
    app.use(morgan('combined'));

    // Step 8: Request body size limits
    // General API requests limited to 10KB
    app.use(express.json({ limit: '10kb' }));
    app.use(
      express.urlencoded({
        extended: true,
        limit: '10kb',
        parameterLimit: 50,
      })
    );

    // Step 9: Request ID middleware (MUST BE FIRST in middleware chain for tracing)
    app.use(createRequestIdMiddleware());

    // Step 10: Distributed tracing middleware
    app.use(tracingMiddleware);

    // Step 11: Input sanitization middleware (before routes)
    app.use(sanitizeMiddleware);

    // Step 12: Audit trail middleware (logs all requests)
    const auditLogger = createAuditLogger();
    app.use(createAuditMiddleware(auditLogger));

    // Step 13: CSRF protection middleware
    const csrfEnabled = config.NODE_ENV === 'production';
    app.use(
      createCSRFMiddleware({
        allowedOrigins,
        enabled: csrfEnabled,
      })
    );

    // Step 14: Apply rate limiting
    app.use(rateLimiter); // General API rate limiter

    // Step 14b: Apply stricter rate limiting to auth endpoints
    app.use('/auth', authRateLimiter);

    // Step 14c: Metrics collection middleware
    app.use(createMetricsMiddleware());

    // Step 15: Health check endpoint
    app.get('/health', (_req: Request, res: Response): void => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
      });
    });

    // Step 16: Register API documentation routes
    bootstrapLogger.info('Registering API documentation routes...');
    registerApiDocsRoutes(app);
    bootstrapLogger.info('API documentation routes registered');

    // Step 16a: Register website sync routes protected by service token auth
    app.use(config.API_PREFIX, createWebsiteSyncRouter(AppDataSource, process.env));
    bootstrapLogger.info('Website sync routes registered');

    // Step 17: Load and register modules
    await loadAndRegisterModules();

    // Step 18: Create module context and initialize modules
    bootstrapLogger.info('Initializing modules...');
    const moduleContext = await createModuleContext(AppDataSource, eventBus, config);
    const registry = ModuleRegistry.getInstance();
    await registry.initializeAll(moduleContext);
    bootstrapLogger.info('Modules initialized successfully');

    // Step 19: Start modules
    bootstrapLogger.info('Starting modules...');
    await registry.startAll();
    bootstrapLogger.info('Modules started successfully');

    // Step 20: Mount module routers
    bootstrapLogger.info('Mounting module routers...');
    const apiPrefix = config.API_PREFIX;
    for (const [moduleName, module] of registry.getStartedModules()) {
      try {
        const router = module.getRouter();
        const mountPath = `${apiPrefix}/${moduleName}`;
        app.use(mountPath, router);
        bootstrapLogger.info(`Module router mounted: ${moduleName} at ${mountPath}`);
      } catch (error) {
        bootstrapLogger.warn(`Failed to mount router for module ${moduleName}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    bootstrapLogger.info('All module routers mounted');

    // Step 21: System monitoring endpoints
    bootstrapLogger.info('Registering system monitoring endpoints...');

    // GET /api/v1/system/modules - List all loaded modules with health
    app.get(`${apiPrefix}/system/modules`, async (_req: Request, res: Response) => {
      try {
        const health = await registry.getHealth();
        const modules = registry.getAllModules();

        const modulesList = Array.from(modules.values()).map((m) => ({
          name: m.name,
          version: m.version,
          description: m.description,
          dependencies: m.dependencies,
          publishedEvents: m.publishedEvents,
          subscribedEvents: m.subscribedEvents,
          featureFlag: m.featureFlag,
          health: health.modules[m.name],
        }));

        res.status(200).json({
          status: health.status,
          modules: modulesList,
          checkedAt: health.checkedAt,
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get module information',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // GET /api/v1/system/metrics - System metrics (JSON format)
    app.get(`${apiPrefix}/system/metrics`, (_req: Request, res: Response) => {
      try {
        const metrics = registry.getMetrics();
        res.status(200).json(metrics);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get system metrics',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // GET /metrics - Prometheus text format endpoint
    app.get('/metrics', (_req: Request, res: Response) => {
      try {
        const modules = registry.getAllModules();
        const prometheusLines = collectPrometheusMetrics(modules);
        const prometheusText = formatPrometheusMetrics(prometheusLines);

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.status(200).send(prometheusText);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get Prometheus metrics',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // GET /api/v1/system/metrics/detailed - Detailed route-level metrics
    app.use(`${apiPrefix}/system/metrics/detailed`, createMetricsEndpoint());

    bootstrapLogger.info('System monitoring endpoints registered');
    bootstrapLogger.info(`Prometheus metrics available at /metrics`);
    bootstrapLogger.info(`Detailed metrics available at ${apiPrefix}/system/metrics/detailed`);

    // Step 22: Global error handling middleware
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
      bootstrapLogger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });

    // Step 23: 404 handler
    app.use((_req: Request, res: Response): void => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
      });
    });

    // Step 24: Create and start HTTP server
    const PORT = config.PORT;
    const server = http.createServer(app);

    server.listen(PORT, (): void => {
      bootstrapLogger.info('Server started successfully', {
        port: PORT,
        environment: config.NODE_ENV,
        apiPrefix: apiPrefix,
      });
    });

    // Step 25: Graceful shutdown handling
    const gracefulShutdown = async (signal: string): Promise<void> => {
      bootstrapLogger.info(`Received ${signal}, starting graceful shutdown...`);

      // Close HTTP server
      server.close(async () => {
        bootstrapLogger.info('HTTP server closed');

        try {
          // Stop all modules
          const registry = ModuleRegistry.getInstance();
          await registry.stopAll();
          bootstrapLogger.info('All modules stopped');

          // Close database connection
          if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            bootstrapLogger.info('Database connection closed');
          }

          // Disconnect EventBus/Redis
          const eventBus = getEventBus();
          await eventBus.disconnect?.();
          bootstrapLogger.info('EventBus disconnected');

          bootstrapLogger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          bootstrapLogger.error('Error during graceful shutdown', {
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        bootstrapLogger.error('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 30000);
    };

    // Handle SIGTERM and SIGINT
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      bootstrapLogger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      bootstrapLogger.error('Unhandled rejection', {
        reason: String(reason),
        promise: String(promise),
      });
    });
  } catch (error) {
    bootstrapLogger.error('Failed to bootstrap application', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the application
bootstrap();

export default bootstrap;
