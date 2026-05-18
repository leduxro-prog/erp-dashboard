import { DataSource } from 'typeorm';
import { IOrderDataPort, OrderMetrics, OrderFilters } from '../../application/ports/IOrderDataPort';
import { DateRange } from '../../domain/repositories/IMetricRepository';

/**
 * Order Data Adapter
 * Implements IOrderDataPort using direct database queries for performance.
 * Uses high-performance aggregations to handle 100K+ orders efficiently.
 */
export class OrderDataAdapter implements IOrderDataPort {
  constructor(private readonly dataSource: DataSource) {}

  async getOrderMetrics(dateRange: DateRange, filters?: OrderFilters): Promise<OrderMetrics> {
    const { startDate, endDate } = dateRange;

    // Build base query for order aggregations
    // We use raw queries via queryRunner for complex aggregations that are hard to express in TypeORM QueryBuilder
    // but safer than plain strings because we use parameters.
    
    const results = await this.dataSource.query(`
      WITH period_orders AS (
        SELECT * FROM orders 
        WHERE created_at >= $1 AND created_at <= $2
        ${filters?.status ? "AND status = $3" : ""}
      ),
      status_counts AS (
        SELECT status, count(*) as count
        FROM period_orders
        GROUP BY status
      ),
      top_products AS (
        SELECT 
          oi.product_id as "productId",
          SUM(oi.line_total) as revenue,
          COUNT(DISTINCT oi.order_id) as "orderCount"
        FROM order_items oi
        JOIN period_orders o ON o.id = oi.order_id
        GROUP BY oi.product_id
        ORDER BY revenue DESC
        LIMIT 10
      ),
      daily_metrics AS (
        SELECT 
          date_trunc('day', created_at)::date as date,
          count(*) as count,
          sum(grand_total) as total
        FROM period_orders
        GROUP BY date
        ORDER BY date ASC
      )
      SELECT 
        (SELECT count(*) FROM period_orders) as "totalOrders",
        (SELECT COALESCE(sum(grand_total), 0) FROM period_orders WHERE status = 'PAID') as "totalRevenue",
        (SELECT json_object_agg(status, count) FROM status_counts) as "statusBreakdown",
        (SELECT json_agg(tp) FROM top_products tp) as "topProducts",
        (SELECT json_agg(dm) FROM (SELECT date, count FROM daily_metrics) dm) as "dailyOrders",
        (SELECT json_agg(dm) FROM (SELECT date, total FROM daily_metrics) dm) as "dailyRevenue"
    `, filters?.status ? [startDate, endDate, filters.status] : [startDate, endDate]);

    const row = results[0];

    return {
      totalOrders: parseInt(row.totalOrders || '0', 10),
      totalRevenue: parseFloat(row.totalRevenue || '0'),
      avgOrderValue: row.totalOrders > 0 ? parseFloat(row.totalRevenue || '0') / parseInt(row.totalOrders, 10) : 0,
      statusBreakdown: row.statusBreakdown || {},
      topProducts: row.topProducts || [],
      revenueByTier: [], // Requires joining with customers/tiers, implemented separately if needed
      dailyOrders: (row.dailyOrders || []).map((d: any) => ({ ...d, date: d.date.toISOString().split('T')[0] })),
      dailyRevenue: (row.dailyRevenue || []).map((d: any) => ({ ...d, date: d.date.toISOString().split('T')[0] })),
    };
  }
}
