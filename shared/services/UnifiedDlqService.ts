/**
 * Unified DLQ (Dead Letter Queue) and Replay Service
 *
 * Provides a single DLQ/replay mechanism for all integration points:
 *   - WooCommerce webhooks (woocommerce_webhook_logs with status='dead_letter')
 *   - SmartBill API failures (smartbill_invoices/proformas with status='failed')
 *   - Outbox events (shared.dead_letter_queue, shared.outbox_events with status='discarded')
 *
 * Supports:
 *   - Exponential backoff with jitter
 *   - Configurable max retries per source
 *   - Unified replay API for operators
 *   - Metrics export for monitoring
 */

import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('unified-dlq');

/**
 * DLQ entry from any source
 */
export interface DlqEntry {
  id: string;
  source: 'woocommerce' | 'smartbill' | 'outbox';
  eventType: string;
  payload: Record<string, any>;
  errorMessage: string;
  failureCount: number;
  canRetry: boolean;
  createdAt: Date;
  nextRetryAt: Date | null;
}

/**
 * Replay result
 */
export interface ReplayResult {
  id: string;
  source: string;
  success: boolean;
  message: string;
}

/**
 * DLQ statistics
 */
export interface DlqStats {
  woocommerce: { total: number; retryable: number };
  smartbill: { total: number; retryable: number };
  outbox: { total: number; retryable: number };
  totalPending: number;
}

/**
 * Retry backoff configuration
 */
export interface RetryBackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  maxRetries: number;
  jitterRatio: number;
}

const DEFAULT_BACKOFF: RetryBackoffConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  maxRetries: 5,
  jitterRatio: 0.2,
};

/**
 * Calculate next retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryBackoffConfig = DEFAULT_BACKOFF,
): number {
  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelayMs);

  // Add jitter
  const jitterRange = delay * config.jitterRatio;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;
  delay = Math.max(0, Math.floor(delay + jitter));

  return delay;
}

/**
 * Unified DLQ Service
 */
