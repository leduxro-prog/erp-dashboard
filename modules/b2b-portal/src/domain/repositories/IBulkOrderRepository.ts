/**
 * Bulk Order Repository Interface (Port)
 * Defines contract for bulk order data access.
 *
 * @module B2B Portal - Domain Ports
 */

import { BulkOrder, BulkOrderStatus } from '../entities/BulkOrder';
import { PaginatedResult, PaginationParams } from './IRegistrationRepository';

/**
 * Bulk order filter options
 */
export interface BulkOrderFilters {
  status?: BulkOrderStatus;
  sourceType?: string;
  search?: string;
  createdFromDate?: Date;
  createdToDate?: Date;
}

/**
 * Bulk Order Repository Interface
 *
 * Defines data access operations for bulk orders.
 *
 * @interface IBulkOrderRepository
 */
export interface IBulkOrderRepository {
  /**
   * Save a bulk order (create or update).
   *
   * @param order - Order entity to save
   * @returns Saved order
   */
  save(order: BulkOrder): Promise<BulkOrder>;

  /**
   * Find a bulk order by ID.
   *
   * @param id - Order ID
   * @returns Order or undefined if not found
   */
  findById(id: string): Promise<BulkOrder | undefined>;

  /**
   * Find all bulk orders for a customer (paginated).
   *
   * @param customerId - Customer ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filter criteria
   * @returns Paginated list of orders
   */
  findByCustomer(
    customerId: string,
    pagination: PaginationParams,
    filters?: BulkOrderFilters
  ): Promise<PaginatedResult<BulkOrder>>;

  /**
   * Update bulk order status.
   *
   * @param id - Order ID
   * @param status - New status
   * @returns Updated order
   */
  updateStatus(id: string, status: BulkOrderStatus): Promise<BulkOrder>;

  /**
   * Delete a bulk order.
   *
   * @param id - Order ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count bulk orders by status.
   *
   * @param status - Order status
   * @returns Count of orders with that status
   */
  countByStatus(status: BulkOrderStatus): Promise<number>;

  /**
   * Find all bulk orders with specific status (paginated).
   *
   * @param status - Order status
   * @param pagination - Pagination parameters
   * @returns Paginated list of orders
   */
  findByStatus(
    status: BulkOrderStatus,
    pagination: PaginationParams
  ): Promise<PaginatedResult<BulkOrder>>;

  /**
   * Find failed or partially completed bulk orders (paginated).
   * Used for retry operations.
   *
   * @param pagination - Pagination parameters
   * @returns Paginated list of problematic orders
   */
  findProblematic(pagination: PaginationParams): Promise<PaginatedResult<BulkOrder>>;
}
