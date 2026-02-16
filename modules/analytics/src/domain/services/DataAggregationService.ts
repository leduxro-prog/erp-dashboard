import { MetricSnapshot, MetricType, Period } from '../entities/MetricSnapshot';

/**
 * Data Aggregation Service
 *
 * Aggregates raw events into time-based metric snapshots.
 * Handles:
 * - Grouping raw data by time period (daily, weekly, monthly)
 * - Dimensional aggregation (by product, customer tier, supplier, region)
 * - Converting raw event streams into queryable metric snapshots
 *
 * This service transforms event-driven data into analytical snapshots
 * for trend analysis and forecasting.
 *
 * @class DataAggregationService
 */
export class DataAggregationService {
  /**
   * Aggregate order events into revenue metric snapshots
   *
   * Groups orders by period and calculates revenue
   * Supports dimensional breakdown (product, customer tier, region)
   *
   * @param orders - Array of order data
   * @param period - Aggregation period (DAILY, WEEKLY, MONTHLY, YEARLY)
   * @param groupBy - Optional dimension to group by
   * @returns Array of metric snapshots
   */
  public aggregateOrderMetrics(
    orders: RawOrderEvent[],
    period: Period,
    groupBy?: string
  ): MetricSnapshot[] {
    const grouped = this.groupByPeriod(orders, period, groupBy);
    const snapshots: MetricSnapshot[] = [];

    for (const [periodKey, periodOrders] of Object.entries(grouped)) {
      const { startDate, endDate } = this.parsePeriodKey(periodKey, period);
      const totalRevenue = periodOrders
        .filter((o) => o.status === 'PAID')
        .reduce((sum: number, o) => sum + ((o as any).total || 0), 0);

      const dimensionMap = this.extractDimensions(periodOrders, groupBy);

      const snapshot = new MetricSnapshot(
        `revenue_${periodKey}_${groupBy || 'total'}`,
        MetricType.TOTAL_REVENUE,
        totalRevenue,
        period,
        startDate,
        endDate,
        dimensionMap
      );

      snapshots.push(snapshot);
    }

    return snapshots;
  }

  /**
   * Aggregate customer events into customer count snapshots
   *
   * Counts unique customers registered in period
   * Supports grouping by tier or region
   *
   * @param customers - Array of customer data
   * @param period - Aggregation period
   * @param groupBy - Optional dimension
   * @returns Array of metric snapshots
   */
  public aggregateCustomerMetrics(
    customers: RawCustomerEvent[],
    period: Period,
    groupBy?: string
  ): MetricSnapshot[] {
    const grouped = this.groupByPeriod(customers, period, groupBy);
    const snapshots: MetricSnapshot[] = [];

    for (const [periodKey, periodCustomers] of Object.entries(grouped)) {
      const { startDate, endDate } = this.parsePeriodKey(periodKey, period);
      const uniqueCustomers = new Set(periodCustomers.map((c) => c.id)).size;

      const dimensionMap = this.extractDimensions(periodCustomers, groupBy);

      const snapshot = new MetricSnapshot(
        `customers_${periodKey}_${groupBy || 'total'}`,
        MetricType.CUSTOMER_COUNT,
        uniqueCustomers,
        period,
        startDate,
        endDate,
        dimensionMap
      );

      snapshots.push(snapshot);
    }

    return snapshots;
  }

  /**
   * Aggregate inventory events into turnover snapshots
   *
   * Calculates inventory turnover (COGS / average inventory)
   * Supports grouping by product
   *
   * @param inventory - Inventory data
   * @param period - Aggregation period
   * @param groupBy - Optional dimension
   * @returns Array of metric snapshots
   */
  public aggregateInventoryMetrics(
    inventory: RawInventoryEvent[],
    period: Period,
    groupBy?: string
  ): MetricSnapshot[] {
    const grouped = this.groupByPeriod(inventory, period, groupBy);
    const snapshots: MetricSnapshot[] = [];

    for (const [periodKey, periodItems] of Object.entries(grouped)) {
      const { startDate, endDate } = this.parsePeriodKey(periodKey, period);

      // Average inventory value = sum of ending balances / number of snapshots
      const avgInventory =
        periodItems.reduce((sum: number, item) => sum + ((item as any).value || 0), 0) /
        periodItems.length;

      // For COGS, use revenue from same period (simplified)
      // In production, link to actual COGS
      const cogs = periodItems.reduce((sum: number, item) => sum + ((item as any).costOfGoodsSold || 0), 0);

      const turnover = avgInventory > 0 ? cogs / avgInventory : 0;

      const dimensionMap = this.extractDimensions(periodItems, groupBy);

      const snapshot = new MetricSnapshot(
        `inventory_turnover_${periodKey}_${groupBy || 'total'}`,
        MetricType.INVENTORY_TURNOVER,
        turnover,
        period,
        startDate,
        endDate,
        dimensionMap
      );

      snapshots.push(snapshot);
    }

    return snapshots;
  }

