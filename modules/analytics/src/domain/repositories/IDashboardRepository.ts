import { Dashboard } from '../entities/Dashboard';

/**
 * Dashboard Repository Interface
 *
 * Defines persistence operations for Dashboard entities.
 * Implementations handle storage and retrieval of dashboards
 * (e.g., TypeORM implementation using SQL database).
 *
 * @interface IDashboardRepository
 */
export interface IDashboardRepository {
  /**
   * Save a dashboard (create or update)
   * If dashboard.id already exists, updates it. Otherwise creates new.
   *
   * @param dashboard - Dashboard to save
   * @returns Promise resolving to saved dashboard
   * @throws Error if save fails
   */
  save(dashboard: Dashboard): Promise<Dashboard>;

  /**
   * Find a dashboard by ID
   *
   * @param id - Dashboard ID
   * @returns Promise resolving to dashboard, or null if not found
   */
  findById(id: string): Promise<Dashboard | null>;

  /**
   * Find all dashboards owned by a user (paginated)
   *
   * @param ownerId - Owner user ID
   * @param page - Page number (0-indexed, default: 0)
   * @param pageSize - Results per page (default: 20)
   * @returns Promise resolving to paginated dashboards
   */
  findByOwner(
    ownerId: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResult<Dashboard>>;

  /**
   * Find all shared dashboards (visible to other users)
   * Optionally filtered by visibility settings
   *
   * @param page - Page number (default: 0)
   * @param pageSize - Results per page (default: 20)
   * @returns Promise resolving to paginated shared dashboards
   */
  findShared(page?: number, pageSize?: number): Promise<PaginatedResult<Dashboard>>;

  /**
   * Find the default dashboard for a user
   * (the dashboard they see when they first log in)
   *
   * @param ownerId - Owner user ID
   * @returns Promise resolving to default dashboard, or null if none set
   */
  findDefault(ownerId: string): Promise<Dashboard | null>;

  /**
   * Delete a dashboard by ID
   * Also deletes all widgets on the dashboard
   *
   * @param id - Dashboard ID
   * @returns Promise that resolves when delete is complete
   * @throws Error if dashboard not found
   */
  delete(id: string): Promise<void>;
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  /** Items in this page */
  items: T[];

  /** Current page number (0-indexed) */
  page: number;

  /** Number of items per page */
  pageSize: number;

  /** Total number of items matching query */
  total: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there is a next page */
  hasNext: boolean;

  /** Whether there is a previous page */
  hasPrev: boolean;
}
