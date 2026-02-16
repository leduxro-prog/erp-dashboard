import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CheckStock } from '../../src/application/use-cases/CheckStock';
import { IInventoryRepository } from '../../src/domain/ports/IInventoryRepository';

describe('CheckStock', () => {
  let useCase: CheckStock;
  let mockRepository: jest.Mocked<IInventoryRepository>;

  beforeEach(() => {
    mockRepository = {
      getStockLevel: jest.fn(),
      getWarehouses: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    useCase = new CheckStock(mockRepository);
  });

  it('should aggregate stock totals across warehouses', async () => {
    mockRepository.getWarehouses.mockResolvedValue([
      {
        id: 'wh-1',
        name: 'Main',
        code: 'MAIN',
        priority: 1,
        is_active: true,
        created_at: new Date(),
      },
      {
        id: 'wh-2',
        name: 'Overflow',
        code: 'OVR',
        priority: 2,
        is_active: true,
        created_at: new Date(),
      },
    ]);

    mockRepository.getStockLevel.mockResolvedValue([
      {
        product_id: 'product-1',
        warehouse_id: 'wh-1',
        quantity: 100,
        reserved_quantity: 20,
        available_quantity: 80,
        minimum_threshold: 30,
        is_low_stock: false,
        last_updated: new Date(),
      },
      {
        product_id: 'product-1',
        warehouse_id: 'wh-2',
        quantity: 50,
        reserved_quantity: 10,
        available_quantity: 40,
        minimum_threshold: 30,
        is_low_stock: false,
        last_updated: new Date(),
      },
    ]);

    const result = await useCase.execute('product-1');

    expect(result.productId).toBe('product-1');
    expect(result.totalAvailable).toBe(120);
    expect(result.totalReserved).toBe(30);
    expect(result.totalQuantity).toBe(150);
    expect(result.isLowStock).toBe(false);
    expect(result.warehouses).toHaveLength(2);
  });

  it('should flag low stock and critical stock correctly', async () => {
    mockRepository.getWarehouses.mockResolvedValue([
      {
        id: 'wh-1',
        name: 'Main',
        code: 'MAIN',
        priority: 1,
        is_active: true,
        created_at: new Date(),
      },
    ]);

    mockRepository.getStockLevel.mockResolvedValue([
      {
        product_id: 'product-1',
        warehouse_id: 'wh-1',
        quantity: 10,
        reserved_quantity: 10,
        available_quantity: 0,
        minimum_threshold: 5,
        is_low_stock: true,
        last_updated: new Date(),
      },
    ]);

    const result = await useCase.execute('product-1');

    expect(result.isLowStock).toBe(true);
    expect(result.isCritical).toBe(true);
  });

  it('should validate product id', async () => {
    await expect(useCase.execute('')).rejects.toThrow('Product id is required');
  });

  it('should execute batch checks', async () => {
    mockRepository.getWarehouses.mockResolvedValue([
      {
        id: 'wh-1',
        name: 'Main',
        code: 'MAIN',
        priority: 1,
        is_active: true,
        created_at: new Date(),
      },
    ]);

    mockRepository.getStockLevel
      .mockResolvedValueOnce([
        {
          product_id: 'product-1',
          warehouse_id: 'wh-1',
          quantity: 10,
          reserved_quantity: 2,
          available_quantity: 8,
          minimum_threshold: 3,
          is_low_stock: false,
          last_updated: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          product_id: 'product-2',
          warehouse_id: 'wh-1',
          quantity: 5,
          reserved_quantity: 5,
          available_quantity: 0,
          minimum_threshold: 1,
          is_low_stock: true,
          last_updated: new Date(),
        },
      ]);

    const result = await useCase.executeBatch(['product-1', 'product-2']);

    expect(result).toHaveLength(2);
    expect(result[0].productId).toBe('product-1');
    expect(result[1].productId).toBe('product-2');
    expect(mockRepository.getStockLevel).toHaveBeenCalledTimes(2);
  });

  it('should validate batch input', async () => {
    await expect(useCase.executeBatch([])).rejects.toThrow('At least one product id is required');
  });
});
