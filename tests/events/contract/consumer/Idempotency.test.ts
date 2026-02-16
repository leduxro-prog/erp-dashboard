/**
 * @file Idempotency Tests
 * @module tests/events/contract/consumer/Idempotency.test
 * @description Tests for event idempotency, ensuring that consumers handle
 * duplicate events correctly and maintain consistency across reprocessing.
 *
 * These tests ensure:
 * 1. Consumers can detect duplicate events
 * 2. Consumers handle reprocessing of events safely
 * 3. Consumers use event_id for deduplication
 * 4. Consumers handle partial failures gracefully
 * 5. Consumers maintain state consistency
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { SchemaValidator } from '../helpers/SchemaValidator';
import { EventBuilderFactory } from '../helpers/EventBuilder';
import { EventEnvelope } from '../../../../events/types/EventEnvelope';

/**
 * In-memory idempotency store for testing
 */
class InMemoryIdempotencyStore {
  private processedEvents: Map<
    string,
    {
      event_id: string;
      processed_at: number;
      result: any;
    }
  > = new Map();

  /**
   * Check if event was already processed
   */
  hasProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Get result of previously processed event
   */
  getResult(eventId: string): any | undefined {
    return this.processedEvents.get(eventId)?.result;
  }

  /**
   * Mark event as processed
   */
  markProcessed(eventId: string, result: any): void {
    this.processedEvents.set(eventId, {
      event_id: eventId,
      processed_at: Date.now(),
      result,
    });
  }

  /**
   * Clear all processed events
   */
  clear(): void {
    this.processedEvents.clear();
  }

  /**
   * Get count of processed events
   */
  count(): number {
    return this.processedEvents.size;
  }
}

/**
 * Idempotent consumer implementation
 */
class IdempotentConsumer {
  private store: InMemoryIdempotencyStore;
  private processingAttempts: Map<string, number> = new Map();

  constructor(store: InMemoryIdempotencyStore) {
    this.store = store;
  }

  /**
   * Process event with idempotency guarantee
   */
  async processEvent(
    event: EventEnvelope,
    validator: SchemaValidator,
  ): Promise<{
    success: boolean;
    wasDuplicate: boolean;
    result?: any;
    error?: string;
    attemptNumber: number;
  }> {
    const eventId = event.event_id;

    // Track attempt count
    const attempts = this.processingAttempts.get(eventId) || 0;
    this.processingAttempts.set(eventId, attempts + 1);

    // Check if already processed
    if (this.store.hasProcessed(eventId)) {
      return {
        success: true,
        wasDuplicate: true,
        result: this.store.getResult(eventId),
        attemptNumber: attempts + 1,
      };
    }

    try {
      // Validate event
      const validation = await validator.validateEvent(event);
      if (!validation.valid) {
        throw new Error(`Invalid event: ${validation.errors.map((e) => e.message).join(', ')}`);
      }

      // Process the event (simulated)
      const result = this.processPayload(event.event_type, event.payload);

      // Store result
      this.store.markProcessed(eventId, result);

      return {
        success: true,
        wasDuplicate: false,
        result,
        attemptNumber: attempts + 1,
      };
    } catch (error) {
      return {
        success: false,
        wasDuplicate: false,
        error: error instanceof Error ? error.message : String(error),
        attemptNumber: attempts + 1,
      };
    }
  }

  private processPayload(eventType: string, payload: any): any {
    switch (eventType) {
      case 'order.created':
        return {
          action: 'create_order',
          order_id: payload.order_id,
          order_number: payload.order_number,
          processed: true,
        };
      case 'product.updated':
        return {
          action: 'update_product',
          product_id: payload.product_id,
          processed: true,
        };
      case 'stock.changed':
        return {
          action: 'update_stock',
          product_id: payload.product_id,
          new_quantity: payload.quantity_after,
          processed: true,
        };
      default:
        return {
          action: 'unknown',
          event_type: eventType,
          processed: true,
        };
    }
  }

  getAttemptCount(eventId: string): number {
    return this.processingAttempts.get(eventId) || 0;
  }

  reset(): void {
    this.processingAttempts.clear();
  }
}

/**
 * Stateful consumer that maintains business state
 */
class StatefulConsumer {
  private orders: Map<string, any> = new Map();
  private inventory: Map<string, number> = new Map();
  private processedEventIds: Set<string> = new Set();

