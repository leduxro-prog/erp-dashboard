import {
  Order,
  OrderStatus,
  CreateOrderDTO,
  OrderFilters,
  PaginatedResult,
} from '../types';

/**
 * Item for partial delivery.
 * Specifies which line items are delivered in a partial shipment.
 *
 * @example
 * {
 *   lineItemId: 42,
 *   deliveredQuantity: 15,
 *   notes: 'Partial shipment - rest arriving next week'
 * }
 */
export interface PartialDeliveryItem {
  /** ID of the order line item being partially delivered */
  lineItemId: number;
  /** Quantity being delivered (must be <= ordered quantity) */
  deliveredQuantity: number;
  /** Optional notes about this partial delivery */
  notes?: string;
}

/**
 * Invoice document representing a billable transaction.
 * Issued after order is delivered and ready for payment.
 * Contains itemized breakdown and payment information.
 *
 * @example
 * {
 *   invoiceId: 'inv-2025-001',
 *   orderId: 123,
 *   invoiceNumber: 'INV-2025-001',
 *   invoiceDate: '2025-02-07T10:30:00Z',
 *   dueDate: '2025-03-07T23:59:59Z',
 *   items: [...],
 *   subtotal: 5000,
 *   taxes: 950,
 *   discounts: 250,
 *   total: 5700,
 *   status: 'issued'
 * }
 */
export interface Invoice {
  /** Unique invoice identifier (internal) */
  invoiceId: string;
  /** Associated order ID */
  orderId: number;
  /** Invoice number for customer reference (e.g., INV-2025-001) */
  invoiceNumber: string;
  /** Date invoice was issued */
  invoiceDate: Date;
  /** Payment due date */
  dueDate: Date;
  /** Itemized invoice line items */
  items: {
    /** Product ID */
    productId: number;
    /** Product description as it appeared on invoice */
    description: string;
    /** Quantity invoiced */
    quantity: number;
    /** Unit price at time of invoice */
    unitPrice: number;
    /** Line total (quantity * unitPrice) */
    total: number;
  }[];
  /** Sum of all line item totals before discounts/taxes */
  subtotal: number;
  /** Total taxes applied */
  taxes: number;
  /** Total discounts applied */
  discounts: number;
  /** Final total: subtotal - discounts + taxes */
  total: number;
  /** Invoice status */
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  /** Payment terms description (e.g., 'Net 30') */
  paymentTerms?: string;
  /** Additional notes or special instructions */
  notes?: string;
  /** When the invoice was generated */
  generatedAt: Date;
}

/**
 * Proforma invoice document representing a preliminary quotation.
 * Issued before order is confirmed, valid for limited time period.
 * Not a legal invoice but provides pricing commitment.
 *
 * @example
 * {
 *   proformaId: 'prf-2025-001',
 *   orderId: 123,
 *   proformaNumber: 'PRF-2025-001',
 *   issueDate: '2025-02-07T10:30:00Z',
 *   validUntil: '2025-02-14T23:59:59Z',
 *   items: [...],
 *   total: 5700
 * }
 */
export interface ProformaInvoice {
  /** Unique proforma identifier (internal) */
  proformaId: string;
  /** Associated order ID */
  orderId: number;
  /** Proforma number for customer reference (e.g., PRF-2025-001) */
  proformaNumber: string;
  /** Date proforma was issued */
  issueDate: Date;
  /** Date proforma expires (customer must confirm by this date) */
  validUntil: Date;
  /** Itemized proforma line items */
  items: {
    /** Product ID */
    productId: number;
    /** Product description */
    description: string;
    /** Quantity in proforma */
    quantity: number;
    /** Unit price (quoted) */
    unitPrice: number;
    /** Line total (quantity * unitPrice) */
    total: number;
  }[];
  /** Sum of all line item totals before discounts/taxes */
  subtotal: number;
  /** Total taxes applied */
  taxes: number;
  /** Total discounts applied */
  discounts: number;
  /** Final total: subtotal - discounts + taxes */
  total: number;
  /** Payment terms description */
  paymentTerms?: string;
  /** Additional notes or special conditions */
  notes?: string;
  /** When the proforma was generated */
  generatedAt: Date;
}

/**
 * Order service interface for managing orders and fulfillment.
 * Handles all order operations including creation, status tracking,
 * delivery management, and invoice generation.
 *
 * @example
 * const service = container.get(IOrderService);
 * const order = await service.createOrder(createOrderDTO);
 * await service.updateStatus(order.id, OrderStatus.SHIPPED, userId);
 * const invoice = await service.generateInvoice(order.id);
 */
