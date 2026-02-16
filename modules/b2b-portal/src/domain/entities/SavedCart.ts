/**
 * Saved Cart Domain Entity
 * Represents a saved shopping cart for B2B customers.
 *
 * @module B2B Portal - Domain
 */

import { EmptyCartError } from '../errors/b2b.errors';
import { randomUUID } from 'crypto';

/**
 * Represents a single item in a saved cart
 */
export interface CartItemData {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

/**
 * Saved Cart Domain Entity
 *
 * Encapsulates business logic for saved shopping carts including:
 * - Item management (add, remove, update)
 * - Subtotal calculations
 * - Cart conversion to orders
 * - Cart duplication
 *
 * @class SavedCart
 */
export class SavedCart {
  /**
   * Unique cart identifier
   */
  readonly id: string;

  /**
   * Customer ID that owns this cart
   */
  readonly customerId: string;

  /**
   * Cart name/label for customer reference
   */
  private _name: string;

  /**
   * Cart items
   */
  private _items: CartItemData[];

  /**
   * Whether this is the default/main cart
   */
  private _isDefault: boolean;

  /**
   * Optional notes about the cart
   */
  private _notes?: string;

  /**
   * Creation timestamp
   */
  readonly createdAt: Date;

  /**
   * Last modification timestamp
   */
  private _lastModifiedAt: Date;

  /**
   * Create a new SavedCart entity.
   *
   * @param id - Unique cart ID
   * @param customerId - Customer ID
   * @param name - Cart name
   * @param isDefault - Whether this is the default cart
   * @param notes - Optional notes
   */
  constructor(
    id: string,
    customerId: string,
    name: string,
    items: CartItemData[] = [],
    isDefault: boolean = false,
    notes?: string,
    createdAt?: Date,
    lastModifiedAt?: Date,
  ) {
    this.id = id;
    this.customerId = customerId;
    this._name = name;
    this._items = items;
    this._isDefault = isDefault;
    this._notes = notes;
    this.createdAt = createdAt || new Date();
    this._lastModifiedAt = lastModifiedAt || new Date();
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get cart name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get cart items
   */
  get items(): CartItemData[] {
    return [...this._items];
  }

  /**
   * Get whether cart is default
   */
  get isDefault(): boolean {
    return this._isDefault;
  }

  /**
   * Get cart notes
   */
  get notes(): string | undefined {
    return this._notes;
  }

  /**
   * Get total number of items in cart
   */
  get totalItems(): number {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Get cart subtotal
   */
  get subtotal(): number {
    return this._items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  /**
   * Get last modification timestamp
   */
  get lastModifiedAt(): Date {
    return this._lastModifiedAt;
  }

  // ============================================
  // Business Logic Methods
  // ============================================

  /**
   * Add an item to the cart.
   * If item with same productId exists, increases quantity.
   *
   * @param productId - Product ID
   * @param productName - Product name
   * @param sku - Product SKU
   * @param quantity - Quantity to add
   * @param unitPrice - Unit price
   * @param notes - Optional item notes
   */
  addItem(
    productId: string,
    productName: string,
    sku: string,
    quantity: number,
    unitPrice: number,
    notes?: string,
  ): void {
    // Check if item already exists
    const existingItem = this._items.find((item) => item.productId === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.subtotal = existingItem.quantity * existingItem.unitPrice;
      if (notes) {
        existingItem.notes = notes;
      }
    } else {
      this._items.push({
        id: `item_${randomUUID()}`,
        productId,
        productName,
        sku,
        quantity,
        unitPrice,
        subtotal: quantity * unitPrice,
        notes,
      });
    }

    this._lastModifiedAt = new Date();
  }

  /**
   * Remove an item from the cart.
   *
   * @param productId - Product ID of item to remove
   */
  removeItem(productId: string): void {
    const index = this._items.findIndex((item) => item.productId === productId);
    if (index >= 0) {
      this._items.splice(index, 1);
      this._lastModifiedAt = new Date();
    }
  }

  /**
   * Update quantity of an item.
   *
   * @param productId - Product ID
   * @param quantity - New quantity
   * @throws {Error} If product not found
   */
  updateItemQuantity(productId: string, quantity: number): void {
    const item = this._items.find((item) => item.productId === productId);

    if (!item) {
      throw new Error(`Item with product ID ${productId} not found in cart`);
    }

    if (quantity <= 0) {
      this.removeItem(productId);
    } else {
      item.quantity = quantity;
      item.subtotal = quantity * item.unitPrice;
      this._lastModifiedAt = new Date();
    }
  }

  /**
   * Clear all items from the cart.
   */
  clear(): void {
    this._items = [];
    this._lastModifiedAt = new Date();
  }

  /**
   * Rename the cart.
   *
   * @param newName - New cart name
   */
  rename(newName: string): void {
    this._name = newName;
    this._lastModifiedAt = new Date();
  }

  /**
   * Set whether this cart is the default cart.
   *
   * @param isDefault - New default status
   */
  setAsDefault(isDefault: boolean): void {
    this._isDefault = isDefault;
    this._lastModifiedAt = new Date();
  }

  /**
   * Update cart notes.
   *
   * @param notes - New notes
   */
  updateNotes(notes?: string): void {
    this._notes = notes;
    this._lastModifiedAt = new Date();
  }

  /**
   * Convert cart to order data.
   * This prepares the cart items for order creation.
   *
   * @returns Order item data ready for order creation
   * @throws {EmptyCartError} If cart is empty
   */
  convertToOrder(): Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }> {
    if (this._items.length === 0) {
      throw new EmptyCartError(this.id);
    }

    return this._items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
  }

  /**
   * Duplicate the cart with a new name and reset modification time.
   *
   * @param newCartId - ID for the duplicated cart
   * @param newCartName - Name for the duplicated cart
   * @returns New SavedCart instance
   */
  duplicate(newCartId: string, newCartName: string): SavedCart {
    const newCart = new SavedCart(
      newCartId,
      this.customerId,
      newCartName,
      [], // items (will be populated below)
      false, // isDefault
      this._notes,
    );

    // Copy items
    for (const item of this._items) {
      newCart.addItem(
        item.productId,
        item.productName,
        item.sku,
        item.quantity,
        item.unitPrice,
        item.notes,
      );
    }

    return newCart;
  }

  /**
   * Check if cart is empty.
   *
   * @returns true if cart has no items
   */
  isEmpty(): boolean {
    return this._items.length === 0;
  }

  /**
   * Check if cart has expired.
   * Carts are considered expired if not modified in 30 days.
   *
   * @param maxAgeDays - Maximum age in days (default: 30)
   * @returns true if cart has expired
   */
  isExpired(maxAgeDays: number = 30): boolean {
    const expirationDate = new Date(this._lastModifiedAt);
    expirationDate.setDate(expirationDate.getDate() + maxAgeDays);
    return new Date() > expirationDate;
  }
}
