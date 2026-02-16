/**
 * Process Notification Queue Use Case
 * Picks pending notifications and dispatches them through appropriate channel providers
 *
 * Application service for batch processing
 */
import { Logger } from 'winston';
import { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import { NotificationDispatcher } from '../../domain/services/NotificationDispatcher';

interface NotificationBatchRepositoryPort {
  findOne(options: { where: { id: string } }): Promise<{
    id: string;
    totalCount: number;
    sentCount: number;
    failedCount: number;
  } | null>;
  increment(criteria: { id: string }, propertyPath: string, value: number): Promise<unknown>;
  update(criteria: { id: string }, partial: Record<string, unknown>): Promise<unknown>;
}

interface BatchProgressDelta {
  sent: number;
  failed: number;
}

/**
 * Process pending notifications from queue
 *
 * Workflow:
 * 1. Find pending notifications (limit to batch size)
 * 2. For each notification:
 *    - Mark as SENDING
 *    - Dispatch through provider
 *    - Mark as SENT or FAILED
 *    - Handle retries on failure
 * 3. Publish events
 * 4. Return statistics
 */
export class ProcessNotificationQueue {
  private static readonly BATCH_SIZE = 100;

  constructor(
    private notificationRepository: INotificationRepository,
    private dispatcher: NotificationDispatcher,
    private logger: Logger,
    private eventBus: {
      publish(channel: string, data: unknown): Promise<void>;
    },
    private batchRepository?: NotificationBatchRepositoryPort
  ) {}

  private getBatchId(notification: unknown): string | undefined {
    if (!notification || typeof notification !== 'object') {
      return undefined;
    }

    const metadata = (notification as { metadata?: Record<string, unknown> }).metadata;
    const batchId = metadata?.batchId;

    return typeof batchId === 'string' && batchId.length > 0 ? batchId : undefined;
  }

  private bumpBatchCounter(
    batchProgress: Map<string, BatchProgressDelta>,
    batchId: string | undefined,
    counter: 'sent' | 'failed'
  ): void {
    if (!batchId) {
      return;
    }

    const current = batchProgress.get(batchId) || { sent: 0, failed: 0 };
    current[counter] += 1;
    batchProgress.set(batchId, current);
  }

  private async persistBatchProgress(batchProgress: Map<string, BatchProgressDelta>): Promise<void> {
    if (!this.batchRepository || batchProgress.size === 0) {
      return;
    }

    for (const [batchId, delta] of batchProgress.entries()) {
      try {
        const current = await this.batchRepository.findOne({ where: { id: batchId } });

        if (!current) {
          this.logger.warn('Notification batch not found while updating progress', {
            batchId,
          });
          continue;
        }

        if (delta.sent > 0) {
          await this.batchRepository.increment({ id: batchId }, 'sentCount', delta.sent);
        }

        if (delta.failed > 0) {
          await this.batchRepository.increment({ id: batchId }, 'failedCount', delta.failed);
        }

        const batch = await this.batchRepository.findOne({ where: { id: batchId } });
        if (!batch) {
          continue;
        }

        const sentCount = batch.sentCount;
        const failedCount = batch.failedCount;
        const processedCount = sentCount + failedCount;
        const isCompleted = batch.totalCount > 0 && processedCount >= batch.totalCount;

        await this.batchRepository.update(
          { id: batchId },
          {
            sentCount,
            failedCount,
            status: isCompleted
              ? (failedCount > 0 ? 'FAILED' : 'COMPLETED')
              : 'PROCESSING',
            completedAt: isCompleted ? new Date() : null,
          }
        );
      } catch (error) {
        this.logger.error('Failed to persist notification batch progress', {
          batchId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Execute the use case
   *
   * @param batchSize - Optional batch size (default 100)
   * @returns Statistics object with processed count
   */
  async execute(batchSize?: number): Promise<{
    processed: number;
    sent: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const size = batchSize || ProcessNotificationQueue.BATCH_SIZE;

    this.logger.info('ProcessNotificationQueue started', { batchSize: size });

    // Find pending notifications
    const pending = await this.notificationRepository.findPending(size);

    if (pending.length === 0) {
      this.logger.debug('No pending notifications to process');
      return {
        processed: 0,
        sent: 0,
        failed: 0,
        duration: Date.now() - startTime,
      };
    }

    this.logger.info(`Processing ${pending.length} pending notifications`);

    let sent = 0;
    let failed = 0;
    const batchProgress = new Map<string, BatchProgressDelta>();

    for (const notification of pending) {
      const batchId = this.getBatchId(notification);

      try {
        // Check if notification is expired
        if (notification.isExpired()) {
          this.logger.warn('Notification expired, skipping', {
            notificationId: notification.id,
          });
          await this.notificationRepository.updateStatus(notification.id, 'FAILED');
          await this.eventBus.publish('notification.expired', {
            notificationId: notification.id,
          });
          failed++;
          this.bumpBatchCounter(batchProgress, batchId, 'failed');
          continue;
        }

        // Check if ready to send (scheduled time passed)
        if (!notification.isReadyToSend()) {
          this.logger.debug('Notification not ready to send yet', {
            notificationId: notification.id,
            scheduledAt: notification.toJSON().scheduledAt,
          });
          continue;
        }

        // Mark as sending
        if (notification.getStatus() === 'PENDING') {
          notification.queue();
        }
        notification.markAsSending();
        await this.notificationRepository.update(notification);

        // Dispatch through provider
        try {
          const result = await this.dispatcher.dispatch(notification);

          // Mark as sent
          notification.markAsSent();
          await this.notificationRepository.update(notification);

          this.logger.info('Notification sent successfully', {
            notificationId: notification.id,
            channel: notification.channel,
            messageId: result.messageId,
          });

          // Publish event
          await this.eventBus.publish('notification.sent', {
            notificationId: notification.id,
            recipientId: notification.recipientId,
            channel: notification.channel,
            messageId: result.messageId,
            sentAt: new Date(),
          });

          sent++;
          this.bumpBatchCounter(batchProgress, batchId, 'sent');
        } catch (dispatchError) {
          const reason =
            dispatchError instanceof Error ? dispatchError.message : String(dispatchError);

          // Mark as failed
          notification.markAsFailed(reason);
          await this.notificationRepository.update(notification);

          this.logger.error('Notification dispatch failed', {
            notificationId: notification.id,
            channel: notification.channel,
            error: reason,
            canRetry: notification.canRetry(),
          });

          // Publish event
          await this.eventBus.publish('notification.failed', {
            notificationId: notification.id,
            recipientId: notification.recipientId,
            channel: notification.channel,
            reason,
            canRetry: notification.canRetry(),
            failedAt: new Date(),
          });

          failed++;
          this.bumpBatchCounter(batchProgress, batchId, 'failed');
        }
      } catch (error) {
        this.logger.error('Unexpected error processing notification', {
          notificationId: notification.id,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
        this.bumpBatchCounter(batchProgress, batchId, 'failed');
      }
    }

    await this.persistBatchProgress(batchProgress);

    const duration = Date.now() - startTime;

    this.logger.info('ProcessNotificationQueue completed', {
      processed: pending.length,
      sent,
      failed,
      duration,
    });

    return {
      processed: pending.length,
      sent,
      failed,
      duration,
    };
  }
}
