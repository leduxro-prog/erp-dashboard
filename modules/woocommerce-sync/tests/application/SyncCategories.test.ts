import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SyncCategories, InternalCategory } from '../../src/application/use-cases/SyncCategories';
import { SyncError } from '../../src/application/errors/woocommerce.errors';
import { ISyncRepository } from '../../src/domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../src/domain/ports/IWooCommerceClient';

describe('SyncCategories Use Case', () => {
  let useCase: SyncCategories;
  let mockSyncRepository: jest.Mocked<ISyncRepository>;
  let mockWooCommerceClient: jest.Mocked<IWooCommerceClient>;
  let mockGetCategories: jest.MockedFunction<() => Promise<InternalCategory[]>>;

  beforeEach(() => {
    mockSyncRepository = {
      saveSyncItem: jest.fn(),
      getSyncItem: jest.fn(),
      getPendingItems: jest.fn(),
      getFailedItems: jest.fn(),
      getSyncingItems: jest.fn(),
      getItemsByProductId: jest.fn(),
      getItemsByType: jest.fn(),
      deleteSyncItem: jest.fn(),
      updateSyncItem: jest.fn(),
      saveBatch: jest.fn(),
      getBatch: jest.fn(),
      updateBatch: jest.fn(),
      getRecentBatches: jest.fn(),
      getMapping: jest.fn(),
      getMappingByWooId: jest.fn(),
      createMapping: jest.fn(),
      updateMapping: jest.fn(),
      deleteMapping: jest.fn(),
      getAllMappings: jest.fn(),
      getMappingsByStatus: jest.fn(),
      getSyncStats: jest.fn(),
      deleteOldSyncItems: jest.fn(),
      deleteOldBatches: jest.fn(),
    } as unknown as jest.Mocked<ISyncRepository>;

    mockWooCommerceClient = {
      getProduct: jest.fn(),
      createProduct: jest.fn(),
      updateProduct: jest.fn(),
      batchUpdateProducts: jest.fn(),
      getOrders: jest.fn(),
      getCategories: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
    } as unknown as jest.Mocked<IWooCommerceClient>;

    mockGetCategories = jest.fn() as jest.MockedFunction<
      () => Promise<InternalCategory[]>
    >;

    useCase = new SyncCategories(
      mockSyncRepository,
      mockWooCommerceClient,
      mockGetCategories
    );
  });

  it('creates categories that do not exist in WooCommerce', async () => {
    mockGetCategories.mockResolvedValue([
      { id: '1', name: 'Electronics', slug: 'electronics' },
      { id: '2', name: 'Clothing', slug: 'clothing' },
    ]);
    mockWooCommerceClient.getCategories.mockResolvedValue([]);
    mockWooCommerceClient.createCategory.mockResolvedValue({ id: 100 });

    const result = await useCase.execute();

    expect(mockWooCommerceClient.createCategory).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.syncType).toBe('category');
    expect(result.message).toContain('2 created, 0 updated');
  });

  it('updates existing categories by name when updateCategory is available', async () => {
    mockGetCategories.mockResolvedValue([
      {
        id: '1',
        name: 'Electronics',
        slug: 'electronics',
        description: 'Updated description',
      },
    ]);
    mockWooCommerceClient.getCategories.mockResolvedValue([
      { id: 10, name: 'Electronics', slug: 'electronics' },
    ]);
    const result = await useCase.execute();

    expect(mockWooCommerceClient.updateCategory).toHaveBeenCalledWith(10, {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Updated description',
    });
    expect(result.message).toContain('0 created, 1 updated');
  });

  it('returns success with zero updates for empty source categories', async () => {
    mockGetCategories.mockResolvedValue([]);
    mockWooCommerceClient.getCategories.mockResolvedValue([
      { id: 1, name: 'Existing', slug: 'existing' },
    ]);

    const result = await useCase.execute();

    expect(mockWooCommerceClient.createCategory).not.toHaveBeenCalled();
    expect(mockWooCommerceClient.updateCategory).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toContain('0 created, 0 updated');
  });

  it('records failed sync item and throws SyncError on API failures', async () => {
    mockGetCategories.mockResolvedValue([
      { id: '1', name: 'Electronics', slug: 'electronics' },
    ]);
    mockWooCommerceClient.getCategories.mockRejectedValue(new Error('API error'));

    await expect(useCase.execute()).rejects.toThrow(SyncError);
    expect(mockSyncRepository.saveSyncItem).toHaveBeenCalledTimes(1);
  });
});
