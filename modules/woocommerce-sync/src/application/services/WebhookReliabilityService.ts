/**
 * Webhook Reliability Service
 * Handles webhook signature verification, idempotency, and retry logic.
 */

import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { WebhookEventLogEntity, WebhookStatus } from '../../infrastructure/entities/WebhookEventLogEntity';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

export interface WebhookPayload {
    id: string;
    topic: string;
    data: Record<string, any>;
    signature?: string;
    timestamp?: string;
}

export interface WebhookProcessingResult {
    success: boolean;
    isDuplicate: boolean;
    webhookLogId?: string;
    error?: string;
}

export class WebhookReliabilityService {
    private webhookLogRepo: Repository<WebhookEventLogEntity>;

    constructor(
        private dataSource: DataSource,
        private webhookSecret: string
    ) {
        this.webhookLogRepo = dataSource.getRepository(WebhookEventLogEntity);
    }

    /**
     * Verify the HMAC-SHA256 signature of a WooCommerce webhook.
     */
    verifySignature(payload: string, signature: string): boolean {
        if (!signature || !this.webhookSecret) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(payload, 'utf8')
            .digest('base64');

        // Use timing-safe comparison to prevent timing attacks
        try {
            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch {
            return false;
        }
    }

    /**
     * Check if a webhook has already been processed (idempotency).
     */
    async isDuplicate(webhookId: string): Promise<boolean> {
        const existing = await this.webhookLogRepo.findOne({
            where: { webhook_id: webhookId },
        });
        return existing !== null;
    }

    /**
     * Log a webhook event for processing.
     */
    async logWebhookEvent(webhook: WebhookPayload, signatureVerified: boolean): Promise<WebhookEventLogEntity> {
        const log = this.webhookLogRepo.create({
            webhook_id: webhook.id,
            topic: webhook.topic,
            payload: webhook.data,
            status: WebhookStatus.PENDING,
            signature_verified: signatureVerified,
        });

        return await this.webhookLogRepo.save(log);
    }

    /**
     * Mark webhook as processing.
     */
    async markProcessing(webhookLogId: string): Promise<void> {
        await this.webhookLogRepo.update(webhookLogId, {
            status: WebhookStatus.PROCESSING,
        });
    }

    /**
     * Mark webhook as completed.
     */
    async markCompleted(webhookLogId: string): Promise<void> {
        await this.webhookLogRepo.update(webhookLogId, {
            status: WebhookStatus.COMPLETED,
            processed_at: new Date(),
        });
    }

    /**
     * Mark webhook as failed and schedule retry with exponential backoff.
     */
    async markFailed(webhookLogId: string, error: string): Promise<boolean> {
        const log = await this.webhookLogRepo.findOne({ where: { id: webhookLogId } });
        if (!log) return false;

        const newRetryCount = log.retry_count + 1;

        if (newRetryCount >= MAX_RETRIES) {
            // Move to dead letter queue
            await this.webhookLogRepo.update(webhookLogId, {
                status: WebhookStatus.DEAD_LETTER,
                retry_count: newRetryCount,
                error_message: error,
                last_retry_at: new Date(),
            });
            return false; // No more retries
        }

        // Calculate exponential backoff delay
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, newRetryCount);
        const nextRetryAt = new Date(Date.now() + delayMs);

        await this.webhookLogRepo.update(webhookLogId, {
            status: WebhookStatus.FAILED,
            retry_count: newRetryCount,
            error_message: error,
            last_retry_at: new Date(),
            next_retry_at: nextRetryAt,
        });

        return true; // Will retry
    }

    /**
     * Get webhooks that need to be retried.
     */
    async getWebhooksForRetry(): Promise<WebhookEventLogEntity[]> {
        return await this.webhookLogRepo.find({
            where: {
                status: WebhookStatus.FAILED,
            },
            order: { next_retry_at: 'ASC' },
            take: 50, // Batch size
        });
    }

    /**
     * Get dead letter webhooks for admin review with pagination.
     */
    async getDeadLetterWebhooks(limit: number = 50, offset: number = 0): Promise<WebhookEventLogEntity[]> {
        return await this.webhookLogRepo.find({
            where: { status: WebhookStatus.DEAD_LETTER },
            order: { created_at: 'DESC' },
            take: limit,
            skip: offset,
        });
    }

