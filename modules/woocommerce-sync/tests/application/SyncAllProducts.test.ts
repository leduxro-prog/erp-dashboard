import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SyncAllProducts } from '../../src/application/use-cases/SyncAllProducts';
import { ISyncRepository } from '../../src/domain/repositories/ISyncRepository';
import { IWooCommerceClient } from '../../src/domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../src/domain/ports/IWooCommerceMapper';

describe('SyncAllProducts Use Case', () => {
  let useCase: SyncAllProducts;
  let mockRepository: jest.Mocked<ISyncRepository>;
  let mockWooCommerceClient: jest.Mocked<IWooCommerceClient>;
  let mockMapper: jest.Mocked<IWooCommerceMapper>;
  let mockGetAllProducts: jest.MockedFunction<
    (force?: boolean) => Promise<
      Array<{
        id: string;
        name: string;
        description: string;
        sku: string;
        price: number;
        status: 'active' | 'inactive' | 'draft';
      }>
    >
  >;

  beforeEach(() => {
    mockRepository = {
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

    mockGetAllProducts = jest.fn() as jest.MockedFunction<
      (force?: boolean) => Promise<
        Array<{
          id: string;
          name: string;
          description: string;
          sku: string;
          price: number;
          status: 'active' | 'inactive' | 'draft';
        }>
      >
    >;

    mockMapper.toWooCommerceProduct.mockImplementation((product: any) => ({
      name: product.name,
      sku: product.sku,
      regular_price: product.price.toString(),
      stock_quantity: 0,
    }));

    useCase = new SyncAllProducts(
      mockRepository,
      mockWooCommerceClient,
      mockMapper,
      mockGetAllProducts
    );
  });

  it('syncs all products successfully in one batch', async () => {
    const mockProducts = [
      {
        id: 'p-1',
        sku: 'SKU-001',
        name: 'Product 1',
        description: 'D1',
        price: 100,
        status: 'active' as const,
      },
      {
        id: 'p-2',
        sku: 'SKU-002',
        name: 'Product 2',
        description: 'D2',
        price: 200,
        status: 'active' as const,
      },
    ];

    mockGetAllProducts.mockResolvedValue(mockProducts);
    mockWooCommerceClient.batchUpdateProducts.mockResolvedValue({
      updated: 2,
      failed: 0,
    });

    const result = await useCase.execute();

    expect(mockGetAllProducts).toHaveBeenCalledWith(false);
    expect(mockWooCommerceClient.batchUpdateProducts).toHaveBeenCalledTimes(1);
    expect(mockRepository.saveSyncItem).toHaveBeenCalledTimes(2);
    expect(mockRepository.updateSyncItem).toHaveBeenCalledTimes(2);
    expect(mockRepository.updateBatch).toHaveBeenCalledTimes(1);
    expect(result.totalProducts).toBe(2);
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('records failed items when batch update fails', async () => {
    const mockProducts = [
      {
        id: 'p-1',
        sku: 'SKU-001',
        name: 'Product 1',
        description: 'D1',
        price: 100,
        status: 'active' as const,
      },
      {
        id: 'p-2',
        sku: 'SKU-002',
        name: 'Product 2',
        description: 'D2',
        price: 200,
        status: 'active' as const,
      },
    ];

    mockGetAllProducts.mockResolvedValue(mockProducts);
    mockWooCommerceClient.batchUpdateProducts.mockRejectedValue(
      new Error('Update failed')
    );

    const result = await useCase.execute();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.failedItems).toHaveLength(2);
  });

  it('processes up to configured batch size (100 items)', async () => {
    const mockProducts = Array.from({ length: 100 }, (_, i) => ({
      id: `p-${i + 1}`,
      sku: `SKU-${String(i + 1).padStart(3, '0')}`,
      name: `Product ${i + 1}`,
      description: `D${i + 1}`,
      price: 100 + i,
      status: 'active' as const,
    }));

    const extraProducts = Array.from({ length: 50 }, (_, i) => ({
      id: `p-${101 + i}`,
      sku: `SKU-${101 + i}`,
      name: `Product ${101 + i}`,
      description: `D${101 + i}`,
      price: 201 + i,
      status: 'active' as const,
    }));

    mockGetAllProducts.mockResolvedValue([...mockProducts, ...extraProducts]);
    mockWooCommerceClient.batchUpdateProducts.mockResolvedValue({
      updated: 100,
      failed: 0,
    });

    const result = await useCase.execute();

    expect(mockWooCommerceClient.batchUpdateProducts).toHaveBeenCalledTimes(1);
    expect(result.totalProducts).toBe(100);
    expect(result.synced).toBe(100);
    expect(result.failed).toBe(0);
  });

  it('handles empty product lists without failures', async () => {
    mockGetAllProducts.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(mockWooCommerceClient.batchUpdateProducts).not.toHaveBeenCalled();
    expect(result.totalProducts).toBe(0);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('passes force flag through to getAllProducts', async () => {
    mockGetAllProducts.mockResolvedValue([]);

    await useCase.execute(true);

    expect(mockGetAllProducts).toHaveBeenCalledWith(true);
  });
});
