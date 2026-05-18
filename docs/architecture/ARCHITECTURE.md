# CYPHER ERP — System Architecture

**Version:** 0.2.0
**Last Updated:** February 2026
**Target Audience:** Developers, DevOps, Technical Architects
**System Owner:** Ledux.ro (LED Lighting E-Commerce, Romania)

## 1. System Overview

CYPHER is a bespoke **Enterprise Resource Planning (ERP/CRM)** system built for Ledux.ro, a Romanian LED lighting e-commerce company. The system orchestrates complex business processes across procurement, inventory management, pricing, quotations, order fulfillment, and multi-channel synchronization.

### 1.1 Core Problem Statement

Ledux.ro faces complex operational challenges:

- **Dynamic pricing** based on customer tiers (4 levels), volume discounts, and real-time margin calculations
- **Multi-supplier sourcing** with automated price scraping and inventory synchronization
- **Invoice synchronization** with Romanian tax authority via SmartBill (19% VAT)
- **E-commerce integration** with WooCommerce (one-way sync: Cypher → Web)
- **Quotation workflow** with PDF generation, reminders, and auto-expiry (15 days)
- **Order lifecycle management** with 14 distinct statuses and complex state transitions
- **Warehouse management** across 3 locations with priority-based allocation

### 1.2 Who Uses This System

- **Internal Sales Team:** Create quotes, manage customers, view pricing
- **Warehouse Staff:** Pick/pack orders, update inventory
- **Finance Department:** Invoice generation, payment tracking via SmartBill
- **Business Analysts:** Real-time metrics, performance dashboards
- **System Administrators:** Configuration, monitoring, integrations

### 1.3 Key Statistics

- **31 Modules** implemented (see Module Map below)
- **100+ API Endpoints** across all modules (see [API.md](./API.md))
- **Tech Stack:** Node.js 20 LTS, TypeScript 5.3, Express.js, PostgreSQL 15, Redis 7, TypeORM, BullMQ
- **Security:** JWT + HttpOnly cookies, TOTP 2FA, rate limiting, audit logging (see [SECURITY.md](./SECURITY.md))

---

## 2. Architecture Decision Records (ADRs)

### ADR 001: Hexagonal (Clean) Architecture

**Decision:** Organize code into domain, application, and infrastructure layers to decouple business logic from external dependencies.

**Rationale:**

- Business rules (pricing calculations, order state machines) must be testable without databases
- Multiple implementations of repositories (TypeORM for DB, mocks for tests)
- Future API gateway, CLI, or event handlers can reuse application layer without duplication
- Each module defines own domain entities, use-cases, and ports (interfaces)

**Implementation:**

```
pricing-engine/
├── domain/           # Pure business logic (entities, services, domain errors)
│   ├── entities/     # Price, Promotion, CustomerTier
│   ├── services/     # PriceCalculator, VolumeDiscountCalculator (stateless)
│   └── errors/       # InvalidMarginError, ProductNotFoundError
├── application/      # Use-case orchestration, DTOs, application ports
│   ├── use-cases/    # CalculatePrice, ManageTiers, etc.
│   ├── dtos/         # Request/response data structures
│   ├── ports/        # IPriceRepository, ITierRepository (interfaces)
│   └── errors/       # ApplicationServiceError, ValidationError
├── infrastructure/   # TypeORM entities, repositories, HTTP controllers
│   ├── entities/     # PriceEntity, PromotionEntity (DB mappings)
│   ├── repositories/ # TypeOrmPriceRepository (implements port)
│   ├── cache/        # PriceCache (L1 in-memory cache)
│   ├── api/          # Controllers, validators, routes
│   └── composition-root.ts  # DI factory
└── index.ts          # Module export
```

**Diagram:**

```
Request → API Layer (Controller) → Application Layer (UseCase) → Domain Layer (Service)
                                              ↓
                          Infrastructure Layer (Repository)
```

### ADR 002: TypeORM + PostgreSQL with Connection Pooling

**Decision:** Use TypeORM as ORM layer above PostgreSQL with configured connection pooling and connection timeout controls.

**Rationale:**

- Type-safe database access (auto-completion, compile-time checking)
- Migrations for schema versioning and rollback capability
- Connection pooling prevents resource exhaustion under load
- Statement timeout prevents long-running queries from blocking
- Lazy-load relations can be converted to eager load to prevent N+1 queries

**Pool Configuration:**

```typescript
extra: {
  max: 20,                    // Max 20 connections
  min: 5,                     // Min 5 connections always open
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000,  // Timeout after 5s trying to get connection
  statement_timeout: 30000,   // Cancel queries after 30s
}
```

**Best Practices:**

- Use eager loading for relations: `find({ relations: ['items'] })`
- Index foreign keys and frequently queried fields
- Use pagination for large result sets (see SCALABILITY_GUIDE.md)

### ADR 003: Redis Pub/Sub + BullMQ for Async Processing

**Decision:** Use Redis for two purposes:

1. **Pub/Sub messaging:** Event broadcasting across modules (order.created → SmartBill, WooCommerce)
2. **Job queues (BullMQ):** Long-running tasks (PDF generation, supplier scraping, sync jobs)

