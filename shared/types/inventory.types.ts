/**
 * Inventory and warehouse management types
 */

import { BaseEntity, Currency } from './common.types';

/**
 * Stock movement types
 */
export const StockMovementTypeEnum = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
  DAMAGE: 'DAMAGE',
  LOSS: 'LOSS',
  RETURN_SUPPLIER: 'RETURN_SUPPLIER',
} as const;

export type StockMovementType = typeof StockMovementTypeEnum[keyof typeof StockMovementTypeEnum];

/**
 * Stock source/origin
 */
export const StockSourceEnum = {
  SUPPLIER: 'SUPPLIER',
  INTERNAL: 'INTERNAL',
  CUSTOMER_RETURN: 'CUSTOMER_RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type StockSource = typeof StockSourceEnum[keyof typeof StockSourceEnum];

/**
 * Warehouse entity
 */
export interface Warehouse extends BaseEntity {
  /** Warehouse name */
  name: string;
  /** Warehouse code/identifier */
  code: string;
  /** Warehouse location/address */
  address: string;
  /** City */
  city: string;
  /** Zip code */
  zipCode: string;
  /** Country */
  country: string;
  /** Contact person name */
  contactName?: string | null;
  /** Contact phone */
  contactPhone?: string | null;
  /** Contact email */
  contactEmail?: string | null;
  /** Whether warehouse is active */
  isActive: boolean;
  /** Whether this is primary warehouse */
  isPrimary: boolean;
  /** Warehouse type (main, regional, fulfillment, returns) */
  type: string;
  /** Maximum capacity units */
  capacity?: number | null;
  /** Current stock quantity */
  currentStock: number;
  /** Temperature controlled (for sensitive items) */
  temperatureControlled: boolean;
  /** Humidity controlled */
  humidityControlled: boolean;
  /** Number of shelves/sections */
  numberOfShelves?: number | null;
  /** Manager user ID */
  managerId?: number | null;
  /** Operating hours/notes */
  operatingHours?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Stock level for a product in a warehouse
 */
export interface StockLevel extends BaseEntity {
  /** Warehouse ID */
  warehouseId: number;
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Current quantity in stock */
  quantity: number;
  /** Quantity reserved for orders */
  reserved: number;
  /** Available quantity (quantity - reserved) */
  available: number;
  /** Reorder point */
  reorderPoint: number;
  /** Reorder quantity */
  reorderQuantity: number;
  /** Last counted (inventory audit) */
  lastCountedAt?: Date | null;
  /** Last received (from supplier) */
  lastReceivedAt?: Date | null;
  /** Location in warehouse (shelf/bin) */
  location?: string | null;
  /** Batch/lot number */
  batchNumber?: string | null;
  /** Expiration date (if applicable) */
  expirationDate?: Date | null;
  /** Notes */
  notes?: string | null;
}

/**
 * Stock movement record
 */
export interface StockMovement extends BaseEntity {
  /** Warehouse ID */
  warehouseId: number;
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Movement type */
  type: StockMovementType;
  /** Movement source */
  source: StockSource;
  /** Quantity moved */
  quantity: number;
  /** Stock before movement */
  stockBefore: number;
  /** Stock after movement */
  stockAfter: number;
  /** Reference document ID (order, PO, etc.) */
  referenceId?: number | null;
  /** Reference document type (order, purchase_order, etc.) */
  referenceType?: string | null;
  /** Batch/lot number */
  batchNumber?: string | null;
  /** Movement reason/notes */
  reason?: string | null;
  /** User who initiated movement */
  initiatedByUserId: number;
  /** Actual verified quantity (for discrepancies) */
  verifiedQuantity?: number | null;
  /** User who verified movement */
  verifiedByUserId?: number | null;
  /** Verification timestamp */
  verifiedAt?: Date | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Stock sync log with suppliers
 */
export interface StockSyncLog extends BaseEntity {
  /** Supplier ID */
  supplierId: number;
  /** Sync type (STOCK, PRICE, etc.) */
  syncType: string;
  /** Total items synced */
  totalItems: number;
  /** Items successfully synced */
  successCount: number;
  /** Items failed during sync */
  failureCount: number;
  /** Sync status (success, partial, failed) */
  status: 'success' | 'partial' | 'failed';
  /** Error message if failed */
  errorMessage?: string | null;
  /** API response data */
  responseData?: Record<string, unknown> | null;
  /** User ID who initiated sync */
  initiatedByUserId: number;
  /** Sync duration in milliseconds */
  durationMs: number;
  /** Next sync scheduled time */
  nextSyncAt?: Date | null;
}

/**
 * Low stock alert
 */
export interface LowStockAlert extends BaseEntity {
  /** Stock level ID */
  stockLevelId: number;
  /** Warehouse ID */
  warehouseId: number;
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Current quantity */
  currentQuantity: number;
  /** Reorder point */
  reorderPoint: number;
  /** Alert type (approaching_limit, out_of_stock, etc.) */
  alertType: string;
  /** Alert severity (low, medium, high, critical) */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether alert is acknowledged */
  isAcknowledged: boolean;
  /** Acknowledged by user ID */
  acknowledgedByUserId?: number | null;
  /** Acknowledged at timestamp */
  acknowledgedAt?: Date | null;
  /** Whether purchase order has been created */
  purchaseOrderCreated: boolean;
  /** Purchase order ID */
  purchaseOrderId?: number | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Stock information with related warehouse details
 */
export interface StockInfo {
  warehouseId: number;
  warehouseName: string;
  sku: string;
  productId: number;
  quantity: number;
  reserved: number;
  available: number;
  location?: string;
  lastCountedAt?: Date;
}

/**
 * DTO for creating stock movement
 */
export interface CreateStockMovementDTO {
  warehouseId: number;
  productId: number;
  type: StockMovementType;
  source: StockSource;
  quantity: number;
  referenceId?: number;
  referenceType?: string;
  batchNumber?: string;
  reason?: string;
}

/**
 * DTO for updating stock level
 */
export interface UpdateStockLevelDTO {
  quantity?: number;
  reserved?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  location?: string;
  batchNumber?: string;
  expirationDate?: Date;
  notes?: string;
}

/**
 * Inventory count request for physical audit
 */
export interface InventoryCountRequest extends BaseEntity {
  /** Warehouse ID */
  warehouseId: number;
  /** Count status (planned, in_progress, completed) */
  status: 'planned' | 'in_progress' | 'completed';
  /** Scheduled count date */
  scheduledDate: Date;
  /** Actual count start */
  startedAt?: Date | null;
  /** Count completed */
  completedAt?: Date | null;
  /** User who initiated count */
  initiatedByUserId: number;
  /** User conducting count */
  conductedByUserId?: number | null;
  /** Count notes */
  notes?: string | null;
  /** Discrepancies found */
  discrepancies: number;
}

/**
 * Inventory count item
 */
export interface InventoryCountItem extends BaseEntity {
  /** Inventory count ID */
  countId: number;
  /** Product SKU */
  sku: string;
  /** System quantity */
  systemQuantity: number;
  /** Counted quantity */
  countedQuantity: number;
  /** Discrepancy (counted - system) */
  discrepancy: number;
  /** Reason for discrepancy */
  reason?: string | null;
  /** Variance percentage */
  variancePercentage: number;
}
