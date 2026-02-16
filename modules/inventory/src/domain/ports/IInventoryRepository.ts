export interface StockLevel {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  minimum_threshold: number;
  is_low_stock: boolean;
  last_updated: Date;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  reference_type?: string;
  reference_id?: string;
  created_at: Date;
}

export interface LowStockAlert {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  warehouse_id: string;
  current_quantity: number;
  minimum_threshold: number;
  severity: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  created_at: Date;
}

export interface StockReservation {
  id: string;
  order_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    warehouse_id: string;
  }>;
  status: string;
  expires_at: Date;
  created_at: Date;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  priority: number;
  is_active: boolean;
  smartbill_id?: string;
  created_at: Date;
}

export interface IInventoryRepository {
  getWarehouses(): Promise<Warehouse[]>;
  getStockLevel(productId: string, warehouseId?: string): Promise<StockLevel[]>;
  getStockLevelBatch(productIds: string[]): Promise<Map<string, StockLevel[]>>;
  recordMovement(
    productId: string,
    warehouseId: string,
    movement: Omit<StockMovement, 'id' | 'created_at'>,
    userId: string,
  ): Promise<StockMovement>;
  getMovementHistory(
    productId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
      warehouseId?: string;
    },
  ): Promise<StockMovement[]>;
  createReservation(
    orderId: string,
    items: Array<{
      product_id: string;
      quantity: number;
      warehouse_id: string;
    }>,
    expiresAt: Date,
  ): Promise<StockReservation>;
  updateReservation(reservation: StockReservation): Promise<void>;
  getReservation(reservationId: string): Promise<StockReservation | null>;
  releaseReservation(reservationId: string): Promise<void>;
  createLowStockAlert(alert: Omit<LowStockAlert, 'id' | 'created_at'>): Promise<LowStockAlert>;
  getLowStockAlerts(filters?: {
    acknowledged?: boolean;
    severity?: string;
  }): Promise<LowStockAlert[]>;
  acknowledgeAlert(alertId: string, userId: string): Promise<void>;
  adjustStock(
    productId: string,
    warehouseId: string,
    quantity: number,
    reason: string,
    userId: string,
  ): Promise<void>;
  getAlerts(resolved: boolean): Promise<LowStockAlert[]>;
  getStockItem(productId: string, warehouseId: string): Promise<any>; // Adding to satisfy existing code if any, though deperecated
}