**Rationale:**

- Event-driven architecture allows modules to communicate without tight coupling
- Retry logic built into BullMQ prevents data loss on failure
- Redis persistence (RDB snapshots) ensures message durability
- Pub/Sub is fire-and-forget (best-effort), queues are durable
- Pub/Sub for real-time events, queues for critical operations

**Architecture:**

```
[Order Created] → EventBus.publish('order.created', {...})
                    ↓
         Redis Channel: 'order.created'
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
SmartBill    WooCommerce      Inventory
Subscriber   Subscriber       Subscriber
```

**Queue Processing:**

```
Application → BullMQ Job Queue → Redis → Worker Process → Task Completion
(e.g., PDF generation, supplier sync)
```

### ADR 004: Feature Flags for Runtime Control

**Decision:** Implement feature flag service for safe rollout of new modules and A/B testing without redeployment.

**Rationale:**

- Enable/disable modules at runtime (e.g., WOOCOMMERCE_SYNC=false to troubleshoot)
- Percentage-based rollout (enable for 10% of users, then 50%, then 100%)
- Role-based activation (beta features for admin users only)
- No code redeployment required

**Usage:**

```typescript
const flagService = FeatureFlagService.getInstance();
if (flagService.isEnabled('INVENTORY_AUTOSYNC', { role: 'admin' })) {
  await autoSyncInventory();
}
```

### ADR 005: Circuit Breaker for External APIs

**Decision:** Implement circuit breaker pattern for SmartBill, WooCommerce, and Supplier APIs to prevent cascade failures.

**Rationale:**

- When SmartBill API is down, don't retry forever and waste resources
- Quick fail (open circuit) returns error immediately vs. waiting 10s per timeout
- Auto-recovery (HALF_OPEN state) periodically tests if service is back
- Fallback functions can provide degraded service

**States:**

- **CLOSED:** Normal operation, requests pass through
- **OPEN:** Too many failures, reject requests immediately
- **HALF_OPEN:** Testing recovery with limited probe requests

---

## 3. Module Map

### 3.1 Implemented Modules (Agent A - Core)

#### 1. **Pricing Engine** ✅ IMPLEMENTED

- **Path:** `/modules/pricing-engine`
- **Purpose:** Dynamic pricing calculations with customer tiers, volume discounts, and margin validation
- **Key Entities:** Price, Promotion, VolumeDiscount, CustomerTier
- **Dependencies:** None (core module)
- **Exports:** PriceCalculator service, pricing repositories

**Pricing Formula:**

```
FinalPrice = Cost × (1 + Margin%) × (1 - TierDiscount%) × (1 - VolumeDiscount%)
```

**Tier Structure:**

- **Standard (0%):** No discount
- **Tier 1 (5%):** Minimum monthly spend > 5,000
- **Tier 2 (10%):** Minimum monthly spend > 15,000
- **Tier 3 (15%):** Minimum monthly spend > 30,000

**Volume Discounts:**

- 0-9 units: 0%
- 10-49 units: 2%
- 50-99 units: 5%
- 100+ units: 8%

---

#### 2. **Inventory Management** ✅ IMPLEMENTED

- **Path:** `/modules/inventory`
- **Purpose:** Multi-warehouse stock tracking, reservations, and low-stock alerts
- **Key Entities:** Stock, StockMovement, StockReservation, Warehouse, StockAlert
- **Dependencies:** None
- **Features:**
  - 3 warehouses with priority-based allocation
  - Stock reservations prevent overselling
  - Low-stock alerts when stock < threshold (default: 3 units)
  - Backorder management (10-day default delivery time)
  - Movement history tracking (all stock changes)

**Warehouse Priority:**

1. Warehouse A (primary)
2. Warehouse B (secondary)
3. Warehouse C (tertiary)

---

#### 3. **Orders** ✅ IMPLEMENTED

- **Path:** `/modules/orders`
- **Purpose:** Order lifecycle management with 14 distinct statuses and complex transitions
- **Key Entities:** Order, OrderItem, OrderHistory
- **Dependencies:** Pricing Engine, Inventory, Quotations
- **Features:**
  - 14 status types (see shared/constants/order-statuses.ts)
  - State machine validation (only allow valid transitions)
  - Partial delivery tracking
  - Order cancellation with inventory rollback
  - Proforma invoice generation

**Status Lifecycle:**

```
QUOTE_PENDING → QUOTE_SENT → QUOTE_ACCEPTED → ORDER_CONFIRMED
                                                      ↓
                                      SUPPLIER_ORDER_PLACED (optional)
                                                      ↓
AWAITING_DELIVERY → IN_PREPARATION → READY_TO_SHIP → SHIPPED → DELIVERED
                                                                      ↓
                                                           INVOICED → PAID
                                                              ↓
                                                           RETURNED / CANCELLED
```

---

#### 4. **Quotations** ✅ IMPLEMENTED

