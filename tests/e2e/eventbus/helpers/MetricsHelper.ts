/**
 * Metrics Helper
 *
 * Utilities for querying and validating Prometheus metrics in tests.
 *
 * @module tests/e2e/eventbus/helpers/MetricsHelper
 */

/**
 * Prometheus metric data
 */
export interface MetricData {
  name: string;
  type?: 'counter' | 'gauge' | 'histogram' | 'summary';
  help?: string;
  samples: MetricSample[];
}

/**
 * Metric sample with labels and value
 */
export interface MetricSample {
  labels: Record<string, string>;
  value: number;
  timestamp?: number;
}

/**
 * Metrics query result
 */
export interface MetricsQueryResult {
  status: 'success' | 'error';
  data?: {
    resultType: 'matrix' | 'vector';
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
  error?: string;
}

/**
 * Metrics helper configuration
 */
export interface MetricsHelperConfig {
  /** Prometheus URL */
  prometheusUrl?: string;
  /** Query timeout in milliseconds */
  queryTimeoutMs?: number;
  /** Query start time (for range queries) */
  startTime?: Date;
  /** Query end time (for range queries) */
  endTime?: Date;
  /** Step size for range queries in seconds */
  step?: number;
}

/**
 * Metrics Helper class
 */
export class MetricsHelper {
  private config: Required<MetricsHelperConfig>;

  constructor(config: MetricsHelperConfig = {}) {
    this.config = {
      prometheusUrl: config.prometheusUrl || process.env.PROMETHEUS_URL || 'http://localhost:9090',
      queryTimeoutMs: config.queryTimeoutMs || 10000,
      startTime: config.startTime || new Date(Date.now() - 300000), // 5 minutes ago
      endTime: config.endTime || new Date(),
      step: config.step || 15,
    };
  }

