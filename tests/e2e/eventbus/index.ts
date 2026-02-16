/**
 * Event Bus E2E Tests Module
 *
 * Main entry point for event bus end-to-end tests.
 *
 * @module tests/e2e/eventbus
 */

export { default as EventBusE2ETest } from './EventBusE2ETest';
export {
  AuditTrailValidator,
  createAuditTrailValidator,
  AuditValidationResult,
  OutboxEventRecord,
  ProcessedEventRecord,
} from './AuditTrailValidator';

export {
  MetricsValidator,
  createMetricsValidator,
  MetricsValidationResult,
  ExpectedEventMetrics,
} from './MetricsValidator';

export {
  AlertValidator,
  createAlertValidator,
  AlertValidationResult,
  AlertSeverity,
  AlertRecord,
  ExpectedAlerts,
} from './AlertValidator';

export {
  E2ETestHelper,
  createE2ETestHelper,
  EventConfig,
  EventPublicationResult,
  EventConsumptionResult,
  DLQState,
  TestEnvironmentConfig,
  TestTopology,
} from './helpers/E2ETestHelper';

export {
  MetricsHelper,
  createMetricsHelper,
  MetricData,
  MetricSample,
  MetricsQueryResult,
} from './helpers/MetricsHelper';

export {
  AlertHelper,
  createAlertHelper,
  AlertConfig,
  AlertManagerResponse,
} from './helpers/AlertHelper';

export {
  TestRabbitMQ,
  createTestRabbitMQ,
} from '../../events/reliability/helpers/TestRabbitMQ';

export {
  TestPostgres,
  createTestPostgres,
} from '../../events/reliability/helpers/TestPostgres';
