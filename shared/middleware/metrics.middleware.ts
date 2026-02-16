import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Metrics for HTTP requests and system health
 */
export interface MetricsCollector {
  httpRequestsTotal: Map<string, number>;
  httpRequestDuration: Map<string, number[]>;
  activeConnections: number;
  errorsByType: Map<string, number>;
  queueDepth: Map<string, number>;
}

/**
 * Latency percentile statistics
 */
export interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Metrics summary for export
 */
export interface MetricsSummary {
  timestamp: string;
  httpRequests: {
    total: number;
    byEndpoint: Record<string, number>;
  };
  latency: {
    byEndpoint: Record<string, LatencyStats>;
    overall: LatencyStats;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  throughput: {
    requestsPerSecond: number;
  };
  activeConnections: number;
  queueDepth: Record<string, number>;
  topSlowEndpoints: Array<{ endpoint: string; p99: number }>;
}

/**
 * Global metrics collector - thread-safe with simple locks
 */
class GlobalMetricsCollector implements MetricsCollector {
  httpRequestsTotal: Map<string, number> = new Map();
  httpRequestDuration: Map<string, number[]> = new Map();
  activeConnections: number = 0;
  errorsByType: Map<string, number> = new Map();
  queueDepth: Map<string, number> = new Map();

  private startTime = Date.now();
  private requestCount = 0;

  /**
   * Record a request
   */
  recordRequest(key: string, durationMs: number, isError: boolean = false): void {
    // Update total count
    this.httpRequestsTotal.set(key, (this.httpRequestsTotal.get(key) ?? 0) + 1);

    // Record duration
    if (!this.httpRequestDuration.has(key)) {
      this.httpRequestDuration.set(key, []);
    }
    this.httpRequestDuration.get(key)!.push(durationMs);

    // Keep only last 1000 duration samples per endpoint for memory efficiency
    const durations = this.httpRequestDuration.get(key)!;
    if (durations.length > 1000) {
      durations.shift();
    }

    this.requestCount++;

    if (isError) {
      this.errorsByType.set('http_error', (this.errorsByType.get('http_error') ?? 0) + 1);
    }
  }

  /**
   * Record an error
   */
  recordError(errorCode: string): void {
    this.errorsByType.set(errorCode, (this.errorsByType.get(errorCode) ?? 0) + 1);
  }

  /**
   * Update active connections
   */
  setActiveConnections(count: number): void {
    this.activeConnections = count;
  }

  /**
   * Update queue depth
   */
  setQueueDepth(queueName: string, depth: number): void {
    this.queueDepth.set(queueName, depth);
  }

  /**
   * Calculate percentile for an array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get latency stats for an endpoint
   */
  getLatencyStats(endpoint: string): LatencyStats {
    const durations = this.httpRequestDuration.get(endpoint) ?? [];
    return {
      p50: this.calculatePercentile(durations, 50),
      p95: this.calculatePercentile(durations, 95),
      p99: this.calculatePercentile(durations, 99),
    };
  }

  /**
   * Get overall latency stats
   */
  getOverallLatencyStats(): LatencyStats {
    const allDurations: number[] = [];
    this.httpRequestDuration.forEach((durations) => {
      allDurations.push(...durations);
    });
    return {
      p50: this.calculatePercentile(allDurations, 50),
      p95: this.calculatePercentile(allDurations, 95),
      p99: this.calculatePercentile(allDurations, 99),
    };
  }

  /**
   * Get requests per second
   */
  getRequestsPerSecond(): number {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    return this.requestCount / Math.max(1, elapsedSeconds);
  }

  /**
   * Get top 10 slowest endpoints by p99 latency
   */
  getTopSlowEndpoints(limit: number = 10): Array<{ endpoint: string; p99: number }> {
    return Array.from(this.httpRequestDuration.entries())
      .map(([endpoint, _]) => ({
        endpoint,
        p99: this.getLatencyStats(endpoint).p99,
      }))
      .sort((a, b) => b.p99 - a.p99)
      .slice(0, limit);
  }

  /**
   * Get metrics summary
   */
  getSummary(): MetricsSummary {
    const httpRequestsByEndpoint: Record<string, number> = {};
    const latencyByEndpoint: Record<string, LatencyStats> = {};

    this.httpRequestsTotal.forEach((count, endpoint) => {
      httpRequestsByEndpoint[endpoint] = count;
      latencyByEndpoint[endpoint] = this.getLatencyStats(endpoint);
    });

    const errorsByTypeObj: Record<string, number> = {};
    this.errorsByType.forEach((count, errorType) => {
      errorsByTypeObj[errorType] = count;
    });

    const queueDepthObj: Record<string, number> = {};
    this.queueDepth.forEach((depth, queueName) => {
      queueDepthObj[queueName] = depth;
    });

    const totalErrors = Array.from(this.errorsByType.values()).reduce((a, b) => a + b, 0);

    return {
      timestamp: new Date().toISOString(),
      httpRequests: {
        total: this.requestCount,
        byEndpoint: httpRequestsByEndpoint,
      },
      latency: {
        byEndpoint: latencyByEndpoint,
        overall: this.getOverallLatencyStats(),
      },
      errors: {
        total: totalErrors,
        byType: errorsByTypeObj,
      },
      throughput: {
        requestsPerSecond: this.getRequestsPerSecond(),
      },
      activeConnections: this.activeConnections,
      queueDepth: queueDepthObj,
      topSlowEndpoints: this.getTopSlowEndpoints(),
    };
  }

  /**
   * Reset metrics (hourly)
   */
  reset(): void {
    this.httpRequestsTotal.clear();
    this.httpRequestDuration.clear();
    this.errorsByType.clear();
    this.startTime = Date.now();
    this.requestCount = 0;
    logger.info('Metrics reset');
  }
}

// Global instance
const metrics = new GlobalMetricsCollector();

/**
 * Middleware to collect HTTP request metrics
 */
export function metricsMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  // Track active connections
  let activeConnections = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    activeConnections++;
    metrics.setActiveConnections(activeConnections);

    // Create a unique key for the endpoint
    const endpoint = `${req.method}:${req.path}`;

    // Capture response finish
    const onFinish = (): void => {
      const durationMs = Date.now() - startTime;
      const isError = res.statusCode >= 400;

      metrics.recordRequest(endpoint, durationMs, isError);

      if (isError) {
        metrics.recordError(`http_${res.statusCode}`);
      }

      activeConnections--;
      metrics.setActiveConnections(activeConnections);
    };

    res.on('finish', onFinish);
    res.on('close', onFinish);

    next();
  };
}

/**
 * Endpoint to get metrics summary
 */
export function metricsEndpoint(): (req: Request, res: Response) => void {
  return (req: Request, res: Response): void => {
    const summary = metrics.getSummary();
    res.json(summary);
  };
}

/**
 * Set queue depth (called by queue managers)
 */
export function setQueueDepth(queueName: string, depth: number): void {
  metrics.setQueueDepth(queueName, depth);
}

/**
 * Record an error
 */
export function recordMetricError(errorCode: string): void {
  metrics.recordError(errorCode);
}

/**
 * Get current metrics
 */
export function getMetrics(): GlobalMetricsCollector {
  return metrics;
}

/**
 * Reset metrics (typically called hourly)
 */
export function resetMetrics(): void {
  metrics.reset();
}

// Schedule hourly reset
setInterval(() => {
  resetMetrics();
}, 60 * 60 * 1000); // Every hour
