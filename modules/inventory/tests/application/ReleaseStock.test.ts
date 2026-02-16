import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReleaseStock } from '../../src/application/use-cases/ReleaseStock';
import { IInventoryRepository } from '../../src/domain/repositories';
import { ReservationNotFoundError } from '../../src/application/errors/inventory.errors';

describe('ReleaseStock Use Case', () => {
  let useCase: ReleaseStock;
  let mockRepository: jest.Mocked<IInventoryRepository>;

  beforeEach(() => {
    mockRepository = {
      releaseReservation: jest.fn(),
      getReservation: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    useCase = new ReleaseStock(mockRepository);
  });

  it('should release stock reservation successfully', async () => {
    const mockReservation = {
      id: 'res-1',
      order_id: 'order-1',
      items: [{ product_id: 'product-1', quantity: 5, warehouse_id: 'wh-1' }],
      status: 'active',
      expires_at: new Date(),
      created_at: new Date(),
    };

    mockRepository.getReservation.mockResolvedValue(mockReservation);

    await useCase.execute('res-1');

    expect(mockRepository.releaseReservation).toHaveBeenCalledWith('res-1');
  });

  it('should throw error when reservation ID is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow('Reservation id is required');
  });

  it('should throw ReservationNotFoundError when reservation does not exist', async () => {
    mockRepository.getReservation.mockResolvedValue(null);

    await expect(useCase.execute('missing-reservation')).rejects.toThrow(ReservationNotFoundError);
    expect(mockRepository.releaseReservation).not.toHaveBeenCalled();
  });
});
