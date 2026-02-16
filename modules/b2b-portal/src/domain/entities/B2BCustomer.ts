/**
 * B2B Customer Domain Entity
 * Represents an approved B2B business customer with credit limits and tier pricing.
 *
 * @module B2B Portal - Domain
 */

import { InsufficientCreditError, CustomerSuspendedError } from '../errors/b2b.errors';

/**
 * B2B Customer tier enumeration
 */
export enum B2BCustomerTier {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

/**
 * Tier discount mapping
 */
const TIER_DISCOUNTS: Record<B2BCustomerTier, number> = {
  [B2BCustomerTier.STANDARD]: 0,
  [B2BCustomerTier.SILVER]: 0.05,
  [B2BCustomerTier.GOLD]: 0.1,
  [B2BCustomerTier.PLATINUM]: 0.15,
};

/**
 * B2B Customer Domain Entity
 *
 * Encapsulates business logic for B2B customers including:
 * - Credit limit management and tracking
 * - Tier-based pricing and discounts
 * - Order eligibility validation
 * - Payment terms
 *
 * @class B2BCustomer
 */
export class B2BCustomer {
  /**
   * Unique customer identifier
   */
  readonly id: string;

  /**
   * Reference to B2B registration that created this customer
   */
  readonly registrationId: string;

  /**
   * Company name
   */
  readonly companyName: string;

  /**
   * Romanian CUI
   */
  readonly cui: string;

  /**
   * Customer pricing tier
   */
  private _tier: B2BCustomerTier;

  /**
   * Total credit limit assigned
   */
  private _creditLimit: number;

  /**
   * Credit currently in use
   */
  private _usedCredit: number;

  /**
   * Payment terms in days (0, 15, 30, 45, 60)
   */
  private _paymentTermsDays: number;

  /**
   * Whether customer account is active
   */
  private _isActive: boolean;

  /**
   * Timestamp of last order placed
   */
  private _lastOrderAt?: Date;

  /**
   * Total number of orders placed
   */
  private _totalOrders: number;

  /**
   * Total amount spent (in RON)
   */
  private _totalSpent: number;

  /**
   * Optional sales representative ID
   */
  private _salesRepId?: string;

  /**
   * Creation timestamp
   */
  readonly createdAt: Date;

  /**
   * Last update timestamp
   */
  private _updatedAt: Date;

