/**
 * Order Status Constants
 * Defines all valid order statuses, their labels, and valid state transitions
 */

// Order status enum
export enum OrderStatus {
  QUOTE_PENDING = 'quote_pending',
  QUOTE_SENT = 'quote_sent',
  QUOTE_ACCEPTED = 'quote_accepted',
  ORDER_CONFIRMED = 'order_confirmed',
  SUPPLIER_ORDER_PLACED = 'supplier_order_placed',
  AWAITING_DELIVERY = 'awaiting_delivery',
  IN_PREPARATION = 'in_preparation',
  READY_TO_SHIP = 'ready_to_ship',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  INVOICED = 'invoiced',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

// Bilingual labels for order statuses
export const ORDER_STATUS_LABELS = {
  [OrderStatus.QUOTE_PENDING]: {
    ro: 'Ofertă în așteptare',
    en: 'Quote Pending',
  },
  [OrderStatus.QUOTE_SENT]: {
    ro: 'Ofertă trimisă',
    en: 'Quote Sent',
  },
  [OrderStatus.QUOTE_ACCEPTED]: {
    ro: 'Ofertă acceptată',
    en: 'Quote Accepted',
  },
  [OrderStatus.ORDER_CONFIRMED]: {
    ro: 'Comandă confirmată',
    en: 'Order Confirmed',
  },
  [OrderStatus.SUPPLIER_ORDER_PLACED]: {
    ro: 'Comandă plasată la furnizor',
    en: 'Supplier Order Placed',
  },
  [OrderStatus.AWAITING_DELIVERY]: {
    ro: 'În așteptarea livrării',
    en: 'Awaiting Delivery',
  },
  [OrderStatus.IN_PREPARATION]: {
    ro: 'În curs de pregătire',
    en: 'In Preparation',
  },
  [OrderStatus.READY_TO_SHIP]: {
    ro: 'Gata de expediere',
    en: 'Ready to Ship',
  },
  [OrderStatus.SHIPPED]: {
    ro: 'Expediat',
    en: 'Shipped',
  },
  [OrderStatus.DELIVERED]: {
    ro: 'Livrat',
    en: 'Delivered',
  },
  [OrderStatus.INVOICED]: {
    ro: 'Facturat',
    en: 'Invoiced',
  },
  [OrderStatus.PAID]: {
    ro: 'Plătit',
    en: 'Paid',
  },
  [OrderStatus.CANCELLED]: {
    ro: 'Anulat',
    en: 'Cancelled',
  },
  [OrderStatus.RETURNED]: {
    ro: 'Returnat',
    en: 'Returned',
  },
} as const;

// State machine: valid transitions between statuses
export const ORDER_STATUS_TRANSITIONS = {
  [OrderStatus.QUOTE_PENDING]: [OrderStatus.QUOTE_SENT, OrderStatus.CANCELLED],
  [OrderStatus.QUOTE_SENT]: [OrderStatus.QUOTE_ACCEPTED, OrderStatus.CANCELLED],
  [OrderStatus.QUOTE_ACCEPTED]: [OrderStatus.ORDER_CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.ORDER_CONFIRMED]: [
    OrderStatus.SUPPLIER_ORDER_PLACED,
    OrderStatus.IN_PREPARATION,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.SUPPLIER_ORDER_PLACED]: [OrderStatus.AWAITING_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.AWAITING_DELIVERY]: [OrderStatus.IN_PREPARATION],
  [OrderStatus.IN_PREPARATION]: [OrderStatus.READY_TO_SHIP],
  [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.INVOICED, OrderStatus.RETURNED],
  [OrderStatus.INVOICED]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: [],
} as const;

/**
 * Check if a transition from one status to another is valid
 * @param from Current order status
 * @param to Target order status
 * @returns true if the transition is valid, false otherwise
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (!Object.values(OrderStatus).includes(from) || !Object.values(OrderStatus).includes(to)) {
    return false;
  }

  const validTransitions = ORDER_STATUS_TRANSITIONS[from];
  if (!validTransitions) {
    return false;
  }

  return (validTransitions as readonly OrderStatus[]).includes(to);
}

/**
 * Get all valid next statuses from a given status
 * @param status Current order status
 * @returns Array of valid next statuses
 */
export function getNextStatuses(status: OrderStatus): readonly OrderStatus[] {
  if (!Object.values(OrderStatus).includes(status)) {
    return [];
  }

  return ORDER_STATUS_TRANSITIONS[status] || [];
}

/**
 * Get bilingual label for an order status
 * @param status Order status
 * @param language Language code ('ro' or 'en')
 * @returns Label in the requested language or English as fallback
 */
export function getOrderStatusLabel(status: OrderStatus, language: 'ro' | 'en' = 'en'): string {
  const labels = ORDER_STATUS_LABELS[status];
  if (!labels) {
    return status;
  }

  return labels[language] || labels.en;
}

/**
 * Get all available order statuses
 * @returns Array of all order status values
 */
export function getAllOrderStatuses(): OrderStatus[] {
  return Object.values(OrderStatus);
}

/**
 * Check if a status is terminal (no further transitions possible)
 * @param status Order status
 * @returns true if the status is terminal
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  const nextStatuses = getNextStatuses(status);
  return nextStatuses.length === 0;
}

/**
 * Check if a status is in the quote phase
 * @param status Order status
 * @returns true if the status is a quote-related status
 */
export function isQuoteStatus(status: OrderStatus): boolean {
  return [OrderStatus.QUOTE_PENDING, OrderStatus.QUOTE_SENT, OrderStatus.QUOTE_ACCEPTED].includes(
    status,
  );
}

/**
 * Check if a status is in the fulfillment phase
 * @param status Order status
 * @returns true if the status is a fulfillment-related status
 */
export function isFulfillmentStatus(status: OrderStatus): boolean {
  return [
    OrderStatus.IN_PREPARATION,
    OrderStatus.READY_TO_SHIP,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ].includes(status);
}

/**
 * Check if a status is in the payment phase
 * @param status Order status
 * @returns true if the status is a payment-related status
 */
export function isPaymentStatus(status: OrderStatus): boolean {
  return [OrderStatus.INVOICED, OrderStatus.PAID].includes(status);
}

/**
 * Check if an order can still be modified (not in terminal or advanced stages)
 * @param status Order status
 * @returns true if the order can be modified
 */
export function isOrderModifiable(status: OrderStatus): boolean {
  return [
    OrderStatus.QUOTE_PENDING,
    OrderStatus.QUOTE_SENT,
    OrderStatus.QUOTE_ACCEPTED,
  ].includes(status);
}

/**
 * Check if an order is completed
 * @param status Order status
 * @returns true if the order has been fully processed
 */
export function isOrderCompleted(status: OrderStatus): boolean {
  return [OrderStatus.PAID, OrderStatus.RETURNED, OrderStatus.CANCELLED].includes(status);
}
