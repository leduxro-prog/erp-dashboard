# WooCommerce Sync Module - Integration Guide

This guide explains how to integrate the WooCommerce Sync module into your CYPHER ERP application.

## Installation

```bash
npm install @cypher/woocommerce-sync
```

## Setup

### 1. Database Setup

Create the required database tables:

```typescript
import { DataSource } from 'typeorm';
import { SyncItemEntity, SyncBatchEntity, ProductSyncMappingEntity } from '@cypher/woocommerce-sync';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false,
  logging: false,
  entities: [
    SyncItemEntity,
    SyncBatchEntity,
    ProductSyncMappingEntity,
  ],
  migrations: [],
});

await AppDataSource.initialize();
```

### 2. Initialize the Module

```typescript
import {
  WooCommerceApiClient,
  WooCommerceMapper,
  TypeOrmSyncRepository,
  SyncCache,
  RealTimeSyncWorker,
  FullSyncJob,
  OrderPullJob,
  RetryFailedJob,
  SyncEventHandler,
  SyncProduct,
  SyncAllProducts,
  SyncStock,
  SyncPrice,
  SyncCategories,
  PullOrders,
  HandleSyncEvent,
  WooCommerceController,
  createWooCommerceRoutes,
} from '@cypher/woocommerce-sync';
import Redis from 'ioredis';
import { Express } from 'express';

const redis = new Redis(process.env.REDIS_URL);
const syncRepository = new TypeOrmSyncRepository(AppDataSource);
const syncCache = new SyncCache(process.env.REDIS_URL);

// Initialize API client
const apiClient = new WooCommerceApiClient({
  baseUrl: process.env.WOOCOMMERCE_URL,
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
});

// Initialize mapper
const mapper = new WooCommerceMapper();

// Implement product getter (integrate with your ERP)
const getProduct = async (productId: string) => {
  // Fetch from your ERP database
  return db.products.findById(productId);
};

const getAllProducts = async (force?: boolean) => {
  // Fetch all from your ERP database
  return db.products.findAll({ status: 'active' });
};

const getProductStock = async (productId: string) => {
  const product = await db.products.findById(productId);
  return product.stockQuantity;
};

const getProductPrice = async (productId: string) => {
  const product = await db.products.findById(productId);
  return {
    price: product.price,
    salePrice: product.salePrice,
  };
};

const getCategories = async () => {
  return db.categories.findAll();
};

const publishEvent = async (eventName: string, payload: any) => {
  // Publish to your event bus or Redis
  await redis.publish(eventName, JSON.stringify(payload));
};

// Initialize use cases
const syncProduct = new SyncProduct(
  syncRepository,
  apiClient,
  mapper,
  getProduct
);

const syncAllProducts = new SyncAllProducts(
  syncRepository,
  apiClient,
  mapper,
  getAllProducts
);

const syncStock = new SyncStock(
  syncRepository,
  apiClient,
  mapper,
  getProductStock
);

const syncPrice = new SyncPrice(
  syncRepository,
  apiClient,
  mapper,
  getProductPrice
);

const syncCategories = new SyncCategories(
  syncRepository,
  apiClient,
  getCategories
);

const pullOrders = new PullOrders(
  apiClient,
  mapper,
  publishEvent
);

const queueJob = async (jobName: string, data: any) => {
  // Queue job using your job queue system
  // This example uses BullMQ
  await jobQueue.add(jobName, data);
};

const handleSyncEvent = new HandleSyncEvent(
  syncRepository,
  queueJob
);

// Initialize workers and jobs
const realTimeWorker = new RealTimeSyncWorker(
  redis,
  syncRepository,
  apiClient,
  mapper,
  getProduct
);

const fullSyncJob = new FullSyncJob(redis, syncAllProducts);
const orderPullJob = new OrderPullJob(redis, pullOrders, syncCache);
const retryFailedJob = new RetryFailedJob(redis, syncRepository, queueJob);

const syncEventHandler = new SyncEventHandler(redis, handleSyncEvent);

// Start workers and jobs
await realTimeWorker.start();
await fullSyncJob.register();
await orderPullJob.register();
await retryFailedJob.register();
await syncEventHandler.start();
```

