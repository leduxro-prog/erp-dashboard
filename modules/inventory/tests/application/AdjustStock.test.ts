import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AdjustStock, EventBus } from '../../src/application/use-cases/AdjustStock';
import { IInventoryRepository } from '../../src/domain/ports/IInventoryRepository';

describe('AdjustStock Use Case', () => {
  let useCase: AdjustStock;
  let mockRepository: jest.Mocked<IInventoryRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockRepository = {
      adjustStock: jest.fn(),
      getStockLevel: jest.fn(),
      getWarehouses: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    mockEventBus = {
      publish: jest.fn(async () => undefined),
    } as jest.Mocked<EventBus>;

    useCase = new AdjustStock(mockRepository, mockEventBus);
  });

  it('should delegate stock adjustment to repository', async () => {
    mockRepository.adjustStock.mockResolvedValue(undefined);
    mockRepository.getStockLevel.mockResolvedValue([
      {
        product_id: 'product-1',
        warehouse_id: 'wh-1',
        quantity: 110,
        reserved_quantity: 10,
        available_quantity: 100,
        minimum_threshold: 5,
        is_low_stock: false,
        last_updated: new Date(),
      },
    ]);
    mockRepository.getWarehouses.mockResolvedValue([
      {
        id: 'wh-1',
        name: 'Warehouse 1',
        code: 'WH1',
        priority: 1,
        is_active: true,
        created_at: new Date(),
      },
    ]);

    await useCase.execute('product-1', 'wh-1', 10, 'Inventory correction', 'user-1');

    expect(mockRepository.adjustStock).toHaveBeenCalledWith(
      'product-1',
      'wh-1',
      10,
      'Inventory correction',
      'user-1'
    );
  });

  it('should validate required fields', async () => {
    await expect(useCase.execute('', 'wh-1', 1, 'reason', 'user-1')).rejects.toThrow(
      'Product id is required'
    );
    await expect(useCase.execute('product-1', '', 1, 'reason', 'user-1')).rejects.toThrow(
      'Warehouse id is required'
    );
    await expect(useCase.execute('product-1', 'wh-1', 1, '', 'user-1')).rejects.toThrow(
      'Reason is required'
    );
    await expect(useCase.execute('product-1', 'wh-1', 1, 'reason', '')).rejects.toThrow(
      'User id is required'
    );
  });

  it('should publish stock_changed event when event bus exists', async () => {
    mockRepository.adjustStock.mockResolvedValue(undefined);
    mockRepository.getStockLevel.mockResolvedValue([
      {
        product_id: 'product-1',
        warehouse_id: 'wh-1',
        quantity: 25,
        reserved_quantity: 0,
        available_quantity: 25,
        minimum_threshold: 10,
        is_low_stock: false,
        last_updated: new Date(),
      },
    ]);
    mockRepository.getWarehouses.mockResolvedValue([
      {
        id: 'wh-1',
        name: 'Warehouse 1',
        code: 'WH1',
        priority: 1,
        is_active: true,
        created_at: new Date(),
      },
    ]);

    await useCase.execute('product-1', 'wh-1', 5, 'Manual adjustment', 'manager-1');

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'inventory.stock_changed',
      expect.objectContaining({
        productId: 'product-1',
        warehouseId: 'wh-1',
        warehouseName: 'Warehouse 1',
        previousQuantity: 20,
        newQuantity: 25,
        quantity: 5,
        reason: 'Manual adjustment',
      })
    );
  });

  it('should not publish when adjusted warehouse level is missing', async () => {
    mockRepository.adjustStock.mockResolvedValue(undefined);
    mockRepository.getStockLevel.mockResolvedValue([]);

    await useCase.execute('product-1', 'wh-1', 5, 'Manual adjustment', 'manager-1');

    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should work without event bus', async () => {
    const noEventBusUseCase = new AdjustStock(mockRepository);
    mockRepository.adjustStock.mockResolvedValue(undefined);

    await noEventBusUseCase.execute('product-1', 'wh-1', -3, 'Correction', 'user-1');

    expect(mockRepository.adjustStock).toHaveBeenCalledWith(
      'product-1',
      'wh-1',
      -3,
      'Correction',
      'user-1'
    );
  });
});
