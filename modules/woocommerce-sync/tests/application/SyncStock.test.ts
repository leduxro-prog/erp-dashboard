import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SyncStock } from '../../src/application/use-cases/SyncStock';
import { SyncError } from '../../src/application/errors/woocommerce.errors';
import { ISyncRepository } from '../../src/domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../src/domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../src/domain/ports/IWooCommerceMapper';
import { ProductSyncMapping } from '../../src/domain/entities/ProductSyncMapping';

describe('SyncStock Use Case', () => {
  let useCase: SyncStock;
  let mockSyncRepository: jest.Mocked<ISyncRepository>;
  let mockWooCommerceClient: jest.Mocked<IWooCommerceClient>;
  let mockMapper: jest.Mocked<IWooCommerceMapper>;
  let mockGetProductStock: jest.MockedFunction<
    (productId: string) => Promise<number>
  >;

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

    mockMapper = {
      toWooCommerceProduct: jest.fn(),
      toWooCommerceStock: jest.fn(),
      toWooCommercePrice: jest.fn(),
      fromWooCommerceOrder: jest.fn(),
    } as unknown as jest.Mocked<IWooCommerceMapper>;

    mockGetProductStock = jest.fn() as jest.MockedFunction<
      (productId: string) => Promise<number>
    >;

    useCase = new SyncStock(
      mockSyncRepository,
      mockWooCommerceClient,
      mockMapper,
      mockGetProductStock
    );
  });

  it('syncs stock for mapped product', async () => {
    const mapping = new ProductSyncMapping('map-1', 'prod-1', 201);

    mockSyncRepository.getMapping.mockResolvedValue(mapping);
    mockGetProductStock.mockResolvedValue(50);
    mockMapper.toWooCommerceStock.mockReturnValue({ stock_quantity: 50 });
    mockWooCommerceClient.updateProduct.mockResolvedValue();

    const result = await useCase.execute('prod-1');

    expect(mockMapper.toWooCommerceStock).toHaveBeenCalledWith(50);
    expect(mockWooCommerceClient.updateProduct).toHaveBeenCalledWith(201, {
      stock_quantity: 50,
    });
    expect(result.success).toBe(true);
    expect(result.syncType).toBe('stock');
    expect(result.wooCommerceId).toBe(201);
  });

  it('throws SyncError and records failed item when mapping does not exist', async () => {
    mockSyncRepository.getMapping.mockResolvedValue(null);

    await expect(useCase.execute('missing-product')).rejects.toThrow(SyncError);
    expect(mockSyncRepository.saveSyncItem).toHaveBeenCalledTimes(1);
  });

  it('marks mapping as error and records failed item when update fails', async () => {
    const mapping = new ProductSyncMapping('map-1', 'prod-1', 201);

    mockSyncRepository.getMapping.mockResolvedValue(mapping);
    mockGetProductStock.mockResolvedValue(0);
    mockMapper.toWooCommerceStock.mockReturnValue({ stock_quantity: 0 });
    mockWooCommerceClient.updateProduct.mockRejectedValue(new Error('API error'));

    await expect(useCase.execute('prod-1')).rejects.toThrow(SyncError);
    expect(mapping.syncStatus).toBe('error');
    expect(mockSyncRepository.updateMapping).toHaveBeenCalledWith(mapping);
    expect(mockSyncRepository.saveSyncItem).toHaveBeenCalledTimes(1);
  });
});
