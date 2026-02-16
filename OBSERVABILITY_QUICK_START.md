# Observability Quick Start Guide

## Installation & Setup

### 1. Import Alerting System
```typescript
// app.ts or main setup file
import { getAlertManager, AlertLevel, sendAlert } from 'shared/alerting';

// Alerts are initialized with channels based on env vars
// No additional setup needed - just start using

// Send an alert
await sendAlert(AlertLevel.CRITICAL, 'Payment Failed', 'Order #123 payment failed', {
  orderId: 123,
  amount: 100,
  currency: 'RON'
});
```

### 2. Track Data Changes
```typescript
// In your use-cases or service layer
import { getDataChangeTracker } from 'shared/middleware/data-change-tracker';

const tracker = getDataChangeTracker();

// Before update
const oldData = { name: 'Old', price: 100 };
const newData = { name: 'New', price: 120 };

// Track the change
const record = tracker.trackUpdate('Product', productId, oldData, newData, userId);

// Store to audit log
await auditLogRepository.save(record);
```

### 3. Use Advanced Feature Flags
```typescript
// Replace simple flag service with advanced version
import { getAdvancedFeatureFlagService } from 'shared/utils/feature-flags-advanced';

const flags = getAdvancedFeatureFlagService();

// Check if enabled
if (flags.isEnabled('NEW_UI', { userId: user.id, role: user.role })) {
  // Show new UI
}

// Toggle via API endpoint (admin only)
await flags.setFlag('MAINTENANCE_MODE', true, 'admin_user_123');

// Gradual rollout
await flags.setPercentage('EXPERIMENTAL_FEATURE', 25, 'product_team');

// Role-based
await flags.setEnabledForRoles('BETA_FEATURES', ['beta_tester'], 'system');
```

### 4. Check Health Status
```typescript
// Endpoints are automatically available
// GET /health/live
// GET /health/ready
// GET /health/detailed

// Detailed health includes:
// ✓ Database connectivity (SELECT 1)
// ✓ Redis PING
// ✓ BullMQ queue status
// ✓ SmartBill API HEAD request (2s timeout)
// ✓ WooCommerce API system_status (2s timeout)
// ✓ System memory and CPU usage
```

### 5. Monitor Cache Performance
```typescript
import { CacheManager } from 'shared/cache/cache-manager';

const cache = new CacheManager({ moduleName: 'products' });

// After usage, get metrics
const metrics = cache.getMetrics();
console.log(`Hit Rate: ${metrics.hitRate.overall.toFixed(2)}%`);
console.log(`Total Hits: ${metrics.cacheHits.total}`);
console.log(`Evictions: ${metrics.cacheEvictions}`);

// Or get human-readable summary
console.log(cache.getMetricsSummary());

// Export for monitoring
const json = cache.exportMetricsJson();
// Send to Prometheus, Datadog, etc.
```

---

## Configuration

### Environment Variables Required

#### For Alerting
```bash
# Slack/Discord webhook (optional)
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# Email alerts (optional)
ALERT_EMAIL_TO=ops-team@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=notifications@example.com
SMTP_PASSWORD=app-password
SMTP_FROM_ADDRESS=noreply@example.com
SMTP_FROM_NAME="CYPHER ERP Alerts"
SMTP_USE_TLS=true

# PagerDuty (optional)
ALERT_PAGERDUTY_KEY=your-integration-key
```

#### For Health Checks
```bash
# SmartBill (optional, defaults to official API)
SMARTBILL_API_URL=https://online.smartbill.ro/api/v1

# WooCommerce (required for detailed check)
WOOCOMMERCE_API_URL=https://shop.example.com
WOOCOMMERCE_API_KEY=ck_xxxxx
WOOCOMMERCE_API_SECRET=cs_xxxxx
```

---

## Common Use Cases

