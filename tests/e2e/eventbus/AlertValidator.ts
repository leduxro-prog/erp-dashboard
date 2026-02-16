/**
 * Alert Validator
 *
 * Validates alert firing for event bus operations.
 * Verifies DLQ alerts, retry rate alerts, circuit breaker alerts, and health checks.
 *
 * @module tests/e2e/eventbus/AlertValidator
 */

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

/**
 * Alert record
 */
export interface AlertRecord {
  id: string;
  level: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Alert validation result
 */
export interface AlertValidationResult {
  /** Overall validation result */
  valid: boolean;
  /** Alert type being validated */
  alertType: string;
  /** Expected alert */
  expected: string;
  /** Actual alert found */
  actual?: AlertRecord;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Time to fire alert in milliseconds */
  timeToFire?: number;
}

/**
 * Expected alerts configuration
 */
export interface ExpectedAlerts {
  /** DLQ alert expected */
  dlqAlert?: {
    queueName: string;
    messageCount: number;
    expectedSeverity?: AlertSeverity;
  };
  /** Retry rate alert expected */
  retryRateAlert?: {
    eventType: string;
    retryRate: number;
    threshold: number;
    expectedSeverity?: AlertSeverity;
  };
  /** Circuit breaker alert expected */
  circuitBreakerAlert?: {
    serviceName: string;
    state: 'open' | 'half-open' | 'closed';
    expectedSeverity?: AlertSeverity;
  };
  /** Health check degradation expected */
  healthDegradationAlert?: {
    componentName: string;
    expectedSeverity?: AlertSeverity;
  };
}

/**
 * Alert validator configuration
 */
export interface AlertValidatorConfig {
  /** Alert manager URL */
  alertUrl?: string;
  /** Alert webhook URL for test interception */
  testWebhookUrl?: string;
  /** Maximum time to wait for alert in milliseconds */
  alertTimeoutMs?: number;
  /** Alert deduplication window in milliseconds */
  deduplicationWindowMs?: number;
}

/**
 * Alert Validator class
 */
export class AlertValidator {
  private config: Required<AlertValidatorConfig>;
  private capturedAlerts: Map<string, AlertRecord[]> = new Map();
  private startTime: number;

  constructor(config: AlertValidatorConfig = {}) {
    this.config = {
      alertUrl: config.alertUrl || process.env.ALERT_URL || 'http://localhost:3000/api/alerts',
      testWebhookUrl: config.testWebhookUrl || process.env.TEST_WEBHOOK_URL,
      alertTimeoutMs: config.alertTimeoutMs || 30000,
      deduplicationWindowMs: config.deduplicationWindowMs || 300000,
    };
    this.startTime = Date.now();
  }

  /**
   * Starts alert capture (sets up test webhook if configured)
   */
  async startCapture(): Promise<void> {
    if (this.config.testWebhookUrl) {
      // In a real test environment, this would set up a webhook server
      // to capture alerts. For now, we'll use the alert API.
      console.log('[AlertValidator] Alert capture started');
    }
  }

  /**
   * Stops alert capture
   */
  async stopCapture(): Promise<void> {
    console.log('[AlertValidator] Alert capture stopped');
  }

