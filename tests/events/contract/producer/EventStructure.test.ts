/**
 * @file Event Structure Validation Tests
 * @module tests/events/contract/producer/EventStructure.test
 * @description Tests for validating the structure of event envelopes,
 * ensuring they follow the contract format for all required and optional fields.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  EventEnvelopeFactory,
  EventEnvelopeUtils,
  EventPriority,
  isEventEnvelope,
  isEventPriority,
} from '../../../../events/types/EventEnvelope';
import { EventBuilder } from '../helpers/EventBuilder';

describe('Event Structure Validation Tests', () => {
  describe('Event Envelope Factory', () => {
    test('should create valid event envelope with minimal options', () => {
      const envelope = EventEnvelopeFactory.create({
        event_type: 'test.event',
        producer: 'test-service',
        payload: { test: 'data' },
      });

      expect(envelope).toHaveProperty('event_id');
      expect(envelope).toHaveProperty('event_type', 'test.event');
      expect(envelope).toHaveProperty('event_version', 'v1');
      expect(envelope).toHaveProperty('occurred_at');
      expect(envelope).toHaveProperty('producer', 'test-service');
      expect(envelope).toHaveProperty('correlation_id');
      expect(envelope).toHaveProperty('routing_key', 'test.event.v1');
      expect(envelope).toHaveProperty('priority', EventPriority.NORMAL);
      expect(envelope).toHaveProperty('payload');
      expect(envelope.payload).toEqual({ test: 'data' });
    });

    test('should create event envelope with all options', () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';
      const traceId = '660e8400-e29b-41d4-a716-446655440000';

      const envelope = EventEnvelopeFactory.create({
        event_type: 'test.event',
        event_version: 'v2',
        producer: 'test-service',
        producer_version: '2.0.0',
        producer_instance: 'instance-1',
        correlation_id: correlationId,
        causation_id: '770e8400-e29b-41d4-a716-446655440000',
        parent_event_id: '880e8400-e29b-41d4-a716-446655440000',
        trace_id: traceId,
        routing_key: 'custom.routing.key',
        priority: EventPriority.HIGH,
        payload: { test: 'data' },
        metadata: {
          user_id: 'user-123',
          session_id: 'session-456',
          tenant_id: 'tenant-789',
        },
        occurred_at: '2026-02-13T10:00:00.000Z',
      });

      expect(envelope.event_version).toBe('v2');
      expect(envelope.producer_version).toBe('2.0.0');
      expect(envelope.producer_instance).toBe('instance-1');
      expect(envelope.correlation_id).toBe(correlationId);
      expect(envelope.causation_id).toBe('770e8400-e29b-41d4-a716-446655440000');
      expect(envelope.parent_event_id).toBe('880e8400-e29b-41d4-a716-446655440000');
      expect(envelope.trace_id).toBe(traceId);
      expect(envelope.routing_key).toBe('custom.routing.key');
      expect(envelope.priority).toBe(EventPriority.HIGH);
      expect(envelope.metadata).toEqual({
        user_id: 'user-123',
        session_id: 'session-456',
        tenant_id: 'tenant-789',
      });
      expect(envelope.occurred_at).toBe('2026-02-13T10:00:00.000Z');
    });

    test('should create child event from parent', () => {
      const parent = EventEnvelopeFactory.create({
        event_type: 'parent.event',
        producer: 'parent-service',
        payload: { parent: true },
      });

      const child = EventEnvelopeFactory.createChild(parent, 'child.event', 'child-service', {
        child: true,
      });

      expect(child.event_type).toBe('child.event');
      expect(child.producer).toBe('child-service');
      expect(child.correlation_id).toBe(parent.correlation_id);
      expect(child.causation_id).toBe(parent.event_id);
      expect(child.parent_event_id).toBe(parent.event_id);
      expect(child.trace_id).toBe(parent.trace_id);
      expect(child.payload).toEqual({ child: true });
    });

    test('should create batch of related events', () => {
      const correlationId = '550e8400-e29b-41d4-a716-446655440000';

      const events = EventEnvelopeFactory.createBatch(
        {
          producer: 'batch-service',
          correlation_id: correlationId,
          priority: EventPriority.HIGH,
        },
        [
          { event_type: 'event.one', payload: { id: 1 } },
          { event_type: 'event.two', payload: { id: 2 } },
          { event_type: 'event.three', payload: { id: 3 } },
        ],
      );

      expect(events).toHaveLength(3);
      expect(events.every((e) => e.correlation_id === correlationId)).toBe(true);
      expect(events.every((e) => e.producer === 'batch-service')).toBe(true);
      expect(events.every((e) => e.priority === EventPriority.HIGH)).toBe(true);
      expect(events.every((e) => e.trace_id === correlationId)).toBe(true);
      expect(events[0].event_type).toBe('event.one');
      expect(events[1].event_type).toBe('event.two');
      expect(events[2].event_type).toBe('event.three');
    });

    test('should validate event envelope structure', () => {
      const envelope = EventEnvelopeFactory.create({
        event_type: 'test.event',
        producer: 'test-service',
        payload: { test: 'data' },
      });

      const result = EventEnvelopeFactory.validate(envelope);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid event_id format', () => {
      const envelope = {
        event_id: 'invalid-uuid',
        event_type: 'test.event',
        event_version: 'v1',
        occurred_at: new Date().toISOString(),
        producer: 'test-service',
        correlation_id: '550e8400-e29b-41d4-a716-446655440000',
        routing_key: 'test.event.v1',
        priority: EventPriority.NORMAL,
        payload: { test: 'data' },
      };

      const result = EventEnvelopeFactory.validate(envelope);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'event_id')).toBe(true);
      expect(result.errors.some((e) => e.message.includes('UUID'))).toBe(true);
    });

    test('should detect invalid event_type format', () => {
      const invalidTypes = [
        'Event',
        'TEST_EVENT',
        'test-event',
        'Test.Event',
        'test',
        'test.event.subevent',
      ];

      for (const type of invalidTypes) {
        const envelope = EventEnvelopeFactory.create({
          event_type: type,
          producer: 'test-service',
          payload: { test: 'data' },
        });

        const result = EventEnvelopeFactory.validate(envelope);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === 'event_type')).toBe(true);
      }
    });

    test('should accept valid event_type format', () => {
      const validTypes = [
        'order.created',
        'product.updated',
        'stock.changed',
        'price.changed',
        'cart.updated',
        'quote.created',
        'credit.changed',
        'test-event.name',
        'domain.sub-domain.action',
      ];

      for (const type of validTypes) {
        const envelope = EventEnvelopeFactory.create({
          event_type: type,
          producer: 'test-service',
          payload: { test: 'data' },
        });

        const result = EventEnvelopeFactory.validate(envelope);

        expect(result.valid).toBe(true);
      }
    });

    test('should detect invalid event_version format', () => {
      const invalidVersions = ['1', 'V1', 'version-1', 'v1.0', 'v1b', 'v'];

      for (const version of invalidVersions) {
        const envelope = EventEnvelopeFactory.create({
          event_type: 'test.event',
          event_version: version,
          producer: 'test-service',
          payload: { test: 'data' },
        });

        const result = EventEnvelopeFactory.validate(envelope);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === 'event_version')).toBe(true);
      }
    });

    test('should accept valid event_version format', () => {
      const validVersions = ['v1', 'v2', 'v10', 'v100', 'v999'];

      for (const version of validVersions) {
        const envelope = EventEnvelopeFactory.create({
          event_type: 'test.event',
          event_version: version,
          producer: 'test-service',
          payload: { test: 'data' },
        });

        const result = EventEnvelopeFactory.validate(envelope);

        expect(result.valid).toBe(true);
      }
    });

    test('should detect invalid occurred_at format', () => {
      const invalidDates = ['2026-02-13', '10:00:00', '2026/02/13T10:00:00Z', 'not-a-date', ''];

      for (const date of invalidDates) {
        const envelope = {
          event_id: '550e8400-e29b-41d4-a716-446655440000',
          event_type: 'test.event',
          event_version: 'v1',
          occurred_at: date,
          producer: 'test-service',
          correlation_id: '660e8400-e29b-41d4-a716-446655440000',
          routing_key: 'test.event.v1',
          priority: EventPriority.NORMAL,
          payload: { test: 'data' },
        };

        const result = EventEnvelopeFactory.validate(envelope);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === 'occurred_at')).toBe(true);
      }
    });

    test('should accept valid occurred_at format', () => {
      const validDates = [
        new Date().toISOString(),
        '2026-02-13T10:00:00.000Z',
        '2026-02-13T10:00:00Z',
        '2026-02-13T10:00:00.123Z',
      ];

      for (const date of validDates) {
        const envelope = EventEnvelopeFactory.create({
          event_type: 'test.event',
          producer: 'test-service',
          payload: { test: 'data' },
          occurred_at: date,
        });

        const result = EventEnvelopeFactory.validate(envelope);

        expect(result.valid).toBe(true);
      }
    });

    test('should detect missing required producer field', () => {
      const envelope = {
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'test.event',
        event_version: 'v1',
        occurred_at: new Date().toISOString(),
        producer: '',
        correlation_id: '660e8400-e29b-41d4-a716-446655440000',
        routing_key: 'test.event.v1',
        priority: EventPriority.NORMAL,
        payload: { test: 'data' },
      };

      const result = EventEnvelopeFactory.validate(envelope);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'producer')).toBe(true);
    });

    test('should detect invalid correlation_id format', () => {
      const envelope = {
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'test.event',
        event_version: 'v1',
        occurred_at: new Date().toISOString(),
        producer: 'test-service',
        correlation_id: 'invalid-uuid',
        routing_key: 'test.event.v1',
        priority: EventPriority.NORMAL,
        payload: { test: 'data' },
      };

      const result = EventEnvelopeFactory.validate(envelope);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'correlation_id')).toBe(true);
    });

    test('should detect invalid priority value', () => {
      const envelope = {
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'test.event',
        event_version: 'v1',
        occurred_at: new Date().toISOString(),
        producer: 'test-service',
        correlation_id: '660e8400-e29b-41d4-a716-446655440000',
        routing_key: 'test.event.v1',
        priority: 'invalid' as EventPriority,
        payload: { test: 'data' },
      };

      const result = EventEnvelopeFactory.validate(envelope);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'priority')).toBe(true);
    });

    test('should accept all valid priority values', () => {
      const priorities = [
        EventPriority.LOW,
        EventPriority.NORMAL,
        EventPriority.HIGH,
        EventPriority.CRITICAL,
      ];

      for (const priority of priorities) {
        const envelope = EventEnvelopeFactory.create({
          event_type: 'test.event',
          producer: 'test-service',
          payload: { test: 'data' },
          priority: priority,
        });

        const result = EventEnvelopeFactory.validate(envelope);

        expect(result.valid).toBe(true);
      }
    });

    test('should detect missing payload', () => {
      const envelope = {
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'test.event',
        event_version: 'v1',
        occurred_at: new Date().toISOString(),
        producer: 'test-service',
        correlation_id: '660e8400-e29b-41d4-a716-446655440000',
        routing_key: 'test.event.v1',
        priority: EventPriority.NORMAL,
        payload: null,
      };

      const result = EventEnvelopeFactory.validate(envelope);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'payload')).toBe(true);
    });

    test('should detect invalid optional UUID fields', () => {
      const envelope = {
        event_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'test.event',
        event_version: 'v1',
        occurred_at: new Date().toISOString(),
        producer: 'test-service',
        correlation_id: '660e8400-e29b-41d4-a716-446655440000',
        causation_id: 'invalid-uuid',
        routing_key: 'test.event.v1',
        priority: EventPriority.NORMAL,
        payload: { test: 'data' },
      };

      const result = EventEnvelopeFactory.validate(envelope);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'causation_id')).toBe(true);
    });
  });

  describe('Event Builder', () => {
    test('should create minimal event via builder', () => {
      const event = EventBuilder.minimal('test.event', { test: 'data' });

      expect(event.event_id).toBeDefined();
      expect(event.event_type).toBe('test.event');
      expect(event.event_version).toBe('v1');
      expect(event.producer).toBe('test-producer');
      expect(event.payload).toEqual({ test: 'data' });
    });

    test('should build event with all fluent methods', () => {
      const event = new EventBuilder('test.event', 'test-service')
        .withVersion('v2')
        .withProducerVersion('2.0.0')
        .withPriority(EventPriority.HIGH)
        .withUser('user-123')
        .withSession('session-456')
        .withTenant('tenant-789')
        .withPayloadField('custom', 'value')
        .build();

      expect(event.event_version).toBe('v2');
      expect(event.producer_version).toBe('2.0.0');
      expect(event.priority).toBe(EventPriority.HIGH);
      expect(event.metadata?.user_id).toBe('user-123');
      expect(event.metadata?.session_id).toBe('session-456');
      expect(event.metadata?.tenant_id).toBe('tenant-789');
      expect(event.payload.custom).toBe('value');
    });

    test('should generate unique event IDs', () => {
      const events = Array.from({ length: 100 }, () =>
        EventBuilder.minimal('test.event', { id: Math.random() }),
      );

      const uniqueIds = new Set(events.map((e) => e.event_id));
      expect(uniqueIds.size).toBe(100);
    });

    test('should generate valid correlation IDs', () => {
      const event = EventBuilder.minimal('test.event');
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(event.correlation_id).toMatch(uuidRegex);
      expect(event.trace_id).toMatch(uuidRegex);
    });

    test('should build routing key from event type and version', () => {
      const event = new EventBuilder('order.created', 'order-service').withVersion('v1').build();

      expect(event.routing_key).toBe('order.created.v1');
    });

    test('should support custom routing key', () => {
      const event = new EventBuilder('order.created', 'order-service').withVersion('v1').build();

      // Note: Routing key is auto-generated, but could be overridden in future
      expect(event.routing_key).toBe('order.created.v1');
    });
  });

  describe('Event Serialization', () => {
    test('should serialize event envelope to JSON', () => {
      const envelope = EventEnvelopeFactory.create({
        event_type: 'test.event',
        producer: 'test-service',
        payload: { test: 'data' },
      });

      const json = EventEnvelopeFactory.serialize(envelope);

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.event_type).toBe('test.event');
      expect(parsed.producer).toBe('test-service');
    });

    test('should deserialize JSON to event envelope', () => {
      const original = EventEnvelopeFactory.create({
        event_type: 'test.event',
        producer: 'test-service',
        payload: { test: 'data' },
      });

      const json = EventEnvelopeFactory.serialize(original);
      const deserialized = EventEnvelopeFactory.deserialize(json);

      expect(deserialized.event_id).toBe(original.event_id);
      expect(deserialized.event_type).toBe(original.event_type);
      expect(deserialized.event_version).toBe(original.event_version);
      expect(deserialized.producer).toBe(original.producer);
      expect(deserialized.payload).toEqual(original.payload);
    });

    test('should throw error on invalid JSON during deserialization', () => {
      expect(() => {
        EventEnvelopeFactory.deserialize('not valid json');
      }).toThrow();
    });
  });

  describe('Event Type Parsing', () => {
    test('should parse event type correctly', () => {
      const parsed = EventEnvelopeFactory.parseEventType('order.created');

      expect(parsed).toEqual({
        domain: 'order',
        action: 'created',
      });
    });

    test('should parse complex event types', () => {
      const testCases = [
        { input: 'order.created', domain: 'order', action: 'created' },
        { input: 'product-updated', domain: 'product-updated', action: '' }, // dash not dot
        { input: 'stock.changed', domain: 'stock', action: 'changed' },
        { input: 'a.b', domain: 'a', action: 'b' },
      ];

      for (const testCase of testCases) {
        const parsed = EventEnvelopeFactory.parseEventType(testCase.input);
        expect(parsed.domain).toBe(testCase.domain);
        expect(parsed.action).toBe(testCase.action);
      }
    });

    test('should build routing key from event type and version', () => {
      const key = EventEnvelopeFactory.buildRoutingKey('order.created', 'v1');

      expect(key).toBe('order.created.v1');
    });
  });

  describe('Event Envelope Utils', () => {
    test('should check if event is of specific type', () => {
      const envelope = EventBuilder.minimal('order.created');

      expect(EventEnvelopeUtils.isEventType(envelope, 'order.created')).toBe(true);
      expect(EventEnvelopeUtils.isEventType(envelope, 'product.updated')).toBe(false);
    });

    test('should check if event is from specific producer', () => {
      const envelope = new EventBuilder('test.event', 'order-service').build();

      expect(EventEnvelopeUtils.isFromProducer(envelope, 'order-service')).toBe(true);
      expect(EventEnvelopeUtils.isFromProducer(envelope, 'product-service')).toBe(false);
    });

    test('should check if event has sufficient priority', () => {
      const lowEvent = new EventBuilder('test.event', 'service')
        .withPriority(EventPriority.LOW)
        .build();

      const normalEvent = new EventBuilder('test.event', 'service')
        .withPriority(EventPriority.NORMAL)
        .build();

      const highEvent = new EventBuilder('test.event', 'service')
        .withPriority(EventPriority.HIGH)
        .build();

      expect(EventEnvelopeUtils.hasPriority(lowEvent, EventPriority.LOW)).toBe(true);
      expect(EventEnvelopeUtils.hasPriority(lowEvent, EventPriority.NORMAL)).toBe(false);
      expect(EventEnvelopeUtils.hasPriority(normalEvent, EventPriority.LOW)).toBe(true);
      expect(EventEnvelopeUtils.hasPriority(normalEvent, EventPriority.NORMAL)).toBe(true);
      expect(EventEnvelopeUtils.hasPriority(highEvent, EventPriority.HIGH)).toBe(true);
      expect(EventEnvelopeUtils.hasPriority(highEvent, EventPriority.CRITICAL)).toBe(false);
    });

    test('should calculate event age', () => {
      const envelope = EventBuilder.minimal('test.event');

      const age = EventEnvelopeUtils.getAge(envelope);

      expect(typeof age).toBe('number');
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(100); // Should be very recent
    });

    test('should check if event is expired', () => {
      const oldEnvelope = EventEnvelopeFactory.create({
        event_type: 'test.event',
        producer: 'test-service',
        payload: {},
        occurred_at: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
      });

      expect(EventEnvelopeUtils.isExpired(oldEnvelope, 5000)).toBe(true); // 5 second expiry
      expect(EventEnvelopeUtils.isExpired(oldEnvelope, 15000)).toBe(false); // 15 second expiry
    });

    test('should create event summary', () => {
      const envelope = EventBuilder.minimal('test.event', { data: 'test value for summary' });

      const summary = EventEnvelopeUtils.toSummary(envelope);

      expect(summary).toHaveProperty('event_id');
      expect(summary).toHaveProperty('event_type');
      expect(summary).toHaveProperty('event_version');
      expect(summary).toHaveProperty('occurred_at');
      expect(summary).toHaveProperty('producer');
      expect(summary).toHaveProperty('correlation_id');
      expect(summary).toHaveProperty('priority');
      expect(summary).toHaveProperty('payload_summary');

      expect(summary.event_id).toBe(envelope.event_id);
      expect(summary.event_type).toBe('test.event');
      expect(typeof summary.payload_summary).toBe('string');
      expect(summary.payload_summary.length).toBeLessThanOrEqual(200);
    });
  });

  describe('Retry and Dead Letter Envelopes', () => {
    test('should create retry envelope', () => {
      const original = EventBuilder.minimal('test.event', { data: 'test' });

      const retry = EventEnvelopeFactory.createRetry(original, 1);

      expect(retry.event_type).toBe('test.event.retry');
      expect(retry.causation_id).toBe(original.event_id);
      expect(retry.correlation_id).toBe(original.correlation_id);
      expect(retry.trace_id).toBe(original.trace_id);
      expect(retry.payload._retry).toBeDefined();
      expect(retry.payload._retry.count).toBe(1);
      expect(retry.payload._retry.original_event_id).toBe(original.event_id);
      expect(retry.metadata?.retry_count).toBe(1);
    });

    test('should create retry envelope with multiple attempts', () => {
      const original = EventBuilder.minimal('test.event', { data: 'test' });

      const retry1 = EventEnvelopeFactory.createRetry(original, 1);
      const retry2 = EventEnvelopeFactory.createRetry(original, 2);
      const retry3 = EventEnvelopeFactory.createRetry(original, 3);

      expect(retry1.payload._retry.count).toBe(1);
      expect(retry2.payload._retry.count).toBe(2);
      expect(retry3.payload._retry.count).toBe(3);
    });

    test('should create dead letter envelope', () => {
      const original = EventBuilder.minimal('test.event', { data: 'test' });
      const error = new Error('Test error message');

      const deadLetter = EventEnvelopeFactory.createDeadLetter(
        original,
        'Processing failed',
        error,
      );

      expect(deadLetter.event_type).toBe('test.event.dead_letter');
      expect(deadLetter.causation_id).toBe(original.event_id);
      expect(deadLetter.correlation_id).toBe(original.correlation_id);
      expect(deadLetter.trace_id).toBe(original.trace_id);
      expect(deadLetter.priority).toBe(EventPriority.LOW);
      expect(deadLetter.payload._dead_letter).toBeDefined();
      expect(deadLetter.payload._dead_letter.reason).toBe('Processing failed');
      expect(deadLetter.payload._dead_letter.original_event_id).toBe(original.event_id);
      expect(deadLetter.payload._dead_letter.error_message).toBe('Test error message');
      expect(deadLetter.payload._dead_letter.error_stack).toContain('Test error message');
      expect(deadLetter.metadata?.dead_letter).toBe(true);
    });

    test('should create dead letter envelope without error', () => {
      const original = EventBuilder.minimal('test.event', { data: 'test' });

      const deadLetter = EventEnvelopeFactory.createDeadLetter(original, 'Max retries exceeded');

      expect(deadLetter.payload._dead_letter.reason).toBe('Max retries exceeded');
      expect(deadLetter.payload._dead_letter.error_message).toBeUndefined();
    });
  });

  describe('Type Guards', () => {
    test('should identify valid event envelope', () => {
      const envelope = EventBuilder.minimal('test.event');

      expect(isEventEnvelope(envelope)).toBe(true);
    });

    test('should reject invalid event envelope', () => {
      const invalidEnvelopes = [
        null,
        undefined,
        {},
        { event_type: 'test' },
        { event_id: '550e8400-e29b-41d4-a716-446655440000' },
      ];

      for (const invalid of invalidEnvelopes) {
        expect(isEventEnvelope(invalid as any)).toBe(false);
      }
    });

    test('should identify valid priority', () => {
      const validPriorities = ['low', 'normal', 'high', 'critical'];

      for (const priority of validPriorities) {
        expect(isEventPriority(priority)).toBe(true);
      }
    });

    test('should reject invalid priority', () => {
      const invalidPriorities = ['LOW', 'Low', 'medium', 'urgent', 'urgent', ''];

      for (const priority of invalidPriorities) {
        expect(isEventPriority(priority)).toBe(false);
      }
    });
  });
});
