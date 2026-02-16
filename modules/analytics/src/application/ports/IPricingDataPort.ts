import { DateRange } from '../../domain/repositories/IMetricRepository';
/**
 * Pricing Data Port (Inbound Adapter Interface)
 *
 * Hexagonal architecture port for fetching pricing and revenue data
 * from the Pricing Engine module.
 *
 * @interface IPricingDataPort
 */
export interface IPricingDataPort {
  /**
   * Get revenue breakdown by customer tier
   * Calculates revenue distribution across customer tiers (GOLD, SILVER, BRONZE, etc)
   *
   * @param dateRange - Date range to fetch revenue for
   * @returns Promise resolving to tier-based revenue breakdown
   * @throws Error if pricing module unavailable or fetch fails
   */
  getRevenueByTier(dateRange: DateRange): Promise<TierRevenue[]>;
}



/**
 * Revenue breakdown by customer tier
 */
export interface TierRevenue {
  /** Customer tier name (GOLD, SILVER, BRONZE, etc) */
  tier: string;

  /** Total revenue from this tier */
  revenue: number;

  /** Number of customers in this tier */
  customerCount: number;

  /** Average revenue per customer in this tier */
  avgRevenuePerCustomer: number;

  /** Total number of orders from this tier */
  orderCount: number;

  /** Average order value for this tier */
  avgOrderValue: number;

  /** Percentage of total revenue */
  percentOfTotalRevenue: number;

  /** Growth rate vs previous period (%) */
  growthRate: number;

  /** Discount amount applied to this tier */
  discountAmount: number;

  /** Net revenue after discounts */
  netRevenue: number;
}
