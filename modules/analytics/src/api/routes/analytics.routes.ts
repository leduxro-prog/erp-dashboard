/**
 * Analytics API Routes
 * Defines all analytics endpoints including dashboards, reports, metrics, and KPI dashboards
 */
import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import {
  createDashboardSchema,
  updateDashboardSchema,
  listDashboardsSchema,
  createWidgetSchema,
  updateWidgetSchema,
  generateReportSchema,
  listReportsSchema,
  createMetricSnapshotSchema,
  listMetricSnapshotsSchema,
  generateForecastSchema,
  listForecastsSchema,
  kpiQuerySchema,
  validateRequest,
} from '../validators/analytics.validators';

/**
 * Create and configure analytics routes
 */
export function createAnalyticsRoutes(controller: AnalyticsController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * DASHBOARD ROUTES
   */

  /**
   * GET /api/v1/analytics/dashboards
   * List all dashboards with pagination
   * Auth: user
   * Query params: page, limit, dashboard_type, is_public, search
   */
  router.get('/dashboards', validateRequest(listDashboardsSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.listDashboards(req, res, next)
  );

  /**
   * POST /api/v1/analytics/dashboards
   * Create a new dashboard
   * Auth: user
   */
  router.post('/dashboards', validateRequest(createDashboardSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.createDashboard(req, res, next)
  );

  /**
   * GET /api/v1/analytics/dashboards/:id
   * Get dashboard with all widgets
   * Auth: user
   */
  router.get('/dashboards/:id', (req: Request, res: Response, next: NextFunction) =>
    controller.getDashboardWithWidgets(req, res, next)
  );

  /**
   * PUT /api/v1/analytics/dashboards/:id
   * Update dashboard
   * Auth: user (owner) or admin
   */
  router.put('/dashboards/:id', validateRequest(updateDashboardSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.updateDashboard(req, res, next)
  );

  /**
   * DELETE /api/v1/analytics/dashboards/:id
   * Delete dashboard
   * Auth: admin
   */
  router.delete('/dashboards/:id', requireRole(['admin']), (req: Request, res: Response, next: NextFunction) =>
    controller.deleteDashboard(req, res, next)
  );

  /**
   * POST /api/v1/analytics/dashboards/:id/widgets
   * Add widget to dashboard
   * Auth: user (owner) or admin
   */
  router.post('/dashboards/:id/widgets', validateRequest(createWidgetSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.addWidget(req, res, next)
  );

  /**
   * PUT /api/v1/analytics/dashboards/:id/widgets/:widgetId
   * Update widget in dashboard
   * Auth: user (owner) or admin
   */
  router.put('/dashboards/:id/widgets/:widgetId', validateRequest(updateWidgetSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.updateWidget(req, res, next)
  );

  /**
   * DELETE /api/v1/analytics/dashboards/:id/widgets/:widgetId
   * Remove widget from dashboard
   * Auth: user (owner) or admin
   */
  router.delete('/dashboards/:id/widgets/:widgetId', (req: Request, res: Response, next: NextFunction) =>
    controller.removeWidget(req, res, next)
  );

  /**
   * REPORT ROUTES
   */

  /**
   * POST /api/v1/analytics/reports
   * Generate a new report (async operation)
   * Auth: user
   * Supported formats: PDF, CSV, EXCEL, JSON
   */
  router.post('/reports', validateRequest(generateReportSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.generateReport(req, res, next)
  );

  /**
   * GET /api/v1/analytics/reports
   * List all generated reports with pagination
   * Auth: user
   * Query params: page, limit, report_type, status, search, start_date, end_date
   */
  router.get('/reports', validateRequest(listReportsSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.listReports(req, res, next)
  );

  /**
   * GET /api/v1/analytics/reports/:id
   * Get report details
   * Auth: user
   */
  router.get('/reports/:id', (req: Request, res: Response, next: NextFunction) =>
    controller.getReportDetails(req, res, next)
  );

  /**
   * GET /api/v1/analytics/reports/:id/download
   * Download report in specified format
   * Auth: user
   * Query params: format (CSV, EXCEL, PDF)
   */
  router.get('/reports/:id/download', (req: Request, res: Response, next: NextFunction) =>
    controller.downloadReport(req, res, next)
  );

  /**
   * METRIC SNAPSHOT ROUTES
   */

  /**
   * GET /api/v1/analytics/metrics/snapshots
   * Get metric snapshots with pagination
   * Auth: user
   * Query params: page, limit, metric_key, search
   */
  router.get('/metrics/snapshots', validateRequest(listMetricSnapshotsSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.getMetricSnapshots(req, res, next)
  );

  /**
   * POST /api/v1/analytics/metrics/snapshots
   * Create a metric snapshot (capture point-in-time metrics)
   * Auth: user
   */
  router.post('/metrics/snapshots', validateRequest(createMetricSnapshotSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.createMetricSnapshot(req, res, next)
  );

  /**
   * FORECAST ROUTES
   */

  /**
   * GET /api/v1/analytics/forecasts
   * Get forecasts with pagination
   * Auth: user
   * Query params: page, limit, metric_key, search
   */
  router.get('/forecasts', validateRequest(listForecastsSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.getForecasts(req, res, next)
  );

  /**
   * POST /api/v1/analytics/forecasts/generate
   * Generate a forecast using specified method
   * Auth: admin (requires permission)
   * Methods: LINEAR, EXPONENTIAL_SMOOTHING, ARIMA, PROPHET
   */
  router.post('/forecasts/generate', requireRole(['admin']), validateRequest(generateForecastSchema), (req: Request, res: Response, next: NextFunction) =>
    controller.generateForecast(req, res, next)
  );

  /**
   * KPI ROUTES
   */

  /**
   * GET /api/v1/analytics/kpi/sales
   * Get Sales KPI dashboard with key metrics
   * Auth: user
   * Query params: start_date, end_date, region
   * Includes: revenue, orders, AOV, conversion rate, CAC, LTV, top products
   */
  router.get('/kpi/sales', validateRequest(kpiQuerySchema), (req: Request, res: Response, next: NextFunction) =>
    controller.getSalesKPI(req, res, next)
  );

  /**
   * GET /api/v1/analytics/kpi/inventory
   * Get Inventory KPI dashboard with key metrics
   * Auth: user
   * Query params: start_date, end_date, category
   * Includes: stock value, turnover, stockouts, accuracy, warehouse utilization
   */
  router.get('/kpi/inventory', (req: Request, res: Response, next: NextFunction) =>
    controller.getInventoryKPI(req, res, next)
  );

  return router;
}
