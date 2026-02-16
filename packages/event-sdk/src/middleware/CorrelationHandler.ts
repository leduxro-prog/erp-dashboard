/**
 * @file Correlation Handler Middleware
 * @module event-sdk/middleware/CorrelationHandler
 * @description Correlation ID and trace ID propagation for distributed tracing
 */

import {
  MiddlewareFunction,
  MiddlewareContext,
  CorrelationHandlerConfig,
  Logger,
} from '../types';
import { EventEnvelope } from '@cypher/events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Default header names for correlation and tracing
 */
export const DEFAULT_HEADERS = {
  correlationId: 'x-correlation-id',
  traceId: 'x-trace-id',
  causationId: 'x-causation-id',
  parentEventId: 'x-parent-event-id',
  spanId: 'x-span-id',
};

/**
 * Correlation context data
 */
export interface CorrelationContext {
  correlationId: string;
  traceId: string;
  causationId?: string;
  parentEventId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  tenantId?: string;
}

/**
 * Default correlation handler configuration
 */
const DEFAULT_CORRELATION_HANDLER_CONFIG: Required<CorrelationHandlerConfig> = {
  enabled: true,
  generateTraceId: true,
  correlationIdHeader: DEFAULT_HEADERS.correlationId,
  traceIdHeader: DEFAULT_HEADERS.traceId,
  causationIdHeader: DEFAULT_HEADERS.causationId,
};

/**
 * Error thrown when correlation context is invalid
 */
export class CorrelationContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CorrelationContextError';
  }
}

/**
 * Correlation Handler Middleware
 *
 * Extracts, generates, and propagates correlation IDs and trace IDs
 * for distributed tracing across microservices.
 */
export class CorrelationHandlerMiddleware {
  private config: Required<CorrelationHandlerConfig>;
  private logger?: Logger;
  private spanCounter: number = 0;

  constructor(
    config: Partial<CorrelationHandlerConfig> = {},
    logger?: Logger
  ) {
    this.config = {
      ...DEFAULT_CORRELATION_HANDLER_CONFIG,
      ...config,
      generateTraceId: config.generateTraceId ?? DEFAULT_CORRELATION_HANDLER_CONFIG.generateTraceId,
      correlationIdHeader:
        config.correlationIdHeader ?? DEFAULT_CORRELATION_HANDLER_CONFIG.correlationIdHeader,
      traceIdHeader:
        config.traceIdHeader ?? DEFAULT_CORRELATION_HANDLER_CONFIG.traceIdHeader,
      causationIdHeader:
        config.causationIdHeader ?? DEFAULT_CORRELATION_HANDLER_CONFIG.causationIdHeader,
    };
    this.logger = logger;
  }

  /**
   * Create a middleware function for use in the pipeline
   *
   * @returns Middleware function
   */
  public middleware(): MiddlewareFunction {
    return async (context: MiddlewareContext, next: () => Promise<void>) => {
      // Skip if disabled
      if (!this.config.enabled) {
        await next();
        return;
      }

      // Extract or generate correlation IDs
      const correlationContext = this.extractCorrelationContext(context);

      // Store in context
      context.correlationId = correlationContext.correlationId;
      context.traceId = correlationContext.traceId;
      context.metadata.set('correlationContext', correlationContext);

      // Update envelope if needed
      this.updateEnvelope(context, correlationContext);

      // Generate span ID for this processing step
      const spanId = this.generateSpanId();
      context.metadata.set('spanId', spanId);

      this.debug('Correlation context established', {
        correlationId: context.correlationId,
        traceId: context.traceId,
        spanId,
        eventType: context.envelope.event_type,
      });

      await next();
    };
  }

