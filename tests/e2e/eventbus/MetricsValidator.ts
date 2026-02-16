/**
 * Metrics Validator
 *
 * Validates Prometheus metrics for event bus operations.
 * Verifies event publishing, processing, failure, retry metrics, and histograms.
 *
 * @module tests/e2e/eventbus/MetricsValidator
 */

/**
 * Prometheus metric line
 */
export interface PrometheusMetricLine {
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp?: number;
}

/**
 * Metrics validation result
 */
export interface MetricsValidationResult {
  /** Overall validation result */
  valid: boolean;
  /** Metric name being validated */
  metricName: string;
  /** Expected value or condition */
  expected: string;
  /** Actual value found */
  actual?: number | Record<string, number>;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Expected metrics for event operations
 */
export interface ExpectedEventMetrics {
  /** Expected increment in events_published_total */
  expectedPublishCount: number;
  /** Expected increment in events_failed_total (if any failures) */
  expectedFailureCount?: number;
  /** Expected increment in events_retried_total (if any retries) */
  expectedRetryCount?: number;
  /** Expected processing duration bucket counts */
  expectedDurationBuckets?: Record<string, number>;
  /** Expected queue depth */
  expectedQueueDepth?: number;
  /** Expected consumer lag */
  expectedConsumerLag?: number;
}

/**
 * Metrics validator configuration
 */
export interface MetricsValidatorConfig {
  /** Metrics endpoint URL */
  metricsUrl?: string;
  /** Timeout for metrics fetch in milliseconds */
  fetchTimeoutMs?: number;
  /** Metric name prefix */
  metricPrefix?: string;
  /** Whether to ignore missing metrics */
  ignoreMissing?: boolean;
}

/**
 * Metrics Validator class
 */
export class MetricsValidator {
  private config: Required<MetricsValidatorConfig>;
  private baselineMetrics: Map<string, PrometheusMetricLine[]> = new Map();

  constructor(config: MetricsValidatorConfig = {}) {
    this.config = {
      metricsUrl: config.metricsUrl || process.env.METRICS_URL || 'http://localhost:9090/metrics',
      fetchTimeoutMs: config.fetchTimeoutMs || 5000,
      metricPrefix: config.metricPrefix || 'cypher_',
      ignoreMissing: config.ignoreMissing ?? false,
    };
  }

  /**
   * Captures baseline metrics before an operation
   *
   * @param metricNames - Metric names to capture
   */
  async captureBaseline(metricNames: string[] = []): Promise<void> {
    const allMetrics = await this.fetchMetrics();

    for (const metricName of metricNames) {
      const prefixedName = this.prefixedName(metricName);
      this.baselineMetrics.set(prefixedName, allMetrics.filter((m) => m.name === prefixedName));
    }

    // If no specific metrics, capture all
    if (metricNames.length === 0) {
      const uniqueNames = new Set(allMetrics.map((m) => m.name));
      for (const name of Array.from(uniqueNames)) {
        this.baselineMetrics.set(name, allMetrics.filter((m) => m.name === name));
      }
    }
  }

