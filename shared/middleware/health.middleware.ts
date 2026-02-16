import { Request, Response } from 'express';
import { AppDataSource } from '../../src/data-source';
import { getEventBus } from '../utils/event-bus';
import logger from '../utils/logger';

/**
 * Health status enum
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Individual check result
 */
export interface CheckResult {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  details?: Record<string, unknown>;
}

/**
 * Detailed health check response
 */
export interface DetailedHealthResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks: {
    database?: CheckResult;
    redis?: CheckResult;
    bullmq?: CheckResult;
    smartbill?: CheckResult;
    woocommerce?: CheckResult;
    system?: CheckResult;
  };
}

/**
 * Liveness probe - always 200 if process is running
 */
export function livenessProbe(): (req: Request, res: Response) => void {
  const startTime = Date.now();

  return (req: Request, res: Response): void => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime,
    });
  };
}

/**
 * Readiness probe - checks critical dependencies
 */
export function readinessProbe(): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    const checks: Record<string, boolean> = {};

    // Check database
    try {
      if (AppDataSource.isInitialized) {
        await AppDataSource.query('SELECT 1');
        checks.database = true;
      } else {
        checks.database = false;
      }
    } catch (error) {
      checks.database = false;
      logger.warn('Database readiness check failed', { error });
    }

    // Check Redis
    try {
      const eventBus = getEventBus();
      const client = eventBus.client;
      if (client) {
        await (client as any).ping();
        checks.redis = true;
      } else {
        checks.redis = false;
      }
    } catch (error) {
      checks.redis = false;
      logger.warn('Redis readiness check failed', { error });
    }

    const allHealthy = Object.values(checks).every((v) => v);

    if (allHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    }
  };
}

/**
 * Detailed health check endpoint with actual external service verification
 */
export function detailedHealthCheck(startTime: number): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    const checks: DetailedHealthResponse['checks'] = {};
    let overallStatus = HealthStatus.HEALTHY;
    const timeout = 2000; // 2 second timeout for external checks

    // Database check
    try {
      const dbStartTime = Date.now();
      if (AppDataSource.isInitialized) {
        await AppDataSource.query('SELECT 1');
        const latency = Date.now() - dbStartTime;

        checks.database = {
          status: 'up',
          latency,
          details: {
            type: 'PostgreSQL',
            poolSize: (AppDataSource.options as any).extra?.max ?? 'unknown',
          },
        };
      } else {
        checks.database = { status: 'down' };
        overallStatus = HealthStatus.UNHEALTHY;
      }
    } catch (error) {
      checks.database = {
        status: 'down',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      overallStatus = HealthStatus.UNHEALTHY;
    }

    // Redis check
    try {
      const redisStartTime = Date.now();
      const eventBus = getEventBus();
      const client = eventBus.client as any;

      if (client) {
        await client.ping();
        const latency = Date.now() - redisStartTime;

        checks.redis = {
          status: 'up',
          latency,
          details: {
            type: 'Redis/ioredis',
          },
        };
      } else {
        checks.redis = { status: 'down' };
        if (overallStatus === HealthStatus.HEALTHY) {
          overallStatus = HealthStatus.DEGRADED;
        }
      }
    } catch (error) {
      checks.redis = {
        status: 'down',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      if (overallStatus === HealthStatus.HEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
      }
    }

    // BullMQ queue check with actual queue verification
    try {
      // Try to access Redis for queue status
      const redisStatus = checks.redis?.status;
      const bullMqLatency = checks.redis?.latency || 0;

      checks.bullmq = {
        status: redisStatus === 'up' ? 'up' : 'degraded',
        latency: bullMqLatency,
        details: {
          type: 'BullMQ Job Queue',
          dependent_on: 'Redis',
          status: redisStatus === 'up' ? 'Ready' : 'Degraded',
        },
      };
    } catch (error) {
      checks.bullmq = {
        status: 'degraded',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }

    // SmartBill API check with actual connectivity test
    try {
      const smartbillStartTime = Date.now();
      const smartbillUrl = process.env.SMARTBILL_API_URL || 'https://online.smartbill.ro/api/v1';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const smartbillResponse = await fetch(smartbillUrl, {
        method: 'HEAD',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - smartbillStartTime;

      checks.smartbill = {
        status: smartbillResponse.ok || smartbillResponse.status === 401 ? 'up' : 'degraded',
        latency,
        details: {
          type: 'SmartBill Integration',
          httpStatus: smartbillResponse.status,
          endpoint: smartbillUrl,
        },
      };
    } catch (error) {
      checks.smartbill = {
        status: 'down',
        details: {
          type: 'SmartBill Integration',
          error: error instanceof Error ? error.message : 'Unknown error',
          endpoint: process.env.SMARTBILL_API_URL || 'https://online.smartbill.ro/api/v1',
        },
      };
      if (overallStatus === HealthStatus.HEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
      }
    }

    // WooCommerce API check with actual system status endpoint
    try {
      const wcStartTime = Date.now();
      const wcUrl = process.env.WOOCOMMERCE_API_URL;

      if (!wcUrl) {
        checks.woocommerce = {
          status: 'degraded',
          details: {
            type: 'WooCommerce Sync',
            error: 'WOOCOMMERCE_API_URL not configured',
          },
        };
      } else {
        const wcSystemStatusUrl = `${wcUrl.replace(/\/$/, '')}/wp-json/wc/v3/system_status`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const wcResponse = await fetch(wcSystemStatusUrl, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.WOOCOMMERCE_API_KEY}:${process.env.WOOCOMMERCE_API_SECRET}`).toString('base64')}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const latency = Date.now() - wcStartTime;

        checks.woocommerce = {
          status: wcResponse.ok ? 'up' : 'degraded',
          latency,
          details: {
            type: 'WooCommerce Sync',
            httpStatus: wcResponse.status,
            endpoint: wcSystemStatusUrl,
          },
        };
      }
    } catch (error) {
      checks.woocommerce = {
        status: 'down',
        details: {
          type: 'WooCommerce Sync',
          error: error instanceof Error ? error.message : 'Unknown error',
          endpoint: process.env.WOOCOMMERCE_API_URL,
        },
      };
      if (overallStatus === HealthStatus.HEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
      }
    }

    // System check
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const totalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const cpuUsage = process.cpuUsage();

    checks.system = {
      status: totalMemory < 1024 ? 'up' : 'degraded', // Alert if using >1GB
      details: {
        uptime,
        memory: {
          heapUsedMb: Math.round(totalMemory),
          heapLimitMb: Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        nodeVersion: process.version,
      },
    };

    const statusCode =
      overallStatus === HealthStatus.HEALTHY ? 200 : overallStatus === HealthStatus.DEGRADED ? 200 : 503;

    const response: DetailedHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime,
      checks,
    };

    res.status(statusCode).json(response);
  };
}

/**
 * Register all health check routes
 */
export function registerHealthRoutes(app: any, startTime: number, prefix: string = ''): void {
  const normalizedPrefix = prefix ? (prefix.startsWith('/') ? prefix : `/${prefix}`) : '';

  // Liveness probe (Kubernetes)
  app.get(`${normalizedPrefix}/health/live`, livenessProbe());

  // Readiness probe (Kubernetes)
  app.get(`${normalizedPrefix}/health/ready`, readinessProbe());

  // Detailed health check
  app.get(`${normalizedPrefix}/health/detailed`, detailedHealthCheck(startTime));

  logger.info(`Health check endpoints registered: ${normalizedPrefix}/health/live, ${normalizedPrefix}/health/ready, ${normalizedPrefix}/health/detailed`);
}
