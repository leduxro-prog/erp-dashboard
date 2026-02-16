import { Logger } from 'winston';
import { Dashboard, DashboardDTO, LayoutType } from '../../domain/entities/Dashboard';
import { DashboardWidget, WidgetType, DataSourceType } from '../../domain/entities/DashboardWidget';
import { IDashboardRepository } from '../../domain/repositories/IDashboardRepository';
import { IOrderDataPort } from '../ports/IOrderDataPort';
import { IPricingDataPort } from '../ports/IPricingDataPort';
// import { DashboardNotFoundError } from '../../domain/errors/analytics.errors';

/**
 * GetSalesDashboard Use-Case
 *
 * Retrieves the pre-built sales analytics dashboard showing:
 * - Total revenue
 * - Order count
 * - Average order value
 * - Top products
 * - Revenue by customer tier
 * - Daily revenue trend
 *
 * This dashboard is read-only and provided to all users with analytics access.
 *
 * @class GetSalesDashboard
 */
export class GetSalesDashboard {
  /**
   * Create a new GetSalesDashboard use-case
   *
   * @param dashboardRepository - Dashboard repository for persistence
   * @param orderDataPort - Port for fetching order data
   * @param pricingDataPort - Port for fetching pricing data
   * @param logger - Structured logger
   */
  constructor(
    private readonly dashboardRepository: IDashboardRepository,
    private readonly orderDataPort: IOrderDataPort,
    private readonly pricingDataPort: IPricingDataPort,
    private readonly logger: Logger
  ) { }

  /**
   * Execute: Get the sales dashboard
   *
   * If the system dashboard exists, returns it with current data.
   * If not, creates and persists the system dashboard.
   *
   * @param userId - User requesting the dashboard
   * @returns Promise resolving to Dashboard DTO
   * @throws DashboardNotFoundError if dashboard cannot be created
   */
  public async execute(userId: string): Promise<DashboardDTO> {
    this.logger.info('Getting sales dashboard', { userId });

    try {
      const startOfMonth = this.getStartOfMonth();
      const today = new Date();

      // Try to fetch existing sales dashboard
      let dashboard = await this.dashboardRepository.findById('sales-dashboard-system');

      if (!dashboard) {
        this.logger.debug('Sales dashboard not found, creating new one');
        dashboard = this.createSalesDashboard();
        await this.dashboardRepository.save(dashboard);
      }

      // Fetch fresh data for widgets
      const orderMetrics = await this.orderDataPort.getOrderMetrics({
        startDate: startOfMonth,
        endDate: today,
      });

      const tierRevenue = await this.pricingDataPort.getRevenueByTier({
        startDate: startOfMonth,
        endDate: today,
      });

      // Update widget caches with fresh data
      this.updateWidgetCaches(dashboard, {
        orderMetrics,
        tierRevenue,
      });

      this.logger.info('Sales dashboard retrieved successfully', {
        userId,
        widgetCount: dashboard.widgets.length,
      });

      return dashboard;
    } catch (error) {
      this.logger.error('Failed to get sales dashboard', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create the sales dashboard structure
   *
   * @returns Dashboard instance
   */
  private createSalesDashboard(): Dashboard {
    const dashboard = new Dashboard(
      'sales-dashboard-system',
      'Sales Dashboard',
      'Real-time sales metrics and trends',
      'system',
      true,
      false,
      LayoutType.GRID
    );

    // Widget 1: Total Revenue (KPI Card)
    const revenueWidget = new DashboardWidget(
      'widget_revenue_kpi',
      'sales-dashboard-system',
      WidgetType.KPI_CARD,
      'Total Revenue',
      DataSourceType.SALES,
      {
        metric: 'total_revenue',
        dateRange: {
          startDate: this.getStartOfMonth(),
          endDate: new Date(),
        },
      },
      { x: 0, y: 0, width: 3, height: 2 },
      300 // Refresh every 5 minutes
    );
    dashboard.addWidget(revenueWidget);

    // Widget 2: Order Count (KPI Card)
    const orderCountWidget = new DashboardWidget(
      'widget_order_count_kpi',
      'sales-dashboard-system',
      WidgetType.KPI_CARD,
      'Orders',
      DataSourceType.ORDERS,
      {
        metric: 'order_count',
        dateRange: {
          startDate: this.getStartOfMonth(),
          endDate: new Date(),
        },
      },
      { x: 3, y: 0, width: 3, height: 2 },
      300
    );
    dashboard.addWidget(orderCountWidget);

    // Widget 3: Average Order Value (KPI Card)
    const aovWidget = new DashboardWidget(
      'widget_aov_kpi',
      'sales-dashboard-system',
      WidgetType.KPI_CARD,
      'Avg Order Value',
      DataSourceType.SALES,
      {
        metric: 'avg_order_value',
        dateRange: {
          startDate: this.getStartOfMonth(),
          endDate: new Date(),
        },
      },
      { x: 6, y: 0, width: 3, height: 2 },
      300
    );
    dashboard.addWidget(aovWidget);

    // Widget 4: Daily Revenue Trend (Line Chart)
    const trendWidget = new DashboardWidget(
      'widget_revenue_trend',
      'sales-dashboard-system',
      WidgetType.LINE_CHART,
      'Daily Revenue Trend',
      DataSourceType.SALES,
      {
        metric: 'total_revenue',
        groupBy: 'date',
        dateRange: {
          startDate: this.getStartOfMonth(),
          endDate: new Date(),
        },
      },
      { x: 0, y: 2, width: 6, height: 3 },
      300
    );
    dashboard.addWidget(trendWidget);

    // Widget 5: Revenue by Customer Tier (Pie Chart)
    const tierWidget = new DashboardWidget(
      'widget_revenue_by_tier',
      'sales-dashboard-system',
      WidgetType.PIE_CHART,
      'Revenue by Tier',
      DataSourceType.SALES,
      {
        metric: 'revenue_by_tier',
        groupBy: 'customer_tier',
        dateRange: {
          startDate: this.getStartOfMonth(),
          endDate: new Date(),
        },
      },
      { x: 6, y: 2, width: 3, height: 3 },
      300
    );
    dashboard.addWidget(tierWidget);

    return dashboard;
  }

  /**
   * Update widget caches with fetched data
   *
   * @param dashboard - Dashboard to update
   * @param data - Fetched data for widgets
   */
  private updateWidgetCaches(
    dashboard: Dashboard,
    data: {
      orderMetrics: any;
      tierRevenue: any;
    }
  ): void {
    for (const widget of dashboard.widgets) {
      switch (widget.title) {
        case 'Total Revenue':
          widget.updateCache(data.orderMetrics.totalRevenue);
          break;
        case 'Orders':
          widget.updateCache(data.orderMetrics.totalOrders);
          break;
        case 'Avg Order Value':
          widget.updateCache(data.orderMetrics.avgOrderValue);
          break;
        case 'Daily Revenue Trend':
          widget.updateCache(data.orderMetrics.dailyRevenue);
          break;
        case 'Revenue by Tier':
          widget.updateCache(data.tierRevenue);
          break;
      }
    }
  }

  /**
   * Get the start of the current month
   *
   * @returns Date at 00:00:00 on the 1st of current month
   */
  private getStartOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
