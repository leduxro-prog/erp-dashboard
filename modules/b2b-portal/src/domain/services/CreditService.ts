/**
 * Credit Management Service
 * Manages credit limits, tracking usage, and validating order eligibility.
 *
 * @module B2B Portal - Domain Services
 */

import { B2BCustomer } from '../entities/B2BCustomer';
import { CreditTransaction, CreditTransactionType } from '../entities/CreditTransaction';
import { InsufficientCreditError } from '../errors/b2b.errors';
import { randomUUID } from 'crypto';

/**
 * Credit Service
 *
 * Encapsulates business logic for credit limit management including:
 * - Validating available credit for orders
 * - Recording credit usage
 * - Releasing credit on order cancellation
 * - Tracking credit history
 *
 * @class CreditService
 */
export class CreditService {
  /**
   * Validate that a customer has sufficient credit for an order.
   *
   * @param customer - B2B customer
   * @param orderAmount - Order total amount
   * @throws {InsufficientCreditError} If insufficient credit available
   */
  validateSufficientCredit(customer: B2BCustomer, orderAmount: number): void {
    if (!customer.hasAvailableCredit(orderAmount)) {
      throw new InsufficientCreditError(customer.availableCredit, orderAmount);
    }
  }

  /**
   * Use credit for an order.
   * Creates a transaction record and updates customer credit.
   *
   * @param customer - B2B customer
   * @param amount - Amount to use
   * @param orderId - Related order ID
   * @param userId - User creating the transaction
   * @returns Created transaction
   * @throws {InsufficientCreditError} If insufficient credit
   */
  useCredit(
    customer: B2BCustomer,
    amount: number,
    orderId: string,
    userId: string,
  ): CreditTransaction {
    // Validate sufficient credit
    this.validateSufficientCredit(customer, amount);

    // Record usage in customer
    const balanceBefore = customer.availableCredit;
    customer.useCredit(amount);

    // Create transaction
    return CreditTransaction.createUsage(
      `txn_${randomUUID()}`,
      customer.id,
      amount,
      balanceBefore,
      orderId,
      userId,
    );
  }

  /**
   * Release credit from an order (e.g., due to cancellation).
   * Creates a transaction record and updates customer credit.
   *
   * @param customer - B2B customer
   * @param amount - Amount to release
   * @param orderId - Related order ID
   * @param userId - User creating the transaction
   * @returns Created transaction
   */
  releaseCredit(
    customer: B2BCustomer,
    amount: number,
    orderId: string,
    userId: string,
  ): CreditTransaction {
    const balanceBefore = customer.availableCredit;
    customer.releaseCredit(amount);

    return CreditTransaction.createRelease(
      `txn_${randomUUID()}`,
      customer.id,
      amount,
      balanceBefore,
      orderId,
      userId,
    );
  }

  /**
   * Adjust credit limit (admin operation).
   * Positive amount increases limit, negative decreases it.
   *
   * @param customer - B2B customer
   * @param amount - Amount to adjust (positive or negative)
   * @param reason - Reason for adjustment
   * @param userId - Admin user ID
   * @returns Created transaction
   */
  adjustCredit(
    customer: B2BCustomer,
    amount: number,
    reason: string,
    userId: string,
  ): CreditTransaction {
    const balanceBefore = customer.availableCredit;
    const newLimit = Math.max(0, customer.creditLimit + amount);
    customer.updateCreditLimit(newLimit);

    return CreditTransaction.createAdjustment(
      `txn_${randomUUID()}`,
      customer.id,
      amount,
      balanceBefore,
      reason,
      userId,
    );
  }

  /**
   * Calculate available credit percentage.
   *
   * @param customer - B2B customer
   * @returns Percentage of credit available (0-100)
   */
  getAvailableCreditPercentage(customer: B2BCustomer): number {
    if (customer.creditLimit === 0) {
      return 0;
    }

    return (customer.availableCredit / customer.creditLimit) * 100;
  }

  /**
   * Calculate used credit percentage.
   *
   * @param customer - B2B customer
   * @returns Percentage of credit used (0-100)
   */
  getUsedCreditPercentage(customer: B2BCustomer): number {
    if (customer.creditLimit === 0) {
      return 0;
    }

    return (customer.usedCredit / customer.creditLimit) * 100;
  }

  /**
   * Check if customer is approaching credit limit.
   * Threshold is configurable (default: 80%).
   *
   * @param customer - B2B customer
   * @param warningThreshold - Warning percentage (default: 80)
   * @returns true if used credit exceeds warning threshold
   */
  isApproachingLimit(customer: B2BCustomer, warningThreshold: number = 80): boolean {
    return this.getUsedCreditPercentage(customer) >= warningThreshold;
  }

  /**
   * Check if customer has exceeded credit limit.
   * Should not normally happen if validation is correct.
   *
   * @param customer - B2B customer
   * @returns true if used credit exceeds limit
   */
  hasExceededLimit(customer: B2BCustomer): boolean {
    return customer.usedCredit > customer.creditLimit;
  }

  /**
   * Calculate credit utilization statistics.
   *
   * @param customers - Array of customers
   * @returns Statistics object
   */
  calculateUtilizationStats(customers: B2BCustomer[]): {
    totalLimit: number;
    totalUsed: number;
    totalAvailable: number;
    averageUtilization: number;
    customersApproachingLimit: number;
  } {
    const stats = {
      totalLimit: 0,
      totalUsed: 0,
      totalAvailable: 0,
      averageUtilization: 0,
      customersApproachingLimit: 0,
    };

    for (const customer of customers) {
      stats.totalLimit += customer.creditLimit;
      stats.totalUsed += customer.usedCredit;
      stats.totalAvailable += customer.availableCredit;

      if (this.isApproachingLimit(customer)) {
        stats.customersApproachingLimit++;
      }
    }

    stats.averageUtilization =
      stats.totalLimit > 0 ? (stats.totalUsed / stats.totalLimit) * 100 : 0;

    return stats;
  }
}