  /**
   * Validates event publishing metrics
   *
   * @param eventType - Event type that was published
   * @param domain - Event domain
   * @param expected - Expected metrics
   * @returns Validation result
   */
  async validatePublishMetrics(
    eventType: string,
    domain: string,
    expected: ExpectedEventMetrics
  ): Promise<MetricsValidationResult> {
    const result: MetricsValidationResult = {
      valid: true,
      metricName: 'events_published_total',
      expected: `increment by ${expected.expectedPublishCount}`,
      errors: [],
      warnings: [],
    };

    try {
      const currentMetrics = await this.fetchMetrics();
      const metricName = this.prefixedName('events_published_total');

      // Get baseline and current values
      const baseline = this.baselineMetrics.get(metricName) || [];
      const current = currentMetrics.filter((m) => m.name === metricName);

      // Get value for specific event type and domain
      const labels = { event_type: eventType, event_domain: domain };

      const baselineValue = this.getMetricValue(baseline, labels) || 0;
      const currentValue = this.getMetricValue(current, labels) || 0;

      // Calculate increment
      const increment = currentValue - baselineValue;

      // Validate increment
      if (increment !== expected.expectedPublishCount) {
        result.valid = false;
        result.errors.push(
          `Expected increment of ${expected.expectedPublishCount}, got ${increment}`
        );
      }

      result.actual = { baseline: baselineValue, current: currentValue, increment };

      // Validate metric has all required labels
      this.validateMetricLabels(current, metricName, labels, result);

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates event failure metrics
   *
   * @param eventType - Event type
   * @param domain - Event domain
   * @param errorType - Error type
   * @param expectedCount - Expected failure count
   * @returns Validation result
   */
  async validateFailureMetrics(
    eventType: string,
    domain: string,
    errorType: string,
    expectedCount: number = 1
  ): Promise<MetricsValidationResult> {
    const result: MetricsValidationResult = {
      valid: true,
      metricName: 'events_failed_total',
      expected: `increment by ${expectedCount}`,
      errors: [],
      warnings: [],
    };

    try {
      const currentMetrics = await this.fetchMetrics();
      const metricName = this.prefixedName('events_failed_total');

      const baseline = this.baselineMetrics.get(metricName) || [];
      const current = currentMetrics.filter((m) => m.name === metricName);

      const labels = {
        event_type: eventType,
        event_domain: domain,
        error_type: errorType,
      };

      const baselineValue = this.getMetricValue(baseline, labels) || 0;
      const currentValue = this.getMetricValue(current, labels) || 0;

      const increment = currentValue - baselineValue;

      if (increment < expectedCount) {
        result.valid = false;
        result.errors.push(
          `Expected failure count >= ${expectedCount}, got ${increment}`
        );
      }

      result.actual = { baseline: baselineValue, current: currentValue, increment };

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates event retry metrics
   *
   * @param eventType - Event type
   * @param domain - Event domain
   * @param expectedCount - Expected retry count
   * @returns Validation result
   */
  async validateRetryMetrics(
    eventType: string,
    domain: string,
    expectedCount: number = 1
  ): Promise<MetricsValidationResult> {
    const result: MetricsValidationResult = {
      valid: true,
      metricName: 'events_retried_total',
      expected: `increment by ${expectedCount}`,
      errors: [],
      warnings: [],
    };

    try {
      const currentMetrics = await this.fetchMetrics();
      const metricName = this.prefixedName('events_retried_total');

      const baseline = this.baselineMetrics.get(metricName) || [];
      const current = currentMetrics.filter((m) => m.name === metricName);

      const labels = {
        event_type: eventType,
        event_domain: domain,
      };

      const baselineValue = this.getMetricValue(baseline, labels) || 0;
      const currentValue = this.getMetricValue(current, labels) || 0;

      const increment = currentValue - baselineValue;

      if (increment < expectedCount) {
        result.valid = false;
        result.errors.push(
          `Expected retry count >= ${expectedCount}, got ${increment}`
        );
      }

      result.actual = { baseline: baselineValue, current: currentValue, increment };

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates processing duration histogram
   *
   * @param eventType - Event type
   * @param domain - Event domain
   * @param expectedBuckets - Expected bucket counts
   * @returns Validation result
   */
  async validateProcessingDurationMetrics(
    eventType: string,
    domain: string,
    expectedBuckets?: Record<string, number>
  ): Promise<MetricsValidationResult> {
    const result: MetricsValidationResult = {
      valid: true,
      metricName: 'event_processing_duration_seconds',
      expected: expectedBuckets ? `bucket counts` : 'updated',
      errors: [],
      warnings: [],
    };

    try {
      const currentMetrics = await this.fetchMetrics();
      const metricName = this.prefixedName('event_processing_duration_seconds');

      const labels = { event_type: eventType, event_domain: domain };

      // Get histogram metrics
      const histogramMetrics = currentMetrics.filter((m) => m.name === metricName && m.labels.le !== undefined);
      const sumMetrics = currentMetrics.filter((m) => m.name === metricName && m.labels.le === undefined);
      const countMetrics = currentMetrics.filter((m) => m.name === `${metricName}_count`);

      if (histogramMetrics.length === 0) {
        if (this.config.ignoreMissing) {
          result.warnings.push('Processing duration metrics not found');
        } else {
          result.valid = false;
          result.errors.push('Processing duration metrics not found');
        }
        return result;
      }

      // Get sum and count
      const sum = this.getMetricValue(sumMetrics, labels) || 0;
      const count = this.getMetricValue(countMetrics, { ...labels, __name__: metricName }) || 0;

      if (count === 0) {
        result.valid = false;
        result.errors.push('Processing duration count is 0');
        return result;
      }

      (result.actual as any) = { sum, count, buckets: {} };

      // Validate bucket counts if provided
      if (expectedBuckets) {
        for (const [bucket, expectedCount] of Object.entries(expectedBuckets)) {
          const bucketLabels = { ...labels, le: bucket === '+Inf' ? '+Inf' : bucket };
          const bucketValue = this.getMetricValue(histogramMetrics, bucketLabels) || 0;

          (result.actual as any).buckets[bucket] = bucketValue;

          if (bucketValue < expectedCount) {
            result.warnings.push(
              `Bucket ${bucket}: expected >= ${expectedCount}, got ${bucketValue}`
            );
          }
        }
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates queue depth metrics
   *
   * @param queueName - Queue name
   * @param expectedDepth - Expected queue depth
   * @returns Validation result
   */
  async validateQueueDepthMetrics(
    queueName: string,
    expectedDepth?: number
  ): Promise<MetricsValidationResult> {
    const result: MetricsValidationResult = {
      valid: true,
      metricName: 'rabbitmq_queue_depth',
      expected: expectedDepth ? `approximately ${expectedDepth}` : 'updated',
      errors: [],
      warnings: [],
    };

    try {
      const currentMetrics = await this.fetchMetrics();
      const metricName = this.prefixedName('rabbitmq_queue_depth');

      const labels = { queue_name: queueName };
      const currentValue = this.getMetricValue(currentMetrics.filter((m) => m.name === metricName), labels);

      if (currentValue === undefined) {
        if (this.config.ignoreMissing) {
          result.warnings.push('Queue depth metric not found');
        } else {
          result.valid = false;
          result.errors.push('Queue depth metric not found');
        }
        return result;
      }

      result.actual = currentValue;

      // Validate expected depth
      if (expectedDepth !== undefined) {
        const tolerance = Math.max(1, expectedDepth * 0.1); // 10% tolerance
        if (Math.abs(currentValue - expectedDepth) > tolerance) {
          result.valid = false;
          result.errors.push(
            `Expected queue depth ${expectedDepth} ± ${tolerance}, got ${currentValue}`
          );
        }
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates consumer lag metrics
   *
   * @param consumerName - Consumer name
   * @param queueName - Queue name
   * @param maxLag - Maximum acceptable lag
   * @returns Validation result
   */
  async validateConsumerLagMetrics(
    consumerName: string,
    queueName: string,
    maxLag: number = 100
  ): Promise<MetricsValidationResult> {
    const result: MetricsValidationResult = {
      valid: true,
      metricName: 'rabbitmq_consumer_lag',
      expected: `<= ${maxLag}`,
      errors: [],
      warnings: [],
    };

    try {
      const currentMetrics = await this.fetchMetrics();
      const metricName = this.prefixedName('rabbitmq_consumer_lag');

      const labels = { consumer_name: consumerName, queue_name: queueName };
      const currentValue = this.getMetricValue(currentMetrics.filter((m) => m.name === metricName), labels);

      if (currentValue === undefined) {
        if (this.config.ignoreMissing) {
          result.warnings.push('Consumer lag metric not found');
        } else {
          result.valid = false;
          result.errors.push('Consumer lag metric not found');
        }
        return result;
      }

      result.actual = currentValue;

      // Validate lag is within acceptable range
      if (currentValue > maxLag) {
        result.valid = false;
        result.errors.push(
          `Consumer lag ${currentValue} exceeds maximum ${maxLag}`
        );
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates all expected metrics for an event operation
   *
   * @param eventType - Event type
   * @param domain - Event domain
   * @param expected - Expected metrics
   * @returns Array of validation results
   */
  async validateAllEventMetrics(
    eventType: string,
    domain: string,
    expected: ExpectedEventMetrics
  ): Promise<MetricsValidationResult[]> {
    const results: MetricsValidationResult[] = [];

    // Validate publish metrics
    results.push(
      await this.validatePublishMetrics(eventType, domain, expected)
    );

    // Validate failure metrics if expected
    if (expected.expectedFailureCount !== undefined && expected.expectedFailureCount > 0) {
      results.push(
        await this.validateFailureMetrics(eventType, domain, 'unknown', expected.expectedFailureCount)
      );
    }

    // Validate retry metrics if expected
    if (expected.expectedRetryCount !== undefined && expected.expectedRetryCount > 0) {
      results.push(
        await this.validateRetryMetrics(eventType, domain, expected.expectedRetryCount)
      );
    }

    // Validate processing duration histogram
    results.push(
      await this.validateProcessingDurationMetrics(eventType, domain, expected.expectedDurationBuckets)
    );

    // Validate queue depth if expected
    if (expected.expectedQueueDepth !== undefined) {
      results.push(
        await this.validateQueueDepthMetrics(`${domain}.${eventType}`, expected.expectedQueueDepth)
      );
    }

    // Validate consumer lag if expected
    if (expected.expectedConsumerLag !== undefined) {
      results.push(
        await this.validateConsumerLagMetrics(`${domain}_consumer`, `${domain}.${eventType}`, expected.expectedConsumerLag)
      );
    }

    return results;
  }

  /**
   * Waits for metrics to be updated
   *
   * @param eventType - Event type
   * @param domain - Event domain
   * @param timeoutMs - Timeout in milliseconds
   * @returns True if metrics updated
   */
  async waitForMetricsUpdate(
    eventType: string,
    domain: string,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    const startTime = Date.now();
    const metricName = this.prefixedName('events_published_total');

    const baseline = this.baselineMetrics.get(metricName) || [];
    const labels = { event_type: eventType, event_domain: domain };
    const baselineValue = this.getMetricValue(baseline, labels) || 0;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const currentMetrics = await this.fetchMetrics();
        const current = currentMetrics.filter((m) => m.name === metricName);
        const currentValue = this.getMetricValue(current, labels) || 0;

        if (currentValue > baselineValue) {
          return true;
        }
      } catch {
        // Ignore errors during polling
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return false;
  }

  /**
   * Fetches all metrics from the metrics endpoint
   *
   * @returns Array of parsed metric lines
   */
  private async fetchMetrics(): Promise<PrometheusMetricLine[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.fetchTimeoutMs);

    try {
      const response = await fetch(this.config.metricsUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Metrics endpoint returned status ${response.status}`);
      }

      const text = await response.text();
      return this.parseMetrics(text);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parses Prometheus metrics text format
   *
   * @param text - Metrics text
   * @returns Array of parsed metric lines
   */
  private parseMetrics(text: string): PrometheusMetricLine[] {
    const metrics: PrometheusMetricLine[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse metric line
      const match = trimmed.match(/^(\w+)(\{[^}]*\})?\s+(\d+(?:\.\d+)?)(?:\s+(\d+))?$/);

      if (match) {
        const name = match[1];
        const labelsStr = match[2] || '{}';
        const value = parseFloat(match[3]);
        const timestamp = match[4] ? parseInt(match[4], 10) : undefined;

        // Parse labels
        const labels: Record<string, string> = {};
        if (labelsStr !== '{}') {
          const innerLabels = labelsStr.substring(1, labelsStr.length - 1);
          const labelPairs = innerLabels.split(',');

          for (const pair of labelPairs) {
            const [key, val] = pair.split('=');
            if (key && val) {
              labels[key.trim()] = val.trim().replace(/^"|"$/g, '');
            }
          }
        }

        metrics.push({ name, labels, value, timestamp });
      }
    }

    return metrics;
  }

  /**
   * Gets metric value for specific labels
   *
   * @param metrics - Array of metrics
   * @param labels - Labels to match
   * @returns Metric value or undefined
   */
  private getMetricValue(
    metrics: PrometheusMetricLine[],
    labels: Record<string, string>
  ): number | undefined {
    for (const metric of metrics) {
      if (this.labelsMatch(metric.labels, labels)) {
        return metric.value;
      }
    }
    return undefined;
  }

  /**
   * Checks if labels match
   *
   * @param metricLabels - Metric labels
   * @param expectedLabels - Expected labels
   * @returns True if labels match
   */
  private labelsMatch(
    metricLabels: Record<string, string>,
    expectedLabels: Record<string, string>
  ): boolean {
    for (const [key, value] of Object.entries(expectedLabels)) {
      if (metricLabels[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validates metric has required labels
   *
   * @param metrics - Array of metrics
   * @param metricName - Metric name
   * @param requiredLabels - Required labels
   * @param result - Validation result
   */
  private validateMetricLabels(
    metrics: PrometheusMetricLine[],
    metricName: string,
    requiredLabels: Record<string, string>,
    result: MetricsValidationResult
  ): void {
    const matchingMetrics = metrics.filter((m) => m.name === metricName);

    if (matchingMetrics.length === 0) {
      result.errors.push(`No metrics found for ${metricName}`);
      return;
    }

    // Check if all required labels are present
    for (const [key, value] of Object.entries(requiredLabels)) {
      const hasLabel = matchingMetrics.some((m) => m.labels[key] === value);
      if (!hasLabel) {
        result.warnings.push(
          `Metric ${metricName} missing label ${key}=${value}`
        );
      }
    }
  }

  /**
   * Adds prefix to metric name if not already prefixed
   *
   * @param name - Metric name
   * @returns Prefixed metric name
   */
  private prefixedName(name: string): string {
    if (name.startsWith(this.config.metricPrefix)) {
      return name;
    }
    return `${this.config.metricPrefix}${name}`;
  }

  /**
   * Resets baseline metrics
   */
  resetBaseline(): void {
    this.baselineMetrics.clear();
  }

  /**
   * Gets current metric values
   *
   * @param metricName - Metric name
   * @returns Array of metric values
   */
  async getMetricValues(metricName: string): Promise<Array<{ labels: Record<string, string>; value: number }>> {
    const metrics = await this.fetchMetrics();
    const prefixedName = this.prefixedName(metricName);

    return metrics
      .filter((m) => m.name === prefixedName)
      .map((m) => ({ labels: m.labels, value: m.value }));
  }
}

/**
 * Factory function to create a metrics validator
 *
 * @param config - Validator configuration
 * @returns MetricsValidator instance
 */
export function createMetricsValidator(config?: MetricsValidatorConfig): MetricsValidator {
  return new MetricsValidator(config);
}

export default MetricsValidator;
