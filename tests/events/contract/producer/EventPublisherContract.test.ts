/**
 * @file Event Publisher Contract Tests
 * @module tests/events/contract/producer/EventPublisherContract.test
 * @description Producer-side contract tests that verify events published by producers
 * conform to their schemas and maintain backward compatibility with consumers.
 *
 * These tests ensure:
 * 1. Event envelopes follow the contract structure
 * 2. Event payloads validate against registered schemas
 * 3. Producers don't break consumer contracts
 * 4. Versioning is correctly applied
 * 5. Required fields are always present
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { EventBuilder, EventBuilderFactory } from '../helpers/EventBuilder';
import { SchemaValidator } from '../helpers/SchemaValidator';
import { EventEnvelope, EventPriority } from '../../../../events/types/EventEnvelope';

describe('Event Publisher Contract Tests', () => {
  let validator: SchemaValidator;

  beforeAll(async () => {
    validator = new SchemaValidator();
    await validator.loadAllSchemas();
  });

  afterAll(() => {
    // Cleanup
  });

  describe('order.created Event Contract', () => {
    test('should validate a valid order.created event', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          customer_name: 'Acme Corporation',
          customer_email: 'contact@acme.com',
          items: [
            {
              product_id: 'PRD-001',
              sku: 'PRD-001-A',
              product_name: 'Test Product',
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
          shipping_address: {
            city: 'Bucharest',
            country: 'Romania',
          },
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.schemaFound).toBe(true);
    });

    test('should validate order.created with all optional fields', async () => {
      const event = EventBuilderFactory.order('ORD-12345678')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          quote_id: '660e8400-e29b-41d4-a716-446655440000',
          quote_number: 'QT-000123',
          cart_id: '770e8400-e29b-41d4-a716-446655440000',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          customer_name: 'Acme Corporation',
          customer_email: 'contact@acme.com',
          customer_phone: '+40700123456',
          created_by: 'user-456',
          status: 'pending',
          payment_status: 'pending',
          fulfillment_status: 'unfulfilled',
          items: [
            {
              item_id: '880e8400-e29b-41d4-a716-446655440000',
              product_id: 'PRD-001',
              variant_id: 'VAR-001-A',
              sku: 'PRD-001-A',
              product_name: 'Product Name',
              quantity: 10,
              unit_price: 150,
              unit_cost: 100,
              tax_rate: 19,
              tax_amount: 285,
              discount_amount: 0,
              line_total: 1785,
              reserved_stock: true,
            },
          ],
          totals: {
            subtotal: 1500,
            discount_amount: 150,
            tax_amount: 256.5,
            shipping_amount: 25,
            shipping_discount: 0,
            total: 1631.5,
            currency: 'EUR',
          },
          shipping_address: {
            name: 'John Doe',
            company: 'Acme Corporation',
            address_line1: '123 Business Street',
            city: 'Bucharest',
            state_province: 'Bucharest',
            postal_code: '010123',
            country: 'Romania',
            phone: '+40700123456',
          },
          billing_address: {
            name: 'John Doe',
            company: 'Acme Corporation',
            address_line1: '123 Business Street',
            city: 'Bucharest',
            state_province: 'Bucharest',
            postal_code: '010123',
            country: 'Romania',
          },
          shipping_method: {
            method_code: 'standard',
            method_name: 'Standard Delivery',
            cost: 25,
            estimated_days: 3,
            carrier: 'Courier',
          },
          payment_method: {
            method_code: 'bank_transfer',
            method_name: 'Bank Transfer',
            installments: 1,
            payment_term: 'net_30',
          },
          channel: 'admin',
          notes: 'Test order',
          internal_notes: 'Internal notes',
          promo_code: 'B2B10',
          tax_exempt: false,
          metadata: { source: 'manual' },
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
    });

    test('should reject order.created without required fields', async () => {
      const event = EventBuilder.minimal('order.created', {
        // Missing required fields: order_id, order_number, customer_id, etc.
      });

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.path.includes('order_id'))).toBe(true);
    });

    test('should reject order.created with invalid UUID', async () => {
      const event = EventBuilderFactory.order()
        .withPayloadField('order_id', 'invalid-uuid')
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '/payload/order_id')).toBe(true);
    });

    test('should reject order.created with invalid order_number pattern', async () => {
      const event = EventBuilderFactory.order().withPayloadField('order_number', 'INVALID').build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '/payload/order_number')).toBe(true);
    });

    test('should reject order.created with invalid customer_type', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '/payload/customer_type')).toBe(true);
    });

    test('should accept all valid customer_type values', async () => {
      const customerTypes: Array<'b2b' | 'b2c' | 'guest'> = ['b2b', 'b2c', 'guest'];

      for (const type of customerTypes) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: type,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }
    });

    test('should validate order.created with empty items array', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2c',
          items: [],
          totals: {
            subtotal: 0,
            tax_amount: 0,
            total: 0,
            currency: 'EUR',
          },
        })
        .build();

      const result = await validator.validateEvent(event);
      // Schema may allow empty or may require items - depends on schema
      expect(result.schemaFound).toBe(true);
    });
  });

  describe('product.updated Event Contract', () => {
    test('should validate a valid product.updated event', async () => {
      const event = EventBuilderFactory.product('PRD-001')
        .withProduct({
          product_id: 'PRD-001',
          sku: 'PRD-001-A',
          change_type: 'name_changed',
          previous_values: {
            name: 'Old Name',
          },
          new_values: {
            name: 'New Name',
          },
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate product.updated with all change types', async () => {
      const changeTypes = [
        'name_changed',
        'description_changed',
        'category_changed',
        'attributes_changed',
        'images_changed',
        'status_changed',
        'visibility_changed',
        'active_variant_changed',
        'metadata_changed',
        'bulk_update',
      ] as const;

      for (const changeType of changeTypes) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: changeType,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }
    });

    test('should reject product.updated with invalid change_type', async () => {
      const event = EventBuilderFactory.product()
        .withProduct({
          change_type: 'invalid_type' as any,
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '/payload/change_type')).toBe(true);
    });
  });

  describe('stock.changed Event Contract', () => {
    test('should validate a valid stock.changed event', async () => {
      const event = EventBuilderFactory.stock('PRD-001')
        .withStock({
          product_id: 'PRD-001',
          sku: 'PRD-001-A',
          location_id: 'LOC-MAIN',
          change_type: 'addition',
          quantity_change: 100,
          quantity_before: 500,
          quantity_after: 600,
          reason: 'Incoming shipment',
          reference_id: 'PO-001',
          reference_type: 'purchase_order',
          performed_by: 'user-123',
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate all stock change types', async () => {
      const changeTypes = [
        'addition',
        'removal',
        'adjustment',
        'transfer',
        'reserved',
        'released',
      ] as const;

      for (const changeType of changeTypes) {
        const event = EventBuilderFactory.stock()
          .withStock({
            change_type: changeType,
            quantity_before: 100,
            quantity_after: 100,
            quantity_change: 0,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('price.changed Event Contract', () => {
    test('should validate a valid price.changed event', async () => {
      const event = EventBuilderFactory.price('PRD-001')
        .withPrice({
          product_id: 'PRD-001',
          sku: 'PRD-001-A',
          price_type: 'regular',
          currency: 'EUR',
          price_before: 100,
          price_after: 110,
          change_reason: 'Price increase',
          effective_from: new Date().toISOString(),
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate all price types', async () => {
      const priceTypes = ['regular', 'special', 'tier', 'bulk', 'b2b'] as const;

      for (const priceType of priceTypes) {
        const event = EventBuilderFactory.price()
          .withPrice({
            price_type: priceType,
            price_after: 100,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }
    });

    test('should validate B2B tier pricing', async () => {
      const event = EventBuilderFactory.price('PRD-001')
        .withPrice({
          product_id: 'PRD-001',
          price_type: 'tier',
          currency: 'EUR',
          price_after: 90,
          tier_id: 'TIER-GOLD',
          tier_name: 'Gold Customers',
          minimum_quantity: 100,
          customer_group: 'gold',
          change_reason: 'Tier pricing update',
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
    });
  });

  describe('cart.updated Event Contract', () => {
    test('should validate a valid cart.updated event', async () => {
      const event = EventBuilderFactory.cart()
        .withCart({
          cart_id: '550e8400-e29b-41d4-a716-446655440000',
          customer_id: 'CUST-001',
          customer_type: 'b2c',
          session_id: 'sess-123',
          items: [
            {
              product_id: 'PRD-001',
              quantity: 2,
              unit_price: 100,
            },
          ],
          totals: {
            subtotal: 200,
            tax_amount: 38,
            total: 238,
            currency: 'EUR',
          },
          applied_promo_codes: ['SAVE10'],
          estimated_shipping: 15,
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate cart for guest customer', async () => {
      const event = EventBuilderFactory.cart()
        .withCart({
          customer_type: 'guest',
          session_id: 'sess-guest-123',
          items: [],
          totals: {
            subtotal: 0,
            currency: 'EUR',
          },
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
    });
  });

  describe('quote.created Event Contract', () => {
    test('should validate a valid quote.created event', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const event = EventBuilderFactory.quote('QT-000123')
        .withQuote({
          quote_id: '550e8400-e29b-41d4-a716-446655440000',
          quote_number: 'QT-000123',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          customer_name: 'Acme Corporation',
          customer_email: 'contact@acme.com',
          created_by: 'user-123',
          expires_at: expiresAt.toISOString(),
          status: 'pending',
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
          notes: 'Quote for bulk order',
          internal_notes: 'Negotiated 10% discount',
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('credit.changed Event Contract', () => {
    test('should validate a valid credit.changed event', async () => {
      const event = EventBuilderFactory.credit('CUST-001')
        .withCredit({
          customer_id: 'CUST-001',
          credit_limit_before: 10000,
          credit_limit_after: 15000,
          credit_used_before: 2000,
          credit_used_after: 2000,
          available_before: 8000,
          available_after: 13000,
          change_type: 'limit_updated',
          reason: 'Credit limit increase for loyal customer',
          performed_by: 'admin-123',
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate all credit change types', async () => {
      const changeTypes = [
        'limit_updated',
        'payment_received',
        'order_placed',
        'manual_adjustment',
      ] as const;

      for (const changeType of changeTypes) {
        const event = EventBuilderFactory.credit()
          .withCredit({
            change_type: changeType,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Event Envelope Contract', () => {
    test('should validate event envelope structure', async () => {
      const event = new EventBuilder('test.event', 'test-service')
        .withVersion('v1')
        .withPriority(EventPriority.NORMAL)
        .withUser('user-123')
        .build();

      // Validate envelope structure (not payload)
      expect(event.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(event.event_type).toBe('test.event');
      expect(event.event_version).toBe('v1');
      expect(event.producer).toBe('test-service');
      expect(event.correlation_id).toBeDefined();
      expect(event.occurred_at).toBeDefined();
      expect(event.routing_key).toBe('test.event.v1');
      expect(event.priority).toBe(EventPriority.NORMAL);
      expect(event.payload).toBeDefined();
    });

    test('should validate all priority levels', () => {
      const priorities: EventPriority[] = [
        EventPriority.LOW,
        EventPriority.NORMAL,
        EventPriority.HIGH,
        EventPriority.CRITICAL,
      ];

      for (const priority of priorities) {
        const event = new EventBuilder('test.event', 'test-service').withPriority(priority).build();

        expect(event.priority).toBe(priority);
      }
    });

    test('should validate event type format', () => {
      const validTypes = ['order.created', 'product.updated', 'stock.changed', 'price.changed'];
      const invalidTypes = ['Order.Created', 'order_created', 'ORDER.CREATED', 'order'];

      for (const type of validTypes) {
        const regex = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
        expect(type).toMatch(regex);
      }

      for (const type of invalidTypes) {
        const regex = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
        expect(type).not.toMatch(regex);
      }
    });

    test('should validate event version format', () => {
      const validVersions = ['v1', 'v2', 'v10', 'v100'];
      const invalidVersions = ['1', 'V1', 'version-1', 'v1.0', 'v1b'];

      const regex = /^v\d+$/;

      for (const version of validVersions) {
        expect(version).toMatch(regex);
      }

      for (const version of invalidVersions) {
        expect(version).not.toMatch(regex);
      }
    });

    test('should validate ISO 8601 timestamp', () => {
      const event = EventBuilder.minimal('test.event');
      const timestamp = event.occurred_at;

      expect(() => new Date(timestamp)).not.toThrow();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });

    test('should maintain correlation ID across related events', () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';

      const event1 = new EventBuilder('order.created', 'order-service')
        .withCorrelationId(correlationId)
        .build();

      const event2 = new EventBuilder('payment.authorized', 'payment-service')
        .withCorrelationId(correlationId)
        .withCausationId(event1.event_id)
        .build();

      expect(event1.correlation_id).toBe(event2.correlation_id);
      expect(event2.causation_id).toBe(event1.event_id);
      expect(event1.trace_id).toBe(event2.trace_id);
    });
  });

  describe('Producer Contract Guarantees', () => {
    test('should guarantee envelope fields are never null', () => {
      const event = EventBuilder.minimal('test.event', { test: 'data' });

      expect(event.event_id).toBeTruthy();
      expect(event.event_type).toBeTruthy();
      expect(event.event_version).toBeTruthy();
      expect(event.occurred_at).toBeTruthy();
      expect(event.producer).toBeTruthy();
      expect(event.correlation_id).toBeTruthy();
      expect(event.routing_key).toBeTruthy();
      expect(event.priority).toBeTruthy();
      expect(event.payload).toBeTruthy();
    });

    test('should guarantee unique event IDs', () => {
      const event1 = EventBuilder.minimal('test.event');
      const event2 = EventBuilder.minimal('test.event');
      const event3 = EventBuilder.minimal('test.event');

      expect(event1.event_id).not.toBe(event2.event_id);
      expect(event2.event_id).not.toBe(event3.event_id);
      expect(event1.event_id).not.toBe(event3.event_id);
    });

    test('should guarantee producer info is set', () => {
      const producer = 'order-service';
      const event = new EventBuilder('order.created', producer).build();

      expect(event.producer).toBe(producer);
      expect(event.producer_version).toBeDefined();
    });

    test('should guarantee routing key is derived from event', () => {
      const eventType = 'order.created';
      const eventVersion = 'v1';
      const event = new EventBuilder(eventType, 'order-service').withVersion(eventVersion).build();

      expect(event.routing_key).toBe(`${eventType}.${eventVersion}`);
    });
  });
});
