import { StockInfo, StockMovement, LowStockAlert } from '../types';

/**
 * Item to reserve from stock
 */
export interface ReserveStockItem {
  productId: number;
  quantity: number;
  warehouseId?: string;
}

/**
 * Result of stock reservation operation
 */
export interface ReservationResult {
  reservationId: string;
  orderId: number;
  items: {
    productId: number;
    quantity: number;
    reserved: number;
    status: 'success' | 'partial' | 'failed';
  }[];
  totalReserved: number;
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Result of stock synchronization
 */
export interface SyncResult {
  source: 'smartbill' | 'supplier';
  sourceId?: string | number;
  timestamp: Date;
  itemsSynced: number;
  itemsUpdated: number;
  itemsAdded: number;
  errors: {
    productId: number;
    error: string;
  }[];
  status: 'success' | 'partial' | 'failed';
}

/**
 * Inventory service interface for managing stock and reservations
 */
export interface IInventoryService {
  /**
   * Check stock availability for a single product
   * @param productId - Product ID to check
   * @returns Stock information
   */
  checkStock(productId: number): Promise<StockInfo>;

  /**
   * Check stock availability for multiple products
   * @param productIds - Array of product IDs
   * @returns Array of stock information
   */
  checkMultipleStock(productIds: number[]): Promise<StockInfo[]>;

  /**
   * Reserve stock for an order
   * @param orderId - Order ID for reservation
   * @param items - Items to reserve
   * @returns Reservation result with confirmation details
   */
  reserveStock(
    orderId: number,
    items: ReserveStockItem[],
  ): Promise<ReservationResult>;

  /**
   * Release previously reserved stock
   * @param reservationId - Reservation ID to release
   */
  releaseStock(reservationId: string): Promise<void>;

  /**
   * Get stock movement history for a product
   * @param productId - Product ID
   * @param from - Start date
   * @param to - End date
   * @returns Array of stock movements
   */
  getStockMovements(
    productId: number,
    from: Date,
    to: Date,
  ): Promise<StockMovement[]>;

  /**
   * Get all products with low stock levels
   * @returns Array of low stock alerts
   */
  getLowStockAlerts(): Promise<LowStockAlert[]>;

  /**
   * Synchronize stock with SmartBill system
   * @returns Synchronization result
   */
  syncSmartBillStock(): Promise<SyncResult>;

  /**
   * Synchronize stock with supplier
   * @param supplierId - Supplier ID
   * @returns Synchronization result
   */
  syncSupplierStock(supplierId: number): Promise<SyncResult>;
}
