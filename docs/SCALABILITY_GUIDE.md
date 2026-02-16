# Scalability Guide

**Version:** 0.1.0
**Target Audience:** System architects, DevOps engineers, development team leads
**Last Updated:** February 2025

## Current System Capacity

### Estimated Throughput (Single Instance)

| Metric | Capacity | Notes |
|--------|----------|-------|
| API Requests/sec | 50-100 RPS | With connection pooling, caching |
| Concurrent Users | 100-200 | Depends on query complexity |
| Products | 10,000-50,000 | With proper indexing |
| Customers | 500-1,000 | Per instance |
| Orders/day | 100-500 | Depends on fulfillment speed |
| Database Size | 10-50 GB | With 2 years history |

### Resource Usage (Single Instance)

```
Node.js Process:
- Memory: 200-400 MB (at rest)
- CPU: 5-20% (normal load)
- Connection Pool: 5-20 PostgreSQL connections

PostgreSQL:
- Memory: 2-4 GB (buffer pool)
- CPU: 10-30% (normal load)
- Connections: 20-50 (app + other clients)

Redis:
- Memory: 100-500 MB (depends on cache TTL)
- CPU: 1-5%
- Keys: 10K-100K
```

---

## Bottleneck Analysis

### Where Performance Breaks First

#### 1. **Database Connections** (Bottleneck at ~80 connections)

**Symptom:** Connection pool exhausted, timeout errors

```
Pool size: 20 max
Per instance: 20 concurrent queries max
N instances: 20 * N total concurrent queries
```

**Solution:**
- ✅ Connection pooling already configured (min: 5, max: 20)
- ✅ Timeout set to 5 seconds
- Add read replicas for SELECT queries
- Implement query result caching (L2 Redis)

#### 2. **Pricing Calculation** (CPU-bound)

**Symptom:** Pricing endpoint slow when calculating for 100+ items

**Root cause:** Complex discount calculations repeated for each item

**Solution:**
```typescript
// ❌ Slow: Recalculates for every request
const finalPrice = calculatePrice(product, quantity, tier);

// ✅ Fast: Cache by (productId, quantity, tier) tuple
const cacheKey = `price:${productId}:${quantity}:${tier}`;
let price = cache.get(cacheKey);
if (!price) {
  price = calculatePrice(product, quantity, tier);
  cache.set(cacheKey, price, 3600);  // 1 hour TTL
}
```

#### 3. **Inventory Stock Checks** (Lock contention)

**Symptom:** Slow during flash sales or bulk orders

**Root cause:** Multiple concurrent reservations trying to update same product stock

**Solution:**
- Pessimistic row-level locking: `SELECT ... FOR UPDATE`
- Sharding by product: Split inventory across partition keys
- Use SKIP LOCKED for high-concurrency scenarios

#### 4. **N+1 Query Problem** (Database round-trips)

**Symptom:** Listing 100 orders takes 101 queries

**Root cause:**
```typescript
// ❌ N+1 Problem
const orders = await orderRepository.find();
for (const order of orders) {
  order.customer = await customerRepository.findOne(order.customerId);  // 1 query per order!
}
```

**Solution:**
```typescript
// ✅ Single query with eager loading
const orders = await orderRepository.find({
  relations: ['customer', 'items', 'items.product']
});

// Verify in TypeORM:
console.log(orders[0].customer.name);  // No extra query
```

#### 5. **Large Result Sets** (Memory & transfer time)

**Symptom:** Listing all 100K products takes 30+ seconds

**Root cause:** Loading all rows into memory

**Solution:**
```typescript
// ❌ Slow: Load all 100K rows
const allProducts = await productRepository.find();

// ✅ Fast: Cursor pagination
const { items, nextCursor } = await getProductsWithCursor({
  limit: 50,
  cursor: currentCursor
});
```

---

## Scaling Strategies

### For 100K+ Products

#### 1. **Cursor-Based Pagination**

```typescript
/**
 * Cursor pagination helper (in shared/utils/pagination.ts)
 */
export async function findWithCursor<T>(
  repository: Repository<T>,
  options: {
    limit: number;
    cursor?: string;  // Base64 encoded {"id": N, "createdAt": "..."}
    orderBy?: string;
  }
): Promise<{ items: T[]; nextCursor: string | null }> {
  const { limit, cursor, orderBy = 'createdAt' } = options;

  let query = repository.createQueryBuilder('entity');

  // Decode cursor if provided
  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    query = query.where(`entity.${orderBy} > :cursorValue`, {
      cursorValue: decoded[orderBy]
    });
  }

  // Fetch limit+1 to detect if there are more results
  const items = await query
    .orderBy(`entity.${orderBy}`, 'ASC')
    .limit(limit + 1)
    .getMany();

  // Determine if there's a next page
  let nextCursor = null;
  if (items.length > limit) {
    const lastItem = items[limit];  // The (limit+1)th item
    nextCursor = Buffer.from(
      JSON.stringify({ id: lastItem.id, [orderBy]: lastItem[orderBy] })
    ).toString('base64');

    // Return only first `limit` items
    items.pop();
  }

  return { items, nextCursor };
}

// Usage:
const { items: orders, nextCursor } = await findWithCursor(orderRepository, {
  limit: 50,
  cursor: req.query.cursor,
  orderBy: 'createdAt'
});
```

