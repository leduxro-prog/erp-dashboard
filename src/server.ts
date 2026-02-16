import compression from 'compression';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import http from 'http';
import path from 'path';
import { AppDataSource } from './data-source';
import { validateEnv, ConfigSchema } from './config/env.validation';
import {
  globalApiLimiter,
  b2bApiLimiter,
  loginLimiter,
  authLimiter,
  writeOperationLimiter,
} from '../shared/middleware/rate-limit.middleware';
import logger, { createModuleLogger } from '../shared/utils/logger';
import { getEventBus } from '../shared/utils/event-bus';
import { createRequestIdMiddleware } from '../shared/middleware/request-id.middleware';
import { createAuditMiddleware } from '../shared/middleware/audit-trail.middleware';
import { createCSRFMiddleware } from '../shared/middleware/csrf.middleware';
import { tracingMiddleware } from '../shared/middleware/tracing.middleware';
import { sanitizeMiddleware } from '../shared/middleware/sanitize.middleware';
import { createAuditLogger } from '../shared/utils/audit-logger';
import { registerApiDocsRoutes } from './api-docs/routes';
import { registerHealthRoutes } from '../shared/middleware/health.middleware';
import { ModuleRegistry, ModuleLoader, IModuleContext } from '../shared/module-system';
import { createMetricsMiddleware, createMetricsEndpoint } from '../shared/metrics';
import {
  formatPrometheusMetrics,
  collectPrometheusMetrics,
} from '../shared/metrics/prometheus-exporter';
import { UnifiedDlqService } from '../shared/services/UnifiedDlqService';
import { AuditLogService } from '../shared/services/AuditLogService';
import authRoutes from './routes/auth.routes';
import { authenticate, requireRole } from '../shared/middleware/auth.middleware';

dotenv.config();

const bootstrapLogger = createModuleLogger('bootstrap');

/**
 * Create module context with all dependencies.
 * Provided to modules during initialization.
 */
