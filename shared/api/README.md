# Multi-API Adapter System

Enterprise-grade generic API adapter system supporting 10+ external API integrations with built-in resilience patterns, rate limiting, circuit breaker protection, and health monitoring.

## Overview

The multi-API adapter provides a unified, type-safe interface for managing all external API integrations in the CYPHER ERP system:

- **SmartBill**: ERP invoicing and warehouse management
- **WooCommerce**: E-commerce platform integration
- **Supplier APIs**: Aca Lighting, Masterled, Arelux, Brayton, FSL (web scraping)
- **Shipping APIs**: FanCourier, SameDay, DPD (placeholder)
- **Payment APIs**: Stripe, Netopia (placeholder)
- **Email APIs**: Mailgun, SendGrid (placeholder)

## Architecture

### Core Components

1. **ApiClient** - Generic HTTP client with resilience patterns
2. **ApiClientFactory** - Factory pattern for centralized client management
3. **ApiRegistry** - Configuration registry for all APIs
4. **TokenBucketRateLimiter** - Rate limiting for API compliance
5. **WebhookManager** - Incoming webhook handler with validation

### Resilience Patterns

Each API client includes:

- **Circuit Breaker**: Prevents cascade failures when services are down
- **Rate Limiting**: Token bucket algorithm for API compliance
- **Retry Logic**: Configurable exponential backoff
- **Caching**: Configurable response cache with TTL
- **Request Deduplication**: Same GET requests within 100ms return cached promise
- **Health Monitoring**: Real-time circuit state and metrics
- **Structured Logging**: All operations logged with context

## Quick Start

### 1. Initialize the Factory

```typescript
import { ApiClientFactory } from '@shared/api';

// Initialize at application startup
ApiClientFactory.initialize();
```

### 2. Get a Client

```typescript
// Get pre-configured client for SmartBill
const smartbillClient = ApiClientFactory.getClient('smartbill');

// Make a request
const response = await smartbillClient.get<Invoice>('/invoices/123');
console.log(response.data);
```

### 3. Use Different HTTP Methods

```typescript
// GET
const invoices = await client.get<Invoice[]>('/invoices');

// POST
const newInvoice = await client.post<Invoice>('/invoices', {
  // invoice data
});

// PUT
const updated = await client.put<Invoice>('/invoices/123', {
  // updated data
});

// PATCH
const patched = await client.patch<Invoice>('/invoices/123', {
  // partial update
});

// DELETE
await client.delete<void>('/invoices/123');
```

### 4. Batch Operations

```typescript
const requests = [
  { method: 'get' as const, path: '/products/1' },
  { method: 'get' as const, path: '/products/2' },
  { method: 'get' as const, path: '/products/3' },
];

const results = await client.batch(requests, 2); // max 2 concurrent
```

### 5. Stream Large Responses

```typescript
// Download large file
const fs = require('fs');
const stream = fs.createWriteStream('large-file.zip');

for await (const chunk of client.stream('/large-export')) {
  stream.write(chunk);
}
```

### 6. Check Health Status

```typescript
const health = ApiClientFactory.getHealth();

if (!health.healthy) {
  console.log('Some APIs are down:', health.apis);
}

// Get metrics for specific API
const smartbill = ApiClientFactory.getClient('smartbill');
const metrics = smartbill.getMetrics();
console.log(`Avg response time: ${metrics.avgResponseTime}ms`);
console.log(`Cache hit rate: ${metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)}`);
```

## API Configuration

### Pre-configured APIs

All known APIs are pre-registered with sensible defaults loaded from environment variables:

```typescript
// SmartBill
SMARTBILL_API_URL=https://api.smartbill.ro
SMARTBILL_USERNAME=user@example.com
SMARTBILL_PASSWORD=api-key
SMARTBILL_ENABLED=true

// WooCommerce
WOOCOMMERCE_URL=https://mystore.com
WOOCOMMERCE_KEY=ck_...
WOOCOMMERCE_SECRET=cs_...
WOOCOMMERCE_ENABLED=true

// Supplier APIs (web scraping)
ACA_LIGHTING_URL=https://www.acalighting.com
ACA_LIGHTING_ENABLED=true
MASTERLED_ENABLED=true
ARELUX_ENABLED=true
BRAYTON_ENABLED=true
FSL_ENABLED=true

// Optional APIs (disabled by default)
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_...

FANCOURIER_ENABLED=true
FANCOURIER_API_KEY=...

MAILGUN_ENABLED=true
MAILGUN_API_KEY=...
```

### Register Custom API

```typescript
import { ApiRegistry, ApiClientFactory } from '@shared/api';

// Register custom API at startup
ApiClientFactory.registerApi({
  name: 'custom-api',
  displayName: 'Custom API',
  baseUrl: 'https://api.custom.com',
  auth: {
    type: 'bearer',
    token: process.env.CUSTOM_API_TOKEN,
  },
  rateLimit: {
    maxTokens: 50,
    refillRate: 0.833, // 50 per minute
    refillIntervalMs: 1000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000,
  },
  retry: {
    attempts: 3,
    backoff: 'exponential',
    baseDelay: 1000,
  },
  timeout: 20000,
  enabled: true,
  category: 'other',
});

// Now use it
const customClient = ApiClientFactory.getClient('custom-api');
```

