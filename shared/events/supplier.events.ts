/**
 * Supplier Event Definitions
 * Defines event constants and payload interfaces for supplier-related events
 * communicated via Redis Pub/Sub Event Bus
 */

/**
 * Supplier event constants
 */
export const SUPPLIER_EVENTS = {
  SYNC_STARTED: 'supplier.sync_started',
  SYNC_COMPLETED: 'supplier.sync_completed',
  SYNC_FAILED: 'supplier.sync_failed',
  PRICE_CHANGED: 'supplier.price_changed',
  ORDER_PLACED: 'supplier.order_placed',
  ORDER_RECEIVED: 'supplier.order_received',
} as const;

/**
 * Emitted when supplier sync starts
 */
export interface SupplierSyncStartedEvent {
  syncId: string;
  supplierId: string;
  startedAt: Date;
  timestamp: Date;
}

/**
 * Synced product during supplier sync
 */
export interface SyncedProduct {
  productId: string;
  supplierProductId: string;
  newPrice?: number;
  previousPrice?: number;
  newStock?: number;
  previousStock?: number;
}

/**
 * Emitted when supplier sync is completed
 */
export interface SupplierSyncCompletedEvent {
  syncId: string;
  supplierId: string;
  productsAffected: number;
  products: SyncedProduct[];
  completedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when supplier sync fails
 */
export interface SupplierSyncFailedEvent {
  syncId: string;
  supplierId: string;
  error: string;
  failedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when supplier price changes
 */
export interface SupplierPriceChangedEvent {
  supplierId: string;
  productId: string;
  supplierProductId: string;
  previousPrice: number;
  newPrice: number;
  currency: string;
  changedAt: Date;
  timestamp: Date;
}

/**
 * Supplier order item
 */
export interface SupplierOrderItem {
  productId: string;
  supplierProductId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Emitted when order is placed with supplier
 */
export interface SupplierOrderPlacedEvent {
  supplierOrderId: string;
  supplierId: string;
  items: SupplierOrderItem[];
  totalAmount: number;
  placedAt: Date;
  expectedDeliveryDate: Date;
  timestamp: Date;
}

/**
 * Emitted when order from supplier is received
 */
export interface SupplierOrderReceivedEvent {
  supplierOrderId: string;
  supplierId: string;
  items: Array<{
    productId: string;
    quantityReceived: number;
  }>;
  receivedAt: Date;
  timestamp: Date;
}

/**
 * Union type of all supplier event payloads
 */
export type SupplierEventPayload =
  | SupplierSyncStartedEvent
  | SupplierSyncCompletedEvent
  | SupplierSyncFailedEvent
  | SupplierPriceChangedEvent
  | SupplierOrderPlacedEvent
  | SupplierOrderReceivedEvent;

/**
 * Union type of all supplier event names
 */
export type SupplierEventType = typeof SUPPLIER_EVENTS[keyof typeof SUPPLIER_EVENTS];
