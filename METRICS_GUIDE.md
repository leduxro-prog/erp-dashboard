# Metrics & Monitoring Guide - CYPHER ERP

## Overview

CYPHER ERP includes a comprehensive metrics collection and monitoring system that tracks system performance, module health, and operational metrics. Metrics are exported in multiple formats:

- **Prometheus Text Format** - `/metrics` endpoint for scraping by Prometheus
- **JSON Format** - REST API for programmatic access
- **Grafana Dashboard** - Pre-configured visualizations of all key metrics

## Architecture

### Components

1. **Metrics Middleware** (`shared/metrics/metrics-middleware.ts`)
   - Collects HTTP request metrics per route
   - Tracks request count, duration, status codes
   - Calculates percentiles (p50, p90, p95, p99)
   - In-memory collector with no external dependencies

2. **Prometheus Exporter** (`shared/metrics/prometheus-exporter.ts`)
   - Formats metrics in Prometheus text format
   - Collects metrics from all modules
   - Aggregates system-level metrics
   - No external prom-client dependency

3. **Module Registry Integration** (`shared/module-system/module-registry.ts`)
   - Aggregates metrics from all modules via `getMetrics()`
   - Provides system-wide health and metrics views
   - Integrates with module lifecycle

4. **Grafana Dashboard** (`monitoring/grafana-dashboard.json`)
   - Pre-configured dashboard with 8 key panels
   - Real-time metrics visualization
   - Historical data trending

## Metrics Collected

### Per-Module Metrics (from IModuleMetrics)

Each module reports:
- `requestCount: number` - Total requests handled
- `errorCount: number` - Total errors encountered
- `avgResponseTime: number` - Average response time (ms)
- `activeWorkers: number` - Current active background workers
- `cacheHitRate: number` - Cache hit rate percentage (0-100)
- `eventCount.published: number` - Events published by module
- `eventCount.received: number` - Events received by module

### Prometheus Metrics Exported

#### Counters
- `cypher_http_requests_total{module, method, status, path}` - Total HTTP requests
- `cypher_errors_total{module, type}` - Total errors per module
- `cypher_events_published_total{module}` - Events published
- `cypher_events_received_total{module}` - Events received

#### Gauges
- `cypher_active_workers{module}` - Current active workers
- `cypher_db_pool_active` - Active database connections
- `cypher_db_pool_idle` - Idle database connections
- `cypher_redis_connected` - Redis connection status (0=down, 1=up)
- `cypher_cache_hits_total{layer}` - Cache hit count
- `cypher_cache_misses_total{layer}` - Cache miss count

#### Histograms
- `cypher_http_request_duration_seconds{module, method, path}` - Request duration with percentiles

#### Route-Level Metrics (JSON endpoint only)
Per route (normalized):
- `requestCount` - Requests for this route
- `errorCount` - Errors for this route
- `errorRate` - Error rate percentage
- `statusCodes` - Distribution of status codes
- `responseTime.avg` - Average response time
- `responseTime.p50`, `p90`, `p95`, `p99` - Percentiles

## Endpoints

### 1. Prometheus Metrics Endpoint

**URL:** `GET /metrics`
**Format:** Prometheus text format (text/plain)
**Frequency:** Real-time (generated on request)
**Authentication:** None (recommend restricting via reverse proxy)

```bash
curl http://localhost:3001/metrics

# Output sample:
# HELP cypher_http_requests_total Total HTTP requests
# TYPE cypher_http_requests_total counter
cypher_http_requests_total{module="orders",method="GET",status="200",path="/"} 1543
cypher_http_requests_total{module="pricing",method="POST",status="201",path="/"} 891
...
```

### 2. System Metrics (JSON)

**URL:** `GET /api/v1/system/metrics`
**Format:** JSON
**Returns:** Aggregated system metrics with per-module breakdown

```json
{
  "totalRequests": 10234,
  "totalErrors": 23,
  "avgResponseTime": 45.2,
  "modules": {
    "orders": {
      "requestCount": 5000,
      "errorCount": 10,
      "avgResponseTime": 42,
      "activeWorkers": 2,
      "cacheHitRate": 85.5,
      "eventCount": {
        "published": 120,
        "received": 340
      }
    },
    "pricing": {
      "requestCount": 3200,
      "errorCount": 5,
      "avgResponseTime": 28,
      "activeWorkers": 1,
      "cacheHitRate": 92.3,
      "eventCount": {
        "published": 80,
        "received": 200
      }
    }
  },
  "collectedAt": "2024-02-07T10:30:00Z"
}
```

### 3. Detailed Route Metrics (JSON)

**URL:** `GET /api/v1/system/metrics/detailed`
**Format:** JSON
**Returns:** Route-level metrics with percentiles