  /**
   * Executes a Prometheus instant query
   *
   * @param query - PromQL query
   * @returns Query result
   */
  async query(query: string): Promise<MetricsQueryResult> {
    const url = `${this.config.prometheusUrl}/api/v1/query`;
    const params = new URLSearchParams({ query });

    try {
      const response = await fetch(`${url}?${params}`, {
        signal: AbortSignal.timeout(this.config.queryTimeoutMs),
      });

      if (!response.ok) {
        return {
          status: 'error',
          error: `Prometheus API returned status ${response.status}`,
        };
      }

      return await response.json();
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Executes a Prometheus range query
   *
   * @param query - PromQL query
   * @returns Query result
   */
  async queryRange(query: string): Promise<MetricsQueryResult> {
    const url = `${this.config.prometheusUrl}/api/v1/query_range`;
    const params = new URLSearchParams({
      query,
      start: (this.config.startTime.getTime() / 1000).toFixed(0),
      end: (this.config.endTime.getTime() / 1000).toFixed(0),
      step: this.config.step.toString(),
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        signal: AbortSignal.timeout(this.config.queryTimeoutMs),
      });

      if (!response.ok) {
        return {
          status: 'error',
          error: `Prometheus API returned status ${response.status}`,
        };
      }

      return await response.json();
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Gets the current value of a metric
   *
   * @param metricName - Metric name
   * @param labels - Optional label filters
   * @returns Metric value or undefined
   */
  async getMetricValue(
    metricName: string,
    labels?: Record<string, string>
  ): Promise<number | undefined> {
    const labelStr = labels
      ? Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';

    const query = `${metricName}${labelStr ? `{${labelStr}}` : ''}`;
    const result = await this.query(query);

    if (result.status === 'success' && result.data?.result.length > 0) {
      return parseFloat(result.data.result[0].value![1]);
    }

    return undefined;
  }

  /**
   * Gets metric values over time
   *
   * @param metricName - Metric name
   * @param labels - Optional label filters
   * @returns Array of timestamp-value pairs
   */
  async getMetricValuesOverTime(
    metricName: string,
    labels?: Record<string, string>
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    const labelStr = labels
      ? Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';

    const query = `${metricName}${labelStr ? `{${labelStr}}` : ''}`;
    const result = await this.queryRange(query);

    if (result.status === 'success' && result.data?.result.length > 0) {
      const values = result.data.result[0].values || [];
      return values.map(([ts, val]) => ({
        timestamp: new Date((typeof ts === 'string' ? parseInt(ts, 10) : ts) * 1000),
        value: parseFloat(val),
      }));
    }

    return [];
  }

  /**
   * Gets histogram buckets
   *
   * @param metricName - Metric name (without _bucket suffix)
   * @param labels - Optional label filters
   * @returns Bucket values
   */
  async getHistogramBuckets(
    metricName: string,
    labels?: Record<string, string>
  ): Promise<Record<string, number>> {
    const labelStr = labels
      ? Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';

    const query = `${metricName}_bucket${labelStr ? `{${labelStr}}` : ''}`;
    const result = await this.query(query);

    const buckets: Record<string, number> = {};

    if (result.status === 'success' && result.data?.result) {
      for (const item of result.data.result) {
        const le = item.metric.le || '+Inf';
        const value = parseFloat(item.value![1]);
        buckets[le] = value;
      }
    }

    return buckets;
  }

  /**
   * Gets histogram sum and count
   *
   * @param metricName - Metric name
   * @param labels - Optional label filters
   * @returns Sum and count
   */
  async getHistogramSumAndCount(
    metricName: string,
    labels?: Record<string, string>
  ): Promise<{ sum: number; count: number }> {
    const labelStr = labels
      ? Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';

    const [sumResult, countResult] = await Promise.all([
      this.query(`${metricName}_sum${labelStr ? `{${labelStr}}` : ''}`),
      this.query(`${metricName}_count${labelStr ? `{${labelStr}}` : ''}`),
    ]);

    const sum =
      sumResult.status === 'success' && sumResult.data?.result.length > 0
        ? parseFloat(sumResult.data.result[0].value![1])
        : 0;

    const count =
      countResult.status === 'success' && countResult.data?.result.length > 0
        ? parseFloat(countResult.data.result[0].value![1])
        : 0;

    return { sum, count };
  }

  /**
   * Calculates metric delta (change over time)
   *
   * @param metricName - Metric name
   * @param labels - Optional label filters
   * @param durationSeconds - Duration to calculate delta over
   * @returns Delta value
   */
  async getMetricDelta(
    metricName: string,
    labels?: Record<string, string>,
    durationSeconds: number = 60
  ): Promise<number | undefined> {
    const labelStr = labels
      ? Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';

    const query = `increase(${metricName}${labelStr ? `{${labelStr}}` : ''}[${durationSeconds}s])`;
    const result = await this.query(query);

    if (result.status === 'success' && result.data?.result.length > 0) {
      return parseFloat(result.data.result[0].value![1]);
    }

    return undefined;
  }

  /**
   * Calculates metric rate
   *
   * @param metricName - Metric name
   * @param labels - Optional label filters
   * @param durationSeconds - Duration to calculate rate over
   * @returns Rate value
   */
  async getMetricRate(
    metricName: string,
    labels?: Record<string, string>,
    durationSeconds: number = 60
  ): Promise<number | undefined> {
    const labelStr = labels
      ? Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';

    const query = `rate(${metricName}${labelStr ? `{${labelStr}}` : ''}[${durationSeconds}s])`;
    const result = await this.query(query);

    if (result.status === 'success' && result.data?.result.length > 0) {
      return parseFloat(result.data.result[0].value![1]);
    }

    return undefined;
  }

  /**
   * Gets metric percentile from histogram
   *
   * @param metricName - Metric name
   * @param percentile - Percentile (e.g., 0.95 for 95th percentile)
   * @param labels - Optional label filters
   * @returns Percentile value
   */
  async getHistogramPercentile(
    metricName: string,
    percentile: number = 0.95,
    labels?: Record<string, string>
  ): Promise<number | undefined> {
    const labelStr = labels
      ? Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')
      : '';

    const query = `histogram_quantile(${percentile}, ${metricName}${labelStr ? `{${labelStr}}` : ''})`;
    const result = await this.query(query);

    if (result.status === 'success' && result.data?.result.length > 0) {
      return parseFloat(result.data.result[0].value![1]);
    }

    return undefined;
  }

  /**
   * Waits for metric to reach a value
   *
   * @param metricName - Metric name
   * @param expectedValue - Expected value
   * @param labels - Optional label filters
   * @param timeoutMs - Timeout in milliseconds
   * @returns True if metric reached expected value
   */
  async waitForMetricValue(
    metricName: string,
    expectedValue: number,
    labels?: Record<string, string>,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeoutMs) {
      const currentValue = await this.getMetricValue(metricName, labels);

      if (currentValue !== undefined && currentValue >= expectedValue) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * Waits for metric to change
   *
   * @param metricName - Metric name
   * @param labels - Optional label filters
   * @param timeoutMs - Timeout in milliseconds
   * @returns New value or undefined
   */
  async waitForMetricChange(
    metricName: string,
    labels?: Record<string, string>,
    timeoutMs: number = 30000
  ): Promise<number | undefined> {
    const startTime = Date.now();
    const checkInterval = 500;

    const initialValue = await this.getMetricValue(metricName, labels);

    while (Date.now() - startTime < timeoutMs) {
      const currentValue = await this.getMetricValue(metricName, labels);

      if (currentValue !== undefined && currentValue !== initialValue) {
        return currentValue;
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return undefined;
  }

  /**
   * Gets all metrics matching a pattern
   *
   * @param pattern - Metric name pattern (supports wildcards)
   * @returns Array of metric names
   */
  async listMetrics(pattern: string): Promise<string[]> {
    const url = `${this.config.prometheusUrl}/api/v1/label/__name__/values`;
    const params = new URLSearchParams({ match: pattern });

    try {
      const response = await fetch(`${url}?${params}`, {
        signal: AbortSignal.timeout(this.config.queryTimeoutMs),
      });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      return result.data || [];
    } catch {
      return [];
    }
  }

  /**
   * Gets metric metadata
   *
   * @param metricName - Metric name
   * @returns Metric metadata
   */
  async getMetricMetadata(metricName: string): Promise<{
    type?: string;
    help?: string;
    unit?: string;
  } | null> {
    const url = `${this.config.prometheusUrl}/api/v1/metadata/${metricName}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.config.queryTimeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Sets query time range
   *
   * @param startTime - Start time
   * @param endTime - End time
   */
  setTimeRange(startTime: Date, endTime: Date): void {
    this.config.startTime = startTime;
    this.config.endTime = endTime;
  }

  /**
   * Resets time range to defaults
   */
  resetTimeRange(): void {
    this.config.startTime = new Date(Date.now() - 300000);
    this.config.endTime = new Date();
  }
}

/**
 * Factory function to create a metrics helper
 *
 * @param config - Helper configuration
 * @returns MetricsHelper instance
 */
export function createMetricsHelper(config?: MetricsHelperConfig): MetricsHelper {
  return new MetricsHelper(config);
}

export default MetricsHelper;
