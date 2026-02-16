# CYPHER ERP Supplier Module - Architecture Overview

## Module Scope

Complete supplier integration system for CYPHER ERP with support for 5 suppliers (Aca Lighting, Masterled, Arelux, Braytron, FSL) managing ~8000+ combined products.

## Hexagonal Architecture Implementation

The module follows hexagonal (ports & adapters) architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────┐
│                   API LAYER                         │
│  (Express routes, controllers, validators)          │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│              APPLICATION LAYER                      │
│  (Use cases, DTOs, business logic, errors)          │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                DOMAIN LAYER                         │
│  (Entities, services, repository interfaces)        │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│              INFRASTRUCTURE LAYER                   │
│  (Database, scrapers, job queues, implementations)  │
└─────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Domain Layer (`src/domain/`)
**Responsibility**: Core business logic and rules

**Files**:
- `entities/Supplier.ts` - Supplier aggregate root with sync logic
- `entities/SupplierProduct.ts` - Product with price history and tracking
- `entities/SkuMapping.ts` - Bidirectional SKU mapping
- `entities/SupplierOrder.ts` - Order with WhatsApp integration
- `services/SkuMappingService.ts` - Domain service for SKU operations
- `repositories/ISupplierRepository.ts` - Repository interface (Port)

**Key Entities**:

1. **Supplier** (Aggregate Root)
   - Properties: id, name, code, website, contact info, WhatsApp number
   - Credentials: encrypted username/password storage
   - Tracking: lastSync, syncFrequency, isActive
   - Methods: isReadyForSync(), canSyncAtTime()

2. **SupplierProduct**
   - Properties: supplierSku, name, price, currency, stockQuantity
   - Price History: 52-week retention (weekly granularity)
   - Methods: priceChangePercentage(), isPriceChangeSignificant()
   - Stock Status: isLowStock(), isOutOfStock()

3. **SkuMapping**
   - Links: supplierId + supplierSku → internalProductId + internalSku
   - Support: Active/inactive status for soft deletion
   - Validation: isValid() method ensures data integrity

4. **SupplierOrder**
   - Items: Array of order line items with pricing
   - Status: Workflow (pending → sent → confirmed → delivered/cancelled)
   - Integration: generateWhatsAppMessage() for manual ordering
   - Methods: markAsSent(), markAsConfirmed(), markAsDelivered()

### Application Layer (`src/application/`)
**Responsibility**: Business processes and use cases

**Use Cases**:

1. **ScrapeSupplierStock**
   - Executes supplier scraping with full flow
   - Detects new/updated products and price changes
   - Publishes events for significant price changes
   - Manages retry logic and error handling
   - Returns comprehensive ScrapeResult DTO

2. **MapSku**
   - Create/update SKU mappings
   - List mapped/unmapped products
   - Calculate coverage percentage
   - Manage SKU mapping lifecycle

3. **PlaceSupplierOrder**
   - Validates items and stock availability
   - Generates WhatsApp message template
   - Creates order in database (not sent automatically)
   - Returns shareable WhatsApp URL

4. **GetSupplierProducts**
   - Retrieves products with filtering
   - Supports search, price range, stock filters
   - Pagination support
   - Statistical calculations (totals, averages, ranges)

**DTOs**:
- ScrapeResult: Complete scrape operation results
- SupplierOrderResult: Order with WhatsApp details
- PriceChangeAlert: Price change notification data
- GetSupplierProductsOptions: Query filters

**Error Hierarchy**:
```
SupplierError (base)
├── SupplierNotFoundError
├── ScrapeError
│   ├── ScrapeTimeoutError
│   └── ScrapeRetryExhaustedError
├── SkuMappingError
│   ├── SkuMappingAlreadyExistsError
│   └── InvalidSkuMappingError
├── InvalidOrderError
├── InsufficientStockError
└── SupplierNotActiveError
```

### Infrastructure Layer (`src/infrastructure/`)
**Responsibility**: Technical implementation and external integrations

