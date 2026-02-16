/**
 * B2B Registration Repository Interface (Port)
 * Defines contract for B2B registration data access.
 *
 * @module B2B Portal - Domain Ports
 */

import { B2BRegistration, B2BRegistrationStatus } from '../entities/B2BRegistration';

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Registration filter options
 */
export interface RegistrationFilters {
  status?: B2BRegistrationStatus;
  search?: string;
  createdFromDate?: Date;
  createdToDate?: Date;
}

/**
 * B2B Registration Repository Interface
 *
 * Defines data access operations for B2B registrations.
 * Implementations provide persistence and retrieval of registration entities.
 *
 * @interface IRegistrationRepository
 */
export interface IRegistrationRepository {
  /**
   * Save a registration (create or update).
   *
   * @param registration - Registration entity to save
   * @returns Saved registration
   */
  save(registration: B2BRegistration): Promise<B2BRegistration>;

  /**
   * Find a registration by ID.
   *
   * @param id - Registration ID
   * @returns Registration or undefined if not found
   */
  findById(id: string): Promise<B2BRegistration | undefined>;

  /**
   * Find a registration by email.
   *
   * @param email - Email address
   * @returns Registration or undefined if not found
   */
  findByEmail(email: string): Promise<B2BRegistration | undefined>;

  /**
   * Find a registration by CUI.
   *
   * @param cui - Romanian CUI
   * @returns Registration or undefined if not found
   */
  findByCui(cui: string): Promise<B2BRegistration | undefined>;

  /**
   * Find all pending registrations (paginated).
   *
   * @param pagination - Pagination parameters
   * @returns Paginated list of pending registrations
   */
  findPending(pagination: PaginationParams): Promise<PaginatedResult<B2BRegistration>>;

  /**
   * Find all registrations with optional filters and pagination.
   *
   * @param filters - Optional filter criteria
   * @param pagination - Pagination parameters
   * @returns Paginated list of registrations
   */
  findAll(
    filters?: RegistrationFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<B2BRegistration>>;

  /**
   * Update registration status.
   *
   * @param id - Registration ID
   * @param status - New status
   * @returns Updated registration
   */
  updateStatus(id: string, status: B2BRegistrationStatus): Promise<B2BRegistration>;

  /**
   * Delete a registration.
   *
   * @param id - Registration ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count registrations by status.
   *
   * @param status - Registration status
   * @returns Count of registrations with that status
   */
  countByStatus(status: B2BRegistrationStatus): Promise<number>;
}