```json
{
  "timestamp": "2024-02-07T10:30:00Z",
  "summary": {
    "totalRequests": 10234,
    "totalErrors": 23,
    "errorRate": 0.22,
    "averageResponseTime": 45.2
  },
  "routes": {
    "GET:/:id": {
      "method": "GET",
      "path": "/:id",
      "requestCount": 5000,
      "errorCount": 2,
      "errorRate": 0.04,
      "statusCodes": {
        "200": 4980,
        "304": 15,
        "404": 5
      },
      "responseTime": {
        "avg": 35.2,
        "p50": 28,
        "p90": 52,
        "p95": 68,
        "p99": 125
      }
    },
    "POST:/": {
      "method": "POST",
      "path": "/",
      "requestCount": 891,
      "errorCount": 3,
      "errorRate": 0.33,
      "statusCodes": {
        "201": 880,
        "400": 8,
        "500": 3
      },
      "responseTime": {
        "avg": 89.5,
        "p50": 75,
        "p90": 145,
        "p95": 185,
        "p99": 320
      }
    }
  },
  "slowestRoutes": [
    { "route": "POST:/items/:id/process", "p99": 2500, "requestCount": 42 },
    { "route": "PUT:/items/:id", "p99": 1850, "requestCount": 156 }
  ]
}
```

### 4. Module Health

**URL:** `GET /api/v1/system/modules`
**Format:** JSON
**Returns:** Module status and health information

```json
{
  "status": "healthy",
  "modules": [
    {
      "name": "orders",
      "version": "1.0.0",
      "description": "Order management module",
      "dependencies": ["pricing", "inventory"],
      "publishedEvents": ["order.created", "order.updated"],
      "subscribedEvents": ["inventory.updated"],
      "featureFlag": null,
      "health": {
        "status": "healthy",
        "lastChecked": "2024-02-07T10:29:50Z"
      }
    }
  ],
  "checkedAt": "2024-02-07T10:30:00Z"
}
```

## Integration with Prometheus & Grafana

### Setup Prometheus

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cypher-erp'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scheme: 'http'
    scrape_interval: 30s
```

### Import Grafana Dashboard

1. Open Grafana UI
2. Go to Dashboards → Import
3. Upload `monitoring/grafana-dashboard.json`
4. Select Prometheus as data source
5. Save dashboard

The dashboard includes 8 panels:
1. **Request Rate** - Requests per second by module
2. **Error Rate** - Errors per second by module
3. **Response Time** - Request latency trends
4. **Redis Status** - Redis connection health
5. **Cache Hit Rate** - Cache performance percentage
6. **Active Workers** - Background worker count by module
7. **DB Connection Pool** - Active vs idle connections
8. **Event Throughput** - Events published/received per second

## Using Metrics in Code

### Get Metrics Programmatically

```typescript
import { ModuleRegistry } from '../shared/module-system';

const registry = ModuleRegistry.getInstance();

// Get system metrics
const metrics = registry.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Total errors: ${metrics.totalErrors}`);

// Get per-module metrics
const orderMetrics = metrics.modules['orders'];
if (orderMetrics) {
  console.log(`Orders avg response time: ${orderMetrics.avgResponseTime}ms`);
  console.log(`Orders error count: ${orderMetrics.errorCount}`);
}
```

### Access Metrics in Module

Each module can access its own metrics via the registry:

```typescript
// In a module method
const registry = ModuleRegistry.getInstance();
const systemMetrics = registry.getMetrics();

// This module's metrics
const thisModuleMetrics = systemMetrics.modules[this.name];
console.log(`Module health - requests: ${thisModuleMetrics.requestCount}`);
```

### Collect Custom Metrics

For custom metrics beyond the standard ones, modules should:

1. Track in their own data structures
2. Return via `getMetrics()` implementation
3. Export in the Prometheus exporter if needed

Example:
```typescript
async getMetrics(): Promise<IModuleMetrics> {
  return {
    requestCount: this.metricsCollector.requestCount,
    errorCount: this.metricsCollector.errorCount,
    avgResponseTime: this.metricsCollector.avgResponseTime,
    activeWorkers: this.backgroundWorker?.activeCount || 0,
    cacheHitRate: this.cacheStats.hitRate,
    eventCount: {
      published: this.metricsCollector.publishedEvents,
      received: this.metricsCollector.receivedEvents,
    },
  };
}
```

## Monitoring & Alerting Strategy

### Key Metrics to Monitor

