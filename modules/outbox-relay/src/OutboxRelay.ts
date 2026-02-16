/**
 * Core relay service class for the outbox pattern implementation.
 *
 * Provides batch processing logic with configurable batch size,
 * publisher confirms support, restart-safe and idempotent operation,
 * circuit breaker for RabbitMQ failures, backoff strategy for retries,
 * and graceful shutdown handling.
 *
 * @module OutboxRelay
 */

import { OutboxProcessor, BatchResult } from './OutboxProcessor';
import { OutboxRepository } from './OutboxRepository';
import { RabbitMQPublisher } from './Publisher';
import { OutboxLogger, createAsyncContext } from './logger';
import { OutboxMetrics } from './Metrics';
import { getConfig, Config, BatchConfig, RetryConfig, CircuitBreakerConfig, RelayConfig } from './Config';

/**
 * Relay status enum
 */
export enum RelayStatus {
  Stopped = 'stopped',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Error = 'error',
}

/**
 * Relay configuration options
 */
export interface RelayOptions {
  autoStart?: boolean;
  processOnStartup?: boolean;
  gracefulShutdownTimeoutMs?: number;
}

/**
 * Component health status
 */
export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck?: Date;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Overall health status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  components: {
    postgres: ComponentHealth;
    rabbitmq: ComponentHealth;
    outboxRelay: ComponentHealth;
  };
  uptime: number;
  lastProcessTime?: Date;
  lastProcessResult?: BatchResult;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  totalBatches: number;
  totalEventsProcessed: number;
  totalEventsPublished: number;
  totalEventsFailed: number;
  totalEventsDiscarded: number;
  averageBatchSize: number;
  averageProcessingTimeMs: number;
  currentBatchSize: number;
  lastBatchResult?: BatchResult;
}

/**
 * Outbox relay service class
 */
export class OutboxRelay {
  private readonly logger: OutboxLogger;
  private readonly metrics?: OutboxMetrics;
  private readonly config: Config;
  private readonly processor: OutboxProcessor;
  private readonly repository: OutboxRepository;
  private readonly publisher: RabbitMQPublisher;

  // State
  private status: RelayStatus = RelayStatus.Stopped;
  private startTime: number = 0;
  private processingInterval?: NodeJS.Timeout;
  private shutdownSignal: boolean = false;

  // Statistics
  private stats: ProcessingStats = {
    totalBatches: 0,
    totalEventsProcessed: 0,
    totalEventsPublished: 0,
    totalEventsFailed: 0,
    totalEventsDiscarded: 0,
    averageBatchSize: 0,
    averageProcessingTimeMs: 0,
    currentBatchSize: 0,
  };

  // Configuration
  private readonly batchConfig: BatchConfig;
  private readonly retryConfig: RetryConfig;
  private readonly circuitBreakerConfig: CircuitBreakerConfig;
  private readonly relayConfig: RelayConfig;

  /**
   * Creates a new OutboxRelay instance
   *
   * @param options - Relay options
   * @param logger - Logger instance
   * @param metrics - Metrics instance
   */
  constructor(options: RelayOptions = {}, logger?: OutboxLogger, metrics?: OutboxMetrics) {
    this.config = getConfig();
    this.logger = logger || new OutboxLogger().forComponent('OutboxRelay');
    this.metrics = metrics;

    // Load configurations
    this.batchConfig = this.config.batch;
    this.retryConfig = this.config.retry;
    this.circuitBreakerConfig = this.config.circuitBreaker;
    this.relayConfig = this.config.relay;

    // Create components
    this.repository = new OutboxRepository(this.config.postgres, this.logger);
    this.publisher = new RabbitMQPublisher(this.config.rabbitmq, this.logger, this.metrics);
    this.processor = new OutboxProcessor(this.repository, this.publisher, this.logger, this.metrics);

    this.logger.info('OutboxRelay instance created', {
      mode: this.relayConfig.mode,
      batchSize: this.batchConfig.size,
      batchInterval: this.batchConfig.intervalMs,
      maxAttempts: this.retryConfig.maxAttempts,
    });
  }

  /**
   * Initializes the relay service
   *
   * @returns Promise that resolves when initialized
   */
  public async initialize(): Promise<void> {
    if (this.status !== RelayStatus.Stopped) {
      this.logger.warn('Relay is not in stopped state, skipping initialization', { status: this.status });
      return;
    }

    this.status = RelayStatus.Starting;
    this.logger.info('Initializing OutboxRelay');

    try {
      // Initialize processor
      await this.processor.initialize();

      this.startTime = Date.now();
      this.status = RelayStatus.Running;

      this.logger.info('OutboxRelay initialized successfully');

      // Process events on startup if configured
      if (this.relayConfig.processOnStartup) {
        this.logger.info('Processing events on startup');
        await this.processOnce();
      }
    } catch (error) {
      this.status = RelayStatus.Error;
      this.logger.fatal('Failed to initialize OutboxRelay', error as Error);
      throw error;
    }
  }