- **Path:** `/modules/quotations`
- **Purpose:** Quote generation, tracking, conversion to orders with PDF export
- **Key Entities:** Quotation, QuotationItem
- **Dependencies:** Orders, Pricing Engine
- **Features:**
  - 15-day validity period (auto-expiry)
  - PDF generation with company branding
  - Reminder emails (7 days, 1 day before expiry)
  - Bulk quote creation
  - Convert quote to order (1-click)

**Quote Statuses:**

- DRAFT: Not yet sent
- SENT: Sent to customer
- ACCEPTED: Customer approved
- REJECTED: Customer declined
- EXPIRED: 15-day validity passed

---

#### 5. **Suppliers** ✅ IMPLEMENTED

- **Path:** `/modules/suppliers`
- **Purpose:** Supplier data management, SKU mapping, price scraping, and alerts
- **Key Entities:** Supplier, SupplierProduct, SkuMapping, SupplierOrder
- **Dependencies:** None
- **Features:**
  - 5 suppliers (configurable)
  - Automated price scraping every 4 hours (06:00-22:00 UTC)
  - SKU mapping (Supplier SKU → Internal SKU)
  - Price change alerts (alert if change > 10%)
  - Supplier order placement tracking

**Scraping Schedule:**

- Runs every 4 hours
- Active window: 06:00 - 22:00 UTC
- Timeout: 30 seconds per supplier
- Max retries: 3

---

#### 6. **SmartBill Integration** ✅ IMPLEMENTED

- **Path:** `/modules/smartbill`
- **Purpose:** Romanian invoice generation and synchronization with SmartBill tax system
- **Key Entities:** SmartBillInvoice, SmartBillProforma
- **Dependencies:** Orders
- **Features:**
  - Invoice and proforma generation
  - VAT compliance (19% Romanian VAT)
  - Invoice series (FL = Factura Lunara/Monthly Invoice)
  - Sync every 15 minutes
  - Payment status tracking
  - Warehouse mappings

**Invoice Flow:**

```
Order PAID → Create SmartBill Invoice → Save reference → Update order status
```

---

#### 7. **WooCommerce Sync** ✅ IMPLEMENTED

- **Path:** `/modules/woocommerce-sync`
- **Purpose:** One-way sync of products, pricing, and inventory from Cypher to WooCommerce
- **Key Entities:** WooCommerceProduct, WooCommerceMapping
- **Dependencies:** Pricing Engine, Inventory
- **Features:**
  - Daily full sync at 03:00 UTC
  - Product attributes, pricing, stock sync
  - Category synchronization
  - Failed sync retry mechanism
  - Product mapping (Cypher SKU → WooCommerce ID)

**Sync Direction:** Cypher → WooCommerce (one-way only)

**Sync Schedule:**

- Full sync: Daily 03:00 UTC
- Incremental sync: Real-time on pricing/inventory changes
- Retry failed items: Daily 12:00 UTC

---

### 3.2 Additional Modules

| Module                   | Status         | Purpose                                                  |
| ------------------------ | -------------- | -------------------------------------------------------- |
| **Users**                | ✅ Implemented | User management, login, 2FA, RBAC                        |
| **B2B Portal**           | ✅ Implemented | Customer self-service, catalog, cart, checkout, invoices |
| **B2B Admin**            | ✅ Implemented | B2B portal administration                                |
| **B2B Auth**             | ✅ Implemented | B2B customer authentication                              |
| **Analytics**            | ✅ Implemented | Sales dashboards, KPIs, reporting                        |
| **Configurators**        | ✅ Implemented | Product configuration builder (LED lighting)             |
| **Notifications**        | ✅ Implemented | Email, SMS, in-app notifications                         |
| **Marketing**            | ✅ Implemented | Campaign management, email sequences                     |
| **WhatsApp**             | ✅ Implemented | Customer service via WhatsApp Business API               |
| **Banking**              | ✅ Implemented | Bank transaction management                              |
| **HR**                   | ✅ Implemented | Human resources module                                   |
| **Checkout**             | ✅ Implemented | Checkout flow management                                 |
| **Security**             | ✅ Implemented | Security module (2FA, audit, rate limiting)              |
| **SEO Automation**       | ✅ Implemented | Product meta tags, schema.org markup                     |
| **Google Shopping**      | ✅ Implemented | Google Shopping feed integration                         |
| **TikTok Marketing**     | ✅ Implemented | TikTok marketing integration                             |
| **Financial Accounting** | ✅ Implemented | Financial accounting and reporting                       |
| **Purchasing**           | ✅ Implemented | Purchase order management                                |
| **Workflow Engine**      | ✅ Implemented | Automated workflow orchestration                         |
| **AI Agents**            | ✅ Implemented | AI-powered automation agents                             |
| **AI Assistant**         | ✅ Implemented | AI assistant for customer support                        |
| **Scheduler**            | ✅ Implemented | Job scheduling and cron management                       |
| **Outbox Relay**         | ✅ Implemented | Transactional outbox pattern relay                       |
| **Settings**             | ✅ Implemented | System configuration management                          |

---

## 4. Data Flow Diagrams

### 4.1 Order Creation Flow (Happy Path)

