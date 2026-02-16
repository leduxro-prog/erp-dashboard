import { describe, it, expect } from '@jest/globals';
import { SyncItem } from '../../src/domain/entities/SyncItem';

describe('SyncItem', () => {
  it('should create a SyncItem with initial pending status', () => {
    const item = new SyncItem('test-id', 'prod-123', 'price', { price: 99 });

    expect(item.id).toBe('test-id');
    expect(item.productId).toBe('prod-123');
    expect(item.syncType).toBe('price');
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(item.maxAttempts).toBe(3);
    expect(item.createdAt).toBeDefined();
  });

  it('should mark item as syncing', () => {
    const item = new SyncItem('test-id', 'prod-123', 'price', { price: 99 });

    item.markSyncing();

    expect(item.status).toBe('syncing');
    expect(item.lastAttempt).toBeDefined();
  });

  it('should mark item as completed', () => {
    const item = new SyncItem('test-id', 'prod-123', 'price', { price: 99 });

    item.markCompleted();

    expect(item.status).toBe('completed');
    expect(item.completedAt).toBeDefined();
  });

  it('should mark item as failed with error message', () => {
    const item = new SyncItem('test-id', 'prod-123', 'price', { price: 99 });

    item.markFailed('Network timeout');

    expect(item.status).toBe('failed');
    expect(item.errorMessage).toBe('Network timeout');
    expect(item.attempts).toBe(1);
  });

  it('should be retryable if attempts < maxAttempts', () => {
    const item = new SyncItem('test-id', 'prod-123', 'price', { price: 99 }, 3);

    item.markFailed('Error 1');
    expect(item.canRetry()).toBe(true);

    item.markFailed('Error 2');
    expect(item.canRetry()).toBe(true);

    item.markFailed('Error 3');
    expect(item.canRetry()).toBe(false);
  });

  it('should reset item to pending state', () => {
    const item = new SyncItem('test-id', 'prod-123', 'price', { price: 99 });

    item.markFailed('Error');
    expect(item.status).toBe('failed');
    expect(item.attempts).toBe(1);

    item.reset();

    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(item.errorMessage).toBeUndefined();
  });

  it('should increment attempts', () => {
    const item = new SyncItem('test-id', 'prod-123', 'price', { price: 99 });

    expect(item.attempts).toBe(0);
    item.incrementAttempt();
    expect(item.attempts).toBe(1);
    item.incrementAttempt();
    expect(item.attempts).toBe(2);
  });
});
