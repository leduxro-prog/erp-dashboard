/**
 * @file Event Envelope Types and Factory
 * @module events/types/EventEnvelope
 * @description Provides TypeScript interfaces and factory methods for event envelopes
 * used throughout the Cypher ERP event-driven architecture.
 *
 * The event envelope follows CQRS/Event Sourcing patterns with full traceability.
 */

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import Ajv, { ValidateFunction } from 'ajv';

/**
 * Event priority levels for routing and processing
 */
export enum EventPriority {
  /** Low priority - background processing, non-critical events */
  LOW = 'low',
  /** Normal priority - standard business events */
  NORMAL = 'normal',
  /** High priority - requires prompt processing */
  HIGH = 'high',
  /** Critical priority - immediate processing required */
  CRITICAL = 'critical',
}

/**
 * Metadata that can be attached to events for additional context
 */
export interface EventMetadata {
  /** User ID who triggered the event (if applicable) */
  user_id?: string;
  /** Session ID of the user session */
  session_id?: string;
  /** Source IP address */
  ip_address?: string;
  /** User agent string */
  user_agent?: string;
  /** Tenant ID for multi-tenant scenarios */
  tenant_id?: string;
  /** Additional custom metadata */
  [key: string]: any;
}

/**
 * The core Event Envelope interface
 *
 * This envelope wraps all events in the system, providing:
 * - Unique identification
 * - Versioning support
 * - Full traceability through causation and correlation IDs
 * - Routing information
 * - Priority-based processing
 */
export interface EventEnvelope<TPayload = any> {
  /** Unique identifier for this specific event instance */
  event_id: string;
  /** Type of event (e.g., 'order.created', 'product.updated') */
  event_type: string;
  /** Schema version for the event payload */
  event_version: string;
  /** ISO 8601 timestamp when the event occurred */
  occurred_at: string;
  /** Service/module that produced the event */
  producer: string;
  /** Version of the producing service */
  producer_version?: string;
  /** Instance identifier of the producer (useful for debugging) */
  producer_instance?: string;
  /** Correlation ID for grouping related events (e.g., single transaction) */
  correlation_id: string;
  /** ID of the event that caused this event (causation chain) */
  causation_id?: string;
  /** ID of the parent event in a hierarchical event structure */
  parent_event_id?: string;
  /** Distributed trace ID for cross-service tracing */
  trace_id?: string;
  /** RabbitMQ routing key for message routing */
  routing_key?: string;
  /** Processing priority level */
  priority: EventPriority;
  /** The actual event payload */
  payload: TPayload;
  /** Optional metadata for additional context */
  metadata?: EventMetadata;
}

/**
 * Factory configuration options for creating event envelopes
 */
export interface EventEnvelopeOptions<TPayload> {
  event_type: string;
  event_version?: string;
  producer: string;
  producer_version?: string;
  producer_instance?: string;
  correlation_id?: string;
  causation_id?: string;
  parent_event_id?: string;
  trace_id?: string;
  routing_key?: string;
  priority?: EventPriority;
  payload: TPayload;
  metadata?: EventMetadata;
  occurred_at?: string;
}

/**
 * Validation result for event envelope
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors: Array<{
    /** Path to the invalid field */
    path: string;
    /** Error message */
    message: string;
    /** Expected value/type */
    expected?: any;
    /** Actual value received */
    actual?: any;
  }>;
}

/**
 * Event Envelope Factory
 *
 * Provides methods to create, validate, and manipulate event envelopes.
 * All event creation should go through this factory to ensure consistency.
 */
export class EventEnvelopeFactory {
  private static ajv: any = new Ajv({
    allErrors: true,
    verbose: true,
  });

