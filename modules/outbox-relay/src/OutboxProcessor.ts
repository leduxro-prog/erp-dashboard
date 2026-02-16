/**
 * Outbox event processor for handling event publishing workflow.
 *
 * Fetches pending events from Postgres, marks them as processing,
 * publishes to RabbitMQ, marks them as published, and handles failures
 * with proper state transitions.
 *
 * @module OutboxProcessor
 */

import { OutboxRepository, OutboxEvent, OutboxStatus } from './OutboxRepository';
import { RabbitMQPublisher, PublishResult } from './Publisher';
import { OutboxLogger } from './logger';
import { OutboxMetrics, ProcessingResult } from './Metrics';
import { getConfig, RetryConfig, BatchConfig, RelayConfig } from './Config';

/**
 * Processing result for a batch of events
 */
export interface BatchResult {
  total: number;
  published: number;
  failed: number;
  discarded: number;
  skipped: number;
  durationMs: number;
  errors: Array<{ eventId: string; error: string }>;
}

/**
 * Processor options
 */
export interface ProcessorOptions {
  consumerName?: string;
  maxAttempts?: number;
  retryAfterMs?: number;
}

/**
 * Event context for processing
 */
interface EventContext {
  event: OutboxEvent;
  retryCount: number;
}

/**
 * Outbox event processor class
 */
export class OutboxProcessor {
  private readonly repository: OutboxRepository;
  private readonly publisher: RabbitMQPublisher;
  private readonly logger: OutboxLogger;
  private readonly metrics?: OutboxMetrics;
  private readonly config: {
    retry: RetryConfig;
    batch: BatchConfig;
    relay: RelayConfig;
  };

  private isProcessing: boolean = false;
  private processedCount: number = 0;

  /**
   * Creates a new OutboxProcessor instance
   *
   * @param repository - Outbox repository instance
   * @param publisher - RabbitMQ publisher instance
   * @param logger - Logger instance
   * @param metrics - Metrics instance
   */
  constructor(
    repository: OutboxRepository,
    publisher: RabbitMQPublisher,
    logger?: OutboxLogger,
    metrics?: OutboxMetrics
  ) {
    this.repository = repository;
    this.publisher = publisher;
    this.logger = logger || new OutboxLogger().forComponent('Processor');
    this.metrics = metrics;

    const config = getConfig();
    this.config = {
      retry: config.retry,
      batch: config.batch,
      relay: config.relay,
    };
  }

