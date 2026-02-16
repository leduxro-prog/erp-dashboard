# Observability API Endpoints Reference

This document describes the API endpoints that should be created to expose the new observability features.

## Feature Flags Management API

### GET /api/feature-flags
Get all feature flags with current state

**Response:**
```json
{
  "flags": [
    {
      "name": "SMARTBILL_SYNC",
      "enabled": true,
      "description": "Enable SmartBill ERP synchronization",
      "percentage": 100,
      "enabledFor": null,
      "createdAt": "2025-02-07T00:00:00Z",
      "updatedAt": "2025-02-07T21:00:00Z"
    }
  ]
}
```

---

### GET /api/feature-flags/:name
Get specific feature flag details

**Parameters:**
- `name` (path): Feature flag name (e.g., SMARTBILL_SYNC)

**Response:**
```json
{
  "flag": {
    "name": "SMARTBILL_SYNC",
    "enabled": true,
    "description": "Enable SmartBill ERP synchronization",
    "percentage": 100,
    "enabledFor": null,
    "createdAt": "2025-02-07T00:00:00Z",
    "updatedAt": "2025-02-07T21:00:00Z"
  }
}
```

---

### POST /api/feature-flags/:name/toggle
Toggle feature flag enabled state

**Parameters:**
- `name` (path): Feature flag name

**Request Body:**
```json
{
  "enabled": false
}
```

**Response:**
```json
{
  "success": true,
  "flag": {
    "name": "SMARTBILL_SYNC",
    "enabled": false,
    "updatedAt": "2025-02-07T21:30:00Z"
  }
}
```

**Authentication:** Required (admin/manager role)

---

### POST /api/feature-flags/:name/percentage
Set percentage-based rollout

**Parameters:**
- `name` (path): Feature flag name

**Request Body:**
```json
{
  "percentage": 50
}
```

**Response:**
```json
{
  "success": true,
  "flag": {
    "name": "NEW_UI",
    "percentage": 50,
    "updatedAt": "2025-02-07T21:30:00Z"
  }
}
```

**Validation:**
- percentage must be 0-100
- Returns 400 if invalid

---

### POST /api/feature-flags/:name/roles
Set role-based access

**Parameters:**
- `name` (path): Feature flag name

**Request Body:**
```json
{
  "roles": ["admin", "manager"]
}
```

**Response:**
```json
{
  "success": true,
  "flag": {
    "name": "ADMIN_FEATURES",
    "enabledFor": ["admin", "manager"],
    "updatedAt": "2025-02-07T21:30:00Z"
  }
}
```

---

### GET /api/feature-flags/:name/history
Get change history for a flag

**Parameters:**
- `name` (path): Feature flag name
- `limit` (query): Max results (default: 50, max: 100)

**Response:**
```json
{
  "flagName": "SMARTBILL_SYNC",
  "changes": [
    {
      "id": "uuid-1",
      "flagName": "SMARTBILL_SYNC",
      "changeType": "enabled",
      "previousState": { "enabled": true },
      "newState": { "enabled": false },
      "changedBy": "user:123",
      "changedAt": "2025-02-07T21:30:00Z"
    },
    {
      "id": "uuid-2",
      "flagName": "SMARTBILL_SYNC",
      "changeType": "percentage",
      "previousState": { "percentage": 100 },
      "newState": { "percentage": 75 },
      "changedBy": "api",
      "changedAt": "2025-02-07T20:00:00Z"
    }
  ]
}
```

---

## Cache Metrics API

### GET /api/metrics/cache/:module
Get cache metrics for specific module

**Parameters:**
- `module` (path): Cache module name (e.g., products, orders)

**Response:**
```json
{
  "module": "products",
  "timestamp": "2025-02-07T21:40:00Z",
  "metrics": {
    "cacheHits": {
      "l1": 1245,
      "l2": 89,
      "l3": 12,
      "total": 1346
    },
    "cacheMisses": {
      "l1": 155,
      "l2": 89,
      "l3": 0,
      "total": 244
    },
    "cacheEvictions": 23,
    "hitRate": {
      "l1": 88.94,
      "l2": 50.0,
      "l3": 100.0,
      "overall": 84.65
    },
    "averageLatency": {
      "l1Ms": 0.45,
      "l2Ms": 3.12,
      "l3Ms": 156.78
    }
  }
}
```

