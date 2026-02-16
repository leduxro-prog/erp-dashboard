/**
 * B2B Customer Repository Interface (Port)
 * Defines contract for B2B customer data access.
 *
 * @module B2B Portal - Domain Ports
 */

import { B2BCustomer, B2BCustomerTier } from '../entities/B2BCustomer';
import { PaginatedResult, PaginationParams } from './IRegistrationRepository';

/**
 * Customer filter options
 */
export interface CustomerFilters {
  tier?: B2BCustomerTier;
  isActive?: boolean;
  search?: string;
  minTotalSpent?: number;
  maxTotalSpent?: number;
}

/**
 * B2B Customer Repository Interface
 *
 * Defines data access operations for B2B customers.
 * Implementations provide persistence and retrieval of customer entities.
 *
 * @interface IB2BCustomerRepository
 */
export interface IB2BCustomerRepository {
  /**
   * Save a customer (create or update).
   *
   * @param customer - Customer entity to save
   * @returns Saved customer
   */
  save(customer: B2BCustomer): Promise<B2BCustomer>;

  /**
   * Find a customer by ID.
   *
   * @param id - Customer ID
   * @returns Customer or undefined if not found
   */
  findById(id: string): Promise<B2BCustomer | undefined>;

  /**
   * Find a customer by CUI.
   *
   * @param cui - Romanian CUI
   * @returns Customer or undefined if not found
   */
  findByCui(cui: string): Promise<B2BCustomer | undefined>;

  /**
   * Find a customer by registration ID.
   *
   * @param registrationId - B2B registration ID
   * @returns Customer or undefined if not found
   */
  findByRegistrationId(registrationId: string): Promise<B2BCustomer | undefined>;

  /**
   * Find all customers with a specific tier (paginated).
   *
   * @param tier - Customer tier
   * @param pagination - Pagination parameters
   * @returns Paginated list of customers
   */
  findByTier(
    tier: B2BCustomerTier,
    pagination: PaginationParams
  ): Promise<PaginatedResult<B2BCustomer>>;

  /**
   * Find all active customers (paginated).
   *
   * @param pagination - Pagination parameters
   * @returns Paginated list of active customers
   */
  findActive(pagination: PaginationParams): Promise<PaginatedResult<B2BCustomer>>;

  /**
   * Search customers with filters and pagination.
   *
   * @param filters - Filter criteria
   * @param pagination - Pagination parameters
   * @returns Paginated list of customers
   */
  search(
    filters: CustomerFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<B2BCustomer>>;

  /**
   * Update customer credit limit.
   *
   * @param id - Customer ID
   * @param newLimit - New credit limit
   * @returns Updated customer
   */
  updateCredit(id: string, newLimit: number): Promise<B2BCustomer>;

  /**
   * Update customer tier.
   *
   * @param id - Customer ID
   * @param newTier - New tier
   * @returns Updated customer
   */
  updateTier(id: string, newTier: B2BCustomerTier): Promise<B2BCustomer>;

  /**
   * Update customer status (active/inactive).
   *
   * @param id - Customer ID
   * @param isActive - New active status
   * @returns Updated customer
   */
  updateStatus(id: string, isActive: boolean): Promise<B2BCustomer>;

  /**
   * Delete a customer.
   *
   * @param id - Customer ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count active customers.
   *
   * @returns Count of active customers
   */
  countActive(): Promise<number>;

  /**
   * Get customers due for tier recalculation.
   * Returns customers with orders in the last 30 days.
   *
   * @param pagination - Pagination parameters
   * @returns Paginated list of customers
   */
  findDueForRecalculation(
    pagination: PaginationParams
  ): Promise<PaginatedResult<B2BCustomer>>;
}