  /**
   * Creates a new event envelope
   *
   * @param options - Event envelope configuration
   * @returns A new EventEnvelope instance
   *
   * @example
   * ```typescript
   * const envelope = EventEnvelopeFactory.create({
   *   event_type: 'order.created',
   *   producer: 'order-service',
   *   payload: { order_id: '123', total: 100.50 }
   * });
   * ```
   */
  public static create<TPayload = any>(
    options: EventEnvelopeOptions<TPayload>,
  ): EventEnvelope<TPayload> {
    const now = new Date().toISOString();
    const correlationId = options.correlation_id || uuidv4();

    return {
      event_id: uuidv4(),
      event_type: options.event_type,
      event_version: options.event_version || 'v1',
      occurred_at: options.occurred_at || now,
      producer: options.producer,
      producer_version: options.producer_version,
      producer_instance: options.producer_instance,
      correlation_id: correlationId,
      causation_id: options.causation_id,
      parent_event_id: options.parent_event_id,
      trace_id: options.trace_id || correlationId,
      routing_key: options.routing_key || `${options.event_type}.${options.event_version || 'v1'}`,
      priority: options.priority || EventPriority.NORMAL,
      payload: options.payload,
      metadata: options.metadata,
    };
  }

  /**
   * Creates a child event envelope from a parent event
   *
   * @param parent - The parent event envelope
   * @param eventType - Type of the child event
   * @param producer - Service producing the child event
   * @param payload - Payload for the child event
   * @param options - Additional options
   * @returns A new EventEnvelope that is linked to the parent
   *
   * @example
   * ```typescript
   * const childEvent = EventEnvelopeFactory.createChild(
   *   parentEvent,
   *   'payment.authorized',
   *   'payment-service',
   *   { payment_id: 'abc123' }
   * );
   * ```
   */
  public static createChild<TPayload = any, TParentPayload = any>(
    parent: EventEnvelope<TParentPayload>,
    eventType: string,
    producer: string,
    payload: TPayload,
    options?: Partial<EventEnvelopeOptions<TPayload>>,
  ): EventEnvelope<TPayload> {
    return EventEnvelopeFactory.create({
      event_type: eventType,
      producer,
      payload,
      correlation_id: parent.correlation_id,
      causation_id: parent.event_id,
      parent_event_id: parent.event_id,
      trace_id: parent.trace_id,
      ...options,
    });
  }

  /**
   * Creates a batch of related events
   *
   * @param baseConfig - Base configuration shared by all events
   * @param events - Array of event configurations
   * @returns Array of EventEnvelope instances
   *
   * @example
   * ```typescript
   * const events = EventEnvelopeFactory.createBatch(
   *   { producer: 'order-service', correlation_id: 'abc123' },
   *   [
   *     { event_type: 'order.created', payload: { ... } },
   *     { event_type: 'inventory.reserved', payload: { ... } }
   *   ]
   * );
   * ```
   */
  public static createBatch<TPayload = any>(
    baseConfig: Partial<EventEnvelopeOptions<TPayload>>,
    events: Array<{
      event_type: string;
      payload: TPayload;
      options?: Partial<EventEnvelopeOptions<TPayload>>;
    }>,
  ): EventEnvelope<TPayload>[] {
    const correlationId = baseConfig.correlation_id || uuidv4();
    const traceId = baseConfig.trace_id || correlationId;

    return events.map((eventConfig) => {
      const producer = eventConfig.options?.producer || baseConfig.producer || 'system';
      return EventEnvelopeFactory.create({
        ...baseConfig,
        ...eventConfig.options,
        producer,
        event_type: eventConfig.event_type,
        payload: eventConfig.payload,
        correlation_id: correlationId,
        trace_id: traceId,
      });
    });
  }

