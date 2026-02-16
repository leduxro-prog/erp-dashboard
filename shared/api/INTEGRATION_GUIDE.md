# API Adapter Integration Guide

Quick reference for integrating the multi-API adapter system into CYPHER ERP.

## 1. Server Initialization

Add to `src/server.ts` or `src/main.ts`:

```typescript
import { ApiClientFactory } from '@shared/api';

// Initialize after dotenv and before route setup
ApiClientFactory.initialize();
logger.info('API Client Factory initialized');
```

## 2. Health Check Endpoint

Add to your Express app:

```typescript
import { ApiClientFactory } from '@shared/api';

// Health check for all APIs
app.get('/health/apis', (req, res) => {
  const health = ApiClientFactory.getHealth();
  const statusCode = health.healthy ? 200 : 503;
  res.status(statusCode).json(health);
});

// Get metrics for monitoring
app.get('/metrics/apis', (req, res) => {
  const metrics = ApiClientFactory.getAggregateMetrics();
  res.json(metrics);
});
```

## 3. Webhook Endpoint

Setup webhook handling for external API callbacks:

```typescript
import { WebhookManager } from '@shared/api';

const webhookManager = new WebhookManager();

// SmartBill webhooks
webhookManager.registerHandler('smartbill', async (data, source, id) => {
  // Handle SmartBill webhook payload
  const invoice = data as SmartBillInvoice;
  await smartbillService.processWebhook(invoice);
});

webhookManager.registerValidation('smartbill', {
  signatureHeader: 'X-SmartBill-Signature',
  secret: process.env.SMARTBILL_WEBHOOK_SECRET,
  algorithm: 'sha256',
  validateTimestamp: true,
  maxAge: 300, // 5 minutes
});

// WooCommerce webhooks
webhookManager.registerHandler('woocommerce', async (data, source, id) => {
  const event = data as WooCommerceWebhookEvent;
  await woocommerceService.processWebhook(event);
});

webhookManager.registerValidation('woocommerce', {
  signatureHeader: 'X-WC-Webhook-Signature',
  secret: process.env.WOOCOMMERCE_WEBHOOK_SECRET,
});

// Mount webhook handler
app.post('/webhooks/:source', webhookManager.middleware());
```

## 4. Using in Services

### SmartBill Service Example

```typescript
import { ApiClientFactory } from '@shared/api';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('smartbill-service');

export class SmartBillService {
  private client = ApiClientFactory.getClient('smartbill');

  async createInvoice(data: InvoiceData): Promise<Invoice> {
    try {
      const response = await this.client.post<Invoice>('/invoices', {
        companyVatId: data.companyId,
        seriesName: data.seriesName,
        number: data.number,
        issueDate: data.date,
        dueDate: data.dueDate,
        // ... rest of data
      });

      logger.info('Invoice created', {
        id: response.data.id,
        duration: response.duration,
        retries: response.retryCount,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create invoice', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getWarehouses(): Promise<Warehouse[]> {
    const response = await this.client.get<Warehouse[]>('/warehouses');
    return response.data;
  }

  async getInvoiceStatus(invoiceId: string): Promise<InvoiceStatus> {
    const response = await this.client.get<InvoiceStatus>(
      `/invoices/${invoiceId}/payment-status`
    );
    return response.data;
  }
}
```

### WooCommerce Service Example

```typescript
import { ApiClientFactory } from '@shared/api';

export class WooCommerceService {
  private client = ApiClientFactory.getClient('woocommerce');

  async syncProducts(productIds: number[]): Promise<void> {
    // Use batch for multiple product updates
    const requests = productIds.map(id => ({
      method: 'get' as const,
      path: `/products/${id}`,
    }));

    const results = await this.client.batch(requests, 5); // max 5 concurrent

    for (const result of results) {
      if (result.status === 200) {
        await this.procesProduct(result.data as Product);
      }
    }
  }

  async getOrders(
    status: string = 'processing',
    limit: number = 100
  ): Promise<WooCommerceOrder[]> {
    const response = await this.client.get<WooCommerceOrder[]>('/orders', {
      status,
      per_page: limit,
    });
    return response.data;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const response = await this.client.put<Product>(`/products/${id}`, data);
    return response.data;
  }
}
```

