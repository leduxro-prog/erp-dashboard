/**
 * @file Schema Validation Tests
 * @module tests/events/contract/producer/SchemaValidation.test
 * @description Comprehensive schema validation tests for event payloads.
 * Tests cover required fields, type validation, format validation, enum values,
 * nested objects, arrays, and edge cases.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { SchemaValidator } from '../helpers/SchemaValidator';
import { EventBuilder, EventBuilderFactory } from '../helpers/EventBuilder';
import { EventPriority } from '../../../../events/types/EventEnvelope';

describe('Schema Validation Tests', () => {
  let validator: SchemaValidator;

  beforeAll(async () => {
    validator = new SchemaValidator();
    await validator.loadAllSchemas();
  });

  describe('Schema Loading', () => {
    test('should load all event schemas', async () => {
      await validator.loadAllSchemas();

      const stats = validator.getStats();
      expect(stats.totalSchemas).toBeGreaterThan(0);
      expect(stats.eventTypes.length).toBeGreaterThan(0);
    });

    test('should have schemas for all event types', () => {
      const expectedEventTypes = [
        'order.created',
        'order.cancelled',
        'product.updated',
        'stock.changed',
        'price.changed',
        'cart.updated',
        'quote.created',
        'credit.changed',
      ];

      for (const eventType of expectedEventTypes) {
        const schema = validator.getSchema(eventType, 'v1');
        expect(schema).toBeDefined();
      }
    });

    test('should have schema statistics', () => {
      const stats = validator.getStats();

      expect(stats).toHaveProperty('totalSchemas');
      expect(stats).toHaveProperty('eventTypes');
      expect(stats).toHaveProperty('versionCounts');
      expect(Array.isArray(stats.eventTypes)).toBe(true);
    });
  });

  describe('order.created Schema Validation', () => {
    const eventType = 'order.created';

    test('should validate required fields in order.created', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-00012345',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          customer_name: 'Test Customer',
          customer_email: 'test@example.com',
          status: 'pending',
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
      expect(result.valid).toBe(true);
    });

    test('should validate UUID format for order_id', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const invalidUuids = [
        'not-a-uuid',
        '12345678-1234-1234-1234-123456789012', // version 0, not valid
        '550e8400-e29b-41d4-a716-44665544gghh', // invalid characters
      ];

      for (const uuid of [validUuid, ...invalidUuids]) {
        const event = EventBuilderFactory.order()
          .withOrder({
            order_id: uuid,
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(uuid === validUuid);
      }
    });

    test('should validate order_number pattern', async () => {
      const validNumbers = ['ORD-00000001', 'ORD-99999999'];
      const invalidNumbers = [
        'ORD-1',
        'ORD-123456789',
        'ord-00000001',
        'ORD_00000001',
        'ORDER-00000001',
      ];

      for (const number of validNumbers) {
        const event = EventBuilderFactory.order(number)
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const number of invalidNumbers) {
        const event = EventBuilderFactory.order(number)
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate customer_type enum', async () => {
      const validTypes: Array<'b2b' | 'b2c' | 'guest'> = ['b2b', 'b2c', 'guest'];
      const invalidTypes = ['B2B', 'business', 'retail', ''];

      for (const type of validTypes) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: type,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const type of invalidTypes) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: type as any,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate status enum', async () => {
      const validStatuses = [
        'pending',
        'confirmed',
        'processing',
        'ready_to_ship',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
        'failed',
      ];
      const invalidStatuses = ['open', 'paid', 'complete', ''];

      for (const status of validStatuses) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            status: status as any,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const status of invalidStatuses) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            status: status as any,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate email format for customer_email', async () => {
      const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'user+tag@example.com'];
      const invalidEmails = ['not-an-email', '@example.com', 'user@', 'user @example.com'];

      for (const email of validEmails) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            customer_email: email,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const email of invalidEmails) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            customer_email: email,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate currency code format', async () => {
      const validCurrencies = ['EUR', 'USD', 'RON', 'GBP', 'JPY'];
      const invalidCurrencies = ['eur', 'Euro', 'E', '123', ''];

      for (const currency of validCurrencies) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const currency of invalidCurrencies) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: currency as any },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate numeric constraints in totals', async () => {
      const testCases = [
        { subtotal: 0, tax: 0, total: 0, valid: true },
        { subtotal: 100, tax: 19, total: 119, valid: true },
        { subtotal: 100.5, tax: 19.1, total: 119.6, valid: true },
        { subtotal: -1, tax: 0, total: -1, valid: false }, // negative not allowed
        { subtotal: '100' as any, tax: 0, total: 100, valid: false }, // string not allowed
      ];

      for (const testCase of testCases) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: {
              subtotal: testCase.subtotal as any,
              tax_amount: testCase.tax as any,
              total: testCase.total as any,
              currency: 'EUR',
            },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(testCase.valid);
      }
    });

    test('should validate items array', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [
            {
              item_id: '550e8400-e29b-41d4-a716-446655440000',
              product_id: 'PRD-001',
              variant_id: 'VAR-001',
              sku: 'PRD-001-A',
              product_name: 'Test Product',
              quantity: 10,
              unit_price: 100,
              unit_cost: 80,
              tax_rate: 19,
              tax_amount: 190,
              discount_amount: 0,
              line_total: 1190,
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

      const result = await validator.validateEvent(event);
      expect(result.valid).toBe(true);
    });

    test('should validate item quantity minimum', async () => {
      const testCases = [
        { quantity: 1, valid: true },
        { quantity: 10, valid: true },
        { quantity: 0, valid: false }, // must be >= 1
        { quantity: -5, valid: false }, // cannot be negative
      ];

      for (const testCase of testCases) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [
              {
                product_id: 'PRD-001',
                product_name: 'Test Product',
                quantity: testCase.quantity as any,
                unit_price: 100,
              },
            ],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(testCase.valid);
      }
    });

    test('should validate payment method enum', async () => {
      const validMethods = [
        'card',
        'bank_transfer',
        'cash_on_delivery',
        'credit',
        'paypal',
        'stripe',
        'payu',
      ];
      const invalidMethods = ['bank', 'wire', 'cash', ''];

      for (const method of validMethods) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            payment_method: {
              method_code: method,
              method_name: 'Test Payment',
            },
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const method of invalidMethods) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            payment_method: {
              method_code: method as any,
              method_name: 'Test Payment',
            },
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate payment term enum for B2B', async () => {
      const validTerms = ['immediate', 'net_7', 'net_14', 'net_30', 'net_60', 'net_90'];

      for (const term of validTerms) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            payment_method: {
              method_code: 'bank_transfer',
              method_name: 'Bank Transfer',
              payment_term: term,
            },
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }
    });

    test('should validate channel enum', async () => {
      const validChannels = ['web', 'mobile', 'pos', 'api', 'admin', 'phone', 'email'];
      const invalidChannels = ['website', 'mobile-app', 'in-store', ''];

      for (const channel of validChannels) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            channel: channel as any,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const channel of invalidChannels) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            channel: channel as any,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate shipping address required fields', async () => {
      const validAddresses = [
        {
          city: 'Bucharest',
          country: 'Romania',
        },
        {
          name: 'John Doe',
          company: 'Acme Corp',
          address_line1: '123 Street',
          city: 'Bucharest',
          state_province: 'Bucharest',
          postal_code: '010123',
          country: 'Romania',
          phone: '+40700123456',
        },
      ];
      const invalidAddresses = [
        { country: 'Romania' }, // missing city
        { city: 'Bucharest' }, // missing country
        {} as any, // missing both
      ];

      for (const address of validAddresses) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            shipping_address: address,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const address of invalidAddresses) {
        const event = EventBuilderFactory.order()
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            shipping_address: address,
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate date-time format for timestamps', async () => {
      const validTimestamps = [
        new Date().toISOString(),
        '2026-02-13T10:00:00.000Z',
        '2026-02-13T10:00:00Z',
      ];
      const invalidTimestamps = ['2026-02-13', '10:00:00', '2026/02/13T10:00:00Z', 'not-a-date'];

      for (const timestamp of validTimestamps) {
        const event = EventBuilderFactory.order()
          .withOccurredAt(timestamp)
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const timestamp of invalidTimestamps) {
        const event = EventBuilderFactory.order()
          .withOccurredAt(timestamp)
          .withOrder({
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('product.updated Schema Validation', () => {
    test('should validate change_type enum', async () => {
      const validChangeTypes = [
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
      ];
      const invalidChangeTypes = ['updated', 'modified', 'changed', ''];

      for (const changeType of validChangeTypes) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: changeType as any,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const changeType of invalidChangeTypes) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: changeType as any,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate product status enum', async () => {
      const validStatuses = ['active', 'inactive', 'draft', 'archived', 'discontinued'];
      const invalidStatuses = ['available', 'out-of-stock', 'enabled', ''];

      for (const status of validStatuses) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'status_changed',
            new_values: { status },
            product_state: {
              name: 'Test Product',
              status,
            },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const status of invalidStatuses) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'status_changed',
            new_values: { status },
            product_state: {
              name: 'Test Product',
              status,
            },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate visibility enum', async () => {
      const validVisibilities = ['visible', 'hidden', 'catalog_only', 'search_only'];
      const invalidVisibilities = ['public', 'private', 'none', ''];

      for (const visibility of validVisibilities) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'visibility_changed',
            new_values: { visibility },
            product_state: {
              name: 'Test Product',
              status: 'active',
              visibility,
            },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const visibility of invalidVisibilities) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'visibility_changed',
            new_values: { visibility },
            product_state: {
              name: 'Test Product',
              status: 'active',
              visibility,
            },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate product_type enum', async () => {
      const validProductTypes = [
        'simple',
        'configurable',
        'bundle',
        'grouped',
        'virtual',
        'downloadable',
      ];
      const invalidProductTypes = ['standard', 'custom', 'variant', ''];

      for (const productType of validProductTypes) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            product_state: {
              name: 'Test Product',
              status: 'active',
              product_type: productType,
            } as any,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const productType of invalidProductTypes) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            product_state: {
              name: 'Test Product',
              status: 'active',
              product_type: productType,
            } as any,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate weight unit enum', async () => {
      const validUnits = ['kg', 'g', 'lb', 'oz'];
      const invalidUnits = ['kilogram', 'gram', 'pound', ''];

      for (const unit of validUnits) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            new_values: {
              weight: 1.5,
              weight_unit: unit,
            },
            product_state: {
              name: 'Test Product',
              status: 'active',
            },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const unit of invalidUnits) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            new_values: {
              weight: 1.5,
              weight_unit: unit as any,
            },
            product_state: {
              name: 'Test Product',
              status: 'active',
            },
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate dimension unit enum', async () => {
      const validUnits = ['cm', 'mm', 'in'];
      const invalidUnits = ['meter', 'inch', 'foot', ''];

      for (const unit of validUnits) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            product_state: {
              name: 'Test Product',
              status: 'active',
            },
          })
          .withPayloadField('dimensions', {
            length: 10,
            width: 10,
            height: 10,
            unit,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const unit of invalidUnits) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            product_state: {
              name: 'Test Product',
              status: 'active',
            },
          })
          .withPayloadField('dimensions', {
            length: 10,
            width: 10,
            height: 10,
            unit: unit as any,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate attribute type enum', async () => {
      const validAttributeTypes = ['text', 'number', 'boolean', 'select', 'multiselect', 'date'];
      const invalidAttributeTypes = ['string', 'integer', 'float', ''];

      for (const attrType of validAttributeTypes) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            product_state: {
              name: 'Test Product',
              status: 'active',
            },
          })
          .withPayloadField('product', {
            name: 'Test Product',
            status: 'active',
          })
          .withPayloadField('attributes', [
            {
              code: 'test_attr',
              value: 'test',
              type: attrType as any,
            },
          ])
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const attrType of invalidAttributeTypes) {
        const event = EventBuilderFactory.product()
          .withProduct({
            change_type: 'attributes_changed',
            product_state: {
              name: 'Test Product',
              status: 'active',
            },
          })
          .withPayloadField('product', {
            name: 'Test Product',
            status: 'active',
          })
          .withPayloadField('attributes', [
            {
              code: 'test_attr',
              value: 'test',
              type: attrType as any,
            },
          ])
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('stock.changed Schema Validation', () => {
    test('should validate change_type enum', async () => {
      const validChangeTypes = [
        'addition',
        'removal',
        'adjustment',
        'transfer',
        'reserved',
        'released',
      ];
      const invalidChangeTypes = ['added', 'removed', 'updated', ''];

      for (const changeType of validChangeTypes) {
        const event = EventBuilderFactory.stock()
          .withStock({
            change_type: changeType as any,
            quantity_before: 100,
            quantity_after: 100,
            quantity_change: 0,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const changeType of invalidChangeTypes) {
        const event = EventBuilderFactory.stock()
          .withStock({
            change_type: changeType as any,
            quantity_before: 100,
            quantity_after: 100,
            quantity_change: 0,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('price.changed Schema Validation', () => {
    test('should validate price_type enum', async () => {
      const validPriceTypes = ['regular', 'special', 'tier', 'bulk', 'b2b'];
      const invalidPriceTypes = ['normal', 'sale', 'discount', ''];

      for (const priceType of validPriceTypes) {
        const event = EventBuilderFactory.price()
          .withPrice({
            price_type: priceType as any,
            price_after: 100,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(true);
      }

      for (const priceType of invalidPriceTypes) {
        const event = EventBuilderFactory.price()
          .withPrice({
            price_type: priceType as any,
            price_after: 100,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(false);
      }
    });

    test('should validate price_after as positive number', async () => {
      const testCases = [
        { price: 0.01, valid: true },
        { price: 100, valid: true },
        { price: 9999.99, valid: true },
        { price: 0, valid: true }, // zero is allowed
        { price: -10, valid: false }, // negative not allowed
        { price: '100' as any, valid: false }, // string not allowed
        { price: null as any, valid: false }, // null not allowed
      ];

      for (const testCase of testCases) {
        const event = EventBuilderFactory.price()
          .withPrice({
            price_after: testCase.price,
          })
          .build();

        const result = await validator.validateEvent(event);
        expect(result.valid).toBe(testCase.valid);
      }
    });
  });

  describe('Nested Object and Array Validation', () => {
    test('should validate deeply nested objects', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [
            {
              product_id: 'PRD-001',
              product_name: 'Test Product',
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
          shipping_address: {
            name: 'John Doe',
            company: 'Acme Corp',
            address_line1: '123 Business Street',
            address_line2: 'Suite 100',
            city: 'Bucharest',
            state_province: 'Bucharest',
            postal_code: '010123',
            country: 'Romania',
            phone: '+40700123456',
          },
        })
        .build();

      const result = await validator.validateEvent(event);
      expect(result.valid).toBe(true);
    });

    test('should validate arrays with multiple items', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: Array.from({ length: 10 }, (_, i) => ({
            product_id: `PRD-${String(i + 1).padStart(3, '0')}`,
            product_name: 'Test Product',
            quantity: i + 1,
            unit_price: 100 * (i + 1),
          })),
          totals: {
            subtotal: 5500,
            tax_amount: 1045,
            total: 6545,
            currency: 'EUR',
          },
        })
        .build();

      const result = await validator.validateEvent(event);
      expect(result.valid).toBe(true);
    });

    test('should validate empty arrays', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
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
      expect(result.valid).toBe(true);
    });

    test('should validate objects with additional properties', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: {
            subtotal: 0,
            tax_amount: 0,
            total: 0,
            currency: 'EUR',
          },
        })
        .withPayloadField('custom_field', 'custom_value')
        .withPayloadField('metadata', {
          key1: 'value1',
          key2: 'value2',
          key3: 123,
        })
        .build();

      const result = await validator.validateEvent(event);
      // Additional properties should be allowed (open schema)
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge Cases and Error Reporting', () => {
    test('should report detailed validation errors', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          // Missing required fields
          customer_id: 'CUST-001',
          customer_type: 'invalid' as any,
          items: [
            {
              product_id: 'PRD-001',
              product_name: 'Test Product',
              quantity: 0, // invalid: must be >= 1
              unit_price: -10, // invalid: must be >= 0
            },
          ],
          totals: {
            subtotal: -100, // invalid: must be >= 0
            tax_amount: 'invalid' as any, // invalid: must be number
            total: 'invalid' as any, // invalid: must be number
          },
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Check that errors are detailed
      const errors = result.errors;
      expect(errors.some((e) => e.path !== '')).toBe(true);
      expect(errors.every((e) => e.message.length > 0)).toBe(true);
    });

    test('should handle missing schema gracefully', async () => {
      const event = EventBuilder.minimal('non.existent.event', { test: 'data' });

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.schemaFound).toBe(false);
      expect(result.errors.some((e) => e.message.includes('No schema found'))).toBe(true);
    });

    test('should validate large payloads efficiently', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        product_id: `PRD-${String(i + 1).padStart(4, '0')}`,
        product_name: 'Test Product',
        quantity: Math.floor(Math.random() * 100) + 1,
        unit_price: Math.floor(Math.random() * 1000) + 1,
      }));

      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items,
          totals: {
            subtotal: items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
            tax_amount: 0,
            total: 0,
            currency: 'EUR',
          },
        })
        .build();

      const startTime = Date.now();
      const result = await validator.validateEvent(event);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle null and undefined values correctly', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: {
            subtotal: 0,
            tax_amount: 0,
            total: 0,
            currency: 'EUR',
          },
        })
        .withPayloadField('optional_field', null)
        .build();

      const result = await validator.validateEvent(event);
      // null should be handled according to schema (may or may not be allowed)
      expect(result.schemaFound).toBe(true);
    });
  });
});