  /**
   * Validates an event envelope structure
   *
   * @param envelope - Event envelope to validate
   * @returns ValidationResult with validity status and any errors
   *
   * @example
   * ```typescript
   * const result = EventEnvelopeFactory.validate(envelope);
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  public static validate<TPayload = any>(envelope: EventEnvelope<TPayload>): ValidationResult {
    const errors: ValidationResult['errors'] = [];

    // Validate event_id
    if (!envelope.event_id || !uuidValidate(envelope.event_id)) {
      errors.push({
        path: 'event_id',
        message: 'event_id must be a valid UUID v4',
        expected: 'UUID v4',
        actual: envelope.event_id,
      });
    }

    // Validate event_type
    if (!envelope.event_type || typeof envelope.event_type !== 'string') {
      errors.push({
        path: 'event_type',
        message: 'event_type must be a non-empty string',
        expected: 'non-empty string',
        actual: envelope.event_type,
      });
    } else if (
      !/^(?:[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*|[a-z][a-z0-9-]*\.[a-z0-9]+-[a-z0-9-]*\.[a-z][a-z0-9-]*)$/.test(
        envelope.event_type,
      )
    ) {
      errors.push({
        path: 'event_type',
        message: 'event_type must follow pattern: domain.action (e.g., order.created)',
        expected: 'domain.action format',
        actual: envelope.event_type,
      });
    }

    // Validate event_version
    if (!envelope.event_version || typeof envelope.event_version !== 'string') {
      errors.push({
        path: 'event_version',
        message: 'event_version must be a non-empty string',
        expected: 'non-empty string (e.g., v1, v2)',
        actual: envelope.event_version,
      });
    } else if (!/^v\d+$/.test(envelope.event_version)) {
      errors.push({
        path: 'event_version',
        message: 'event_version must follow pattern: v{number} (e.g., v1, v2)',
        expected: 'v{number}',
        actual: envelope.event_version,
      });
    }

    // Validate occurred_at
    if (!envelope.occurred_at || typeof envelope.occurred_at !== 'string') {
      errors.push({
        path: 'occurred_at',
        message: 'occurred_at must be a non-empty ISO 8601 timestamp',
        expected: 'ISO 8601 timestamp',
        actual: envelope.occurred_at,
      });
    } else {
      const isoUtcDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
      if (
        !isoUtcDateTimeRegex.test(envelope.occurred_at) ||
        isNaN(Date.parse(envelope.occurred_at))
      ) {
        errors.push({
          path: 'occurred_at',
          message: 'occurred_at must be a valid date',
          expected: 'valid ISO 8601 date',
          actual: envelope.occurred_at,
        });
      }
    }

    // Validate producer
    if (!envelope.producer || typeof envelope.producer !== 'string') {
      errors.push({
        path: 'producer',
        message: 'producer must be a non-empty string',
        expected: 'non-empty string',
        actual: envelope.producer,
      });
    }

    // Validate correlation_id
    if (!envelope.correlation_id || !uuidValidate(envelope.correlation_id)) {
      errors.push({
        path: 'correlation_id',
        message: 'correlation_id must be a valid UUID v4',
        expected: 'UUID v4',
        actual: envelope.correlation_id,
      });
    }

    // Validate optional UUID fields if present
    if (
      envelope.causation_id &&
      typeof envelope.causation_id === 'string' &&
      !uuidValidate(envelope.causation_id)
    ) {
      errors.push({
        path: 'causation_id',
        message: 'causation_id must be a valid UUID v4 if provided',
        expected: 'UUID v4',
        actual: envelope.causation_id,
      });
    }

    if (
      envelope.parent_event_id &&
      typeof envelope.parent_event_id === 'string' &&
      !uuidValidate(envelope.parent_event_id)
    ) {
      errors.push({
        path: 'parent_event_id',
        message: 'parent_event_id must be a valid UUID v4 if provided',
        expected: 'UUID v4',
        actual: envelope.parent_event_id,
      });
    }

    // Validate priority
    if (!envelope.priority || !Object.values(EventPriority).includes(envelope.priority)) {
      errors.push({
        path: 'priority',
        message: `priority must be one of: ${Object.values(EventPriority).join(', ')}`,
        expected: Object.values(EventPriority),
        actual: envelope.priority,
      });
    }

    // Validate payload
    if (envelope.payload === undefined || envelope.payload === null) {
      errors.push({
        path: 'payload',
        message: 'payload is required',
        expected: 'any object or primitive',
        actual: null,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serializes an event envelope to JSON string
   *
   * @param envelope - Event envelope to serialize
   * @returns JSON string representation
   */
  public static serialize<TPayload = any>(envelope: EventEnvelope<TPayload>): string {
    return JSON.stringify(envelope);
  }

