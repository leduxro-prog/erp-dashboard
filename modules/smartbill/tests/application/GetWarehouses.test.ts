import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GetWarehousesUseCase,
  ISmartBillApiClientWarehouses,
} from '../../src/application/use-cases/GetWarehouses';

describe('GetWarehousesUseCase', () => {
  let useCase: GetWarehousesUseCase;
  let mockApiClient: jest.Mocked<ISmartBillApiClientWarehouses>;

  beforeEach(() => {
    mockApiClient = {
      getWarehouses: jest.fn(),
    } as jest.Mocked<ISmartBillApiClientWarehouses>;

    useCase = new GetWarehousesUseCase(mockApiClient);
  });

  it('maps SmartBill warehouses to WarehouseInfoDto', async () => {
    mockApiClient.getWarehouses.mockResolvedValue([
      { id: 'w1', name: 'Main Warehouse' },
      { id: 'w2', name: 'Outlet Warehouse' },
    ]);

    const result = await useCase.execute();

    expect(result).toEqual([
      { warehouseId: 'w1', warehouseName: 'Main Warehouse' },
      { warehouseId: 'w2', warehouseName: 'Outlet Warehouse' },
    ]);
    expect(mockApiClient.getWarehouses).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when API has no warehouses', async () => {
    mockApiClient.getWarehouses.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('preserves ordering from SmartBill response', async () => {
    mockApiClient.getWarehouses.mockResolvedValue([
      { id: 'w2', name: 'Beta' },
      { id: 'w1', name: 'Alpha' },
    ]);

    const result = await useCase.execute();

    expect(result.map((w) => w.warehouseId)).toEqual(['w2', 'w1']);
  });

  it('propagates API errors', async () => {
    mockApiClient.getWarehouses.mockRejectedValue(new Error('SmartBill API error'));

    await expect(useCase.execute()).rejects.toThrow('SmartBill API error');
  });
});
