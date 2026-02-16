/**
 * Bulk Order Domain Entity
 * Represents a bulk order submitted by B2B customers.
 *
 * @module B2B Portal - Domain
 */

import { randomUUID } from 'crypto';

/**
 * Bulk order source type
 */
export enum BulkOrderSourceType {
  CSV_UPLOAD = 'CSV_UPLOAD',
  MANUAL = 'MANUAL',
  SAVED_CART = 'SAVED_CART',
  REORDER = 'REORDER',
}

/**
 * Bulk order status
 */
export enum BulkOrderStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Item in a bulk order
 */
export interface BulkOrderItem {
  id: string;
  sku: string;
  productId?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
}

// import { BulkValidationError } from '../errors/b2b.errors';

/**
 * Validation error for a single item in bulk order
 */
export interface BulkOrderItemError {
  rowIndex?: number;
  sku?: string;
  message: string;
  code: string;
}

/**
 * Bulk Order Domain Entity
 *
 * Encapsulates business logic for bulk orders including:
 * - Item validation
 * - Order processing status
 * - Error tracking
 * - Progress tracking
 *
 * @class BulkOrder
 */
export class BulkOrder {
  /**
   * Unique order ID
   */
  readonly id: string;

  /**
   * Customer ID
   */
  readonly customerId: string;

  /**
   * Order name/reference
   */
  private _name: string;

  /**
   * How the order was created
   */
  readonly sourceType: BulkOrderSourceType;

  /**
   * Order items
   */
  private _items: BulkOrderItem[];

  /**
   * Current status
   */
  private _status: BulkOrderStatus;

  /**
   * Validation errors
   */
  private _validationErrors: BulkOrderItemError[];

  /**
   * When order processing was completed
   */
  private _processedAt?: Date;

  /**
   * Creation timestamp
   */
  readonly createdAt: Date;

  /**
   * Last update timestamp
   */
  private _updatedAt: Date;

  /**
   * Order number reference
   */
  readonly orderNumber: string;

  /**
   * Optional notes
   */
  readonly notes?: string;

  /**
   * Timestamps for order lifecycle
   */
  readonly confirmedAt?: Date;
  readonly shippedAt?: Date;
  readonly deliveredAt?: Date;