  /**
   * Extract correlation context from message or generate new IDs
   *
   * @param context - Middleware context
   * @returns Correlation context
   */
  private extractCorrelationContext(
    context: MiddlewareContext
  ): CorrelationContext {
    const headers = context.message.properties.headers || {};
    const envelope = context.envelope;

    // Priority order for correlation ID:
    // 1. Message header
    // 2. Envelope correlation_id
    // 3. Generate new
    let correlationId =
      headers[this.config.correlationIdHeader] as string | undefined ||
      envelope.correlation_id;

    if (!correlationId || !this.isValidUUID(correlationId)) {
      correlationId = envelope.correlation_id || uuidv4();
      this.debug('Generated new correlation ID', { correlationId });
    }

    // Priority order for trace ID:
    // 1. Message header
    // 2. Envelope trace_id
    // 3. Generate new (if configured)
    let traceId =
      headers[this.config.traceIdHeader] as string | undefined ||
      envelope.trace_id;

    if (!traceId || !this.isValidUUID(traceId)) {
      if (this.config.generateTraceId) {
        traceId = correlationId; // Use correlation ID as initial trace ID
        this.debug('Using correlation ID as trace ID', { traceId });
      } else {
        traceId = envelope.trace_id || correlationId;
      }
    }

    // Extract causation ID
    const causationId =
      headers[this.config.causationIdHeader] as string | undefined ||
      envelope.causation_id;

    // Extract parent event ID
    const parentEventId = envelope.parent_event_id;

    // Extract user/session/tenant info
    const userId = envelope.metadata?.user_id;
    const sessionId = envelope.metadata?.session_id;
    const tenantId = envelope.metadata?.tenant_id;

    return {
      correlationId,
      traceId,
      causationId,
      parentEventId,
      userId,
      sessionId,
      tenantId,
    };
  }

  /**
   * Update envelope with correlation context
   *
   * @param context - Middleware context
   * @param correlationContext - Correlation context
   */
  private updateEnvelope(
    context: MiddlewareContext,
    correlationContext: CorrelationContext
  ): void {
    const envelope = context.envelope;

    // Ensure envelope has correlation ID
    if (!envelope.correlation_id) {
      envelope.correlation_id = correlationContext.correlationId;
    }

    // Ensure envelope has trace ID
    if (!envelope.trace_id) {
      envelope.trace_id = correlationContext.traceId;
    }

    // Ensure envelope has causation ID
    if (!envelope.causation_id && correlationContext.causationId) {
      envelope.causation_id = correlationContext.causationId;
    }
  }

  /**
   * Generate a span ID for tracing
   *
   * @returns Span ID
   */
  private generateSpanId(): string {
    this.spanCounter++;
    return `${process.pid}-${Date.now()}-${this.spanCounter}`;
  }

  /**
   * Check if a string is a valid UUID
   *
   * @param str - String to check
   * @returns True if valid UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof str === 'string' && uuidRegex.test(str);
  }

  /**
   * Create headers for outgoing messages
   *
   * @param context - Middleware context
   * @returns Headers object
   */
  public createOutgoingHeaders(context: MiddlewareContext): Record<string, string> {
    const correlationContext = context.metadata.get(
      'correlationContext'
    ) as CorrelationContext | undefined;

    if (!correlationContext) {
      return {};
    }

    return {
      [this.config.correlationIdHeader]: correlationContext.correlationId,
      [this.config.traceIdHeader]: correlationContext.traceId,
      ...(correlationContext.causationId && {
        [this.config.causationIdHeader]: correlationContext.causationId,
      }),
      ...(context.envelope.event_id && {
        [DEFAULT_HEADERS.parentEventId]: context.envelope.event_id,
      }),
    };
  }

