import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ReserveStock } from '../../src/application/use-cases/ReserveStock';
import {
  IInventoryRepository,
  StockReservation,
  Warehouse,
} from '../../src/domain/ports/IInventoryRepository';
import { ProductNotFoundError } from '../../src/application/errors/inventory.errors';

describe('ReserveStock Use Case', () => {
  let useCase: ReserveStock;
  let mockRepository: jest.Mocked<IInventoryRepository>;

  const warehouses: Warehouse[] = [
    {
      id: 'wh-1',
      name: 'Main warehouse',
      code: 'MAIN',
      priority: 1,
      is_active: true,
      created_at: new Date(),
    },
    {
      id: 'wh-2',
      name: 'Secondary warehouse',
      code: 'SEC',
      priority: 2,
      is_active: true,
      created_at: new Date(),
    },
  ];

  const reservationEntity: StockReservation = {
    id: 'res-1',
    order_id: 'order-1',
    items: [
      {
        product_id: 'product-1',
        warehouse_id: 'wh-1',
        quantity: 5,
      },
    ],
    status: 'active',
    expires_at: new Date('2026-12-10T00:00:00.000Z'),
    created_at: new Date('2026-12-03T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockRepository = {
      createReservation: jest.fn(),
      getStockLevel: jest.fn(),
      getWarehouses: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    useCase = new ReserveStock(mockRepository);
  });

  it('should reserve stock successfully', async () => {
    mockRepository.getWarehouses.mockResolvedValue(warehouses);
    mockRepository.getStockLevel.mockResolvedValue([
      {
        product_id: 'product-1',
        warehouse_id: 'wh-1',
        quantity: 10,
        reserved_quantity: 0,
        available_quantity: 10,
        minimum_threshold: 1,
        is_low_stock: false,
        last_updated: new Date(),
      },
    ]);
    mockRepository.createReservation.mockResolvedValue(reservationEntity);

    const result = await useCase.execute('order-1', [{ productId: 'product-1', quantity: 5 }]);

    expect(result.orderId).toBe('order-1');
    expect(result.allFulfilled).toBe(true);
    expect(mockRepository.createReservation).toHaveBeenCalledWith(
      'order-1',
      [
        {
          product_id: 'product-1',
          warehouse_id: 'wh-1',
          quantity: 5,
        },
      ],
      expect.any(Date)
    );
  });

  it('should throw ProductNotFoundError when product has no stock levels', async () => {
    mockRepository.getWarehouses.mockResolvedValue(warehouses);
    mockRepository.getStockLevel.mockResolvedValue([]);

    await expect(
      useCase.execute('order-1', [{ productId: 'product-missing', quantity: 1 }])
    ).rejects.toThrow(ProductNotFoundError);
  });

  it('should throw error when order id is invalid', async () => {
    await expect(
      useCase.execute('', [{ productId: 'product-1', quantity: 1 }])
    ).rejects.toThrow('Order id is required');
  });

  it('should throw error when items list is empty', async () => {
    await expect(useCase.execute('order-1', [])).rejects.toThrow('At least one item is required');
  });

  it('should return partial fulfillment when stock is insufficient', async () => {
    mockRepository.getWarehouses.mockResolvedValue(warehouses);
    mockRepository.getStockLevel.mockResolvedValue([
      {
        product_id: 'product-1',
        warehouse_id: 'wh-1',
        quantity: 2,
        reserved_quantity: 0,
        available_quantity: 2,
        minimum_threshold: 1,
        is_low_stock: false,
        last_updated: new Date(),
      },
    ]);
    mockRepository.createReservation.mockResolvedValue({
      ...reservationEntity,
      items: [
        {
          product_id: 'product-1',
          warehouse_id: 'wh-1',
          quantity: 2,
        },
      ],
    });

    const result = await useCase.execute('order-1', [{ productId: 'product-1', quantity: 5 }]);

    expect(result.allFulfilled).toBe(false);
    expect(result.shortfallItems).toHaveLength(1);
    expect(result.shortfallItems[0].shortfall).toBe(3);
  });
});
