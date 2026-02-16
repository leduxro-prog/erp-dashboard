import Joi from 'joi';

/**
 * Dashboard creation schema
 */
export const createDashboardSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().optional(),
  dashboard_type: Joi.string()
    .valid('SALES', 'INVENTORY', 'CUSTOMER', 'MARKETING', 'OPERATIONS', 'CUSTOM')
    .required(),
  is_public: Joi.boolean().optional().default(false),
  refresh_interval: Joi.number().positive().optional(),
  layout: Joi.object().optional(),
  metadata: Joi.object().optional(),
});

/**
 * Dashboard update schema
 */
export const updateDashboardSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  description: Joi.string().optional(),
  is_public: Joi.boolean().optional(),
  refresh_interval: Joi.number().positive().optional(),
  layout: Joi.object().optional(),
});

/**
 * List dashboards schema
 */
export const listDashboardsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  dashboard_type: Joi.string().optional(),
  is_public: Joi.boolean().optional(),
  search: Joi.string().optional(),
});

/**
 * Widget creation schema
 */
export const createWidgetSchema = Joi.object({
  name: Joi.string().max(255).required(),
  widget_type: Joi.string()
    .valid('CHART', 'METRIC', 'TABLE', 'GAUGE', 'HEATMAP', 'TIMELINE', 'MAP', 'CUSTOM')
    .required(),
  chart_type: Joi.string()
    .valid('LINE', 'BAR', 'PIE', 'AREA', 'SCATTER', 'BUBBLE')
    .optional(),
  data_source: Joi.string().required(),
  metric_key: Joi.string().optional(),
  query_config: Joi.object().optional(),
  position: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    width: Joi.number().positive().required(),
    height: Joi.number().positive().required(),
  }).required(),
  filters: Joi.array().items(Joi.object()).optional(),
  refresh_interval: Joi.number().positive().optional(),
  style_config: Joi.object().optional(),
});

/**
 * Widget update schema
 */
export const updateWidgetSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  query_config: Joi.object().optional(),
  position: Joi.object({
    x: Joi.number().optional(),
    y: Joi.number().optional(),
    width: Joi.number().positive().optional(),
    height: Joi.number().positive().optional(),
  }).optional(),
  filters: Joi.array().items(Joi.object()).optional(),
  refresh_interval: Joi.number().positive().optional(),
});

/**
 * Report generation schema
 */
export const generateReportSchema = Joi.object({
  name: Joi.string().max(255).required(),
  report_type: Joi.string()
    .valid('SALES', 'INVENTORY', 'CUSTOMER', 'MARKETING', 'FINANCIAL', 'OPERATIONAL', 'CUSTOM')
    .required(),
  format: Joi.string()
    .valid('PDF', 'CSV', 'EXCEL', 'JSON')
    .optional()
    .default('PDF'),
  date_range: Joi.object({
    start_date: Joi.date().required(),
    end_date: Joi.date().required(),
  }).required(),
  filters: Joi.object().optional(),
  group_by: Joi.string().optional(),
  include_charts: Joi.boolean().optional().default(true),
  include_summary: Joi.boolean().optional().default(true),
  schedule: Joi.string().optional(),
});

/**
 * List reports schema
 */
export const listReportsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  report_type: Joi.string().optional(),
  status: Joi.string()
    .valid('PENDING', 'GENERATING', 'COMPLETED', 'FAILED')
    .optional(),
  search: Joi.string().optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
});

/**
 * Metric snapshot schema
 */
export const createMetricSnapshotSchema = Joi.object({
  snapshot_name: Joi.string().max(255).required(),
  metric_keys: Joi.array()
    .items(Joi.string())
    .min(1)
    .required(),
  date_range: Joi.object({
    start_date: Joi.date().required(),
    end_date: Joi.date().required(),
  }).optional(),
  dimensions: Joi.array().items(Joi.string()).optional(),
  filters: Joi.object().optional(),
});

/**
 * List metric snapshots schema
 */
export const listMetricSnapshotsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  metric_key: Joi.string().optional(),
  search: Joi.string().optional(),
});

/**
 * Forecast generation schema
 */
export const generateForecastSchema = Joi.object({
  forecast_name: Joi.string().max(255).required(),
  metric_key: Joi.string().required(),
  forecast_periods: Joi.number().integer().min(1).max(24).required(),
  period_type: Joi.string()
    .valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY')
    .required(),
  confidence_level: Joi.number().min(0.5).max(0.99).optional().default(0.95),
  historical_periods: Joi.number().integer().min(12).max(120).optional().default(24),
  method: Joi.string()
    .valid('LINEAR', 'EXPONENTIAL_SMOOTHING', 'ARIMA', 'PROPHET')
    .optional()
    .default('PROPHET'),
  filters: Joi.object().optional(),
});

/**
 * List forecasts schema
 */
export const listForecastsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  metric_key: Joi.string().optional(),
  search: Joi.string().optional(),
});

/**
 * KPI dashboard schema (read-only, no special input validation)
 */
export const kpiQuerySchema = Joi.object({
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  region: Joi.string().optional(),
  category: Joi.string().optional(),
  dimension: Joi.string().optional(),
});

/**
 * Validation middleware for requests
 */
export function validateRequest(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    // Validate body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const { error: bodyError, value: bodyValue } = schema.validate(req.body);
      if (bodyError) {
        return res.status(400).json({
          error: bodyError.details[0].message,
          code: 'VALIDATION_ERROR',
        });
      }
      req.validatedBody = bodyValue;
    }

    // Validate query for GET requests
    if (req.method === 'GET') {
      const { error: queryError, value: queryValue } = schema.validate(req.query);
      if (queryError) {
        return res.status(400).json({
          error: queryError.details[0].message,
          code: 'VALIDATION_ERROR',
        });
      }
      req.validatedQuery = queryValue;
    }

    next();
  };
}
