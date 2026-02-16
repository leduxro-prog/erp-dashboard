/**
 * @file Event Consumer Contract Tests
 * @module tests/events/contract/consumer/EventConsumerContract.test
 * @description Consumer-side contract tests that verify consumers can handle
 * events according to the contract, including schema validation, field presence,
 * and compatibility with producer events.
 *
 * These tests ensure:
 * 1. Consumers can validate incoming events against schemas
 * 2. Consumers handle required and optional fields correctly
 * 3. Consumers are compatible with current schema versions
 * 4. Consumers handle unknown fields gracefully (forward compatibility)
 * 5. Consumers validate envelope structure before processing
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { SchemaValidator } from '../helpers/SchemaValidator';
import { EventBuilder, EventBuilderFactory } from '../helpers/EventBuilder';
import { EventEnvelope, EventPriority } from '../../../../events/types/EventEnvelope';

/**
 * Mock consumer implementation for testing
 */
class MockConsumer {
  private processedEvents: Array<{ event: EventEnvelope; result: any }> = [];
  private errorEvents: Array<{ event: EventEnvelope; error: Error }> = [];

  /**
   * Simulate event processing with validation
   */
  async processEvent(event: EventEnvelope, validator: SchemaValidator): Promise<boolean> {
    try {
      // Step 1: Validate envelope structure
      const structureResult = await validator.validateEvent(event);
      if (!structureResult.valid) {
        throw new Error(
          `Invalid event structure: ${structureResult.errors.map((e) => e.message).join(', ')}`,
        );
      }

      // Step 2: Extract required fields
      const { event_type, event_version, payload, correlation_id } = event;
      if (!event_type || !payload || !correlation_id) {
        throw new Error('Missing required envelope fields');
      }

      // Step 3: Process based on event type
      const result = await this.handleByEventType(event_type, event_version, payload);

      this.processedEvents.push({ event, result });
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errorEvents.push({ event, error: err });
      return false;
    }
  }

  private async handleByEventType(
    eventType: string,
    eventVersion: string,
    payload: any,
  ): Promise<any> {
    switch (eventType) {
      case 'order.created':
        return this.handleOrderCreated(payload);
      case 'product.updated':
        return this.handleProductUpdated(payload);
      case 'stock.changed':
        return this.handleStockChanged(payload);
      case 'price.changed':
        return this.handlePriceChanged(payload);
      case 'cart.updated':
        return this.handleCartUpdated(payload);
      case 'quote.created':
        return this.handleQuoteCreated(payload);
      case 'credit.changed':
        return this.handleCreditChanged(payload);
      default:
        return this.handleUnknownEvent(eventType, eventVersion, payload);
    }
  }

  private handleOrderCreated(payload: any) {
    // Simulate required field extraction
    const { order_id, order_number, customer_id, items, totals } = payload;

    if (!order_id) {
      throw new Error('Missing required field: order_id');
    }

    return {
      action: 'create_order',
      order_id,
      order_number,
      customer_id,
      item_count: items?.length || 0,
      total: totals?.total || 0,
    };
  }

  private handleProductUpdated(payload: any) {
    const { product_id, change_type, new_values } = payload;

    if (!product_id) {
      throw new Error('Missing required field: product_id');
    }

    return {
      action: 'update_product',
      product_id,
      change_type,
      changes: Object.keys(new_values || {}),
    };
  }

  private handleStockChanged(payload: any) {
    const { product_id, change_type, quantity_after } = payload;

    if (!product_id) {
      throw new Error('Missing required field: product_id');
    }

    return {
      action: 'update_stock',
      product_id,
      change_type,
      new_quantity: quantity_after,
    };
  }

  private handlePriceChanged(payload: any) {
    const { product_id, price_after, currency } = payload;

    if (!product_id || price_after === undefined) {
      throw new Error('Missing required field: product_id or price_after');
    }

    return {
      action: 'update_price',
      product_id,
      new_price: price_after,
      currency,
    };
  }

