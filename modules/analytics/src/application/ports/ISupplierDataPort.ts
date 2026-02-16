import { DateRange } from '../../domain/repositories/IMetricRepository';
/**
 * Supplier Data Port (Inbound Adapter Interface)
 *
 * Hexagonal architecture port for fetching supplier performance data.
 * Enables analytics to measure supplier reliability, delivery times, and pricing.
 *
 * @interface ISupplierDataPort
 */
export interface ISupplierDataPort {
  /**
   * Get supplier performance metrics for a date range
   * Calculates reliability score, delivery times, and pricing stability
   *
   * @param dateRange - Date range to fetch metrics for
   * @returns Promise resolving to array of supplier metrics
   * @throws Error if fetch fails
   */
  getSupplierMetrics(dateRange: DateRange): Promise<SupplierMetrics[]>;
}



/**
 * Supplier performance metrics
 */
export interface SupplierMetrics {
  /** Unique supplier identifier */
  supplierId: string;

  /** Supplier name */
  name: string;

  /** Supplier contact information */
  contact: string;

  /** On-time delivery rate (%) */
  onTimeDeliveryRate: number;

  /** Average delivery time (days) */
  avgDeliveryDays: number;

  /** Quality score based on defects/returns (0-100) */
  qualityScore: number;

  /** Price stability index (how consistent pricing is) */
  priceStability: number;

  /** Total purchase amount in period */
  totalPurchased: number;

  /** Number of orders placed */
  orderCount: number;

  /** Number of late deliveries */
  lateDeliveries: number;

  /** Number of defective items received */
  defectiveItems: number;

  /** Total cost of poor quality */
  costOfPoorQuality: number;

  /** Communication responsiveness score (1-5) */
  communicationScore: number;

  /** Overall supplier reliability score (0-100) */
  overallReliability: number;

  /** Top 3 supplied products */
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    totalCost: number;
  }>;

  /** Monthly trend of on-time delivery */
  deliveryTrend: Array<{
    month: string;
    onTimeRate: number;
  }>;

  /** Price change trend */
  priceTrend: Array<{
    month: string;
    avgPrice: number;
    priceChange: number;
  }>;
}