### Case 1: Low Inventory Alert
```typescript
import { sendLowStockAlert } from 'shared/alerting';

// In inventory service
if (product.quantity < product.lowStockThreshold) {
  await sendLowStockAlert(
    product.id,
    product.name,
    product.quantity,
    product.lowStockThreshold
  );
}
```

### Case 2: Failed Payment Notification
```typescript
import { sendPaymentFailureAlert } from 'shared/alerting';

try {
  await processPayment(order);
} catch (error) {
  await sendPaymentFailureAlert(
    order.id,
    order.totalAmount,
    order.currency,
    error.message,
    'Stripe'
  );
}
```

### Case 3: Audit Critical Changes
```typescript
// In order service
const oldOrder = { status: 'pending', total: 100 };
const newOrder = { status: 'cancelled', total: 100 };

const tracker = getDataChangeTracker();
const changes = tracker.trackUpdate('Order', orderId, oldOrder, newOrder, userId);

// Log to database for compliance
await AuditLog.create({
  entityType: 'Order',
  entityId: orderId,
  action: 'UPDATE',
  changes: changes.changesSummary,
  userId,
  timestamp: new Date()
});
```

### Case 4: Feature Rollout Strategy
```typescript
const flags = getAdvancedFeatureFlagService();

// Monday: Enable for 10% of users
await flags.setPercentage('NEW_CHECKOUT', 10, 'product_manager');

// Wednesday: 50% rollout
await flags.setPercentage('NEW_CHECKOUT', 50, 'product_manager');

// Friday: 100% rollout
await flags.setPercentage('NEW_CHECKOUT', 100, 'product_manager');

// If issues: Quick rollback
await flags.setFlag('NEW_CHECKOUT', false, 'incident_response');
```

### Case 5: Cache Performance Monitoring
```typescript
// In scheduled job (every 5 minutes)
const modules = ['products', 'orders', 'customers'];

for (const module of modules) {
  const cache = getCacheManager(module);
  const metrics = cache.getMetrics();

  if (metrics.hitRate.overall < 70) {
    await sendAlert(
      AlertLevel.WARNING,
      `Low Cache Hit Rate: ${module}`,
      `Cache hit rate is ${metrics.hitRate.overall.toFixed(2)}%`,
      { module, hitRate: metrics.hitRate.overall }
    );
  }

  // Send to monitoring
  await sendMetrics(metrics);
}
```

---

## Testing

### Test Alert Deduplication
```typescript
const mgr = getAlertManager();

// Send same alert twice
await mgr.sendAlert(AlertLevel.WARNING, 'Test', 'Test message');
await mgr.sendAlert(AlertLevel.WARNING, 'Test', 'Test message');
// Second should be deduplicated (same hash)

// Wait 5+ minutes
await sleep(6 * 60 * 1000);

// Now should send again
await mgr.sendAlert(AlertLevel.WARNING, 'Test', 'Test message');
// This should go through
```

### Test Feature Flag Rollout
```typescript
const flags = getAdvancedFeatureFlagService();
await flags.setPercentage('TEST_FLAG', 50, 'test');

// Same user always gets same result
const userId = 123;
const result1 = flags.isEnabled('TEST_FLAG', { userId });
const result2 = flags.isEnabled('TEST_FLAG', { userId });
expect(result1).toBe(result2); // Should match
```

### Test Cache Metrics
```typescript
const cache = new CacheManager({ moduleName: 'test' });

// Simulate usage
await cache.set('key1', { data: 'value' });
await cache.get('key1'); // Hit
await cache.get('key1'); // Hit
await cache.get('key2'); // Miss

const metrics = cache.getMetrics();
expect(metrics.cacheHits.l1).toBe(2);
expect(metrics.cacheMisses.l1).toBe(1);
expect(metrics.hitRate.overall).toBe(66.67);
```

---

## Monitoring & Dashboards