**Scrapers** (Adapter Pattern):
- `BaseScraper`: Abstract base with shared functionality
  - Login handling
  - Navigation and element interaction
  - Price/stock parsing utilities
  - Retry logic with exponential backoff
  - 30-second timeout enforcement

- Supplier-specific implementations:
  - `AcaLightingScraper`: ~5000 products
  - `MasterledScraper`: ~1000 products
  - `AreluxScraper`: ~1000 products
  - `BraytronScraper`: ~500 products
  - `FslScraper`: ~800 products

- `ScraperFactory`: Factory pattern for scraper instantiation

**Repositories** (Port Implementation):
- `TypeOrmSupplierRepository`: Implements ISupplierRepository
  - CRUD operations for all entities
  - Bulk upsert for products
  - Sync timestamp tracking
  - Query optimization with indexes

**Database Entities** (TypeORM):
- `SupplierEntityDb`: Supplier table with encryption support
- `SupplierProductEntityDb`: Products with JSON price history
- `SkuMappingEntityDb`: Unique constraint on (supplierId, supplierSku)
- `SupplierOrderEntityDb`: Order with JSON items array

**Database Indexes**:
- Suppliers: code (unique), isActive
- Products: supplierId + supplierSku (unique), lastScraped
- SKU Mappings: supplierId + supplierSku (unique), internalProductId
- Orders: supplierId, orderId, status, createdAt

**Jobs** (BullMQ):
- `SupplierSyncJob`: Scheduled synchronization
  - Cron pattern: `0 */4 6-21 * * *` (every 4 hours, 06:00-22:00)
  - Manual trigger support
  - Event emission for price alerts
  - Handles multiple suppliers sequentially

### API Layer (`src/api/`)
**Responsibility**: HTTP interface and request handling

**Routes** (`supplier.routes.ts`):
```
GET    /suppliers              - List all suppliers
GET    /suppliers/:id          - Get supplier detail
GET    /suppliers/:id/products - Get supplier products
GET    /suppliers/:id/statistics - Product statistics
POST   /suppliers/:id/sync     - Trigger single supplier sync
POST   /suppliers/sync-all     - Trigger all suppliers sync

GET    /suppliers/:id/sku-mappings - List SKU mappings
GET    /suppliers/:id/unmapped-products - Unmapped products
POST   /suppliers/:id/sku-mappings - Create SKU mapping
DELETE /suppliers/sku-mappings/:mappingId - Delete mapping

POST   /suppliers/:id/orders   - Place supplier order
GET    /suppliers/:id/orders   - Get supplier orders
```

**Controllers** (`SupplierController.ts`):
- Request/response handling
- Error mapping to HTTP status codes
- Data transformation to DTOs
- Dependency injection of use cases

**Validators** (`supplier.validators.ts`):
- Joi schemas for all endpoints
- Input validation
- Schema-based error messages

## Data Flow

### Supplier Synchronization Flow

```
1. SupplierSyncJob (cron trigger)
   ↓
2. ScrapeSupplierStock.execute(supplierId)
   ↓
3. Get Supplier config from repository
   ↓
4. ScraperFactory.getScraper(supplierCode)
   ↓
5. BaseScraper.scrapeProducts(credentials)
   - Login
   - Navigate pages
   - Extract product data with retry
   ↓
6. Compare with existing products
   ↓
7. Detect price changes (>10% = significant alert)
   ↓
8. Record price history (52-week rolling window)
   ↓
9. Bulk upsert products to database
   ↓
10. Update lastSync timestamp
    ↓
11. Emit completion event with results
    ↓
12. Return ScrapeResult with metrics
```

### SKU Mapping Flow

```
User: Create SKU mapping
   ↓
API: POST /suppliers/:id/sku-mappings
   ↓
Controller: validateRequest() + MapSku.create()
   ↓
Use Case: Validate supplier exists
   ↓
Use Case: Check duplicate mapping
   ↓
Use Case: Validate SKU data integrity
   ↓
Repository: Save mapping to database
   ↓
Response: Return SkuMappingDTO
```