```
Customer/Sales → POST /orders
                    ↓
          Order Validation
                    ↓
          Reserve Inventory (Inventory Module)
                    ↓
          Calculate Final Price (Pricing Module)
                    ↓
          Create Order Entity
                    ↓
          Save to PostgreSQL
                    ↓
          EventBus.publish('order.created', {orderId, ...})
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
SmartBill     WooCommerce      Notification
Create        Update Product   Send Email
Invoice       & Stock          to Customer
```

### 4.2 Pricing Calculation Flow

```
GET /pricing/:productId
        ↓
  Load Price from Cache (L1 Redis)
        ↓ (Cache Miss)
  Load from Database (L2 PostgreSQL)
        ↓
  Apply Tier Discount (based on customer tier)
        ↓
  Apply Volume Discount (based on quantity)
        ↓
  Apply Promotional Discount (if active)
        ↓
  Calculate Final Price with VAT
        ↓
  Store in Cache (expire in 1 hour)
        ↓
  Return to Client
```

### 4.3 Supplier Sync Flow

```
BullMQ Job Queue (every 4 hours)
        ↓
  For each of 5 suppliers:
    ↓
    Fetch supplier website (Puppeteer/Cheerio)
    ↓
    Extract SKU, price, availability
    ↓
    Map to internal SKU (SkuMapping)
    ↓
    Compare with DB price
    ↓ (if change > 10%)
    Create price change alert
    ↓
  Save to SupplierProduct table
```

### 4.4 Quote to Invoice Flow

```
1. Customer Requests Quote
   ↓
   Create Quotation (DRAFT) → Send to Customer (SENT)
   ↓
2. Customer Accepts Quote
   ↓
   Quotation status → ACCEPTED
   ↓
3. Sales Team Converts to Order
   ↓
   Create Order from Quotation
   ↓
   Order status → ORDER_CONFIRMED
   ↓
4. Order Fulfilled and Delivered
   ↓
   Order status → DELIVERED
   ↓
5. Create Invoice
   ↓
   SmartBill.createInvoice(order)
   ↓
   SmartBill validates VAT, generates invoice #
   ↓
   Save SmartBill reference to order
   ↓
6. Customer Pays
   ↓
   Order status → PAID
   ↓
   EventBus.publish('order.paid')
```

---

## 5. Event Bus Architecture

The EventBus is a Redis Pub/Sub wrapper that enables asynchronous, loosely-coupled communication between modules.

### 5.1 Event Types and Publishers

| Event                   | Publisher  | Subscribers                       | Payload                                   |
| ----------------------- | ---------- | --------------------------------- | ----------------------------------------- |
| `order.created`         | Orders     | SmartBill, WooCommerce, Inventory | orderId, customerId, items, totalPrice    |
| `order.confirmed`       | Orders     | SmartBill, Notifications          | orderId, customerEmail                    |
| `order.status_changed`  | Orders     | Notifications, Analytics          | orderId, oldStatus, newStatus             |
| `order.paid`            | Orders     | SmartBill, Notifications          | orderId, amount                           |
| `inventory.reserved`    | Inventory  | Orders                            | productId, quantity, orderId              |
| `inventory.low_stock`   | Inventory  | Notifications                     | productId, quantity, threshold            |
| `price.updated`         | Pricing    | WooCommerce, Cache invalidation   | productId, newPrice                       |
| `quotation.created`     | Quotations | Notifications                     | quotationId, customerId                   |
| `quotation.sent`        | Quotations | Notifications                     | quotationId, customerEmail                |
| `quotation.accepted`    | Quotations | Orders                            | quotationId                               |
| `supplier.price_change` | Suppliers  | Notifications                     | supplierId, productId, oldPrice, newPrice |

### 5.2 EventBus Implementation

**Location:** `/shared/utils/event-bus.ts`

**Usage:**

```typescript
// Publish an event
const eventBus = getEventBus();
await eventBus.publish('order.created', {
  orderId: 123,
  customerId: 456,
  totalPrice: 1500.0,
});

// Subscribe to events
await eventBus.subscribe('order.created', (event) => {
  console.log('Order created:', event);
  // Handle event...
});
```

**Guarantees:**

- ✅ Fire-and-forget delivery (no acknowledgment required)
- ✅ Multiple subscribers per event (fan-out)
- ✅ Automatic reconnection on Redis failure
- ✅ All subscribers receive all events (Redis Pub/Sub semantics)

**Limitations:**

- ❌ No message persistence after send (Pub/Sub only)
- ❌ No delivery guarantee if subscriber is offline
- ⚠️ For critical operations, use BullMQ queues instead

---

## 6. Security Architecture

> **Full documentation:** See [SECURITY.md](./SECURITY.md) for comprehensive security documentation.

### 6.1 Authentication & Authorization

**Middleware Stack:**

```
Request → RequestID → Tracing → Sanitization → AuditTrail → CSRF → RateLimit → Auth
```

**JWT + HttpOnly Cookie Authentication:**

