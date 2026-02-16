/**
 * Event Bus - Central Export
 * Re-exports all event constants and interfaces for the Redis Pub/Sub Event Bus
 */

import {
  ORDER_EVENTS,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderShippedEvent,
  OrderDeliveredEvent,
  OrderCancelledEvent,
  OrderInvoiceGeneratedEvent,
  OrderPaymentReceivedEvent,
  OrderPartialDeliveryEvent,
  OrderEventPayload,
  OrderEventType,
  OrderItem,
  PartialDeliveryItem,
} from './order.events';

import {
  INVENTORY_EVENTS,
  StockUpdatedEvent,
  LowStockEvent,
  OutOfStockEvent,
  StockReservedEvent,
  StockReleasedEvent,
  SyncCompletedEvent,
  SmartbillSyncedEvent,
  SupplierSyncedEvent,
  InventoryEventPayload,
  InventoryEventType,
  SyncedItem,
} from './inventory.events';

import {
  QUOTE_EVENTS,
  QuoteCreatedEvent,
  QuoteSentEvent,
  QuoteViewedEvent,
  QuoteAcceptedEvent,
  QuoteDeclinedEvent,
  QuoteExpiredEvent,
  QuoteConvertedEvent,
  QuoteReminderSentEvent,
  QuoteEventPayload,
  QuoteEventType,
  QuoteItem,
} from './quote.events';

import {
  PRICING_EVENTS,
  PriceUpdatedEvent,
  PromotionStartedEvent,
  PromotionEndedEvent,
  TierChangedEvent,
  VolumeDiscountAppliedEvent,
  PricingEventPayload,
  PricingEventType,
} from './pricing.events';

import {
  SUPPLIER_EVENTS,
  SupplierSyncStartedEvent,
  SupplierSyncCompletedEvent,
  SupplierSyncFailedEvent,
  SupplierPriceChangedEvent,
  SupplierOrderPlacedEvent,
  SupplierOrderReceivedEvent,
  SupplierEventPayload,
  SupplierEventType,
  SyncedProduct,
  SupplierOrderItem,
} from './supplier.events';

import {
  CUSTOMER_EVENTS,
  CustomerRegisteredEvent,
  B2bApprovedEvent,
  B2bRejectedEvent,
  TierUpgradedEvent,
  CreditLimitChangedEvent,
  CustomerEventPayload,
  CustomerEventType,
} from './customer.events';

export {
  ORDER_EVENTS,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderShippedEvent,
  OrderDeliveredEvent,
  OrderCancelledEvent,
  OrderInvoiceGeneratedEvent,
  OrderPaymentReceivedEvent,
  OrderPartialDeliveryEvent,
  OrderEventPayload,
  OrderEventType,
};

export {
  INVENTORY_EVENTS,
  StockUpdatedEvent,
  LowStockEvent,
  OutOfStockEvent,
  StockReservedEvent,
  StockReleasedEvent,
  SyncCompletedEvent,
  SmartbillSyncedEvent,
  SupplierSyncedEvent,
  InventoryEventPayload,
  InventoryEventType,
  SyncedItem,
};

export {
  QUOTE_EVENTS,
  QuoteCreatedEvent,
  QuoteSentEvent,
  QuoteViewedEvent,
  QuoteAcceptedEvent,
  QuoteDeclinedEvent,
  QuoteExpiredEvent,
  QuoteConvertedEvent,
  QuoteReminderSentEvent,
  QuoteEventPayload,
  QuoteEventType,
};

export {
  PRICING_EVENTS,
  PriceUpdatedEvent,
  PromotionStartedEvent,
  PromotionEndedEvent,
  TierChangedEvent,
  VolumeDiscountAppliedEvent,
  PricingEventPayload,
  PricingEventType,
};

export {
  SUPPLIER_EVENTS,
  SupplierSyncStartedEvent,
  SupplierSyncCompletedEvent,
  SupplierSyncFailedEvent,
  SupplierPriceChangedEvent,
  SupplierOrderPlacedEvent,
  SupplierOrderReceivedEvent,
  SupplierEventPayload,
  SupplierEventType,
  SyncedProduct,
};

export {
  CUSTOMER_EVENTS,
  CustomerRegisteredEvent,
  B2bApprovedEvent,
  B2bRejectedEvent,
  TierUpgradedEvent,
  CreditLimitChangedEvent,
  CustomerEventPayload,
  CustomerEventType,
};

/**
 * Union type of all possible event payloads in the system
 */
export type AllEventPayloads =
  | OrderEventPayload
  | InventoryEventPayload
  | QuoteEventPayload
  | PricingEventPayload
  | SupplierEventPayload
  | CustomerEventPayload;

/**
 * Union type of all possible event names in the system
 */
export type AllEventTypes =
  | OrderEventType
  | InventoryEventType
  | QuoteEventType
  | PricingEventType
  | SupplierEventType
  | CustomerEventType;