### Supplier Scraper Service Example

```typescript
import { ApiClientFactory } from '@shared/api';

export class SupplierService {
  private acaClient = ApiClientFactory.getClient('aca-lighting');
  private masterledClient = ApiClientFactory.getClient('masterled');

  async scrapeAcaLighting(): Promise<Product[]> {
    try {
      // ACA Lighting has 5 req/min rate limit
      const response = await this.acaClient.get<string>('/products');

      // Parse HTML/JSON response
      const products = this.parseProducts(response.data);
      return products;
    } catch (error) {
      const health = this.acaClient.getHealth();
      if (health.circuitState === 'OPEN') {
        logger.warn('ACA Lighting API circuit open, retrying later');
      }
      throw error;
    }
  }

  async scrapeMasterled(): Promise<Product[]> {
    const response = await this.masterledClient.get<string>('/products');
    return this.parseProducts(response.data);
  }

  // Parallel scraping with metrics
  async scrapeAllSuppliers(): Promise<Record<string, Product[]>> {
    const results = await Promise.all([
      this.scrapeAcaLighting(),
      this.scrapeMasterled(),
      // ... other suppliers
    ]);

    const metrics = ApiClientFactory.getAggregateMetrics();
    logger.info('Supplier scraping complete', {
      totalRequests: metrics.totalRequests,
      avgResponseTime: metrics.avgResponseTime,
      circuitOpenCount: metrics.circuitOpenCount,
    });

    return {
      aca: results[0],
      masterled: results[1],
    };
  }
}
```

## 5. Error Handling

Properly handle API errors:

```typescript
import { ApiClientFactory } from '@shared/api';

try {
  const response = await client.get('/invoice/123');
} catch (error) {
  if (error.response?.status === 404) {
    // Not found - handle gracefully
    logger.warn('Invoice not found');
  } else if (error.response?.status === 429) {
    // Rate limited - queue for retry
    logger.warn('Rate limited, queuing retry');
    await retryQueue.add(() => client.get('/invoice/123'));
  } else if (error.response?.status >= 500) {
    // Server error - circuit breaker will protect
    logger.error('API server error');
  } else if (!error.response) {
    // Network error - circuit breaker protecting
    const health = client.getHealth();
    if (health.circuitState === 'OPEN') {
      logger.error('API circuit open, using cached data');
      return getCachedInvoice('123');
    }
  }

  throw error;
}
```

## 6. Environment Configuration

Set these environment variables (with sensible defaults):

```bash
# SmartBill
SMARTBILL_API_URL=https://api.smartbill.ro
SMARTBILL_USERNAME=user@company.com
SMARTBILL_PASSWORD=your-password
SMARTBILL_ENABLED=true
SMARTBILL_WEBHOOK_SECRET=webhook-secret

# WooCommerce
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_KEY=ck_live_xxxxx
WOOCOMMERCE_SECRET=cs_live_xxxxx
WOOCOMMERCE_ENABLED=true
WOOCOMMERCE_WEBHOOK_SECRET=webhook-secret

# Supplier APIs
ACA_LIGHTING_ENABLED=true
MASTERLED_ENABLED=true
ARELUX_ENABLED=false
BRAYTON_ENABLED=false
FSL_ENABLED=false

# Optional: Payment APIs
STRIPE_ENABLED=false
STRIPE_SECRET_KEY=sk_live_xxxxx

NETOPIA_ENABLED=false
NETOPIA_API_KEY=xxx

# Optional: Shipping APIs
FANCOURIER_ENABLED=false
FANCOURIER_API_KEY=xxx

SAMEDAY_ENABLED=false
SAMEDAY_API_KEY=xxx

DPD_ENABLED=false
DPD_API_KEY=xxx

# Optional: Email APIs
MAILGUN_ENABLED=false
MAILGUN_API_KEY=xxx

SENDGRID_ENABLED=false
SENDGRID_API_KEY=xxx

# API Timeouts (optional, defaults provided)
# DEFAULT_API_TIMEOUT=30000
# SCRAPER_API_TIMEOUT=60000
```

