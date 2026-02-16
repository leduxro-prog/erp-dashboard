/**
 * Webhook Retry Worker
 * Processes failed webhooks with exponential backoff retry mechanism
 */

import { CronJob } from 'cron';
import { WebhookReliabilityService } from '../../application/services/WebhookReliabilityService';
import {
  WebhookEventLogEntity,
  WebhookStatus,
} from '../../infrastructure/entities/WebhookEventLogEntity';
import { WebhookEventTransformer } from '../../application/transformers/WebhookEventTransformer';
import { OutboxEventPublisher } from '../outbox/OutboxEventPublisher';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('webhook-retry-worker');

/**
 * Retry worker configuration
 */
export interface RetryWorkerConfig {
  enabled: boolean;
  cronPattern: string;
  batchSize: number;
  maxConcurrentRetries: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RetryWorkerConfig = {
  enabled: true,
  cronPattern: '*/1 * * * *', // Every minute
  batchSize: 50,
  maxConcurrentRetries: 10,
};

/**
 * Result of retrying a webhook
 */
export interface RetryResult {
  webhookLogId: string;
  success: boolean;
  error?: string;
}

/**
 * Webhook retry worker with exponential backoff
 */
export class WebhookRetryWorker {
  private cronJob?: CronJob;
  private isRunning = false;
  private config: RetryWorkerConfig;

  constructor(
    private webhookReliabilityService: WebhookReliabilityService,
    private eventTransformer: WebhookEventTransformer,
    private outboxPublisher: OutboxEventPublisher,
    config?: Partial<RetryWorkerConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the retry worker
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Retry worker already started');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Retry worker disabled in configuration');
      return;
    }

    logger.info('Starting webhook retry worker', {
      cronPattern: this.config.cronPattern,
      batchSize: this.config.batchSize,
    });

    this.cronJob = new CronJob(
      this.config.cronPattern,
      async () => {
        if (this.isRunning) {
          logger.debug('Retry worker already running, skipping this cycle');
          return;
        }

        await this.processRetryBatch();
      },
      null,
      true,
      'UTC',
    );
  }

  /**
   * Stop the retry worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
      logger.info('Webhook retry worker stopped');
    }
  }

  /**
   * Process a batch of failed webhooks
   */
  private async processRetryBatch(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Processing retry batch');

      // Get webhooks ready for retry
      const webhooks = await this.getWebhooksForRetry();

      if (webhooks.length === 0) {
        logger.debug('No webhooks ready for retry');
        return;
      }

      logger.info(`Found ${webhooks.length} webhooks for retry`);

      // Process webhooks with concurrency limit
      const results = await this.processWithConcurrencyLimit(webhooks);

      // Report results
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      const duration = Date.now() - startTime;

      logger.info('Retry batch processed', {
        total: webhooks.length,
        successful,
        failed,
        duration,
      });
    } catch (error: any) {
      logger.error('Error processing retry batch', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get webhooks that are ready for retry
   * (failed status with next_retry_at in the past)
   */
  private async getWebhooksForRetry(): Promise<WebhookEventLogEntity[]> {
    // Use the service's method but filter by next_retry_at
    const allFailed = await this.webhookReliabilityService.getWebhooksForRetry();

    const now = new Date();
    return allFailed.filter((webhook) => {
      return webhook.next_retry_at && webhook.next_retry_at <= now;
    });
  }

  /**
   * Process webhooks with concurrency limit
   */
  private async processWithConcurrencyLimit(
    webhooks: WebhookEventLogEntity[],
  ): Promise<RetryResult[]> {
    const results: RetryResult[] = [];
    const batches: WebhookEventLogEntity[][] = [];

    // Split into batches based on max concurrency
    for (let i = 0; i < webhooks.length; i += this.config.maxConcurrentRetries) {
      batches.push(webhooks.slice(i, i + this.config.maxConcurrentRetries));
    }

    // Process batches sequentially
    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map((webhook) => this.retryWebhook(webhook)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Retry a single webhook
   */
  private async retryWebhook(webhook: WebhookEventLogEntity): Promise<RetryResult> {
    const webhookLogId = webhook.id;

    try {
      logger.debug('Retrying webhook', {
        webhookLogId,
        topic: webhook.topic,
        webhook_id: webhook.webhook_id,
        attemptCount: webhook.retry_count + 1,
      });

      // Update status to processing
      await this.webhookReliabilityService['webhookLogRepo'].update(webhookLogId, {
        status: WebhookStatus.PROCESSING,
      });

      // Transform to ERP domain event
      const domainEvent = this.eventTransformer.transform(
        webhook.topic,
        webhook.payload,
        webhook.webhook_id,
      );

      if (!domainEvent) {
        throw new Error('Event transformation returned null');
      }

      // Publish to outbox
      const publishResult = await this.outboxPublisher.publish(domainEvent);

      if (!publishResult.success) {
        throw new Error(publishResult.error || 'Failed to publish to outbox');
      }

      // Mark as completed
      await this.webhookReliabilityService['webhookLogRepo'].update(webhookLogId, {
        status: WebhookStatus.COMPLETED,
        processed_at: new Date(),
      });

      logger.info('Webhook retry successful', {
        webhookLogId,
        topic: webhook.topic,
      });

      return {
        webhookLogId,
        success: true,
      };
    } catch (error: any) {
      logger.error('Webhook retry failed', {
        webhookLogId,
        topic: webhook.topic,
        error: error.message,
      });

      // Calculate next retry with exponential backoff
      const newRetryCount = webhook.retry_count + 1;
      const delayMs = 1000 * Math.pow(2, newRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await this.webhookReliabilityService['webhookLogRepo'].update(webhookLogId, {
        status: WebhookStatus.FAILED,
        retry_count: newRetryCount,
        error_message: error.message,
        last_retry_at: new Date(),
        next_retry_at: nextRetryAt,
      });

      return {
        webhookLogId,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Trigger a manual retry (for admin operations)
   */
  async manualRetry(webhookLogId: string): Promise<RetryResult> {
    const webhook = await this.webhookReliabilityService.getWebhookLog(webhookLogId);

    if (!webhook) {
      return {
        webhookLogId,
        success: false,
        error: 'Webhook log not found',
      };
    }

    return this.retryWebhook(webhook);
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    config: RetryWorkerConfig;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }
}
