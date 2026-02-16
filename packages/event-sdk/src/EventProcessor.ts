/**
 * @file Event Processor
 * @module event-sdk/EventProcessor
 * @description Event processor with middleware pipeline for handling events
 */

import {
  MiddlewareFunction,
  MiddlewareContext,
  EventHandler,
  EventHandlerRegistration,
  EventProcessorOptions,
  ProcessingResult,
  Logger,
  ClassifiedError,
  ErrorType,
  ErrorSeverity,
} from './types';
import { EventEnvelope, EventPriority } from '@cypher/events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event Processor Class
 *
 * Processes events through a configurable middleware pipeline.
 * Handles event routing, error handling, and result reporting.
 */
export class EventProcessor {
  private name: string;
  private middleware: MiddlewareFunction[] = [];
  private handlers: Map<string, EventHandlerRegistration[]> = new Map();
  private errorHandler?: (
    error: ClassifiedError,
    context: MiddlewareContext
  ) => Promise<void>;
  private successHandler?: (context: MiddlewareContext) => Promise<void>;
  private logger?: Logger;
  private parallelProcessing: boolean;
  private maxParallel: number;
  private retryConfig?: any;

  private stats = {
    processed: 0,
    failed: 0,
    retried: 0,
    totalProcessingTime: 0,
  };

  constructor(options: EventProcessorOptions) {
    this.name = options.name;
    this.middleware = options.middleware || [];
    this.parallelProcessing = options.parallelProcessing || false;
    this.maxParallel = options.maxParallel || 10;
    this.errorHandler = options.errorHandler;
    this.successHandler = options.successHandler;
    this.retryConfig = options.retryConfig;

    // Register event handlers
    for (const handler of options.handlers) {
      this.registerHandler(handler);
    }
  }

  /**
   * Process an event through the middleware pipeline
   *
   * @param message - Raw message (for backward compatibility)
   * @param envelope - Event envelope
   * @param channel - AMQP channel
   * @returns Processing result
   */
  public async process(
    message: any,
    envelope: EventEnvelope,
    channel: any
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    // Create context
    const context: MiddlewareContext = {
      message,
      channel,
      envelope,
      correlationId: envelope.correlation_id || uuidv4(),
      traceId: envelope.trace_id,
      startTime,
      retryAttempt: 0,
      skipRemaining: false,
      shouldReject: false,
      metadata: new Map<string, unknown>(),
      idempotencySkipped: false,
    };

    try {
      // Run middleware pipeline
      await this.runMiddlewarePipeline(context);

      // Find and execute event handler
      if (!context.skipRemaining) {
        await this.executeHandler(context);
      }

      // Call success handler
      if (this.successHandler) {
        await this.successHandler(context);
      }

      // Update stats
      this.stats.processed++;
      this.stats.totalProcessingTime += Date.now() - startTime;

      return {
        success: true,
        acknowledged: !context.shouldReject,
        duration: Date.now() - startTime,
        retryCount: context.retryAttempt,
      };
    } catch (error) {
      const classifiedError = error as ClassifiedError;

      // Update stats
      this.stats.failed++;

      // Call error handler
      if (this.errorHandler) {
        await this.errorHandler(classifiedError, context);
      }

      return {
        success: false,
        acknowledged: false,
        duration: Date.now() - startTime,
        retryCount: context.retryAttempt,
        error: classifiedError,
        data: classifiedError.context,
      };
    }
  }

  /**
   * Run the middleware pipeline
   *
   * @param context - Middleware context
   */
  private async runMiddlewarePipeline(
    context: MiddlewareContext
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middleware.length || context.skipRemaining) {
        return;
      }

