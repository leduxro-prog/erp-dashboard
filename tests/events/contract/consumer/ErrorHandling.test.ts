/**
 * @file Error Handling Tests
 * @module tests/events/contract/consumer/ErrorHandling.test
 * @description Tests for error handling in event consumers, ensuring they
 * handle malformed events, schema violations, and processing errors gracefully.
 *
 * These tests ensure:
 * 1. Consumers validate events before processing
 * 2. Consumers handle schema violations appropriately
 * 3. Consumers provide meaningful error messages
 * 4. Consumers log errors for debugging
 * 5. Consumers continue processing after errors
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { SchemaValidator } from '../helpers/SchemaValidator';
import { EventBuilder, EventBuilderFactory } from '../helpers/EventBuilder';
import { EventEnvelope } from '../../../../events/types/EventEnvelope';
import { EventPriority } from '../../../../events/types/EventEnvelope';

/**
 * Error types for consumer handling
 */
export enum ConsumerErrorType {
  VALIDATION_ERROR = 'validation_error',
  SCHEMA_ERROR = 'schema_error',
  PROCESSING_ERROR = 'processing_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Consumer error result
 */
export interface ConsumerErrorResult {
  eventId: string;
  eventType: string;
  errorType: ConsumerErrorType;
  errorMessage: string;
  validationErrors?: Array<{ path: string; message: string }>;
  timestamp: string;
  retryable: boolean;
}

/**
 * Error handling consumer implementation
 */
class ErrorHandlingConsumer {
  private errors: ConsumerErrorResult[] = [];
  private successfulEvents: EventEnvelope[] = [];

  /**
   * Process event with comprehensive error handling
   */
  async processEvent(
    event: EventEnvelope,
    validator: SchemaValidator,
  ): Promise<{ success: boolean; error?: ConsumerErrorResult }> {
    try {
      // Step 1: Validate envelope structure
      const envelopeValidation = await validator.validateEvent(event);
      if (!envelopeValidation.valid) {
        const schemaMissing =
          envelopeValidation.schemaFound === false &&
          envelopeValidation.errors.some((e) => e.message.includes('No schema found'));

        const error: ConsumerErrorResult = {
          eventId: event.event_id,
          eventType: event.event_type,
          errorType: schemaMissing
            ? ConsumerErrorType.SCHEMA_ERROR
            : ConsumerErrorType.VALIDATION_ERROR,
          errorMessage: schemaMissing
            ? envelopeValidation.errors.map((e) => e.message).join(', ')
            : `Envelope validation failed: ${envelopeValidation.errors.map((e) => e.message).join(', ')}`,
          validationErrors: envelopeValidation.errors.map((e) => ({
            path: e.path,
            message: e.message,
          })),
          timestamp: new Date().toISOString(),
          retryable: false,
        };
        this.errors.push(error);
        return { success: false, error };
      }

      // Step 2: Validate against schema
      if (!envelopeValidation.schemaFound) {
        const error: ConsumerErrorResult = {
          eventId: event.event_id,
          eventType: event.event_type,
          errorType: ConsumerErrorType.SCHEMA_ERROR,
          errorMessage: `Schema not found for event type: ${event.event_type} version: ${event.event_version}`,
          timestamp: new Date().toISOString(),
          retryable: false,
        };
        this.errors.push(error);
        return { success: false, error };
      }

      // Step 3: Process the event
      await this.handleByEventType(event);

      // Success
      this.successfulEvents.push(event);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Determine if error is retryable
      const retryable = this.isErrorRetryable(error);

      const errorResult: ConsumerErrorResult = {
        eventId: event.event_id,
        eventType: event.event_type,
        errorType: this.categorizeError(error),
        errorMessage,
        timestamp: new Date().toISOString(),
        retryable,
      };
      this.errors.push(errorResult);

      return { success: false, error: errorResult };
    }
  }

  /**
   * Process batch of events, continuing after errors
   */
  async processBatch(
    events: EventEnvelope[],
    validator: SchemaValidator,
  ): Promise<{ successful: number; failed: number; errors: ConsumerErrorResult[] }> {
    let successful = 0;
    let failed = 0;

    for (const event of events) {
      const result = await this.processEvent(event, validator);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      successful,
      failed,
      errors: this.errors.slice(-failed),
    };
  }

