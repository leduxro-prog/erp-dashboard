import { IInventoryRepository } from '../../domain/repositories';
import {
  ReservationNotFoundError,
} from '../errors/inventory.errors';

export class ReleaseStock {
  constructor(private readonly repository: IInventoryRepository) { }

  async execute(reservationId: string): Promise<void> {
    if (!reservationId || reservationId.trim().length === 0) {
      throw new Error('Reservation id is required');
    }

    const reservation = await this.repository.getReservation(reservationId);

    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    // Delegate full release logic to repository
    await this.repository.releaseReservation(reservationId);
  }
}
