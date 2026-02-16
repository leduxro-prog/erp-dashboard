/**
 * Audit Trail Validator
 *
 * Validates complete audit trail for event bus operations.
 * Verifies outbox_events and processed_events tables.
 *
 * @module tests/e2e/eventbus/AuditTrailValidator
 */

import { TestPostgres } from '../../events/reliability/helpers/TestPostgres';
import { v4 as uuidv4 } from 'uuid';

/**
 * Outbox event record from database
 */
export interface OutboxEventRecord {
  id: string;
  event_id: string;
  event_type: string;
  event_version: string;
  event_domain: string;
  source_service: string;
  source_entity_type?: string;
  source_entity_id?: string;
  correlation_id?: string;
  causation_id?: string;
  parent_event_id?: string;
  payload: Record<string, unknown>;
  payload_size?: number;
  metadata: Record<string, unknown>;
  content_type: string;
  priority: string;
  publish_to: string;
  exchange?: string;
  routing_key?: string;
  topic?: string;
  status: 'pending' | 'processing' | 'published' | 'failed' | 'discarded';
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  occurred_at: Date;
  created_at: Date;
  published_at?: Date;
  failed_at?: Date;
  error_message?: string;
  error_code?: string;
  error_details?: Record<string, unknown>;
  version: number;
  updated_at: Date;
}

/**
 * Processed event record from database
 */
export interface ProcessedEventRecord {
  id: string;
  event_id: string;
  event_type: string;
  consumer_name: string;
  status: 'completed' | 'failed';
  result?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  processing_duration_ms?: number;
  processing_attempts: number;
  processed_at: Date;
  updated_at: Date;
}

/**
 * Audit trail validation options
 */
export interface AuditValidationOptions {
  /** Expected correlation ID */
  correlationId?: string;
  /** Expected trace ID */
  traceId?: string;
  /** Expected consumer names */
  expectedConsumers?: string[];
  /** Expected event sequence */
  expectedSequence?: Array<{ eventType: string; domain: string }>;
  /** Maximum allowed time skew in milliseconds */
  maxTimeSkewMs?: number;
  /** Whether to validate payload consistency */
  validatePayloadConsistency?: boolean;
}

/**
 * Audit trail validation result
 */
export interface AuditValidationResult {
  /** Overall validation result */
  valid: boolean;
  /** Outbox event record */
  outboxEvent?: OutboxEventRecord;
  /** Processed event records */
  processedEvents: ProcessedEventRecord[];
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Correlation chain */
  correlationChain?: string[];
  /** Event sequence */
  eventSequence?: Array<{ eventType: string; domain: string; timestamp: Date }>;
}

/**
 * Audit Trail Validator class
 */
export class AuditTrailValidator {
  private postgres: TestPostgres;
  private schema: string;

  constructor(postgres: TestPostgres, schema: string = 'shared') {
    this.postgres = postgres;
    this.schema = schema;
  }

