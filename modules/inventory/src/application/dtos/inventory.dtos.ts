export interface WarehouseStockInfo {
  warehouseId: string;
  warehouseName: string;
  available: number;
  reserved: number;
  total: number;
}

export interface StockCheckResult {
  productId: string;
  totalAvailable: number;
  totalReserved: number;
  totalQuantity: number;
  warehouses: WarehouseStockInfo[];
  isLowStock: boolean;
  isCritical: boolean;
}

export interface ReservationItemDTO {
  productId: string;
  quantity: number;
}

export interface FulfillmentSourceDTO {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  priority: 1 | 2 | 3;
}

export interface ReservationItemResultDTO {
  productId: string;
  requestedQuantity: number;
  sources: FulfillmentSourceDTO[];
  fulfilled: boolean;
  shortfall: number;
}

export interface ReservationResultDTO {
  reservationId: string;
  orderId: string;
  items: ReservationItemResultDTO[];
  allFulfilled: boolean;
  shortfallItems: ReservationItemResultDTO[];
  createdAt: Date;
  expiresAt: Date;
}

export interface AdjustStockDTO {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason: string;
  userId: string;
}

export interface SyncResultDTO {
  syncId: string;
  status: 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsUpdated: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}