  /**
   * Deserializes a JSON string to an event envelope
   *
   * @param json - JSON string to deserialize
   * @returns EventEnvelope instance
   * @throws Error if JSON is invalid
   */
  public static deserialize<TPayload = any>(json: string): EventEnvelope<TPayload> {
    try {
      return JSON.parse(json) as EventEnvelope<TPayload>;
    } catch (error) {
      throw new Error(`Failed to deserialize event envelope: ${error}`);
    }
  }

  /**
   * Validates an event envelope against a JSON Schema
   *
   * @param envelope - Event envelope to validate
   * @param schema - JSON Schema to validate against
   * @returns ValidationResult with validity status and any errors
   */
  public static validateAgainstSchema<TPayload = any>(
    envelope: EventEnvelope<TPayload>,
    schema: Record<string, any>,
  ): ValidationResult {
    // First validate the envelope structure
    const envelopeValidation = this.validate(envelope);
    if (!envelopeValidation.valid) {
      return envelopeValidation;
    }

    // Validate against the provided schema
    const validate = this.ajv.compile(schema);
    const valid = validate(envelope.payload);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors: ValidationResult['errors'] = (validate.errors || []).map((error: any) => ({
      path: error.instancePath || error.dataPath || 'payload',
      message: error.message || 'Validation error',
      expected: error.schema,
      actual: error.data,
    }));

    return { valid: false, errors };
  }

  /**
   * Extracts routing key from event type and version
   *
   * @param eventType - Type of event
   * @param eventVersion - Version of event
   * @returns Routing key string
   *
   * @example
   * ```typescript
   * EventEnvelopeFactory.buildRoutingKey('order.created', 'v1')
   * // Returns: 'order.created.v1'
   * ```
   */
  public static buildRoutingKey(eventType: string, eventVersion: string): string {
    return `${eventType}.${eventVersion}`;
  }

  /**
   * Parses an event type string into domain and action
   *
   * @param eventType - Event type string (e.g., 'order.created')
   * @returns Object with domain and action properties
   *
   * @example
   * ```typescript
   * EventEnvelopeFactory.parseEventType('order.created')
   * // Returns: { domain: 'order', action: 'created' }
   * ```
   */
  public static parseEventType(eventType: string): {
    domain: string;
    action: string;
  } {
    const parts = eventType.split('.');
    return {
      domain: parts[0] || '',
      action: parts[1] || '',
    };
  }

  /**
   * Creates a retry envelope for a failed event
   *
   * @param original - Original event envelope
   * @param retryCount - Number of retries attempted
   * @returns New event envelope for retry
   */
  public static createRetry<TPayload = any>(
    original: EventEnvelope<TPayload>,
    retryCount: number = 1,
  ): EventEnvelope<TPayload> {
    return EventEnvelopeFactory.create({
      event_type: `${original.event_type}.retry`,
      event_version: original.event_version,
      producer: original.producer,
      producer_version: original.producer_version,
      producer_instance: original.producer_instance,
      correlation_id: original.correlation_id,
      causation_id: original.event_id,
      trace_id: original.trace_id,
      routing_key: original.routing_key,
      priority: original.priority,
      payload: {
        ...original.payload,
        _retry: {
          count: retryCount,
          original_event_id: original.event_id,
          original_occurred_at: original.occurred_at,
        },
      },
      metadata: {
        ...original.metadata,
        retry_count: retryCount,
        original_event_id: original.event_id,
      },
    });
  }

