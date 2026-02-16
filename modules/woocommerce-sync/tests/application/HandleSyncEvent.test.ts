import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HandleSyncEvent } from '../../src/application/use-cases/HandleSyncEvent';
import { ISyncRepository } from '../../src/domain/repositories/ISyncRepository';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'sync-item-id'),
}));

describe('HandleSyncEvent Use Case', () => {
  let useCase: HandleSyncEvent;
  let mockSyncRepository: jest.Mocked<ISyncRepository>;
  let mockQueueJob: jest.MockedFunction<
    (jobName: string, data: any) => Promise<void>
  >;

  beforeEach(() => {
    mockSyncRepository = {
      saveSyncItem: jest.fn(),
    } as unknown as jest.Mocked<ISyncRepository>;

    mockQueueJob = jest.fn() as jest.MockedFunction<
      (jobName: string, data: any) => Promise<void>
    >;
    mockQueueJob.mockResolvedValue();

    useCase = new HandleSyncEvent(mockSyncRepository, mockQueueJob);
  });

  it('creates and queues sync item for product.updated event', async () => {
    const event = {
      eventName: 'product.updated',
      productId: 'prod-1',
      payload: { sku: 'TEST-001', price: 100 },
      timestamp: new Date('2024-01-01T10:00:00Z'),
    };

    await useCase.handle(event);

    expect(mockSyncRepository.saveSyncItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sync-item-id',
        productId: 'prod-1',
        syncType: 'product',
        payload: { sku: 'TEST-001', price: 100 },
      })
    );
    expect(mockQueueJob).toHaveBeenCalledWith('sync_product', {
      syncItemId: 'sync-item-id',
      productId: 'prod-1',
      syncType: 'product',
    });
  });

  it('maps stock-related events to stock sync type', async () => {
    const event = {
      eventName: 'inventory.stock_changed',
      productId: 'prod-22',
      payload: { quantity: 50, warehouse: 'main' },
      timestamp: new Date('2024-01-01T10:00:00Z'),
    };

    await useCase.handle(event);

    expect(mockQueueJob).toHaveBeenCalledWith('sync_stock', {
      syncItemId: 'sync-item-id',
      productId: 'prod-22',
      syncType: 'stock',
    });
  });

  it('ignores unknown event names', async () => {
    const event = {
      eventName: 'unknown.event',
      productId: 'prod-1',
      payload: { anything: true },
      timestamp: new Date('2024-01-01T10:00:00Z'),
    };

    await useCase.handle(event);

    expect(mockSyncRepository.saveSyncItem).not.toHaveBeenCalled();
    expect(mockQueueJob).not.toHaveBeenCalled();
  });

  it('propagates repository errors and does not queue job', async () => {
    const event = {
      eventName: 'product.updated',
      productId: 'prod-1',
      payload: { price: 150 },
      timestamp: new Date('2024-01-01T10:00:00Z'),
    };

    mockSyncRepository.saveSyncItem.mockRejectedValue(new Error('DB error'));

    await expect(useCase.handle(event)).rejects.toThrow('DB error');
    expect(mockQueueJob).not.toHaveBeenCalled();
  });
});