- **Access Token:** 15 minutes (configurable via `JWT_ACCESS_TOKEN_EXPIRY`)
- **Refresh Token:** 7 days (configurable via `JWT_REFRESH_TOKEN_EXPIRY`)
- **Cookie-based:** HttpOnly, Secure (production), SameSite=Lax
- **Auto-refresh:** Transparent token renewal via refresh cookie in auth middleware
- **Backwards compat:** Authorization header still supported
- **Secret Rotation:** Change JWT_SECRET in production quarterly
- **Algorithms:** HS256 (HMAC)
- **2FA:** TOTP-based via `otplib` with backup codes (see SECURITY.md)

**Role-Based Access Control (RBAC):**

```typescript
enum Role {
  ADMIN = 'admin', // Full access
  SALES = 'sales', // Create orders, quotes
  WAREHOUSE = 'warehouse', // Inventory, packing
  FINANCE = 'finance', // Invoices, payments
  USER = 'user', // Read-only
}

// Applied at route level
router.post('/pricing/promotions', requireRole('admin'), controller.createPromotion);
```

### 6.2 CSRF Protection

**Enabled in production only:**

```typescript
const csrfEnabled = config.NODE_ENV === 'production';
app.use(createCSRFMiddleware({
  allowedOrigins: [...],
  enabled: csrfEnabled
}));
```

**Flow:**

1. Client requests CSRF token from POST /csrf-token
2. Client includes X-CSRF-Token header in subsequent requests
3. Middleware validates token matches session

### 6.3 Input Sanitization

**Middleware:** `/shared/middleware/sanitize.middleware.ts`

**Protections:**

- XSS prevention: Strip HTML tags from strings
- NoSQL injection: Validate query shapes
- SQL injection: Parameterized queries (TypeORM)
- Path traversal: Validate file paths

**Sanitized Fields:**

```typescript
// User input from req.body and req.query is sanitized
router.post('/orders', validateRequest(orderSchema), controller.createOrder);
```

### 6.4 Rate Limiting

**Configuration (per IP, via `express-rate-limit`):**

- **Global API:** 100 requests per 15 minutes (`/api/*`)
- **Login:** 5 attempts per 15 minutes (`/api/v1/users/login`)
- **2FA Auth:** 10 attempts per 15 minutes (`/api/v1/users/2fa/*`)
- **Write Operations:** 30 per minute (`/api/v1/orders/*`, `/api/v1/settings/*`)

**Standard headers enabled:** `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

```typescript
app.use('/api', globalApiLimiter); // 100/15min
app.use('/api/v1/users/login', loginLimiter); // 5/15min
app.use('/api/v1/users/2fa', authLimiter); // 10/15min
app.use('/api/v1/orders', writeOperationLimiter); // 30/min (writes only)
```

### 6.5 Audit Trail

**What's logged:**

- User ID, action, resource, timestamp
- Request ID for tracing
- Request/response payloads (sensitive fields redacted)
- Database query execution time
- Error stack traces

**Storage:** PostgreSQL `audit_trail` table (partitioned by date)

**Usage:**

```typescript
const auditLogger = createAuditLogger();
auditLogger.log({
  userId: user.id,
  action: 'CREATE_ORDER',
  resource: `order:${orderId}`,
  changes: { status: 'confirmed' },
  timestamp: new Date(),
});
```

### 6.6 Data Validation

**Joi schemas** for all input:

```typescript
const orderSchema = Joi.object({
  customerId: Joi.number().integer().required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.number().required(),
        quantity: Joi.number().positive().required(),
      }),
    )
    .required(),
});

router.post('/orders', validationMiddleware(orderSchema, 'body'), handler);
```

---

## 7. Scalability Architecture

### 7.1 Caching Layers (L1, L2, L3)

**L1: Application Cache (In-memory LRU)**

```typescript
// Location: /shared/cache/lru-cache.ts
// TTL: 5 minutes (configurable)
// Capacity: 1000 entries
// Use case: Price calculations, tier definitions

const cache = new LRUCache<number, Price>(1000, 5 * 60 * 1000);
cache.set(productId, priceObject);
```

**L2: Redis Cache**

```typescript
// TTL: 1 hour for prices, 24 hours for tier definitions
// Use case: Distributed caching across API instances
// Implementation: See /modules/pricing-engine/src/infrastructure/cache/

await redis.setex(`price:${productId}`, 3600, JSON.stringify(price));
const cached = await redis.get(`price:${productId}`);
```

**L3: PostgreSQL (Persistent)**

```typescript
// Native queries with indexes on frequently accessed fields
// Example indexes:
CREATE INDEX idx_price_sku ON price(sku);
CREATE INDEX idx_order_customer ON orders(customer_id);
CREATE INDEX idx_inventory_product ON stock(product_id, warehouse_id);
```

**Cache Invalidation Strategy:**

- **Time-based:** TTL expiration (automatic)
- **Event-based:** Clear cache on PRICE_UPDATED event
- **Manual:** Admin endpoint to force cache clear

### 7.2 Database Optimization

**Connection Pooling:**

```typescript
// Min 5, Max 20 connections
// Idle timeout: 30 seconds
// See /src/data-source.ts
```

**Query Optimization:**

- Eager loading relations: `.find({ relations: ['items', 'customer'] })`
- Select specific columns: `.select(['id', 'price', 'createdAt'])`
- Pagination: Use cursor pagination for large datasets (see SCALABILITY_GUIDE.md)

**Indexes for Common Queries:**

```sql
-- Pricing
CREATE INDEX idx_price_sku ON price(sku);
CREATE INDEX idx_price_category ON price(category_id);

