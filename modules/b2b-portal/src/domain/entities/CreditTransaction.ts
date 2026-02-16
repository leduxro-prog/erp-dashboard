/**
 * Credit Transaction Domain Entity (Value Object)
 * Represents an immutable record of credit limit changes.
 *
 * @module B2B Portal - Domain
 */

/**
 * Credit transaction type
 */
export enum CreditTransactionType {
  USE = 'USE',
  RELEASE = 'RELEASE',
  ADJUSTMENT = 'ADJUSTMENT',
}

/**
 * Credit Transaction Value Object
 *
 * Immutable record of a credit transaction.
 * Used for audit trail and credit history.
 *
 * @class CreditTransaction
 */
export class CreditTransaction {
  /**
   * Unique transaction ID
   */
  readonly id: string;

  /**
   * Customer ID
   */
  readonly customerId: string;

  /**
   * Transaction type
   */
  readonly type: CreditTransactionType;

  /**
   * Amount transacted
   */
  readonly amount: number;

  /**
   * Related order ID (for USE transactions)
   */
  readonly orderId?: string;

  /**
   * Description of the transaction
   */
  readonly description: string;

  /**
   * Credit balance before transaction
   */
  readonly balanceBefore: number;

  /**
   * Credit balance after transaction
   */
  readonly balanceAfter: number;

  /**
   * User ID who created the transaction
   */
  readonly createdBy: string;

  /**
   * Creation timestamp
   */
  readonly createdAt: Date;

  /**
   * Create a new CreditTransaction.
   * This is an immutable value object - all fields are readonly.
   *
   * @param id - Unique transaction ID
   * @param customerId - Customer ID
   * @param type - Transaction type
   * @param amount - Amount transacted
   * @param balanceBefore - Balance before transaction
   * @param balanceAfter - Balance after transaction
   * @param createdBy - User ID of creator
   * @param description - Transaction description
   * @param orderId - Optional related order ID
   * @param createdAt - Optional custom creation timestamp
   */
  constructor(
    id: string,
    customerId: string,
    type: CreditTransactionType,
    amount: number,
    balanceBefore: number,
    balanceAfter: number,
    createdBy: string,
    description: string,
    orderId?: string,
    createdAt?: Date
  ) {
    this.id = id;
    this.customerId = customerId;
    this.type = type;
    this.amount = amount;
    this.orderId = orderId;
    this.description = description;
    this.balanceBefore = balanceBefore;
    this.balanceAfter = balanceAfter;
    this.createdBy = createdBy;
    this.createdAt = createdAt || new Date();
  }

  /**
   * Create a transaction representing credit usage (for order).
   *
   * @param id - Transaction ID
   * @param customerId - Customer ID
   * @param amount - Amount used
   * @param balanceBefore - Balance before
   * @param orderId - Related order ID
   * @param createdBy - Creator user ID
   * @returns New CreditTransaction
   */
  static createUsage(
    id: string,
    customerId: string,
    amount: number,
    balanceBefore: number,
    orderId: string,
    createdBy: string
  ): CreditTransaction {
    return new CreditTransaction(
      id,
      customerId,
      CreditTransactionType.USE,
      amount,
      balanceBefore,
      balanceBefore - amount,
      createdBy,
      `Credit used for order ${orderId}`,
      orderId
    );
  }

  /**
   * Create a transaction representing credit release (order cancellation).
   *
   * @param id - Transaction ID
   * @param customerId - Customer ID
   * @param amount - Amount released
   * @param balanceBefore - Balance before
   * @param orderId - Related order ID
   * @param createdBy - Creator user ID
   * @returns New CreditTransaction
   */
  static createRelease(
    id: string,
    customerId: string,
    amount: number,
    balanceBefore: number,
    orderId: string,
    createdBy: string
  ): CreditTransaction {
    return new CreditTransaction(
      id,
      customerId,
      CreditTransactionType.RELEASE,
      amount,
      balanceBefore,
      balanceBefore + amount,
      createdBy,
      `Credit released from cancelled order ${orderId}`,
      orderId
    );
  }

  /**
   * Create a transaction representing credit adjustment (admin action).
   *
   * @param id - Transaction ID
   * @param customerId - Customer ID
   * @param amount - Adjustment amount (positive or negative)
   * @param balanceBefore - Balance before
   * @param reason - Reason for adjustment
   * @param createdBy - Creator user ID (admin)
   * @returns New CreditTransaction
   */
  static createAdjustment(
    id: string,
    customerId: string,
    amount: number,
    balanceBefore: number,
    reason: string,
    createdBy: string
  ): CreditTransaction {
    return new CreditTransaction(
      id,
      customerId,
      CreditTransactionType.ADJUSTMENT,
      Math.abs(amount),
      balanceBefore,
      balanceBefore + amount,
      createdBy,
      `Admin adjustment: ${reason}`
    );
  }

  /**
   * Check if transaction increased credit (RELEASE or positive ADJUSTMENT).
   *
   * @returns true if transaction increased credit
   */
  isCredit(): boolean {
    return this.balanceAfter > this.balanceBefore;
  }

  /**
   * Check if transaction decreased credit (USE or negative ADJUSTMENT).
   *
   * @returns true if transaction decreased credit
   */
  isDebit(): boolean {
    return this.balanceAfter < this.balanceBefore;
  }

  /**
   * Get the net change in balance.
   *
   * @returns Positive for credit increase, negative for credit decrease
   */
  getNetChange(): number {
    return this.balanceAfter - this.balanceBefore;
  }

  /**
   * Get a string representation of the transaction.
   *
   * @returns Human-readable transaction summary
   */
  toString(): string {
    const sign = this.isCredit() ? '+' : '';
    return `${this.type} ${sign}${this.amount} (${this.description})`;
  }
}
