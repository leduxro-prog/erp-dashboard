/**
 * Order Aggregate Root Entity
 * Core business entity managing the complete order lifecycle
 */
import { OrderStatus } from './OrderStatus';
import { OrderItem } from './OrderItem';
import { StatusChange } from './StatusChange';
import { Address } from './Address';
import { OrderStatusMachine } from './OrderStatusMachine';

export type PaymentTerms = 'net_30' | 'net_60' | 'net_90' | 'prepay' | 'cash';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export class Order {
  readonly id: number;
  readonly orderNumber: string;
  readonly customerId: number;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly currency: string;
  readonly taxRate: number;
  readonly createdAt: Date;

  status: OrderStatus;
  items: OrderItem[];
  billingAddress: Address;
  shippingAddress: Address;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCost: number;
  grandTotal: number;
  paymentTerms: PaymentTerms;
  paymentStatus: PaymentStatus;
  proformaNumber?: string;
  invoiceNumber?: string;
  notes?: string;
  statusHistory: StatusChange[];
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  offlineSyncedAt?: Date;
  offlineOriginalTimestamp?: Date;

  constructor(props: {
    id: number;
    orderNumber: string;
    customerId: number;
    customerName: string;
    customerEmail: string;
    status: OrderStatus;
    items: OrderItem[];
    billingAddress: Address;
    shippingAddress: Address;
    subtotal: number;
    discountAmount?: number;
    taxAmount: number;
    shippingCost?: number;
    grandTotal: number;
    currency?: string;
    taxRate?: number;
    paymentTerms: PaymentTerms;
    paymentStatus?: PaymentStatus;
    proformaNumber?: string;
    invoiceNumber?: string;
    notes?: string;
    statusHistory?: StatusChange[];
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
    updatedBy: string;
    offlineSyncedAt?: Date;
    offlineOriginalTimestamp?: Date;
  }) {
    this.id = props.id;
    this.orderNumber = props.orderNumber;
    this.customerId = props.customerId;
    this.customerName = props.customerName;
    this.customerEmail = props.customerEmail;
    this.status = props.status;
    this.items = props.items;
    this.billingAddress = props.billingAddress;
    this.shippingAddress = props.shippingAddress;
    this.subtotal = props.subtotal;
    this.discountAmount = props.discountAmount || 0;
    this.taxAmount = props.taxAmount;
    this.shippingCost = props.shippingCost || 0;
    this.grandTotal = props.grandTotal;
    this.currency = props.currency || 'RON';
    this.taxRate = props.taxRate || 0.21; // 19% VAT for Romania
    this.paymentTerms = props.paymentTerms;
    this.paymentStatus = props.paymentStatus || 'pending';
    this.proformaNumber = props.proformaNumber;
    this.invoiceNumber = props.invoiceNumber;
    this.notes = props.notes;
    this.statusHistory = props.statusHistory || [];
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
    this.updatedBy = props.updatedBy;
    this.offlineSyncedAt = props.offlineSyncedAt;
    this.offlineOriginalTimestamp = props.offlineOriginalTimestamp;

    this.validate();
  }

  private validate(): void {
    if (!this.orderNumber || this.orderNumber.trim().length === 0) {
      throw new Error('Order number is required');
    }
    if (this.customerId <= 0) {
      throw new Error('Valid customer ID is required');
    }
    if (!this.customerName || this.customerName.trim().length === 0) {
      throw new Error('Customer name is required');
    }
    if (!this.customerEmail || this.customerEmail.trim().length === 0) {
      throw new Error('Customer email is required');
    }
    if (!this.items || this.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
    if (this.grandTotal < 0) {
      throw new Error('Grand total cannot be negative');
    }
  }

  /**
   * Update order status with validation and history tracking
   */
  updateStatus(
    newStatus: OrderStatus,
    changedBy: string,
    notes?: string
  ): void {
    // Validate transition
    const validation = OrderStatusMachine.validateTransition(
      this.status,
      newStatus
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if note is required
    if (
      OrderStatusMachine.requiresNote(this.status, newStatus) &&
      !notes
    ) {
      throw new Error(
        `Status transition from ${this.status} to ${newStatus} requires a note`
      );
    }

    // Record status change
    const statusChange = StatusChange.create({
      fromStatus: this.status,
      toStatus: newStatus,
      changedBy,
      notes,
    });

    this.statusHistory.push(statusChange);
    this.status = newStatus;
    this.updatedAt = new Date();
    this.updatedBy = changedBy;
  }

  /**
   * Check if order can transition to a specific status
   */
  canTransitionTo(status: OrderStatus): boolean {
    return OrderStatusMachine.canTransition(this.status, status);
  }

  /**
   * Add item to order
   */
  addItem(item: OrderItem): void {
    const existingItem = this.items.find((i) => i.id === item.id);
    if (existingItem) {
      throw new Error(`Item with ID ${item.id} already exists in order`);
    }
    this.items.push(item);
    this.calculateTotals();
  }

  /**
   * Remove item from order by item ID
   */
  removeItem(itemId: string): void {
    const index = this.items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      throw new Error(`Item with ID ${itemId} not found in order`);
    }
    this.items.splice(index, 1);
    this.calculateTotals();
  }

  /**
   * Recalculate order totals based on items, discount, and shipping
   */
  calculateTotals(): void {
    const calculatedSubtotal = this.items.reduce(
      (sum, item) => sum + item.getLineTotal(),
      0
    );

    const taxableAmount = calculatedSubtotal - this.discountAmount;
    const calculatedTaxAmount = taxableAmount * this.taxRate;

    this.subtotal = calculatedSubtotal;
    this.taxAmount = calculatedTaxAmount;
    this.grandTotal =
      calculatedSubtotal - this.discountAmount + this.shippingCost + this.taxAmount;
  }

  /**
   * Record partial delivery for items
   * Returns true if order is fully delivered
   */
  recordPartialDelivery(
    deliveries: Array<{ itemId: string; quantityDelivered: number }>
  ): boolean {
    deliveries.forEach(({ itemId, quantityDelivered }) => {
      const item = this.items.find((i) => i.id === itemId);
      if (!item) {
        throw new Error(`Item with ID ${itemId} not found in order`);
      }
      item.recordDelivery(quantityDelivered);
    });

    return this.isFullyDelivered();
  }

  /**
   * Check if all items have been delivered
   */
  isFullyDelivered(): boolean {
    return this.items.every((item) => item.isFullyDelivered());
  }

  /**
   * Check if some but not all items have been delivered
   */
  isPartiallyDelivered(): boolean {
    const delivered = this.items.filter((item) => item.isFullyDelivered());
    const partial = this.items.filter((item) => item.isPartiallyDelivered());

    return delivered.length > 0 || partial.length > 0;
  }

  /**
   * Cancel order with reason tracking
   */
  cancel(reason: string, cancelledBy: string): void {
    this.updateStatus(OrderStatus.CANCELLED, cancelledBy, reason);
  }

  /**
   * Static utility to generate order number
   * Format: ORD-YYYYMMDD-XXXX (where XXXX is sequential)
   */
  static generateOrderNumber(sequentialNumber: number): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const sequence = String(sequentialNumber).padStart(4, '0');

    return `ORD-${year}${month}${day}-${sequence}`;
  }

  /**
   * Static factory method
   */
  static create(props: {
    id: number;
    orderNumber: string;
    customerId: number;
    customerName: string;
    customerEmail: string;
    status: OrderStatus;
    items: OrderItem[];
    billingAddress: Address;
    shippingAddress: Address;
    subtotal: number;
    discountAmount?: number;
    taxAmount: number;
    shippingCost?: number;
    grandTotal: number;
    currency?: string;
    taxRate?: number;
    paymentTerms: PaymentTerms;
    paymentStatus?: PaymentStatus;
    proformaNumber?: string;
    invoiceNumber?: string;
    notes?: string;
    statusHistory?: StatusChange[];
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
    updatedBy: string;
    offlineSyncedAt?: Date;
    offlineOriginalTimestamp?: Date;
  }): Order {
    return new Order(props);
  }

  toJSON() {
    return {
      id: this.id,
      orderNumber: this.orderNumber,
      customerId: this.customerId,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      status: this.status,
      items: this.items.map((item) => item.toJSON()),
      billingAddress: this.billingAddress.toJSON(),
      shippingAddress: this.shippingAddress.toJSON(),
      subtotal: this.subtotal,
      discountAmount: this.discountAmount,
      taxAmount: this.taxAmount,
      shippingCost: this.shippingCost,
      grandTotal: this.grandTotal,
      currency: this.currency,
      taxRate: this.taxRate,
      paymentTerms: this.paymentTerms,
      paymentStatus: this.paymentStatus,
      proformaNumber: this.proformaNumber,
      invoiceNumber: this.invoiceNumber,
      notes: this.notes,
      statusHistory: this.statusHistory.map((s) => s.toJSON()),
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      updatedBy: this.updatedBy,
      offlineSyncedAt: this.offlineSyncedAt?.toISOString(),
      offlineOriginalTimestamp: this.offlineOriginalTimestamp?.toISOString(),
    };
  }
}