  /**
   * Create a new B2B Customer entity.
   *
   * @param id - Unique customer ID
   * @param registrationId - B2B registration ID
   * @param companyName - Company name
   * @param cui - Romanian CUI
   * @param tier - Initial pricing tier
   * @param creditLimit - Credit limit
   * @param paymentTermsDays - Payment terms
   * @param salesRepId - Optional sales representative
   */
  constructor(
    id: string,
    registrationId: string,
    companyName: string,
    cui: string,
    tier: B2BCustomerTier,
    creditLimit: number,
    paymentTermsDays: number,
    salesRepId?: string,
    usedCredit: number = 0,
    isActive: boolean = true,
    createdAt?: Date,
    updatedAt?: Date,
    totalOrders: number = 0,
    totalSpent: number = 0
  ) {
    this.id = id;
    this.registrationId = registrationId;
    this.companyName = companyName;
    this.cui = cui;
    this._tier = tier;
    this._creditLimit = creditLimit;
    this._usedCredit = usedCredit;
    this._paymentTermsDays = paymentTermsDays;
    this._isActive = isActive;
    this._totalOrders = totalOrders;
    this._totalSpent = totalSpent;
    this._salesRepId = salesRepId;
    this.createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get current pricing tier
   */
  get tier(): B2BCustomerTier {
    return this._tier;
  }

  /**
   * Get total credit limit
   */
  get creditLimit(): number {
    return this._creditLimit;
  }

  /**
   * Get used credit
   */
  get usedCredit(): number {
    return this._usedCredit;
  }

  /**
   * Get available credit (computed)
   */
  get availableCredit(): number {
    return Math.max(0, this._creditLimit - this._usedCredit);
  }

  /**
   * Get payment terms in days
   */
  get paymentTermsDays(): number {
    return this._paymentTermsDays;
  }

  /**
   * Check if customer is active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get last order timestamp
   */
  get lastOrderAt(): Date | undefined {
    return this._lastOrderAt;
  }

  /**
   * Get total number of orders
   */
  get totalOrders(): number {
    return this._totalOrders;
  }

  /**
   * Get total amount spent
   */
  get totalSpent(): number {
    return this._totalSpent;
  }

  /**
   * Get sales representative ID
   */
  get salesRepId(): string | undefined {
    return this._salesRepId;
  }

  /**
   * Get last update timestamp
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ============================================
  // Business Logic Methods
  // ============================================

  /**
   * Check if customer has sufficient available credit for an order.
   *
   * @param amount - Order amount to check
   * @returns true if available credit >= amount
   */
  hasAvailableCredit(amount: number): boolean {
    return this.availableCredit >= amount;
  }

  /**
   * Use credit for an order (deduct from available credit).
   * This represents a credit hold, not a final charge.
   *
   * @param amount - Amount to deduct
   * @throws {InsufficientCreditError} If amount exceeds available credit
   * @throws {CustomerSuspendedError} If customer is not active
   */
  useCredit(amount: number): void {
    if (!this._isActive) {
      throw new CustomerSuspendedError(this.id);
    }

    if (amount > this.availableCredit) {
      throw new InsufficientCreditError(this.availableCredit, amount);
    }

    this._usedCredit += amount;
    this._updatedAt = new Date();
  }

  /**
   * Release credit (reverse a credit hold).
   * Used when an order is cancelled.
   *
   * @param amount - Amount to release
   */
  releaseCredit(amount: number): void {
    this._usedCredit = Math.max(0, this._usedCredit - amount);
    this._updatedAt = new Date();
  }

  /**
   * Record that an order was placed.
   * Updates order count, total spent, and last order timestamp.
   *
   * @param orderAmount - Total order amount
   */
  recordOrder(orderAmount: number): void {
    this._totalOrders++;
    this._totalSpent += orderAmount;
    this._lastOrderAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Upgrade customer to a new tier.
   * New tier must be higher or same as current.
   *
   * @param newTier - New tier to upgrade to
   * @throws {Error} If newTier is lower than current tier
   */
  upgradeTier(newTier: B2BCustomerTier): void {
    const currentTierIndex = Object.values(B2BCustomerTier).indexOf(this._tier);
    const newTierIndex = Object.values(B2BCustomerTier).indexOf(newTier);

    if (newTierIndex < currentTierIndex) {
      throw new Error(
        `Cannot downgrade tier from ${this._tier} to ${newTier}`
      );
    }

    this._tier = newTier;
    this._updatedAt = new Date();
  }

  /**
   * Get discount percentage for current tier.
   * Discount is applied to base price.
   *
   * @returns Discount as decimal (0.0 to 0.15)
   */
  calculateDiscount(): number {
    return TIER_DISCOUNTS[this._tier];
  }

  /**
   * Calculate payment due date for an order placed on a given date.
   *
   * @param orderDate - Order placement date
   * @returns Date when payment is due (order date + payment terms)
   */
  getPaymentDueDate(orderDate: Date): Date {
    const dueDate = new Date(orderDate);
    dueDate.setDate(dueDate.getDate() + this._paymentTermsDays);
    return dueDate;
  }

  /**
   * Check if customer can place an order of a given amount.
   * Validates both credit availability and active status.
   *
   * @param amount - Order amount
   * @returns true if order is allowed
   */
  canPlaceOrder(amount: number): boolean {
    return this._isActive && this.hasAvailableCredit(amount);
  }

  /**
   * Update credit limit.
   *
   * @param newLimit - New credit limit
   */
  updateCreditLimit(newLimit: number): void {
    this._creditLimit = newLimit;
    this._updatedAt = new Date();
  }

  /**
   * Update payment terms.
   *
   * @param days - New payment terms in days
   */
  updatePaymentTerms(days: number): void {
    this._paymentTermsDays = days;
    this._updatedAt = new Date();
  }

  /**
   * Suspend the customer account.
   */
  suspend(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * Reactivate the customer account.
   */
  reactivate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * Assign or change sales representative.
   *
   * @param salesRepId - Sales representative user ID
   */
  assignSalesRep(salesRepId: string): void {
    this._salesRepId = salesRepId;
    this._updatedAt = new Date();
  }

  /**
   * Remove sales representative assignment.
   */
  removeSalesRep(): void {
    this._salesRepId = undefined;
    this._updatedAt = new Date();
  }
}