  /**
   * Validates complete audit trail for an event
   *
   * @param eventId - Event ID to validate
   * @param options - Validation options
   * @returns Validation result
   */
  async validateAuditTrail(
    eventId: string,
    options: AuditValidationOptions = {}
  ): Promise<AuditValidationResult> {
    const result: AuditValidationResult = {
      valid: true,
      processedEvents: [],
      errors: [],
      warnings: [],
    };

    try {
      // Fetch outbox event
      const outboxEvent = await this.fetchOutboxEvent(eventId);
      if (!outboxEvent) {
        result.errors.push(`Outbox event not found for event_id: ${eventId}`);
        result.valid = false;
        return result;
      }
      result.outboxEvent = outboxEvent;

      // Fetch processed events
      const processedEvents = await this.fetchProcessedEvents(eventId);
      result.processedEvents = processedEvents;

      // Validate outbox event structure
      this.validateOutboxEventStructure(outboxEvent, result);

      // Validate event status
      this.validateEventStatus(outboxEvent, result);

      // Validate correlation ID propagation
      this.validateCorrelationId(outboxEvent, processedEvents, options, result);

      // Validate trace ID propagation
      this.validateTraceId(outboxEvent, processedEvents, options, result);

      // Validate timestamp consistency
      this.validateTimestampConsistency(outboxEvent, processedEvents, options, result);

      // Validate event sequence
      this.validateEventSequence(outboxEvent, processedEvents, options, result);

      // Validate payload consistency
      if (options.validatePayloadConsistency) {
        this.validatePayloadConsistency(outboxEvent, processedEvents, result);
      }

      // Build correlation chain
      result.correlationChain = await this.buildCorrelationChain(outboxEvent);

      // Build event sequence
      result.eventSequence = this.buildEventSequence(outboxEvent, processedEvents);

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Validates audit trail for multiple events
   *
   * @param eventIds - Array of event IDs to validate
   * @param options - Validation options
   * @returns Array of validation results
   */
  async validateMultipleAuditTrails(
    eventIds: string[],
    options: AuditValidationOptions = {}
  ): Promise<AuditValidationResult[]> {
    const results: AuditValidationResult[] = [];

    for (const eventId of eventIds) {
      const result = await this.validateAuditTrail(eventId, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Waits for audit trail to be complete
   *
   * @param eventId - Event ID to wait for
   * @param expectedStatus - Expected status
   * @param timeoutMs - Timeout in milliseconds
   * @returns Validation result
   */
  async waitForAuditTrail(
    eventId: string,
    expectedStatus: 'published' | 'failed' | 'discarded' = 'published',
    timeoutMs: number = 30000
  ): Promise<AuditValidationResult> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.validateAuditTrail(eventId);

      if (result.outboxEvent && result.outboxEvent.status === expectedStatus) {
        return result;
      }

      // Check for failed/discarded status
      if (result.outboxEvent && ['failed', 'discarded'].includes(result.outboxEvent.status)) {
        result.warnings.push(`Event status is ${result.outboxEvent.status}, expected ${expectedStatus}`);
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // Timeout reached
    const result = await this.validateAuditTrail(eventId);
    result.errors.push(`Timeout waiting for audit trail completion (${timeoutMs}ms)`);
    result.valid = false;
    return result;
  }

  /**
   * Validates event ordering for a sequence of events
   *
   * @param eventIds - Array of event IDs
   * @returns Validation result
   */
  async validateEventOrdering(eventIds: string[]): Promise<{
    ordered: boolean;
    sequence: Array<{ eventId: string; timestamp: Date; order: number }>;
    errors: string[];
  }> {
    const events = await Promise.all(
      eventIds.map((id) => this.fetchOutboxEvent(id))
    );

    const validEvents = events.filter((e) => e !== undefined) as OutboxEventRecord[];
    const errors: string[] = [];

    // Check if all events were found
    if (validEvents.length !== eventIds.length) {
      errors.push(`Only ${validEvents.length}/${eventIds.length} events found in outbox`);
    }

    // Verify order based on occurred_at timestamp
    const sequence = validEvents.map((event, index) => ({
      eventId: event.event_id,
      timestamp: event.occurred_at,
      order: index,
    }));

    let ordered = true;
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].timestamp < sequence[i - 1].timestamp) {
        ordered = false;
        errors.push(
          `Event ${sequence[i].eventId} occurred before ${sequence[i - 1].eventId}`
        );
      }
    }

    return { ordered, sequence, errors };
  }

  /**
   * Validates correlation chain for related events
   *
   * @param rootEventId - Root event ID
   * @param expectedChainLength - Expected chain length
   * @returns Validation result
   */
  async validateCorrelationChain(
    rootEventId: string,
    expectedChainLength?: number
  ): Promise<{
    valid: boolean;
    chain: Array<{
      eventId: string;
      correlationId: string;
      causationId?: string;
      parentEventId?: string;
      eventType: string;
      domain: string;
    }>;
    errors: string[];
  }> {
    const chain: Array<{
      eventId: string;
      correlationId: string;
      causationId?: string;
      parentEventId?: string;
      eventType: string;
      domain: string;
    }> = [];

    const errors: string[] = [];
    let currentEventId = rootEventId;
    const visited = new Set<string>();

    // Build correlation chain
    while (currentEventId && !visited.has(currentEventId)) {
      visited.add(currentEventId);

      const event = await this.fetchOutboxEvent(currentEventId);
      if (!event) {
        errors.push(`Event ${currentEventId} not found in outbox`);
        break;
      }

      chain.push({
        eventId: event.event_id,
        correlationId: event.correlation_id || event.event_id,
        causationId: event.causation_id,
        parentEventId: event.parent_event_id,
        eventType: event.event_type,
        domain: event.event_domain,
      });

      // Move to next event in chain
      currentEventId = event.causation_id || event.parent_event_id || '';
    }

    // Detect cycles
    if (visited.size !== chain.length) {
      errors.push('Cycle detected in correlation chain');
    }

    // Validate chain length
    if (expectedChainLength && chain.length !== expectedChainLength) {
      errors.push(
        `Expected chain length ${expectedChainLength}, actual ${chain.length}`
      );
    }

    // Validate correlation ID consistency
    const correlationIds = chain.map((e) => e.correlationId);
    const uniqueCorrelationIds = new Set(correlationIds);

    if (uniqueCorrelationIds.size > 1) {
      // This is valid if events have different correlation IDs
      // but are related through causation_id
      errors.push(
        'Multiple correlation IDs in chain (may be intentional)'
      );
    }

    return {
      valid: errors.length === 0,
      chain,
      errors,
    };
  }

  /**
   * Fetches outbox event by event ID
   *
   * @param eventId - Event ID
   * @returns Outbox event record or null
   */
  private async fetchOutboxEvent(eventId: string): Promise<OutboxEventRecord | null> {
    const result = await this.postgres.query(
      `
      SELECT * FROM ${this.schema}.outbox_events
      WHERE event_id = $1
      `,
      [eventId]
    );

    return result.rows[0] || null;
  }

  /**
   * Fetches processed events by event ID
   *
   * @param eventId - Event ID
   * @returns Array of processed event records
   */
  private async fetchProcessedEvents(eventId: string): Promise<ProcessedEventRecord[]> {
    const result = await this.postgres.query(
      `
      SELECT * FROM ${this.schema}.processed_events
      WHERE event_id = $1
      ORDER BY processed_at ASC
      `,
      [eventId]
    );

    return result.rows;
  }

  /**
   * Validates outbox event structure
   *
   * @param event - Outbox event record
   * @param result - Validation result
   */
  private validateOutboxEventStructure(
    event: OutboxEventRecord,
    result: AuditValidationResult
  ): void {
    const requiredFields = [
      'id',
      'event_id',
      'event_type',
      'event_version',
      'event_domain',
      'source_service',
      'payload',
      'status',
      'attempts',
      'max_attempts',
      'occurred_at',
      'created_at',
    ];

    for (const field of requiredFields) {
      if (!(field in event)) {
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate event_id is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(event.event_id)) {
      result.errors.push(`Invalid event_id format: ${event.event_id}`);
    }

    // Validate payload is valid JSON
    try {
      JSON.parse(JSON.stringify(event.payload));
    } catch {
      result.errors.push('Invalid payload JSON');
    }
  }

  /**
   * Validates event status
   *
   * @param event - Outbox event record
   * @param result - Validation result
   */
  private validateEventStatus(
    event: OutboxEventRecord,
    result: AuditValidationResult
  ): void {
    const validStatuses = ['pending', 'processing', 'published', 'failed', 'discarded'];

    if (!validStatuses.includes(event.status)) {
      result.errors.push(`Invalid status: ${event.status}`);
    }

    // Validate attempts vs max_attempts
    if (event.attempts > event.max_attempts) {
      result.errors.push(
        `Attempts (${event.attempts}) exceeds max_attempts (${event.max_attempts})`
      );
    }

    // Validate status-specific fields
    if (event.status === 'published' && !event.published_at) {
      result.errors.push('Published event missing published_at timestamp');
    }

    if (event.status === 'failed' && !event.failed_at) {
      result.errors.push('Failed event missing failed_at timestamp');
    }

    if (event.status === 'failed' && !event.error_message) {
      result.warnings.push('Failed event missing error_message');
    }
  }

  /**
   * Validates correlation ID propagation
   *
   * @param outboxEvent - Outbox event record
   * @param processedEvents - Processed event records
   * @param options - Validation options
   * @param result - Validation result
   */
  private validateCorrelationId(
    outboxEvent: OutboxEventRecord,
    processedEvents: ProcessedEventRecord[],
    options: AuditValidationOptions,
    result: AuditValidationResult
  ): void {
    const expectedCorrelationId = options.correlationId || outboxEvent.correlation_id;

    if (expectedCorrelationId && outboxEvent.correlation_id !== expectedCorrelationId) {
      result.errors.push(
        `Correlation ID mismatch: expected ${expectedCorrelationId}, got ${outboxEvent.correlation_id}`
      );
    }

    // Verify correlation ID is present if it was set
    if (expectedCorrelationId && outboxEvent.correlation_id) {
      // Check if correlation ID was propagated to payload metadata
      const payloadCorrelationId = outboxEvent.metadata?.correlationId;
      if (payloadCorrelationId && payloadCorrelationId !== expectedCorrelationId) {
        result.warnings.push('Correlation ID mismatch between metadata and payload');
      }
    }

    // Verify processed events have the same correlation context
    for (const processed of processedEvents) {
      // Check if consumer name is expected
      if (options.expectedConsumers && !options.expectedConsumers.includes(processed.consumer_name)) {
        result.warnings.push(
          `Unexpected consumer: ${processed.consumer_name}`
        );
      }
    }
  }

  /**
   * Validates trace ID propagation
   *
   * @param outboxEvent - Outbox event record
   * @param processedEvents - Processed event records
   * @param options - Validation options
   * @param result - Validation result
   */
  private validateTraceId(
    outboxEvent: OutboxEventRecord,
    processedEvents: ProcessedEventRecord[],
    options: AuditValidationOptions,
    result: AuditValidationResult
  ): void {
    const traceId = outboxEvent.metadata?.traceId as string | undefined;

    if (options.traceId && traceId !== options.traceId) {
      result.errors.push(
        `Trace ID mismatch: expected ${options.traceId}, got ${traceId}`
      );
    }

    // If trace ID is expected but not present, that's an issue
    if (options.traceId && !traceId) {
      result.errors.push('Trace ID not found in event metadata');
    }
  }

  /**
   * Validates timestamp consistency
   *
   * @param outboxEvent - Outbox event record
   * @param processedEvents - Processed event records
   * @param options - Validation options
   * @param result - Validation result
   */
  private validateTimestampConsistency(
    outboxEvent: OutboxEventRecord,
    processedEvents: ProcessedEventRecord[],
    options: AuditValidationOptions,
    result: AuditValidationResult
  ): void {
    const maxSkew = options.maxTimeSkewMs || 5000;

    // Validate outbox event timestamps
    if (outboxEvent.occurred_at > outboxEvent.created_at) {
      result.errors.push('occurred_at is after created_at');
    }

    if (outboxEvent.published_at && outboxEvent.published_at < outboxEvent.created_at) {
      result.errors.push('published_at is before created_at');
    }

    if (outboxEvent.failed_at && outboxEvent.failed_at < outboxEvent.created_at) {
      result.errors.push('failed_at is before created_at');
    }

    // Validate processed event timestamps
    for (const processed of processedEvents) {
      if (processed.processed_at < outboxEvent.created_at) {
        result.errors.push(
          `processed_at (${processed.processed_at}) is before event created_at (${outboxEvent.created_at})`
        );
      }

      // Validate processing duration is reasonable
      if (processed.processing_duration_ms && processed.processing_duration_ms < 0) {
        result.errors.push('Negative processing duration');
      }

      if (processed.processing_duration_ms && processed.processing_duration_ms > 3600000) {
        result.warnings.push('Processing duration exceeds 1 hour');
      }
    }

    // Verify processing happened after publishing (if published)
    if (outboxEvent.published_at && processedEvents.length > 0) {
      const firstProcessed = processedEvents[0];
      const timeDiff = firstProcessed.processed_at.getTime() - outboxEvent.published_at.getTime();

      if (timeDiff < 0) {
        result.errors.push('Event processed before being published');
      }

      if (timeDiff > maxSkew) {
        result.warnings.push(
          `Large time gap between publish and process: ${timeDiff}ms`
        );
      }
    }
  }

  /**
   * Validates event sequence
   *
   * @param outboxEvent - Outbox event record
   * @param processedEvents - Processed event records
   * @param options - Validation options
   * @param result - Validation result
   */
  private validateEventSequence(
    outboxEvent: OutboxEventRecord,
    processedEvents: ProcessedEventRecord[],
    options: AuditValidationOptions,
    result: AuditValidationResult
  ): void {
    if (options.expectedSequence) {
      // Verify outbox event matches expected sequence
      const expectedEvent = options.expectedSequence[0];
      if (
        expectedEvent.eventType !== outboxEvent.event_type ||
        expectedEvent.domain !== outboxEvent.event_domain
      ) {
        result.errors.push(
          `Event sequence mismatch: expected ${expectedEvent.eventType}/${expectedEvent.domain}, got ${outboxEvent.event_type}/${outboxEvent.event_domain}`
        );
      }
    }

    // Verify processed events are in order
    for (let i = 1; i < processedEvents.length; i++) {
      if (processedEvents[i].processed_at < processedEvents[i - 1].processed_at) {
        result.errors.push(
          `Processed events out of order: ${processedEvents[i - 1].processed_at} vs ${processedEvents[i].processed_at}`
        );
      }
    }
  }

  /**
   * Validates payload consistency
   *
   * @param outboxEvent - Outbox event record
   * @param processedEvents - Processed event records
   * @param result - Validation result
   */
  private validatePayloadConsistency(
    outboxEvent: OutboxEventRecord,
    processedEvents: ProcessedEventRecord[],
    result: AuditValidationResult
  ): void {
    // Verify payload size is accurate
    const actualPayloadSize = JSON.stringify(outboxEvent.payload).length;

    if (outboxEvent.payload_size !== undefined) {
      if (outboxEvent.payload_size !== actualPayloadSize) {
        result.warnings.push(
          `Payload size mismatch: recorded ${outboxEvent.payload_size}, actual ${actualPayloadSize}`
        );
      }
    }

    // Verify processed events captured the payload correctly
    for (const processed of processedEvents) {
      if (processed.output) {
        // Check if output contains event_id reference
        const outputStr = JSON.stringify(processed.output);
        if (!outputStr.includes(outboxEvent.event_id)) {
          result.warnings.push(
            `Processed event output doesn't reference event_id: ${outboxEvent.event_id}`
          );
        }
      }
    }
  }

  /**
   * Builds correlation chain for an event
   *
   * @param event - Outbox event record
   * @returns Array of correlation IDs in chain
   */
  private async buildCorrelationChain(
    event: OutboxEventRecord
  ): Promise<string[]> {
    const chain: string[] = [];
    let currentEventId = event.event_id;
    const visited = new Set<string>();

    while (currentEventId && !visited.has(currentEventId)) {
      visited.add(currentEventId);
      const currentEvent = await this.fetchOutboxEvent(currentEventId);

      if (!currentEvent) {
        break;
      }

      chain.push(currentEvent.event_id);
      currentEventId = currentEvent.causation_id || currentEvent.parent_event_id || '';
    }

    return chain;
  }

  /**
   * Builds event sequence from outbox and processed events
   *
   * @param outboxEvent - Outbox event record
   * @param processedEvents - Processed event records
   * @returns Event sequence
   */
  private buildEventSequence(
    outboxEvent: OutboxEventRecord,
    processedEvents: ProcessedEventRecord[]
  ): Array<{ eventType: string; domain: string; timestamp: Date }> {
    const sequence: Array<{ eventType: string; domain: string; timestamp: Date }> = [
      {
        eventType: outboxEvent.event_type,
        domain: outboxEvent.event_domain,
        timestamp: outboxEvent.occurred_at,
      },
    ];

    for (const processed of processedEvents) {
      sequence.push({
        eventType: `processed_${processed.consumer_name}`,
        domain: outboxEvent.event_domain,
        timestamp: processed.processed_at,
      });
    }

    return sequence;
  }

  /**
   * Cleans up audit trail data for a specific test
   *
   * @param correlationId - Correlation ID to clean up
   */
  async cleanupAuditTrail(correlationId?: string): Promise<void> {
    if (correlationId) {
      await this.postgres.query(
        `DELETE FROM ${this.schema}.processed_events WHERE id IN (
          SELECT id FROM ${this.schema}.outbox_events WHERE correlation_id = $1
        )`,
        [correlationId]
      );

      await this.postgres.query(
        `DELETE FROM ${this.schema}.outbox_events WHERE correlation_id = $1`,
        [correlationId]
      );
    }
  }

  /**
   * Gets audit trail statistics
   *
   * @returns Audit trail statistics
   */
  async getAuditTrailStats(): Promise<{
    outboxCount: number;
    processedCount: number;
    byStatus: Record<string, number>;
    byDomain: Record<string, number>;
    byEventType: Record<string, number>;
  }> {
    const outboxResult = await this.postgres.query(
      `
      SELECT
        COUNT(*) as total,
        status,
        event_domain,
        event_type
      FROM ${this.schema}.outbox_events
      GROUP BY status, event_domain, event_type
      `
    );

    const processedResult = await this.postgres.query(
      `
      SELECT COUNT(*) as total, consumer_name
      FROM ${this.schema}.processed_events
      GROUP BY consumer_name
      `
    );

    const byStatus: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    const byEventType: Record<string, number> = {};

    let outboxCount = 0;
    for (const row of outboxResult.rows) {
      outboxCount += parseInt(row.total, 10);
      byStatus[row.status] = (byStatus[row.status] || 0) + parseInt(row.total, 10);
      byDomain[row.event_domain] = (byDomain[row.event_domain] || 0) + parseInt(row.total, 10);
      byEventType[row.event_type] = (byEventType[row.event_type] || 0) + parseInt(row.total, 10);
    }

    const processedCount = parseInt(processedResult.rows[0]?.total || '0', 10);

    return {
      outboxCount,
      processedCount,
      byStatus,
      byDomain,
      byEventType,
    };
  }
}

/**
 * Factory function to create an audit trail validator
 *
 * @param postgres - Test Postgres instance
 * @param schema - Schema name
 * @returns AuditTrailValidator instance
 */
export function createAuditTrailValidator(
  postgres: TestPostgres,
  schema?: string
): AuditTrailValidator {
  return new AuditTrailValidator(postgres, schema);
}

export default AuditTrailValidator;