1. **Error Rate** - Alert if > 1% of requests fail
2. **Response Time (p99)** - Alert if p99 > 500ms
3. **Active Workers** - Alert if growing unbounded (memory leak)
4. **DB Pool Exhaustion** - Alert if active connections near max
5. **Redis Disconnection** - Alert immediately on disconnect
6. **Cache Hit Rate** - Alert if < 70% (indicates cache issues)

### Prometheus Alert Rules Example

```yaml
groups:
  - name: cypher_erp
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          (sum(rate(cypher_errors_total[5m])) / sum(rate(cypher_http_requests_total[5m])))
          > 0.01
        for: 5m
        annotations:
          summary: "Error rate > 1%"

      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.99, cypher_http_request_duration_seconds) > 0.5
        for: 5m
        annotations:
          summary: "p99 response time > 500ms"

      - alert: RedisDisconnected
        expr: cypher_redis_connected == 0
        for: 1m
        annotations:
          summary: "Redis connection lost"

      - alert: DBPoolExhausted
        expr: |
          (cypher_db_pool_active / (cypher_db_pool_active + cypher_db_pool_idle)) > 0.9
        for: 5m
        annotations:
          summary: "Database connection pool > 90% utilized"
```

## Performance Considerations

### Metrics Overhead

- **Middleware**: ~1-2ms per request (negligible)
- **Memory**: ~1MB per 1000 unique routes with full history
- **Prometheus Export**: ~5-10ms to generate response
- **No external dependencies** for core metrics collection

### Memory Management

The metrics collector automatically manages memory:
- Keeps only last 1000 duration samples per route
- Histograms limited to 10000 samples
- Hourly reset of hourly metrics
- Old samples automatically discarded (FIFO)

### High-Traffic Optimization

For high-traffic deployments:

1. **Increase sampling interval in Prometheus**
   ```yaml
   scrape_interval: 60s  # From default 15s
   ```

2. **Aggregate metrics in a time-series DB**
   - Use Prometheus remote storage
   - Implement retention policies

3. **Disable detailed route metrics if not needed**
   - Comment out `createMetricsMiddleware()` in server.ts
   - Keep Prometheus exporter for module-level metrics

## Troubleshooting

### Prometheus Can't Scrape Metrics

1. Verify endpoint is accessible:
   ```bash
   curl http://localhost:3001/metrics
   ```

2. Check server logs for errors

3. Verify CORS allows Prometheus host if cross-origin

### Metrics Not Appearing in Grafana

1. Verify Prometheus scrape target is "UP":
   - Go to Prometheus UI → Targets
   - Check last scrape time and error messages

2. Verify dashboard datasource points to correct Prometheus instance

3. Check metric names in dashboard match what's exported

### High Memory Usage

1. Check if metrics are being reset regularly
   - Metrics reset hourly automatically
   - Manual reset via `resetMetrics()` if needed

2. Reduce sampling history:
   - Edit `maxSamplesPerRoute` in metrics-middleware.ts
   - Reduce from 1000 to 500 or 100

3. Disable route-level metrics:
   - Remove `createMetricsMiddleware()` from server.ts
   - Keep module-level metrics only

### Missing Module Metrics

1. Verify module implements `getMetrics()` method

2. Check that module is in 'started' state:
   ```typescript
   const registry = ModuleRegistry.getInstance();
   const health = await registry.getHealth();
   ```

3. Ensure module exports metrics via registry:
   ```typescript
   // In module getMetrics()
   return {
     requestCount: this.tracker.requests,
     errorCount: this.tracker.errors,
     // ... all fields
   };
   ```

## Best Practices

### 1. Track Meaningful Metrics

Focus on metrics that drive business decisions:
- Request rate trends
- Error rates by type
- Performance percentiles (p99, not just average)
- Resource utilization

### 2. Set Reasonable Retention

Prometheus retention in prometheus.yml:
```yaml
global:
  scrape_interval: 30s
  retention:
    time: 15d  # Keep 15 days of metrics
    size: 10gb # Max 10GB storage
```

### 3. Dashboard Organization

Group panels by concern:
- Performance (request rate, response time, errors)
- Resources (DB pool, workers, cache)
- Health (module status, connectivity)

### 4. Alert Thresholds

Base thresholds on SLOs:
```
- Error rate: < 0.1% (99.9% uptime)
- Response time p99: < 200ms
- Cache hit rate: > 80%
- Availability: > 99.5%
```

### 5. Monitoring as Code

Maintain Prometheus config and alerts in version control:
```
/monitoring/
├── prometheus.yml
├── alert-rules.yml
├── grafana-dashboard.json
└── README.md
```

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [CYPHER ERP Module System](/shared/module-system/README.md)
- [Metrics Middleware Source](/shared/metrics/metrics-middleware.ts)
- [Prometheus Exporter Source](/shared/metrics/prometheus-exporter.ts)
