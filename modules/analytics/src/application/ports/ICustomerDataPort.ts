import { DateRange } from '../../domain/repositories/IMetricRepository';
/**
 * Customer Data Port (Inbound Adapter Interface)
 *
 * Hexagonal architecture port for fetching customer data.
 * Enables analytics to calculate customer metrics and cohort analysis
 * without direct dependency on customer management implementation.
 *
 * @interface ICustomerDataPort
 */
export interface ICustomerDataPort {
  /**
   * Get customer metrics for a date range
   * Fetches customer acquisition, retention, and behavior metrics
   *
   * @param dateRange - Date range to fetch metrics for
   * @returns Promise resolving to customer metrics
   * @throws Error if fetch fails
   */
  getCustomerMetrics(dateRange: DateRange): Promise<CustomerMetrics>;
}



/**
 * Customer metrics data structure
 */
export interface CustomerMetrics {
  /** Total number of unique customers */
  totalCustomers: number;

  /** New customers acquired in period */
  newCustomers: number;

  /** Customer retention rate (%) */
  retentionRate: number;

  /** Churn rate (%) */
  churnRate: number;

  /** Average customer lifetime value */
  avgLifetimeValue: number;

  /** Customers by tier distribution */
  customersByTier: Array<{
    tier: string;
    count: number;
    percentOfTotal: number;
    avgSpend: number;
  }>;

  /** Top customers by revenue */
  topCustomers: Array<{
    customerId: string;
    name: string;
    tier: string;
    totalSpend: number;
    orderCount: number;
    lastOrderDate: Date;
  }>;

  /** Customer acquisition funnel */
  acquisitionFunnel: Array<{
    stage: string;
    count: number;
    conversionRate: number;
  }>;

  /** Repeat purchase behavior */
  repeatPurchaseMetrics: {
    oneTimeCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    avgOrdersPerCustomer: number;
  };

  /** Cohort analysis by acquisition date */
  cohortAnalysis: Array<{
    cohortMonth: string;
    customersAcquired: number;
    retentionByMonth: Record<number, number>;
  }>;

  /** Customer segment breakdown */
  segmentation: Array<{
    segment: string;
    customerCount: number;
    avgSpend: number;
    avgOrderValue: number;
    purchaseFrequency: number;
  }>;
}
