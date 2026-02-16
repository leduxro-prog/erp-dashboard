/**
 * Unified Status Mapping: ERP <-> SmartBill <-> WooCommerce <-> B2B Portal
 *
 * Single source of truth for status translation between all systems.
 * Uses OrderStatus from order-statuses.ts as the canonical ERP status type.
 * Any new status mapping MUST be added here to maintain consistency.
 */

import { OrderStatus, isTerminalStatus } from './order-statuses';

// Re-export OrderStatus as ErpOrderStatus for backward compatibility
export { OrderStatus as ErpOrderStatus };

// ============================================================================
// EXTERNAL SYSTEM STATUS TYPES
// ============================================================================

/**
 * WooCommerce order statuses (external)
 */
export type WooCommerceOrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'trash';

/**
 * SmartBill invoice statuses (external)
 */
export type SmartBillInvoiceStatus = 'draft' | 'sent' | 'paid' | 'canceled' | 'storno';

/**
 * B2B Portal display statuses
 */
export type B2BPortalOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'invoiced'
  | 'paid'
  | 'on_hold';

// ============================================================================
// WooCommerce <-> ERP Mapping
// ============================================================================

const WOO_TO_ERP_ORDER: Record<WooCommerceOrderStatus, OrderStatus> = {
  pending: OrderStatus.ORDER_CONFIRMED,
  processing: OrderStatus.ORDER_CONFIRMED,
  'on-hold': OrderStatus.QUOTE_PENDING,
  completed: OrderStatus.DELIVERED,
  cancelled: OrderStatus.CANCELLED,
  refunded: OrderStatus.RETURNED,
  failed: OrderStatus.CANCELLED,
  trash: OrderStatus.CANCELLED,
};

const ERP_TO_WOO_ORDER: Record<OrderStatus, WooCommerceOrderStatus> = {
  [OrderStatus.QUOTE_PENDING]: 'on-hold',
  [OrderStatus.QUOTE_SENT]: 'on-hold',
  [OrderStatus.QUOTE_ACCEPTED]: 'on-hold',
  [OrderStatus.ORDER_CONFIRMED]: 'processing',
  [OrderStatus.SUPPLIER_ORDER_PLACED]: 'processing',
  [OrderStatus.AWAITING_DELIVERY]: 'processing',
  [OrderStatus.IN_PREPARATION]: 'processing',
  [OrderStatus.READY_TO_SHIP]: 'processing',
  [OrderStatus.SHIPPED]: 'processing',
  [OrderStatus.DELIVERED]: 'completed',
  [OrderStatus.INVOICED]: 'processing',
  [OrderStatus.PAID]: 'completed',
  [OrderStatus.CANCELLED]: 'cancelled',
  [OrderStatus.RETURNED]: 'refunded',
};

// ============================================================================
// ERP <-> B2B Portal Mapping
// ============================================================================

const ERP_TO_PORTAL_ORDER: Record<OrderStatus, B2BPortalOrderStatus> = {
  [OrderStatus.QUOTE_PENDING]: 'pending',
  [OrderStatus.QUOTE_SENT]: 'pending',
  [OrderStatus.QUOTE_ACCEPTED]: 'confirmed',
  [OrderStatus.ORDER_CONFIRMED]: 'confirmed',
  [OrderStatus.SUPPLIER_ORDER_PLACED]: 'processing',
  [OrderStatus.AWAITING_DELIVERY]: 'processing',
  [OrderStatus.IN_PREPARATION]: 'processing',
  [OrderStatus.READY_TO_SHIP]: 'processing',
  [OrderStatus.SHIPPED]: 'shipped',
  [OrderStatus.DELIVERED]: 'delivered',
  [OrderStatus.INVOICED]: 'invoiced',
  [OrderStatus.PAID]: 'paid',
  [OrderStatus.CANCELLED]: 'cancelled',
  [OrderStatus.RETURNED]: 'cancelled',
};

// ============================================================================
// SmartBill Invoice <-> ERP Invoice Status Mapping
// ============================================================================

export type ErpInvoiceStatus = 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled' | 'overdue';

const SMARTBILL_TO_ERP_INVOICE: Record<SmartBillInvoiceStatus, ErpInvoiceStatus> = {
  draft: 'draft',
  sent: 'sent',
  paid: 'paid',
  canceled: 'cancelled',
  storno: 'cancelled',
};

const ERP_TO_SMARTBILL_INVOICE: Partial<Record<ErpInvoiceStatus, SmartBillInvoiceStatus>> = {
  draft: 'draft',
  sent: 'sent',
  paid: 'paid',
  cancelled: 'canceled',
};

// ============================================================================
// Payment Status Mapping
// ============================================================================

export type ErpPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';

/**
 * Derive ERP payment status from SmartBill invoice status
 */
function smartBillInvoiceToPaymentStatus(sbStatus: SmartBillInvoiceStatus): ErpPaymentStatus {
  switch (sbStatus) {
    case 'paid':
      return 'PAID';
    case 'canceled':
    case 'storno':
      return 'REFUNDED';
    default:
      return 'UNPAID';
  }
}

// ============================================================================
// Public API - mapper functions
// ============================================================================

export function mapWooOrderToErp(wooStatus: string): OrderStatus {
  return WOO_TO_ERP_ORDER[wooStatus as WooCommerceOrderStatus] || OrderStatus.ORDER_CONFIRMED;
}

export function mapErpOrderToWoo(erpStatus: OrderStatus): WooCommerceOrderStatus {
  return ERP_TO_WOO_ORDER[erpStatus] || 'processing';
}

export function mapErpOrderToPortal(erpStatus: string): B2BPortalOrderStatus {
  return ERP_TO_PORTAL_ORDER[erpStatus as OrderStatus] || 'pending';
}

export function mapSmartBillInvoiceToErp(sbStatus: string): ErpInvoiceStatus {
  return SMARTBILL_TO_ERP_INVOICE[sbStatus as SmartBillInvoiceStatus] || 'draft';
}

export function mapErpInvoiceToSmartBill(
  erpStatus: ErpInvoiceStatus,
): SmartBillInvoiceStatus | undefined {
  return ERP_TO_SMARTBILL_INVOICE[erpStatus];
}

export function mapSmartBillToPaymentStatus(sbStatus: string): ErpPaymentStatus {
  return smartBillInvoiceToPaymentStatus(sbStatus as SmartBillInvoiceStatus);
}

/**
 * Check if a SmartBill invoice status is terminal (no further changes expected)
 */
export function isSmartBillInvoiceFinal(sbStatus: string): boolean {
  return ['paid', 'canceled', 'storno'].includes(sbStatus);
}

/**
 * Check if an ERP order status is terminal
 * Delegates to the canonical isTerminalStatus from order-statuses.ts
 */
export function isErpOrderTerminal(erpStatus: string): boolean {
  return isTerminalStatus(erpStatus as OrderStatus);
}
