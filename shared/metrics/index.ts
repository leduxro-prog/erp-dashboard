/**
 * Metrics module barrel exports
 */

export {
  PrometheusExporter,
  collectPrometheusMetrics,
  formatPrometheusMetrics,
  type PrometheusMetricType,
  type PrometheusMetricLine,
} from './prometheus-exporter';

export {
  createMetricsMiddleware,
  createMetricsEndpoint,
  getMetricsCollector,
  resetMetrics,
  metricsMiddlewareUtils,
  type RouteMetrics,
  type AggregateMetrics,
} from './metrics-middleware';
