/**
 * Alerting module barrel exports
 * Central export point for all alert management functionality
 *
 * @module shared/alerting
 */

// Alert Manager exports
export {
  AlertManager,
  getAlertManager,
  sendAlert,
  Alert,
  AlertLevel,
  IAlertChannel,
  WebhookChannel,
  EmailChannel,
  LogChannel,
  PagerDutyChannel,
} from './alert-manager';

import { getAlertManager, sendAlert } from './alert-manager';

// Alert Rules exports
export {
  AlertRule,
  LowStockAlertRule,
  sendLowStockAlert,
  FailedSyncAlertRule,
  sendFailedSyncAlert,
  HighErrorRateAlertRule,
  sendHighErrorRateAlert,
  PaymentFailureAlertRule,
  sendPaymentFailureAlert,
  LateDeliveryAlertRule,
  sendLateDeliveryAlert,
  QueueDepthAlertRule,
  sendQueueDepthAlert,
  ApiRateLimitAlertRule,
  sendApiRateLimitAlert,
  DatabasePoolAlertRule,
  sendDatabasePoolAlert,
  MemoryUsageAlertRule,
  sendMemoryUsageAlert,
  CacheHitRateDegradationAlertRule,
  sendCacheHitRateAlert,
  ALL_ALERT_RULES,
  getAlertRule,
} from './alert-rules';

export default {
  getAlertManager,
  sendAlert,
};