---

### POST /api/metrics/cache/:module/reset
Reset cache statistics

**Parameters:**
- `module` (path): Cache module name

**Response:**
```json
{
  "success": true,
  "module": "products",
  "message": "Cache metrics reset"
}
```

**Authentication:** Required (admin role)

---

### GET /api/metrics/cache/all
Get metrics for all cache modules

**Response:**
```json
{
  "modules": [
    {
      "module": "products",
      "timestamp": "2025-02-07T21:40:00Z",
      "metrics": { ... }
    },
    {
      "module": "orders",
      "timestamp": "2025-02-07T21:40:00Z",
      "metrics": { ... }
    }
  ]
}
```

---

## Health Check API

### GET /health/live
Liveness probe for Kubernetes/orchestration

**Response (200 OK):**
```json
{
  "status": "alive",
  "timestamp": "2025-02-07T21:40:00Z",
  "uptime": 3600
}
```

---

### GET /health/ready
Readiness probe for load balancers

**Response (200 OK if ready, 503 if not):**
```json
{
  "status": "ready",
  "timestamp": "2025-02-07T21:40:00Z",
  "checks": {
    "database": true,
    "redis": true
  }
}
```

---

### GET /health/detailed
Comprehensive health check with all external services

**Response (200 OK if healthy, 200 if degraded, 503 if unhealthy):**
```json
{
  "status": "healthy",
  "timestamp": "2025-02-07T21:40:00Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "up",
      "latency": 2,
      "details": {
        "type": "PostgreSQL",
        "poolSize": 10
      }
    },
    "redis": {
      "status": "up",
      "latency": 1,
      "details": {
        "type": "Redis/ioredis"
      }
    },
    "bullmq": {
      "status": "up",
      "latency": 1,
      "details": {
        "type": "BullMQ Job Queue",
        "status": "Ready"
      }
    },
    "smartbill": {
      "status": "up",
      "latency": 145,
      "details": {
        "type": "SmartBill Integration",
        "httpStatus": 200,
        "endpoint": "https://online.smartbill.ro/api/v1"
      }
    },
    "woocommerce": {
      "status": "up",
      "latency": 320,
      "details": {
        "type": "WooCommerce Sync",
        "httpStatus": 200,
        "endpoint": "https://shop.example.com/wp-json/wc/v3/system_status"
      }
    },
    "system": {
      "status": "up",
      "details": {
        "uptime": 3600,
        "memory": {
          "heapUsedMb": 250,
          "heapLimitMb": 2048
        },
        "cpu": {
          "user": 1000000,
          "system": 500000
        },
        "nodeVersion": "v18.12.0"
      }
    }
  }
}
```

---

## Alerts Management API

### GET /api/alerts
Get recent alerts

**Query Parameters:**
- `limit` (query): Max results (default: 50)
- `level` (query): Filter by level (INFO, WARNING, CRITICAL, EMERGENCY)
- `status` (query): Filter by status (pending, acknowledged)

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid-1",
      "level": "CRITICAL",
      "title": "SmartBill Synchronization Failed",
      "message": "SmartBill sync encountered an error: Connection timeout",
      "metadata": {
        "system": "SmartBill",
        "reason": "Connection timeout",
        "lastSuccessfulSync": "2025-02-07T20:00:00Z"
      },
      "timestamp": "2025-02-07T21:35:00Z",
      "acknowledged": false
    },
    {
      "id": "uuid-2",
      "level": "WARNING",
      "title": "High Cache Eviction Rate",
      "message": "Cache evictions exceeded threshold",
      "metadata": {
        "module": "products",
        "evictionCount": 150,
        "hitRate": 65.5
      },
      "timestamp": "2025-02-07T21:30:00Z",
      "acknowledged": true,
      "acknowledgedAt": "2025-02-07T21:31:00Z",
      "acknowledgedBy": "user:456"
    }
  ],
  "total": 2,
  "pending": 1
}
```

---

### POST /api/alerts/:alertId/acknowledge
Acknowledge an alert

**Parameters:**
- `alertId` (path): Alert UUID

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "uuid-1",
    "acknowledged": true,
    "acknowledgedAt": "2025-02-07T21:40:00Z",
    "acknowledgedBy": "user:123"
  }
}
```

**Authentication:** Required

---

### GET /api/alerts/stats
Get alert statistics

