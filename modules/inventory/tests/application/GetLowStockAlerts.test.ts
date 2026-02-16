import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetLowStockAlerts } from '../../src/application/use-cases/GetLowStockAlerts';
import { IInventoryRepository } from '../../src/domain/repositories';
import { LowStockAlert } from '../../src/domain/entities';

describe('GetLowStockAlerts Use Case', () => {
  let useCase: GetLowStockAlerts;
  let mockRepository: jest.Mocked<IInventoryRepository>;

  beforeEach(() => {
    mockRepository = {
      getAlerts: jest.fn(),
      acknowledgeAlert: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    useCase = new GetLowStockAlerts(mockRepository);
  });

  it('should retrieve all unacknowledged alerts', async () => {
    const mockAlerts = [
      { id: 'alert-1', productId: 1, status: 'pending' },
      { id: 'alert-2', productId: 2, status: 'pending' },
    ];

    mockRepository.getAlerts.mockResolvedValue(mockAlerts as any);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(mockRepository.getAlerts).toHaveBeenCalledWith(undefined);
  });

  it('should retrieve acknowledged alerts when specified', async () => {
    const mockAlerts = [
      { id: 'alert-1', productId: 1, status: 'acknowledged' },
    ];

    mockRepository.getAlerts.mockResolvedValue(mockAlerts as any);

    const result = await useCase.execute(true);

    expect(mockRepository.getAlerts).toHaveBeenCalledWith(true);
  });

  it('should retrieve unacknowledged alerts when false specified', async () => {
    mockRepository.getAlerts.mockResolvedValue([]);

    await useCase.execute(false);

    expect(mockRepository.getAlerts).toHaveBeenCalledWith(false);
  });

  it('should acknowledge alert with valid inputs', async () => {
    await useCase.acknowledgeAlert('alert-1', 'user-123');

    expect(mockRepository.acknowledgeAlert).toHaveBeenCalledWith('alert-1', 'user-123');
  });

  it('should throw error when alert ID is empty', async () => {
    await expect(useCase.acknowledgeAlert('', 'user-123')).rejects.toThrow(
      'Alert id is required'
    );
  });

  it('should throw error when alert ID is whitespace', async () => {
    await expect(useCase.acknowledgeAlert('   ', 'user-123')).rejects.toThrow(
      'Alert id is required'
    );
  });

  it('should throw error when user ID is empty', async () => {
    await expect(useCase.acknowledgeAlert('alert-1', '')).rejects.toThrow(
      'User id is required'
    );
  });

  it('should throw error when user ID is whitespace', async () => {
    await expect(useCase.acknowledgeAlert('alert-1', '   ')).rejects.toThrow(
      'User id is required'
    );
  });

  it('should return multiple alerts', async () => {
    const mockAlerts = Array.from({ length: 5 }, (_, i) => ({
      id: `alert-${i}`,
      productId: i + 1,
      status: 'pending',
    }));

    mockRepository.getAlerts.mockResolvedValue(mockAlerts as any);

    const result = await useCase.execute();

    expect(result).toHaveLength(5);
  });

  it('should handle empty alerts list', async () => {
    mockRepository.getAlerts.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toHaveLength(0);
  });

  it('should acknowledge multiple alerts independently', async () => {
    await useCase.acknowledgeAlert('alert-1', 'user-1');
    await useCase.acknowledgeAlert('alert-2', 'user-2');

    expect(mockRepository.acknowledgeAlert).toHaveBeenCalledTimes(2);
    expect(mockRepository.acknowledgeAlert).toHaveBeenNthCalledWith(1, 'alert-1', 'user-1');
    expect(mockRepository.acknowledgeAlert).toHaveBeenNthCalledWith(2, 'alert-2', 'user-2');
  });
});