### 3. Register Routes

```typescript
import { Express } from 'express';
import { WooCommerceController } from '@cypher/woocommerce-sync';

const app: Express = express();

// Create controller
const controller = new WooCommerceController(
  syncRepository,
  syncProduct,
  syncAllProducts,
  syncStock,
  syncPrice,
  syncCategories,
  pullOrders
);

// Register routes
app.use(createWooCommerceRoutes(controller));
```

### 4. Handle ERP Events

When product data changes in your ERP, publish events to trigger syncing:

```typescript
// Product created
redis.publish('product.created', JSON.stringify({
  productId: 'prod-123',
  timestamp: new Date(),
}));

// Stock updated
redis.publish('inventory.stock_changed', JSON.stringify({
  productId: 'prod-123',
  payload: {
    stockQuantity: 50,
  },
  timestamp: new Date(),
}));

// Price changed
redis.publish('pricing.price_changed', JSON.stringify({
  productId: 'prod-123',
  payload: {
    price: 99.99,
    salePrice: 79.99,
  },
  timestamp: new Date(),
}));
```

## Monitoring

### Health Check

```typescript
app.get('/health/woocommerce', async (req, res) => {
  try {
    const stats = await syncRepository.getSyncStats();
    const isHealthy = stats.failedCount < 10;

    res.json({
      healthy: isHealthy,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
    });
  }
});
```

### Error Tracking

Monitor failed syncs:

```typescript
// Check failed items
const failedItems = await syncRepository.getFailedItems();

console.log('Failed syncs:', failedItems.map(item => ({
  productId: item.productId,
  syncType: item.syncType,
  errorMessage: item.errorMessage,
  attempts: item.attempts,
})));
```

### SLA Compliance

```typescript
import { SyncPriorityService } from '@cypher/woocommerce-sync';

const priorityService = new SyncPriorityService();
const pendingItems = await syncRepository.getPendingItems(1000);

const slaBreachers = pendingItems.filter(item =>
  priorityService.isBreachingSla(item)
);

console.log('Items breaching SLA:', slaBreachers.length);
slaBreachers.forEach(item => {
  const sla = priorityService.getSlaBoundary(item.syncType);
  console.log(`${item.productId}: ${item.syncType} (SLA: ${sla}min)`);
});
```

## Cleanup Jobs

Register periodic cleanup of old sync records:

```typescript
// Every day at 02:00 UTC
setInterval(async () => {
  const deletedItems = await syncRepository.deleteOldSyncItems(30); // 30+ days old
  const deletedBatches = await syncRepository.deleteOldBatches(30);

  console.log(`Cleanup: ${deletedItems} sync items, ${deletedBatches} batches`);
}, 24 * 60 * 60 * 1000);
```

## Testing

Run the test suite:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

## Troubleshooting

### Issue: Products not syncing

1. Check Redis connection
2. Verify WooCommerce API credentials
3. Check failed sync items: `GET /api/v1/woocommerce/sync/failed`
4. Review logs for error messages

### Issue: Rate limiting

1. Reduce batch size
2. Reduce worker concurrency
3. Implement backoff: the module includes exponential backoff by default

### Issue: Mapping conflicts

1. Verify mappings: `GET /api/v1/woocommerce/mappings/:productId`
2. Manually update mapping if needed
3. Trigger full sync: `POST /api/v1/woocommerce/sync/all`

## Performance Tuning

### High-Volume Syncing

For > 10,000 products:

```typescript
// Increase batch size
const batch = new SyncBatch(id, 500);

// Increase worker concurrency
worker.concurrency = 50;

// Run full sync during low-traffic hours
// Modify in config: FULL_SYNC_CRON=0 2 * * *
```

### Memory Management

```typescript
// Paginate large operations
const CHUNK_SIZE = 500;
for (let i = 0; i < products.length; i += CHUNK_SIZE) {
  const chunk = products.slice(i, i + CHUNK_SIZE);
  await syncAllProducts.execute(chunk);
}
```

## License

Copyright © 2024 CYPHER ERP