-- Orders
CREATE INDEX idx_order_customer ON orders(customer_id);
CREATE INDEX idx_order_status ON orders(status);
CREATE INDEX idx_order_created_at ON orders(created_at DESC);

-- Inventory
CREATE INDEX idx_stock_product_warehouse ON stock(product_id, warehouse_id);
CREATE INDEX idx_stock_reserved ON stock(reserved_quantity);
```

### 7.3 Asynchronous Processing

**BullMQ Job Queues** for long-running tasks:

- PDF generation (quotes/proformas)
- Supplier scraping
- SmartBill sync
- WooCommerce sync
- Email/SMS sending

**Queue Configuration:**

```typescript
const queue = new Queue('supplier-sync', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: true,
  },
});
```

### 7.4 Load Balancing

**Recommended Setup (Production):**

```
                    [Load Balancer - Nginx]
                            ↓
                 ┌──────────┼──────────┐
                 ↓          ↓          ↓
            [API-1]     [API-2]    [API-3]
            Node.js     Node.js    Node.js
              20          20         20
            instances   instances  instances
                 ↓          ↓          ↓
                 └──────────┼──────────┘
                            ↓
              [PostgreSQL Primary (R/W)]
                            ↓
            ┌───────────────┴────────────────┐
            ↓                                ↓
    [Replica 1 (RO)]            [Replica 2 (RO)]
            ↓
    [Redis Cluster - 3 nodes]