  /**
   * Initializes the processor
   *
   * @returns Promise that resolves when initialized
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing OutboxProcessor');
    await this.repository.initialize();
    await this.publisher.initialize();
  }

  /**
   * Processes a batch of events
   *
   * @param batchSize - Maximum batch size to process
   * @returns Promise resolving to batch result
   */
  public async processBatch(batchSize?: number): Promise<BatchResult> {
    if (this.isProcessing) {
      this.logger.debug('Already processing a batch, skipping');
      return {
        total: 0,
        published: 0,
        failed: 0,
        discarded: 0,
        skipped: 0,
        durationMs: 0,
        errors: [],
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      const actualBatchSize = batchSize || this.config.batch.size;
      this.logger.debug('Starting batch processing', { batchSize: actualBatchSize });

      // Fetch pending events
      const events = await this.repository.fetchPendingEvents(
        actualBatchSize,
        this.config.relay.consumerName,
        this.config.retry.maxAttempts
      );

      if (events.length === 0) {
        this.logger.debug('No pending events to process');
        return {
          total: 0,
          published: 0,
          failed: 0,
          discarded: 0,
          skipped: 0,
          durationMs: Date.now() - startTime,
          errors: [],
        };
      }

      this.logger.info('Fetched events for processing', { count: events.length });

      // Mark events as processing
      const eventIds = events.map((e) => e.id);
      const markedCount = await this.repository.markEventsProcessing(eventIds);
      this.logger.debug('Marked events as processing', { count: markedCount });

      if (this.metrics) {
        this.metrics.setBatchSize(markedCount);
      }

      // Process each event
      const result = await this.processEvents(events);

      const duration = Date.now() - startTime;

      if (this.metrics) {
        this.metrics.recordBatchProcessingDuration(duration / 1000);
        this.metrics.recordEventsPerBatch(result.published, ProcessingResult.Success);
      }

      this.logger.info('Batch processing completed', {
        total: result.total,
        published: result.published,
        failed: result.failed,
        discarded: result.discarded,
        duration,
      });

      return {
        ...result,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Batch processing failed', error as Error, { duration });

      if (this.metrics) {
        this.metrics.recordEventsPerBatch(0, ProcessingResult.Failure);
      }

      return {
        total: 0,
        published: 0,
        failed: 0,
        discarded: 0,
        skipped: 0,
        durationMs: duration,
        errors: [{ eventId: 'batch', error: (error as Error).message }],
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes a list of events
   *
   * @param events - Events to process
   * @returns Promise resolving to processing result
   * @private
   */
  private async processEvents(events: OutboxEvent[]): Promise<Omit<BatchResult, 'durationMs'>> {
    const result: Omit<BatchResult, 'durationMs'> = {
      total: events.length,
      published: 0,
      failed: 0,
      discarded: 0,
      skipped: 0,
      errors: [],
    };

    // Separate events into successful, failed, and discarded
    const publishedIds: string[] = [];
    const failedIds: string[] = [];
    const discardedIds: string[] = [];

    for (const event of events) {
      try {
        const publishResult = await this.publishEvent(event);

        if (publishResult.success) {
          publishedIds.push(event.id);
          result.published++;

          // Record metrics
          if (this.metrics) {
            this.metrics.recordEventPublished(
              event.event_type,
              event.event_domain,
              event.exchange || '',
              event.routing_key || ''
            );

            // Record successful processing
            await this.repository.recordEventProcessing(
              event.event_id,
              event.event_type,
              this.config.relay.consumerName,
              'success',
              { publishedAt: new Date().toISOString() }
            );
          }
        } else {
          // Check if should discard
          if (event.attempts >= event.max_attempts - 1) {
            discardedIds.push(event.id);
            result.discarded++;
            result.errors.push({
              eventId: event.event_id,
              error: publishResult.error?.message || 'Unknown error',
            });

            if (this.metrics) {
              this.metrics.recordEventDiscarded(
                event.event_type,
                event.event_domain,
                'max_attempts_reached'
              );
            }
          } else {
            failedIds.push(event.id);
            result.failed++;
            result.errors.push({
              eventId: event.event_id,
              error: publishResult.error?.message || 'Unknown error',
            });

            if (this.metrics) {
              this.metrics.recordEventFailed(
                event.event_type,
                event.event_domain,
                publishResult.error?.name || 'unknown',
                event.exchange || '',
                event.routing_key || ''
              );
            }
          }
        }
      } catch (error) {
        const errorMessage = (error as Error).message;

        if (event.attempts >= event.max_attempts - 1) {
          discardedIds.push(event.id);
          result.discarded++;
        } else {
          failedIds.push(event.id);
          result.failed++;
        }

        result.errors.push({
          eventId: event.event_id,
          error: errorMessage,
        });

        this.logger.error('Event processing failed', error as Error, {
          eventId: event.event_id,
          eventType: event.event_type,
        });
      }
    }

    // Mark published events
    if (publishedIds.length > 0) {
      const count = await this.repository.markEventsPublished(publishedIds);
      this.logger.debug('Marked events as published', { count });
    }

    // Mark failed events
    if (failedIds.length > 0) {
      const retryDelay = this.calculateRetryDelay(1);
      const { failed, discarded } = await this.repository.markEventsFailed(
        failedIds,
        'Publish failed',
        'PUBLISH_ERROR',
        retryDelay
      );
      this.logger.debug('Marked events as failed/discarded', { failed, discarded });
    }

    // Mark discarded events
    if (discardedIds.length > 0) {
      const { failed, discarded } = await this.repository.markEventsFailed(
        discardedIds,
        'Max retry attempts reached, discarding',
        'MAX_ATTEMPTS_REACHED',
        0
      );
      this.logger.debug('Marked events as discarded', { failed, discarded });
    }

    return result;
  }

  /**
   * Publishes a single event to RabbitMQ
   *
   * @param event - Outbox event
   * @returns Promise resolving to publish result
   * @private
   */
  private async publishEvent(event: OutboxEvent): Promise<PublishResult> {
    const exchange = event.exchange || '';
    const routingKey = event.routing_key || '';

    // Prepare message content
    const content = this.prepareMessageContent(event);

    // Prepare publish options
    const options = {
      exchange,
      routingKey,
      correlationId: event.correlation_id,
      messageId: event.event_id,
      timestamp: Math.floor(new Date(event.occurred_at).getTime() / 1000),
      contentType: event.content_type,
      deliveryMode: event.priority === 'critical' ? 2 : 1,
      headers: {
        eventId: event.event_id,
        eventType: event.event_type,
        eventVersion: event.event_version,
        eventDomain: event.event_domain,
        sourceService: event.source_service,
        sourceEntityType: event.source_entity_type,
        sourceEntityId: event.source_entity_id,
        causationId: event.causation_id,
        parentEventId: event.parent_event_id,
        attempts: event.attempts,
        ...event.metadata,
      },
    };

    // Publish with retry logic
    return await this.publishWithRetry(content, options, event);
  }

  /**
   * Prepares message content for publishing
   *
   * @param event - Outbox event
   * @returns Message content as JSON string
   * @private
   */
  private prepareMessageContent(event: OutboxEvent): string {
    const message = {
      id: event.event_id,
      type: event.event_type,
      version: event.event_version,
      domain: event.event_domain,
      source: {
        service: event.source_service,
        entityType: event.source_entity_type,
        entityId: event.source_entity_id,
      },
      correlationId: event.correlation_id,
      causationId: event.causation_id,
      parentEventId: event.parent_event_id,
      payload: event.payload,
      metadata: event.metadata,
      timestamp: event.occurred_at,
    };

    return JSON.stringify(message);
  }

  /**
   * Publishes with retry logic using exponential backoff
   *
   * @param content - Message content
   * @param options - Publish options
   * @param event - Outbox event
   * @returns Promise resolving to publish result
   * @private
   */
  private async publishWithRetry(
    content: string,
    options: any,
    event: OutboxEvent
  ): Promise<PublishResult> {
    let lastError: Error | undefined;
    const maxAttempts = Math.min(event.max_attempts - event.attempts, 3);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.publisher.publish(content, options);

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // If it's not a retriable error, break
        if (!this.isRetriableError(lastError)) {
          return result;
        }

        // If circuit breaker is open, don't retry
        if (this.publisher.isCircuitBreakerOpen()) {
          return result;
        }

      } catch (error) {
        lastError = error as Error;

        if (!this.isRetriableError(lastError)) {
          return { success: false, error: lastError };
        }

        if (this.publisher.isCircuitBreakerOpen()) {
          return { success: false, error: lastError };
        }
      }

      // Calculate delay before retry
      const delay = this.calculateRetryDelay(attempt + 1);

      this.logger.debug('Retrying publish', {
        eventId: event.event_id,
        attempt: attempt + 1,
        maxAttempts,
        delay,
      });

      if (this.metrics) {
        this.metrics.recordEventRetry(event.event_type, event.event_domain, attempt + 1);
      }

      await this.sleep(delay);
    }

    return {
      success: false,
      error: lastError || new Error('Max retries exceeded'),
    };
  }

  /**
   * Calculates retry delay with exponential backoff and jitter
   *
   * @param attempt - Attempt number (1-based)
   * @returns Delay in milliseconds
   * @private
   */
  private calculateRetryDelay(attempt: number): number {
    const { retry } = this.config;

    // Exponential backoff
    let delay = retry.initialDelayMs * Math.pow(retry.backoffMultiplier, attempt - 1);

    // Cap at max delay
    delay = Math.min(delay, retry.maxDelayMs);

    // Add jitter if enabled
    if (retry.jitter) {
      const jitterRange = delay * retry.jitterRatio;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = delay + jitter;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Checks if an error is retriable
   *
   * @param error - Error to check
   * @returns True if error is retriable
   * @private
   */
  private isRetriableError(error?: Error): boolean {
    if (!error) {
      return false;
    }

    const retriablePatterns = [
      /connection/i,
      /timeout/i,
      /network/i,
      /ECONN/i,
      /ETIMEDOUT/i,
      /EPIPE/i,
    ];

    const message = error.message.toLowerCase();
    return retriablePatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Sleeps for the specified duration
   *
   * @param ms - Duration in milliseconds
   * @returns Promise that resolves after the duration
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets statistics about the outbox
   *
   * @returns Promise resolving to batch statistics
   */
  public async getStatistics(): Promise<any> {
    return this.repository.getBatchStatistics();
  }

  /**
   * Checks if the processor is currently processing
   *
   * @returns True if processing
   */
  public isProcessingBatch(): boolean {
    return this.isProcessing;
  }

  /**
   * Gets the number of events processed
   *
   * @returns Processed event count
   */
  public getProcessedCount(): number {
    return this.processedCount;
  }

  /**
   * Resets the processed count
   */
  public resetProcessedCount(): void {
    this.processedCount = 0;
  }

  /**
   * Checks if the processor is healthy
   *
   * @returns True if healthy
   */
  public async isHealthy(): Promise<boolean> {
    const repoHealthy = await this.repository.ping();
    const pubHealthy = await this.publisher.ping();

    return repoHealthy && pubHealthy;
  }

  /**
   * Closes the processor
   *
   * @returns Promise that resolves when closed
   */
  public async close(): Promise<void> {
    this.logger.info('Closing OutboxProcessor');
    await this.publisher.close();
    await this.repository.close();
  }
}

/**
 * Default processor instance
 */
let defaultProcessor: OutboxProcessor | null = null;

/**
 * Gets the default processor instance
 *
 * @param repository - Outbox repository instance
 * @param publisher - RabbitMQ publisher instance
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @returns Processor instance
 */
export function getProcessor(
  repository?: OutboxRepository,
  publisher?: RabbitMQPublisher,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics
): OutboxProcessor {
  if (!defaultProcessor) {
    const config = getConfig();
    const repo = repository || new OutboxRepository();
    const pub = publisher || new RabbitMQPublisher();
    defaultProcessor = new OutboxProcessor(repo, pub, logger, metrics);
  }
  return defaultProcessor;
}

/**
 * Creates a new processor instance
 *
 * @param repository - Outbox repository instance
 * @param publisher - RabbitMQ publisher instance
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @returns New processor instance
 */
export function createProcessor(
  repository: OutboxRepository,
  publisher: RabbitMQPublisher,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics
): OutboxProcessor {
  return new OutboxProcessor(repository, publisher, logger, metrics);
}

export default OutboxProcessor;
