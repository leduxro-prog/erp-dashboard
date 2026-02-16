// import { MetricType, MetricSnapshot, Period } from '../entities/MetricSnapshot';

/**
 * Metric Calculation Service
 *
 * Calculates key business metrics from raw data provided by data ports.
 * Handles metric computation logic in the domain layer, not application layer.
 *
 * Metrics Calculated:
 * - TOTAL_REVENUE: Sum of all paid orders
 * - ORDER_COUNT: Total number of orders
 * - AVG_ORDER_VALUE: Mean value per order
 * - CUSTOMER_COUNT: Unique customers
 * - CONVERSION_RATE: Quotes converted to orders
 * - INVENTORY_TURNOVER: Inventory cost of goods sold / average inventory
 * - SUPPLIER_RELIABILITY: Percentage of on-time deliveries
 * - QUOTE_WIN_RATE: Accepted quotes / total quotes
 *
 * @class MetricCalculationService
 */
export class MetricCalculationService {
  /**
   * Calculate total revenue for a period
   * Revenue = Sum of order.total where order.status = PAID
   *
   * @param orders - Array of order data
   * @returns Total revenue (sum)
   */
  public calculateTotalRevenue(orders: OrderData[]): number {
    return orders
      .filter((order) => order.status === 'PAID')
      .reduce((sum, order) => sum + (order.total || 0), 0);
  }

  /**
   * Calculate order count for a period
   *
   * @param orders - Array of order data
   * @returns Number of orders
   */
  public calculateOrderCount(orders: OrderData[]): number {
    return orders.length;
  }

  /**
   * Calculate average order value
   * AOV = Total Revenue / Order Count
   *
   * @param orders - Array of order data
   * @returns Average order value (0 if no orders)
   */
  public calculateAverageOrderValue(orders: OrderData[]): number {
    if (orders.length === 0) return 0;
    const totalRevenue = this.calculateTotalRevenue(orders);
    return totalRevenue / orders.length;
  }

  /**
   * Calculate number of unique customers
   *
   * @param customers - Array of customer data
   * @returns Number of unique customers
   */
  public calculateCustomerCount(customers: CustomerData[]): number {
    const uniqueIds = new Set(customers.map((c) => c.id));
    return uniqueIds.size;
  }

  /**
   * Calculate conversion rate
   * Conversion Rate = Accepted Quotes / Total Quotes
   *
   * @param quotes - Array of quote data
   * @returns Conversion rate as percentage (0-100)
   */
  public calculateConversionRate(quotes: QuoteData[]): number {
    if (quotes.length === 0) return 0;
    const acceptedCount = quotes.filter((q) => q.status === 'ACCEPTED').length;
    return (acceptedCount / quotes.length) * 100;
  }

  /**
   * Calculate inventory turnover ratio
   * Turnover = Cost of Goods Sold / Average Inventory Value
   *
   * Note: COGS is approximated as revenue for simplicity
   * In production, use actual COGS from accounting system
   *
   * @param cogs - Cost of goods sold
   * @param averageInventoryValue - Average inventory value for period
   * @returns Turnover ratio (times per period)
   */
  public calculateInventoryTurnover(
    cogs: number,
    averageInventoryValue: number
  ): number {
    if (averageInventoryValue === 0) return 0;
    return cogs / averageInventoryValue;
  }

  /**
   * Calculate supplier reliability score
   * Reliability = (On-Time Deliveries / Total Deliveries) * 100
   *
   * @param deliveries - Array of supplier delivery data
   * @returns Reliability score as percentage (0-100)
   */
  public calculateSupplierReliability(deliveries: DeliveryData[]): number {
    if (deliveries.length === 0) return 100; // Assume reliable if no deliveries

    const onTimeCount = deliveries.filter((d) => {
      const deliveredDate = new Date(d.deliveredDate);
      const expectedDate = new Date(d.expectedDate);
      return deliveredDate <= expectedDate;
    }).length;

    return (onTimeCount / deliveries.length) * 100;
  }

  /**
   * Calculate quote win rate
   * Win Rate = Accepted Quotes / Total Quotes
   * Same as conversion rate
   *
   * @param quotes - Array of quote data
   * @returns Win rate as percentage (0-100)
   */
  public calculateQuoteWinRate(quotes: QuoteData[]): number {
    return this.calculateConversionRate(quotes);
  }

  /**
   * Calculate percentage change from previous period
   *
   * @param current - Current value
   * @param previous - Previous period value
   * @returns Percentage change (-100 to infinity, null if previous is 0)
   */
  public calculatePercentageChange(current: number, previous: number | null): number | null {
    if (previous === null || previous === 0) {
      return null;
    }
    return ((current - previous) / previous) * 100;
  }
}

/**
 * Order data structure for metric calculation
 */
export interface OrderData {
  id: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total: number;
  customerId: string;
  createdAt: Date;
}

/**
 * Customer data structure
 */
export interface CustomerData {
  id: string;
  name: string;
  tier: string;
  registeredAt: Date;
}

/**
 * Quote data structure
 */
export interface QuoteData {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  amount: number;
  customerId: string;
  createdAt: Date;
}

/**
 * Supplier delivery data
 */
export interface DeliveryData {
  id: string;
  supplierId: string;
  deliveredDate: Date | string;
  expectedDate: Date | string;
  status: 'PENDING' | 'DELIVERED' | 'LATE' | 'CANCELLED';
}
