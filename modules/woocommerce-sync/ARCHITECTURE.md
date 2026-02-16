# WooCommerce Sync Module - Architecture Document

## Overview

The WooCommerce Sync module implements a production-grade, event-driven synchronization system that keeps CYPHER ERP products in sync with WooCommerce (https://ledux.ro). Cypher is always the source of truth, with conflict resolution favoring internal data.

## Design Principles

1. **Clean Architecture**: Clear separation between domain, application, infrastructure, and API layers
2. **CQRS-like Pattern**: Separate read/write paths with event-driven updates
3. **Resilience**: Retry logic with exponential backoff and error tracking
4. **Scalability**: Batch operations, async job processing, and caching
5. **Observability**: Comprehensive logging and status tracking
6. **Testability**: Dependency injection and interface-based design

## Layered Architecture

### 1. Domain Layer (`src/domain/`)

**Purpose**: Core business logic and rules, independent of infrastructure.

#### Entities

- **SyncItem**: Represents a single sync operation
  - Tracks status: pending → syncing → completed/failed
  - Supports retries (max 3 attempts)
  - Stores sync type and payload
  - Example: "Sync price for product ABC123"

- **SyncBatch**: Groups up to 100 sync operations
  - Tracks progress and success/failure counts
  - Measures duration
  - Returns summary statistics
  - Example: "Batch of 100 products for daily sync"

- **ProductSyncMapping**: Bidirectional mapping
  - Internal Product ID ↔ WooCommerce Product ID
  - Tracks last sync time and status
  - Detects out-of-sync conditions
  - Example: "product-123 maps to WC ID 5001"

#### Services

- **SyncPriorityService**: Prioritizes sync operations
  - Ranking: price (1) > stock (2) > product (3) > category (4) > image (5)
  - SLA boundaries: price 2min, stock 5min, product 15min
  - Detects SLA breaches

#### Repository Interface

- **ISyncRepository**: Abstraction for data persistence
  - CRUD operations for all entities
  - Query methods: pending items, failed items, by status
  - Statistics aggregation

### 2. Application Layer (`src/application/`)

**Purpose**: Orchestration of domain entities, use case implementations.

#### Use Cases

1. **SyncProduct**
   - Syncs complete product (name, description, price, stock, images, categories)
   - Creates mapping if new
   - Updates if mapping exists
   - Returns: `SyncResult`

2. **SyncAllProducts**
   - Batches products into groups of 100
   - Uses WooCommerce batch API
   - Tracks overall progress
   - Returns: `BatchSyncResult`

3. **SyncStock**
   - Fast path for stock-only updates
   - Minimal payload (stock_quantity)
   - SLA: 5 minutes
   - Returns: `SyncResult`

4. **SyncPrice**
   - Fast path for price-only updates
   - Includes sale price and date ranges
   - SLA: 2 minutes
   - Returns: `SyncResult`

5. **SyncCategories**
   - Creates/updates product categories
   - Maps category names to IDs
   - Returns: `SyncResult`

6. **PullOrders**
   - Fetches processing orders from WooCommerce
   - Converts to internal format
   - Publishes `woocommerce.order_received` event
   - Returns: `PulledOrder[]`

7. **HandleSyncEvent**
   - Routes events to appropriate sync type
   - Queues sync jobs
   - Supports:
     - `inventory.stock_changed` → SyncStock
     - `pricing.price_changed` → SyncPrice
     - `product.updated` → SyncProduct
     - `product.category_changed` → SyncCategories
     - `product.image_*` → SyncImage

#### Data Transfer Objects (DTOs)

- **SyncResult**: Single operation result
  - success, productId, wooCommerceId, syncType, duration, error
- **BatchSyncResult**: Batch operation result
  - batchId, totalProducts, synced, failed, duration, failedItems
- **PulledOrder**: WooCommerce order in internal format
- **WooCommerceProduct**: Product in WooCommerce API format

#### Error Classes

- **WooCommerceError**: Base error
- **WooCommerceApiError**: API communication (HTTP status + response body)
- **SyncError**: Business logic failure (productId, syncType)
- **MappingNotFoundError**: Product mapping not found
- **NetworkError**: Network connectivity issues
- **RateLimitError**: Rate limiting with retry-after
- **ValidationError**: Data validation

### 3. Infrastructure Layer (`src/infrastructure/`)

**Purpose**: Technical implementations, external integrations.

#### API Client

- **WooCommerceApiClient**
  - Axios-based HTTP client
  - OAuth authentication (consumer key/secret)
  - Base URL: `{WOOCOMMERCE_URL}/wp-json/wc/v3`
  - Methods:
    - `getProduct(id)` - GET /products/{id}
    - `createProduct(data)` - POST /products
    - `updateProduct(id, data)` - PUT /products/{id}
    - `batchUpdateProducts(data)` - POST /products/batch
    - `getOrders(params)` - GET /orders
    - `getCategories()` - GET /products/categories
    - `createCategory(data)` - POST /products/categories
    - `updateCategory(id, data)` - PUT /products/categories/{id}
  - Error handling:
    - 429 → RateLimitError (respects retry-after header)
    - Network timeout → NetworkError
    - Other HTTP errors → WooCommerceApiError
  - Rate limiting: Respects WooCommerce API limits
  - Timeout: 30 seconds per request

#### Mapper

- **WooCommerceMapper**
  - Maps domain models ↔ WooCommerce API format
  - `toWooCommerceProduct()` - Full product mapping
  - `toWooCommerceStock()` - Stock-only payload
  - `toWooCommercePrice()` - Price-only payload with sale dates
  - `fromWooCommerceOrder()` - Order conversion

#### Data Access

- **SyncItemEntity** (TypeORM)
  - Table: `wc_sync_items`
  - Indexes: (status, createdAt), productId, (syncType, status)

- **SyncBatchEntity** (TypeORM)
  - Table: `wc_sync_batches`
  - Indexes: (status, createdAt)

- **ProductSyncMappingEntity** (TypeORM)
  - Table: `wc_product_sync_mappings`
  - Unique: internalProductId, wooCommerceProductId
  - Indexes: syncStatus, lastSynced

- **TypeOrmSyncRepository**
  - Implements ISyncRepository
  - CRUD operations for all entities
  - Complex queries: pending, failed, by status
  - Aggregations: sync stats

#### Caching

- **SyncCache** (Redis)
  - Maps cache: `wc_mapping:{productId}` → WC ID
  - Sync status: `wc_sync_status:{productId}`
  - Attempt tracking: `wc_sync_attempts:{productId}`
  - Last sync time: `wc_last_sync:{productId}`
  - TTL: Configurable (default 24 hours for mappings)

#### Job Queue (BullMQ)

- **RealTimeSyncWorker**
  - Queue name: `woocommerce-sync`
  - Concurrency: 10 workers
  - Retries: 3 attempts with exponential backoff
  - Processes SyncJobData:
    - syncItemId
    - productId
    - syncType
  - Workflow:
    1. Load sync item from DB
    2. Mark as syncing
    3. Fetch product data from ERP
    4. Map to WooCommerce format
    5. Call API
    6. Mark as completed/failed
    7. Update mapping status

- **FullSyncJob**
  - Queue name: `full-sync`
  - Schedule: Daily at 03:00 UTC
  - Executes: SyncAllProducts.execute(force: false)
  - SLA: No strict SLA (batch operation)

- **OrderPullJob**
  - Queue name: `order-pull`
  - Schedule: Every 5 minutes
  - Executes: PullOrders.execute(since)
  - Pulls: Orders with status "processing"
  - Publishes: `woocommerce.order_received` event

- **RetryFailedJob**
  - Queue name: `retry-failed`
  - Schedule: Every 30 minutes
  - Logic:
    1. Get all failed sync items
    2. Filter by: canRetry() AND lastAttempt > 1 min ago
    3. Reset status to pending
    4. Requeue sync jobs

#### Event Handler

- **SyncEventHandler**
  - Subscribes to Redis pub/sub channels:
    - `inventory.stock_changed`
    - `inventory.stock_updated`
    - `pricing.price_changed`
    - `pricing.price_updated`
    - `product.updated`
    - `product.created`
    - `product.category_changed`
    - `product.image_added`
    - `product.image_updated`
    - `category.created`
    - `category.updated`
  - Routes events to HandleSyncEvent
  - Queues appropriate sync jobs

### 4. API Layer (`src/api/`)

**Purpose**: REST endpoints and request/response handling.

#### Routes

All routes require authentication token:

- `POST /api/v1/woocommerce/sync/product/:productId`
  - Sync single product
  - Requires auth

- `POST /api/v1/woocommerce/sync/all`
  - Sync all products
  - Requires auth + admin role
  - Body: `{ force?: boolean }`

- `POST /api/v1/woocommerce/sync/stock/:productId`
  - Sync stock only
  - Requires auth

- `POST /api/v1/woocommerce/sync/price/:productId`
  - Sync price only
  - Requires auth

- `POST /api/v1/woocommerce/sync/categories`
  - Sync all categories
  - Requires auth + admin role

- `POST /api/v1/woocommerce/pull/orders`
  - Pull orders from WooCommerce
  - Requires auth
  - Body: `{ since?: ISO8601Date }`

- `GET /api/v1/woocommerce/sync/status`
  - Get sync statistics
  - Requires auth
  - Returns: SyncStats

- `GET /api/v1/woocommerce/sync/failed`
  - List failed sync items
  - Requires auth + admin role
  - Returns: Failed SyncItems[]

- `POST /api/v1/woocommerce/sync/retry`
  - Retry all failed syncs
  - Requires auth + admin role
  - Returns: Retry count

- `GET /api/v1/woocommerce/mappings/:productId`
  - Get product mapping
  - Requires auth
  - Returns: ProductSyncMapping

#### Controller

- **WooCommerceController**
  - Implements all endpoints
  - Delegates to use cases
  - Handles errors and formatting

#### Validators

- **WooCommerceValidators**
  - Middleware functions
  - validateProductId: Check productId parameter
  - validateSyncAllProductsRequest: Validate body
  - validatePullOrdersRequest: Validate date format
  - validateAuthToken: Check Authorization header
  - validateAdminRole: Check user role

## Data Flow

### Real-Time Sync Flow

```
ERP Product Changes
        ↓
   Redis Pub/Sub
        ↓
SyncEventHandler
        ↓
  HandleSyncEvent
        ↓
  Queue Sync Job
        ↓
 RealTimeSyncWorker
        ↓
  Get Product Data
        ↓
   Map to WooCommerce
        ↓
  Call WooCommerce API
        ↓
Update SyncItem & Mapping
        ↓
      Done
```

### Manual Sync Flow

```
REST API Request
        ↓
WooCommerceController
        ↓
  Use Case (SyncProduct)
        ↓
  Get Product Data
        ↓
   Map to WooCommerce
        ↓
  Call WooCommerce API
        ↓
Update SyncItem & Mapping
        ↓
  Return SyncResult
```

### Retry Flow

```
RetryFailedJob (every 30 min)
        ↓
Get All Failed Items
        ↓
Filter Retryable Items
        ↓
Reset Status & Requeue
        ↓
RealTimeSyncWorker
        ↓
      Process
```

### Order Pull Flow

```
OrderPullJob (every 5 min)
        ↓
Call WooCommerce API
        ↓
Map Orders to Internal Format
        ↓
Publish Events
        ↓
Other Modules Process Orders
```

## Database Schema

### wc_sync_items
```sql
CREATE TABLE wc_sync_items (
  id UUID PRIMARY KEY,
  productId UUID NOT NULL,
  wooCommerceId INTEGER,
  syncType VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  errorMessage TEXT,
  attempts INTEGER DEFAULT 0,
  maxAttempts INTEGER DEFAULT 3,
  lastAttempt TIMESTAMP,
  completedAt TIMESTAMP,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,

  INDEX (status, createdAt),
  INDEX (productId),
  INDEX (syncType, status)
);
```

### wc_sync_batches
```sql
CREATE TABLE wc_sync_batches (
  id UUID PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  batchSize INTEGER DEFAULT 100,
  startedAt TIMESTAMP,
  completedAt TIMESTAMP,
  totalItems INTEGER DEFAULT 0,
  successCount INTEGER DEFAULT 0,
  failCount INTEGER DEFAULT 0,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,

  INDEX (status, createdAt)
);
```

### wc_product_sync_mappings
```sql
CREATE TABLE wc_product_sync_mappings (
  id UUID PRIMARY KEY,
  internalProductId UUID NOT NULL UNIQUE,
  wooCommerceProductId INTEGER NOT NULL UNIQUE,
  lastSynced TIMESTAMP NOT NULL,
  syncStatus VARCHAR(20) NOT NULL,
  errorMessage TEXT,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,

  INDEX (internalProductId),
  INDEX (wooCommerceProductId),
  INDEX (syncStatus)
);
```

## SLA & Performance

### SLA Targets

| Operation | SLA | Priority |
|-----------|-----|----------|
| Price Update | 2 minutes | 1 |
| Stock Update | 5 minutes | 2 |
| Product Details | 15 minutes | 3 |
| Category Sync | 30 minutes | 4 |
| Image Sync | 60 minutes | 5 |

### Batch Performance

- Batch size: 100 products
- API call time: ~500ms (depends on network)
- Throughput: 100 products per 0.5s ≈ 200 products/sec
- Full sync (10,000 products): ~50 seconds

### Retry Strategy

- Max attempts: 3
- Backoff: Exponential (2s, 4s, 8s)
- Automatic retry: Every 30 minutes for failed items
- Manual retry: Via API endpoint

## Conflict Resolution

**Cypher is always the source of truth**

When syncing:

1. Internal product data overwrites WooCommerce
2. Exception: Manual special offers
   - Check `allow_manual_woocommerce_offers` flag
   - If true and WC sale price exists and not set by Cypher, preserve it

## Scalability Considerations

### Horizontal Scaling

- **Stateless design**: No in-process state
- **Redis for distributed coordination**: Pub/sub, caching
- **Database as single source of truth**
- **Multiple worker instances**: Run multiple RealTimeSyncWorker instances

### Vertical Scaling

- **Worker concurrency**: Increase from 10 to 50
- **Batch size**: Increase from 100 to 500
- **Redis memory**: Cache more mappings
- **Database connections**: Increase pool size

### Monitoring Scaling

- **Slow queries**: Monitor sync item queries
- **Cache hit rate**: Monitor mapping cache
- **Queue depth**: Alert if > 1000 pending items
- **Worker lag**: Alert if processing time > SLA

## Testing Strategy

### Unit Tests
- Domain entities: State transitions, validations
- Mappers: Data transformation correctness
- Services: Priority calculations, SLA detection

### Integration Tests
- Repository: Database CRUD operations
- API Client: WooCommerce API integration (with mocks)
- Use Cases: End-to-end workflows with mocked dependencies

### Load Tests
- Batch sync: 10,000 products
- Real-time sync: 100 events/sec
- Order pull: 1000 orders
- Concurrent workers: 10+ instances

## Security Considerations

1. **Credentials**: WooCommerce keys stored in env vars
2. **API Authentication**: OAuth for WooCommerce API
3. **Request Validation**: Input validation on all endpoints
4. **Rate Limiting**: Respect WooCommerce API limits
5. **Error Messages**: Don't expose sensitive data in errors
6. **Audit Logging**: Log all sync operations

## Future Enhancements

1. **Two-way sync**: Handle WooCommerce changes
2. **Product variants**: Support WooCommerce variations
3. **Advanced mapping**: Category hierarchy, attribute mapping
4. **Webhooks**: Real-time WooCommerce → Cypher
5. **Advanced retry**: Exponential backoff with jitter
6. **Multi-tenancy**: Support multiple WooCommerce stores
7. **Analytics**: Dashboard for sync metrics
8. **Custom fields**: Sync custom attributes
