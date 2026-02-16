import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetSupplierProducts } from '../../src/application/use-cases/GetSupplierProducts';
import {
  ISupplierRepository,
  SupplierCode,
  type Supplier,
  type SupplierProduct,
} from '../../src/domain';
import { SupplierNotFoundError } from '../../src/application/errors/supplier.errors';
import { GetSupplierProductsOptions } from '../../src/application/dtos/supplier.dtos';

describe('GetSupplierProducts Use Case', () => {
  let useCase: GetSupplierProducts;
  let mockRepository: jest.Mocked<ISupplierRepository>;

  const buildSupplier = (overrides: Partial<Supplier> = {}): Supplier => ({
    id: 1,
    name: 'Supplier 1',
    code: SupplierCode.ACA_LIGHTING,
    website: 'https://supplier.test',
    contactEmail: 'contact@supplier.test',
    contactPhone: '+40111111111',
    whatsappNumber: '+40111111111',
    productCount: 0,
    isActive: true,
    credentials: { username: 'u', password: 'p' },
    syncFrequency: 4,
    lastSync: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  const buildProduct = (
    overrides: Partial<SupplierProduct> = {},
  ): SupplierProduct => ({
    id: 1,
    supplierId: 1,
    supplierSku: 'SKU-001',
    name: 'Product 1',
    price: 100,
    currency: 'USD',
    stockQuantity: 50,
    lastScraped: new Date('2026-01-01T00:00:00Z'),
    priceHistory: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    mockRepository = {
      getSupplier: jest.fn(),
      getSupplierProducts: jest.fn(),
    } as unknown as jest.Mocked<ISupplierRepository>;

    useCase = new GetSupplierProducts(mockRepository);
  });

  it('should retrieve supplier products', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct(),
    ]);

    const result = await useCase.execute(1);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        supplierId: 1,
        supplierSku: 'SKU-001',
        name: 'Product 1',
        priceHistory: [],
      }),
    );
  });

  it('should throw SupplierNotFoundError when supplier does not exist', async () => {
    mockRepository.getSupplier.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(SupplierNotFoundError);
  });

  it('should filter products by search term', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001' }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 200, stockQuantity: 30 }),
    ]);

    const options: GetSupplierProductsOptions = { search: 'product a' };
    const result = await useCase.execute(1, options);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Product A');
  });

  it('should filter products by minimum stock', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001', stockQuantity: 50 }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 200, stockQuantity: 5 }),
    ]);

    const options: GetSupplierProductsOptions = { minStock: 10 };
    const result = await useCase.execute(1, options);

    expect(result).toHaveLength(1);
    expect(result[0].stockQuantity).toBe(50);
  });

  it('should filter products by price range', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001', price: 50 }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 150, stockQuantity: 30 }),
      buildProduct({ id: 3, name: 'Product C', supplierSku: 'SKU-003', price: 250, stockQuantity: 20 }),
    ]);

    const options: GetSupplierProductsOptions = { minPrice: 100, maxPrice: 200 };
    const result = await useCase.execute(1, options);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Product B');
  });

  it('should apply pagination', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) =>
        buildProduct({
          id: i + 1,
          name: `Product ${i + 1}`,
          supplierSku: `SKU-${String(i + 1).padStart(3, '0')}`,
          price: 100 + i,
        }),
      ),
    );

    const options: GetSupplierProductsOptions = { page: 2, limit: 10 };
    const result = await useCase.execute(1, options);

    expect(result).toHaveLength(10);
    expect(result[0].id).toBe(11);
  });

  it('should enforce maximum limit of 200', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue(
      Array.from({ length: 300 }, (_, i) =>
        buildProduct({
          id: i + 1,
          name: `Product ${i + 1}`,
          supplierSku: `SKU-${String(i + 1).padStart(3, '0')}`,
        }),
      ),
    );

    const options: GetSupplierProductsOptions = { page: 1, limit: 500 };
    const result = await useCase.execute(1, options);

    expect(result.length).toBeLessThanOrEqual(200);
  });

  it('should get products in stock', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001', stockQuantity: 50 }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 200, stockQuantity: 0 }),
    ]);

    const result = await useCase.getByStock(1, true);

    expect(result).toHaveLength(1);
    expect(result[0].stockQuantity).toBeGreaterThan(0);
  });

  it('should get out of stock products', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001', stockQuantity: 50 }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 200, stockQuantity: 0 }),
    ]);

    const result = await useCase.getByStock(1, false);

    expect(result).toHaveLength(1);
    expect(result[0].stockQuantity).toBe(0);
  });

  it('should get low stock products', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001', stockQuantity: 5 }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 200, stockQuantity: 20 }),
    ]);

    const result = await useCase.getLowStock(1, 10);

    expect(result).toHaveLength(1);
    expect(result[0].stockQuantity).toBeLessThanOrEqual(10);
  });

  it('should get price range', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001', price: 50 }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 500, stockQuantity: 20 }),
    ]);

    const result = await useCase.getPriceRange(1);

    expect(result.minPrice).toBe(50);
    expect(result.maxPrice).toBe(500);
  });

  it('should get statistics for supplier', async () => {
    mockRepository.getSupplier.mockResolvedValue(buildSupplier());
    mockRepository.getSupplierProducts.mockResolvedValue([
      buildProduct({ id: 1, name: 'Product A', supplierSku: 'SKU-001', price: 100, stockQuantity: 50 }),
      buildProduct({ id: 2, name: 'Product B', supplierSku: 'SKU-002', price: 200, stockQuantity: 0 }),
    ]);

    const result = await useCase.getStatistics(1);

    expect(result.totalProducts).toBe(2);
    expect(result.inStock).toBe(1);
    expect(result.outOfStock).toBe(1);
  });
});
