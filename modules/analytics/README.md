# Analytics Module for CYPHER ERP

Enterprise-grade business intelligence and analytics system providing comprehensive dashboards, reports, metrics, and forecasting.

## Features

### Dashboards
- **Pre-built Dashboards**: Sales, Inventory, Customers, Financial
- **Custom Dashboards**: Users can create personalized dashboards
- **Shared Dashboards**: Team collaboration and visibility
- **Flexible Layouts**: Grid-based or freeform widget positioning
- **Global Filters**: Date range, customer tier, region filters

### Widgets
Multiple visualization types for different data:
- KPI Cards: Key metrics at a glance
- Line Charts: Trends over time
- Bar Charts: Comparisons
- Pie Charts: Proportions
- Tables: Detailed data views
- Heatmaps: Pattern detection
- Funnels: Conversion tracking
- Gauges: Target tracking

### Reports
Automated and on-demand reporting:
- **Report Types**: Sales, Customer, Inventory, Supplier, Financial, Custom
- **Scheduled Reports**: Daily/Weekly/Monthly generation and email delivery
- **Multiple Formats**: PDF, Excel, CSV
- **Email Recipients**: Send to multiple stakeholders
- **Generation Tracking**: History and frequency tracking

### Metrics & KPIs
Key business metrics calculated and tracked:
- **TOTAL_REVENUE**: Sum of paid orders
- **ORDER_COUNT**: Total orders
- **AVG_ORDER_VALUE**: Average order value
- **CUSTOMER_COUNT**: Unique customers
- **CONVERSION_RATE**: Quote to order conversion
- **INVENTORY_TURNOVER**: Inventory efficiency
- **SUPPLIER_RELIABILITY**: On-time delivery percentage
- **QUOTE_WIN_RATE**: Quote acceptance rate

### Forecasting
Statistical forecasting for future metrics:
- **Linear Regression**: Best for consistent trends
- **Moving Average**: Smoothing noisy data
- **Exponential Smoothing**: Recent data weighted more
- **Seasonal**: Accounts for seasonal patterns
- **Accuracy Metrics**: MAPE and confidence intervals
- **Configurable Horizon**: 30/60/90 day forecasts

### Data Integration
Integrates with other modules:
- Orders module: Revenue, order metrics
- Inventory module: Stock levels, turnover
- Customers module: Customer metrics, retention
- Pricing module: Revenue by tier, discounts
- Suppliers module: Delivery, reliability, pricing

## Architecture

### Domain Layer (`src/domain/`)
Rich domain entities with business logic:

**Entities**:
- `DashboardWidget`: Individual visualization widgets
- `Dashboard`: Container for widgets with filters
- `Report`: Report definition with schedule and recipients
- `MetricSnapshot`: Time-series metric data point
- `Forecast`: Statistical forecast for a metric

**Services**:
- `MetricCalculationService`: Calculates metrics from raw data
- `ForecastingService`: Generates forecasts using statistical methods
- `DataAggregationService`: Aggregates raw events into snapshots

**Repositories** (Interfaces):
- `IDashboardRepository`: Dashboard persistence
- `IReportRepository`: Report persistence
- `IMetricRepository`: Metric snapshot persistence
- `IForecastRepository`: Forecast persistence

**Errors**:
- `DashboardNotFoundError`
- `ReportGenerationError`
- `InsufficientDataError`
- `InvalidMetricError`
- `ForecastError`
- `WidgetConfigError`

### Application Layer (`src/application/`)
Use-cases implementing business workflows:

**Use-Cases**:
- `GetSalesDashboard`: Retrieve sales dashboard
- `GetInventoryDashboard`: Retrieve inventory dashboard
- `GetCustomerDashboard`: Retrieve customer dashboard
- `GetFinancialOverview`: Retrieve financial dashboard
- `CreateCustomDashboard`: Create user dashboard
- `UpdateDashboard`: Modify dashboard widgets
- `GenerateReport`: Generate report in format
- `ScheduleReport`: Set up recurring report
- `GetMetricTimeSeries`: Time-series data with grouping
- `CompareMetrics`: Compare two periods
- `GenerateForecast`: Generate forecast
- `SnapshotMetrics`: Calculate daily snapshots (background)
- `GetTopProducts`: Top N products by revenue/quantity
- `GetTopCustomers`: Top N customers
- `GetSupplierPerformance`: Supplier metrics
- `ExportData`: Export metrics as CSV/Excel

**Ports** (Hexagonal Architecture):
- `IOrderDataPort`: Fetch order metrics
- `IInventoryDataPort`: Fetch inventory metrics
- `ICustomerDataPort`: Fetch customer metrics
- `IPricingDataPort`: Fetch pricing data
- `ISupplierDataPort`: Fetch supplier metrics
- `INotificationPort`: Send email reports

### Infrastructure Layer (`src/infrastructure/`)
Concrete implementations:

**Entities**:
- TypeORM database entities for all domain entities

**Repositories**:
- `TypeOrmDashboardRepository`: SQL-based dashboard persistence
- `TypeOrmReportRepository`: SQL-based report persistence
- `TypeOrmMetricRepository`: Time-series metric storage
- `TypeOrmForecastRepository`: Forecast persistence

**Jobs** (BullMQ Background Jobs):
- `DailySnapshotJob`: Daily 00:30 UTC - calculate metric snapshots
- `WeeklyReportJob`: Monday 06:00 UTC - generate scheduled weekly reports
- `MonthlyReportJob`: 1st of month 06:00 UTC - generate monthly reports
- `ForecastUpdateJob`: Sunday 03:00 UTC - regenerate forecasts
- `WidgetCacheRefreshJob`: Every 15 minutes - refresh widget caches

