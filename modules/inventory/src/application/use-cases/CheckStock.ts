import { IInventoryRepository } from '../../domain/ports/IInventoryRepository';
import { StockCheckResult, WarehouseStockInfo } from '../dtos/inventory.dtos';
import { ProductNotFoundError } from '../errors/inventory.errors';

export class CheckStock {
  constructor(private readonly repository: IInventoryRepository) { }

  async execute(productId: string): Promise<StockCheckResult> {
    if (!productId) {
      throw new Error('Product id is required');
    }

    const levels = await this.repository.getStockLevel(productId);
    const warehouses = await this.repository.getWarehouses();
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));

    let totalAvailable = 0;
    let totalReserved = 0;
    let totalQuantity = 0;
    let isLowStock = false;

    const warehouseInfos: WarehouseStockInfo[] = levels.map((level) => {
      totalAvailable += level.available_quantity;
      totalReserved += level.reserved_quantity;
      totalQuantity += level.quantity;

      if (level.is_low_stock) {
        isLowStock = true;
      }

      return {
        warehouseId: level.warehouse_id,
        warehouseName: warehouseMap.get(level.warehouse_id) || level.warehouse_id,
        available: level.available_quantity,
        reserved: level.reserved_quantity,
        total: level.quantity,
      };
    });

    return {
      productId,
      totalAvailable,
      totalReserved,
      totalQuantity,
      warehouses: warehouseInfos,
      isLowStock,
      isCritical: isLowStock && totalAvailable === 0,
    };
  }

  async executeBatch(productIds: string[]): Promise<StockCheckResult[]> {
    if (!productIds || productIds.length === 0) {
      throw new Error('At least one product id is required');
    }

    return Promise.all(productIds.map((id) => this.execute(id)));
  }
}