  private handleCartUpdated(payload: any) {
    const { cart_id, items, totals } = payload;

    if (!cart_id) {
      throw new Error('Missing required field: cart_id');
    }

    return {
      action: 'update_cart',
      cart_id,
      item_count: items?.length || 0,
      total: totals?.total || 0,
    };
  }

  private handleQuoteCreated(payload: any) {
    const { quote_id, customer_id, totals } = payload;

    if (!quote_id) {
      throw new Error('Missing required field: quote_id');
    }

    return {
      action: 'create_quote',
      quote_id,
      customer_id,
      total: totals?.total || 0,
    };
  }

  private handleCreditChanged(payload: any) {
    const { customer_id, change_type } = payload;

    if (!customer_id) {
      throw new Error('Missing required field: customer_id');
    }

    return {
      action: 'update_credit',
      customer_id,
      change_type,
    };
  }

  private handleUnknownEvent(eventType: string, eventVersion: string, payload: any) {
    // Forward compatibility: log unknown event but don't fail
    return {
      action: 'log_unknown',
      event_type: eventType,
      event_version: eventVersion,
      payload_keys: Object.keys(payload || {}),
    };
  }

  getProcessedEvents() {
    return this.processedEvents;
  }

  getErrorEvents() {
    return this.errorEvents;
  }

  reset() {
    this.processedEvents = [];
    this.errorEvents = [];
  }
}

