import { SyncStockUseCase, ISmartBillApiClientStock, IEventBusStock } from '../../src/application/use-cases/SyncStock';
import { ISmartBillRepository } from '../../src/domain/repositories/ISmartBillRepository';
import { SmartBillStock } from '../../src/domain/entities/SmartBillStock';
import { StockSyncError } from '../../src/application/errors/smartbill.errors';

describe('SyncStockUseCase', () => {
  let useCase: SyncStockUseCase;
  let mockRepository: jest.Mocked<ISmartBillRepository>;
  let mockApiClient: jest.Mocked<ISmartBillApiClientStock>;
  let mockEventBus: jest.Mocked<IEventBusStock>;

  beforeEach(() => {
    mockRepository = {
      saveInvoice: jest.fn(),
      getInvoice: jest.fn(),
      getInvoiceByOrderId: jest.fn(),
      getInvoicesByStatus: jest.fn(),
      updateInvoice: jest.fn(),
      saveProforma: jest.fn(),
      getProforma: jest.fn(),
      getProformaByOrderId: jest.fn(),
      getProformasByStatus: jest.fn(),
      updateProforma: jest.fn(),
      saveStockSync: jest.fn(),
      getLastSyncTime: jest.fn(),
      getStockSyncHistory: jest.fn(),
      getStockByProductSku: jest.fn().mockResolvedValue([]),
    } as any;

    mockApiClient = {
      getWarehouses: jest.fn(),
      getStock: jest.fn(),
      getStocks: jest.fn(),
    } as any;

    mockEventBus = {
      publish: jest.fn(),
    } as any;

    useCase = new SyncStockUseCase(mockRepository, mockApiClient, mockEventBus);
  });

  test('should sync stock successfully', async () => {
    mockApiClient.getStocks.mockResolvedValue([
      {
        warehouseName: 'Warehouse 1',
        products: [
          { sku: 'SKU001', name: 'Product 1', quantity: 10, price: 100 },
          { sku: 'SKU002', name: 'Product 2', quantity: 5, price: 80 },
        ],
      },
      {
        warehouseName: 'Warehouse 2',
        products: [
          { sku: 'SKU001', name: 'Product 1', quantity: 8, price: 100 },
          { sku: 'SKU003', name: 'Product 3', quantity: 20, price: 150 },
        ],
      },
    ]);
    mockRepository.getStockByProductSku.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.syncedAt).toBeDefined();
    expect(result.totalItems).toBe(4);
    expect(result.warehouses).toContain('Warehouse 1');
    expect(mockRepository.saveStockSync).toHaveBeenCalled();
    expect(mockApiClient.getStocks).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith('stock.synced', expect.any(Object));
  });

  test('should throw error when no stock data found', async () => {
    mockApiClient.getStocks.mockResolvedValue([]);

    await expect(useCase.execute()).rejects.toThrow(StockSyncError);
  });

  test('should detect stock changes', async () => {
    mockApiClient.getStocks.mockResolvedValue([
      {
        warehouseName: 'Warehouse 1',
        products: [
          { sku: 'SKU001', quantity: 15 },
          { sku: 'SKU002', quantity: 2 },
        ],
      },
    ]);

    mockRepository.getStockByProductSku
      .mockResolvedValueOnce([new SmartBillStock('SKU001', 'Warehouse 1', 10, new Date())])
      .mockResolvedValueOnce([new SmartBillStock('SKU002', 'Warehouse 1', 5, new Date())]);

    const result = await useCase.execute();

    expect(result.changedItems).toBe(2);
    expect(result.syncDetails.some((d) => d.difference === 5)).toBe(true);
  });

  test('should identify low stock items', async () => {
    mockApiClient.getStocks.mockResolvedValue([
      {
        warehouseName: 'Warehouse 1',
        products: [{ sku: 'SKU001', quantity: 2 }],
      },
    ]);
    mockRepository.getStockByProductSku.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.lowStockItems).toBe(1);
  });

  test('should identify out of stock items', async () => {
    mockApiClient.getStocks.mockResolvedValue([
      {
        warehouseName: 'Warehouse 1',
        products: [{ sku: 'SKU001', quantity: 0 }],
      },
    ]);
    mockRepository.getStockByProductSku.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.outOfStockItems).toBe(1);
  });
});