### Prometheus Integration
```typescript
// Expose metrics endpoint
app.get('/metrics/prometheus', (req, res) => {
  const metrics = [];

  // Cache metrics
  for (const [moduleName, cache] of cacheManagers.entries()) {
    const m = cache.getMetrics();
    metrics.push(`cache_hits{module="${moduleName}"} ${m.cacheHits.total}`);
    metrics.push(`cache_misses{module="${moduleName}"} ${m.cacheMisses.total}`);
    metrics.push(`cache_hit_rate{module="${moduleName}"} ${m.hitRate.overall}`);
  }

  // Alert metrics
  const alertMgr = getAlertManager();
  const stats = alertMgr.getStats();
  metrics.push(`alerts_pending ${stats.pendingAlertsCount}`);

  res.type('text/plain');
  res.send(metrics.join('\n'));
});
```

### Dashboard Queries
```
# Top 3 lowest cache hit rates
SELECT module, hitRate FROM cache_metrics ORDER BY hitRate ASC LIMIT 3

# Recent critical alerts
SELECT * FROM alerts WHERE level='CRITICAL' ORDER BY timestamp DESC LIMIT 10

# Feature flag changes this week
SELECT * FROM flag_changes WHERE changedAt > NOW() - INTERVAL 7 DAY

# Health check failures
SELECT * FROM health_checks WHERE status='down' ORDER BY timestamp DESC
```

---

## Troubleshooting

### Alerts Not Sending?
1. Check env vars are set: `ALERT_WEBHOOK_URL`, `ALERT_EMAIL_TO`, etc.
2. Verify webhook URL is correct (Slack/Discord format)
3. Check SMTP credentials if using email
4. Look for error logs in alerting module
5. Try sending via console.log fallback

### Cache Hit Rate Low?
1. Check TTL setting (default: 300s)
2. Monitor cache size vs capacity
3. Check for hot keys being evicted
4. Review invalidation patterns
5. Consider increasing L1 max size

### Health Checks Failing?
1. Verify external service is running
2. Check network connectivity
3. Verify API credentials and URLs
4. Look for timeout errors (2s limit)
5. Check firewall rules for outbound requests

### Feature Flags Not Switching?
1. Verify Redis is running (flags persist there)
2. Check flag name is correct (case-sensitive)
3. Verify user has admin role for API changes
4. Check percentage rollout logic (consistent hashing)
5. Verify role names match exactly

---

## File Locations

| Feature | File | Key Class |
|---------|------|-----------|
| Alerting | `shared/alerting/alert-manager.ts` | `AlertManager` |
| Alert Rules | `shared/alerting/alert-rules.ts` | N/A (functions) |
| Data Tracking | `shared/middleware/data-change-tracker.ts` | `DataChangeTracker` |
| Feature Flags | `shared/utils/feature-flags-advanced.ts` | `AdvancedFeatureFlagService` |
| Health Checks | `shared/middleware/health.middleware.ts` | N/A (functions) |
| Cache Metrics | `shared/cache/cache-manager.ts` | `CacheManager` |

---

## Performance Tips

1. **Alerting**: Set up deduplication cleanup job to run every minute
2. **Data Tracking**: Exclude large fields with `excludeFields` option
3. **Feature Flags**: Redis TTL is 24 hours, refresh on app startup
4. **Health Checks**: 2-second timeout prevents cascading failures
5. **Cache Metrics**: Uses circular buffers (100 samples), low memory overhead

---

## Next Steps

1. ✅ Review `OBSERVABILITY_IMPLEMENTATION.md` for detailed docs
2. ✅ Review `OBSERVABILITY_API_ENDPOINTS.md` for REST API
3. ✅ Set up environment variables
4. ✅ Integrate into existing routes
5. ✅ Configure monitoring dashboard
6. ✅ Test each feature with sample code above
7. ✅ Set up alerting channels (Slack, email, PagerDuty)
8. ✅ Deploy to staging and monitor

---

For detailed documentation, see:
- `OBSERVABILITY_IMPLEMENTATION.md` - Comprehensive guide
- `OBSERVABILITY_API_ENDPOINTS.md` - REST API reference
