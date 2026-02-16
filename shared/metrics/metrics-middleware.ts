/**
 * Metrics Collection Middleware
 * Tracks HTTP request metrics per route: count, duration, status code
 * No external dependencies - uses in-memory collection
 */

import { Request, Response, NextFunction, Express } from 'express';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('metrics-middleware');

/**
 * Per-route metrics collection
 */
export interface RouteMetrics {
  method: string;
  path: string;
  requestCount: number;
  errorCount: number;
  statusCodes: Map<number, number>;
  responseTimes: number[];
  lastUpdated: Date;
}

/**
 * Aggregated metrics
 */
export interface AggregateMetrics {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  routes: Map<string, RouteMetrics>;
  collectedAt: Date;
}

/**
 * Global metrics collector for routes
 */
class MetricsCollector {
  private routes: Map<string, RouteMetrics> = new Map();
  private maxSamplesPerRoute = 1000;
  private totalRequests = 0;
  private totalErrors = 0;
  private startTime = Date.now();

  /**
   * Record a request
   */
  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const routeKey = `${method}:${path}`;
    let route = this.routes.get(routeKey);

    if (!route) {
      route = {
        method,
        path,
        requestCount: 0,
        errorCount: 0,
        statusCodes: new Map(),
        responseTimes: [],
        lastUpdated: new Date(),
      };
      this.routes.set(routeKey, route);
    }

    route.requestCount++;
    route.lastUpdated = new Date();

    // Track status codes
    route.statusCodes.set(statusCode, (route.statusCodes.get(statusCode) ?? 0) + 1);

    // Record duration
    route.responseTimes.push(durationMs);

    // Keep only last N samples for memory efficiency
    if (route.responseTimes.length > this.maxSamplesPerRoute) {
      route.responseTimes.shift();
    }

    // Track errors
    if (statusCode >= 400) {
      route.errorCount++;
      this.totalErrors++;
    }

    this.totalRequests++;
  }

  /**
   * Get metrics for a specific route
   */
  getRouteMetrics(routeKey: string): RouteMetrics | undefined {
    return this.routes.get(routeKey);
  }

  /**
   * Get all route metrics
   */
  getAllRouteMetrics(): Map<string, RouteMetrics> {
    return this.routes;
  }

  /**
   * Calculate percentile for response times
   */
  calculatePercentile(times: number[], percentile: number): number {
    if (times.length === 0) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get percentile stats for a route
   */
  getPercentileStats(routeKey: string): { p50: number; p90: number; p95: number; p99: number } {
    const route = this.routes.get(routeKey);
    if (!route || route.responseTimes.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    return {
      p50: this.calculatePercentile(route.responseTimes, 50),
      p90: this.calculatePercentile(route.responseTimes, 90),
      p95: this.calculatePercentile(route.responseTimes, 95),
      p99: this.calculatePercentile(route.responseTimes, 99),
    };
  }

  /**
   * Get aggregated metrics
   */
  getAggregateMetrics(): AggregateMetrics {
    let totalResponseTime = 0;
    let allResponseTimes = 0;

    for (const route of this.routes.values()) {
      totalResponseTime += route.responseTimes.reduce((a, b) => a + b, 0);
      allResponseTimes += route.responseTimes.length;
    }

    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      averageResponseTime: allResponseTimes > 0 ? totalResponseTime / allResponseTimes : 0,
      routes: this.routes,
      collectedAt: new Date(),
    };
  }

  /**
   * Get top slowest routes
   */
  getSlowRoutes(limit: number = 10): Array<{
    route: string;
    p99: number;
    requestCount: number;
  }> {
    return Array.from(this.routes.entries())
      .map(([route, metrics]) => ({
        route,
        p99: this.calculatePercentile(metrics.responseTimes, 99),
        requestCount: metrics.requestCount,
      }))
      .sort((a, b) => b.p99 - a.p99)
      .slice(0, limit);
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.routes.clear();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.startTime = Date.now();
    logger.info('Metrics collector reset');
  }
}

// Global collector instance
const metricsCollector = new MetricsCollector();

/**
 * Create metrics middleware
 * Must be added to Express app early in middleware chain
 */
export function createMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Capture the original send function
    const originalSend = res.send;

    // Override send to record metrics
    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Normalize path to remove IDs (for better metric aggregation)
      const normalizedPath = normalizePath(req.path);

      metricsCollector.recordRequest(req.method, normalizedPath, statusCode, duration);

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Normalize path by replacing numeric IDs with :id
 * /orders/123/items/456 -> /orders/:id/items/:id
 */
function normalizePath(path: string): string {
  return path.replace(/\/\d+/g, '/:id');
}

/**
 * Get metrics endpoint handler
 */
export function createMetricsEndpoint() {
  return (req: Request, res: Response): void => {
    const metrics = metricsCollector.getAggregateMetrics();
    const slowRoutes = metricsCollector.getSlowRoutes(10);

    // Format route metrics
    const routeMetrics: Record<string, any> = {};
    for (const [routeKey, route] of metricsCollector.getAllRouteMetrics()) {
      const percentiles = metricsCollector.getPercentileStats(routeKey);
      routeMetrics[routeKey] = {
        method: route.method,
        path: route.path,
        requestCount: route.requestCount,
        errorCount: route.errorCount,
        errorRate: route.requestCount > 0 ? (route.errorCount / route.requestCount) * 100 : 0,
        statusCodes: Object.fromEntries(route.statusCodes),
        responseTime: {
          avg: route.responseTimes.length > 0
            ? route.responseTimes.reduce((a, b) => a + b, 0) / route.responseTimes.length
            : 0,
          ...percentiles,
        },
      };
    }

    res.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: metrics.totalRequests,
        totalErrors: metrics.totalErrors,
        errorRate: metrics.totalRequests > 0 ? (metrics.totalErrors / metrics.totalRequests) * 100 : 0,
        averageResponseTime: metrics.averageResponseTime,
      },
      routes: routeMetrics,
      slowestRoutes: slowRoutes,
    });
  };
}

/**
 * Get metrics for testing/debugging
 */
export function getMetricsCollector(): MetricsCollector {
  return metricsCollector;
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics(): void {
  metricsCollector.reset();
}

/**
 * Export metrics helper functions
 */
export const metricsMiddlewareUtils = {
  recordRequest: (method: string, path: string, statusCode: number, durationMs: number) =>
    metricsCollector.recordRequest(method, path, statusCode, durationMs),
  getMetrics: () => metricsCollector.getAggregateMetrics(),
  getRouteMetrics: (routeKey: string) => metricsCollector.getRouteMetrics(routeKey),
  getSlowRoutes: (limit?: number) => metricsCollector.getSlowRoutes(limit),
  reset: () => metricsCollector.reset(),
};
