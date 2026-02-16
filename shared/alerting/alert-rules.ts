/**
 * Alert Rules - Common ERP alert rule definitions
 * Defines thresholds and conditions for various system alerts
 *
 * @module shared/alerting/alert-rules
 */

import { AlertLevel, getAlertManager } from './alert-manager';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('alert-rules');

/**
 * Alert rule interface
 */
export interface AlertRule {
  name: string;
  description: string;
  defaultLevel: AlertLevel;
  defaultEnabled: boolean;
}

/**
 * Low stock alert rule
 * Triggered when inventory falls below configured threshold
 */
export const LowStockAlertRule: AlertRule = {
  name: 'LOW_STOCK',
  description: 'Inventory quantity below configured threshold',
  defaultLevel: AlertLevel.WARNING,
  defaultEnabled: true,
};

/**
 * Send low stock alert
 */
export async function sendLowStockAlert(
  productId: number,
  productName: string,
  currentQuantity: number,
  threshold: number
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    LowStockAlertRule.defaultLevel,
    'Low Stock Alert',
    `Product "${productName}" (ID: ${productId}) inventory is low`,
    {
      productId,
      productName,
      currentQuantity,
      threshold,
      category: 'inventory',
      ruleId: 'LOW_STOCK',
    }
  );

  logger.warn('Low stock alert sent', {
    productId,
    currentQuantity,
    threshold,
  });
}

/**
 * Failed sync alert rule
 * Triggered when external system synchronization fails
 */
export const FailedSyncAlertRule: AlertRule = {
  name: 'FAILED_SYNC',
  description: 'External system synchronization failure (SmartBill or WooCommerce)',
  defaultLevel: AlertLevel.CRITICAL,
  defaultEnabled: true,
};

/**
 * Send failed sync alert
 */
export async function sendFailedSyncAlert(
  system: 'SmartBill' | 'WooCommerce',
  reason: string,
  lastSuccessfulSync?: Date
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    FailedSyncAlertRule.defaultLevel,
    `${system} Synchronization Failed`,
    `${system} synchronization encountered an error: ${reason}`,
    {
      system,
      reason,
      lastSuccessfulSync: lastSuccessfulSync?.toISOString(),
      category: 'integration',
      ruleId: 'FAILED_SYNC',
    }
  );

  logger.error('Failed sync alert sent', {
    system,
    reason,
  });
}

/**
 * High error rate alert rule
 * Triggered when error rate exceeds threshold
 */
export const HighErrorRateAlertRule: AlertRule = {
  name: 'HIGH_ERROR_RATE',
  description: 'Error rate exceeds 10 errors per minute',
  defaultLevel: AlertLevel.CRITICAL,
  defaultEnabled: true,
};

/**
 * Send high error rate alert
 */
export async function sendHighErrorRateAlert(
  currentErrorRate: number,
  threshold: number = 10,
  errorSamples?: Array<{ message: string; timestamp: Date }>
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    HighErrorRateAlertRule.defaultLevel,
    'High Error Rate Detected',
    `System is experiencing elevated error rates: ${currentErrorRate} errors/minute (threshold: ${threshold})`,
    {
      currentErrorRate,
      threshold,
      category: 'system',
      ruleId: 'HIGH_ERROR_RATE',
      recentErrors: errorSamples?.slice(0, 5).map(e => ({
        message: e.message,
        time: e.timestamp.toISOString(),
      })),
    }
  );

  logger.error('High error rate alert sent', {
    currentErrorRate,
    threshold,
  });
}

/**
 * Payment failure alert rule
 * Triggered when payment processing fails
 */
export const PaymentFailureAlertRule: AlertRule = {
  name: 'PAYMENT_FAILURE',
  description: 'Payment processing failure',
  defaultLevel: AlertLevel.CRITICAL,
  defaultEnabled: true,
};

/**
 * Send payment failure alert
 */
export async function sendPaymentFailureAlert(
  orderId: number,
  amount: number,
  currency: string,
  reason: string,
  paymentGateway?: string
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    PaymentFailureAlertRule.defaultLevel,
    'Payment Processing Failed',
    `Payment for order #${orderId} failed: ${reason}`,
    {
      orderId,
      amount,
      currency,
      reason,
      paymentGateway,
      category: 'payment',
      ruleId: 'PAYMENT_FAILURE',
    }
  );

  logger.error('Payment failure alert sent', {
    orderId,
    amount,
    reason,
  });
}

/**
 * Late delivery alert rule
 * Triggered when order exceeds estimated delivery date
 */
export const LateDeliveryAlertRule: AlertRule = {
  name: 'LATE_DELIVERY',
  description: 'Order past estimated delivery date',
  defaultLevel: AlertLevel.WARNING,
  defaultEnabled: true,
};

/**
 * Send late delivery alert
 */
export async function sendLateDeliveryAlert(
  orderId: number,
  orderNumber: string,
  estimatedDelivery: Date,
  daysPast: number
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    LateDeliveryAlertRule.defaultLevel,
    'Late Delivery Detected',
    `Order #${orderNumber} is ${daysPast} days past estimated delivery date (${estimatedDelivery.toDateString()})`,
    {
      orderId,
      orderNumber,
      estimatedDelivery: estimatedDelivery.toISOString(),
      daysPast,
      category: 'order',
      ruleId: 'LATE_DELIVERY',
    }
  );

  logger.warn('Late delivery alert sent', {
    orderId,
    daysPast,
  });
}

/**
 * Queue depth alert rule
 * Triggered when job queue grows too large
 */
export const QueueDepthAlertRule: AlertRule = {
  name: 'QUEUE_DEPTH',
  description: 'BullMQ job queue depth exceeds 1000 items',
  defaultLevel: AlertLevel.WARNING,
  defaultEnabled: true,
};

