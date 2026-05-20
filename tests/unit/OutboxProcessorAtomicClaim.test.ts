import { describe, expect, it, jest } from '@jest/globals';

import { OutboxProcessor } from '../../modules/outbox-relay/src/OutboxProcessor';
import {
  EventDomain,
  EventPriority,
  OutboxEvent,
  OutboxStatus,
} from '../../modules/outbox-relay/src/OutboxRepository';

function createOutboxEvent(): OutboxEvent {
  const now = new Date();

  return {
    id: 'outbox-row-1',
    event_id: 'event-1',
    event_type: 'order.created',
    event_version: 'v1',
    event_domain: EventDomain.Order,
    source_service: 'test-service',
    payload: { orderId: 1 },
    metadata: {},
    content_type: 'application/json',
    priority: EventPriority.Normal,
    publish_to: 'rabbitmq',
    exchange: 'events',
    routing_key: 'order.created',
    status: OutboxStatus.Processing,
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: now,
    occurred_at: now,
    created_at: now,
    version: 1,
    updated_at: now,
  };
}

describe('OutboxProcessor atomic claim policy', () => {
  it('claims pending events atomically before publishing', async () => {
    process.env.NODE_ENV = 'development';

    const event = createOutboxEvent();
    const repository = {
      claimPendingEvents: jest.fn(async (_batchSize: number, _consumerName: string, _maxAttempts: number) => [event]),
      fetchPendingEvents: jest.fn(async (_batchSize: number, _consumerName: string, _maxAttempts: number) => {
        throw new Error('non-atomic fetch should not be used');
      }),
      markEventsProcessing: jest.fn(),
      markEventsPublished: jest.fn(async (_eventIds: string[]) => 1),
      markEventsFailed: jest.fn(),
      recordEventProcessing: jest.fn(),
    };
    const publisher = {
      publish: jest.fn(async () => ({ success: true })),
      isCircuitBreakerOpen: jest.fn().mockReturnValue(false),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const processor = new OutboxProcessor(repository as any, publisher as any, logger as any);

    const result = await processor.processBatch(1);

    expect(repository.claimPendingEvents).toHaveBeenCalledWith(1, expect.any(String), expect.any(Number));
    expect(repository.fetchPendingEvents).not.toHaveBeenCalled();
    expect(repository.markEventsProcessing).not.toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(repository.markEventsPublished).toHaveBeenCalledWith(['outbox-row-1']);
    expect(result.published).toBe(1);
  });
});