#### 2. **Streaming Exports**

```typescript
// For exporting 100K products without loading all into memory
app.get('/api/v1/products/export', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');

  const stream = productRepository
    .createQueryBuilder('product')
    .select(['product.id', 'product.sku', 'product.name', 'product.price'])
    .stream();

  stream.on('data', (product) => {
    res.write(`${product.id},${product.sku},${product.name},${product.price}\n`);
  });

  stream.on('end', () => res.end());
  stream.on('error', (err) => res.status(500).end());
});
```

#### 3. **Batch Processing**

```typescript
// For processing 100K products (e.g., price updates)
async function updateAllProductPrices(newMargin: number) {
  const BATCH_SIZE = 1000;
  let offset = 0;
  let processed = 0;

  while (true) {
    // Fetch batch
    const products = await productRepository
      .find({ skip: offset, take: BATCH_SIZE });

    if (products.length === 0) break;

    // Process batch
    for (const product of products) {
      product.marginPercentage = newMargin;
    }

    // Save batch
    await productRepository.save(products);

    processed += products.length;
    console.log(`Processed ${processed} products...`);

    offset += BATCH_SIZE;
  }

  console.log(`✅ Updated ${processed} products`);
}
```

---

### For 500+ Concurrent Customers

#### 1. **Connection Pooling (Already Configured)**

```typescript
// Current config (src/data-source.ts)
extra: {
  max: 20,                      // Max 20 connections per instance
  min: 5,                       // Min 5 (warm pool)
  idleTimeoutMillis: 30000,     // Recycle after 30s idle
  connectionTimeoutMillis: 5000 // Fail fast
}
```

**For 500+ concurrent customers across 10 instances:**
- Total connections: 20 * 10 = 200 connections
- PostgreSQL max_connections: Set to 300 (200 app + 100 buffer)

#### 2. **Read Replicas**

```typescript
// Configure for read-heavy operations
const readDataSource = new DataSource({
  type: 'postgres',
  host: 'read-replica.db.example.com',  // Read-only replica
  port: 5432,
  username: 'cypher_user',
  password: process.env.DB_PASSWORD,
  database: 'cypher_erp',
  replication: {
    enabled: true,
    mode: 'slave'
  }
});

// Usage:
app.get('/api/v1/orders', async (req, res) => {
  // SELECT queries use read replica
  const orders = await readDataSource.getRepository(OrderEntity).find();
  res.json(orders);
});

app.post('/api/v1/orders', async (req, res) => {
  // INSERT/UPDATE/DELETE use primary
  const order = await AppDataSource.getRepository(OrderEntity).save(newOrder);
  res.json(order);
});
```

#### 3. **Per-Customer Rate Limiting**

```typescript
// Rate limit by customer (not just IP)
const customerRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const customerId = req.user?.customerId;
  if (!customerId) {
    return next();  // Anonymous users use IP-based limit
  }

  const key = `ratelimit:customer:${customerId}`;
  const limit = 100;  // Requests per hour per customer
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, 3600);  // 1 hour TTL
  }

  if (current > limit) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      limit,
      remaining: 0,
      reset: Math.ceil(current / limit) * 3600
    });
  }

  res.setHeader('X-RateLimit-Remaining', limit - current);
  next();
};
```

---

### For 10+ External APIs

#### 1. **Circuit Breakers** (Already Configured)

```typescript
// Location: shared/utils/circuit-breaker.ts
const smartbillBreaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 30000,      // Try recovery after 30s
  monitorInterval: 10000,   // Check health every 10s
  timeout: 10000,           // 10s timeout per request
  volumeThreshold: 10,      // Need 10 requests before evaluating
  errorFilter: (err) => err.code !== 404  // 404s don't count as failures
});

// Usage:
try {
  const invoice = await smartbillBreaker.execute(() =>
    smartbillApi.createInvoice(order)
  );
} catch (err) {
  if (err.message === 'Circuit breaker is OPEN') {
    // SmartBill is down, queue for retry later
    await jobQueue.add('smartbill-retry', { orderId: order.id });
  }
}
```

#### 2. **API Client Retry Logic**

