/**
 * Inventory Data Port (Inbound Adapter Interface)
 *
 * Hexagonal architecture port for fetching inventory data from the Inventory module.
 * Allows analytics to compute inventory metrics without direct module dependency.
 *
 * @interface IInventoryDataPort
 */
export interface IInventoryDataPort {
  /**
   * Get current inventory metrics
   * Fetches real-time or current inventory status
   *
   * @returns Promise resolving to inventory metrics
   * @throws Error if inventory module unavailable or fetch fails
   */
  getInventoryMetrics(): Promise<InventoryMetrics>;
}

/**
 * Inventory metrics data structure
 */
export interface InventoryMetrics {
  /** Total number of SKUs in inventory */
  totalSKUs: number;

  /** Total inventory value (cost) */
  totalValue: number;

  /** Number of items with stock below minimum threshold */
  lowStockCount: number;

  /** Stock levels by product category */
  stockByCategory: Array<{
    category: string;
    itemCount: number;
    value: number;
    lastUpdated: Date;
  }>;

  /** Products with critical low stock */
  criticalStock: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    minimumStock: number;
    reorderPoint: number;
  }>;

  /** Stock movement in past period */
  stockMovement: Array<{
    productId: string;
    periodStart: Date;
    periodEnd: Date;
    unitsSold: number;
    unitsReceived: number;
    netChange: number;
  }>;

  /** Inventory turnover by category */
  turnoverByCategory: Array<{
    category: string;
    turnoverRatio: number;
    daysOfInventory: number;
  }>;

  /** Warehouse location occupancy */
  warehouseOccupancy: Array<{
    location: string;
    usedCapacity: number;
    totalCapacity: number;
    occupancyPercent: number;
  }>;
}