  async processEvent(
    event: EventEnvelope,
    validator: SchemaValidator,
  ): Promise<{
    success: boolean;
    wasDuplicate: boolean;
    stateChanged: boolean;
  }> {
    // Check for duplicate
    if (this.processedEventIds.has(event.event_id)) {
      return {
        success: true,
        wasDuplicate: true,
        stateChanged: false,
      };
    }

    // Validate
    const validation = await validator.validateEvent(event);
    if (!validation.valid) {
      return {
        success: false,
        wasDuplicate: false,
        stateChanged: false,
      };
    }

    // Process
    const stateChanged = this.updateState(event);

    // Mark as processed
    this.processedEventIds.add(event.event_id);

    return {
      success: true,
      wasDuplicate: false,
      stateChanged,
    };
  }

  private updateState(event: EventEnvelope): boolean {
    let changed = false;

    switch (event.event_type) {
      case 'order.created':
        const orderKey = event.payload.order_id;
        if (!this.orders.has(orderKey)) {
          this.orders.set(orderKey, {
            order_id: orderKey,
            order_number: event.payload.order_number,
            customer_id: event.payload.customer_id,
            status: event.payload.status,
            items: event.payload.items,
            totals: event.payload.totals,
          });
          changed = true;
        }
        break;

      case 'stock.changed':
        const productKey = event.payload.product_id;
        const newQuantity = event.payload.quantity_after;
        const currentQuantity = this.inventory.get(productKey) || 0;

        if (currentQuantity !== newQuantity) {
          this.inventory.set(productKey, newQuantity);
          changed = true;
        }
        break;
    }

    return changed;
  }

  getOrder(orderId: string): any | undefined {
    return this.orders.get(orderId);
  }

  getInventory(productId: string): number | undefined {
    return this.inventory.get(productId);
  }

  getProcessedCount(): number {
    return this.processedEventIds.size;
  }

  reset(): void {
    this.orders.clear();
    this.inventory.clear();
    this.processedEventIds.clear();
  }
}

