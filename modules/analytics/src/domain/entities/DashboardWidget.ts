/**
 * DashboardWidget Entity
 *
 * Represents a single widget on a dashboard (KPI card, chart, table, etc).
 * Widgets are configurable visualization elements that fetch data from different sources
 * and display metrics, trends, and other analytics information.
 *
 * Each widget:
 * - Has a specific visualization type (KPI_CARD, LINE_CHART, BAR_CHART, etc.)
 * - Fetches data from a specific source (SALES, CUSTOMERS, INVENTORY, ORDERS, etc.)
 * - Has a configurable query with metric, filters, grouping, and date range
 * - Supports caching with refresh intervals
 * - Can be positioned and sized on the dashboard
 *
 * @class DashboardWidget
 */
export class DashboardWidget {
  /**
   * Unique identifier for this widget instance
   */
  public id: string;

  /**
   * Dashboard this widget belongs to
   */
  public dashboardId: string;

  /**
   * Widget visualization type
   */
  public type: WidgetType;

  /**
   * Human-readable widget title
   */
  public title: string;

  /**
   * Data source type for this widget
   */
  public dataSourceType: DataSourceType;

  /**
   * Widget query configuration (metric, filters, grouping, date range)
   */
  public query: WidgetQuery;

  /**
   * Position and size on the dashboard grid
   */
  public position: WidgetPosition;

  /**
   * How often to refresh this widget's data (in seconds)
   * Null = manual refresh only
   */
  public refreshInterval: number | null;

  /**
   * Cached data for this widget (last fetched result)
   */
  public cachedData: unknown | null;

  /**
   * Timestamp when data was last refreshed
   */
  public lastRefreshedAt: Date | null;

  /**
   * When this widget was created
   */
  public createdAt: Date;

  /**
   * When this widget was last updated
   */
  public updatedAt: Date;

  /**
   * Create a new DashboardWidget
   */
  constructor(
    id: string,
    dashboardId: string,
    type: WidgetType,
    title: string,
    dataSourceType: DataSourceType,
    query: WidgetQuery,
    position: WidgetPosition,
    refreshInterval: number | null = null,
    cachedData: unknown | null = null,
    lastRefreshedAt: Date | null = null,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    this.id = id;
    this.dashboardId = dashboardId;
    this.type = type;
    this.title = title;
    this.dataSourceType = dataSourceType;
    this.query = query;
    this.position = position;
    this.refreshInterval = refreshInterval;
    this.cachedData = cachedData;
    this.lastRefreshedAt = lastRefreshedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Check if this widget's cached data needs refreshing
   * Returns true if:
   * - No cached data exists
   * - refreshInterval is null (manual refresh only)
   * - Enough time has passed since lastRefreshedAt
   *
   * @returns Whether refresh is needed
   */
  public needsRefresh(): boolean {
    // No cache = needs refresh
    if (this.cachedData === null || this.lastRefreshedAt === null) {
      return true;
    }

    // Manual refresh only
    if (this.refreshInterval === null) {
      return false;
    }

    // Check if interval has passed
    const now = Date.now();
    const lastRefresh = this.lastRefreshedAt.getTime();
    const intervalMs = this.refreshInterval * 1000;

    return now - lastRefresh >= intervalMs;
  }

  /**
   * Update the cached data and refresh timestamp
   *
   * @param data - New data to cache
   * @throws Error if data is undefined
   */
  public updateCache(data: unknown): void {
    if (data === undefined) {
      throw new Error('Cannot cache undefined data');
    }
    this.cachedData = data;
    this.lastRefreshedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Serialize widget to plain object (for API responses)
   *
   * @returns Plain object representation
   */
  public serialize(): WidgetDTO {
    return {
      id: this.id,
      dashboardId: this.dashboardId,
      type: this.type,
      title: this.title,
      dataSourceType: this.dataSourceType,
      query: this.query,
      position: this.position,
      refreshInterval: this.refreshInterval,
      cachedData: this.cachedData,
      lastRefreshedAt: this.lastRefreshedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Generate a hash of the query for cache key purposes
   * Used to identify if query has changed
   *
   * @returns Hash string
   */
  public getQueryHash(): string {
    const queryStr = JSON.stringify(this.query);
    // Simple hash implementation - in production use crypto.createHash
    let hash = 0;
    for (let i = 0; i < queryStr.length; i++) {
      const char = queryStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `widget_${this.id}_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Widget visualization type enumeration
 */
export enum WidgetType {
  KPI_CARD = 'KPI_CARD',
  LINE_CHART = 'LINE_CHART',
  BAR_CHART = 'BAR_CHART',
  PIE_CHART = 'PIE_CHART',
  TABLE = 'TABLE',
  HEATMAP = 'HEATMAP',
  FUNNEL = 'FUNNEL',
  GAUGE = 'GAUGE',
}

/**
 * Data source type enumeration
 */
export enum DataSourceType {
  SALES = 'SALES',
  CUSTOMERS = 'CUSTOMERS',
  INVENTORY = 'INVENTORY',
  ORDERS = 'ORDERS',
  QUOTES = 'QUOTES',
  SUPPLIERS = 'SUPPLIERS',
  MARKETING = 'MARKETING',
}

/**
 * Widget query configuration
 */
export interface WidgetQuery {
  /** Metric to display (e.g., 'revenue', 'order_count', 'avg_order_value') */
  metric: string;

  /** Filters to apply (e.g., product_id, customer_tier) */
  filters?: Record<string, unknown>;

  /** Group by dimension (e.g., 'product_id', 'customer_tier', 'date') */
  groupBy?: string;

  /** Date range for the data */
  dateRange?: {
    startDate: Date | string;
    endDate: Date | string;
  };

  /** Additional query options */
  options?: Record<string, unknown>;
}

/**
 * Widget position and size on dashboard
 */
export interface WidgetPosition {
  /** X coordinate in grid */
  x: number;

  /** Y coordinate in grid */
  y: number;

  /** Width in grid units */
  width: number;

  /** Height in grid units */
  height: number;
}

/**
 * Widget data transfer object (for API responses)
 */
export type WidgetDTO = Omit<DashboardWidget, 'needsRefresh' | 'updateCache' | 'serialize' | 'getQueryHash'>;
