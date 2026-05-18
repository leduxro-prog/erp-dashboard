import { DataSource } from 'typeorm';
import { IPricingDataPort, TierRevenue } from '../../application/ports/IPricingDataPort';
import { DateRange } from '../../domain/repositories/IMetricRepository';

/**
 * Pricing Data Adapter
 * Implements IPricingDataPort using high-performance SQL aggregations.
 * Joins orders with B2B customers to determine revenue per tier.
 */
export class PricingDataAdapter implements IPricingDataPort {
  constructor(private readonly dataSource: DataSource) {}

  async getRevenueByTier(dateRange: DateRange): Promise<TierRevenue[]> {
    const { startDate, endDate } = dateRange;

    // Aggregate revenue by B2B tier
    // Requires joining 'orders' with 'b2b_customers'
    // Note: We use the 'tier' column from b2b_customers table
    
    const results = await this.dataSource.query(`
      SELECT 
        bc.tier as tier,
        COALESCE(SUM(o.grand_total), 0) as revenue,
        COUNT(DISTINCT o.customer_id) as "customerCount",
        COUNT(o.id) as "orderCount",
        COALESCE(SUM(o.discount_amount), 0) as "discountAmount"
      FROM orders o
      JOIN b2b_customers bc ON bc.id = o.customer_id
      WHERE o.created_at >= $1 AND o.created_at <= $2
      AND o.status = 'PAID'
      GROUP BY bc.tier
    `, [startDate, endDate]);

    const totalRevenue = results.reduce((sum: number, r: any) => sum + parseFloat(r.revenue), 0);

    return results.map((r: any) => {
      const revenue = parseFloat(r.revenue);
      const orderCount = parseInt(r.orderCount, 10);
      const customerCount = parseInt(r.customerCount, 10);
      const discountAmount = parseFloat(r.discountAmount);

      return {
        tier: r.tier,
        revenue,
        customerCount,
        orderCount,
        discountAmount,
        avgRevenuePerCustomer: customerCount > 0 ? revenue / customerCount : 0,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
        percentOfTotalRevenue: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        growthRate: 0, // Requires previous period comparison, can be added if needed
        netRevenue: revenue - discountAmount,
      };
    });
  }
}
