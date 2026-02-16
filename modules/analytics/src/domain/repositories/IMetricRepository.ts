import { MetricSnapshot, MetricType, Period } from '../entities/MetricSnapshot';

/**
 * Metric Repository Interface
 *
 * Defines persistence operations for MetricSnapshot entities.
 * Implementations handle storage and retrieval of metric snapshots
 * from time-series data storage (e.g., SQL with proper indexing or TimescaleDB).
 *
 * @interface IMetricRepository
 */
export interface IMetricRepository {
  /**
   * Save a metric snapshot
   *
   * @param metric - MetricSnapshot to save
   * @returns Promise resolving to saved metric
   * @throws Error if save fails
   */
  save(metric: MetricSnapshot): Promise<MetricSnapshot>;

  /**
   * Find metrics of a specific type within a date range
   * Optionally filter by dimensions
   *
   * @param type - MetricType to find
   * @param period - Time period (DAILY, WEEKLY, MONTHLY, YEARLY)
   * @param dateRange - Date range to search within
   * @param dimensions - Optional dimension filters
   * @returns Promise resolving to array of matching metrics
   */
  findByType(
    type: MetricType,
    period: Period,
    dateRange: DateRange,
    dimensions?: Record<string, string>
  ): Promise<MetricSnapshot[]>;

  /**
   * Find the latest metric snapshot of a given type
   * Returns the most recent snapshot regardless of period
   *
   * @param type - MetricType to find
   * @param dimensions - Optional dimension filters
   * @returns Promise resolving to latest metric, or null if none found
   */
  findLatest(type: MetricType, dimensions?: Record<string, string>): Promise<MetricSnapshot | null>;

  /**
   * Get time-series data for a metric
   * Returns ordered sequence of metrics over time, useful for charting trends
   *
   * @param type - MetricType to fetch
   * @param dateRange - Date range to fetch
   * @param groupBy - Group by dimension (e.g., "product_id", "customer_tier")
   * @returns Promise resolving to time-series metrics
   */
  getTimeSeries(
    type: MetricType,
    dateRange: DateRange,
    groupBy?: string
  ): Promise<TimeSeriesData>;

  /**
   * Aggregate multiple metrics into a single result
   * Useful for composite metrics or comparing multiple metrics
   *
   * @param types - Array of MetricTypes to aggregate
   * @param dateRange - Date range to aggregate over
   * @param period - Time period
   * @returns Promise resolving to aggregated metrics
   */
  aggregate(
    types: MetricType[],
    dateRange: DateRange,
    period: Period
  ): Promise<Record<MetricType, MetricSnapshot[]>>;

  /**
   * Delete old metric snapshots (retention policy)
   *
   * @param beforeDate - Delete metrics created before this date
   * @returns Promise resolving to number of deleted records
   */
  deleteOlderThan(beforeDate: Date): Promise<number>;
}

/**
 * Date range for queries
 */
export interface DateRange {
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * Time-series data structure for charting/APIs
 */
export interface TimeSeriesData {
  /** Metric type being returned */
  metricType: MetricType;

  /** Data points ordered by date */
  points: TimeSeriesPoint[];

  /** Dimension if grouped by dimension */
  dimension?: string;

  /** Total number of points */
  count: number;

  /** Date range queried */
  dateRange: DateRange;

  /** Aggregation period */
  period: Period;
}

/**
 * Single point in a time series
 */
export interface TimeSeriesPoint {
  /** Date of this point */
  date: Date;

  /** Metric value */
  value: number;

  /** Optional dimension value if grouped */
  dimensionValue?: string;

  /** Optional change from previous period */
  changePercentage?: number;
}
