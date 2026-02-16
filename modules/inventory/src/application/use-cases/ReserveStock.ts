import { IInventoryRepository } from '../../domain/ports/IInventoryRepository';
import {
  StockFulfillmentService,
} from '../../domain/services';
import { StockReservation } from '../../domain/entities';
import {
  ReservationResultDTO,
  ReservationItemResultDTO,
  ReservationItemDTO,
} from '../dtos/inventory.dtos';
import { ProductNotFoundError } from '../errors/inventory.errors';
import { v4 as uuidv4 } from 'uuid';

export class ReserveStock {
  private readonly fulfillmentService = new StockFulfillmentService();

  constructor(private readonly repository: IInventoryRepository) { }

  async execute(
    orderId: string,
    items: ReservationItemDTO[],
    backorderDaysMax: number = 7
  ): Promise<ReservationResultDTO> {
    if (!orderId || orderId.trim().length === 0) {
      throw new Error('Order id is required');
    }

    if (!items || items.length === 0) {
      throw new Error('At least one item is required');
    }

    const warehouses = await this.repository.getWarehouses();
    const warehouseMap = new Map(
      warehouses.map((w) => [w.id, w.name])
    );

    const reservationItemResults: ReservationItemResultDTO[] = [];
    const shortfallItems: ReservationItemResultDTO[] = [];
    const reservationItems: { product_id: string; quantity: number; warehouse_id: string }[] = [];

    for (const item of items) {
      const stockLevels = await this.repository.getStockLevel(item.productId);

      if (stockLevels.length === 0) {
        throw new ProductNotFoundError(item.productId);
      }

      const stockItemData = stockLevels.map(level => ({
        warehouse_id: level.warehouse_id,
        available_quantity: level.available_quantity,
      }));

      const plan = this.fulfillmentService.fulfillOrder(
        item.productId,
        item.quantity,
        warehouses.map(w => ({
          id: w.id,
          name: w.name,
          priority: w.priority,
        })),
        stockItemData
      );

      const itemResult: ReservationItemResultDTO = {
        productId: item.productId,
        requestedQuantity: item.quantity,
        sources: plan.allocations.map(a => ({
          warehouseId: a.warehouse_id,
          warehouseName: warehouseMap.get(a.warehouse_id) || 'Unknown',
          quantity: a.quantity,
          priority: 1,
        })),
        fulfilled: plan.fulfilled,
        shortfall: plan.shortfall,
      };

      reservationItemResults.push(itemResult);

      if (!plan.fulfilled) {
        shortfallItems.push(itemResult);
      }

      for (const source of itemResult.sources) {
        reservationItems.push({
          product_id: item.productId,
          warehouse_id: source.warehouseId,
          quantity: source.quantity,
        });
      }
    }

    const allFulfilled = shortfallItems.length === 0;

    let createdAt = new Date();
    let expiresAt = new Date();
    expiresAt.setDate(createdAt.getDate() + backorderDaysMax);
    let reservationId = uuidv4();

    if (reservationItems.length > 0) {
      const createdReservation = await this.repository.createReservation(
        orderId,
        reservationItems,
        expiresAt
      );
      reservationId = createdReservation.id;
      createdAt = createdReservation.created_at;
      expiresAt = createdReservation.expires_at;
    }

    return {
      reservationId,
      orderId,
      items: reservationItemResults,
      allFulfilled,
      shortfallItems,
      createdAt,
      expiresAt,
    };
  }
}