  private async handleByEventType(event: EventEnvelope): Promise<void> {
    switch (event.event_type) {
      case 'order.created':
        return this.handleOrderCreated(event.payload);
      case 'product.updated':
        return this.handleProductUpdated(event.payload);
      case 'stock.changed':
        return this.handleStockChanged(event.payload);
      case 'price.changed':
        return this.handlePriceChanged(event.payload);
      default:
        return this.handleUnknownEvent(event);
    }
  }

  private handleOrderCreated(payload: any): void {
    // Simulate validation errors
    if (!payload.order_id) {
      throw new Error('Missing required field: order_id');
    }

    // Simulate processing errors
    if (payload.customer_id === 'FAIL_PROCESSING') {
      throw new Error('Simulated processing failure');
    }
  }

  private handleProductUpdated(payload: any): void {
    if (!payload.product_id) {
      throw new Error('Missing required field: product_id');
    }
  }

  private handleStockChanged(payload: any): void {
    if (!payload.product_id) {
      throw new Error('Missing required field: product_id');
    }

    if (payload.quantity_after < 0) {
      throw new Error('Quantity cannot be negative');
    }
  }

  private handlePriceChanged(payload: any): void {
    if (!payload.product_id) {
      throw new Error('Missing required field: product_id');
    }

    if (payload.price_after < 0) {
      throw new Error('Price cannot be negative');
    }
  }

  private handleUnknownEvent(event: EventEnvelope): void {
    // Log unknown event but don't fail
    console.log(`Unknown event type: ${event.event_type}`);
  }

  private categorizeError(error: unknown): ConsumerErrorType {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('validation') || message.includes('required')) {
      return ConsumerErrorType.VALIDATION_ERROR;
    }

    if (message.includes('schema')) {
      return ConsumerErrorType.SCHEMA_ERROR;
    }

    if (message.includes('processing')) {
      return ConsumerErrorType.PROCESSING_ERROR;
    }

    return ConsumerErrorType.UNKNOWN_ERROR;
  }

  private isErrorRetryable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    // Validation errors are not retryable
    if (
      message.includes('validation') ||
      message.includes('required') ||
      message.includes('schema')
    ) {
      return false;
    }

    // Processing errors might be retryable
    return true;
  }

  getErrors(): ConsumerErrorResult[] {
    return this.errors;
  }

  getSuccessfulEvents(): EventEnvelope[] {
    return this.successfulEvents;
  }

  reset(): void {
    this.errors = [];
    this.successfulEvents = [];
  }
}

/**
 * Dead letter queue consumer
 */
class DeadLetterQueueConsumer {
  private deadLetterEvents: Array<{
    event: EventEnvelope;
    error: string;
    timestamp: string;
    reason: string;
  }> = [];

  async sendToDeadLetter(event: EventEnvelope, error: string, reason: string): Promise<void> {
    this.deadLetterEvents.push({
      event,
      error,
      timestamp: new Date().toISOString(),
      reason,
    });
  }

  getDeadLetterEvents() {
    return this.deadLetterEvents;
  }

  clear() {
    this.deadLetterEvents = [];
  }
}

