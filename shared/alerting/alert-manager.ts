/**
 * Alert Manager - Central alert dispatch system
 * Supports multiple channels: webhooks (Slack/Discord), email (SMTP), PagerDuty, and fallback logging
 * Features: deduplication, throttling, escalation, multi-level severity
 *
 * @module shared/alerting/alert-manager
 */

import { createModuleLogger } from '../utils/logger';
import * as crypto from 'crypto';

const logger = createModuleLogger('alert-manager');

/**
 * Alert severity levels
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  escalatedAt?: Date;
}

/**
 * Alert channel interface - must be implemented by all channel providers
 */
export interface IAlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

/**
 * Webhook channel for Slack/Discord integration
 */
export class WebhookChannel implements IAlertChannel {
  name = 'webhook';
  private webhookUrl: string;
  private color: Record<AlertLevel, string> = {
    [AlertLevel.INFO]: '#36a64f',
    [AlertLevel.WARNING]: '#ff9900',
    [AlertLevel.CRITICAL]: '#ff0000',
    [AlertLevel.EMERGENCY]: '#8b0000',
  };

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.ALERT_WEBHOOK_URL || '';
  }

  async send(alert: Alert): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('WebhookChannel: No webhook URL configured, skipping');
      return;
    }

    try {
      const payload = {
        attachments: [
          {
            color: this.color[alert.level],
            title: `[${alert.level.toUpperCase()}] ${alert.title}`,
            text: alert.message,
            fields: [
              {
                title: 'Alert ID',
                value: alert.id,
                short: true,
              },
              {
                title: 'Timestamp',
                value: alert.timestamp.toISOString(),
                short: true,
              },
            ],
            mrkdwn_in: ['text'],
          },
        ],
      };

      if (alert.metadata) {
        const fields = Object.entries(alert.metadata)
          .slice(0, 5) // Limit to 5 metadata fields
          .map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true,
          }));

        if (payload.attachments[0]) {
          payload.attachments[0].fields.push(...fields);
        }
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}`);
      }

      logger.info('WebhookChannel: Alert sent successfully', { alertId: alert.id });
    } catch (error) {
      logger.error('WebhookChannel: Failed to send alert', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Email channel for SMTP integration
 * Requires nodemailer - expects to be injected or configured via env vars
 */
export class EmailChannel implements IAlertChannel {
  name = 'email';
  private recipientEmail: string;
  private smtpConfigured: boolean = false;
  private mailer: any = null;

  constructor(recipientEmail?: string) {
    this.recipientEmail = recipientEmail || process.env.ALERT_EMAIL_TO || '';
    this.smtpConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USERNAME &&
      process.env.SMTP_PASSWORD
    );

    // Try to require nodemailer if SMTP is configured
    if (this.smtpConfigured) {
      try {
        const nodemailer = require('nodemailer');
        this.mailer = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_USE_TLS === 'true',
          auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD,
          },
        });
      } catch (error) {
        logger.warn('EmailChannel: nodemailer not available or configuration failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async send(alert: Alert): Promise<void> {
    if (!this.recipientEmail || !this.mailer) {
      logger.warn('EmailChannel: Email not configured, skipping');
      return;
    }

    try {
      const htmlBody = `
        <h2>[${alert.level.toUpperCase()}] ${alert.title}</h2>
        <p>${alert.message}</p>
        <div style="margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
          <p><strong>Alert ID:</strong> ${alert.id}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
          ${
            alert.metadata
              ? `<p><strong>Details:</strong></p><pre>${JSON.stringify(alert.metadata, null, 2)}</pre>`
              : ''
          }
        </div>
      `;

      await this.mailer.sendMail({
        from: process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USERNAME,
        to: this.recipientEmail,
        subject: `[${alert.level.toUpperCase()}] ${alert.title}`,
        html: htmlBody,
      });

      logger.info('EmailChannel: Alert email sent', { alertId: alert.id, to: this.recipientEmail });
    } catch (error) {
      logger.error('EmailChannel: Failed to send email', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Log channel - fallback logger implementation
 */
export class LogChannel implements IAlertChannel {
  name = 'log';

  async send(alert: Alert): Promise<void> {
    const logLevel = alert.level === AlertLevel.EMERGENCY ? 'error' : alert.level === AlertLevel.CRITICAL ? 'error' : alert.level === AlertLevel.WARNING ? 'warn' : 'info';

    const logFn = logger[logLevel as keyof typeof logger] || logger.info;
    logFn.call(logger, `[${alert.level.toUpperCase()}] ${alert.title}`, {
      alertId: alert.id,
      message: alert.message,
      metadata: alert.metadata,
    });
  }
}

/**
 * PagerDuty channel for incident management
 */
export class PagerDutyChannel implements IAlertChannel {
  name = 'pagerduty';
  private integrationKey: string;
  private apiUrl = 'https://events.pagerduty.com/v2/enqueue';

  constructor(integrationKey?: string) {
    this.integrationKey = integrationKey || process.env.ALERT_PAGERDUTY_KEY || '';
  }

  async send(alert: Alert): Promise<void> {
    if (!this.integrationKey) {
      logger.warn('PagerDutyChannel: No integration key configured, skipping');
      return;
    }

    try {
      const severity =
        alert.level === AlertLevel.EMERGENCY
          ? 'critical'
          : alert.level === AlertLevel.CRITICAL
            ? 'error'
            : alert.level === AlertLevel.WARNING
              ? 'warning'
              : 'info';

      const payload = {
        routing_key: this.integrationKey,
        event_action: 'trigger',
        dedup_key: alert.id,
        payload: {
          summary: alert.title,
          severity,
          source: 'CYPHER ERP',
          custom_details: {
            message: alert.message,
            ...alert.metadata,
          },
          timestamp: alert.timestamp.toISOString(),
        },
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API returned status ${response.status}`);
      }

      logger.info('PagerDutyChannel: Alert sent', { alertId: alert.id });
    } catch (error) {
      logger.error('PagerDutyChannel: Failed to send alert', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Central Alert Manager
 * Handles alert dispatch, deduplication, throttling, and escalation
 */
export class AlertManager {
  private static instance: AlertManager | null = null;
  private channels: Map<string, IAlertChannel> = new Map();
  private deduplicationWindow = 5 * 60 * 1000; // 5 minutes
  private recentAlerts: Map<string, Date> = new Map();
  private escalationWindow = 15 * 60 * 1000; // 15 minutes
  private pendingAlerts: Map<string, Alert> = new Map();

  private constructor() {
    this.initializeChannels();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Initialize default channels
   */
  private initializeChannels(): void {
    // Always add log channel as fallback
    this.channels.set('log', new LogChannel());

    // Add webhook channel if configured
    if (process.env.ALERT_WEBHOOK_URL) {
      this.channels.set('webhook', new WebhookChannel());
    }

    // Add email channel if configured
    if (process.env.ALERT_EMAIL_TO) {
      this.channels.set('email', new EmailChannel());
    }

    // Add PagerDuty channel if configured
    if (process.env.ALERT_PAGERDUTY_KEY) {
      this.channels.set('pagerduty', new PagerDutyChannel());
    }

    logger.info('AlertManager initialized with channels', {
      channels: Array.from(this.channels.keys()),
    });
  }

  /**
   * Register a custom alert channel
   */
  registerChannel(channel: IAlertChannel): void {
    this.channels.set(channel.name, channel);
    logger.info('Alert channel registered', { channelName: channel.name });
  }

  /**
   * Send an alert
   * @param level Alert severity level
   * @param title Alert title
   * @param message Alert message
   * @param metadata Additional alert metadata
   */
  async sendAlert(
    level: AlertLevel,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const alertHash = this.hashAlert(level, title);
    const now = Date.now();

    // Check deduplication
    const lastAlertTime = this.recentAlerts.get(alertHash);
    if (lastAlertTime && now - lastAlertTime.getTime() < this.deduplicationWindow) {
      logger.debug('Alert deduplicated', {
        title,
        level,
        lastSentMs: now - lastAlertTime.getTime(),
      });
      return;
    }

    // Create alert
    const alert: Alert = {
      id: crypto.randomUUID(),
      level,
      title,
      message,
      metadata,
      timestamp: new Date(),
      acknowledged: false,
    };

    // Store for escalation tracking
    this.pendingAlerts.set(alert.id, alert);

    // Record this alert
    this.recentAlerts.set(alertHash, new Date());

    // Send to all configured channels
    const sendPromises = Array.from(this.channels.values()).map(channel =>
      channel.send(alert).catch(error => {
        logger.error('Channel send failed', {
          channel: channel.name,
          alertId: alert.id,
          error,
        });
      })
    );

    await Promise.all(sendPromises);

    // Schedule escalation if critical
    if (level === AlertLevel.CRITICAL) {
      this.scheduleEscalation(alert);
    }

    logger.info('Alert sent', {
      alertId: alert.id,
      level,
      title,
      channelsNotified: this.channels.size,
    });
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.pendingAlerts.get(alertId);
    if (!alert) {
      logger.warn('Alert not found for acknowledgment', { alertId });
      return;
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy,
      originalLevel: alert.level,
    });
  }

  /**
   * Schedule escalation for unacknowledged critical alerts
   */
  private scheduleEscalation(alert: Alert): void {
    setTimeout(
      () => {
        const pendingAlert = this.pendingAlerts.get(alert.id);
        if (pendingAlert && !pendingAlert.acknowledged) {
          logger.warn('Alert escalating to EMERGENCY', {
            alertId: alert.id,
            originalTitle: alert.title,
          });

          // Escalate to emergency level
          pendingAlert.level = AlertLevel.EMERGENCY;
          pendingAlert.escalatedAt = new Date();

          // Resend to all channels with emergency level
          Array.from(this.channels.values()).forEach(channel => {
            channel.send(pendingAlert).catch(error => {
              logger.error('Failed to send escalated alert', {
                channel: channel.name,
                alertId: alert.id,
                error,
              });
            });
          });
        }
      },
      this.escalationWindow
    );
  }

  /**
   * Hash alert for deduplication
   */
  private hashAlert(level: AlertLevel, title: string): string {
    return crypto
      .createHash('md5')
      .update(`${level}:${title}`)
      .digest('hex');
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    totalChannels: number;
    recentAlertsCount: number;
    pendingAlertsCount: number;
  } {
    return {
      totalChannels: this.channels.size,
      recentAlertsCount: this.recentAlerts.size,
      pendingAlertsCount: this.pendingAlerts.size,
    };
  }

  /**
   * Clear old deduplication entries
   */
  cleanupDeduplication(): void {
    const now = Date.now();
    let clearedCount = 0;

    for (const [hash, timestamp] of this.recentAlerts.entries()) {
      if (now - timestamp.getTime() > this.deduplicationWindow) {
        this.recentAlerts.delete(hash);
        clearedCount++;
      }
    }

    // Also cleanup pending alerts older than escalation window
    for (const [id, alert] of this.pendingAlerts.entries()) {
      if (alert.acknowledged && now - alert.acknowledgedAt!.getTime() > this.escalationWindow) {
        this.pendingAlerts.delete(id);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.debug('Deduplication cache cleaned', { entriesRemoved: clearedCount });
    }
  }
}

/**
 * Get singleton AlertManager instance
 */
export function getAlertManager(): AlertManager {
  return AlertManager.getInstance();
}

/**
 * Convenience function for sending alerts
 */
export async function sendAlert(
  level: AlertLevel,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return getAlertManager().sendAlert(level, title, message, metadata);
}

export default AlertManager;
