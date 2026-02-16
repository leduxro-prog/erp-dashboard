import { IInventoryRepository } from '../../domain/ports/IInventoryRepository';
import { WarehouseNotFoundError } from '../errors/inventory.errors';

export interface EventBus {
  publish(event: string, data: any): Promise<void>;
}

export class AdjustStock {
  constructor(
    private readonly repository: IInventoryRepository,
    private readonly eventBus?: EventBus
  ) { }

  async execute(
    productId: string,
    warehouseId: string,
    quantity: number,
    reason: string,
    userId: string
  ): Promise<void> {
    if (!productId) {
      throw new Error('Product id is required');
    }

    if (!warehouseId || warehouseId.trim().length === 0) {
      throw new Error('Warehouse id is required');
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Reason is required');
    }

    if (!userId || userId.trim().length === 0) {
      throw new Error('User id is required');
    }

    // Delegate to repository which handles transaction, validation, and recording
    await this.repository.adjustStock(
      productId,
      warehouseId,
      quantity,
      reason,
      userId
    );

    if (this.eventBus) {
      // Fetch updated state for event
      const levels = await this.repository.getStockLevel(productId, warehouseId);
      const level = levels.find(l => l.warehouse_id === warehouseId);

      if (level) {
        const warehouse = (await this.repository.getWarehouses()).find(w => w.id === warehouseId);

        await this.eventBus.publish('inventory.stock_changed', {
          productId,
          warehouseId,
          warehouseName: warehouse ? warehouse.name : 'Unknown',
          previousQuantity: level.quantity - quantity, // Approximate
          newQuantity: level.quantity,
          quantity,
          reason,
          isLowStock: level.is_low_stock,
          isCritical: level.available_quantity <= 0,
          timestamp: new Date(),
        });
      }
    }
  }
}
