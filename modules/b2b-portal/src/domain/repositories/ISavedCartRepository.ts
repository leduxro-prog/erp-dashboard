/**
 * Saved Cart Repository Interface (Port)
 * Defines contract for saved cart data access.
 *
 * @module B2B Portal - Domain Ports
 */

import { SavedCart } from '../entities/SavedCart';
import { PaginatedResult, PaginationParams } from './IRegistrationRepository';

/**
 * Saved Cart Repository Interface
 *
 * Defines data access operations for saved carts.
 *
 * @interface ISavedCartRepository
 */
export interface ISavedCartRepository {
  /**
   * Save a cart (create or update).
   *
   * @param cart - Cart entity to save
   * @returns Saved cart
   */
  save(cart: SavedCart): Promise<SavedCart>;

  /**
   * Find a cart by ID.
   *
   * @param id - Cart ID
   * @returns Cart or undefined if not found
   */
  findById(id: string): Promise<SavedCart | undefined>;

  /**
   * Find all carts for a customer (paginated).
   *
   * @param customerId - Customer ID
   * @param pagination - Pagination parameters
   * @returns Paginated list of carts
   */
  findByCustomer(
    customerId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<SavedCart>>;

  /**
   * Find the default cart for a customer.
   *
   * @param customerId - Customer ID
   * @returns Default cart or undefined if not found
   */
  findDefault(customerId: string): Promise<SavedCart | undefined>;

  /**
   * Delete a cart.
   *
   * @param id - Cart ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count carts for a customer.
   *
   * @param customerId - Customer ID
   * @returns Number of carts
   */
  countByCustomer(customerId: string): Promise<number>;

  /**
   * Find carts older than a specified number of days (for cleanup).
   *
   * @param olderThanDays - Number of days
   * @param pagination - Pagination parameters
   * @returns Paginated list of old carts
   */
  findOlderThan(
    olderThanDays: number,
    pagination: PaginationParams
  ): Promise<PaginatedResult<SavedCart>>;

  /**
   * Set a cart as the default for a customer.
   *
   * @param cartId - Cart ID to set as default
   * @param customerId - Customer ID
   * @returns Updated cart
   */
  setAsDefault(cartId: string, customerId: string): Promise<SavedCart>;
}