  /**
   * Group events by time period
   * Returns map of period keys to events in that period
   *
   * @param events - Events to group
   * @param period - Period size
   * @param groupBy - Optional dimension to group by
   * @returns Map of period keys to events
   */
  private groupByPeriod(
    events: Array<{ timestamp: Date | string;[key: string]: unknown }>,
    period: Period,
    groupBy?: string
  ): Record<string, Array<{ timestamp: Date | string;[key: string]: unknown }>> {
    const grouped: Record<string, Array<{ timestamp: Date | string;[key: string]: unknown }>> = {};

    for (const event of events) {
      const date = new Date(event.timestamp);
      let periodKey = this.getPeriodKey(date, period);

      if (groupBy && groupBy in event) {
        periodKey = `${periodKey}_${event[groupBy]}`;
      }

      if (!grouped[periodKey]) {
        grouped[periodKey] = [];
      }
      grouped[periodKey].push(event);
    }

    return grouped;
  }

  /**
   * Get a key representing the period a date belongs to
   *
   * @param date - Date to get period for
   * @param period - Period type
   * @returns String key for the period
   */
  private getPeriodKey(date: Date, period: Period): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const week = this.getWeekNumber(date);

    switch (period) {
      case Period.DAILY:
        return `${year}-${month}-${day}`;
      case Period.WEEKLY:
        return `${year}-W${week}`;
      case Period.MONTHLY:
        return `${year}-${month}`;
      case Period.YEARLY:
        return `${year}`;
    }
  }

  /**
   * Get week number for a date (ISO 8601)
   *
   * @param date - Date to get week for
   * @returns Week number (1-53)
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Parse period key back into start and end dates
   *
   * @param periodKey - Key from getPeriodKey
   * @param period - Period type
   * @returns Start and end dates
   */
  private parsePeriodKey(
    periodKey: string,
    period: Period
  ): { startDate: Date; endDate: Date } {
    switch (period) {
      case Period.DAILY: {
        const [year, month, day] = periodKey.split('-').map(Number);
        const startDate = new Date(year, month - 1, day);
        const endDate = new Date(year, month - 1, day + 1);
        return { startDate, endDate };
      }
      case Period.WEEKLY: {
        const [year, weekStr] = periodKey.split('-W');
        const week = parseInt(weekStr, 10);
        const startDate = new Date(parseInt(year, 10), 0, 1);
        startDate.setDate(startDate.getDate() + (week - 1) * 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        return { startDate, endDate };
      }
      case Period.MONTHLY: {
        const [year, month] = periodKey.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);
        return { startDate, endDate };
      }
      case Period.YEARLY: {
        const year = parseInt(periodKey, 10);
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);
        return { startDate, endDate };
      }
    }
  }

  /**
   * Extract dimensions from events for dimensional analysis
   *
   * @param events - Events with optional dimension fields
   * @param groupBy - Dimension field name
   * @returns Map of dimension to value
   */
  private extractDimensions(
    events: unknown[],
    groupBy?: string
  ): Map<string, string> {
    const dimensions = new Map<string, string>();

    if (!groupBy || events.length === 0) {
      return dimensions;
    }

    const firstEvent = events[0] as Record<string, unknown>;
    if (groupBy in firstEvent) {
      dimensions.set(groupBy, String(firstEvent[groupBy]));
    }

    return dimensions;
  }
}

/**
 * Raw order event structure
 */
export interface RawOrderEvent {
  id: string;
  timestamp: Date | string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total: number;
  customerId: string;
  productId?: string;
  [key: string]: unknown;
}

/**
 * Raw customer event structure
 */
export interface RawCustomerEvent {
  id: string;
  timestamp: Date | string;
  name: string;
  tier?: string;
  region?: string;
  [key: string]: unknown;
}

/**
 * Raw inventory event structure
 */
export interface RawInventoryEvent {
  timestamp: Date | string;
  productId: string;
  value: number;
  costOfGoodsSold?: number;
  [key: string]: unknown;
}
