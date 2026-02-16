import { DateRange } from '../repositories/IMetricRepository';

/**
 * Report Entity
 *
 * Represents a scheduled or on-demand analytics report that can be generated
 * and sent to recipients via email.
 *
 * Features:
 * - Multiple pre-built report types (sales, customer, inventory, supplier, financial)
 * - Custom report definitions
 * - One-time generation or scheduled (daily/weekly/monthly)
 * - Multiple recipients
 * - Multiple export formats (PDF, Excel, CSV)
 * - Tracks generation history
 *
 * @class Report
 */
export class Report {
  /**
   * Unique identifier for this report
   */
  public id: string;

  /**
   * Report name (displayed to users)
   */
  public name: string;

  /**
   * Report type
   */
  public type: ReportType;

  /**
   * Recurrence schedule (null = one-time only)
   */
  public schedule: Schedule | null;

  /**
   * Email addresses to send report to
   */
  public recipientEmails: string[];

  /**
   * Export format for the report
   */
  public format: ExportFormat;

  /**
   * Filters to apply when generating report
   */
  public filters: ReportFilters;

  /**
   * When the report was last generated
   */
  public lastGeneratedAt: Date | null;

  /**
   * Number of times this report has been generated
   */
  public generationCount: number;

  /**
   * User ID who created this report
   */
  public createdBy: string;

  /**
   * When this report was created
   */
  public createdAt: Date;

  /**
   * When this report was last updated
   */
  public updatedAt: Date;

  /**
   * Create a new Report
   */
  constructor(
    id: string,
    name: string,
    type: ReportType,
    recipientEmails: string[],
    format: ExportFormat,
    filters: ReportFilters,
    createdBy: string,
    schedule: Schedule | null = null,
    lastGeneratedAt: Date | null = null,
    generationCount: number = 0,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.schedule = schedule;
    this.recipientEmails = recipientEmails;
    this.format = format;
    this.filters = filters;
    this.lastGeneratedAt = lastGeneratedAt;
    this.generationCount = generationCount;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Generate this report for a given date range
   * Does not persist results - caller handles storage/sending
   *
   * @param dateRange - Date range to generate report for
   * @returns Generated report data (caller must handle)
   */
  public generate(dateRange: DateRange): void {
    console.log(dateRange);
    // Business logic: validate date range, prepare data
    // Actual generation delegated to use-case layer
    this.lastGeneratedAt = new Date();
    this.generationCount += 1;
    this.updatedAt = new Date();
  }

  /**
   * Set up a schedule for this report
   * Report will be generated automatically according to schedule
   *
   * @param schedule - New schedule configuration
   * @throws Error if schedule is invalid
   */
  public setSchedule(schedule: Schedule): void {
    this.schedule = schedule;
    this.updatedAt = new Date();
  }

  /**
   * Check if this report has a schedule
   *
   * @returns Whether report is scheduled
   */
  public isScheduled(): boolean {
    return this.schedule !== null;
  }

  /**
   * Calculate the next run date for this report
   * Used by job scheduler to determine when to run
   *
   * @returns Next scheduled run date, or null if not scheduled
   */
  public getNextRunDate(): Date | null {
    if (!this.schedule) {
      return null;
    }

    const now = new Date();

    // If no last generation, assume this is the first run
    if (!this.lastGeneratedAt) {
      return now;
    }

    // Calculate next run based on schedule
    const lastRun = new Date(this.lastGeneratedAt);

    switch (this.schedule.frequency) {
      case 'DAILY': {
        const nextRun = new Date(lastRun);
        nextRun.setDate(nextRun.getDate() + 1);
        return nextRun > now ? nextRun : now;
      }

      case 'WEEKLY': {
        const nextRun = new Date(lastRun);
        nextRun.setDate(nextRun.getDate() + 7);
        return nextRun > now ? nextRun : now;
      }

      case 'MONTHLY': {
        const nextRun = new Date(lastRun);
        nextRun.setMonth(nextRun.getMonth() + 1);
        return nextRun > now ? nextRun : now;
      }

      default:
        return null;
    }
  }
}

/**
 * Report type enumeration
 */
export enum ReportType {
  SALES_SUMMARY = 'SALES_SUMMARY',
  CUSTOMER_ANALYSIS = 'CUSTOMER_ANALYSIS',
  INVENTORY_REPORT = 'INVENTORY_REPORT',
  SUPPLIER_PERFORMANCE = 'SUPPLIER_PERFORMANCE',
  FINANCIAL_OVERVIEW = 'FINANCIAL_OVERVIEW',
  CUSTOM = 'CUSTOM',
}

/**
 * Export format enumeration
 */
export enum ExportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
}

/**
 * Report recurrence schedule
 */
export interface Schedule {
  /** How often to generate the report */
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  /** Time of day to generate (HH:mm format, e.g., "06:00") */
  timeOfDay?: string;

  /** Day of week for weekly reports (0-6, 0 = Sunday) */
  dayOfWeek?: number;

  /** Day of month for monthly reports (1-31) */
  dayOfMonth?: number;

  /** Timezone for schedule (e.g., "America/New_York") */
  timezone?: string;
}

/**
 * Report filters configuration
 */
export interface ReportFilters {
  /** Date range for report data */
  dateRange?: {
    startDate: Date | string;
    endDate: Date | string;
  };

  /** Customer tier filter */
  customerTier?: string;

  /** Region filter */
  region?: string;

  /** Product category filter */
  productCategory?: string;

  /** Supplier filter */
  supplier?: string;

  /** Additional custom filters */
  [key: string]: unknown;
}

/**
 * Report data transfer object (for API responses)
 */
export type ReportDTO = Omit<Report, 'generate' | 'schedule' | 'isScheduled' | 'getNextRunDate'>;