export class UnifiedDlqService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly backoffConfig: RetryBackoffConfig = DEFAULT_BACKOFF,
  ) {}

  /**
   * Move a failed WooCommerce webhook to DLQ (dead_letter status)
   */
  async moveWooWebhookToDlq(webhookId: string, errorMessage: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE woocommerce_webhook_logs
       SET status = 'dead_letter',
           error_message = $1,
           next_retry_at = NULL
       WHERE webhook_id = $2
         AND retry_count >= $3`,
      [errorMessage, webhookId, this.backoffConfig.maxRetries],
    );
    logger.info('WooCommerce webhook moved to DLQ', { webhookId });
  }

  /**
   * Schedule a WooCommerce webhook retry with backoff
   */
  async scheduleWooWebhookRetry(
    webhookId: string,
    retryCount: number,
    errorMessage: string,
  ): Promise<void> {
    if (retryCount >= this.backoffConfig.maxRetries) {
      await this.moveWooWebhookToDlq(webhookId, errorMessage);
      return;
    }

    const delayMs = calculateRetryDelay(retryCount, this.backoffConfig);
    const nextRetryAt = new Date(Date.now() + delayMs);

    await this.dataSource.query(
      `UPDATE woocommerce_webhook_logs
       SET status = 'failed',
           error_message = $1,
           retry_count = $2,
           last_retry_at = NOW(),
           next_retry_at = $3
       WHERE webhook_id = $4`,
      [errorMessage, retryCount, nextRetryAt, webhookId],
    );

    logger.info('WooCommerce webhook retry scheduled', {
      webhookId,
      retryCount,
      nextRetryAt: nextRetryAt.toISOString(),
      delayMs,
    });
  }

  /**
   * Get unified DLQ statistics across all sources
   */
  async getStats(): Promise<DlqStats> {
    const [wooStats] = await this.dataSource
      .query(
        `
      SELECT
        COUNT(*) FILTER (WHERE status = 'dead_letter') AS total,
        COUNT(*) FILTER (WHERE status = 'failed' AND next_retry_at IS NOT NULL) AS retryable
      FROM woocommerce_webhook_logs
    `,
      )
      .catch(() => [{ total: 0, retryable: 0 }]);

    const [sbStats] = await this.dataSource
      .query(
        `
      SELECT
        COUNT(*) FILTER (WHERE status = 'failed') AS total,
        0 AS retryable
      FROM smartbill_invoices
    `,
      )
      .catch(() => [{ total: 0, retryable: 0 }]);

    const [outboxStats] = await this.dataSource
      .query(
        `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE can_retry = true) AS retryable
      FROM shared.dead_letter_queue
      WHERE resolution_status = 'pending'
    `,
      )
      .catch(() => [{ total: 0, retryable: 0 }]);

    return {
      woocommerce: {
        total: parseInt(wooStats.total) || 0,
        retryable: parseInt(wooStats.retryable) || 0,
      },
      smartbill: {
        total: parseInt(sbStats.total) || 0,
        retryable: parseInt(sbStats.retryable) || 0,
      },
      outbox: {
        total: parseInt(outboxStats.total) || 0,
        retryable: parseInt(outboxStats.retryable) || 0,
      },
      totalPending:
        (parseInt(wooStats.total) || 0) +
        (parseInt(sbStats.total) || 0) +
        (parseInt(outboxStats.total) || 0),
    };
  }

  /**
   * List DLQ entries from all sources
   */
  async listEntries(options?: {
    source?: 'woocommerce' | 'smartbill' | 'outbox';
    limit?: number;
    offset?: number;
  }): Promise<DlqEntry[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const entries: DlqEntry[] = [];

    if (!options?.source || options.source === 'woocommerce') {
      const wooEntries = await this.dataSource
        .query(
          `
        SELECT id, webhook_id, topic, payload, error_message, retry_count,
               status, created_at, next_retry_at
        FROM woocommerce_webhook_logs
        WHERE status IN ('dead_letter', 'failed')
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `,
          [limit, offset],
        )
        .catch(() => []);

      for (const e of wooEntries) {
        entries.push({
          id: e.webhook_id,
          source: 'woocommerce',
          eventType: e.topic,
          payload: e.payload,
          errorMessage: e.error_message || '',
          failureCount: e.retry_count,
          canRetry: e.status === 'failed',
          createdAt: e.created_at,
          nextRetryAt: e.next_retry_at,
        });
      }
    }

    if (!options?.source || options.source === 'outbox') {
      const outboxEntries = await this.dataSource
        .query(
          `
        SELECT id, original_event_id, original_event_type, original_payload,
               error_message, failure_count, can_retry, created_at, retry_after
        FROM shared.dead_letter_queue
        WHERE resolution_status = 'pending'
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `,
          [limit, offset],
        )
        .catch(() => []);

      for (const e of outboxEntries) {
        entries.push({
          id: e.original_event_id,
          source: 'outbox',
          eventType: e.original_event_type,
          payload: e.original_payload,
          errorMessage: e.error_message || '',
          failureCount: e.failure_count,
          canRetry: e.can_retry,
          createdAt: e.created_at,
          nextRetryAt: e.retry_after,
        });
      }
    }

    return entries;
  }

  /**
   * Replay a failed webhook by resetting its status to 'pending'
   */
  async replayWooWebhook(webhookId: string): Promise<ReplayResult> {
    const result = await this.dataSource.query(
      `UPDATE woocommerce_webhook_logs
       SET status = 'pending', retry_count = 0, error_message = NULL, next_retry_at = NULL
       WHERE webhook_id = $1 AND status IN ('dead_letter', 'failed')
       RETURNING webhook_id`,
      [webhookId],
    );

    if (result.length === 0) {
      return {
        id: webhookId,
        source: 'woocommerce',
        success: false,
        message: 'Entry not found or not in DLQ',
      };
    }

    logger.info('WooCommerce webhook replayed', { webhookId });
    return {
      id: webhookId,
      source: 'woocommerce',
      success: true,
      message: 'Replayed successfully',
    };
  }

  /**
   * Replay a failed outbox event
   */
  async replayOutboxEvent(eventId: string): Promise<ReplayResult> {
    // Reset outbox event to pending for re-processing
    const result = await this.dataSource.query(
      `UPDATE shared.outbox_events
       SET status = 'pending', attempts = 0, next_attempt_at = NOW(), error_message = NULL
       WHERE event_id = $1::uuid AND status IN ('failed', 'discarded')
       RETURNING event_id`,
      [eventId],
    );

    if (result.length === 0) {
      return {
        id: eventId,
        source: 'outbox',
        success: false,
        message: 'Outbox event not found or not in failed state',
      };
    }

    // Also mark DLQ entry as resolved
    await this.dataSource
      .query(
        `UPDATE shared.dead_letter_queue
       SET resolution_status = 'resolved', resolved_at = NOW(), resolution_notes = 'Replayed via unified DLQ'
       WHERE original_event_id = $1::uuid AND resolution_status = 'pending'`,
        [eventId],
      )
      .catch(() => {});

    logger.info('Outbox event replayed', { eventId });
    return { id: eventId, source: 'outbox', success: true, message: 'Replayed successfully' };
  }

  /**
   * Bulk replay all retryable entries from a source
   */
  async replayAll(source: 'woocommerce' | 'outbox'): Promise<{ replayed: number; failed: number }> {
    let replayed = 0;
    let failed = 0;

    if (source === 'woocommerce') {
      const entries = await this.dataSource.query(
        `SELECT webhook_id FROM woocommerce_webhook_logs
         WHERE status = 'failed' AND next_retry_at <= NOW()
         LIMIT 100`,
      );

      for (const entry of entries) {
        const result = await this.replayWooWebhook(entry.webhook_id);
        if (result.success) replayed++;
        else failed++;
      }
    } else if (source === 'outbox') {
      const entries = await this.dataSource
        .query(
          `SELECT event_id FROM shared.outbox_events
         WHERE status IN ('failed', 'discarded')
           AND next_attempt_at <= NOW()
         LIMIT 100`,
        )
        .catch(() => []);

      for (const entry of entries) {
        const result = await this.replayOutboxEvent(entry.event_id);
        if (result.success) replayed++;
        else failed++;
      }
    }

    logger.info('Bulk replay completed', { source, replayed, failed });
    return { replayed, failed };
  }
}
