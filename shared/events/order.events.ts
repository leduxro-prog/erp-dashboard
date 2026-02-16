/**
 * Order Event Definitions
 * Defines event constants and payload interfaces for order-related events
 * communicated via Redis Pub/Sub Event Bus
 */

import type { OrderStatus } from '../types';

/**
 * Order event constants
 */
export const ORDER_EVENTS = {
  CREATED: 'order.created',
  STATUS_CHANGED: 'order.status_changed',
  SHIPPED: 'order.shipped',
  DELIVERED: 'order.delivered',
  CANCELLED: 'order.cancelled',
  INVOICE_GENERATED: 'order.invoice_generated',
  PAYMENT_RECEIVED: 'order.payment_received',
  PARTIAL_DELIVERY: 'order.partial_delivery',
} as const;

/**
 * Order item in creation event
 */
export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Emitted when a new order is created
 */
export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date;
  timestamp: Date;
}

/**
 * Emitted when order status changes
 */
export interface OrderStatusChangedEvent {
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  changedBy: string;
  changedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when order is shipped
 */
export interface OrderShippedEvent {
  orderId: string;
  trackingNumber?: string;
  shippedAt: Date;
  timestamp: Date;
}

/**
 * Emitted when order is delivered
 */
export interface OrderDeliveredEvent {
  orderId: string;
  deliveredAt: Date;
  timestamp: Date;
}

/**
 * Emitted when order is cancelled
 */
export interface OrderCancelledEvent {
  orderId: string;
  reason: string;
  cancelledBy: string;
  cancelledAt: Date;
  timestamp: Date;
}

/**
 * Emitted when invoice is generated for order
 */
export interface OrderInvoiceGeneratedEvent {
  orderId: string;
  invoiceNumber: string;
  smartbillId?: string;
  totalAmount: number;
  timestamp: Date;
}

/**
 * Emitted when payment is received for order
 */
export interface OrderPaymentReceivedEvent {
  orderId: string;
  amount: number;
  paymentMethod: string;
  paidAt: Date;
  timestamp: Date;
}

/**
 * Delivery item in partial delivery event
 */
export interface PartialDeliveryItem {
  productId: string;
  quantityDelivered: number;
}

/**
 * Emitted when order has partial delivery
 */
export interface OrderPartialDeliveryEvent {
  orderId: string;
  items: PartialDeliveryItem[];
  timestamp: Date;
}

/**
 * Union type of all order event payloads
 */
export type OrderEventPayload =
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | OrderShippedEvent
  | OrderDeliveredEvent
  | OrderCancelledEvent
  | OrderInvoiceGeneratedEvent
  | OrderPaymentReceivedEvent
  | OrderPartialDeliveryEvent;

/**
 * Union type of all order event names
 */
export type OrderEventType = typeof ORDER_EVENTS[keyof typeof ORDER_EVENTS];