## Response Handling

### ApiResponse Structure

```typescript
interface ApiResponse<T> {
  data: T;              // Response payload
  status: number;       // HTTP status code
  headers: Record<string, string>;
  duration: number;     // Request duration in ms
  retryCount: number;   // Retries needed
  fromCache: boolean;   // From cache?
}

// Usage
const response = await client.get<User>('/users/123');
console.log(response.status);    // 200
console.log(response.duration);  // 45 (ms)
console.log(response.fromCache); // false
```

## Error Handling

The generic client provides standardized error handling:

```typescript
import { ApiClient } from '@shared/api';

try {
  const response = await client.get('/invoices/999');
} catch (error) {
  // Handle network errors
  if (error.message.includes('Network')) {
    console.log('Network issue');
  }

  // Handle rate limiting
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    console.log(`Rate limited, retry after ${retryAfter}s`);
  }

  // Handle service errors
  if (error.response?.status >= 500) {
    console.log('Service error');
  }

  // Handle client errors
  if (error.response?.status >= 400 && error.response?.status < 500) {
    console.log('Client error:', error.response.data);
  }
}
```

## Webhook Handling

Handle incoming webhooks from external APIs:

```typescript
import { WebhookManager } from '@shared/api';
import { Request, Response } from 'express';

const webhookManager = new WebhookManager();

// Register handler for SmartBill webhooks
webhookManager.registerHandler('smartbill', async (data, source, id) => {
  const invoice = data as SmartBillInvoice;
  // Process invoice
  await saveInvoice(invoice);
});

// Register validation
webhookManager.registerValidation('smartbill', {
  signatureHeader: 'X-SmartBill-Signature',
  secret: process.env.SMARTBILL_WEBHOOK_SECRET,
  algorithm: 'sha256',
  validateTimestamp: true,
  maxAge: 300, // 5 minutes
});

// Use as Express middleware
app.post('/webhooks/:source', webhookManager.middleware());

// Or handle manually
app.post('/webhooks/:source', async (req: Request, res: Response) => {
  const result = await webhookManager.handleWebhook(req);
  res.status(result.statusCode).json({ success: result.success });
});
```

## Rate Limiting

The token bucket rate limiter controls API request rates:

```typescript
import { TokenBucketRateLimiter } from '@shared/api';

const limiter = new TokenBucketRateLimiter({
  maxTokens: 10,           // Burst capacity
  refillRate: 0.167,       // 0.167 tokens/sec = 10/minute
  refillIntervalMs: 1000,  // Refill every second
  name: 'smartbill-limiter',
});

// Blocking: waits for tokens
await limiter.acquire();
await makeApiCall();

// Non-blocking: check immediately
if (limiter.tryAcquire()) {
  await makeApiCall();
} else {
  console.log('Rate limited');
}

// Get metrics
const metrics = limiter.getMetrics();
console.log(`Queue depth: ${metrics.queueDepth}`);
console.log(`Effective rate: ${metrics.effectiveRatePerSecond} req/sec`);
```

## Circuit Breaker Protection

The circuit breaker protects against cascade failures:

```typescript
const health = client.getHealth();

if (health.circuitState === 'OPEN') {
  console.log('API is down, using fallback data');
  // Use cached or stale data
}

if (health.circuitState === 'HALF_OPEN') {
  console.log('API is recovering, testing with single request');
}

if (health.circuitState === 'CLOSED') {
  console.log('API is healthy, normal operation');
}
```

## Metrics and Monitoring

```typescript
// Get individual client metrics
const metrics = client.getMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  successCount: metrics.successCount,
  errorCount: metrics.errorCount,
  avgResponseTime: metrics.avgResponseTime,
  p95ResponseTime: metrics.p95ResponseTime,
  circuitBreakerState: metrics.circuitBreakerState,
  rateLimitRemaining: metrics.rateLimitRemaining,
  cacheHits: metrics.cacheHits,
  cacheMisses: metrics.cacheMisses,
});

// Get aggregated metrics from all APIs
const aggregated = ApiClientFactory.getAggregateMetrics();
console.log({
  totalRequests: aggregated.totalRequests,
  avgResponseTime: aggregated.avgResponseTime,
  circuitOpenCount: aggregated.circuitOpenCount,
});

// Get health report
const report = ApiClientFactory.getHealth();
console.log(report);
```

## Refactoring Legacy Clients

The existing SmartBill and WooCommerce clients now use the factory internally:

```typescript
// Old way (still works, but wraps factory)
const legacyClient = new SmartBillApiClient(config);
const invoice = await legacyClient.createInvoice(data);

// New way (recommended)
const newClient = ApiClientFactory.getClient('smartbill');
const response = await newClient.post<Invoice>('/invoices', data);
```

## Advanced Usage

