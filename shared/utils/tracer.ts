import { randomUUID } from 'crypto';

/**
 * Represents a span event with name and optional attributes
 */
interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number>;
}

/**
 * Represents a single span in a distributed trace
 */
export interface ISpan {
  /** Unique identifier for this span */
  spanId: string;
  /** Identifier for the overall trace context */
  traceId: string;
  /** Human-readable name of the span operation */
  name: string;
  /** Unix timestamp when the span started */
  startTime: number;
  /** Parent span ID for nested spans, if applicable */
  parentSpanId?: string;
  /** Key-value attributes attached to the span */
  attributes: Map<string, string | number | boolean>;
  /** Events that occurred during the span lifetime */
  events: SpanEvent[];
  /** Unix timestamp when the span ended */
  endTime?: number;
  /** Duration of the span in milliseconds */
  duration?: number;
  /**
   * End the span and record the end time
   */
  end(): void;
  /**
   * Add an event to this span
   * @param name - Event name
   * @param attributes - Optional event attributes
   */
  addEvent(name: string, attributes?: Record<string, string | number>): void;
  /**
   * Set an attribute on this span
   * @param key - Attribute key
   * @param value - Attribute value
   */
  setAttribute(key: string, value: string | number | boolean): void;
}

/**
 * Represents a tracer that can create spans for operations
 */
export interface ITracer {
  /**
   * Start a new span
   * @param name - Name of the operation
   * @param parentSpanId - Optional parent span ID for nested tracing
   * @returns A new span object
   */
  startSpan(name: string, parentSpanId?: string): ISpan;
  /**
   * Get the current trace ID
   * @returns The trace ID associated with this tracer
   */
  getTraceId(): string;
}

/**
 * Implementation of ISpan interface
 */
class Span implements ISpan {
  readonly spanId: string;
  readonly traceId: string;
  readonly name: string;
  readonly startTime: number;
  readonly parentSpanId?: string;
  readonly attributes: Map<string, string | number | boolean>;
  readonly events: SpanEvent[] = [];
  endTime?: number;
  duration?: number;

  /**
   * Create a new span
   * @param traceId - Parent trace ID
   * @param name - Operation name
   * @param parentSpanId - Optional parent span ID
   */
  constructor(traceId: string, name: string, parentSpanId?: string) {
    this.traceId = traceId;
    this.spanId = randomUUID();
    this.name = name;
    this.startTime = Date.now();
    this.parentSpanId = parentSpanId;
    this.attributes = new Map();
  }

  /**
   * End the span and calculate duration
   */
  end(): void {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
  }

  /**
   * Add an event to this span
   * @param name - Event name
   * @param attributes - Optional event attributes
   */
  addEvent(name: string, attributes?: Record<string, string | number>): void {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Set an attribute on this span
   * @param key - Attribute key
   * @param value - Attribute value
   */
  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes.set(key, value);
  }
}

/**
 * Implementation of ITracer interface
 * Provides lightweight distributed tracing without external dependencies
 */
export class Tracer implements ITracer {
  private traceId: string;

  /**
   * Create a new tracer instance
   * @param traceId - Optional trace ID; generates new UUID if not provided
   */
  constructor(traceId?: string) {
    this.traceId = traceId || randomUUID();
  }

  /**
   * Start a new span for an operation
   * @param name - Name of the operation
   * @param parentSpanId - Optional parent span ID for nested operations
   * @returns A new span instance
   */
  startSpan(name: string, parentSpanId?: string): ISpan {
    return new Span(this.traceId, name, parentSpanId);
  }

  /**
   * Get the trace ID associated with this tracer
   * @returns The trace ID string
   */
  getTraceId(): string {
    return this.traceId;
  }
}

export default Tracer;
