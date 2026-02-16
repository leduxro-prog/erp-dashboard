import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SyncPrice, PriceInfo } from '../../src/application/use-cases/SyncPrice';
import { SyncError } from '../../src/application/errors/woocommerce.errors';
import { ISyncRepository } from '../../src/domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../src/domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../src/domain/ports/IWooCommerceMapper';
import { ProductSyncMapping } from '../../src/domain/entities/ProductSyncMapping';

describe('SyncPrice Use Case', () => {
  let useCase: SyncPrice;
  let mockSyncRepository: jest.Mocked<ISyncRepository>;
  let mockWooCommerceClient: jest.Mocked<IWooCommerceClient>;
  let mockMapper: jest.Mocked<IWooCommerceMapper>;
  let mockGetProductPrice: jest.MockedFunction<
    (productId: string) => Promise<PriceInfo>
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

    mockGetProductPrice = jest.fn() as jest.MockedFunction<
      (productId: string) => Promise<PriceInfo>
    >;

    useCase = new SyncPrice(
      mockSyncRepository,
      mockWooCommerceClient,
      mockMapper,
      mockGetProductPrice
    );
  });

  it('syncs mapped product price to WooCommerce', async () => {
    const mapping = new ProductSyncMapping('map-1', 'prod-1', 101);
    const saleStart = new Date('2026-01-01T00:00:00.000Z');
    const saleEnd = new Date('2026-01-10T00:00:00.000Z');

    mockSyncRepository.getMapping.mockResolvedValue(mapping);
    mockGetProductPrice.mockResolvedValue({
      price: 150,
      salePrice: 120,
      salePriceStartDate: saleStart,
      salePriceEndDate: saleEnd,
    });
    mockMapper.toWooCommercePrice.mockReturnValue({ regular_price: '150' });
    mockWooCommerceClient.updateProduct.mockResolvedValue();

    const result = await useCase.execute('prod-1');

    expect(mockMapper.toWooCommercePrice).toHaveBeenCalledWith(
      150,
      120,
      saleStart,
      saleEnd
    );
    expect(mockWooCommerceClient.updateProduct).toHaveBeenCalledWith(101, {
      regular_price: '150',
    });
    expect(mockSyncRepository.updateMapping).toHaveBeenCalledWith(mapping);
    expect(result.success).toBe(true);
    expect(result.syncType).toBe('price');
    expect(result.wooCommerceId).toBe(101);
  });

  it('throws SyncError and records failed sync when mapping is missing', async () => {
    mockSyncRepository.getMapping.mockResolvedValue(null);

    await expect(useCase.execute('missing-product')).rejects.toThrow(SyncError);
    expect(mockSyncRepository.saveSyncItem).toHaveBeenCalledTimes(1);
  });

  it('marks mapping as error when WooCommerce update fails', async () => {
    const mapping = new ProductSyncMapping('map-1', 'prod-1', 101);

    mockSyncRepository.getMapping.mockResolvedValue(mapping);
    mockGetProductPrice.mockResolvedValue({ price: 200 });
    mockMapper.toWooCommercePrice.mockReturnValue({ regular_price: '200' });
    mockWooCommerceClient.updateProduct.mockRejectedValue(new Error('API down'));

    await expect(useCase.execute('prod-1')).rejects.toThrow(SyncError);
    expect(mockSyncRepository.updateMapping).toHaveBeenCalledWith(mapping);
    expect(mapping.syncStatus).toBe('error');
    expect(mockSyncRepository.saveSyncItem).toHaveBeenCalledTimes(1);
  });
});
