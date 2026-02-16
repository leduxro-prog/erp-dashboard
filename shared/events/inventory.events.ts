/**
 * Inventory Event Definitions
 * Defines event constants and payload interfaces for inventory-related events
 * communicated via Redis Pub/Sub Event Bus
 */

/**
 * Inventory event constants
 */
export const INVENTORY_EVENTS = {
  STOCK_UPDATED: 'inventory.stock_updated',
  LOW_STOCK: 'inventory.low_stock',
  OUT_OF_STOCK: 'inventory.out_of_stock',
  STOCK_RESERVED: 'inventory.stock_reserved',
  STOCK_RELEASED: 'inventory.stock_released',
  SYNC_COMPLETED: 'inventory.sync_completed',
  SMARTBILL_SYNCED: 'inventory.smartbill_synced',
  SUPPLIER_SYNCED: 'inventory.supplier_synced',
} as const;

/**
 * Emitted when stock level is updated
 */
export interface StockUpdatedEvent {
  productId: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  updatedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when stock level falls below threshold
 */
export interface LowStockEvent {
  productId: string;
  currentQuantity: number;
  minimumThreshold: number;
  detectedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when product goes out of stock
 */
export interface OutOfStockEvent {
  productId: string;
  detectedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when stock is reserved for an order
 */
export interface StockReservedEvent {
  productId: string;
  orderId: string;
  quantity: number;
  reservedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when reserved stock is released
 */
export interface StockReleasedEvent {
  productId: string;
  orderId: string;
  quantity: number;
  releasedAt: Date;
  timestamp: Date;
}

/**
 * Item synced during sync operation
 */
export interface SyncedItem {
  productId: string;
  newQuantity: number;
  previousQuantity: number;
}

/**
 * Emitted when inventory sync is completed
 */
export interface SyncCompletedEvent {
  syncId: string;
  source: string;
  itemsAffected: number;
  items: SyncedItem[];
  completedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when inventory is synced with SmartBill
 */
export interface SmartbillSyncedEvent {
  syncId: string;
  itemsAffected: number;
  items: SyncedItem[];
  smartbillTimestamp: Date;
  syncedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when inventory is synced with supplier
 */
export interface SupplierSyncedEvent {
  syncId: string;
  supplierId: string;
  itemsAffected: number;
  items: SyncedItem[];
  supplierTimestamp: Date;
  syncedAt: Date;
  timestamp: Date;
}

/**
 * Union type of all inventory event payloads
 */
export type InventoryEventPayload =
  | StockUpdatedEvent
  | LowStockEvent
  | OutOfStockEvent
  | StockReservedEvent
  | StockReleasedEvent
  | SyncCompletedEvent
  | SmartbillSyncedEvent
  | SupplierSyncedEvent;

/**
 * Union type of all inventory event names
 */
export type InventoryEventType = typeof INVENTORY_EVENTS[keyof typeof INVENTORY_EVENTS];
