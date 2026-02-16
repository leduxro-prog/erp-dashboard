import { Report } from '../entities/Report';
import { PaginatedResult } from './IDashboardRepository';

/**
 * Report Repository Interface
 *
 * Defines persistence operations for Report entities.
 * Implementations handle storage and retrieval of reports
 * from a database.
 *
 * @interface IReportRepository
 */
export interface IReportRepository {
  /**
   * Save a report (create or update)
   * If report.id already exists, updates it. Otherwise creates new.
   *
   * @param report - Report to save
   * @returns Promise resolving to saved report
   * @throws Error if save fails
   */
  save(report: Report): Promise<Report>;

  /**
   * Find a report by ID
   *
   * @param id - Report ID
   * @returns Promise resolving to report, or null if not found
   */
  findById(id: string): Promise<Report | null>;

  /**
   * Find all reports (with optional filters)
   *
   * @param filters - Optional filters
   * @param page - Page number (default: 0)
   * @param pageSize - Results per page (default: 20)
   * @returns Promise resolving to paginated reports
   */
  findAll(
    filters?: ReportFilter,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResult<Report>>;

  /**
   * Find all reports that are scheduled for automatic generation
   * Used by background jobs to determine which reports to generate
   *
   * @returns Promise resolving to array of scheduled reports
   */
  findScheduled(): Promise<Report[]>;

  /**
   * Update when a report was last generated
   * Used to track report execution history
   *
   * @param reportId - Report ID
   * @param lastGeneratedAt - Timestamp of generation
   * @param incrementCount - Whether to increment generation counter (default: true)
   * @returns Promise that resolves when update is complete
   * @throws Error if report not found
   */
  updateLastGenerated(
    reportId: string,
    lastGeneratedAt: Date,
    incrementCount?: boolean
  ): Promise<void>;

  /**
   * Delete a report by ID
   *
   * @param id - Report ID
   * @returns Promise that resolves when delete is complete
   * @throws Error if report not found
   */
  delete(id: string): Promise<void>;
}

/**
 * Report filter options
 */
export interface ReportFilter {
  /** Filter by report creator */
  createdBy?: string;

  /** Filter by report type */
  type?: string;

  /** Filter by scheduled status */
  isScheduled?: boolean;

  /** Filter by date range of creation */
  createdAfter?: Date;
  createdBefore?: Date;
}