export interface IOrderService {
  /**
   * Create a new order.
   * Persists order with initial status and line items.
   * Validates inventory availability if configured.
   *
   * @param data - Order creation data with customer and line items
   * @returns Created order with generated ID and timestamps
   * @throws {ValidationError} If order data is invalid
   * @throws {BusinessRuleError} If inventory not available
   *
   * @example
   * const order = await orderService.createOrder({
   *   customerId: 456,
   *   lineItems: [{ productId: 123, quantity: 5 }],
   *   shippingAddress: { ... },
   * });
   */
  createOrder(data: CreateOrderDTO): Promise<Order>;

  /**
   * Get order details by ID.
   * Retrieves complete order information including line items and status history.
   *
   * @param orderId - Order ID
   * @returns Complete order details
   * @throws {NotFoundError} If order not found
   */
  getOrder(orderId: number): Promise<Order>;

  /**
   * List orders with filtering and pagination.
   * Supports filtering by customer, status, date range, and other criteria.
   * Results are paginated for performance.
   *
   * @param filters - Filter criteria and pagination options
   * @returns Paginated list of matching orders
   * @throws {ValidationError} If filter parameters invalid
   */
  listOrders(filters: OrderFilters): Promise<PaginatedResult<Order>>;

  /**
   * Update order status.
   * Validates status transition is allowed and logs the change.
   * Triggers related business logic (e.g., inventory updates, notifications).
   *
   * @param orderId - Order ID
   * @param status - New order status
   * @param changedBy - User ID making the change (for audit trail)
   * @param notes - Optional notes documenting reason for change
   * @returns Promise that resolves when status is updated
   * @throws {NotFoundError} If order not found
   * @throws {BusinessRuleError} If status transition not allowed
   *
   * @example
   * await orderService.updateStatus(
   *   123,
   *   OrderStatus.SHIPPED,
   *   userId,
   *   'Shipped via FedEx tracking #123456'
   * );
   */
  updateStatus(
    orderId: number,
    status: OrderStatus,
    changedBy: number,
    notes?: string,
  ): Promise<void>;

  /**
   * Create a partial delivery for an order.
   * Records which items were delivered in a partial shipment.
   * Allows tracking partial fulfillment across multiple shipments.
   *
   * @param orderId - Order ID
   * @param items - Array of items being delivered with quantities
   * @returns Promise that resolves when partial delivery is recorded
   * @throws {NotFoundError} If order not found
   * @throws {ValidationError} If delivery quantities invalid
   *
   * @example
   * await orderService.createPartialDelivery(123, [
   *   { lineItemId: 42, deliveredQuantity: 15 },
   *   { lineItemId: 43, deliveredQuantity: 10 },
   * ]);
   */
  createPartialDelivery(
    orderId: number,
    items: PartialDeliveryItem[],
  ): Promise<void>;

  /**
   * Generate proforma invoice for an order.
   * Creates preliminary invoice for customer quotation.
   * Proforma expires after defined period and must be converted to invoice.
   *
   * @param orderId - Order ID
   * @returns Proforma invoice document
   * @throws {NotFoundError} If order not found
   * @throws {BusinessRuleError} If order in invalid state for proforma
   */
  generateProforma(orderId: number): Promise<ProformaInvoice>;

  /**
   * Generate invoice for an order.
   * Creates final billable invoice after order is delivered.
   * Generates unique invoice number and stores for accounting system.
   *
   * @param orderId - Order ID
   * @returns Invoice document ready for customer and accounting
   * @throws {NotFoundError} If order not found
   * @throws {BusinessRuleError} If order not eligible for invoicing
   */
  generateInvoice(orderId: number): Promise<Invoice>;

  /**
   * Cancel an order.
   * Marks order as cancelled and reverses any inventory reservations.
   * Logs cancellation reason in audit trail.
   *
   * @param orderId - Order ID
   * @param reason - Reason for cancellation (for audit and customer communication)
   * @param cancelledBy - User ID who cancelled the order
   * @returns Promise that resolves when order is cancelled
   * @throws {NotFoundError} If order not found
   * @throws {BusinessRuleError} If order cannot be cancelled (already shipped, etc.)
   *
   * @example
   * await orderService.cancelOrder(
   *   123,
   *   'Customer requested cancellation',
   *   userId
   * );
   */
  cancelOrder(
    orderId: number,
    reason: string,
    cancelledBy: number,
  ): Promise<void>;
}