async function createModuleContext(
  dataSource: any,
  eventBus: any,
  config: ConfigSchema,
): Promise<IModuleContext> {
  // TODO: Implement CacheManager interface with multi-layer caching
  const cacheManager = {
    get: async (key: string) => null,
    set: async (key: string, value: unknown, ttl?: number) => {},
    del: async (key: string) => {},
    delPattern: async (pattern: string) => 0,
    flush: async () => {},
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
    set: async (featureName: string, enabled: boolean) => {},
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
    const configuredCorsOrigins = config.CORS_ORIGINS?.trim();

    const defaultOriginsByEnv =
      config.NODE_ENV === 'production'
        ? [
            process.env.FRONTEND_URL,
            process.env.PUBLIC_BASE_URL,
            'https://ledux.ro',
            'https://www.ledux.ro',
            'https://erp.ledux.ro',
            'https://api.ledux.ro',
          ]
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

    const allowedOrigins = Array.from(
      new Set(
        (configuredCorsOrigins
          ? configuredCorsOrigins.split(',')
          : defaultOriginsByEnv.filter((origin): origin is string => Boolean(origin))
        )
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    );

    if (config.NODE_ENV === 'production' && !configuredCorsOrigins) {
      bootstrapLogger.warn(
        'CORS_ORIGINS is not configured; using production-safe domain defaults.',
      );
    }

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
      }),
    );

    // Step 7: Configure standard middleware
    app.use(cors(corsOptions));
    app.use(cookieParser());
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
      }),
    );

    // Step 9: Request ID middleware (MUST BE FIRST in middleware chain for tracing)
    app.use(createRequestIdMiddleware());

    // Step 10: Distributed tracing middleware
    app.use(tracingMiddleware);

    // Step 11: Input sanitization middleware (before routes)
    app.use(sanitizeMiddleware);

    // Step 12: Audit trail middleware (logs all requests)
    // Initialize database-backed audit log service and pass to middleware
    const auditLogger = createAuditLogger();
    const auditLogService = new AuditLogService(AppDataSource);
    app.use(createAuditMiddleware(auditLogger, auditLogService));

    // Step 13: CSRF protection middleware
    const csrfEnabled = config.NODE_ENV === 'production';
    app.use(
      createCSRFMiddleware({
        allowedOrigins,
        enabled: csrfEnabled,
      }),
    );

    // Step 14: Apply rate limiting
    app.use('/api', globalApiLimiter); // Global API rate limiter: 100 req / 15 min per IP

    // Step 14a: B2B Portal gets a higher rate limit (300 req / 15 min) for catalog browsing
    app.use('/api/v1/b2b', b2bApiLimiter);

    // Step 14b: Apply stricter rate limiting to auth endpoints
    app.use('/api/v1/users/login', loginLimiter); // Login: 5 attempts / 15 min per IP
    app.use('/api/v1/users/2fa', authLimiter); // 2FA endpoints: 10 attempts / 15 min
    app.use('/api/v1/orders', writeOperationLimiter); // Write ops: 30 / min
    app.use('/api/v1/settings', writeOperationLimiter); // Write ops: 30 / min

    // Step 14c: Metrics collection middleware
    app.use(createMetricsMiddleware());

    // Step 15: Health check endpoint
    const startTime = Date.now();
    registerHealthRoutes(app, startTime); // Root level
    registerHealthRoutes(app, startTime, config.API_PREFIX); // API prefix level

    app.get('/health', (_req: Request, res: Response): void => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
      });
    });

    app.get(`${config.API_PREFIX}/health`, (_req: Request, res: Response): void => {
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

    // Step 16b: Register auth routes (JWT refresh/logout with HttpOnly cookies)
    app.use(`${config.API_PREFIX}/auth`, authRoutes);
    bootstrapLogger.info('Auth routes registered (refresh, logout)');

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
    for (const [moduleName, module] of registry.getAllModules()) {
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
    app.get(`${apiPrefix}/system/modules`, authenticate, async (_req: Request, res: Response) => {
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
    app.get(`${apiPrefix}/system/metrics`, authenticate, (_req: Request, res: Response) => {
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
    app.use(`${apiPrefix}/system/metrics/detailed`, authenticate, createMetricsEndpoint());

    bootstrapLogger.info('System monitoring endpoints registered');
    bootstrapLogger.info(`Prometheus metrics available at /metrics`);
    bootstrapLogger.info(`Detailed metrics available at ${apiPrefix}/system/metrics/detailed`);

    // Step 21b: Admin DLQ (Dead Letter Queue) management endpoints
    // Unified replay/inspect for WooCommerce webhooks, SmartBill failures, and outbox events
    const dlqService = new UnifiedDlqService(AppDataSource);

    // GET /api/v1/admin/dlq/stats - DLQ statistics across all sources
    app.get(
      `${apiPrefix}/admin/dlq/stats`,
      authenticate,
      requireRole(['admin']),
      async (_req: Request, res: Response) => {
        try {
          const stats = await dlqService.getStats();
          res.status(200).json({ status: 'ok', data: stats });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to get DLQ stats',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    // GET /api/v1/admin/dlq/entries - List DLQ entries (query: source, limit, offset)
    app.get(
      `${apiPrefix}/admin/dlq/entries`,
      authenticate,
      requireRole(['admin']),
      async (req: Request, res: Response) => {
        try {
          const source = req.query.source as 'woocommerce' | 'smartbill' | 'outbox' | undefined;
          const limit = parseInt((req.query.limit as string) || '50', 10);
          const offset = parseInt((req.query.offset as string) || '0', 10);
          const entries = await dlqService.listEntries({ source, limit, offset });
          res
            .status(200)
            .json({ status: 'ok', data: entries, meta: { limit, offset, count: entries.length } });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to list DLQ entries',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    // POST /api/v1/admin/dlq/replay/:source/:id - Replay a single DLQ entry
    app.post(
      `${apiPrefix}/admin/dlq/replay/:source/:id`,
      authenticate,
      requireRole(['admin']),
      async (req: Request, res: Response) => {
        try {
          const { source, id } = req.params;
          let result;
          if (source === 'woocommerce') {
            result = await dlqService.replayWooWebhook(id);
          } else if (source === 'outbox') {
            result = await dlqService.replayOutboxEvent(id);
          } else {
            res.status(400).json({
              error: 'Invalid source',
              message: 'Source must be "woocommerce" or "outbox"',
            });
            return;
          }
          res.status(200).json({ status: 'ok', data: result });
        } catch (error) {
          res.status(500).json({
            error: 'Replay failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    // POST /api/v1/admin/dlq/replay-all/:source - Bulk replay all retryable entries for a source
    app.post(
      `${apiPrefix}/admin/dlq/replay-all/:source`,
      authenticate,
      requireRole(['admin']),
      async (req: Request, res: Response) => {
        try {
          const source = req.params.source as 'woocommerce' | 'outbox';
          if (source !== 'woocommerce' && source !== 'outbox') {
            res.status(400).json({
              error: 'Invalid source',
              message: 'Source must be "woocommerce" or "outbox"',
            });
            return;
          }
          const result = await dlqService.replayAll(source);
          res.status(200).json({ status: 'ok', data: result });
        } catch (error) {
          res.status(500).json({
            error: 'Bulk replay failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    bootstrapLogger.info(`Admin DLQ endpoints registered at ${apiPrefix}/admin/dlq/*`);

    // Step 21c: Audit Log API endpoints
    bootstrapLogger.info('Registering audit log endpoints...');

    // GET /api/v1/admin/audit-logs - Query audit logs with filters and pagination
    app.get(
      `${apiPrefix}/admin/audit-logs`,
      authenticate,
      requireRole(['admin']),
      async (req: Request, res: Response) => {
        try {
          const result = await auditLogService.query({
            userId: req.query.userId as string | undefined,
            userEmail: req.query.userEmail as string | undefined,
            action: req.query.action as string | undefined,
            resourceType: req.query.resourceType as string | undefined,
            resourceId: req.query.resourceId as string | undefined,
            startDate: req.query.startDate as string | undefined,
            endDate: req.query.endDate as string | undefined,
            search: req.query.search as string | undefined,
            page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 25,
            sortBy: (req.query.sortBy as string) || 'created_at',
            sortDir: (req.query.sortDir as 'ASC' | 'DESC') || 'DESC',
          });
          res.status(200).json({ status: 'ok', ...result });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to query audit logs',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    // GET /api/v1/admin/audit-logs/stats - Aggregated audit statistics
    app.get(
      `${apiPrefix}/admin/audit-logs/stats`,
      authenticate,
      requireRole(['admin']),
      async (_req: Request, res: Response) => {
        try {
          const stats = await auditLogService.getStats();
          res.status(200).json({ status: 'ok', data: stats });
        } catch (error) {
          res.status(500).json({
            error: 'Failed to get audit log stats',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    // GET /api/v1/admin/audit-logs/export - Export audit logs as CSV
    app.get(
      `${apiPrefix}/admin/audit-logs/export`,
      authenticate,
      requireRole(['admin']),
      async (req: Request, res: Response) => {
        try {
          const csv = await auditLogService.export({
            userId: req.query.userId as string | undefined,
            userEmail: req.query.userEmail as string | undefined,
            action: req.query.action as string | undefined,
            resourceType: req.query.resourceType as string | undefined,
            startDate: req.query.startDate as string | undefined,
            endDate: req.query.endDate as string | undefined,
            search: req.query.search as string | undefined,
          });
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
          res.status(200).send(csv);
        } catch (error) {
          res.status(500).json({
            error: 'Failed to export audit logs',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    bootstrapLogger.info(`Audit log endpoints registered at ${apiPrefix}/admin/audit-logs/*`);

    // Step 22: Global error handling middleware
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
      bootstrapLogger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
      });
      res.status(500).json({
        error: 'Internal Server Error',
        ...(config.NODE_ENV !== 'production' && { message: err.message }),
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
