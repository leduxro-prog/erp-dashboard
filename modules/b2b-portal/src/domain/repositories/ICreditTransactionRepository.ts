/**
 * Credit Transaction Repository Interface (Port)
 * Defines contract for credit transaction data access.
 *
 * @module B2B Portal - Domain Ports
 */

import { CreditTransaction, CreditTransactionType } from '../entities/CreditTransaction';
import { PaginatedResult, PaginationParams } from './IRegistrationRepository';

/**
 * Credit transaction filter options
 */
export interface CreditTransactionFilters {
  type?: CreditTransactionType;
  minAmount?: number;
  maxAmount?: number;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Credit Transaction Repository Interface
 *
 * Defines data access operations for credit transactions.
 *
 * @interface ICreditTransactionRepository
 */
export interface ICreditTransactionRepository {
  /**
   * Save a credit transaction (immutable, insert only).
   *
   * @param transaction - Transaction entity to save
   * @returns Saved transaction
   */
  save(transaction: CreditTransaction): Promise<CreditTransaction>;

  /**
   * Find a transaction by ID.
   *
   * @param id - Transaction ID
   * @returns Transaction or undefined if not found
   */
  findById(id: string): Promise<CreditTransaction | undefined>;

  /**
   * Get transaction history for a customer (paginated, newest first).
   *
   * @param customerId - Customer ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filter criteria
   * @returns Paginated list of transactions
   */
  findByCustomer(
    customerId: string,
    pagination: PaginationParams,
    filters?: CreditTransactionFilters
  ): Promise<PaginatedResult<CreditTransaction>>;

  /**
   * Get the latest transaction for a customer.
   *
   * @param customerId - Customer ID
   * @returns Latest transaction or undefined if none exist
   */
  findLatest(customerId: string): Promise<CreditTransaction | undefined>;

  /**
   * Get all transactions for an order.
   *
   * @param orderId - Order ID
   * @returns List of transactions
   */
  findByOrderId(orderId: string): Promise<CreditTransaction[]>;

  /**
   * Get total usage for a customer within date range.
   *
   * @param customerId - Customer ID
   * @param fromDate - Start date
   * @param toDate - End date
   * @returns Total amount used
   */
  getTotalUsage(customerId: string, fromDate: Date, toDate: Date): Promise<number>;

  /**
   * Count transactions for a customer.
   *
   * @param customerId - Customer ID
   * @returns Count of transactions
   */
  countByCustomer(customerId: string): Promise<number>;

  /**
   * Get transactions by type for a customer.
   *
   * @param customerId - Customer ID
   * @param type - Transaction type
   * @param pagination - Pagination parameters
   * @returns Paginated list of transactions
   */
  findByType(
    customerId: string,
    type: CreditTransactionType,
    pagination: PaginationParams
  ): Promise<PaginatedResult<CreditTransaction>>;
}
