/**
 * Alert Helper
 *
 * Utilities for interacting with AlertManager in tests.
 * Provides functions to trigger, verify, and clear alerts.
 *
 * @module tests/e2e/eventbus/helpers/AlertHelper
 */

import { AlertLevel } from '../../../../shared/alerting/alert-manager';

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Alert level */
  level: AlertLevel;
  /** Alert title */
  title: string;
  /** Alert message */
  message: string;
  /** Alert metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Alert manager response
 */
export interface AlertManagerResponse {
  /** Response status */
  status: 'success' | 'error';
  /** Alert ID if successful */
  alertId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Alert helper configuration
 */
export interface AlertHelperConfig {
  /** Alert manager URL */
  alertManagerUrl?: string;
  /** Request timeout in milliseconds */
  requestTimeoutMs?: number;
}

/**
 * Alert Helper class
 */
export class AlertHelper {
  private config: Required<AlertHelperConfig>;
  private capturedAlerts: Map<string, AlertConfig[]> = new Map();

  constructor(config: AlertHelperConfig = {}) {
    this.config = {
      alertManagerUrl: config.alertManagerUrl || process.env.ALERT_MANAGER_URL || 'http://localhost:3000/api/alerts',
      requestTimeoutMs: config.requestTimeoutMs || 5000,
    };
  }