  /**
   * Create a new BulkOrder entity.
   *
   * @param id - Unique order ID
   * @param customerId - Customer ID
   * @param name - Order name
   * @param sourceType - How the order was created
   * @param orderNumber - Order number
   * @param notes - Optional notes
   * @param confirmedAt - Confirmation timestamp
   * @param shippedAt - Shipped timestamp
   * @param deliveredAt - Delivered timestamp
   */
  constructor(
    id: string,
    customerId: string,
    name: string,
    sourceType: BulkOrderSourceType,
    orderNumber: string,
    notes?: string,
    confirmedAt?: Date,
    shippedAt?: Date,
    deliveredAt?: Date,
  ) {
    this.id = id;
    this.customerId = customerId;
    this._name = name;
    this.sourceType = sourceType;
    this.orderNumber = orderNumber;
    this.notes = notes;
    this.confirmedAt = confirmedAt;
    this.shippedAt = shippedAt;
    this.deliveredAt = deliveredAt;
    this._items = [];
    this._status = BulkOrderStatus.DRAFT;
    this._validationErrors = [];
    this.createdAt = new Date();
    this._updatedAt = new Date();
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get order name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get items
   */
  get items(): BulkOrderItem[] {
    return [...this._items];
  }

  /**
   * Get current status
   */
  get status(): BulkOrderStatus {
    return this._status;
  }

  /**
   * Get validation errors
   */
  get validationErrors(): BulkOrderItemError[] {
    return [...this._validationErrors];
  }

  /**
   * Get total number of items
   */
  get totalItems(): number {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Get total order amount
   */
  get totalAmount(): number {
    return this._items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  }

  /**
   * Get processing completion timestamp
   */
  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  /**
   * Get last update timestamp
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Get number of invalid items
   */
  get invalidItemCount(): number {
    return this._validationErrors.length;
  }

  /**
   * Get number of valid items
   */
  get validItemCount(): number {
    return this._items.length - this.invalidItemCount;
  }

  // ============================================
  // Business Logic Methods
  // ============================================

  /**
   * Add an item to the bulk order.
   *
   * @param sku - Product SKU
   * @param quantity - Quantity
   * @param unitPrice - Optional unit price
   * @returns Item ID
   */
  addItem(sku: string, quantity: number, unitPrice?: number): string {
    const itemId = `item_${randomUUID()}`;
    const lineTotal = unitPrice ? unitPrice * quantity : undefined;

    this._items.push({
      id: itemId,
      sku,
      quantity,
      unitPrice,
      lineTotal,
    });

    this._updatedAt = new Date();
    return itemId;
  }

  /**
   * Remove an item from the bulk order.
   *
   * @param itemId - Item ID to remove
   */
  removeItem(itemId: string): void {
    const index = this._items.findIndex((item) => item.id === itemId);
    if (index >= 0) {
      this._items.splice(index, 1);
      this._updatedAt = new Date();
    }
  }

  /**
   * Update an item in the bulk order.
   *
   * @param itemId - Item ID to update
   * @param quantity - New quantity
   * @param unitPrice - New unit price
   */
  updateItem(itemId: string, quantity: number, unitPrice?: number): void {
    const item = this._items.find((i) => i.id === itemId);

    if (item) {
      item.quantity = quantity;
      if (unitPrice !== undefined) {
        item.unitPrice = unitPrice;
        item.lineTotal = unitPrice * quantity;
      }
      this._updatedAt = new Date();
    }
  }

  /**
   * Mark order as validating.
   * Transitions from DRAFT to VALIDATING.
   */
  startValidation(): void {
    if (this._status === BulkOrderStatus.DRAFT) {
      this._status = BulkOrderStatus.VALIDATING;
      this._validationErrors = [];
      this._updatedAt = new Date();
    }
  }

  /**
   * Add a validation error.
   *
   * @param error - Validation error
   */
  addValidationError(error: BulkOrderItemError): void {
    this._validationErrors.push(error);
    this._updatedAt = new Date();
  }

  /**
   * Add multiple validation errors.
   *
   * @param errors - Validation errors
   */
  addValidationErrors(errors: BulkOrderItemError[]): void {
    this._validationErrors.push(...errors);
    this._updatedAt = new Date();
  }

  /**
   * Mark validation as complete.
   * Transitions to VALIDATED if no errors, FAILED if errors exist.
   */
  completeValidation(): void {
    if (this._status === BulkOrderStatus.VALIDATING) {
      this._status =
        this._validationErrors.length === 0 ? BulkOrderStatus.VALIDATED : BulkOrderStatus.FAILED;
      this._updatedAt = new Date();
    }
  }

  /**
   * Start processing the order.
   * Transitions from VALIDATED to PROCESSING.
   */
  startProcessing(): void {
    if (this._status === BulkOrderStatus.VALIDATED) {
      this._status = BulkOrderStatus.PROCESSING;
      this._updatedAt = new Date();
    }
  }

  /**
   * Mark order as completely processed.
   * Transitions to COMPLETED.
   */
  completeProcessing(): void {
    if (
      this._status === BulkOrderStatus.PROCESSING ||
      this._status === BulkOrderStatus.PARTIALLY_COMPLETED
    ) {
      this._status = BulkOrderStatus.COMPLETED;
      this._processedAt = new Date();
      this._updatedAt = new Date();
    }
  }

  /**
   * Mark order as partially completed.
   * Some items were processed successfully, some failed.
   */
  markAsPartiallyCompleted(): void {
    if (this._status === BulkOrderStatus.PROCESSING) {
      this._status = BulkOrderStatus.PARTIALLY_COMPLETED;
      this._processedAt = new Date();
      this._updatedAt = new Date();
    }
  }

  /**
   * Mark order as failed.
   * Processing could not complete.
   */
  markAsFailed(): void {
    if (this._status !== BulkOrderStatus.COMPLETED) {
      this._status = BulkOrderStatus.FAILED;
      this._processedAt = new Date();
      this._updatedAt = new Date();
    }
  }

  /**
   * Get invalid items (those with validation errors).
   *
   * @returns Invalid items
   */
  getInvalidItems(): BulkOrderItem[] {
    const invalidSkus = this._validationErrors
      .map((e) => e.sku)
      .filter((s) => s !== undefined) as string[];

    return this._items.filter((item) => invalidSkus.includes(item.sku));
  }

  /**
   * Get valid items (those without validation errors).
   *
   * @returns Valid items
   */
  getValidItems(): BulkOrderItem[] {
    const invalidSkus = this._validationErrors
      .map((e) => e.sku)
      .filter((s) => s !== undefined) as string[];

    return this._items.filter((item) => !invalidSkus.includes(item.sku));
  }

  /**
   * Get progress of order processing.
   *
   * @returns Progress information
   */
  getProgress(): {
    total: number;
    valid: number;
    invalid: number;
    validPercentage: number;
    status: BulkOrderStatus;
  } {
    const total = this._items.length;
    const invalid = this.invalidItemCount;
    const valid = total - invalid;
    const validPercentage = total > 0 ? (valid / total) * 100 : 0;

    return {
      total,
      valid,
      invalid,
      validPercentage,
      status: this._status,
    };
  }

  /**
   * Clear all items and reset to DRAFT status.
   */
  reset(): void {
    this._items = [];
    this._validationErrors = [];
    this._status = BulkOrderStatus.DRAFT;
    this._processedAt = undefined;
    this._updatedAt = new Date();
  }

  /**
   * Check if order can be validated.
   *
   * @returns true if order is in DRAFT status and has items
   */
  canBeValidated(): boolean {
    return this._status === BulkOrderStatus.DRAFT && this._items.length > 0;
  }

  /**
   * Check if order can be processed.
   *
   * @returns true if order is VALIDATED with no errors
   */
  canBeProcessed(): boolean {
    return this._status === BulkOrderStatus.VALIDATED && this._validationErrors.length === 0;
  }
}