### API Layer
RESTful endpoints (18 total):

**Dashboard Endpoints**:
1. `GET /api/v1/analytics/dashboard/sales` - Sales dashboard
2. `GET /api/v1/analytics/dashboard/inventory` - Inventory dashboard
3. `GET /api/v1/analytics/dashboard/customers` - Customer dashboard
4. `GET /api/v1/analytics/dashboard/financial` - Financial overview
5. `POST /api/v1/analytics/dashboards` - Create custom dashboard
6. `GET /api/v1/analytics/dashboards` - List user dashboards
7. `GET /api/v1/analytics/dashboards/:id` - Get dashboard
8. `PUT /api/v1/analytics/dashboards/:id` - Update dashboard
9. `DELETE /api/v1/analytics/dashboards/:id` - Delete dashboard

**Metrics Endpoints**:
10. `GET /api/v1/analytics/metrics/:type` - Get metric time-series
11. `GET /api/v1/analytics/compare` - Compare two periods

**Forecasting Endpoints**:
12. `GET /api/v1/analytics/forecast/:type` - Get forecast

**Report Endpoints**:
13. `POST /api/v1/analytics/reports` - Generate report
14. `POST /api/v1/analytics/reports/schedule` - Schedule report

**Analysis Endpoints**:
15. `GET /api/v1/analytics/top-products` - Top products
16. `GET /api/v1/analytics/top-customers` - Top customers
17. `GET /api/v1/analytics/suppliers` - Supplier performance
18. `GET /api/v1/analytics/export/:type` - Export data

## Module Configuration

### Module Interface
```typescript
readonly name = 'analytics'
readonly version = '1.0.0'
readonly dependencies = ['orders', 'inventory', 'pricing-engine', 'suppliers']
readonly publishedEvents = [
  'analytics.report_generated',
  'analytics.forecast_updated',
  'analytics.alert_threshold',
]
readonly subscribedEvents = [
  'order.completed',
  'order.paid',
  'inventory.stock_changed',
  'customer.registered',
  'quote.accepted',
]
```

### Performance Characteristics
- Handles 100K+ metric snapshots efficiently
- Multi-level caching (Redis + in-memory)
- Widget cache refresh every 15 minutes (configurable)
- Supports concurrent dashboard access and report generation
- Sub-100ms dashboard retrieval with caching

### Database Schema
Tables created via TypeORM migrations:
- `dashboards` - Dashboard configurations
- `dashboard_widgets` - Widget definitions
- `reports` - Report definitions and schedules
- `metric_snapshots` - Time-series metric data
- `forecasts` - Forecast models and predictions

### Caching Strategy
- Redis L1 cache: Widget data, metric snapshots
- In-memory L2 cache: Recent queries
- TTL: Configurable per widget (default 5 minutes)
- Manual refresh: On-demand cache refresh available

## Testing

Comprehensive test suite included:

**Unit Tests**:
- `tests/domain/Dashboard.test.ts` - 60+ assertions
- `tests/domain/MetricSnapshot.test.ts` - 50+ assertions
- `tests/domain/Forecast.test.ts` - 45+ assertions
- `tests/domain/Report.test.ts` - 40+ assertions

**Integration Tests**:
- `tests/application/GetSalesDashboard.test.ts` - 20+ scenarios
- `tests/application/GenerateReport.test.ts` - 15+ scenarios
- `tests/application/GenerateForecast.test.ts` - 18+ scenarios
- `tests/application/GetMetricTimeSeries.test.ts` - 12+ scenarios
- `tests/application/CompareMetrics.test.ts` - 10+ scenarios

**Coverage**: >85% code coverage

## Configuration

### Environment Variables
```
ANALYTICS_CACHE_TTL=300              # Widget cache TTL in seconds
ANALYTICS_FORECAST_DAYS=30           # Forecast horizon
ANALYTICS_MIN_DATA_POINTS=5          # Minimum for forecasting
ANALYTICS_METRIC_RETENTION_DAYS=730  # Keep 2 years of snapshots
ANALYTICS_REPORT_TIMEOUT=30000       # Report generation timeout
```

### Feature Flags
```
enable_advanced_forecasting    # Advanced forecast methods
enable_scheduled_reports       # Scheduled report delivery
enable_alert_thresholds        # Alert notifications
```

## Development

### Setup
```bash
npm install
npm run build
npm run test
npm run lint
```

### Database Migrations
```bash
npm run typeorm migration:generate -- -n <migration-name>
npm run typeorm migration:run
```

### Running Tests
```bash
npm run test                    # All tests
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests
npm run test:coverage          # With coverage report
```

## Enterprise Requirements Checklist

- ✅ **Zero `as any`**: All code is strongly typed
- ✅ **Full JSDoc**: Every class, method, interface documented
- ✅ **Hexagonal Architecture**: Clear ports and adapters
- ✅ **Rich Domain Entities**: Business logic in entities
- ✅ **SRP Use-Cases**: Each use-case has single responsibility
- ✅ **Port Interfaces**: Hexagonal ports for external dependencies
- ✅ **Composition Root**: Dependency injection setup
- ✅ **ICypherModule Interface**: Proper module implementation
- ✅ **Feature Flags**: Configurable features
- ✅ **Tests**: 200+ test cases, >85% coverage
- ✅ **Structured Logging**: Winston logger integration
- ✅ **Event-Driven**: Event publishing and subscription
- ✅ **Background Jobs**: BullMQ job scheduling
- ✅ **Error Handling**: Custom domain errors
- ✅ **Data Validation**: Input validation in use-cases

## License

CYPHER ERP - Proprietary