```typescript
// Location: infrastructure/api-clients/SmartBillClient.ts
async function createInvoiceWithRetry(order: Order): Promise<Invoice> {
  const maxRetries = 3;
  const backoffDelays = [1000, 2000, 4000];  // 1s, 2s, 4s

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await smartbillApi.createInvoice(order);
    } catch (err) {
      if (attempt < maxRetries - 1) {
        const delay = backoffDelays[attempt];
        logger.warn(`SmartBill retry ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: err.message,
          orderId: order.id
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}
```

#### 3. **API Rate Limit Handling**

```typescript
// Handle API provider rate limiting
async function callApiWithRateLimitHandling(apiName: string, fn: () => Promise<any>) {
  try {
    return await fn();
  } catch (err) {
    if (err.statusCode === 429) {
      // Rate limited, queue for later
      const retryAfter = err.headers['retry-after'] || 60;
      logger.warn(`${apiName} rate limited, retrying in ${retryAfter}s`);

      await jobQueue.add(`${apiName}-retry`, fn, {
        delay: retryAfter * 1000,
        backoff: { type: 'fixed', delay: 30000 }
      });

      throw new RateLimitError(`${apiName} rate limited`);
    }
    throw err;
  }
}
```

---

### High Write Volume

#### 1. **Write-Behind Cache**

```typescript
// Batch price updates and write to DB periodically
class PriceCache {
  private writeBuffer = new Map<string, Price>();
  private flushInterval = 5000;  // 5 seconds

  async updatePrice(productId: number, newPrice: number) {
    // Write to in-memory cache immediately
    this.writeBuffer.set(`product:${productId}`, {
      productId,
      newPrice,
      timestamp: Date.now()
    });

    // Tell UI it's updated (optimistic update)
    return { success: true };
  }

  private async flushToDB() {
    if (this.writeBuffer.size === 0) return;

    const batch = Array.from(this.writeBuffer.values());
    this.writeBuffer.clear();

    // Batch INSERT/UPDATE
    await db.query(`
      INSERT INTO prices (product_id, price, updated_at) VALUES
      ${batch.map((p, i) => `(${p.productId}, ${p.newPrice}, NOW())`).join(',')}
      ON CONFLICT (product_id) DO UPDATE SET price = EXCLUDED.price
    `);

    logger.info(`Flushed ${batch.length} price updates to DB`);
  }
}

// Start flushing
setInterval(() => priceCache.flushToDB(), 5000);
```

#### 2. **Batch Inserts**

```typescript
// Instead of:
// for (const item of items) await db.insert(item);  // N round-trips

// Do:
async function batchInsert<T>(
  repository: Repository<T>,
  items: T[],
  batchSize: number = 1000
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await repository.insert(batch);
    console.log(`Inserted ${Math.min(i + batchSize, items.length)}/${items.length}`);
  }
}

// Usage:
await batchInsert(supplierProductRepository, 50000Products, 5000);
```

#### 3. **Queue Long-Running Operations**

```typescript
// Don't wait for expensive operations synchronously
app.post('/api/v1/orders', async (req, res) => {
  const order = await orderService.create(req.body);

  // Queue async jobs, return immediately
  await jobQueue.add('smartbill-create-invoice', { orderId: order.id });
  await jobQueue.add('email-confirmation', { orderId: order.id });
  await jobQueue.add('woocommerce-sync', { orderId: order.id });

  // Send response immediately
  res.status(201).json({
    success: true,
    data: order,
    message: 'Order created, processing...'
  });
});

// Jobs process asynchronously
jobQueue.process('smartbill-create-invoice', async (job) => {
  const { orderId } = job.data;
  try {
    await smartbillService.createInvoice(orderId);
    logger.info(`SmartBill invoice created for order ${orderId}`);
  } catch (err) {
    logger.error(`Failed to create SmartBill invoice for order ${orderId}`, { err });
    throw err;  // BullMQ will retry
  }
});
```

---

## Database Optimization

### Essential Indexes

```sql
-- Pricing
CREATE INDEX idx_price_sku ON prices(sku);
CREATE INDEX idx_price_category_id ON prices(category_id);

-- Orders (most important)
CREATE INDEX idx_order_customer_id ON orders(customer_id);
CREATE INDEX idx_order_status ON orders(status);
CREATE INDEX idx_order_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_number ON orders(order_number);

-- Inventory (critical for performance)
CREATE INDEX idx_stock_product_warehouse ON stock(product_id, warehouse_id);
CREATE INDEX idx_stock_reserved ON stock(reserved_quantity);
CREATE INDEX idx_stock_threshold ON stock(quantity) WHERE quantity < 10;

-- Quotations
CREATE INDEX idx_quote_customer_id ON quotations(customer_id);
CREATE INDEX idx_quote_status ON quotations(status);
CREATE INDEX idx_quote_valid_until ON quotations(valid_until);

-- Suppliers
CREATE INDEX idx_supplier_product_sku ON supplier_products(supplier_id, sku);
CREATE INDEX idx_supplier_product_price ON supplier_products(price);

