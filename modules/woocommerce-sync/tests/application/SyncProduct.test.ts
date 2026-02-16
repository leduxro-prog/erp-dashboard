import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SyncProduct,
  InternalProduct,
} from '../../src/application/use-cases/SyncProduct';
import { ISyncRepository } from '../../src/domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../src/domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../src/domain/ports/IWooCommerceMapper';
import { ProductSyncMapping } from '../../src/domain/entities/ProductSyncMapping';
import { SyncError } from '../../src/application/errors/woocommerce.errors';

describe('SyncProduct', () => {
  let syncProduct: SyncProduct;
  let mockRepository: jest.Mocked<ISyncRepository>;
  let mockApiClient: jest.Mocked<IWooCommerceClient>;
  let mockMapper: jest.Mocked<IWooCommerceMapper>;
  let mockGetProduct: jest.MockedFunction<
    (productId: string) => Promise<InternalProduct>
  >;

  beforeEach(() => {
    mockRepository = {
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
      saveSyncItem: jest.fn(),
    } as any;

    mockApiClient = {
      getProduct: jest.fn(),
      updateProduct: jest.fn(),
      createProduct: jest.fn(),
      batchUpdateProducts: jest.fn(),
      getOrders: jest.fn(),
      getCategories: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
    } as any;

    mockMapper = {
      toWooCommerceProduct: jest.fn(),
      toWooCommerceStock: jest.fn(),
      toWooCommercePrice: jest.fn(),
      fromWooCommerceOrder: jest.fn(),
    } as any;

    mockGetProduct = jest.fn() as jest.MockedFunction<
      (productId: string) => Promise<InternalProduct>
    >;

    syncProduct = new SyncProduct(
      mockRepository,
      mockApiClient,
      mockMapper,
      mockGetProduct
    );
  });

  it('should sync a new product (create)', async () => {
    const product: InternalProduct = {
      id: 'prod-123',
      name: 'Test Product',
      description: 'Test desc',
      sku: 'TEST-SKU',
      price: 99.99,
      status: 'active' as const,
    };

    mockGetProduct.mockResolvedValue(product);
    mockRepository.getMapping.mockResolvedValue(null);
    mockMapper.toWooCommerceProduct.mockReturnValue({
      name: 'Test Product',
      sku: 'TEST-SKU',
      regular_price: '99.99',
      stock_quantity: 0,
    });
    mockApiClient.createProduct.mockResolvedValue({
      id: 1001,
    } as any);

    const result = await syncProduct.execute('prod-123');

    expect(result.success).toBe(true);
    expect(result.wooCommerceId).toBe(1001);
    expect(result.syncType).toBe('product');
    expect(mockApiClient.createProduct).toHaveBeenCalled();
    expect(mockRepository.createMapping).toHaveBeenCalled();
  });

  it('should sync an existing product (update)', async () => {
    const product: InternalProduct = {
      id: 'prod-123',
      name: 'Test Product',
      description: 'Updated desc',
      sku: 'TEST-SKU',
      price: 99.99,
      status: 'active' as const,
    };

    const mapping = new ProductSyncMapping(
      'map-1',
      'prod-123',
      1001
    );

    mockGetProduct.mockResolvedValue(product);
    mockRepository.getMapping.mockResolvedValue(mapping);
    mockApiClient.updateProduct.mockResolvedValue({
    } as any);
    mockMapper.toWooCommerceProduct.mockReturnValue({
      name: 'Test Product',
      sku: 'TEST-SKU',
      regular_price: '99.99',
      stock_quantity: 0,
    });

    const result = await syncProduct.execute('prod-123');

    expect(result.success).toBe(true);
    expect(result.wooCommerceId).toBe(1001);
    expect(mockApiClient.updateProduct).toHaveBeenCalledWith(
      1001,
      expect.any(Object)
    );
    expect(mockRepository.updateMapping).toHaveBeenCalled();
  });

  it('should handle API errors and record failed sync', async () => {
    const product: InternalProduct = {
      id: 'prod-123',
      name: 'Test Product',
      description: 'Test desc',
      sku: 'TEST-SKU',
      price: 99.99,
      status: 'active' as const,
    };

    mockGetProduct.mockResolvedValue(product);
    mockRepository.getMapping.mockResolvedValue(null);
    mockMapper.toWooCommerceProduct.mockReturnValue({
      name: 'Test Product',
      sku: 'TEST-SKU',
      regular_price: '99.99',
      stock_quantity: 0,
    });
    mockApiClient.createProduct.mockRejectedValue(
      new Error('Network error')
    );

    await expect(syncProduct.execute('prod-123')).rejects.toThrow(SyncError);
    expect(mockRepository.saveSyncItem).toHaveBeenCalled();
  });

  it('should mark mapping as in-sync after successful sync', async () => {
    const product: InternalProduct = {
      id: 'prod-123',
      name: 'Test Product',
      description: 'Test desc',
      sku: 'TEST-SKU',
      price: 99.99,
      status: 'active' as const,
    };

    const mapping = new ProductSyncMapping('map-1', 'prod-123', 1001);
    mapping.markError('Previous error');

    mockGetProduct.mockResolvedValue(product);
    mockRepository.getMapping.mockResolvedValue(mapping);
    mockApiClient.updateProduct.mockResolvedValue({ id: 1001 } as any);
    mockMapper.toWooCommerceProduct.mockReturnValue({
      name: 'Test Product',
      sku: 'TEST-SKU',
      regular_price: '99.99',
      stock_quantity: 0,
    });

    const result = await syncProduct.execute('prod-123');

    expect(result.success).toBe(true);
    const updateCall = mockRepository.updateMapping.mock.calls[0][0];
    expect(updateCall.syncStatus).toBe('in_sync');
    expect(updateCall.errorMessage).toBeUndefined();
  });

  it('should include duration in result', async () => {
    const product: InternalProduct = {
      id: 'prod-123',
      name: 'Test Product',
      description: 'Test desc',
      sku: 'TEST-SKU',
      price: 99.99,
      status: 'active' as const,
    };

    mockGetProduct.mockResolvedValue(product);
    mockRepository.getMapping.mockResolvedValue(null);
    mockMapper.toWooCommerceProduct.mockReturnValue({
      name: 'Test Product',
      sku: 'TEST-SKU',
      regular_price: '99.99',
      stock_quantity: 0,
    });
    mockApiClient.createProduct.mockResolvedValue({ id: 1001 } as any);

    const result = await syncProduct.execute('prod-123');

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });
});
