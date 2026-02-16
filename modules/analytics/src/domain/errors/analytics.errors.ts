import { BaseError, NotFoundError, ValidationError, BusinessRuleError } from '@shared/errors/BaseError';

/**
 * Analytics Module Error Definitions
 *
 * Domain-specific errors for the analytics module.
 * All errors extend BaseError for consistent handling and HTTP response generation.
 *
 * @module analytics.errors
 */

/**
 * DashboardNotFoundError - HTTP 404
 * Thrown when a dashboard cannot be found by ID
 *
 * @extends NotFoundError
 */
export class DashboardNotFoundError extends NotFoundError {
  /**
   * Create a DashboardNotFoundError
   *
   * @param dashboardId - The dashboard ID that was not found
   */
  constructor(dashboardId: string) {
    super('Dashboard', dashboardId);
  }
}

/**
 * ReportNotFoundError - HTTP 404
 * Thrown when a report cannot be found by ID
 *
 * @extends NotFoundError
 */
export class ReportNotFoundError extends NotFoundError {
  /**
   * Create a ReportNotFoundError
   *
   * @param reportId - The report ID that was not found
   */
  constructor(reportId: string) {
    super('Report', reportId);
  }
}

/**
 * WidgetNotFoundError - HTTP 404
 * Thrown when a dashboard widget cannot be found
 *
 * @extends NotFoundError
 */
export class WidgetNotFoundError extends NotFoundError {
  /**
   * Create a WidgetNotFoundError
   *
   * @param widgetId - The widget ID that was not found
   */
  constructor(widgetId: string) {
    super('Widget', widgetId);
  }
}

/**
 * ForecastNotFoundError - HTTP 404
 * Thrown when a forecast cannot be found
 *
 * @extends NotFoundError
 */
export class ForecastNotFoundError extends NotFoundError {
  /**
   * Create a ForecastNotFoundError
   *
   * @param metricType - The metric type that was not forecasted
   */
  constructor(metricType: string) {
    super('Forecast for metric', metricType);
  }
}

/**
 * ReportGenerationError - HTTP 500
 * Thrown when report generation fails
 *
 * Wrapped around underlying errors like data fetch failures,
 * template processing errors, or file generation errors.
 *
 * @extends BaseError
 */
export class ReportGenerationError extends BaseError {
  /**
   * Create a ReportGenerationError
   *
   * @param message - Description of what went wrong during generation
   * @param cause - Optional underlying error
   */
  constructor(message: string, public cause?: Error) {
    super(message, 'REPORT_GENERATION_ERROR', 500);
  }
}

/**
 * InsufficientDataError - HTTP 422
 * Thrown when there is not enough data to perform requested operation
 *
 * E.g., generating a forecast with only 2 data points when minimum is 10
 *
 * @extends BusinessRuleError
 */
export class InsufficientDataError extends BusinessRuleError {
  /**
   * Create an InsufficientDataError
   *
   * @param operation - Operation being attempted (e.g., "forecast", "comparison")
   * @param required - Minimum data required
   * @param available - Data actually available
   */
  constructor(operation: string, required: number, available: number) {
    super(
      `Insufficient data for ${operation}: required ${required}, but only ${available} data points available`,
      'INSUFFICIENT_DATA'
    );
  }
}

/**
 * InvalidMetricError - HTTP 400
 * Thrown when an invalid metric type or configuration is provided
 *
 * @extends ValidationError
 */
export class InvalidMetricError extends ValidationError {
  /**
   * Create an InvalidMetricError
   *
   * @param metricType - The invalid metric type
   * @param details - Optional explanation
   */
  constructor(metricType: string, details?: string) {
    super(
      `Invalid metric type: ${metricType}`,
      details || 'Metric type not supported'
    );
  }
}

/**
 * ForecastError - HTTP 500
 * Thrown when forecast generation fails
 *
 * Covers issues like:
 * - Insufficient/invalid historical data
 * - Mathematical errors in forecast calculation
 * - Unsupported forecast method
 *
 * @extends BaseError
 */
export class ForecastError extends BaseError {
  /**
   * Create a ForecastError
   *
   * @param message - Description of forecast error
   * @param code - Machine-readable error code
   * @param cause - Optional underlying error
   */
  constructor(message: string, code: string = 'FORECAST_ERROR', public cause?: Error) {
    super(message, code, 500);
  }
}

/**
 * WidgetConfigError - HTTP 400
 * Thrown when a widget configuration is invalid
 *
 * E.g., missing required fields, invalid data source, invalid filters
 *
 * @extends ValidationError
 */
export class WidgetConfigError extends ValidationError {
  /**
   * Create a WidgetConfigError
   *
   * @param field - Configuration field with issue
   * @param details - Explanation of what's wrong
   */
  constructor(field: string, details: string) {
    super(`Invalid widget configuration for field '${field}'`, details);
  }
}

/**
 * DataSourceError - HTTP 503
 * Thrown when required data source is unavailable
 *
 * E.g., order data, inventory data, or customer data cannot be fetched
 *
 * @extends BaseError
 */
export class DataSourceError extends BaseError {
  /**
   * Create a DataSourceError
   *
   * @param dataSourceType - Type of data source (ORDERS, INVENTORY, CUSTOMERS, etc.)
   * @param cause - Optional underlying error
   */
  constructor(dataSourceType: string, public cause?: Error) {
    super(
      `Data source unavailable: ${dataSourceType}`,
      'DATA_SOURCE_ERROR',
      503
    );
  }
}

/**
 * DashboardAccessError - HTTP 403
 * Thrown when user does not have permission to access a dashboard
 *
 * @extends BaseError
 */
export class DashboardAccessError extends BaseError {
  /**
   * Create a DashboardAccessError
   *
   * @param dashboardId - ID of inaccessible dashboard
   * @param userId - User attempting access
   */
  constructor(dashboardId: string, userId: string) {
    super(
      `User ${userId} does not have permission to access dashboard ${dashboardId}`,
      'DASHBOARD_ACCESS_DENIED',
      403
    );
  }
}

/**
 * InvalidDateRangeError - HTTP 400
 * Thrown when date range is invalid for a query
 *
 * @extends ValidationError
 */
export class InvalidDateRangeError extends ValidationError {
  /**
   * Create an InvalidDateRangeError
   *
   * @param reason - Why the date range is invalid
   */
  constructor(reason: string) {
    super('Invalid date range', reason);
  }
}

/**
 * CacheRefreshError - HTTP 500
 * Thrown when widget cache refresh fails
 *
 * Non-fatal - cache hit should still be used
 *
 * @extends BaseError
 */
export class CacheRefreshError extends BaseError {
  /**
   * Create a CacheRefreshError
   *
   * @param widgetId - ID of widget whose cache failed to refresh
   * @param cause - Underlying error
   */
  constructor(widgetId: string, public cause?: Error) {
    super(
      `Failed to refresh cache for widget ${widgetId}`,
      'CACHE_REFRESH_ERROR',
      500
    );
  }
}