```

---

## 8. Technology Stack

### 8.1 Runtime & Framework

| Technology | Version | Purpose            |
| ---------- | ------- | ------------------ |
| Node.js    | 20 LTS  | JavaScript runtime |
| TypeScript | 5.3+    | Type-safe language |
| Express.js | 4.18    | Web framework      |

### 8.2 Database & Cache

| Technology | Version | Purpose                |
| ---------- | ------- | ---------------------- |
| PostgreSQL | 15      | Relational database    |
| TypeORM    | 0.3.20  | ORM with migrations    |
| Redis      | 7       | Cache & pub/sub        |
| ioredis    | 5.3.2   | Redis client (pub/sub) |
| BullMQ     | 5.1.1   | Job queue              |

### 8.3 Authentication & Validation

| Technology   | Version | Purpose             |
| ------------ | ------- | ------------------- |
| jsonwebtoken | 9.0.2   | JWT tokens          |
| bcrypt       | 5.1.1   | Password hashing    |
| Joi          | 17.11.0 | Input validation    |
| otplib       | 12.0.1  | 2FA/TOTP generation |

### 8.4 Utilities & Middleware

| Technology  | Version | Purpose               |
| ----------- | ------- | --------------------- |
| helmet      | 7.1.0   | Security headers      |
| cors        | 2.8.5   | Cross-origin requests |
| compression | 1.7.4   | Gzip compression      |
| morgan      | 1.10.0  | HTTP logging          |
| winston     | 3.11.0  | Structured logging    |
| axios       | 1.6.5   | HTTP client           |
| uuid        | 9.0.0   | UUID generation       |
| date-fns    | 3.3.1   | Date formatting       |
| dotenv      | 16.3.1  | Environment variables |

### 8.5 Testing & Development

| Technology | Version | Purpose                |
| ---------- | ------- | ---------------------- |
| Jest       | 29.7.0  | Test framework         |
| ts-jest    | 29.1.2  | TypeScript in Jest     |
| Supertest  | 6.3.4   | HTTP assertion library |
| ESLint     | 8.56.0  | Code linting           |
| Prettier   | 3.2.4   | Code formatting        |

---

## 9. Directory Structure

```
cypher/
├── shared/                          # Cross-module utilities and types
│   ├── types/                       # TypeScript type definitions
│   │   ├── common.types.ts          # Base types (ID, Pagination)
│   │   ├── order.types.ts           # Order domain types
│   │   ├── pricing.types.ts         # Pricing domain types
│   │   ├── inventory.types.ts       # Stock domain types
│   │   ├── integration.types.ts     # SmartBill, WooCommerce types
│   │   └── ...
│   ├── interfaces/                  # Module contracts
│   │   ├── IPricingService.ts       # Pricing module interface
│   │   ├── IInventoryService.ts     # Inventory module interface
│   │   └── ...
│   ├── events/                      # Event definitions (not yet used)
│   ├── utils/                       # Shared utilities
│   │   ├── event-bus.ts             # Redis Pub/Sub wrapper
│   │   ├── logger.ts                # Winston logger
│   │   ├── circuit-breaker.ts       # Circuit breaker pattern
│   │   ├── feature-flags.ts         # Runtime feature toggles
│   │   ├── pagination.ts            # Cursor pagination helper
│   │   ├── audit-logger.ts          # Audit trail logging
│   │   ├── tracer.ts                # Distributed tracing (request ID)
│   │   ├── validator.ts             # Joi wrapper
│   │   └── response.ts              # Standardized response format
│   ├── constants/                   # Business constants
│   │   ├── pricing-tiers.ts         # Tier definitions, discount formulas
│   │   ├── order-statuses.ts        # Status enums + transitions
│   │   ├── error-codes.ts           # Error code constants
│   │   └── index.ts
│   ├── middleware/                  # Global Express middleware
│   │   ├── auth.middleware.ts       # JWT verification, RBAC
│   │   ├── csrf.middleware.ts       # CSRF token validation
│   │   ├── sanitize.middleware.ts   # Input sanitization
│   │   ├── audit-trail.middleware.ts # Request logging
│   │   ├── request-id.middleware.ts # X-Request-ID generation
│   │   ├── tracing.middleware.ts    # Distributed tracing
│   │   ├── metrics.middleware.ts    # Prometheus metrics
│   │   └── index.ts
│   ├── cache/                       # Cache implementations
│   │   ├── lru-cache.ts             # L1 in-memory cache
│   │   └── redis-pool.ts            # Redis connection pool
│   └── api/                         # Shared API utilities
│       └── rate-limiter.ts          # Rate limiting configuration
│
├── modules/                         # Business modules (hexagonal architecture)
│
│   ├── pricing-engine/              # ✅ Pricing calculations
│   │   ├── src/
│   │   │   ├── domain/              # Business logic layer
│   │   │   │   ├── entities/        # Price, Promotion, CustomerTier
│   │   │   │   ├── services/        # PriceCalculator, VolumeDiscountCalculator
│   │   │   │   ├── repositories/    # Port interfaces: IPriceRepository
│   │   │   │   └── errors/          # Domain errors
│   │   │   ├── application/         # Use-case layer
│   │   │   │   ├── use-cases/       # CalculatePrice, ManageTiers, etc.
│   │   │   │   ├── dtos/            # Request/response DTOs
│   │   │   │   ├── ports/           # Application port interfaces
│   │   │   │   └── errors/          # Application errors
│   │   │   ├── infrastructure/      # Implementation layer
│   │   │   │   ├── entities/        # TypeORM entities (PriceEntity)
│   │   │   │   ├── repositories/    # TypeOrmPriceRepository
│   │   │   │   ├── cache/           # PriceCache
│   │   │   │   ├── api/             # Controllers, validators, routes
│   │   │   │   └── composition-root.ts  # DI factory
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit & integration tests
│   │   └── package.json
│   │
│   ├── inventory/                   # ✅ Stock management
│   ├── orders/                      # ✅ Order lifecycle
│   ├── quotations/                  # ✅ Quote generation & tracking
│   ├── suppliers/                   # ✅ Supplier data & scraping
│   ├── smartbill/                   # ✅ Invoice generation
│   ├── woocommerce-sync/            # ✅ E-commerce sync
│   │
│   ├── analytics/                   # 📋 Planned: Dashboards & metrics
│   ├── b2b-portal/                  # 📋 Planned: Customer portal
│   ├── configurators/               # 📋 Planned: Product builder
│   ├── marketing/                   # 📋 Planned: Campaigns & emails
│   ├── notifications/               # 📋 Planned: Alerts & reminders
│   ├── seo-automation/              # 📋 Planned: Meta tags
│   └── whatsapp/                    # 📋 Planned: WhatsApp chatbot
│
├── src/                             # Application bootstrap
│   ├── server.ts                    # Express app setup & route registration
│   ├── data-source.ts               # TypeORM configuration
│   ├── config/                      # Environment validation
│   │   └── env.validation.ts        # Joi schema for env vars
│   ├── middleware/                  # App-level middleware
│   │   └── rate-limiter.ts          # Rate limiter setup
│   ├── api-docs/                    # OpenAPI documentation
│   │   ├── schemas/                 # OpenAPI component schemas
│   │   └── routes.ts                # Swagger endpoint
│   └── subscribers/                 # TypeORM event subscribers (if used)
│
├── database/                        # Database schema & migrations
│   ├── migrations/                  # TypeORM migration files
│   │   ├── 001_InitialSchema.ts
│   │   ├── 002_AddPricingTables.ts
│   │   └── ...
│   ├── seeds/                       # Test data
│   │   └── index.ts
│   └── schema.sql                   # Full schema for reference
│
├── infrastructure/                  # Deployment & infrastructure
│   ├── docker/                      # Docker configurations
│   │   ├── Dockerfile.dev           # Development image
│   │   ├── Dockerfile.prod          # Production image
│   │   └── entrypoint.sh
│   ├── nginx/                       # Nginx reverse proxy config
│   ├── scripts/                     # DevOps scripts
│   │   ├── backup-db.sh
│   │   ├── restore-db.sh
│   │   └── health-check.sh
│   └── k8s/                         # Kubernetes manifests (optional)
│
├── tests/                           # Test files (mirroring module structure)
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── e2e/                         # End-to-end tests (optional)
│
├── docs/                            # Documentation (this folder)
│   ├── ARCHITECTURE.md              # System architecture (you are here)
│   ├── MODULE_CREATION_GUIDE.md     # Adding new modules
│   ├── API_REFERENCE.md             # Endpoint documentation
│   ├── DEPLOYMENT_GUIDE.md          # Deployment instructions
│   ├── SCALABILITY_GUIDE.md         # Performance optimization
│   ├── BUSINESS_RULES.md            # Business logic documentation
│   └── CHANGELOG.md                 # Release notes
│
├── .env.example                     # Environment variables template
├── docker-compose.yml               # Local development stack
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── jest.config.ts                   # Test configuration
├── .eslintrc.json                   # Linting rules
├── .prettierrc                      # Code formatting rules
└── README.md                        # Quick start guide
```

---

## 10. Deployment Overview

### 10.1 Development Environment

```bash
docker compose up -d                # Start PostgreSQL, Redis
npm install                         # Install dependencies
npm run migration:run                # Run database migrations
npm run dev                         # Start dev server (hot reload)
```

### 10.2 Production Environment

```bash
npm install --production            # Production dependencies only
npm run build                       # Compile TypeScript
npm run migration:run                # Run any pending migrations
NODE_ENV=production npm start       # Start server
```

### 10.3 Infrastructure Requirements

**Minimum:**

- 2 CPU cores
- 4 GB RAM (Node.js process + PostgreSQL + Redis)
- 50 GB SSD (database)

**Recommended (100K products, 500+ customers):**

- 4+ CPU cores
- 8-16 GB RAM
- 200 GB SSD
- PostgreSQL read replicas
- Redis cluster (3+ nodes)

---

## 11. Monitoring & Observability

### 11.1 Health Checks

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-02-07T10:30:00Z",
  "environment": "production"
}
```