  /**
   * Starts the relay service in continuous mode
   *
   * @returns Promise that resolves when started
   */
  public async start(): Promise<void> {
    if (this.status === RelayStatus.Running) {
      this.logger.warn('Relay is already running');
      return;
    }

    if (this.status === RelayStatus.Stopped) {
      await this.initialize();
    }

    if (this.relayConfig.mode === 'continuous') {
      this.startContinuousMode();
    } else {
      this.logger.info('Running in polling mode, use processOnce() to process events');
    }

    this.logger.info('OutboxRelay started');
  }

  /**
   * Starts continuous processing mode
   *
   * @private
   */
  private startContinuousMode(): void {
    if (this.processingInterval) {
      return;
    }

    this.logger.info('Starting continuous processing mode', {
      intervalMs: this.batchConfig.intervalMs,
      batchSize: this.batchConfig.size,
    });

    // Process immediately
    this.processBatch().catch((error) => {
      this.logger.error('Initial batch processing failed', error);
    });

    // Set up interval
    this.processingInterval = setInterval(async () => {
      await this.processBatch();
    }, this.batchConfig.intervalMs);
  }

  /**
   * Stops the relay service gracefully
   *
   * @returns Promise that resolves when stopped
   */
  public async stop(): Promise<void> {
    if (this.status === RelayStatus.Stopped || this.status === RelayStatus.Stopping) {
      this.logger.debug('Relay is already stopped or stopping');
      return;
    }

    this.status = RelayStatus.Stopping;
    this.logger.info('Stopping OutboxRelay gracefully');

    const timeout = this.relayConfig.gracefulShutdownTimeoutMs;

    try {
      // Clear interval if running
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = undefined;
      }

      // Set shutdown signal
      this.shutdownSignal = true;

      // Wait for current processing to complete or timeout
      const startTime = Date.now();
      while (this.processor.isProcessingBatch() && Date.now() - startTime < timeout) {
        this.logger.debug('Waiting for batch processing to complete');
        await this.sleep(100);
      }

      if (this.processor.isProcessingBatch()) {
        this.logger.warn('Graceful shutdown timeout, force closing');
      }

      // Close processor
      await this.processor.close();

      this.status = RelayStatus.Stopped;
      this.shutdownSignal = false;

      this.logger.info('OutboxRelay stopped', {
        uptime: this.getUptime(),
        stats: this.stats,
      });
    } catch (error) {
      this.status = RelayStatus.Error;
      this.logger.error('Error stopping OutboxRelay', error as Error);
      throw error;
    }
  }

  /**
   * Processes a single batch of events
   *
   * @returns Promise resolving to batch result
   */
  public async processOnce(): Promise<BatchResult> {
    return this.processBatch();
  }

  /**
   * Processes a batch of events with error handling and statistics
   *
   * @param batchSize - Optional batch size override
   * @returns Promise resolving to batch result
   * @private
   */
  private async processBatch(batchSize?: number): Promise<BatchResult> {
    if (this.shutdownSignal) {
      this.logger.debug('Shutdown signal received, skipping batch processing');
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

    const correlationId = createAsyncContext(undefined, 'processBatch').correlationId;
    const batchLogger = this.logger.withCorrelationId(correlationId);

    batchLogger.debug('Processing batch');

    try {
      const result = await this.processor.processBatch(batchSize);

      // Update statistics
      this.updateStatistics(result);

      // Update metrics
      if (this.metrics) {
        this.metrics.setQueueDepth(
          result.total - result.published - result.discarded,
          'pending'
        );
      }

      batchLogger.debug('Batch processed', {
        total: result.total,
        published: result.published,
        failed: result.failed,
        discarded: result.discarded,
        duration: result.durationMs,
      });

      return result;
    } catch (error) {
      batchLogger.error('Batch processing failed', error as Error);
      throw error;
    }
  }

  /**
   * Updates processing statistics
   *
   * @param result - Batch result
   * @private
   */
  private updateStatistics(result: BatchResult): void {
    this.stats.totalBatches++;
    this.stats.totalEventsProcessed += result.total;
    this.stats.totalEventsPublished += result.published;
    this.stats.totalEventsFailed += result.failed;
    this.stats.totalEventsDiscarded += result.discarded;
    this.stats.currentBatchSize = result.total;
    this.stats.lastBatchResult = result;

    // Calculate averages
    if (this.stats.totalBatches > 0) {
      this.stats.averageBatchSize =
        this.stats.totalEventsProcessed / this.stats.totalBatches;
    }

    if (result.total > 0 && result.durationMs > 0) {
      const currentAvg = result.durationMs / result.total;
      if (this.stats.averageProcessingTimeMs === 0) {
        this.stats.averageProcessingTimeMs = currentAvg;
      } else {
        // Exponential moving average
        this.stats.averageProcessingTimeMs =
          this.stats.averageProcessingTimeMs * 0.9 + currentAvg * 0.1;
      }
    }
  }

  /**
   * Gets the current status of the relay
   *
   * @returns Current relay status
   */
  public getStatus(): RelayStatus {
    return this.status;
  }

  /**
   * Gets the health status of all components
   *
   * @returns Promise resolving to health status
   */
  public async getHealthStatus(): Promise<HealthStatus> {
    const now = Date.now();

    const postgresHealthy = await this.repository.ping();
    const rabbitmqHealthy = await this.publisher.ping();

    const postgresHealth: ComponentHealth = {
      name: 'postgres',
      status: postgresHealthy ? 'healthy' : 'unhealthy',
      lastCheck: new Date(now),
      error: postgresHealthy ? undefined : 'Connection failed',
    };

    const rabbitmqHealth: ComponentHealth = {
      name: 'rabbitmq',
      status: rabbitmqHealthy ? 'healthy' : 'unhealthy',
      lastCheck: new Date(now),
      error: rabbitmqHealthy ? undefined : 'Connection failed',
      details: {
        circuitBreakerState: this.publisher.getCircuitBreakerState(),
      },
    };

    const relayHealthy = this.status === RelayStatus.Running;
    const relayHealth: ComponentHealth = {
      name: 'outboxRelay',
      status: relayHealthy ? 'healthy' : this.status === RelayStatus.Error ? 'unhealthy' : 'degraded',
      lastCheck: new Date(now),
      details: {
        status: this.status,
        uptime: this.getUptime(),
        processingBatch: this.processor.isProcessingBatch(),
      },
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (!postgresHealthy || !rabbitmqHealthy) {
      overallStatus = 'unhealthy';
    } else if (!relayHealthy || this.publisher.isCircuitBreakerOpen()) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      components: {
        postgres: postgresHealth,
        rabbitmq: rabbitmqHealth,
        outboxRelay: relayHealth,
      },
      uptime: this.getUptime(),
      lastProcessTime: this.stats.lastBatchResult ? new Date(now - this.stats.lastBatchResult.durationMs) : undefined,
      lastProcessResult: this.stats.lastBatchResult,
    };
  }

  /**
   * Gets processing statistics
   *
   * @returns Processing statistics
   */
  public getStatistics(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Gets outbox statistics from the database
   *
   * @returns Promise resolving to outbox statistics
   */
  public async getOutboxStatistics(): Promise<any> {
    return this.processor.getStatistics();
  }

  /**
   * Gets the uptime of the relay in milliseconds
   *
   * @returns Uptime in milliseconds
   */
  public getUptime(): number {
    if (this.startTime === 0) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Checks if the relay is healthy
   *
   * @returns Promise resolving to true if healthy
   */
  public async isHealthy(): Promise<boolean> {
    const health = await this.getHealthStatus();
    return health.status === 'healthy';
  }

  /**
   * Checks if the relay is ready to process events
   *
   * @returns Promise resolving to true if ready
   */
  public async isReady(): Promise<boolean> {
    const health = await this.getHealthStatus();
    return health.status === 'healthy' && this.status === RelayStatus.Running;
  }

  /**
   * Checks if the relay has started up successfully
   *
   * @returns Promise resolving to true if started
   */
  public async isStartedUp(): Promise<boolean> {
    return this.status !== RelayStatus.Stopped && this.status !== RelayStatus.Starting;
  }

  /**
   * Resets the circuit breaker for RabbitMQ
   */
  public resetCircuitBreaker(): void {
    this.publisher.resetCircuitBreaker();
    this.logger.info('Circuit breaker reset');
  }

  /**
   * Resets processing statistics
   */
  public resetStatistics(): void {
    this.stats = {
      totalBatches: 0,
      totalEventsProcessed: 0,
      totalEventsPublished: 0,
      totalEventsFailed: 0,
      totalEventsDiscarded: 0,
      averageBatchSize: 0,
      averageProcessingTimeMs: 0,
      currentBatchSize: 0,
    };
    this.logger.info('Statistics reset');
  }

  /**
   * Manually triggers a batch processing
   *
   * @param batchSize - Optional batch size override
   * @returns Promise resolving to batch result
   */
  public async triggerBatch(batchSize?: number): Promise<BatchResult> {
    return this.processBatch(batchSize);
  }

  /**
   * Gets the processor instance
   *
   * @returns The processor instance
   */
  public getProcessor(): OutboxProcessor {
    return this.processor;
  }

  /**
   * Gets the repository instance
   *
   * @returns The repository instance
   */
  public getRepository(): OutboxRepository {
    return this.repository;
  }

  /**
   * Gets the publisher instance
   *
   * @returns The publisher instance
   */
  public getPublisher(): RabbitMQPublisher {
    return this.publisher;
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
}

/**
 * Default relay instance
 */
let defaultRelay: OutboxRelay | null = null;

/**
 * Gets the default relay instance
 *
 * @param options - Relay options
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @returns Relay instance
 */
export function getRelay(
  options?: RelayOptions,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics
): OutboxRelay {
  if (!defaultRelay) {
    defaultRelay = new OutboxRelay(options, logger, metrics);
  }
  return defaultRelay;
}

/**
 * Creates a new relay instance
 *
 * @param options - Relay options
 * @param logger - Logger instance
 * @param metrics - Metrics instance
 * @returns New relay instance
 */
export function createRelay(
  options?: RelayOptions,
  logger?: OutboxLogger,
  metrics?: OutboxMetrics
): OutboxRelay {
  return new OutboxRelay(options, logger, metrics);
}

export default OutboxRelay;
