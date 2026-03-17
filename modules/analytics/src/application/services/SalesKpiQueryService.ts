import { DataSource } from 'typeorm';

interface SalesKpiQueryInput {
  startDate?: string;
  endDate?: string;
  groupBy?: string;
}

interface SalesKpiGroupedRow {
  period: string;
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
}

interface SalesKpiTopProduct {
  product_id: string;
  name: string;
  revenue: number;
}

interface SalesKpiPayload {
  period: {
    start_date: string;
    end_date: string;
    source: string;
  };
  metrics: {
    total_revenue: number;
    revenue_growth: number;
    total_orders: number;
    orders_growth: number;
    average_order_value: number;
    aov_change: number;
    conversion_rate: number;
    conversion_change: number;
    customer_acquisition_cost: number;
    cac_change: number;
    lifetime_value: number;
    top_products: SalesKpiTopProduct[];
  };
}

export class SalesKpiQueryService {
  constructor(private readonly dataSource: DataSource) {}

  async query(input: SalesKpiQueryInput): Promise<SalesKpiPayload | SalesKpiGroupedRow[]> {
    const { startDate, endDate, previousStartDate, previousEndDate } = this.resolveDateRange(
      input.startDate,
      input.endDate,
    );

    if ((input.groupBy || '').toLowerCase() === 'month') {
      const rows = await this.dataSource.query(
        `
          SELECT
            TO_CHAR(DATE_TRUNC('month', period_date), 'YYYY-MM') AS period,
            COALESCE(SUM(total_revenue), 0) AS total_revenue,
            COALESCE(SUM(orders_count), 0) AS total_orders
          FROM sales_kpi_daily
          WHERE period_date >= $1::date
            AND period_date <= $2::date
          GROUP BY DATE_TRUNC('month', period_date)
          ORDER BY DATE_TRUNC('month', period_date) ASC
        `,
        [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
      );

      return rows.map((row: any) => {
        const totalRevenue = this.parseNumber(row.total_revenue);
        const totalOrders = this.parseNumber(row.total_orders);
        return {
          period: row.period,
          total_revenue: totalRevenue,
          total_orders: totalOrders,
          avg_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        };
      });
    }

    const [currentTotals] = await this.dataSource.query(
      `
        SELECT
          COALESCE(SUM(total_revenue), 0) AS total_revenue,
          COALESCE(SUM(orders_count), 0) AS total_orders
        FROM sales_kpi_daily
        WHERE period_date >= $1::date
          AND period_date <= $2::date
      `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    const [previousTotals] = await this.dataSource.query(
      `
        SELECT
          COALESCE(SUM(total_revenue), 0) AS total_revenue,
          COALESCE(SUM(orders_count), 0) AS total_orders
        FROM sales_kpi_daily
        WHERE period_date >= $1::date
          AND period_date <= $2::date
      `,
      [previousStartDate.toISOString().split('T')[0], previousEndDate.toISOString().split('T')[0]],
    );

    const topProductsRows = await this.dataSource.query(
      `
        SELECT top_products
        FROM sales_kpi_daily
        WHERE period_date >= $1::date
          AND period_date <= $2::date
      `,
      [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    );

    const totalRevenue = this.parseNumber(currentTotals?.total_revenue);
    const totalOrders = this.parseNumber(currentTotals?.total_orders);
    const previousRevenue = this.parseNumber(previousTotals?.total_revenue);
    const previousOrders = this.parseNumber(previousTotals?.total_orders);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const previousAov = previousOrders > 0 ? previousRevenue / previousOrders : 0;

    return {
      period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        source: 'smartbill_readmodel',
      },
      metrics: {
        total_revenue: totalRevenue,
        revenue_growth: this.computeGrowth(totalRevenue, previousRevenue),
        total_orders: totalOrders,
        orders_growth: this.computeGrowth(totalOrders, previousOrders),
        average_order_value: averageOrderValue,
        aov_change: this.computeGrowth(averageOrderValue, previousAov),
        conversion_rate: 0,
        conversion_change: 0,
        customer_acquisition_cost: 0,
        cac_change: 0,
        lifetime_value: 0,
        top_products: this.buildTopProducts(topProductsRows),
      },
    };
  }

  private parseNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private computeGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private resolveDateRange(start?: string, end?: string): {
    startDate: Date;
    endDate: Date;
    previousStartDate: Date;
    previousEndDate: Date;
  } {
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error('Invalid date range');
    }

    if (startDate > endDate) {
      throw new Error('start_date cannot be after end_date');
    }

    const rangeMs = endDate.getTime() - startDate.getTime();
    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate.getTime() - rangeMs);

    return { startDate, endDate, previousStartDate, previousEndDate };
  }

  private buildTopProducts(rows: any[]): SalesKpiTopProduct[] {
    const productRevenue = new Map<string, number>();

    for (const row of rows) {
      const topProducts = this.normalizeTopProducts(row?.top_products);
      for (const item of topProducts) {
        const name =
          (typeof item?.name === 'string' && item.name.trim()) ||
          (typeof item?.productName === 'string' && item.productName.trim()) ||
          (typeof item?.description === 'string' && item.description.trim()) ||
          'Produs necunoscut';

        const revenue = this.parseNumber(item?.revenue ?? item?.total ?? item?.total_revenue ?? 0);
        productRevenue.set(name, (productRevenue.get(name) || 0) + revenue);
      }
    }

    return Array.from(productRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, revenue], index) => ({
        product_id: `smartbill-rm-${index + 1}`,
        name,
        revenue,
      }));
  }

  private normalizeTopProducts(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) {
      return value as Array<Record<string, unknown>>;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed as Array<Record<string, unknown>>;
        }
      } catch {
        return [];
      }
    }

    return [];
  }
}
