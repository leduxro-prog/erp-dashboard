/**
 * Dead Letter Queue (DLQ) Manager
 * Manages permanently failed webhook events and provides tools for review and replay
 */

import { DataSource, Repository } from 'typeorm';
import { WebhookEventLogEntity, WebhookStatus } from '../../infrastructure/entities/WebhookEventLogEntity';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('dlq-manager');

/**
 * DLQ statistics
 */
export interface DLQStatistics {
  totalDeadLetters: number;
  byTopic: Record<string, number>;
  byError: Record<string, number>;
  oldestDeadLetter: Date | null;
  newestDeadLetter: Date | null;
}

/**
 * Dead letter entry with details
 */
export interface DeadLetterEntry {
  id: string;
  webhook_id: string;
  topic: string;
  payload: Record<string, any>;
  status: WebhookStatus;
  retry_count: number;
  error_message: string | null;
  last_retry_at: Date | null;
  created_at: Date;
  processed_at: Date | null;
}

/**
 * DLQ operation result
 */
export interface DLQOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  count?: number;
}

/**
 * Dead Letter Queue Manager
 */
export class DeadLetterQueueManager {
  private webhookLogRepo: Repository<WebhookEventLogEntity>;

  constructor(private dataSource: DataSource) {
    this.webhookLogRepo = dataSource.getRepository(WebhookEventLogEntity);
  }