      const middleware = this.middleware[index++];
      await middleware(context, next);
    };

    await next();
  }

  /**
   * Find and execute the appropriate event handler
   *
   * @param context - Middleware context
   */
  private async executeHandler(context: MiddlewareContext): Promise<void> {
    const eventType = context.envelope.event_type;
    const eventVersion = context.envelope.event_version;

    // Find matching handlers
    const handlers = this.handlers.get(eventType) || [];

    if (handlers.length === 0) {
      // No handler registered for this event type
      this.warn('No handler registered for event type', {
        eventType,
        eventVersion,
      });
      return;
    }

    // Find handler matching version
    const handler =
      handlers.find((h) => h.eventVersion === eventVersion) ||
      handlers.find((h) => !h.eventVersion);

    if (!handler) {
      this.warn('No handler registered for event version', {
        eventType,
        eventVersion,
      });
      return;
    }

    this.debug('Executing event handler', {
      eventType,
      eventVersion,
      handler: handler.consumerName,
    });

    await handler.handler(context);
  }

  /**
   * Register an event handler
   *
   * @param registration - Handler registration
   */
  public registerHandler(registration: EventHandlerRegistration): void {
    const key = registration.eventType;

    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }

    this.handlers.get(key)!.push(registration);

    // Sort handlers by version (specific version first, then undefined)
    this.handlers.get(key)!.sort((a, b) => {
      if (a.eventVersion && !b.eventVersion) return -1;
      if (!a.eventVersion && b.eventVersion) return 1;
      return 0;
    });

    this.debug('Registered event handler', {
      eventType: registration.eventType,
      consumer: registration.consumerName,
    });
  }

  /**
   * Register multiple event handlers
   *
   * @param registrations - Handler registrations
   */
  public registerHandlers(registrations: EventHandlerRegistration[]): void {
    for (const registration of registrations) {
      this.registerHandler(registration);
    }
  }

  /**
   * Unregister an event handler
   *
   * @param eventType - Event type
   * @param consumerName - Consumer name
   */
  public unregisterHandler(eventType: string, consumerName: string): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.findIndex((h) => h.consumerName === consumerName);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Add middleware to the pipeline
   *
   * @param middleware - Middleware function
   */
  public use(middleware: MiddlewareFunction): void {
    this.middleware.push(middleware);
    this.debug('Added middleware to pipeline', { name: this.name });
  }

  /**
   * Remove middleware from the pipeline
   *
   * @param middleware - Middleware function to remove
   */
  public remove(middleware: MiddlewareFunction): void {
    const index = this.middleware.indexOf(middleware);
    if (index !== -1) {
      this.middleware.splice(index, 1);
    }
  }

  /**
   * Set the error handler
   *
   * @param handler - Error handler function
   */
  public setErrorHandler(
    handler: (error: ClassifiedError, context: MiddlewareContext) => Promise<void>
  ): void {
    this.errorHandler = handler;
  }

  /**
   * Set the success handler
   *
   * @param handler - Success handler function
   */
  public setSuccessHandler(
    handler: (context: MiddlewareContext) => Promise<void>
  ): void {
    this.successHandler = handler;
  }

  /**
   * Get registered event handlers
   *
   * @returns Array of handler registrations
   */
  public getHandlers(): EventHandlerRegistration[] {
    const allHandlers: EventHandlerRegistration[] = [];
    for (const handlers of this.handlers.values()) {
      allHandlers.push(...handlers);
    }
    return allHandlers;
  }

  /**
   * Get handlers for a specific event type
   *
   * @param eventType - Event type
   * @returns Array of handler registrations
   */
  public getHandlersForEvent(eventType: string): EventHandlerRegistration[] {
    return this.handlers.get(eventType) || [];
  }

  /**
   * Get processor statistics
   *
   * @returns Processor statistics
   */
  public getStats(): {
    processed: number;
    failed: number;
    retried: number;
    avgProcessingTime: number;
  } {
    return {
      processed: this.stats.processed,
      failed: this.stats.failed,
      retried: this.stats.retried,
      avgProcessingTime:
        this.stats.processed > 0
          ? this.stats.totalProcessingTime / this.stats.processed
          : 0,
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      totalProcessingTime: 0,
    };
  }

  /**
   * Set the logger
   *
   * @param logger - Logger instance
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  private debug(message: string, ...args: unknown[]): void {
    this.logger?.debug(`[EventProcessor:${this.name}] ${message}`, ...args);
  }

  private info(message: string, ...args: unknown[]): void {
    this.logger?.info(`[EventProcessor:${this.name}] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]): void {
    this.logger?.warn(`[EventProcessor:${this.name}] ${message}`, ...args);
  }

  private error(message: string, ...args: unknown[]): void {
    this.logger?.error(`[EventProcessor:${this.name}] ${message}`, ...args);
  }
}

/**
 * Create an event processor with default configuration
 *
 * @param name - Processor name
 * @returns EventProcessor instance
 */
export function createEventProcessor(name: string): EventProcessor {
  return new EventProcessor({
    name,
    middleware: [],
    handlers: [],
    parallelProcessing: false,
    maxParallel: 10,
  });
}
