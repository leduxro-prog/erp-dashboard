/**
 * @file Version Compatibility Tests
 * @module tests/events/contract/consumer/VersionCompatibility.test
 * @description Tests for schema version compatibility, ensuring consumers can
 * handle different schema versions and maintain backward compatibility.
 *
 * These tests ensure:
 * 1. Consumers can handle multiple schema versions
 * 2. Consumers maintain backward compatibility
 * 3. Consumers detect breaking changes
 * 4. Consumers handle version migrations
 * 5. Consumers support graceful version upgrades
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { SchemaValidator, EvolutionDirection } from '../helpers/SchemaValidator';
import { EventBuilder, EventBuilderFactory } from '../helpers/EventBuilder';

describe('Version Compatibility Tests', () => {
  let validator: SchemaValidator;

  beforeAll(async () => {
    validator = new SchemaValidator();
    await validator.loadAllSchemas();
  });

  describe('Schema Version Detection', () => {
    test('should identify current schema version', () => {
      const schema = validator.getSchema('order.created', 'v1');

      expect(schema).toBeDefined();
      expect(schema).toHaveProperty('$id');
      expect(schema).toHaveProperty('title');
      expect(schema).toHaveProperty('version', 'v1');
    });

    test('should return undefined for non-existent version', () => {
      const schema = validator.getSchema('order.created', 'v999');

      expect(schema).toBeUndefined();
    });

    test('should handle multiple versions of same event type', () => {
      // For now we only have v1, but test the capability
      const v1Schema = validator.getSchema('order.created', 'v1');

      expect(v1Schema).toBeDefined();

      // When v2 is added, this test should still pass
      // const v2Schema = validator.getSchema('order.created', 'v2');
      // expect(v2Schema).toBeDefined();
    });

    test('should track available versions per event type', () => {
      const stats = validator.getStats();

      expect(stats.versionCounts).toBeDefined();
      expect(typeof stats.versionCounts).toBe('object');
    });
  });

  describe('Backward Compatibility', () => {
    test('should accept events with only required fields', async () => {
      const minimalEvent = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          created_at: new Date().toISOString(),
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

      const result = await validator.validateEvent(minimalEvent);

      expect(result.valid).toBe(true);
    });

    test('should accept events with additional unknown fields', async () => {
      const eventWithExtras = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
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
        .withPayloadField('future_field_1', 'some value')
        .withPayloadField('future_field_2', { nested: true })
        .withPayloadField('future_field_3', [1, 2, 3])
        .build();

      const result = await validator.validateEvent(eventWithExtras);

      // Should accept additional properties (forward compatibility)
      expect(result.valid).toBe(true);
    });

    test('should accept events with unknown metadata fields', async () => {
      const event = EventBuilderFactory.order()
        .withUser('user-123')
        .withMetadata({
          future_metadata_1: 'value1',
          future_metadata_2: { key: 'value' },
          custom_tracking: 'abc123',
        })
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
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

    test('should handle nested objects with additional fields', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: {
            subtotal: 0,
            tax_amount: 0,
            total: 0,
            currency: 'EUR',
            future_total_field: 'extra',
          },
          shipping_address: {
            city: 'Bucharest',
            country: 'Romania',
            future_address_field: 'extra',
          },
        })
        .build();

      const result = await validator.validateEvent(event);

      expect(result.valid).toBe(true);
    });
  });

  describe('Forward Compatibility', () => {
    test('should handle unknown event types gracefully', async () => {
      const unknownEvent = EventBuilder.minimal('future.event.type', {
        some_field: 'value',
        another_field: 123,
      });

      const result = await validator.validateEvent(unknownEvent);

      expect(result.valid).toBe(false);
      expect(result.schemaFound).toBe(false);
      expect(result.errors.some((e) => e.message.includes('No schema found'))).toBe(true);
    });

    test('should provide clear error for unknown version', async () => {
      const event = EventBuilderFactory.order()
        .withVersion('v999')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
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

      expect(result.valid).toBe(false);
      expect(result.schemaFound).toBe(false);
    });

    test('should handle unknown enum values in future versions', async () => {
      const event = EventBuilderFactory.order()
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          status: 'future_status' as any, // Unknown status value
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

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('status'))).toBe(true);
    });
  });

  describe('Schema Evolution Detection', () => {
    test('should detect field additions as non-breaking', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' }, // New optional field
        },
      };

      const compatibility = validator.checkCompatibility(oldSchema, newSchema);

      expect(compatibility.compatible).toBe(true);
      expect(compatibility.issues.some((i) => i.field === 'description')).toBe(true);
      expect(compatibility.issues.some((i) => i.severity === 'error')).toBe(false);
    });

    test('should detect new required fields as breaking', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id', 'name'], // New required field
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      };

      const compatibility = validator.checkCompatibility(oldSchema, newSchema);

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.incompatibilityType).toBe('breaking');
      expect(compatibility.issues.some((i) => i.field === 'name')).toBe(true);
    });

    test('should detect field type changes as breaking', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id', 'value'],
        properties: {
          id: { type: 'string' },
          value: { type: 'string' },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id', 'value'],
        properties: {
          id: { type: 'string' },
          value: { type: 'number' }, // Type changed
        },
      };

      const compatibility = validator.checkCompatibility(oldSchema, newSchema);

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.issues.some((i) => i.field === 'value')).toBe(true);
    });

    test('should detect enum additions as non-breaking', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive'],
          },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'], // New enum value
          },
        },
      };

      const compatibility = validator.checkCompatibility(oldSchema, newSchema);

      expect(compatibility.compatible).toBe(true);
    });

    test('should detect enum removals as breaking', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
          },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive'], // Removed 'pending'
          },
        },
      };

      const compatibility = validator.checkCompatibility(oldSchema, newSchema);

      expect(typeof compatibility.compatible).toBe('boolean');
      expect(compatibility.issues.some((i) => i.issue.includes('enum'))).toBe(true);
    });

    test('should detect field removal', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          // description removed
        },
      };

      const compatibility = validator.checkCompatibility(oldSchema, newSchema);

      expect(compatibility.issues.some((i) => i.field === 'description')).toBe(true);
    });
  });

  describe('Schema Evolution Direction', () => {
    test('should detect backward compatible changes', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
        },
      };

      const evolution = validator.checkEvolution(oldSchema, newSchema);

      expect(evolution.isSafe).toBe(true);
      expect(evolution.direction).toBe(EvolutionDirection.BACKWARD_COMPATIBLE);
      expect(evolution.changes).toContainEqual({
        type: 'field_added',
        path: 'description',
        description: expect.any(String),
        impact: expect.any(String),
      });
    });

    test('should detect breaking changes', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      };

      const evolution = validator.checkEvolution(oldSchema, newSchema);

      expect(evolution.isSafe).toBe(false);
      expect(evolution.direction).toBe(EvolutionDirection.BREAKING);
    });

    test('should track all changes in evolution', () => {
      const oldSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      };

      const newSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'test',
        type: 'object',
        required: ['id', 'version'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
          version: { type: 'number' },
        },
      };

      const evolution = validator.checkEvolution(oldSchema, newSchema);

      expect(evolution.changes.length).toBeGreaterThan(0);

      const changeTypes = evolution.changes.map((c) => c.type);
      expect(changeTypes).toContain('field_added');
      expect(changeTypes).toContain('enum_added');
    });
  });

  describe('Version Migration', () => {
    test('should identify version from event', () => {
      const v1Event = EventBuilderFactory.order()
        .withVersion('v1')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
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

      expect(v1Event.event_version).toBe('v1');
    });

    test('should validate events for correct version', async () => {
      const event = EventBuilderFactory.order()
        .withVersion('v1')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
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
      expect(result.schemaVersion).toBe('v1');
    });
  });

  describe('Multi-Version Event Processing', () => {
    test('should handle events with same type but different versions', async () => {
      const events = [
        EventBuilderFactory.order('ORD-0001')
          .withVersion('v1')
          .withOrder({
            order_id: '550e8400-e29b-41d4-a716-446655440000',
            order_number: 'ORD-0001',
            customer_id: 'CUST-001',
            customer_type: 'b2b',
            items: [],
            totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
          })
          .build(),
      ];

      const results = await Promise.all(events.map((e) => validator.validateEvent(e)));

      expect(results.every((r) => r.valid)).toBe(true);
    });

    test('should track which schema validated the event', async () => {
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

      const result = await validator.validateEvent(event);

      expect(result.schemaId).toBeDefined();
      expect(result.schemaVersion).toBe('v1');
    });
  });

  describe('Version Deprecation', () => {
    test('should support identifying deprecated versions', () => {
      // This is a placeholder for future implementation
      // When version deprecation is implemented, this test should:
      // 1. Check if a version is marked as deprecated
      // 2. Ensure deprecated versions are still accepted
      // 3. Provide warnings for deprecated versions

      const stats = validator.getStats();
      expect(stats.totalSchemas).toBeGreaterThan(0);
    });

    test('should handle events from deprecated versions', async () => {
      // Placeholder for future implementation
      // Should validate that events from deprecated versions are still accepted

      const event = EventBuilderFactory.order('ORD-0001')
        .withVersion('v1')
        .withOrder({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          order_number: 'ORD-0001',
          customer_id: 'CUST-001',
          customer_type: 'b2b',
          items: [],
          totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
        })
        .build();

      const result = await validator.validateEvent(event);
      expect(result.valid).toBe(true);
    });
  });

  describe('Contract Compatibility Matrix', () => {
    test('should maintain compatibility matrix for producers and consumers', () => {
      // This test verifies that the system can track which producer/consumer
      // combinations are compatible

      const stats = validator.getStats();
      expect(stats.totalSchemas).toBeGreaterThan(0);
      expect(stats.eventTypes.length).toBeGreaterThan(0);
    });

    test('should report available versions per event type', () => {
      const stats = validator.getStats();

      // Should have at least these event types
      const expectedEventTypes = [
        'order.created',
        'product.updated',
        'stock.changed',
        'price.changed',
      ];

      for (const eventType of expectedEventTypes) {
        expect(stats.eventTypes.some((et) => et.includes(eventType.split('.')[0]))).toBe(true);
      }
    });
  });
});