    /**
     * Get webhook statistics.
     */
    async getStatistics(): Promise<{
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        deadLetter: number;
        total: number;
    }> {
        const stats = await this.webhookLogRepo
            .createQueryBuilder('log')
            .select('log.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('log.status')
            .getRawMany();

        const result = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            deadLetter: 0,
            total: 0,
        };

        for (const row of stats) {
            const count = parseInt(row.count, 10);
            result.total += count;

            switch (row.status) {
                case WebhookStatus.PENDING:
                    result.pending = count;
                    break;
                case WebhookStatus.PROCESSING:
                    result.processing = count;
                    break;
                case WebhookStatus.COMPLETED:
                    result.completed = count;
                    break;
                case WebhookStatus.FAILED:
                    result.failed = count;
                    break;
                case WebhookStatus.DEAD_LETTER:
                    result.deadLetter = count;
                    break;
            }
        }

        return result;
    }

    /**
     * Retry a dead letter webhook.
     */
    async retryDeadLetterWebhook(webhookLogId: string): Promise<boolean> {
        const log = await this.webhookLogRepo.findOne({
            where: { id: webhookLogId, status: WebhookStatus.DEAD_LETTER },
        });

        if (!log) {
            return false;
        }

        await this.webhookLogRepo.update(webhookLogId, {
            status: WebhookStatus.PENDING,
            retry_count: 0,
            error_message: null,
            next_retry_at: new Date(),
        });

        return true;
    }

    /**
     * Batch retry multiple dead letter webhooks.
     */
    async batchRetryDeadLetterWebhooks(webhookLogIds: string[]): Promise<Array<{
        id: string;
        success: boolean;
        error?: string;
    }>> {
        const results = await Promise.all(
            webhookLogIds.map(async (id) => {
                try {
                    const success = await this.retryDeadLetterWebhook(id);
                    return { id, success };
                } catch (error: any) {
                    return {
                        id,
                        success: false,
                        error: error.message,
                    };
                }
            })
        );

        return results;
    }

    /**
     * Get a specific webhook log by ID.
     */
    async getWebhookLog(webhookLogId: string): Promise<WebhookEventLogEntity | null> {
        return await this.webhookLogRepo.findOne({
            where: { id: webhookLogId },
        });
    }

    /**
     * Delete old completed webhook logs to prevent table bloat.
     * Deletes logs older than the specified number of days.
     */
    async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await this.webhookLogRepo
            .createQueryBuilder('log')
            .delete()
            .where('log.status = :status', { status: WebhookStatus.COMPLETED })
            .andWhere('log.processed_at < :cutoff', { cutoff: cutoffDate })
            .execute();

        return result.affected || 0;
    }

    /**
     * Main processing function with all reliability features.
     */
    async processWebhook(
        rawPayload: string,
        signature: string,
        webhookId: string,
        topic: string,
        processor: (data: any) => Promise<void>
    ): Promise<WebhookProcessingResult> {
        // 1. Idempotency check
        if (await this.isDuplicate(webhookId)) {
            return { success: true, isDuplicate: true };
        }

        // 2. Signature verification
        const signatureVerified = this.verifySignature(rawPayload, signature);
        if (!signatureVerified && this.webhookSecret) {
            return {
                success: false,
                isDuplicate: false,
                error: 'Invalid webhook signature'
            };
        }

        // 3. Log the webhook
        const parsedPayload = JSON.parse(rawPayload);
        const log = await this.logWebhookEvent(
            { id: webhookId, topic, data: parsedPayload },
            signatureVerified
        );

        // 4. Process
        try {
            await this.markProcessing(log.id);
            await processor(parsedPayload);
            await this.markCompleted(log.id);
            return { success: true, isDuplicate: false, webhookLogId: log.id };
        } catch (error: any) {
            const willRetry = await this.markFailed(log.id, error.message);
            return {
                success: false,
                isDuplicate: false,
                webhookLogId: log.id,
                error: `${error.message}. Will retry: ${willRetry}`
            };
        }
    }
}