  /**
   * Triggers an alert via the alert manager
   *
   * @param config - Alert configuration
   * @returns Alert manager response
   */
  async triggerAlert(config: AlertConfig): Promise<AlertManagerResponse> {
    try {
      const response = await fetch(`${this.config.alertManagerUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });

      const data = await response.json();

      if (response.ok && data.alertId) {
        // Capture alert for verification
        this.captureAlert(config);

        return {
          status: 'success',
          alertId: data.alertId,
        };
      }

      return {
        status: 'error',
        error: data.message || 'Unknown error',
      };
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Captures an alert for verification
   *
   * @param config - Alert configuration
   */
  private captureAlert(config: AlertConfig): void {
    const key = `${config.level}:${config.title}`;
    if (!this.capturedAlerts.has(key)) {
      this.capturedAlerts.set(key, []);
    }
    this.capturedAlerts.get(key)!.push({ ...config, metadata: { ...config.metadata, timestamp: new Date() } });
  }

  /**
   * Verifies an alert was fired
   *
   * @param level - Alert level
   * @param title - Alert title
   * @param timeoutMs - Timeout in milliseconds
   * @returns True if alert was found
   */
  async verifyAlertFired(
    level: AlertLevel,
    title: string,
    timeoutMs: number = 10000
  ): Promise<boolean> {
    const key = `${level}:${title}`;
    const startTime = Date.now();

    // Wait for alert to be captured
    while (Date.now() - startTime < timeoutMs) {
      if (this.capturedAlerts.has(key) && this.capturedAlerts.get(key)!.length > 0) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * Gets all captured alerts
   *
   * @returns Map of captured alerts
   */
  getCapturedAlerts(): Map<string, AlertConfig[]> {
    return new Map(this.capturedAlerts);
  }

  /**
   * Gets captured alerts by level
   *
   * @param level - Alert level
   * @returns Array of captured alerts
   */
  getAlertsByLevel(level: AlertLevel): AlertConfig[] {
    const alerts: AlertConfig[] = [];

    for (const [key, value] of this.capturedAlerts.entries()) {
      if (key.startsWith(`${level}:`)) {
        alerts.push(...value);
      }
    }

    return alerts;
  }

  /**
   * Gets captured alerts by title
   *
   * @param title - Alert title (supports partial match)
   * @returns Array of captured alerts
   */
  getAlertsByTitle(title: string): AlertConfig[] {
    const alerts: AlertConfig[] = [];

    for (const [key, value] of this.capturedAlerts.entries()) {
      if (key.includes(title)) {
        alerts.push(...value);
      }
    }

    return alerts;
  }

  /**
   * Clears captured alerts
   */
  clearCapturedAlerts(): void {
    this.capturedAlerts.clear();
  }

  /**
   * Clears a specific captured alert
   *
   * @param level - Alert level
   * @param title - Alert title
   */
  clearCapturedAlert(level: AlertLevel, title: string): void {
    const key = `${level}:${title}`;
    this.capturedAlerts.delete(key);
  }

  /**
   * Acknowledges an alert
   *
   * @param alertId - Alert ID
   * @returns True if successful
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.alertManagerUrl}/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clears all alerts from the alert manager
   *
   * @returns True if successful
   */
  async clearAllAlerts(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.alertManagerUrl}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });

      this.clearCapturedAlerts();

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Gets alert statistics from the alert manager
   *
   * @returns Alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    byLevel: Record<AlertLevel, number>;
    acknowledged: number;
    unacknowledged: number;
  } | null> {
    try {
      const response = await fetch(`${this.config.alertManagerUrl}/stats`, {
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
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
   * Triggers a test DLQ alert
   *
   * @param queueName - Queue name
   * @param messageCount - Message count
   * @returns Alert manager response
   */
  async triggerDLQAlert(
    queueName: string,
    messageCount: number
  ): Promise<AlertManagerResponse> {
    return this.triggerAlert({
      level: AlertLevel.CRITICAL,
      title: 'DLQ Alert',
      message: `Queue "${queueName}" has ${messageCount} messages in dead letter queue`,
      metadata: {
        queue_name: queueName,
        message_count: messageCount,
        alert_type: 'dlq',
      },
    });
  }

  /**
   * Triggers a test retry rate alert
   *
   * @param eventType - Event type
   * @param retryRate - Current retry rate
   * @param threshold - Threshold
   * @returns Alert manager response
   */
  async triggerRetryRateAlert(
    eventType: string,
    retryRate: number,
    threshold: number
  ): Promise<AlertManagerResponse> {
    return this.triggerAlert({
      level: AlertLevel.WARNING,
      title: 'High Retry Rate',
      message: `Event type "${eventType}" has retry rate of ${retryRate}/min (threshold: ${threshold})`,
      metadata: {
        event_type: eventType,
        retry_rate: retryRate,
        threshold,
        alert_type: 'retry_rate',
      },
    });
  }

  /**
   * Triggers a test circuit breaker alert
   *
   * @param serviceName - Service name
   * @param state - Circuit breaker state
   * @returns Alert manager response
   */
  async triggerCircuitBreakerAlert(
    serviceName: string,
    state: 'open' | 'half-open' | 'closed'
  ): Promise<AlertManagerResponse> {
    return this.triggerAlert({
      level: AlertLevel.CRITICAL,
      title: 'Circuit Breaker Alert',
      message: `Circuit breaker for "${serviceName}" is now ${state}`,
      metadata: {
        service_name: serviceName,
        circuit_state: state,
        alert_type: 'circuit_breaker',
      },
    });
  }

  /**
   * Triggers a test health degradation alert
   *
   * @param componentName - Component name
   * @param reason - Degradation reason
   * @returns Alert manager response
   */
  async triggerHealthDegradationAlert(
    componentName: string,
    reason: string
  ): Promise<AlertManagerResponse> {
    return this.triggerAlert({
      level: AlertLevel.WARNING,
      title: 'Health Degradation',
      message: `Component "${componentName}" is degraded: ${reason}`,
      metadata: {
        component_name: componentName,
        reason,
        alert_type: 'health_degradation',
      },
    });
  }

  /**
   * Creates a mock alert server for testing
   *
   * @param port - Port to listen on
   * @returns Server close function
   */
  createMockAlertServer(port: number = 3001): () => void {
    const alerts: any[] = [];

    // This would normally start an HTTP server
    // For test purposes, we'll return a cleanup function
    console.log(`[AlertHelper] Mock alert server would start on port ${port}`);

    return () => {
      console.log(`[AlertHelper] Mock alert server stopped`);
      alerts.length = 0;
    };
  }
}

/**
 * Factory function to create an alert helper
 *
 * @param config - Helper configuration
 * @returns AlertHelper instance
 */
export function createAlertHelper(config?: AlertHelperConfig): AlertHelper {
  return new AlertHelper(config);
}

export default AlertHelper;