describe('Event Consumer Contract Tests', () => {
  let validator: SchemaValidator;
  let consumer: MockConsumer;

  beforeAll(async () => {
    validator = new SchemaValidator();
    await validator.loadAllSchemas();
  });

  beforeEach(() => {
    consumer = new MockConsumer();
  });

  describe('Consumer Event Validation', () => {
    test('should validate and process order.created event', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [
            {
              product_id: 'PRD-001',
              quantity: 10,
              unit_price: 100,
            },
          ],
          totals: {
            subtotal: 1000,
            tax_amount: 190,
            total: 1190,
            currency: 'EUR',
          },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()).toHaveLength(1);
      expect(consumer.getErrorEvents()).toHaveLength(0);
      expect(consumer.getProcessedEvents()[0].result.order_id).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    test('should validate and process product.updated event', async () => {
      const event = EventBuilderFactory.product('PRD-001')
        .withProduct({
          product_id: 'PRD-001',
          change_type: 'name_changed',
          new_values: { name: 'New Name' },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()).toHaveLength(1);
      expect(consumer.getProcessedEvents()[0].result.product_id).toBe('PRD-001');
    });

    test('should validate and process stock.changed event', async () => {
      const event = EventBuilderFactory.stock('PRD-001')
        .withStock({
          product_id: 'PRD-001',
          change_type: 'addition',
          quantity_before: 100,
          quantity_after: 200,
          quantity_change: 100,
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()[0].result.new_quantity).toBe(200);
    });

    test('should validate and process price.changed event', async () => {
      const event = EventBuilderFactory.price('PRD-001')
        .withPrice({
          product_id: 'PRD-001',
          price_type: 'regular',
          price_before: 100,
          price_after: 110,
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()[0].result.new_price).toBe(110);
    });

    test('should validate and process cart.updated event', async () => {
      const event = EventBuilderFactory.cart()
        .withCart({
          cart_id: '550e8400-e29b-41d4-a716-446655440000',
          customer_type: 'b2c',
          items: [
            {
              product_id: 'PRD-001',
              quantity: 1,
              unit_price: 100,
            },
          ],
          totals: {
            subtotal: 100,
            tax_amount: 19,
            total: 119,
            currency: 'EUR',
          },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()[0].result.item_count).toBe(1);
    });

    test('should validate and process quote.created event', async () => {
      const event = EventBuilderFactory.quote('QT-000123')
        .withQuote({
          quote_id: '550e8400-e29b-41d4-a716-446655440000',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          totals: {
            subtotal: 1000,
            tax_amount: 190,
            total: 1190,
            currency: 'EUR',
          },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()[0].result.total).toBe(1190);
    });

    test('should validate and process credit.changed event', async () => {
      const event = EventBuilderFactory.credit('CUST-001')
        .withCredit({
          customer_id: 'CUST-001',
          change_type: 'limit_updated',
          credit_limit_before: 10000,
          credit_limit_after: 15000,
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()[0].result.customer_id).toBe('CUST-001');
    });
  });

  describe('Consumer Error Handling', () => {
    test('should reject event with missing required fields', async () => {
      const event = EventBuilder.minimal('order.created', {
        // Missing required fields
        order_id: '550e8400-e29b-41d4-a716-446655440000',
      });

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(false);
      expect(consumer.getErrorEvents()).toHaveLength(1);
      expect(consumer.getErrorEvents()[0].error.message).toContain('Invalid event structure');
    });

    test('should reject event with invalid UUID', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: 'invalid-uuid',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(false);
      expect(consumer.getErrorEvents()).toHaveLength(1);
    });

    test('should reject event with invalid enum value', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(false);
      expect(consumer.getErrorEvents()).toHaveLength(1);
    });

    test('should reject event with negative quantity', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [
            {
              product_id: 'PRD-001',
              quantity: -5,
              unit_price: 100,
            },
          ],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(false);
    });
  });

  describe('Forward Compatibility', () => {
    test('should handle unknown fields gracefully', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .withPayloadField('new_field_not_in_schema', 'some value')
        .withPayloadField('future_feature', {
          enabled: true,
          config: {},
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      // Schema should allow additional properties
      expect(processed).toBe(true);
    });

    test('should handle unknown event types gracefully', async () => {
      const event = EventBuilder.minimal('future.event.v2', {
        new_field: 'value',
      });

      const processed = await consumer.processEvent(event, validator);

      // Consumer should log unknown event but not fail
      expect(processed).toBe(false); // Schema validation fails (no schema)
      expect(consumer.getErrorEvents()).toHaveLength(1);
      expect(consumer.getErrorEvents()[0].error.message).toContain('No schema found');
    });

    test('should handle missing optional fields', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          // Missing optional fields like quote_id, cart_id, promo_code, etc.
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
      expect(consumer.getProcessedEvents()).toHaveLength(1);
    });
  });

  describe('Consumer Field Extraction', () => {
    test('should extract all required order fields', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [
            {
              item_id: '660e8400-e29b-41d4-a716-446655440000',
              product_id: 'PRD-001',
              quantity: 10,
              unit_price: 100,
            },
          ],
          totals: {
            subtotal: 1000,
            tax_amount: 190,
            total: 1190,
            currency: 'EUR',
          },
        })
        .build();

      await consumer.processEvent(event, validator);

      const result = consumer.getProcessedEvents()[0].result;
      expect(result).toHaveProperty('action', 'create_order');
      expect(result).toHaveProperty('order_id');
      expect(result).toHaveProperty('order_number');
      expect(result).toHaveProperty('customer_id');
      expect(result).toHaveProperty('item_count', 1);
      expect(result).toHaveProperty('total', 1190);
    });

    test('should extract nested fields correctly', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [
            {
              product_id: 'PRD-001',
              quantity: 2,
              unit_price: 50,
            },
            {
              product_id: 'PRD-002',
              quantity: 3,
              unit_price: 75,
            },
          ],
          totals: {
            subtotal: 325,
            tax_amount: 61.75,
            total: 386.75,
            currency: 'EUR',
          },
          shipping_address: {
            city: 'Bucharest',
            country: 'Romania',
          },
        })
        .build();

      await consumer.processEvent(event, validator);

      const result = consumer.getProcessedEvents()[0].result;
      expect(result.item_count).toBe(2);
      expect(result.total).toBe(386.75);
    });

    test('should handle empty arrays', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await consumer.processEvent(event, validator);

      const result = consumer.getProcessedEvents()[0].result;
      expect(result.item_count).toBe(0);
    });
  });

  describe('Consumer Schema Version Handling', () => {
    test('should process events with current schema version', async () => {
      const event = EventBuilderFactory.order()
        .withVersion('v1')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(true);
    });

    test('should reject events with unsupported schema version', async () => {
      const event = EventBuilderFactory.order()
        .withVersion('v999') // Non-existent version
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const processed = await consumer.processEvent(event, validator);

      expect(processed).toBe(false);
      expect(consumer.getErrorEvents()).toHaveLength(1);
      expect(consumer.getErrorEvents()[0].error.message).toContain('No schema found');
    });
  });

  describe('Consumer Event Metadata', () => {
    test('should access correlation ID for tracing', async () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';

      const event = EventBuilderFactory.order()
        .withCorrelationId(correlationId)
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await consumer.processEvent(event, validator);

      expect(consumer.getProcessedEvents()[0].event.correlation_id).toBe(correlationId);
    });

    test('should access metadata for additional context', async () => {
      const event = EventBuilderFactory.order()
        .withUser('user-123')
        .withSession('session-456')
        .withTenant('tenant-789')
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await consumer.processEvent(event, validator);

      const processedEvent = consumer.getProcessedEvents()[0].event;
      expect(processedEvent.metadata?.user_id).toBe('user-123');
      expect(processedEvent.metadata?.session_id).toBe('session-456');
      expect(processedEvent.metadata?.tenant_id).toBe('tenant-789');
    });

    test('should handle events without metadata', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await consumer.processEvent(event, validator);

      const processedEvent = consumer.getProcessedEvents()[0].event;
      expect(processedEvent.metadata).toBeUndefined();
    });
  });

  describe('Consumer Priority Handling', () => {
    test('should process all priority levels', async () => {
      const priorities: EventPriority[] = [
        EventPriority.LOW,
        EventPriority.NORMAL,
        EventPriority.HIGH,
        EventPriority.CRITICAL,
      ];

      for (const priority of priorities) {
        consumer.reset();

        const event = EventBuilderFactory.order()
          .withPriority(priority)
          .withOrder({
            order_id: '550e8400-e29b-41d4-a716-446655440000',
            order_number: 'ORD-00012345',
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const processed = await consumer.processEvent(event, validator);

        expect(processed).toBe(true);
      }
    });

    test('should access priority for routing decisions', async () => {
      const event = EventBuilderFactory.order()
        .withPriority(EventPriority.CRITICAL)
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      await consumer.processEvent(event, validator);

      const processedEvent = consumer.getProcessedEvents()[0].event;
      expect(processedEvent.priority).toBe(EventPriority.CRITICAL);
    });
  });

  describe('Batch Event Processing', () => {
    test('should process multiple events in sequence', async () => {
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
        await consumer.processEvent(event, validator);
      }

      expect(consumer.getProcessedEvents()).toHaveLength(3);
      expect(consumer.getErrorEvents()).toHaveLength(0);
    });

    test('should continue processing after error', async () => {
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

      const invalidEvent = EventBuilder.minimal('order.created', {
        // Missing required fields
        order_id: 'invalid-uuid',
      });

      const anotherValidEvent = EventBuilderFactory.product('PRD-001')
        .withProduct({ product_id: 'PRD-001', change_type: 'name_changed' })
        .build();

      await consumer.processEvent(validEvent, validator);
      await consumer.processEvent(invalidEvent, validator);
      await consumer.processEvent(anotherValidEvent, validator);

      expect(consumer.getProcessedEvents()).toHaveLength(2);
      expect(consumer.getErrorEvents()).toHaveLength(1);
    });
  });

  describe('Consumer Performance', () => {
    test('should process events efficiently', async () => {
      const events = Array.from({ length: 100 }, (_, i) =>
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
        await consumer.processEvent(event, validator);
      }

      const duration = Date.now() - startTime;

      expect(consumer.getProcessedEvents()).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should process 100 events in under 5 seconds
    });
  });
});
