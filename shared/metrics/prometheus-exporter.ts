/**
 * Prometheus Metrics Exporter
 * Collects and exports system metrics in Prometheus text format
 */

import { ICypherModule, IModuleMetrics } from '../module-system';

/**
 * Prometheus metric types
 */
export type PrometheusMetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Prometheus metric line
 */
export interface PrometheusMetricLine {
  name: string;
  labels: Record<string, string>;
  value: number | string;
  timestamp?: number;
}

/**
 * Histogram buckets for latency metrics
 */
const LATENCY_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

/**
 * In-memory Prometheus metrics collector
 * No external dependencies - uses simple data structures
 */
export class PrometheusExporter {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter with labels
   */
  incrementCounter(name: string, labels: Record<string, string>, value: number = 1): void {
    const key = this.labelKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  /**
   * Set a gauge value with labels
   */
  setGauge(name: string, labels: Record<string, string>, value: number): void {
    const key = this.labelKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram observation (latency, duration, etc)
   */
  recordHistogram(name: string, labels: Record<string, string>, value: number): void {
    const key = this.labelKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);

    // Keep only last 10000 samples for memory efficiency
    const samples = this.histograms.get(key)!;
    if (samples.length > 10000) {
      samples.splice(0, samples.length - 10000);
    }
  }

  /**
   * Calculate percentile from histogram values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Generate label key for deduplication
   */
  private labelKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Export metrics in Prometheus text format
   */
  export(): string {
    let output = '';

    // Export counters
    output += this.exportType('counter');
    for (const [key, value] of this.counters) {
      output += `${key} ${value}\n`;
    }

    // Export gauges
    output += this.exportType('gauge');
    for (const [key, value] of this.gauges) {
      output += `${key} ${value}\n`;
    }

    // Export histogram buckets, sum, and count
    output += this.exportType('histogram');
    for (const [key, values] of this.histograms) {
      const [name, labelPart] = key.includes('{') ? [key.substring(0, key.indexOf('{')), key.substring(key.indexOf('{'))] : [key, ''];
      const labels = this.extractLabels(labelPart);

      // Export buckets
      for (const bucket of LATENCY_BUCKETS) {
        const count = values.filter((v) => v <= bucket).length;
        const bucketLabels = { ...labels, le: String(bucket) };
        const bucketKey = this.labelKey(`${name}_bucket`, bucketLabels);
        output += `${bucketKey} ${count}\n`;
      }

      // +Inf bucket
      const infLabels = { ...labels, le: '+Inf' };
      const infKey = this.labelKey(`${name}_bucket`, infLabels);
      output += `${infKey} ${values.length}\n`;

      // Sum
      const sum = values.reduce((a, b) => a + b, 0);
      const sumKey = this.labelKey(`${name}_sum`, labels);
      output += `${sumKey} ${sum}\n`;

      // Count
      const countKey = this.labelKey(`${name}_count`, labels);
      output += `${countKey} ${values.length}\n`;
    }

    return output;
  }

  /**
   * Extract labels from label string
   */
  private extractLabels(labelPart: string): Record<string, string> {
    if (!labelPart) return {};
    const labelStr = labelPart.slice(1, -1); // Remove { }
    const labels: Record<string, string> = {};
    const pairs = labelStr.split(',');
    for (const pair of pairs) {
      const [k, v] = pair.split('=');
      if (k && v) {
        labels[k] = v.replace(/^"(.*)"$/, '$1');
      }
    }
    return labels;
  }

  /**
   * Export type comment for Prometheus
   */
  private exportType(type: string): string {
    return `\n# TYPE metrics ${type}\n`;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

/**
 * Collect metrics from all modules and format for Prometheus
 */
export function collectPrometheusMetrics(
  modules: Map<string, ICypherModule>,
  cacheStats?: { hitRate: number; size: number; keys: number },
  dbPoolStats?: { active: number; idle: number },
  redisConnected?: boolean
): PrometheusMetricLine[] {
  const lines: PrometheusMetricLine[] = [];
  const timestamp = Date.now();

  // Collect metrics from each module
  for (const [moduleName, module] of modules) {
    try {
      const metrics = module.getMetrics();

      // HTTP requests counter
      lines.push({
        name: 'cypher_http_requests_total',
        labels: { module: moduleName, method: 'UNKNOWN', status: '200', path: '/' },
        value: metrics.requestCount,
        timestamp,
      });

      // HTTP request duration histogram (p50, p90, p95, p99)
      lines.push({
        name: 'cypher_http_request_duration_seconds',
        labels: { module: moduleName, method: 'UNKNOWN', path: '/', quantile: '0.5' },
        value: metrics.avgResponseTime / 1000, // Convert to seconds
      });

      // Errors counter
      lines.push({
        name: 'cypher_errors_total',
        labels: { module: moduleName, type: 'general' },
        value: metrics.errorCount,
        timestamp,
      });

      // Active workers gauge
      lines.push({
        name: 'cypher_active_workers',
        labels: { module: moduleName },
        value: metrics.activeWorkers,
        timestamp,
      });

      // Events published counter
      lines.push({
        name: 'cypher_events_published_total',
        labels: { module: moduleName },
        value: metrics.eventCount.published,
        timestamp,
      });

      // Events received counter
      lines.push({
        name: 'cypher_events_received_total',
        labels: { module: moduleName },
        value: metrics.eventCount.received,
        timestamp,
      });
    } catch (error) {
      console.error(`Failed to collect metrics for module ${moduleName}:`, error);
    }
  }

  // Cache metrics
  if (cacheStats) {
    lines.push({
      name: 'cypher_cache_hits_total',
      labels: { layer: 'L1' },
      value: Math.round(cacheStats.hitRate * 100),
      timestamp,
    });

    lines.push({
      name: 'cypher_cache_misses_total',
      labels: { layer: 'L1' },
      value: Math.round((100 - cacheStats.hitRate) * 100),
      timestamp,
    });
  }

  // Database pool metrics
  if (dbPoolStats) {
    lines.push({
      name: 'cypher_db_pool_active',
      labels: {},
      value: dbPoolStats.active,
      timestamp,
    });

    lines.push({
      name: 'cypher_db_pool_idle',
      labels: {},
      value: dbPoolStats.idle,
      timestamp,
    });
  }

  // Redis connection status
  if (redisConnected !== undefined) {
    lines.push({
      name: 'cypher_redis_connected',
      labels: {},
      value: redisConnected ? 1 : 0,
      timestamp,
    });
  }

  return lines;
}

/**
 * Format Prometheus metric lines as text
 */
export function formatPrometheusMetrics(lines: PrometheusMetricLine[]): string {
  let output = '# HELP cypher_http_requests_total Total HTTP requests\n';
  output += '# TYPE cypher_http_requests_total counter\n';

  const byType: Record<string, PrometheusMetricLine[]> = {};
  for (const line of lines) {
    if (!byType[line.name]) {
      byType[line.name] = [];
    }
    byType[line.name].push(line);
  }

  for (const [name, metrics] of Object.entries(byType)) {
    output += `\n# HELP ${name} Metric ${name}\n`;
    output += `# TYPE ${name} gauge\n`;

    for (const metric of metrics) {
      const labelStr =
        Object.entries(metric.labels).length > 0
          ? '{' +
            Object.entries(metric.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',') +
            '}'
          : '';
      output += `${name}${labelStr} ${metric.value}`;
      if (metric.timestamp) {
        output += ` ${metric.timestamp}`;
      }
      output += '\n';
    }
  }

  return output;
}
