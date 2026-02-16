/**
 * MetricSnapshot Entity
 *
 * Represents a point-in-time measurement of a business metric.
 * Snapshots are aggregated data points calculated daily/weekly/monthly
 * and stored for historical trend analysis and forecasting.
 *
 * Features:
 * - Multiple metric types (revenue, orders, customers, etc.)
 * - Tracks changes from previous period
 * - Supports dimensional breakdowns (by product, customer tier, supplier, etc.)
 * - Provides trend analysis and comparison methods
 *
 * @class MetricSnapshot
 */
export class MetricSnapshot {
  /**
   * Unique identifier for this snapshot
   */
  public id: string;

  /**
   * Type of metric being measured
   */
  public metricType: MetricType;

  /**
   * The actual value of the metric
   */
  public value: number;

  /**
   * Value from previous period (for trend calculation)
   */
  public previousValue: number | null;

  /**
   * Percentage change from previous period
   * Calculated as: ((value - previousValue) / previousValue) * 100
   */
  public changePercentage: number | null;

  /**
   * Time period this snapshot covers
   */
  public period: Period;

  /**
   * Start date of the period
   */
  public periodStart: Date;

  /**
   * End date of the period
   */
  public periodEnd: Date;

  /**
   * Dimensional breakdown of this metric
   * E.g., product_id -> product_123, customer_tier -> GOLD
   */
  public dimensions: Map<string, string>;

  /**
   * When this snapshot was created
   */
  public createdAt: Date;

  /**
   * Create a new MetricSnapshot
   */
  constructor(
    id: string,
    metricType: MetricType,
    value: number,
    period: Period,
    periodStart: Date,
    periodEnd: Date,
    dimensions: Map<string, string> = new Map(),
    previousValue: number | null = null,
    changePercentage: number | null = null,
    createdAt: Date = new Date()
  ) {
    this.id = id;
    this.metricType = metricType;
    this.value = value;
    this.previousValue = previousValue;
    this.changePercentage = changePercentage;
    this.period = period;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.dimensions = dimensions;
    this.createdAt = createdAt;
  }

  /**
   * Get the trend direction (increasing, decreasing, stable)
   * Returns:
   * - 'increasing' if change is positive
   * - 'decreasing' if change is negative
   * - 'stable' if change is close to zero
   * - null if no previous value to compare
   *
   * @returns Trend direction or null
   */
  public getTrend(): 'increasing' | 'decreasing' | 'stable' | null {
    if (this.changePercentage === null) {
      return null;
    }

    const threshold = 0.5; // Within 0.5% is considered stable
    if (Math.abs(this.changePercentage) < threshold) {
      return 'stable';
    }

    return this.changePercentage > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Check if the metric value is positive/good
   * (definition varies by metric type)
   *
   * @returns Whether the change is positive
   */
  public isPositive(): boolean {
    return this.changePercentage !== null && this.changePercentage >= 0;
  }

  /**
   * Compare this metric with another snapshot
   * Returns difference and percentage change
   *
   * @param other - Other MetricSnapshot to compare with
   * @returns Comparison result
   * @throws Error if comparing different metric types or dimensions
   */
  public compareWith(other: MetricSnapshot): MetricComparison {
    if (this.metricType !== other.metricType) {
      throw new Error(
        `Cannot compare different metric types: ${this.metricType} vs ${other.metricType}`
      );
    }

    // Compare dimensions only when both snapshots are dimensioned.
    // This allows comparing aggregate snapshots (empty dimensions)
    // with segmented snapshots for trend analysis.
    const thisHasDimensions = this.dimensions.size > 0;
    const otherHasDimensions = other.dimensions.size > 0;

    if (thisHasDimensions && otherHasDimensions) {
      if (this.dimensions.size !== other.dimensions.size) {
        throw new Error('Cannot compare metrics with different dimensions');
      }

      for (const [key, value] of this.dimensions.entries()) {
        if (other.dimensions.get(key) !== value) {
          throw new Error('Cannot compare metrics with different dimensions');
        }
      }
    }

    const difference = this.value - other.value;
    const percentageChange =
      other.value !== 0
        ? ((difference / other.value) * 100)
        : (difference > 0 ? 100 : -100);

    return {
      metricType: this.metricType,
      currentValue: this.value,
      previousValue: other.value,
      difference,
      percentageChange,
      currentPeriod: this.period,
      previousPeriod: other.period,
      trend: percentageChange > 0 ? 'increasing' : (percentageChange < 0 ? 'decreasing' : 'stable'),
    };
  }
}

/**
 * Metric type enumeration
 */
export enum MetricType {
  TOTAL_REVENUE = 'TOTAL_REVENUE',
  ORDER_COUNT = 'ORDER_COUNT',
  AVG_ORDER_VALUE = 'AVG_ORDER_VALUE',
  CUSTOMER_COUNT = 'CUSTOMER_COUNT',
  CONVERSION_RATE = 'CONVERSION_RATE',
  INVENTORY_TURNOVER = 'INVENTORY_TURNOVER',
  SUPPLIER_RELIABILITY = 'SUPPLIER_RELIABILITY',
  QUOTE_WIN_RATE = 'QUOTE_WIN_RATE',
}

/**
 * Time period enumeration
 */
export enum Period {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

/**
 * Metric comparison result
 */
export interface MetricComparison {
  metricType: MetricType;
  currentValue: number;
  previousValue: number;
  difference: number;
  percentageChange: number;
  currentPeriod: Period;
  previousPeriod: Period;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * MetricSnapshot data transfer object (for API responses)
 */
export type MetricSnapshotDTO = Omit<
  MetricSnapshot,
  'getTrend' | 'isPositive' | 'compareWith' | 'dimensions'
> & {
  dimensions: Record<string, string>;
};