## 7. Monitoring & Observability

Add monitoring endpoints:

```typescript
// Detailed metrics for specific API
app.get('/api/:apiName/metrics', (req, res) => {
  try {
    const client = ApiClientFactory.getClient(req.params.apiName);
    const metrics = client.getMetrics();
    const health = client.getHealth();

    res.json({
      name: req.params.apiName,
      health,
      metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(404).json({ error: 'API not found' });
  }
});

// Health endpoint for load balancers
app.get('/health', (req, res) => {
  const apiHealth = ApiClientFactory.getHealth();
  const isHealthy = apiHealth.healthy;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    apis: apiHealth.apis,
    timestamp: apiHealth.timestamp,
  });
});
```

## 8. Testing

Example tests:

```typescript
import { ApiClient } from '@shared/api';
import axios from 'axios';

jest.mock('axios');

describe('API Adapter Integration', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('test-api', {
      baseURL: 'https://api.test.com',
      auth: { type: 'bearer', token: 'test-token' },
      timeout: 5000,
    });

    // Mock axios
    (axios.create as jest.Mock).mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    });
  });

  afterEach(() => {
    client.destroy();
  });

  it('should make GET requests', async () => {
    // Mock the response
    const mockResponse = {
      data: { id: 1, name: 'Test' },
      status: 200,
      headers: { 'content-type': 'application/json' },
    };

    // Test
    const response = await client.get('/test');
    expect(response.status).toBe(200);
    expect(response.data).toEqual(mockResponse.data);
  });

  it('should handle rate limiting', async () => {
    const health = client.getHealth();
    expect(health.rateLimitMetrics).toBeDefined();
    expect(health.rateLimitMetrics.currentTokens).toBeGreaterThan(0);
  });

  it('should cache GET responses', async () => {
    const response1 = await client.get('/test');
    const response2 = await client.get('/test');

    expect(response2.fromCache).toBe(true);
  });
});
```

## 9. Troubleshooting

### Circuit Breaker Opens
```typescript
const health = client.getHealth();
if (health.circuitState === 'OPEN') {
  // Wait for reset timeout or manually reset if you know it's fixed
  client.reset();
}
```

### Rate Limiting Delays
```typescript
const metrics = client.getMetrics();
if (metrics.rateLimitRemaining < 5) {
  logger.warn('Low rate limit tokens, queuing requests');
}
```

### High Response Times
```typescript
const metrics = client.getMetrics();
console.log(`P95 response time: ${metrics.p95ResponseTime}ms`);
// If high, check API server load or network connectivity
```

## 10. Migration Path

### From Custom Clients
If you have custom API clients:

1. **Extract config** from your client into ApiRegistry
2. **Register in ApiRegistry** or use factory registration
3. **Replace** client usage:
   ```typescript
   // Before
   const client = new CustomApiClient(config);

   // After
   const client = ApiClientFactory.getClient('api-name');
   ```

### From Axios Direct
If using axios directly:

1. **Create client** from factory
2. **Use type-safe methods** (get, post, etc.)
3. **Benefits**: circuit breaker, rate limiting, caching, metrics, health monitoring

## Summary

The multi-API adapter provides:
- ✅ Unified interface for all APIs
- ✅ Built-in resilience (circuit breaker, rate limiting, retry)
- ✅ Health monitoring and metrics
- ✅ Webhook handling with validation
- ✅ Type-safe requests and responses
- ✅ Backward compatibility with existing code
- ✅ Easy extension for new APIs

Start using it by initializing the factory and getting clients for your services!