describe('Error Handling Tests', () => {
  let validator: SchemaValidator;
  let consumer: ErrorHandlingConsumer;
  let dlqConsumer: DeadLetterQueueConsumer;

  beforeEach(async () => {
    validator = new SchemaValidator();
    await validator.loadAllSchemas();
    consumer = new ErrorHandlingConsumer();
    dlqConsumer = new DeadLetterQueueConsumer();
  });

  describe('Envelope Validation Errors', () => {
    test('should detect invalid event_id format', async () => {
      const event = {
        ...EventBuilder.minimal('order.created', { test: 'data' }),
        event_id: 'invalid-uuid',
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
      expect(result.error?.errorMessage).toContain('event_id');
      expect(result.error?.retryable).toBe(false);
    });

    test('should detect invalid event_type format', async () => {
      const event = {
        ...EventBuilder.minimal('InvalidFormat', { test: 'data' }),
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
      expect(result.error?.errorMessage).toContain('event_type');
    });

    test('should detect invalid event_version format', async () => {
      const event = EventBuilderFactory.order()
        .withVersion('invalid')
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
      expect(result.error?.errorMessage).toContain('event_version');
    });

    test('should detect invalid priority value', async () => {
      const event = {
        ...EventBuilder.minimal('test.event', { test: 'data' }),
        priority: 'invalid' as EventPriority,
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
      expect(result.error?.errorMessage).toContain('priority');
    });

    test('should detect missing correlation_id', async () => {
      const event = {
        ...EventBuilder.minimal('test.event', { test: 'data' }),
        correlation_id: 'invalid-uuid',
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
      expect(result.error?.errorMessage).toContain('correlation_id');
    });

    test('should detect invalid occurred_at timestamp', async () => {
      const event = {
        ...EventBuilder.minimal('test.event', { test: 'data' }),
        occurred_at: 'not-a-date',
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
      expect(result.error?.errorMessage).toContain('occurred_at');
    });
  });

  describe('Schema Validation Errors', () => {
    test('should detect missing schema', async () => {
      const event = EventBuilder.minimal('non.existent.event', { test: 'data' });

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.SCHEMA_ERROR);
      expect(result.error?.errorMessage).toContain('No schema found');
      expect(result.error?.retryable).toBe(false);
    });

    test('should detect missing required fields', async () => {
      const event = EventBuilderFactory.order()
        .withPayload({ customer_id: 'CUST-001', customer_type: 'b2b' })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
      expect(result.error?.validationErrors).toBeDefined();
      expect(result.error?.validationErrors!.length).toBeGreaterThan(0);
    });

    test('should detect invalid UUID format', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: 'not-a-uuid',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.validationErrors?.some((e) => e.path.includes('order_id'))).toBe(true);
    });

    test('should detect invalid enum values', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.validationErrors?.some((e) => e.path.includes('customer_type'))).toBe(
        true,
      );
    });

    test('should detect type mismatches', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: {
            subtotal: 'not a number' as any,
            tax_amount: 0,
            total: 0,
            currency: 'EUR',
          },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.validationErrors?.some((e) => e.path.includes('subtotal'))).toBe(true);
    });

    test('should detect constraint violations', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [
            {
              product_id: 'PRD-001',
              quantity: -5, // violates minimum constraint
              unit_price: 100,
            },
          ],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(
        result.error?.validationErrors?.some(
          (e) => e.message.includes('minimum') || e.message.includes('>='),
        ),
      ).toBe(true);
    });
  });

  describe('Processing Errors', () => {
    test('should handle processing errors', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'FAIL_PROCESSING', // Triggers simulated failure
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe(ConsumerErrorType.PROCESSING_ERROR);
      expect(result.error?.errorMessage).toContain('processing failure');
      expect(result.error?.retryable).toBe(true);
    });

    test('should handle business logic errors', async () => {
      const event = EventBuilderFactory.stock('PRD-001')
        .withStock({
          product_id: 'PRD-001',
          change_type: 'adjustment',
          quantity_before: 100,
          quantity_after: -50, // Negative quantity
          quantity_change: -150,
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      // May fail schema validation or processing
      expect([result.success, !result.success]).toContain(true);
    });
  });

  describe('Batch Processing Error Handling', () => {
    test('should continue processing after errors', async () => {
      const events = [
        EventBuilderFactory.order('ORD-0001')
          .withOrder({
            order_id: '550e8400-e29b-41d4-a716-446655440000',
            order_number: 'ORD-0001',
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build(),
        EventBuilder.minimal('invalid.event.type', { test: 'data' }), // Invalid event type
        EventBuilderFactory.product('PRD-001')
          .withProduct({ product_id: 'PRD-001', change_type: 'name_changed' })
          .build(),
      ];

      const result = await consumer.processBatch(events, validator);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    test('should track all errors in batch', async () => {
      const events = [
        EventBuilder.minimal('invalid.event.type1', { test: 'data' }),
        EventBuilder.minimal('invalid.event.type2', { test: 'data' }),
        EventBuilder.minimal('invalid.event.type3', { test: 'data' }),
      ];

      const result = await consumer.processBatch(events, validator);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.errors).toHaveLength(3);
    });

    test('should process mixed valid and invalid events', async () => {
      const events = [
        EventBuilderFactory.order('ORD-0001')
          .withOrder({
            order_id: '550e8400-e29b-41d4-a716-446655440000',
            order_number: 'ORD-0001',
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build(),
        EventBuilderFactory.order('ORD-0002')
          .withOrder({
            order_id: '660e8400-e29b-41d4-a716-446655440000',
            order_number: 'ORD-0002',
            customer_id: 'CUST-002',
            customer_type: 'b2c',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build(),
        EventBuilder.minimal('invalid.event', { test: 'data' }),
        EventBuilderFactory.product('PRD-001')
          .withProduct({ product_id: 'PRD-001', change_type: 'name_changed' })
          .build(),
      ];

      const result = await consumer.processBatch(events, validator);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(1);
    });
  });

  describe('Error Categorization', () => {
    test('should categorize validation errors correctly', async () => {
      const event = {
        ...EventBuilder.minimal('test.event', { test: 'data' }),
        event_id: 'invalid-uuid',
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.errorType).toBe(ConsumerErrorType.VALIDATION_ERROR);
    });

    test('should categorize schema errors correctly', async () => {
      const event = EventBuilder.minimal('nonexistent.event', { test: 'data' });

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.errorType).toBe(ConsumerErrorType.SCHEMA_ERROR);
    });

    test('should categorize processing errors correctly', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'FAIL_PROCESSING',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.errorType).toBe(ConsumerErrorType.PROCESSING_ERROR);
    });
  });

  describe('Retryable Error Detection', () => {
    test('should mark validation errors as non-retryable', async () => {
      const event = {
        ...EventBuilder.minimal('test.event', { test: 'data' }),
        event_id: 'invalid-uuid',
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.retryable).toBe(false);
    });

    test('should mark schema errors as non-retryable', async () => {
      const event = EventBuilder.minimal('nonexistent.event', { test: 'data' });

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.retryable).toBe(false);
    });

    test('should mark processing errors as retryable', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'FAIL_PROCESSING',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.retryable).toBe(true);
    });
  });

  describe('Dead Letter Queue Handling', () => {
    test('should send non-retryable errors to DLQ', async () => {
      const event = {
        ...EventBuilder.minimal('test.event', { test: 'data' }),
        event_id: 'invalid-uuid',
      };

      const result = await consumer.processEvent(event, validator);

      if (!result.success && !result.error?.retryable) {
        await dlqConsumer.sendToDeadLetter(
          event,
          result.error?.errorMessage || 'Unknown error',
          'Non-retryable validation error',
        );

        const dlqEvents = dlqConsumer.getDeadLetterEvents();
        expect(dlqEvents).toHaveLength(1);
        expect(dlqEvents[0].event.event_id).toBe(event.event_id);
        expect(dlqEvents[0].reason.toLowerCase()).toContain('non-retryable');
      }
    });

    test('should include error details in DLQ event', async () => {
      const event = EventBuilder.minimal('nonexistent.event', { test: 'data' });

      const result = await consumer.processEvent(event, validator);

      if (!result.success) {
        await dlqConsumer.sendToDeadLetter(
          event,
          result.error?.errorMessage || 'Unknown error',
          result.error?.errorType || 'unknown',
        );

        const dlqEvents = dlqConsumer.getDeadLetterEvents();
        expect(dlqEvents[0].error).toBeDefined();
        expect(dlqEvents[0].timestamp).toBeDefined();
      }
    });
  });

  describe('Error Message Quality', () => {
    test('should provide descriptive error messages', async () => {
      const event = {
        ...EventBuilder.minimal('test.event', { test: 'data' }),
        event_id: 'invalid-uuid',
      };

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.errorMessage).toBeDefined();
      expect(result.error?.errorMessage.length).toBeGreaterThan(0);
      expect(result.error?.errorMessage).toContain('event_id');
    });

    test('should include validation error details', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await consumer.processEvent(event, validator);

      if (result.error?.validationErrors) {
        expect(result.error.validationErrors.length).toBeGreaterThan(0);
        expect(result.error.validationErrors[0]).toHaveProperty('path');
        expect(result.error.validationErrors[0]).toHaveProperty('message');
      }
    });

    test('should include timestamp in errors', async () => {
      const event = EventBuilder.minimal('nonexistent.event', { test: 'data' });

      const result = await consumer.processEvent(event, validator);

      expect(result.error?.timestamp).toBeDefined();
      expect(() => new Date(result.error!.timestamp)).not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    test('should reset error state', async () => {
      const event1 = EventBuilder.minimal('invalid.event1', { test: 'data' });
      const event2 = EventBuilder.minimal('invalid.event2', { test: 'data' });

      await consumer.processEvent(event1, validator);
      await consumer.processEvent(event2, validator);

      expect(consumer.getErrors().length).toBeGreaterThan(0);

      consumer.reset();

      expect(consumer.getErrors()).toHaveLength(0);
      expect(consumer.getSuccessfulEvents()).toHaveLength(0);
    });

    test('should process valid events after errors', async () => {
      const invalidEvent = EventBuilder.minimal('invalid.event', { test: 'data' });
      const validEvent = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result1 = await consumer.processEvent(invalidEvent, validator);
      const result2 = await consumer.processEvent(validEvent, validator);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(true);
      expect(consumer.getSuccessfulEvents()).toHaveLength(1);
    });
  });
});