### Caching

GET responses are automatically cached with 60-second default TTL:

```typescript
// First call: fetches from API
const response1 = await client.get('/products/1');

// Second call within 60s: returns cached data
const response2 = await client.get('/products/1');
console.log(response2.fromCache); // true

// Clear cache when needed
client.clearCache();
```

### Request Deduplication

Identical GET requests within 100ms share the same promise:

```typescript
// These two requests will share the same HTTP call
const promise1 = client.get('/products');
const promise2 = client.get('/products');

const [result1, result2] = await Promise.all([promise1, promise2]);
// Only 1 HTTP request was made
```

### Custom Authentication

```typescript
ApiClientFactory.registerApi({
  name: 'oauth-api',
  displayName: 'OAuth API',
  baseUrl: 'https://api.oauth.com',
  auth: {
    type: 'oauth2',
    token: process.env.OAUTH_TOKEN,
    refreshStrategy: 'auto',
  },
  // ... rest of config
});
```

## Architecture Diagram

```
Application Layer
    │
    ├─ SmartBill Module
    │   └─ SmartBillApiClient (legacy wrapper)
    │       └─ ApiClient (smartbill)
    │
    ├─ WooCommerce Module
    │   └─ WooCommerceApiClient (legacy wrapper)
    │       └─ ApiClient (woocommerce)
    │
    └─ Other Modules
        └─ ApiClientFactory
            ├─ ApiClient (per API)
            │   ├─ CircuitBreaker
            │   ├─ TokenBucketRateLimiter
            │   ├─ AxiosInstance
            │   └─ Cache
            │
            ├─ ApiRegistry
            │   └─ API Configurations
            │
            └─ WebhookManager
                ├─ Signature Validation
                ├─ Deduplication
                └─ Dead Letter Queue
```

## Testing

```typescript
import { ApiClient } from '@shared/api';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('test-api', {
      baseURL: 'https://api.test.com',
      auth: { type: 'bearer', token: 'test-token' },
      timeout: 5000,
    });
  });

  afterEach(() => {
    client.destroy();
  });

  it('should make GET requests', async () => {
    const response = await client.get('/test');
    expect(response.status).toBe(200);
  });

  it('should cache GET responses', async () => {
    const response1 = await client.get('/test');
    const response2 = await client.get('/test');
    expect(response2.fromCache).toBe(true);
  });

  it('should respect rate limits', async () => {
    const start = Date.now();
    await Promise.all([
      client.get('/test1'),
      client.get('/test2'),
      client.get('/test3'),
    ]);
    const duration = Date.now() - start;
    // Should have waited due to rate limit
    expect(duration).toBeGreaterThan(1000);
  });
});
```

## Troubleshooting

### Circuit Breaker is Open

**Symptom**: Requests fail immediately

**Solution**:
1. Check API status
2. Review logs for underlying errors
3. Fix the root cause
4. Circuit will auto-recover after reset timeout

```typescript
const health = client.getHealth();
if (health.circuitState === 'OPEN') {
  // Circuit breaker opened due to 5+ failures
  // Wait 30 seconds for automatic recovery
  // Or manually reset if you know it's fixed
  client.reset();
}
```

### High Response Times

**Symptom**: Slow API responses

**Check metrics**:
```typescript
const metrics = client.getMetrics();
console.log(`P95: ${metrics.p95ResponseTime}ms`);
console.log(`Avg: ${metrics.avgResponseTime}ms`);
```

**Solutions**:
- Check network connectivity
- Check API server load
- Increase timeout if needed
- Add caching if doing repeated queries

### Rate Limit Exceeded

**Symptom**: Requests get 429 status

**Solution**:
```typescript
const metrics = client.getMetrics();
console.log(`Rate limit tokens: ${metrics.rateLimitRemaining}`);
// Requests will automatically queue and wait
```

## Performance Tuning

### Batch Operations

```typescript
// Instead of sequential requests
for (const id of ids) {
  const response = await client.get(`/items/${id}`);
}

// Use batch with limited concurrency
const requests = ids.map(id => ({
  method: 'get' as const,
  path: `/items/${id}`,
}));
const results = await client.batch(requests, 10); // max 10 concurrent
```

### Caching

```typescript
// Cache configuration is automatic (60s TTL)
// But you can clear if data is stale
client.clearCache();

// Or reset metrics periodically
setInterval(() => {
  const metrics = client.getMetrics();
  if (metrics.errorCount > 10) {
    client.reset();
  }
}, 60000);
```

## File Structure

```
shared/api/
├── api-client.ts           # Core generic API client
├── api-client-factory.ts   # Factory singleton
├── api-registry.ts         # Configuration registry
├── rate-limiter.ts         # Token bucket limiter
├── webhook-manager.ts      # Webhook handler
├── index.ts               # Barrel exports
└── README.md              # This file
```

## Dependencies

- axios ^1.6.5 - HTTP client
- Express 4.x - Webhook middleware
- Node.js 20+ - Runtime

## License

Internal use only - CYPHER ERP System