/**
 * Send queue depth alert
 */
export async function sendQueueDepthAlert(
  queueName: string,
  currentDepth: number,
  threshold: number = 1000,
  pendingCount?: number,
  delayedCount?: number
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    QueueDepthAlertRule.defaultLevel,
    'Queue Depth Warning',
    `Job queue "${queueName}" has grown to ${currentDepth} items (threshold: ${threshold})`,
    {
      queueName,
      currentDepth,
      threshold,
      pendingCount,
      delayedCount,
      category: 'queue',
      ruleId: 'QUEUE_DEPTH',
    }
  );

  logger.warn('Queue depth alert sent', {
    queueName,
    currentDepth,
    threshold,
  });
}

/**
 * API rate limit alert rule
 * Triggered when approaching rate limit
 */
export const ApiRateLimitAlertRule: AlertRule = {
  name: 'API_RATE_LIMIT',
  description: 'API rate limit approaching (>80% of limit)',
  defaultLevel: AlertLevel.WARNING,
  defaultEnabled: true,
};

/**
 * Send API rate limit alert
 */
export async function sendApiRateLimitAlert(
  apiService: string,
  currentUsage: number,
  limit: number,
  percentageUsed: number,
  resetTime?: Date
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    ApiRateLimitAlertRule.defaultLevel,
    'API Rate Limit Approaching',
    `${apiService} API rate limit is at ${percentageUsed}% (${currentUsage}/${limit} requests used)`,
    {
      apiService,
      currentUsage,
      limit,
      percentageUsed,
      resetTime: resetTime?.toISOString(),
      category: 'api',
      ruleId: 'API_RATE_LIMIT',
    }
  );

  logger.warn('API rate limit alert sent', {
    apiService,
    percentageUsed,
  });
}

/**
 * Database connection pool exhausted alert
 */
export const DatabasePoolAlertRule: AlertRule = {
  name: 'DATABASE_POOL_EXHAUSTED',
  description: 'Database connection pool nearly exhausted',
  defaultLevel: AlertLevel.CRITICAL,
  defaultEnabled: true,
};

/**
 * Send database pool alert
 */
export async function sendDatabasePoolAlert(
  activeConnections: number,
  poolSize: number,
  percentageUsed: number
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    DatabasePoolAlertRule.defaultLevel,
    'Database Connection Pool Alert',
    `Database connection pool is at ${percentageUsed}% capacity (${activeConnections}/${poolSize} connections used)`,
    {
      activeConnections,
      poolSize,
      percentageUsed,
      category: 'database',
      ruleId: 'DATABASE_POOL_EXHAUSTED',
    }
  );

  logger.error('Database pool alert sent', {
    activeConnections,
    poolSize,
  });
}

/**
 * Memory usage alert
 */
export const MemoryUsageAlertRule: AlertRule = {
  name: 'MEMORY_USAGE_HIGH',
  description: 'Memory usage exceeds threshold',
  defaultLevel: AlertLevel.WARNING,
  defaultEnabled: true,
};

/**
 * Send memory usage alert
 */
export async function sendMemoryUsageAlert(
  usedMemoryMb: number,
  totalMemoryMb: number,
  percentageUsed: number
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(
    MemoryUsageAlertRule.defaultLevel,
    'High Memory Usage',
    `System memory usage is at ${percentageUsed}% (${usedMemoryMb}MB/${totalMemoryMb}MB)`,
    {
      usedMemoryMb,
      totalMemoryMb,
      percentageUsed,
      category: 'system',
      ruleId: 'MEMORY_USAGE_HIGH',
    }
  );

  logger.warn('Memory usage alert sent', {
    percentageUsed,
  });
}

/**
 * Cache hit rate degradation alert
 */
export const CacheHitRateDegradationAlertRule: AlertRule = {
  name: 'CACHE_HIT_RATE_LOW',
  description: 'Cache hit rate below threshold',
  defaultLevel: AlertLevel.WARNING,
  defaultEnabled: false,
};

/**
 * Send cache hit rate alert
 */
export async function sendCacheHitRateAlert(
  hitRate: number,
  threshold: number = 70,
  level: AlertLevel = AlertLevel.WARNING
): Promise<void> {
  const alertManager = getAlertManager();
  await alertManager.sendAlert(level, 'Low Cache Hit Rate', `Cache hit rate is ${hitRate}% (threshold: ${threshold}%)`, {
    hitRate,
    threshold,
    category: 'cache',
    ruleId: 'CACHE_HIT_RATE_LOW',
  });

  logger.warn('Cache hit rate alert sent', {
    hitRate,
    threshold,
  });
}

/**
 * All available alert rules
 */
export const ALL_ALERT_RULES: AlertRule[] = [
  LowStockAlertRule,
  FailedSyncAlertRule,
  HighErrorRateAlertRule,
  PaymentFailureAlertRule,
  LateDeliveryAlertRule,
  QueueDepthAlertRule,
  ApiRateLimitAlertRule,
  DatabasePoolAlertRule,
  MemoryUsageAlertRule,
  CacheHitRateDegradationAlertRule,
];

/**
 * Get alert rule by name
 */
export function getAlertRule(ruleName: string): AlertRule | undefined {
  return ALL_ALERT_RULES.find(rule => rule.name === ruleName);
}

export default {
  LowStockAlertRule,
  FailedSyncAlertRule,
  HighErrorRateAlertRule,
  PaymentFailureAlertRule,
  LateDeliveryAlertRule,
  QueueDepthAlertRule,
  ApiRateLimitAlertRule,
  DatabasePoolAlertRule,
  MemoryUsageAlertRule,
  CacheHitRateDegradationAlertRule,
};