**Response:**
```json
{
  "stats": {
    "total": 15,
    "byLevel": {
      "INFO": 2,
      "WARNING": 8,
      "CRITICAL": 4,
      "EMERGENCY": 1
    },
    "byStatus": {
      "pending": 5,
      "acknowledged": 10
    },
    "avgTimeToAcknowledge": 300,
    "criticalUnacknowledgedCount": 2
  }
}
```

---

## Audit Trail API

### GET /api/audit-log
Query audit trail

**Query Parameters:**
- `entityType` (query): Filter by entity type (Product, Order, User, etc.)
- `entityId` (query): Filter by entity ID
- `userId` (query): Filter by user ID who made change
- `action` (query): Filter by action (CREATE, READ, UPDATE, DELETE)
- `dateFrom` (query): Filter by date range start (ISO 8601)
- `dateTo` (query): Filter by date range end (ISO 8601)
- `limit` (query): Max results (default: 50, max: 500)
- `offset` (query): Pagination offset

**Response:**
```json
{
  "entries": [
    {
      "id": "uuid-1",
      "entityType": "Product",
      "entityId": 123,
      "action": "UPDATE",
      "changes": {
        "name": {
          "oldValue": "Old Name",
          "newValue": "New Name"
        },
        "price": {
          "oldValue": 100,
          "newValue": 120
        }
      },
      "changedBy": 456,
      "changedAt": "2025-02-07T21:35:00Z",
      "metadata": {
        "source": "api",
        "endpoint": "/api/products/123"
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

## Implementation Template

```typescript
// routes/observability.routes.ts
import { Router } from 'express';
import { requireAuth, requireRole } from 'middleware/auth';
import { getAdvancedFeatureFlagService } from 'shared/utils/feature-flags-advanced';
import { getAlertManager } from 'shared/alerting';

const router = Router();

// Feature Flags
router.get('/feature-flags', async (req, res) => {
  const service = getAdvancedFeatureFlagService();
  res.json({ flags: service.getAll() });
});

router.post('/feature-flags/:name/toggle', requireAuth, requireRole('admin'), async (req, res) => {
  const { name } = req.params;
  const { enabled } = req.body;

  const service = getAdvancedFeatureFlagService();
  await service.setFlag(name, enabled, req.user.id);

  res.json({
    success: true,
    flag: service.getFlag(name)
  });
});

// Cache Metrics
router.get('/metrics/cache/:module', async (req, res) => {
  const { module } = req.params;
  // Get cache manager for module and return metrics
  res.json({ metrics: cacheManager.getMetrics() });
});

// Alerts
router.get('/alerts', async (req, res) => {
  const { limit = 50, level, status } = req.query;
  const alertManager = getAlertManager();
  const stats = alertManager.getStats();

  res.json({ alerts: [...], total: stats.pendingAlertsCount });
});

export default router;
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Percentage must be between 0 and 100",
  "code": "INVALID_PERCENTAGE"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Admin role required"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Feature flag 'UNKNOWN_FLAG' not found"
}
```

### 503 Service Unavailable
```json
{
  "error": "Service unavailable",
  "message": "Database connection failed"
}
```

---

## Rate Limiting Recommendations

- Feature Flags API: 100 requests/minute per user
- Metrics API: 200 requests/minute per user
- Alerts API: 150 requests/minute per user
- Health Checks: 1000 requests/minute (no auth required)

---

## Monitoring Integration

### Prometheus Metrics to Expose
```
# HELP cache_hits_total Total cache hits
cache_hits_total{module="products",layer="l1"} 1245

# HELP cache_misses_total Total cache misses
cache_misses_total{module="products",layer="l1"} 155

# HELP cache_hit_rate Cache hit rate percentage
cache_hit_rate{module="products"} 88.94

# HELP alerts_total Total alerts
alerts_total{level="critical",status="pending"} 2

# HELP feature_flag_enabled Feature flag enabled status
feature_flag_enabled{name="SMARTBILL_SYNC"} 1

# HELP feature_flag_percentage Feature flag percentage rollout
feature_flag_percentage{name="NEW_UI"} 50
```

---

## Related Documentation
- See `OBSERVABILITY_IMPLEMENTATION.md` for implementation details
- See `shared/alerting/index.ts` for alert API
- See `shared/cache/cache-manager.ts` for metrics methods
