/**
 * Order management types
 */

import { BaseEntity, Currency } from './common.types';

/**
 * Order status — re-exported from the canonical source in shared/constants.
 * The OrderStatusEnum const is kept for backward compat (e.g. runtime iteration).
 */
import { OrderStatus } from '../constants/order-statuses';
export { OrderStatus };

export const OrderStatusEnum = {
  QUOTE_PENDING: 'quote_pending',
  QUOTE_SENT: 'quote_sent',
  QUOTE_ACCEPTED: 'quote_accepted',
  ORDER_CONFIRMED: 'order_confirmed',
  SUPPLIER_ORDER_PLACED: 'supplier_order_placed',
  AWAITING_DELIVERY: 'awaiting_delivery',
  IN_PREPARATION: 'in_preparation',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  INVOICED: 'invoiced',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
} as const;

/**
 * Payment status for orders
 */
export const PaymentStatusEnum = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const;

export type PaymentStatus = (typeof PaymentStatusEnum)[keyof typeof PaymentStatusEnum];

/**
 * Main order entity
 */
export interface Order extends BaseEntity {
  /** Order number/identifier */
  orderNumber: string;
  /** Quote ID (if from quote) */
  quoteId?: number | null;
  /** Customer ID */
  customerId: number;
  /** Order status */
  status: OrderStatus;
  /** Order type (standard, bulk, special) */
  orderType: string;
  /** Currency (always RON) */
  currency: Currency;
  /** Order date */
  orderDate: Date;
  /** Due date (for payment) */
  dueDate?: Date | null;
  /** Expected delivery date */
  expectedDeliveryDate?: Date | null;
  /** Actual delivery date */
  deliveryDate?: Date | null;
  /** Billing address */
  billingAddress: string;
  /** Billing city */
  billingCity: string;
  /** Billing zip code */
  billingZipCode: string;
  /** Billing country */
  billingCountry: string;
  /** Shipping address */
  shippingAddress: string;
  /** Shipping city */
  shippingCity: string;
  /** Shipping zip code */
  shippingZipCode: string;
  /** Shipping country */
  shippingCountry: string;
  /** Subtotal before discounts and VAT */
  subtotal: number;
  /** Total discount amount */
  discountAmount: number;
  /** VAT amount (19% in Romania) */
  vat: number;
  /** Shipping cost */
  shippingCost: number;
  /** Total order value */
  total: number;
  /** Payment status */
  paymentStatus: PaymentStatus;
  /** Amount paid so far */
  amountPaid: number;
  /** Payment method (credit_card, bank_transfer, etc.) */
  paymentMethod?: string | null;
  /** Internal sales notes */
  internalNotes?: string | null;
  /** Customer-visible notes */
  customerNotes?: string | null;
  /** Sales representative user ID */
  salesRepId?: number | null;
  /** Warehouse ID for fulfillment */
  warehouseId?: number | null;
  /** Supplier ID (if dropship) */
  supplierId?: number | null;
  /** Supplier order number */
  supplierOrderNumber?: string | null;
  /** Invoice ID (SmartBill) */
  invoiceId?: number | null;
  /** Invoice number (SmartBill) */
  invoiceNumber?: string | null;
  /** Shipping provider */
  shippingProvider?: string | null;
  /** Tracking number */
  trackingNumber?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Order line item
 */
export interface OrderItem extends BaseEntity {
  /** Order ID */
  orderId: number;
  /** Line item number */
  lineNumber: number;
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** Product name */
  productName: string;
  /** Quantity ordered */
  quantity: number;
  /** Quantity shipped */
  quantityShipped: number;
  /** Quantity returned */
  quantityReturned: number;
  /** Unit price (without VAT) */
  unitPrice: number;
  /** Discount per unit */
  discountPerUnit: number;
  /** VAT rate applied */
  vatRate: number;
  /** VAT amount for this item */
  vat: number;
  /** Line total (quantity * unitPrice - discount + vat) */
  lineTotal: number;
  /** Configuration details (if configurator used) */
  configuration?: Record<string, unknown> | null;
  /** Notes for this item */
  notes?: string | null;
}

/**
 * Order status history/timeline
 */
export interface OrderStatusHistory extends BaseEntity {
  /** Order ID */
  orderId: number;
  /** Previous status */
  previousStatus?: OrderStatus | null;
  /** New status */
  newStatus: OrderStatus;
  /** Status change timestamp */
  changedAt: Date;
  /** User ID who changed status */
  changedByUserId: number;
  /** Reason for status change */
  reason?: string | null;
  /** Additional metadata */
  metadata?: Record<string, unknown> | null;
}

/**
 * Proforma invoice (before actual invoice)
 */
export interface ProformaInvoice extends BaseEntity {
  /** Order ID */
  orderId: number;
  /** Proforma invoice number */
  invoiceNumber: string;
  /** Customer ID */
  customerId: number;
  /** Invoice date */
  invoiceDate: Date;
  /** Due date */
  dueDate: Date;
  /** Subtotal */
  subtotal: number;
  /** Discount amount */
  discountAmount: number;
  /** VAT amount */
  vat: number;
  /** Shipping cost */
  shippingCost: number;
  /** Total amount */
  total: number;
  /** Currency */
  currency: Currency;
  /** Invoice status (draft, sent, approved, converted) */
  status: string;
  /** Whether converted to actual invoice */
  isConverted: boolean;
  /** Actual invoice ID (if converted) */
  actualInvoiceId?: number | null;
  /** SmartBill document ID */
  smartBillDocId?: string | null;
  /** Notes */
  notes?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Order payment record
 */
export interface OrderPayment extends BaseEntity {
  /** Order ID */
  orderId: number;
  /** Payment amount */
  amount: number;
  /** Payment date */
  paymentDate: Date;
  /** Payment method */
  paymentMethod: string;
  /** Transaction ID/reference */
  transactionId?: string | null;
  /** Payment status (pending, completed, failed, refunded) */
  status: string;
  /** Notes */
  notes?: string | null;
}

/**
 * Order return/RMA
 */
export interface OrderReturn extends BaseEntity {
  /** Order ID */
  orderId: number;
  /** RMA (Return Merchandise Authorization) number */
  rmaNumber: string;
  /** Return date */
  returnDate: Date;
  /** Return reason */
  returnReason: string;
  /** Return status (requested, approved, received, refunded) */
  status: string;
  /** Whether refund issued */
  refundIssued: boolean;
  /** Refund amount */
  refundAmount?: number | null;
  /** Refund date */
  refundDate?: Date | null;
  /** Notes */
  notes?: string | null;
  /** Restocking fee percentage */
  restockingFeePercentage?: number | null;
}

/**
 * DTO for creating an order
 */
export interface CreateOrderDTO {
  customerId: number;
  quoteId?: number;
  orderType?: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZipCode: string;
  shippingCountry?: string;
  items: {
    productId: number;
    quantity: number;
    configuration?: Record<string, unknown>;
  }[];
  paymentMethod?: string;
  discountPercentage?: number;
  shippingCost?: number;
  internalNotes?: string;
  customerNotes?: string;
  salesRepId?: number;
  warehouseId?: number;
}

/**
 * DTO for updating order
 */
export interface UpdateOrderDTO {
  status?: OrderStatus;
  shippingAddress?: string;
  shippingCity?: string;
  shippingZipCode?: string;
  shippingCountry?: string;
  expectedDeliveryDate?: Date;
  paymentMethod?: string;
  internalNotes?: string;
  customerNotes?: string;
  shippingProvider?: string;
  trackingNumber?: string;
  warehouseId?: number;
}

/**
 * Order filters for search/list
 */
export interface OrderFilters {
  customerId?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  salesRepId?: number;
  warehouseId?: number;
  search?: string;
  isOverdue?: boolean;
}

/**
 * Order summary for dashboard
 */
export interface OrderSummary {
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  pendingPayments: number;
  pendingPaymentAmount: number;
}

/**
 * Order shipping info
 */
export interface OrderShipping extends BaseEntity {
  /** Order ID */
  orderId: number;
  /** Shipping provider */
  provider: string;
  /** Tracking number */
  trackingNumber: string;
  /** Estimated delivery date */
  estimatedDeliveryDate?: Date | null;
  /** Actual delivery date */
  actualDeliveryDate?: Date | null;
  /** Shipping cost */
  shippingCost: number;
  /** Signature required */
  signatureRequired: boolean;
  /** Insurance value */
  insuranceValue?: number | null;
  /** Shipping status */
  status: string;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}