  /**
   * Validates DLQ alert fired
   *
   * @param queueName - Queue name
   * @param messageCount - Message count in DLQ
   * @param expectedSeverity - Expected alert severity
   * @returns Validation result
   */
  async validateDLQAlert(
    queueName: string,
    messageCount: number,
    expectedSeverity: AlertSeverity = AlertSeverity.CRITICAL
  ): Promise<AlertValidationResult> {
    const result: AlertValidationResult = {
      valid: false,
      alertType: 'DLQ',
      expected: `Alert for queue ${queueName} with ${messageCount} messages`,
      errors: [],
      warnings: [],
    };

    const startTime = Date.now();

    try {
      // Wait for alert
      const alert = await this.waitForAlert(
        (alert) =>
          alert.title.includes('DLQ') ||
          alert.title.includes('Dead Letter') ||
          alert.title.includes(queueName) ||
          (alert.metadata as any)?.queue_name === queueName,
        this.config.alertTimeoutMs
      );

      result.timeToFire = Date.now() - startTime;

      if (!alert) {
        result.errors.push('DLQ alert did not fire within timeout');
        return result;
      }

      result.actual = alert;

      // Validate severity
      if (alert.level !== expectedSeverity) {
        result.errors.push(
          `Expected severity ${expectedSeverity}, got ${alert.level}`
        );
      } else {
        result.valid = true;
      }

      // Validate alert contains queue information
      const alertMetadata = alert.metadata || {};
      if (!(alertMetadata as any).queue_name) {
        result.warnings.push('Alert does not contain queue_name in metadata');
      }

      if (!(alertMetadata as any).message_count) {
        result.warnings.push('Alert does not contain message_count in metadata');
      }

    } catch (error) {
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates retry rate alert fired
   *
   * @param eventType - Event type
   * @param retryRate - Current retry rate
   * @param threshold - Threshold exceeded
   * @param expectedSeverity - Expected alert severity
   * @returns Validation result
   */
  async validateRetryRateAlert(
    eventType: string,
    retryRate: number,
    threshold: number,
    expectedSeverity: AlertSeverity = AlertSeverity.WARNING
  ): Promise<AlertValidationResult> {
    const result: AlertValidationResult = {
      valid: false,
      alertType: 'retry_rate',
      expected: `Alert for ${eventType} with retry rate ${retryRate}/${threshold}`,
      errors: [],
      warnings: [],
    };

    const startTime = Date.now();

    try {
      const alert = await this.waitForAlert(
        (alert) =>
          alert.title.includes('Retry') ||
          alert.title.includes('retry') ||
          alert.message.includes('retry rate') ||
          (alert.metadata as any)?.event_type === eventType,
        this.config.alertTimeoutMs
      );

      result.timeToFire = Date.now() - startTime;

      if (!alert) {
        result.errors.push('Retry rate alert did not fire within timeout');
        return result;
      }

      result.actual = alert;

      // Validate severity
      if (alert.level !== expectedSeverity) {
        result.errors.push(
          `Expected severity ${expectedSeverity}, got ${alert.level}`
        );
      } else {
        result.valid = true;
      }

      // Validate alert contains retry rate information
      const alertMetadata = alert.metadata || {};
      if ((alertMetadata as any).retry_rate !== retryRate) {
        result.warnings.push(
          `Alert retry_rate mismatch: expected ${retryRate}, got ${(alertMetadata as any).retry_rate}`
        );
      }

    } catch (error) {
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates circuit breaker alert fired
   *
   * @param serviceName - Service name
   * @param state - Circuit breaker state
   * @param expectedSeverity - Expected alert severity
   * @returns Validation result
   */
  async validateCircuitBreakerAlert(
    serviceName: string,
    state: 'open' | 'half-open' | 'closed',
    expectedSeverity: AlertSeverity = AlertSeverity.CRITICAL
  ): Promise<AlertValidationResult> {
    const result: AlertValidationResult = {
      valid: false,
      alertType: 'circuit_breaker',
      expected: `Alert for ${serviceName} circuit breaker ${state}`,
      errors: [],
      warnings: [],
    };

    const startTime = Date.now();

    try {
      const alert = await this.waitForAlert(
        (alert) =>
          alert.title.includes('Circuit Breaker') ||
          alert.title.includes('circuit breaker') ||
          alert.title.includes(serviceName) ||
          (alert.metadata as any)?.service_name === serviceName,
        this.config.alertTimeoutMs
      );

      result.timeToFire = Date.now() - startTime;

      if (!alert) {
        result.errors.push('Circuit breaker alert did not fire within timeout');
        return result;
      }

      result.actual = alert;

      // Validate severity
      if (alert.level !== expectedSeverity) {
        result.errors.push(
          `Expected severity ${expectedSeverity}, got ${alert.level}`
        );
      } else {
        result.valid = true;
      }

      // Validate alert contains service and state information
      const alertMetadata = alert.metadata || {};
      if ((alertMetadata as any).service_name !== serviceName) {
        result.warnings.push(
          `Alert service_name mismatch: expected ${serviceName}, got ${(alertMetadata as any).service_name}`
        );
      }

      if ((alertMetadata as any).circuit_state !== state) {
        result.warnings.push(
          `Alert circuit_state mismatch: expected ${state}, got ${(alertMetadata as any).circuit_state}`
        );
      }

    } catch (error) {
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates health check degradation alert fired
   *
   * @param componentName - Component name
   * @param expectedSeverity - Expected alert severity
   * @returns Validation result
   */
  async validateHealthDegradationAlert(
    componentName: string,
    expectedSeverity: AlertSeverity = AlertSeverity.WARNING
  ): Promise<AlertValidationResult> {
    const result: AlertValidationResult = {
      valid: false,
      alertType: 'health_degradation',
      expected: `Alert for ${componentName} health degradation`,
      errors: [],
      warnings: [],
    };

    const startTime = Date.now();

    try {
      const alert = await this.waitForAlert(
        (alert) =>
          alert.title.includes('Health') ||
          alert.title.includes('Degradation') ||
          alert.title.includes('degraded') ||
          alert.title.includes(componentName) ||
          (alert.metadata as any)?.component_name === componentName,
        this.config.alertTimeoutMs
      );

      result.timeToFire = Date.now() - startTime;

      if (!alert) {
        result.errors.push('Health degradation alert did not fire within timeout');
        return result;
      }

      result.actual = alert;

      // Validate severity
      if (alert.level !== expectedSeverity) {
        result.errors.push(
          `Expected severity ${expectedSeverity}, got ${alert.level}`
        );
      } else {
        result.valid = true;
      }

      // Validate alert contains component information
      const alertMetadata = alert.metadata || {};
      if ((alertMetadata as any).component_name !== componentName) {
        result.warnings.push(
          `Alert component_name mismatch: expected ${componentName}, got ${(alertMetadata as any).component_name}`
        );
      }

    } catch (error) {
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates all expected alerts fired
   *
   * @param expected - Expected alerts
   * @returns Array of validation results
   */
  async validateAllExpectedAlerts(
    expected: ExpectedAlerts
  ): Promise<AlertValidationResult[]> {
    const results: AlertValidationResult[] = [];

    // Validate DLQ alert if expected
    if (expected.dlqAlert) {
      results.push(
        await this.validateDLQAlert(
          expected.dlqAlert.queueName,
          expected.dlqAlert.messageCount,
          expected.dlqAlert.expectedSeverity
        )
      );
    }

    // Validate retry rate alert if expected
    if (expected.retryRateAlert) {
      results.push(
        await this.validateRetryRateAlert(
          expected.retryRateAlert.eventType,
          expected.retryRateAlert.retryRate,
          expected.retryRateAlert.threshold,
          expected.retryRateAlert.expectedSeverity
        )
      );
    }

    // Validate circuit breaker alert if expected
    if (expected.circuitBreakerAlert) {
      results.push(
        await this.validateCircuitBreakerAlert(
          expected.circuitBreakerAlert.serviceName,
          expected.circuitBreakerAlert.state,
          expected.circuitBreakerAlert.expectedSeverity
        )
      );
    }

    // Validate health degradation alert if expected
    if (expected.healthDegradationAlert) {
      results.push(
        await this.validateHealthDegradationAlert(
          expected.healthDegradationAlert.componentName,
          expected.healthDegradationAlert.expectedSeverity
        )
      );
    }

    return results;
  }

  /**
   * Validates no alerts fired (negative test)
   *
   * @param duration - Duration to wait for alerts in milliseconds
   * @param predicate - Predicate to filter alerts
   * @returns Validation result
   */
  async validateNoAlertsFired(
    duration: number = 5000,
    predicate: (alert: AlertRecord) => boolean = () => true
  ): Promise<AlertValidationResult> {
    const result: AlertValidationResult = {
      valid: true,
      alertType: 'none',
      expected: 'No alerts',
      errors: [],
      warnings: [],
    };

    try {
      // Wait for duration
      await new Promise((resolve) => setTimeout(resolve, duration));

      // Check for matching alerts
      const matchingAlerts = await this.getMatchingAlerts(predicate);

      if (matchingAlerts.length > 0) {
        result.valid = false;
        result.actual = matchingAlerts[0];
        result.errors.push(
          `Expected no alerts, but ${matchingAlerts.length} alert(s) fired`
        );
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Waits for an alert matching the predicate
   *
   * @param predicate - Alert matching predicate
   * @param timeoutMs - Timeout in milliseconds
   * @returns Matching alert or null
   */
  private async waitForAlert(
    predicate: (alert: AlertRecord) => boolean,
    timeoutMs: number
  ): Promise<AlertRecord | null> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const alerts = await this.fetchAlerts();
        const matching = alerts.find(predicate);

        if (matching) {
          return matching;
        }
      } catch {
        // Ignore errors during polling
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return null;
  }

  /**
   * Fetches alerts from alert manager
   *
   * @returns Array of alert records
   */
  private async fetchAlerts(): Promise<AlertRecord[]> {
    try {
      const response = await fetch(`${this.config.alertUrl}?since=${this.startTime}`);

      if (!response.ok) {
        throw new Error(`Alert API returned status ${response.status}`);
      }

      const alerts = await response.json();
      return alerts.map((a: any) => ({
        id: a.id,
        level: a.level,
        title: a.title,
        message: a.message,
        metadata: a.metadata,
        timestamp: new Date(a.timestamp),
        acknowledged: a.acknowledged || false,
      }));
    } catch (error) {
      console.error('[AlertValidator] Failed to fetch alerts:', error);
      return [];
    }
  }

  /**
   * Gets alerts matching a predicate
   *
   * @param predicate - Alert matching predicate
   * @returns Array of matching alerts
   */
  private async getMatchingAlerts(
    predicate: (alert: AlertRecord) => boolean
  ): Promise<AlertRecord[]> {
    const alerts = await this.fetchAlerts();
    return alerts.filter(predicate);
  }

  /**
   * Acknowledges an alert
   *
   * @param alertId - Alert ID to acknowledge
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await fetch(`${this.config.alertUrl}/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[AlertValidator] Failed to acknowledge alert:', error);
    }
  }

  /**
   * Clears all alerts (for test cleanup)
   */
  async clearAllAlerts(): Promise<void> {
    try {
      await fetch(`${this.config.alertUrl}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      this.startTime = Date.now();
    } catch (error) {
      console.error('[AlertValidator] Failed to clear alerts:', error);
    }
  }

  /**
   * Gets alert statistics
   *
   * @returns Alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    byLevel: Record<AlertSeverity, number>;
    acknowledged: number;
    unacknowledged: number;
  }> {
    const alerts = await this.fetchAlerts();

    const byLevel: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.WARNING]: 0,
      [AlertSeverity.CRITICAL]: 0,
      [AlertSeverity.EMERGENCY]: 0,
    };

    for (const alert of alerts) {
      byLevel[alert.level]++;
    }

    return {
      total: alerts.length,
      byLevel,
      acknowledged: alerts.filter((a) => a.acknowledged).length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
    };
  }
}

/**
 * Factory function to create an alert validator
 *
 * @param config - Validator configuration
 * @returns AlertValidator instance
 */
export function createAlertValidator(config?: AlertValidatorConfig): AlertValidator {
  return new AlertValidator(config);
}

export default AlertValidator;