  /**
   * Get all dead letter entries with pagination
   */
  async getDeadLetterEntries(
    limit: number = 50,
    offset: number = 0
  ): Promise<DeadLetterEntry[]> {
    const entries = await this.webhookLogRepo.find({
      where: { status: WebhookStatus.DEAD_LETTER },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return entries.map(this.toDeadLetterEntry);
  }

  /**
   * Get a specific dead letter entry by ID
   */
  async getDeadLetterEntry(id: string): Promise<DeadLetterEntry | null> {
    const entry = await this.webhookLogRepo.findOne({
      where: { id, status: WebhookStatus.DEAD_LETTER },
    });

    return entry ? this.toDeadLetterEntry(entry) : null;
  }

  /**
   * Get dead letter entries by topic with pagination
   */
  async getDeadLetterEntriesByTopic(
    topic: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<DeadLetterEntry[]> {
    const entries = await this.webhookLogRepo.find({
      where: { status: WebhookStatus.DEAD_LETTER, topic },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return entries.map(this.toDeadLetterEntry);
  }

  /**
   * Search dead letter entries by error message
   */
  async searchDeadLetterEntries(
    searchTerm: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<DeadLetterEntry[]> {
    const entries = await this.webhookLogRepo
      .createQueryBuilder('log')
      .where('log.status = :status', { status: WebhookStatus.DEAD_LETTER })
      .andWhere('log.error_message ILIKE :search', { search: `%${searchTerm}%` })
      .orderBy('log.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();

    return entries.map(this.toDeadLetterEntry);
  }

  /**
   * Get DLQ statistics
   */
  async getStatistics(): Promise<DLQStatistics> {
    const deadLetters = await this.webhookLogRepo.find({
      where: { status: WebhookStatus.DEAD_LETTER },
      order: { created_at: 'DESC' },
    });

    const byTopic: Record<string, number> = {};
    const byError: Record<string, number> = {};
    let oldestDeadLetter: Date | null = null;
    let newestDeadLetter: Date | null = null;

    for (const dl of deadLetters) {
      // Count by topic
      byTopic[dl.topic] = (byTopic[dl.topic] || 0) + 1;

      // Count by error (simplified, first 100 chars)
      const errorKey = dl.error_message?.substring(0, 100) || 'unknown';
      byError[errorKey] = (byError[errorKey] || 0) + 1;

      // Track dates
      if (!oldestDeadLetter || dl.created_at < oldestDeadLetter) {
        oldestDeadLetter = dl.created_at;
      }
      if (!newestDeadLetter || dl.created_at > newestDeadLetter) {
        newestDeadLetter = dl.created_at;
      }
    }

    return {
      totalDeadLetters: deadLetters.length,
      byTopic,
      byError,
      oldestDeadLetter,
      newestDeadLetter,
    };
  }

  /**
   * Replay a dead letter entry (reset to pending)
   */
  async replayDeadLetter(id: string): Promise<DLQOperationResult> {
    try {
      const entry = await this.webhookLogRepo.findOne({
        where: { id, status: WebhookStatus.DEAD_LETTER },
      });

      if (!entry) {
        return {
          success: false,
          error: `Dead letter entry not found: ${id}`,
        };
      }

      await this.webhookLogRepo.update(id, {
        status: WebhookStatus.PENDING,
        retry_count: 0,
        error_message: null,
        last_retry_at: null,
        next_retry_at: new Date(),
      });

      logger.info('Dead letter entry replayed', {
        id,
        webhook_id: entry.webhook_id,
        topic: entry.topic,
      });

      return {
        success: true,
        message: 'Dead letter entry queued for replay',
      };
    } catch (error: any) {
      logger.error('Failed to replay dead letter entry', {
        id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Batch replay dead letter entries
   */
  async batchReplayDeadLetters(ids: string[]): Promise<DLQOperationResult> {
    const results = await Promise.all(
      ids.map((id) => this.replayDeadLetter(id))
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      success: successful > 0,
      count: successful,
      message: `Replayed ${successful} entries, ${failed} failed`,
    };
  }

  /**
   * Replay all dead letter entries by topic
   */
  async replayByTopic(topic: string): Promise<DLQOperationResult> {
    try {
      const entries = await this.webhookLogRepo.find({
        where: { status: WebhookStatus.DEAD_LETTER, topic },
        select: ['id'],
      });

      if (entries.length === 0) {
        return {
          success: true,
          message: 'No dead letter entries found for this topic',
          count: 0,
        };
      }

      const result = await this.batchReplayDeadLetters(
        entries.map((e) => e.id)
      );

      logger.info('Replayed dead letters by topic', {
        topic,
        count: result.count,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to replay dead letters by topic', {
        topic,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a dead letter entry (after review/archiving)
   */
  async deleteDeadLetter(id: string): Promise<DLQOperationResult> {
    try {
      const entry = await this.webhookLogRepo.findOne({
        where: { id, status: WebhookStatus.DEAD_LETTER },
      });

      if (!entry) {
        return {
          success: false,
          error: `Dead letter entry not found: ${id}`,
        };
      }

      await this.webhookLogRepo.remove(entry);

      logger.info('Dead letter entry deleted', {
        id,
        webhook_id: entry.webhook_id,
        topic: entry.topic,
      });

      return {
        success: true,
        message: 'Dead letter entry deleted',
      };
    } catch (error: any) {
      logger.error('Failed to delete dead letter entry', {
        id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Batch delete dead letter entries
   */
  async batchDeleteDeadLetters(ids: string[]): Promise<DLQOperationResult> {
    const results = await Promise.all(
      ids.map((id) => this.deleteDeadLetter(id))
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      success: successful > 0,
      count: successful,
      message: `Deleted ${successful} entries, ${failed} failed`,
    };
  }

  /**
   * Delete all dead letter entries older than a certain date
   */
  async deleteOlderThan(date: Date): Promise<DLQOperationResult> {
    try {
      const result = await this.webhookLogRepo
        .createQueryBuilder('log')
        .delete()
        .where('log.status = :status', { status: WebhookStatus.DEAD_LETTER })
        .andWhere('log.created_at < :date', { date })
        .execute();

      const count = result.affected || 0;

      logger.info('Deleted old dead letter entries', {
        date,
        count,
      });

      return {
        success: true,
        count,
        message: `Deleted ${count} dead letter entries older than ${date.toISOString()}`,
      };
    } catch (error: any) {
      logger.error('Failed to delete old dead letter entries', {
        date,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export dead letter entries to JSON for external analysis
   */
  async exportDeadLetters(
    limit: number = 1000
  ): Promise<string> {
    const entries = await this.webhookLogRepo.find({
      where: { status: WebhookStatus.DEAD_LETTER },
      order: { created_at: 'DESC' },
      take: limit,
    });

    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        count: entries.length,
        entries: entries.map((e) => ({
          id: e.id,
          webhook_id: e.webhook_id,
          topic: e.topic,
          payload: e.payload,
          retry_count: e.retry_count,
          error_message: e.error_message,
          created_at: e.created_at,
          processed_at: e.processed_at,
        })),
      },
      null,
      2
    );
  }

  /**
   * Convert WebhookEventLogEntity to DeadLetterEntry
   */
  private toDeadLetterEntry(entity: WebhookEventLogEntity): DeadLetterEntry {
    return {
      id: entity.id,
      webhook_id: entity.webhook_id,
      topic: entity.topic,
      payload: entity.payload,
      status: entity.status,
      retry_count: entity.retry_count,
      error_message: entity.error_message,
      last_retry_at: entity.last_retry_at,
      created_at: entity.created_at,
      processed_at: entity.processed_at,
    };
  }
}
