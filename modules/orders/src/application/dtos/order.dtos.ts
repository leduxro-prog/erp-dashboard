/**
 * Order Application DTOs
 * Data transfer objects for use cases and external communication
 */
import { OrderStatus, PaymentTerms, PaymentStatus } from '../../domain';

// ============ CREATE ORDER ============

export interface CreateOrderItemInput {
  productId: number;
  quantity: number;
}

export interface CreateAddressInput {
  name: string;
  street: string;
  city: string;
  county: string;
  postalCode: string;
  country?: string;
  phone?: string;
}

export interface CreateOrderInput {
  customerId: number;
  customerName: string;
  customerEmail: string;
  items: CreateOrderItemInput[];
  billingAddress: CreateAddressInput;
  shippingAddress: CreateAddressInput;
  paymentTerms: PaymentTerms;
  discountAmount?: number;
  shippingCost?: number;
  notes?: string;
  createdBy: string;
}

// ============ ORDER RESULTS ============

export interface OrderItemResult {
  id: string;
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  quantityDelivered: number;
  quantityRemaining: number;
  lineTotal: number;
  sourceWarehouseId?: number;
  costPriceSnapshot: number | null;
  costSource: string | null;
  grossProfit: number | null;
  grossMarginPercent: number | null;
}

export interface AddressResult {
  name: string;
  street: string;
  city: string;
  county: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface StatusChangeResult {
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  changedBy: string;
  changedAt: string; // ISO string
  notes?: string;
}

export interface OrderResult {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  items: OrderItemResult[];
  billingAddress: AddressResult;
  shippingAddress: AddressResult;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCost: number;
  grandTotal: number;
  currency: string;
  taxRate: number;
  paymentTerms: PaymentTerms;
  paymentStatus: PaymentStatus;
  proformaNumber?: string;
  invoiceNumber?: string;
  notes?: string;
  statusHistory: StatusChangeResult[];
  createdBy: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  updatedBy: string;
}

export interface OrderSummaryResult {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  status: OrderStatus;
  grandTotal: number;
  currency: string;
  paymentStatus: PaymentStatus;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// ============ UPDATE STATUS ============

export interface UpdateOrderStatusInput {
  orderId: number;
  newStatus: OrderStatus;
  changedBy: string;
  notes?: string;
}

// ============ PARTIAL DELIVERY ============

export interface RecordDeliveryItemInput {
  itemId: string;
  quantityDelivered: number;
}

export interface RecordPartialDeliveryInput {
  orderId: number;
  items: RecordDeliveryItemInput[];
  notes?: string;
  userId: string;
}

export interface DeliverySummary {
  totalQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  deliveryPercentage: number;
  fullyDelivered: boolean;
  partiallyDelivered: boolean;
}

export interface PartialDeliveryResult {
  orderId: number;
  items: OrderItemResult[];
  deliverySummary: DeliverySummary;
  isFullyDelivered: boolean;
  updatedAt: string; // ISO string
}

// ============ PROFORMA ============

export interface GenerateProformaInput {
  orderId: number;
  generatedBy: string;
}

export interface ProformaResult {
  proformaNumber: string;
  orderId: number;
  orderNumber: string;
  customerName: string;
  total: number;
  currency: string;
  createdAt: string; // ISO string
}

// ============ CANCELLATION ============

export interface CancelOrderInput {
  orderId: number;
  reason: string;
  cancelledBy: string;
}

// ============ LIST ORDERS ============

export interface ListOrdersInput {
  customerId?: number;
  status?: OrderStatus;
  statuses?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'orderNumber' | 'customerName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============ GET ORDER ============

export interface GetOrderInput {
  orderId?: number;
  orderNumber?: string;
}
