import { DateRange } from '../../domain/repositories/IMetricRepository';
/**
 * Order Data Port (Inbound Adapter Interface)
 *
 * Hexagonal architecture port for fetching order data from the Orders module.
 * Implementations will call the orders module via event bus or shared data structures.
 *
 * This port allows the analytics module to calculate metrics without direct
 * dependency on the orders module's implementation details.
 *
 * @interface IOrderDataPort
 */
export interface IOrderDataPort {
  /**
   * Get order metrics for a date range
   * Fetches aggregated order data needed for analytics calculations
   *
   * @param dateRange - Date range to fetch metrics for
   * @param filters - Optional filters (customer_id, product_id, status, etc.)
   * @returns Promise resolving to order metrics
   * @throws Error if orders module is unavailable or data fetch fails
   */
  getOrderMetrics(
    dateRange: DateRange,
    filters?: OrderFilters
  ): Promise<OrderMetrics>;
}



/**
 * Order filters
 */
export interface OrderFilters {
  /** Filter by order status */
  status?: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

  /** Filter by customer ID */
  customerId?: string;

  /** Filter by product ID */
  productId?: string;

  /** Filter by minimum order total */
  minTotal?: number;

  /** Filter by maximum order total */
  maxTotal?: number;

  /** Additional custom filters */
  [key: string]: unknown;
}

/**
 * Aggregated order metrics
 */
export interface OrderMetrics {
  /** Total number of orders */
  totalOrders: number;

  /** Total revenue (sum of order totals for paid orders) */
  totalRevenue: number;

  /** Average order value */
  avgOrderValue: number;

  /** Orders by status breakdown */
  statusBreakdown: Record<string, number>;

  /** Top products by revenue */
  topProducts: Array<{
    productId: string;
    revenue: number;
    orderCount: number;
  }>;

  /** Revenue by customer tier */
  revenueByTier: Array<{
    tier: string;
    revenue: number;
    orderCount: number;
  }>;

  /** Daily order counts */
  dailyOrders: Array<{
    date: string;
    count: number;
  }>;

  /** Daily revenue */
  dailyRevenue: Array<{
    date: string;
    total: number;
  }>;
}
