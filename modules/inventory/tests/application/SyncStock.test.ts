import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SmartBillSyncService,
  SupplierSyncService,
  SyncStock,
} from '../../src/application/use-cases/SyncStock';
import { StockSyncError } from '../../src/application/errors/inventory.errors';

describe('SyncStock Use Case', () => {
  let useCase: SyncStock;
  let mockSmartBillService: jest.Mocked<SmartBillSyncService>;
  let mockSupplierService: jest.Mocked<SupplierSyncService>;

  beforeEach(() => {
    mockSmartBillService = {
      sync: jest.fn(),
    };
    mockSupplierService = {
      sync: jest.fn(),
    };

    useCase = new SyncStock(mockSmartBillService, mockSupplierService);
  });

  it('should sync SmartBill stock successfully', async () => {
    mockSmartBillService.sync.mockResolvedValue({
      itemsProcessed: 5,
      itemsUpdated: 3,
      errors: [],
    });

    const result = await useCase.syncSmartBill();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        itemsProcessed: 5,
        itemsUpdated: 3,
        errors: [],
      })
    );
  });

  it('should return partial status when SmartBill has errors', async () => {
    mockSmartBillService.sync.mockResolvedValue({
      itemsProcessed: 3,
      itemsUpdated: 2,
      errors: ['timeout for item-7'],
    });

    const result = await useCase.syncSmartBill();

    expect(result.status).toBe('partial');
    expect(result.errors).toEqual(['timeout for item-7']);
  });

  it('should throw StockSyncError when SmartBill service is missing', async () => {
    const noSmartBill = new SyncStock(undefined, mockSupplierService);

    await expect(noSmartBill.syncSmartBill()).rejects.toThrow(StockSyncError);
    await expect(noSmartBill.syncSmartBill()).rejects.toThrow(
      'SmartBill sync service is not configured'
    );
  });

  it('should wrap supplier sync runtime errors in StockSyncError', async () => {
    mockSupplierService.sync.mockRejectedValue(new Error('supplier endpoint timeout'));

    await expect(useCase.syncSuppliers()).rejects.toThrow(StockSyncError);
    await expect(useCase.syncSuppliers()).rejects.toThrow(
      'Stock sync failed for Supplier: supplier endpoint timeout'
    );
  });

  it('should sync all sources and return combined result', async () => {
    mockSmartBillService.sync.mockResolvedValue({
      itemsProcessed: 10,
      itemsUpdated: 7,
      errors: [],
    });
    mockSupplierService.sync.mockResolvedValue({
      itemsProcessed: 4,
      itemsUpdated: 4,
      errors: [],
    });

    const result = await useCase.syncAll();

    expect(result.smartBill.status).toBe('success');
    expect(result.suppliers.status).toBe('success');
    expect(mockSmartBillService.sync).toHaveBeenCalledTimes(1);
    expect(mockSupplierService.sync).toHaveBeenCalledTimes(1);
  });
});