  /**
   * Extract correlation context from an HTTP request
   *
   * @param headers - HTTP headers
   * @returns Correlation context
   */
  public extractFromHeaders(headers: Record<string, string | string[] | undefined>): CorrelationContext {
    const getHeaderValue = (key: string): string | undefined => {
      const value = headers[key] || headers[key.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };

    const correlationId =
      getHeaderValue(this.config.correlationIdHeader) ||
      getHeaderValue('correlation-id');

    const traceId =
      getHeaderValue(this.config.traceIdHeader) ||
      getHeaderValue('trace-id');

    const causationId =
      getHeaderValue(this.config.causationIdHeader) ||
      getHeaderValue('causation-id');

    const userId = getHeaderValue('x-user-id');
    const sessionId = getHeaderValue('x-session-id');
    const tenantId = getHeaderValue('x-tenant-id');

    return {
      correlationId: correlationId || uuidv4(),
      traceId: traceId || correlationId || uuidv4(),
      causationId,
      parentEventId: undefined,
      userId,
      sessionId,
      tenantId,
    };
  }

  /**
   * Create a child correlation context
   *
   * @param parent - Parent context
   * @returns Child correlation context
   */
  public createChildContext(parent: CorrelationContext): CorrelationContext {
    return {
      correlationId: parent.correlationId,
      traceId: parent.traceId,
      causationId: parent.parentEventId || parent.causationId,
      userId: parent.userId,
      sessionId: parent.sessionId,
      tenantId: parent.tenantId,
    };
  }

  /**
   * Get the current configuration
   *
   * @returns Current correlation handler configuration
   */
  public getConfig(): Readonly<Required<CorrelationHandlerConfig>> {
    return { ...this.config };
  }

  /**
   * Update the configuration
   *
   * @param config - New configuration values
   */
  public updateConfig(config: Partial<CorrelationHandlerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      generateTraceId: config.generateTraceId ?? this.config.generateTraceId,
      correlationIdHeader:
        config.correlationIdHeader ?? this.config.correlationIdHeader,
      traceIdHeader: config.traceIdHeader ?? this.config.traceIdHeader,
      causationIdHeader:
        config.causationIdHeader ?? this.config.causationIdHeader,
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

  /**
   * Get correlation context from middleware context
   *
   * @param context - Middleware context
   * @returns Correlation context or undefined
   */
  public static getCorrelationContext(
    context: MiddlewareContext
  ): CorrelationContext | undefined {
    return context.metadata.get('correlationContext') as CorrelationContext | undefined;
  }

  private debug(message: string, ...args: unknown[]): void {
    this.logger?.debug(`[CorrelationHandler] ${message}`, ...args);
  }

  private warn(message: string, ...args: unknown[]): void {
    this.logger?.warn(`[CorrelationHandler] ${message}`, ...args);
  }

}

/**
 * Create a correlation handler middleware factory function
 *
 * @param config - Optional configuration
 * @param logger - Optional logger
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const correlationHandler = createCorrelationHandler({
 *   generateTraceId: true
 * });
 * processor.use(correlationHandler);
 * ```
 */
export function createCorrelationHandler(
  config: Partial<CorrelationHandlerConfig> = {},
  logger?: Logger
): MiddlewareFunction {
  const middleware = new CorrelationHandlerMiddleware(config, logger);
  return middleware.middleware();
}

/**
 * Generate a new correlation ID
 *
 * @returns New correlation ID (UUID v4)
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Generate a new trace ID
 *
 * @returns New trace ID (UUID v4)
 */
export function generateTraceId(): string {
  return uuidv4();
}

/**
 * Extract correlation ID from various sources
 *
 * @param source - Source to extract from
 * @returns Correlation ID or undefined
 */
export function extractCorrelationId(
  source: Record<string, unknown> | undefined
): string | undefined {
  if (!source) {
    return undefined;
  }

  // Try various header name formats
  const keys = [
    'x-correlation-id',
    'correlation-id',
    'correlationId',
    'correlation_id',
    'x-request-id',
    'request-id',
    'requestId',
  ];

  for (const key of keys) {
    if (source[key] && typeof source[key] === 'string') {
      return source[key] as string;
    }
  }

  return undefined;
}

/**
 * Extract trace ID from various sources
 *
 * @param source - Source to extract from
 * @returns Trace ID or undefined
 */
export function extractTraceId(
  source: Record<string, unknown> | undefined
): string | undefined {
  if (!source) {
    return undefined;
  }

  // Try various header name formats
  const keys = [
    'x-trace-id',
    'trace-id',
    'traceId',
    'trace_id',
    'x-span-id',
    'span-id',
    'spanId',
  ];

  for (const key of keys) {
    if (source[key] && typeof source[key] === 'string') {
      return source[key] as string;
    }
  }

  return undefined;
}