-- Audit trail
CREATE INDEX idx_audit_trail_timestamp ON audit_trail(timestamp);
CREATE INDEX idx_audit_trail_user ON audit_trail(user_id);

-- SmartBill mapping
CREATE INDEX idx_smartbill_invoice_order_id ON smartbill_invoices(order_id);

-- Woocommerce mapping
CREATE INDEX idx_woocommerce_mapping_internal ON woocommerce_mappings(internal_product_id);

-- Analyze after creating
ANALYZE;
```

### Query Optimization Tips

```typescript
// ❌ Slow: N+1 queries
const orders = await orderRepository.find();
for (const order of orders) {
  order.items = await itemRepository.find({ orderId: order.id });
  order.customer = await customerRepository.findOne(order.customerId);
}

// ✅ Fast: Single query with joins
const orders = await orderRepository.find({
  relations: ['items', 'items.product', 'customer'],
  order: { createdAt: 'DESC' },
  take: 50
});

// ❌ Slow: Filtering in application
const allOrders = await orderRepository.find();
const recent = allOrders.filter(o => o.status === 'paid' && o.createdAt > lastWeek);

// ✅ Fast: Filtering in database
const recentPaidOrders = await orderRepository.find({
  where: {
    status: 'paid',
    createdAt: MoreThan(lastWeek)
  },
  order: { createdAt: 'DESC' }
});

// ❌ Slow: COUNT(*) on large table
const count = await orderRepository.count({ where: { status: 'paid' } });

// ✅ Fast: Cached count or approximate
const cachedCount = await redis.get('order_count_paid') ||
  await orderRepository.count({ where: { status: 'paid' } });
```

---

## Horizontal Scaling

### Multi-Instance Deployment

```
[Nginx Load Balancer]
       ↓
   ┌───┼───┐
   ↓   ↓   ↓
[API1][API2][API3]
   ↓   ↓   ↓
[PostgreSQL Primary]
       ↓
   ┌───┴───┐
   ↓       ↓
[Replica1][Replica2]

[Redis Cluster] (3+ nodes)
```

### Session Management Across Instances

```typescript
// Store sessions in Redis (not in-memory) so any instance can serve user
app.use(session({
  store: new RedisStore({
    client: redis,
    prefix: 'session:'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

### Sticky Sessions (if needed)

```nginx
# Nginx configuration for sticky sessions
upstream cypher_backend {
  least_conn;  # Load balance by least connections

  server api1.example.com:3000;
  server api2.example.com:3000;
  server api3.example.com:3000;
}

server {
  location / {
    proxy_pass http://cypher_backend;
    proxy_cookie_path / "/";
    proxy_cookie_flags ~ secure httponly samesite=lax;
  }
}
```

---

## Redis Optimization

### Memory Management

```
# /etc/redis/redis.conf

# Set maximum memory
maxmemory 1gb

# Eviction policy for when memory limit reached
maxmemory-policy allkeys-lru  # Keep frequently used keys

# Enable persistence
save 900 1
save 300 10
save 60 10000

appendonly yes
appendfsync everysec
```

### Redis Cluster for Redundancy

```yaml
# docker-compose.yml with Redis Cluster

services:
  redis-1:
    image: redis:7
    ports: ['7001:6379']
    command: redis-server --port 6379 --cluster-enabled yes

  redis-2:
    image: redis:7
    ports: ['7002:6379']
    command: redis-server --port 6379 --cluster-enabled yes

  redis-3:
    image: redis:7
    ports: ['7003:6379']
    command: redis-server --port 6379 --cluster-enabled yes

# Initialize cluster
docker exec redis-1 redis-cli --cluster create \
  redis-1:6379 redis-2:6379 redis-3:6379 --cluster-replicas 1
```

---

## Monitoring Scalability

### Key Metrics to Track

```prometheus
# Database
pg_connections_used / pg_connections_max  # Connection pool usage
pg_slow_queries_total  # Queries taking > 1 second
pg_index_size_bytes  # Index bloat

# Redis
redis_memory_used_bytes / redis_memory_max_bytes  # Memory pressure
redis_connected_clients  # Number of clients
redis_evicted_keys_total  # Keys being evicted

# Application
http_request_duration_seconds (p99)  # Latency
http_requests_total (rate)  # Throughput
process_resident_memory_bytes  # Node.js memory
```

### Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Database connections | > 80% | Add read replica or instance |
| Query latency (p99) | > 1s | Add index or optimize query |
| Memory usage | > 85% | Scale horizontally |
| CPU usage | > 70% for 5+ min | Scale horizontally |
| Job queue depth | > 10,000 | Add worker instances |

---

**Document Version:** 0.1.0
**Last Updated:** February 2025
**Performance Review Cycle:** Quarterly