### Order Placement Flow

```
User: Place order
   ↓
API: POST /suppliers/:id/orders
   ↓
Controller: PlaceSupplierOrder.execute()
   ↓
Use Case: Validate supplier & items
   ↓
Use Case: Check stock availability
   ↓
Use Case: Generate WhatsApp template
   ↓
SupplierOrderEntity: Create message with formatting
   ↓
Repository: Save order (status = pending)
   ↓
Response: Return whatsappUrl for manual send
   ↓
User: Open WhatsApp and send message manually
```

## Dependency Injection Pattern

The module uses constructor injection for all dependencies:

```typescript
// Use Case Injection
const scrapeUseCase = new ScrapeSupplierStock(
  repository,           // Domain repository interface
  scraperFactory        // Infrastructure factory
);

// Controller Injection
const controller = new SupplierController(
  repository,           // For data access
  syncJob              // For job management
);

// Repository Injection
const repository = new TypeOrmSupplierRepository(
  supplierRepo,         // TypeORM repository
  productRepo,          // TypeORM repository
  mappingRepo,          // TypeORM repository
  orderRepo            // TypeORM repository
);
```

## Key Design Decisions

### 1. No Automatic Order Sending
Orders generate WhatsApp messages but require manual sending. This prevents accidental orders and maintains security.

### 2. Web Scraping Only
No API integrations - uses Puppeteer/Cheerio for robustness across supplier websites. Suppliers can be updated without code changes.

### 3. Retry with Exponential Backoff
3 retries with exponential delays (1s, 2s, 4s) handle temporary network issues.

### 4. 52-Week Price History
Stores 1 year of weekly prices for trend analysis and change detection without bloating database.

### 5. Time-Based Sync Window
Only syncs 06:00-22:00 to avoid peak business hours disruption.

### 6. Price Change Thresholds
- All changes recorded
- >10% changes trigger alerts
- Significant changes published as events

### 7. SKU Mapping Patterns
- Supplier SKU → Internal Product ID + Internal SKU
- Active/inactive toggle for soft deletion
- Coverage metrics for monitoring progress

## Testing Strategy

### Unit Tests (Domain Layer)
- `SupplierProduct.test.ts`: Price change detection (6 tests)
- `SupplierOrder.test.ts`: Message generation and workflow (8 tests)

### Integration Tests (Application Layer)
- `ScrapeSupplierStock.test.ts`: Full scrape flow with mocks (6 tests)
  - Error handling
  - Product detection (new/updated)
  - Price change detection
  - Batch operations

### Coverage Target: 70%+ across branches/functions/lines/statements

## Performance Considerations

1. **Scraping**: 30s timeout prevents hanging
2. **Bulk Operations**: bulkUpsertProducts for efficient database writes
3. **Indexing**: Strategic indexes on frequently queried fields
4. **Job Queue**: BullMQ ensures reliable scheduling
5. **Pagination**: GetSupplierProducts supports limit/offset

## Security Considerations

1. **Credentials Encryption**: Supplier credentials stored securely
2. **Manual Order Sending**: Prevents unauthorized transactions
3. **Input Validation**: Joi schemas on all endpoints
4. **Error Messages**: Don't expose internal details
5. **Time Window Validation**: Sync only during configured hours

## Scalability Points

1. **Horizontal Scaling**: BullMQ supports distributed workers
2. **Database**: TypeORM supports multiple databases
3. **Caching**: Can add Redis caching layer for products
4. **Async Processing**: Event-driven architecture for price alerts
5. **Batch Operations**: Bulk upserts reduce database load

## Monitoring & Observability

**Logged Metrics**:
- Scrape duration per supplier
- Products found/updated/created
- Price changes detected
- Significant price changes
- Retry attempts
- Scraper errors

**Events Emitted**:
- `scrape:complete` - Synchronization finished
- Price alerts for significant changes (custom events)

**Database Tracking**:
- lastSync timestamp per supplier
- lastScraped timestamp per product
- Full order history with timestamps
- Price history with dates
