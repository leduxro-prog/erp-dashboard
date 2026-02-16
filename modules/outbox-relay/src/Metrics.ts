/**
 * Prometheus metrics for the outbox-relay service.
 *
 * Provides metrics for events published, events failed, processing time,
 * batch size, queue depth, and connection status.
 *
 * @module Metrics
 */

import promClient, {
  Counter,
  Gauge,
  Histogram,
  Summary,
  Registry,
  collectDefaultMetrics,
  DefaultMetricsCollectorConfiguration,
} from 'prom-client';
import { OutboxLogger } from './logger';
import { getConfig, MetricsConfig } from './Config';

/**
 * Event types for metrics
 */
export enum EventType {
  Published = 'published',
  Failed = 'failed',
  Retry = 'retry',
  Discarded = 'discarded',
  Processing = 'processing',
}

/**
 * Component types for component status metrics
 */
export enum ComponentType {
  Postgres = 'postgres',
  RabbitMQ = 'rabbitmq',
  OutboxRelay = 'outbox_relay',
}

/**
 * Processing result types
 */
export enum ProcessingResult {
  Success = 'success',
  Partial = 'partial',
  Failure = 'failure',
}

/**
 * Metrics configuration interface
 */
export interface MetricsOptions {
  enabled: boolean;
  port: number;
  path: string;
  defaultLabels: Record<string, string>;
  collectDefaultMetrics: boolean;
  pushgatewayUrl?: string;
  pushgatewayIntervalMs: number;
  pushgatewayJobName: string;
}

/**
 * Circuit breaker states for metrics
 */
export enum CircuitBreakerState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half_open',
}

/**
 * Metrics class for tracking outbox relay performance
 */
export class OutboxMetrics {
  private readonly registry: Registry;
  private readonly logger: OutboxLogger;
  private readonly config: MetricsOptions;
  private pushgatewayInterval?: NodeJS.Timeout;

  // Counters
  private readonly eventsPublished: Counter<string>;
  private readonly eventsFailed: Counter<string>;
  private readonly eventsRetried: Counter<string>;
  private readonly eventsDiscarded: Counter<string>;
  private readonly publishErrors: Counter<string>;
  private readonly databaseErrors: Counter<string>;
  private readonly circuitBreakerTrips: Counter<string>;

  // Gauges
  private readonly processingTime: Gauge<string>;
  private readonly batchSize: Gauge<string>;
  private readonly queueDepth: Gauge<string>;
  private readonly postgresConnectionStatus: Gauge<string>;
  private readonly rabbitMQConnectionStatus: Gauge<string>;
  private readonly circuitBreakerState: Gauge<string>;

  // Histograms
  private readonly eventProcessingDuration: Histogram<string>;
  private readonly batchProcessingDuration: Histogram<string>;
  private readonly publishDuration: Histogram<string>;

  // Summaries
  private readonly eventsPerBatch: Summary<string>;

