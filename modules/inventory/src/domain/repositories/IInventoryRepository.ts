import { StockItem, StockMovement, LowStockAlert, StockReservation, Warehouse } from '../entities';

export interface IInventoryRepository {
  getStockByProduct(productId: number): Promise<StockItem[]>;

  getStockByWarehouse(warehouseId: string): Promise<StockItem[]>;

  getStockItem(productId: number, warehouseId: string): Promise<StockItem | null>;

  updateStock(item: StockItem): Promise<void>;

  bulkUpdateStock(items: StockItem[]): Promise<void>;

  createMovement(movement: StockMovement): Promise<void>;

  getMovements(
    productId: number,
    from: Date,
    to: Date
  ): Promise<StockMovement[]>;

  getLowStockItems(threshold?: number): Promise<StockItem[]>;

  getAlerts(acknowledged?: boolean): Promise<LowStockAlert[]>;

  createAlert(alert: LowStockAlert): Promise<void>;

  acknowledgeAlert(alertId: string, userId: string): Promise<void>;

  createReservation(reservation: StockReservation): Promise<StockReservation>;

  getReservation(reservationId: string): Promise<StockReservation | null>;

  updateReservation(reservation: StockReservation): Promise<void>;

  getWarehouses(): Promise<Warehouse[]>;
}
