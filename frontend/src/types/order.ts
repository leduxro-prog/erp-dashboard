/**
 * Frontend OrderStatus enum
 *
 * Mirror of backend canonical OrderStatus from shared/constants/order-statuses.ts
 * These values MUST match the DB's order_status PostgreSQL enum exactly.
 * The frontend cannot import from @shared/ (separate Vite build), so
 * this file is a manual copy. Keep in sync with the backend source of truth.
 */
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

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  total: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  notes?: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface CreateOrderDTO {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
  shippingAddress?: Order['shippingAddress'];
  billingAddress?: Order['billingAddress'];
  notes?: string;
}

export interface UpdateOrderDTO extends Partial<CreateOrderDTO> {
  id: string;
  status?: OrderStatus;
}