  /**
   * Creates a new OutboxMetrics instance
   *
   * @param config - Metrics configuration
   * @param logger - Logger instance
   */
  constructor(config: MetricsConfig, logger?: OutboxLogger) {
    this.logger = logger || new OutboxLogger();

    this.config = {
      enabled: config.enabled,
      port: config.port,
      path: config.path,
      defaultLabels: config.defaultLabels,
      collectDefaultMetrics: config.collectDefaultMetrics,
      pushgatewayUrl: config.pushgatewayUrl,
      pushgatewayIntervalMs: config.pushgatewayIntervalMs,
      pushgatewayJobName: config.pushgatewayJobName,
    };

    // Create custom registry
    this.registry = new promClient.Registry();

    // Add default labels
    if (Object.keys(this.config.defaultLabels).length > 0) {
      this.registry.setDefaultLabels(this.config.defaultLabels);
    }

    // Initialize metrics
    this.eventsPublished = new Counter({
      name: 'outbox_events_published_total',
      help: 'Total number of events successfully published to message broker',
      labelNames: ['event_type', 'event_domain', 'exchange', 'routing_key'],
      registers: [this.registry],
    });

    this.eventsFailed = new Counter({
      name: 'outbox_events_failed_total',
      help: 'Total number of events that failed to publish',
      labelNames: ['event_type', 'event_domain', 'error_type', 'exchange', 'routing_key'],
      registers: [this.registry],
    });

    this.eventsRetried = new Counter({
      name: 'outbox_events_retried_total',
      help: 'Total number of event publish retries',
      labelNames: ['event_type', 'event_domain', 'attempt'],
      registers: [this.registry],
    });

    this.eventsDiscarded = new Counter({
      name: 'outbox_events_discarded_total',
      help: 'Total number of events discarded after max retries',
      labelNames: ['event_type', 'event_domain', 'reason'],
      registers: [this.registry],
    });

    this.publishErrors = new Counter({
      name: 'outbox_publish_errors_total',
      help: 'Total number of publish operation errors',
      labelNames: ['error_type', 'error_code'],
      registers: [this.registry],
    });

    this.databaseErrors = new Counter({
      name: 'outbox_database_errors_total',
      help: 'Total number of database operation errors',
      labelNames: ['operation', 'error_type'],
      registers: [this.registry],
    });

    this.circuitBreakerTrips = new Counter({
      name: 'outbox_circuit_breaker_trips_total',
      help: 'Total number of circuit breaker trips',
      labelNames: ['component', 'state_from', 'state_to'],
      registers: [this.registry],
    });

    this.processingTime = new Gauge({
      name: 'outbox_processing_time_seconds',
      help: 'Current event processing time in seconds',
      labelNames: ['phase'],
      registers: [this.registry],
    });

    this.batchSize = new Gauge({
      name: 'outbox_batch_size',
      help: 'Current batch size being processed',
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: 'outbox_queue_depth',
      help: 'Number of events waiting to be processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.postgresConnectionStatus = new Gauge({
      name: 'outbox_postgres_connection_status',
      help: 'PostgreSQL connection status (1=connected, 0=disconnected)',
      registers: [this.registry],
    });

    this.rabbitMQConnectionStatus = new Gauge({
      name: 'outbox_rabbitmq_connection_status',
      help: 'RabbitMQ connection status (1=connected, 0=disconnected)',
      registers: [this.registry],
    });

    this.circuitBreakerState = new Gauge({
      name: 'outbox_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half_open)',
      labelNames: ['component'],
      registers: [this.registry],
    });

    this.eventProcessingDuration = new Histogram({
      name: 'outbox_event_processing_duration_seconds',
      help: 'Duration of event processing in seconds',
      labelNames: ['event_type', 'event_domain'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.batchProcessingDuration = new Histogram({
      name: 'outbox_batch_processing_duration_seconds',
      help: 'Duration of batch processing in seconds',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.publishDuration = new Histogram({
      name: 'outbox_publish_duration_seconds',
      help: 'Duration of publish operation in seconds',
      labelNames: ['exchange', 'routing_key'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    this.eventsPerBatch = new Summary({
      name: 'outbox_events_per_batch',
      help: 'Summary of events processed per batch',
      labelNames: ['result'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    // Collect default metrics if enabled
    if (this.config.collectDefaultMetrics) {
      collectDefaultMetrics({
        register: this.registry,
        prefix: 'outbox_relay_',
      });
    }

    this.logger.info('Metrics initialized', {
      enabled: this.config.enabled,
      port: this.config.port,
      path: this.config.path,
    });
  }

  /**
   * Records a successful event publish
   *
   * @param eventType - Type of the event
   * @param eventDomain - Domain of the event
   * @param exchange - RabbitMQ exchange
   * @param routingKey - RabbitMQ routing key
   */
  public recordEventPublished(
    eventType: string,
    eventDomain: string,
    exchange: string,
    routingKey: string
  ): void {
    this.eventsPublished.inc({ event_type: eventType, event_domain: eventDomain, exchange, routing_key: routingKey });
  }

  /**
   * Records a failed event publish
   *
   * @param eventType - Type of the event
   * @param eventDomain - Domain of the event
   * @param errorType - Type of the error
   * @param exchange - RabbitMQ exchange
   * @param routingKey - RabbitMQ routing key
   */
  public recordEventFailed(
    eventType: string,
    eventDomain: string,
    errorType: string,
    exchange: string,
    routingKey: string
  ): void {
    this.eventsFailed.inc({ event_type: eventType, event_domain: eventDomain, error_type: errorType, exchange, routing_key: routingKey });
  }

  /**
   * Records an event retry
   *
   * @param eventType - Type of the event
   * @param eventDomain - Domain of the event
   * @param attempt - Attempt number
   */
  public recordEventRetry(eventType: string, eventDomain: string, attempt: number): void {
    this.eventsRetried.inc({ event_type: eventType, event_domain: eventDomain, attempt: attempt.toString() });
  }

  /**
   * Records a discarded event
   *
   * @param eventType - Type of the event
   * @param eventDomain - Domain of the event
   * @param reason - Reason for discarding
   */
  public recordEventDiscarded(eventType: string, eventDomain: string, reason: string): void {
    this.eventsDiscarded.inc({ event_type: eventType, event_domain: eventDomain, reason });
  }

  /**
   * Records a publish error
   *
   * @param errorType - Type of the error
   * @param errorCode - Error code
   */
  public recordPublishError(errorType: string, errorCode?: string): void {
    this.publishErrors.inc({ error_type: errorType, error_code: errorCode || 'unknown' });
  }

  /**
   * Records a database error
   *
   * @param operation - Database operation
   * @param errorType - Type of the error
   */
  public recordDatabaseError(operation: string, errorType: string): void {
    this.databaseErrors.inc({ operation, error_type: errorType });
  }

  /**
   * Records a circuit breaker trip
   *
   * @param component - Component name
   * @param stateFrom - Previous state
   * @param stateTo - New state
   */
  public recordCircuitBreakerTrip(component: string, stateFrom: string, stateTo: string): void {
    this.circuitBreakerTrips.inc({ component, state_from: stateFrom, state_to: stateTo });
  }

  /**
   * Sets the current processing time
   *
   * @param time - Processing time in seconds
   * @param phase - Processing phase
   */
  public setProcessingTime(time: number, phase: string): void {
    this.processingTime.set({ phase }, time);
  }

  /**
   * Sets the current batch size
   *
   * @param size - Batch size
   */
  public setBatchSize(size: number): void {
    this.batchSize.set(size);
  }

  /**
   * Sets the queue depth
   *
   * @param depth - Queue depth
   * @param status - Status of events
   */
  public setQueueDepth(depth: number, status?: string): void {
    if (status) {
      this.queueDepth.set({ status }, depth);
    } else {
      this.queueDepth.set(depth);
    }
  }

  /**
   * Sets the PostgreSQL connection status
   *
   * @param connected - Connection status
   */
  public setPostgresConnectionStatus(connected: boolean): void {
    this.postgresConnectionStatus.set(connected ? 1 : 0);
  }

  /**
   * Sets the RabbitMQ connection status
   *
   * @param connected - Connection status
   */
  public setRabbitMQConnectionStatus(connected: boolean): void {
    this.rabbitMQConnectionStatus.set(connected ? 1 : 0);
  }

  /**
   * Sets the circuit breaker state
   *
   * @param component - Component name
   * @param state - Circuit breaker state
   */
  public setCircuitBreakerState(component: string, state: CircuitBreakerState): void {
    const stateValue = state === CircuitBreakerState.Closed ? 0 : state === CircuitBreakerState.Open ? 1 : 2;
    this.circuitBreakerState.set({ component }, stateValue);
  }

  /**
   * Records event processing duration
   *
   * @param duration - Duration in seconds
   * @param eventType - Type of the event
   * @param eventDomain - Domain of the event
   */
  public recordEventProcessingDuration(duration: number, eventType: string, eventDomain: string): void {
    this.eventProcessingDuration.observe({ event_type: eventType, event_domain: eventDomain }, duration);
  }

  /**
   * Records batch processing duration
   *
   * @param duration - Duration in seconds
   */
  public recordBatchProcessingDuration(duration: number): void {
    this.batchProcessingDuration.observe(duration);
  }

  /**
   * Records publish operation duration
   *
   * @param duration - Duration in seconds
   * @param exchange - RabbitMQ exchange
   * @param routingKey - RabbitMQ routing key
   */
  public recordPublishDuration(duration: number, exchange: string, routingKey: string): void {
    this.publishDuration.observe({ exchange, routing_key: routingKey }, duration);
  }

  /**
   * Records events processed per batch
   *
   * @param count - Number of events
   * @param result - Processing result
   */
  public recordEventsPerBatch(count: number, result: ProcessingResult): void {
    this.eventsPerBatch.observe({ result }, count);
  }

  /**
   * Records a timed operation
   *
   * @param fn - Async function to measure
   * @param eventType - Event type (optional)
   * @param eventDomain - Event domain (optional)
   * @returns Result of the function
   */
  public async recordTimedOperation<T>(
    fn: () => Promise<T>,
    eventType?: string,
    eventDomain?: string
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = (Date.now() - start) / 1000;
      if (eventType && eventDomain) {
        this.recordEventProcessingDuration(duration, eventType, eventDomain);
      }
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      if (eventType && eventDomain) {
        this.recordEventProcessingDuration(duration, eventType, eventDomain);
      }
      throw error;
    }
  }

  /**
   * Gets the Prometheus registry
   *
   * @returns Prometheus registry
   */
  public getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Gets the metrics as a Prometheus string
   *
   * @returns Metrics string
   */
  public async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * Resets all metrics (useful for testing)
   */
  public resetMetrics(): void {
    this.registry.resetMetrics();
  }

  /**
   * Starts pushgateway updates if configured
   */
  public startPushgateway(): void {
    if (!this.config.pushgatewayUrl) {
      return;
    }

    if (this.pushgatewayInterval) {
      return;
    }

    this.logger.info('Starting pushgateway updates', {
      url: this.config.pushgatewayUrl,
      interval: this.config.pushgatewayIntervalMs,
      jobName: this.config.pushgatewayJobName,
    });

    // Import pushgateway dynamically
    const { pushgateway } = require('prom-client');

    this.pushgatewayInterval = setInterval(async () => {
      try {
        await pushgateway({
          url: this.config.pushgatewayUrl,
          jobName: this.config.pushgatewayJobName,
          registry: this.registry,
        });
        this.logger.debug('Metrics pushed to gateway');
      } catch (error) {
        this.logger.error('Failed to push metrics to gateway', error as Error);
      }
    }, this.config.pushgatewayIntervalMs);
  }

  /**
   * Stops pushgateway updates
   */
  public stopPushgateway(): void {
    if (this.pushgatewayInterval) {
      clearInterval(this.pushgatewayInterval);
      this.pushgatewayInterval = undefined;
      this.logger.info('Stopped pushgateway updates');
    }
  }

  /**
   * Shuts down the metrics module
   */
  public async shutdown(): Promise<void> {
    this.stopPushgateway();
    this.logger.info('Metrics module shut down');
  }
}

/**
 * Default metrics instance
 */
let defaultMetrics: OutboxMetrics | null = null;

/**
 * Gets the default metrics instance
 *
 * @param config - Metrics configuration
 * @param logger - Logger instance
 * @returns Metrics instance
 */
export function getMetrics(config?: MetricsConfig, logger?: OutboxLogger): OutboxMetrics {
  if (!defaultMetrics) {
    const metricsConfig = config || getConfig().metrics;
    defaultMetrics = new OutboxMetrics(metricsConfig, logger);
  }
  return defaultMetrics;
}

/**
 * Creates a new metrics instance
 *
 * @param config - Metrics configuration
 * @param logger - Logger instance
 * @returns New metrics instance
 */
export function createMetrics(config: MetricsConfig, logger?: OutboxLogger): OutboxMetrics {
  return new OutboxMetrics(config, logger);
}

export default OutboxMetrics;