  /**
   * Creates a dead letter envelope for a permanently failed event
   *
   * @param original - Original event envelope
   * @param reason - Reason for moving to dead letter
   * @param error - Error details
   * @returns New event envelope for dead letter queue
   */
  public static createDeadLetter<TPayload = any>(
    original: EventEnvelope<TPayload>,
    reason: string,
    error?: Error,
  ): EventEnvelope<TPayload> {
    return EventEnvelopeFactory.create({
      event_type: `${original.event_type}.dead_letter`,
      event_version: original.event_version,
      producer: original.producer,
      correlation_id: original.correlation_id,
      causation_id: original.event_id,
      trace_id: original.trace_id,
      priority: EventPriority.LOW,
      payload: {
        ...original.payload,
        _dead_letter: {
          reason,
          original_event_id: original.event_id,
          original_occurred_at: original.occurred_at,
          error_message: error?.message,
          error_stack: error?.stack,
        },
      },
      metadata: {
        ...original.metadata,
        dead_letter: true,
        reason,
        error_message: error?.message,
      },
    });
  }
}

/**
 * Utility functions for working with event envelopes
 */
export class EventEnvelopeUtils {
  /**
   * Checks if an event is of a specific type
   *
   * @param envelope - Event envelope to check
   * @param eventType - Event type to match against
   * @returns True if event matches the type
   */
  public static isEventType<TPayload = any>(
    envelope: EventEnvelope<TPayload>,
    eventType: string,
  ): boolean {
    return envelope.event_type === eventType;
  }

  /**
   * Checks if an event is from a specific producer
   *
   * @param envelope - Event envelope to check
   * @param producer - Producer name to match against
   * @returns True if event is from the producer
   */
  public static isFromProducer<TPayload = any>(
    envelope: EventEnvelope<TPayload>,
    producer: string,
  ): boolean {
    return envelope.producer === producer;
  }

  /**
   * Checks if an event has a specific priority level or higher
   *
   * @param envelope - Event envelope to check
   * @param minPriority - Minimum priority level
   * @returns True if event priority is at or above the minimum
   */
  public static hasPriority<TPayload = any>(
    envelope: EventEnvelope<TPayload>,
    minPriority: EventPriority,
  ): boolean {
    const priorityOrder = [
      EventPriority.LOW,
      EventPriority.NORMAL,
      EventPriority.HIGH,
      EventPriority.CRITICAL,
    ];
    return priorityOrder.indexOf(envelope.priority) >= priorityOrder.indexOf(minPriority);
  }

  /**
   * Gets the age of an event in milliseconds
   *
   * @param envelope - Event envelope
   * @returns Age in milliseconds
   */
  public static getAge<TPayload = any>(envelope: EventEnvelope<TPayload>): number {
    return Date.now() - new Date(envelope.occurred_at).getTime();
  }

  /**
   * Checks if an event is expired based on age
   *
   * @param envelope - Event envelope
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns True if event is expired
   */
  public static isExpired<TPayload = any>(
    envelope: EventEnvelope<TPayload>,
    maxAgeMs: number,
  ): boolean {
    return this.getAge(envelope) > maxAgeMs;
  }

  /**
   * Creates a summary object from an event envelope
   *
   * @param envelope - Event envelope
   * @returns Summary object
   */
  public static toSummary<TPayload = any>(
    envelope: EventEnvelope<TPayload>,
  ): {
    event_id: string;
    event_type: string;
    event_version: string;
    occurred_at: string;
    producer: string;
    correlation_id: string;
    priority: EventPriority;
    payload_summary: string;
  } {
    return {
      event_id: envelope.event_id,
      event_type: envelope.event_type,
      event_version: envelope.event_version,
      occurred_at: envelope.occurred_at,
      producer: envelope.producer,
      correlation_id: envelope.correlation_id,
      priority: envelope.priority,
      payload_summary: JSON.stringify(envelope.payload).slice(0, 200),
    };
  }
}

// Type guards
/**
 * Type guard to check if a value is an EventEnvelope
 */
export function isEventEnvelope(value: any): value is EventEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.event_id === 'string' &&
    typeof value.event_type === 'string' &&
    typeof value.event_version === 'string' &&
    typeof value.occurred_at === 'string' &&
    typeof value.producer === 'string' &&
    typeof value.correlation_id === 'string' &&
    typeof value.payload !== 'undefined'
  );
}

/**
 * Type guard to check if a value is a valid EventPriority
 */
export function isEventPriority(value: any): value is EventPriority {
  return Object.values(EventPriority).includes(value);
}