describe('Idempotency Tests', () => {
  let validator: SchemaValidator;
  let idempotencyStore: InMemoryIdempotencyStore;
  let idempotentConsumer: IdempotentConsumer;
  let statefulConsumer: StatefulConsumer;

  beforeEach(async () => {
    validator = new SchemaValidator();
    await validator.loadAllSchemas();
    idempotencyStore = new InMemoryIdempotencyStore();
    idempotentConsumer = new IdempotentConsumer(idempotencyStore);
    statefulConsumer = new StatefulConsumer();
  });

  afterEach(() => {
    idempotencyStore.clear();
    idempotentConsumer.reset();
    statefulConsumer.reset();
  });

  describe('Duplicate Event Detection', () => {
    test('should detect and skip duplicate events', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      // First processing
      const result1 = await idempotentConsumer.processEvent(event, validator);
      expect(result1.success).toBe(true);
      expect(result1.wasDuplicate).toBe(false);
      expect(result1.result).toBeDefined();

      // Second processing (duplicate)
      const result2 = await idempotentConsumer.processEvent(event, validator);
      expect(result2.success).toBe(true);
      expect(result2.wasDuplicate).toBe(true);
      expect(result2.result).toEqual(result1.result);

      // Verify only one event was stored
      expect(idempotencyStore.count()).toBe(1);
    });

    test('should return same result for duplicate events', async () => {
      const event = EventBuilderFactory.product('PRD-001')
        .withProduct({
          product_id: 'PRD-001',
          change_type: 'name_changed',
          new_values: { name: 'New Name' },
        })
        .build();

      const result1 = await idempotentConsumer.processEvent(event, validator);
      const result2 = await idempotentConsumer.processEvent(event, validator);
      const result3 = await idempotentConsumer.processEvent(event, validator);

      expect(result2.result).toEqual(result1.result);
      expect(result3.result).toEqual(result1.result);
    });

    test('should handle multiple duplicate events', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const duplicateCount = 10;
      const results = [];

      for (let i = 0; i < duplicateCount; i++) {
        results.push(await idempotentConsumer.processEvent(event, validator));
      }

      expect(results[0].wasDuplicate).toBe(false);
      expect(results.slice(1).every((r) => r.wasDuplicate)).toBe(true);
      expect(idempotencyStore.count()).toBe(1);
    });

    test('should track processing attempts for duplicates', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await idempotentConsumer.processEvent(event, validator);
      await idempotentConsumer.processEvent(event, validator);
      await idempotentConsumer.processEvent(event, validator);

      expect(idempotentConsumer.getAttemptCount(event.event_id)).toBe(3);
    });
  });

  describe('State Consistency', () => {
    test('should maintain consistent state after duplicate processing', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const orderId = event.payload.order_id;

      // First processing
      const result1 = await statefulConsumer.processEvent(event, validator);
      expect(result1.success).toBe(true);
      expect(result1.wasDuplicate).toBe(false);
      expect(result1.stateChanged).toBe(true);

      const orderAfterFirst = statefulConsumer.getOrder(orderId);
      expect(orderAfterFirst).toBeDefined();

      // Second processing (duplicate)
      const result2 = await statefulConsumer.processEvent(event, validator);
      expect(result2.success).toBe(true);
      expect(result2.wasDuplicate).toBe(true);
      expect(result2.stateChanged).toBe(false);

      const orderAfterSecond = statefulConsumer.getOrder(orderId);
      expect(orderAfterSecond).toEqual(orderAfterFirst);
    });

    test('should handle stock updates idempotently', async () => {
      const event = EventBuilderFactory.stock('PRD-001')
        .withStock({
          product_id: 'PRD-001',
          change_type: 'addition',
          quantity_before: 100,
          quantity_after: 200,
          quantity_change: 100,
        })
        .build();

      // First processing
      const result1 = await statefulConsumer.processEvent(event, validator);
      expect(result1.stateChanged).toBe(true);
      expect(statefulConsumer.getInventory('PRD-001')).toBe(200);

      // Second processing (duplicate)
      const result2 = await statefulConsumer.processEvent(event, validator);
      expect(result2.stateChanged).toBe(false);
      expect(statefulConsumer.getInventory('PRD-001')).toBe(200);
    });

    test('should not modify state for duplicate events', async () => {
      const event1 = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const event2 = EventBuilderFactory.order('ORD-0002')
        .withOrder({
          order_id: '660e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0002',
          customer_id: 'CUST-002',
          customer_type: 'b2c',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await statefulConsumer.processEvent(event1, validator);
      await statefulConsumer.processEvent(event2, validator);

      // Process event1 again (duplicate)
      const duplicateResult = await statefulConsumer.processEvent(event1, validator);

      expect(duplicateResult.stateChanged).toBe(false);
      expect(statefulConsumer.getProcessedCount()).toBe(2);
    });
  });

  describe('Idempotency Store', () => {
    test('should store and retrieve processed events', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await idempotentConsumer.processEvent(event, validator);

      expect(idempotencyStore.hasProcessed(event.event_id)).toBe(true);
      expect(idempotencyStore.getResult(event.event_id)).toEqual(result.result);
    });

    test('should handle multiple processed events', async () => {
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
        EventBuilderFactory.product('PRD-001')
          .withProduct({ product_id: 'PRD-001', change_type: 'name_changed' })
          .build(),
        EventBuilderFactory.stock('PRD-001')
          .withStock({
            product_id: 'PRD-001',
            change_type: 'addition',
            quantity_before: 100,
            quantity_after: 200,
            quantity_change: 100,
          })
          .build(),
      ];

      for (const event of events) {
        await idempotentConsumer.processEvent(event, validator);
      }

      expect(idempotencyStore.count()).toBe(3);
      expect(events.every((e) => idempotencyStore.hasProcessed(e.event_id))).toBe(true);
    });

    test('should clear processed events', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await idempotentConsumer.processEvent(event, validator);
      expect(idempotencyStore.hasProcessed(event.event_id)).toBe(true);

      idempotencyStore.clear();
      expect(idempotencyStore.hasProcessed(event.event_id)).toBe(false);
      expect(idempotencyStore.count()).toBe(0);
    });
  });

  describe('Error Handling and Idempotency', () => {
    test('should not store failed events as processed', async () => {
      const invalidEvent = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          // Missing required fields
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await idempotentConsumer.processEvent(invalidEvent, validator);

      expect(result.success).toBe(false);
      expect(idempotencyStore.hasProcessed(invalidEvent.event_id)).toBe(false);
    });

    test('should allow retry of failed events', async () => {
      // First attempt with invalid event
      const invalidEvent = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result1 = await idempotentConsumer.processEvent(invalidEvent, validator);
      expect(result1.success).toBe(false);

      // Event should not be stored, so it can be retried
      expect(idempotencyStore.hasProcessed(invalidEvent.event_id)).toBe(false);

      // Note: In a real scenario, the event would need to be fixed before retry
      // This test just verifies that failed events are not stored
    });

    test('should track failed processing attempts', async () => {
      const invalidEvent = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await idempotentConsumer.processEvent(invalidEvent, validator);
      await idempotentConsumer.processEvent(invalidEvent, validator);
      await idempotentConsumer.processEvent(invalidEvent, validator);

      expect(idempotentConsumer.getAttemptCount(invalidEvent.event_id)).toBe(3);
    });
  });

  describe('Idempotency with Different Event Types', () => {
    test('should maintain separate idempotency per event type', async () => {
      const orderEvent = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const productEvent = EventBuilderFactory.product('PRD-001')
        .withProduct({ product_id: 'PRD-001', change_type: 'name_changed' })
        .build();

      const stockEvent = EventBuilderFactory.stock('PRD-001')
        .withStock({
          product_id: 'PRD-001',
          change_type: 'addition',
          quantity_before: 100,
          quantity_after: 200,
          quantity_change: 100,
        })
        .build();

      await idempotentConsumer.processEvent(orderEvent, validator);
      await idempotentConsumer.processEvent(productEvent, validator);
      await idempotentConsumer.processEvent(stockEvent, validator);

      expect(idempotencyStore.count()).toBe(3);

      // Process each again (duplicates)
      await idempotentConsumer.processEvent(orderEvent, validator);
      await idempotentConsumer.processEvent(productEvent, validator);
      await idempotentConsumer.processEvent(stockEvent, validator);

      // Count should remain 3
      expect(idempotencyStore.count()).toBe(3);
    });
  });

  describe('Idempotency Performance', () => {
    test('should efficiently check for duplicates', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await idempotentConsumer.processEvent(event, validator);

      const startTime = Date.now();
      const duplicateCount = 1000;

      for (let i = 0; i < duplicateCount; i++) {
        await idempotentConsumer.processEvent(event, validator);
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should process 1000 duplicate checks quickly
    });

    test('should handle large number of unique events', async () => {
      const eventCount = 1000;
      const events = Array.from({ length: eventCount }, (_, i) =>
        EventBuilderFactory.order(`ORD-${String(i + 1).padStart(8, '0')}`)
          .withOrder({
            order_number: `ORD-${String(i + 1).padStart(8, '0')}`,
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build(),
      );

      const startTime = Date.now();

      for (const event of events) {
        await idempotentConsumer.processEvent(event, validator);
      }

      const duration = Date.now() - startTime;

      expect(idempotencyStore.count()).toBe(eventCount);
      expect(duration).toBeLessThan(5000); // Should process 1000 events in under 5 seconds
    });
  });

  describe('Idempotency Edge Cases', () => {
    test('should handle events with same payload but different IDs', async () => {
      const event1 = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 100, tax_amount: 19, total: 119, currency: 'EUR' },
        })
        .build();

      const event2 = EventBuilderFactory.order('ORD-0002')
        .withOrder({
          order_id: '660e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0002',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 100, tax_amount: 19, total: 119, currency: 'EUR' },
        })
        .build();

      await idempotentConsumer.processEvent(event1, validator);
      await idempotentConsumer.processEvent(event2, validator);

      expect(idempotencyStore.count()).toBe(2);
    });

    test('should handle clearing and reprocessing', async () => {
      const event = EventBuilderFactory.order('ORD-0001')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      // First processing
      const result1 = await idempotentConsumer.processEvent(event, validator);
      expect(result1.wasDuplicate).toBe(false);

      // Second processing (duplicate)
      const result2 = await idempotentConsumer.processEvent(event, validator);
      expect(result2.wasDuplicate).toBe(true);

      // Clear and reprocess
      idempotencyStore.clear();
      idempotentConsumer.reset();

      const result3 = await idempotentConsumer.processEvent(event, validator);
      expect(result3.wasDuplicate).toBe(false);
    });
  });
});