**Checked by:** Docker health probes, load balancers

### 11.2 Metrics (Prometheus)

**Exposed at:** `GET /metrics`

**Collected:**

- HTTP request rate, latency, status codes
- Database connection pool usage
- Redis connection status
- Job queue depth and processing time
- Cache hit/miss rates

### 11.3 Logging

**Format:** Structured JSON (Winston)

**Levels:** debug, info, warn, error

**Destinations:**

- Console (development)
- File (production)
- Log aggregation service (recommended: ELK, Datadog, etc.)

### 11.4 Distributed Tracing

**Mechanism:** X-Request-ID header

**Flow:**

1. Request enters API with unique request ID
2. All downstream services include request ID in logs
3. Can trace request through entire system

---

## 12. Key Diagrams

### 12.1 Hexagonal Architecture Pattern

```
        [API Controllers]
               ↑
        [Use-Case Layer]
               ↑
     [Domain Business Logic]
     ↓                       ↓
[Database Port]      [Cache Port]
     ↓                       ↓
[TypeORM Impl]       [Redis Impl]
```

### 12.2 Module Dependencies

```
[Orders] ← depends on ← [Pricing]
   ↓                        ↑
   ↓                        ↓
[Inventory]           [Quotations]
   ↓
   ↓
[SmartBill] ← Sync ← [WooCommerce]
             ← Scrape ← [Suppliers]
```

### 12.3 Request Processing Pipeline

```
Request
  ↓
[RequestID Middleware]      → Add X-Request-ID header
  ↓
[Tracing Middleware]        → Start span
  ↓
[Sanitization Middleware]   → Clean input
  ↓
[CSRF Middleware]           → Validate token (prod only)
  ↓
[Rate Limit Middleware]     → Check limits
  ↓
[Auth Middleware]           → Verify JWT, validate role
  ↓
[Audit Middleware]          → Log request
  ↓
[Route Handler]             → Execute business logic
  ↓
[Error Handler]             → Format error response
  ↓
Response
```

---

## 13. Next Steps & Roadmap

### 13.1 Short Term (Next Sprint)

- [ ] Implement Analytics module (dashboards)
- [ ] Add B2B portal (customer self-service)
- [ ] Deploy to staging environment

### 13.2 Medium Term (Q2 2025)

- [ ] Add product configurator (LED kits)
- [ ] Implement WhatsApp bot
- [ ] Set up PostgreSQL read replicas

### 13.3 Long Term (Q3-Q4 2025)

- [ ] Redis cluster for redundancy
- [ ] Machine learning pricing optimization
- [ ] Customer behavior analytics
- [ ] Kubernetes deployment

---

## 14. References & Further Reading

- **REST API Design:** See API_REFERENCE.md
- **Adding New Modules:** See MODULE_CREATION_GUIDE.md
- **Business Rules:** See BUSINESS_RULES.md
- **Performance:** See SCALABILITY_GUIDE.md
- **Deployment:** See DEPLOYMENT_GUIDE.md
- **TypeORM:** https://typeorm.io/
- **Redis Pub/Sub:** https://redis.io/docs/manual/pubsub/
- **BullMQ:** https://docs.bullmq.io/
- **Express.js:** https://expressjs.com/

---

**Document Version:** 0.2.0
**Last Updated:** February 2026
**Maintained By:** Development Team
**Review Cycle:** Quarterly
