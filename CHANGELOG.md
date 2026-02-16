# Changelog

All notable changes to CYPHER ERP are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - develop branch

### Added
- Comprehensive enterprise documentation (7 guides totaling 50+ pages)
- ARCHITECTURE.md: Complete system design, module map, data flows
- MODULE_CREATION_GUIDE.md: Step-by-step guide for adding new modules
- API_REFERENCE.md: Full REST API documentation (50+ endpoints)
- DEPLOYMENT_GUIDE.md: Production deployment procedures
- SCALABILITY_GUIDE.md: Performance optimization strategies
- BUSINESS_RULES.md: Complete business logic documentation
- CHANGELOG.md: Release history tracking

### Planned
- Analytics module: Sales dashboards, KPIs, reporting
- B2B Portal: Customer self-service quotation system
- Product Configurators: LED kit builder for custom configurations
- WhatsApp Bot: Customer service via WhatsApp Business API
- Email Notifications: SendGrid integration for automated alerts
- SEO Automation: Dynamic meta tags and schema.org markup

---

## [0.1.0] - 2025-02-07

### Major Features

#### ✅ Pricing Engine
- Dynamic pricing calculations with customer tiers
- Volume discount engine (10-49 units: 2%, 50-99: 5%, 100+: 8%)
- 4-tier customer pricing system (Standard, Tier1-5%, Tier2-10%, Tier3-15%)
- Minimum margin validation (30% floor)
- Promotional discount system with date ranges
- Caching layer for performance (L1 in-memory + L2 Redis)
- 6 API endpoints documented

#### ✅ Inventory Management
- Multi-warehouse stock tracking (3 warehouses with priority-based allocation)
- Stock reservation system to prevent overselling
- Low-stock alerts (threshold: 3 units)
- Stock movement history tracking (additions, reservations, shipments)
- Backorder management (10-day default)
- Warehouse capacity management
- 11 API endpoints

#### ✅ Orders
- 14-status order lifecycle with state machine validation
- Order creation with automatic inventory reservation
- Partial delivery tracking for split shipments
- Order cancellation with inventory rollback
- Proforma invoice generation
- Status history audit trail
- 10 API endpoints

#### ✅ Quotations
- 15-day quote validity with auto-expiry
- Automated reminder emails (7 days, 1 day, expiry)
- Quote to order conversion (1-click)
- PDF generation with company branding
- 5 quotation statuses (Draft, Sent, Accepted, Rejected, Expired)
- Cursor pagination for large result sets
- 8 API endpoints

#### ✅ Suppliers
- Supplier catalog management
- Automated price scraping (every 4 hours, 06:00-22:00 UTC)
- Price change alerts (>10% change detected)
- SKU mapping (supplier SKU ↔ internal SKU)
- Supplier order tracking
- Unmapped product detection
- 10 API endpoints

#### ✅ SmartBill Integration
- Automatic invoice creation (when order delivered)
- 19% VAT compliance for Romania
- 15-minute sync schedule
- Invoice series management (FL = monthly)
- Payment status tracking
- Warehouse mapping support
- 7 API endpoints

#### ✅ WooCommerce Sync
- One-way synchronization (CYPHER → WooCommerce)
- Daily full sync at 03:00 UTC
- Real-time incremental sync on price/stock changes
- Product attributes sync (name, description, price, stock, categories)
- Order pulling from WooCommerce
- Failed sync retry mechanism
- 10 API endpoints

### Technical Architecture

#### Core Infrastructure
- **Runtime:** Node.js 20 LTS + TypeScript 5.3
- **Framework:** Express.js 4.18 with helmet, CORS, compression
- **Database:** PostgreSQL 15 with TypeORM 0.3
- **Cache:** Redis 7 (Pub/Sub + caching)
- **Queue:** BullMQ 5.1 for async jobs

#### Hexagonal Architecture
- Domain layer: Pure business logic, domain entities, services
- Application layer: Use-cases, DTOs, ports/interfaces
- Infrastructure layer: TypeORM entities, repositories, controllers, API

#### Security
- JWT authentication (24h token, 7d refresh)
- Role-based access control (admin, sales, warehouse, finance, user)
- CSRF protection (enabled in production)
- Input sanitization and XSS prevention
- Rate limiting (1000 req/hour general, 100 req/hour auth)
- Audit trail logging of all user actions
- Request ID tracking for distributed tracing

#### Performance
- Connection pooling (5-20 PostgreSQL connections)
- 3-layer caching (L1 in-memory, L2 Redis, L3 PostgreSQL)
- Cursor pagination for large datasets
- Batch processing for bulk operations
- Circuit breaker pattern for external APIs
- Feature flags for safe rollouts

#### Monitoring & Observability
- Health check endpoint (/health)
- Prometheus metrics (/metrics)
- Structured logging with Winston
- Request tracing with X-Request-ID header
- Error reporting and stack traces

### Database Schema

#### Core Tables
- `prices` - Product pricing with costs and margins
- `orders` - Orders with 14-status lifecycle
- `order_items` - Line items for orders
- `stock` - Inventory levels per product/warehouse
- `stock_movements` - Audit trail of stock changes
- `stock_reservations` - Reservations for pending orders
- `stock_alerts` - Low-stock notifications
- `quotations` - Quotation records
- `quotation_items` - Quotation line items
- `customers` - Customer information and tiers
- `suppliers` - Supplier information
- `supplier_products` - Supplier product catalog
- `sku_mappings` - Supplier SKU → internal SKU mappings
- `smartbill_invoices` - SmartBill invoice references
- `woocommerce_mappings` - WooCommerce product mappings
- `audit_trail` - Complete audit log

#### Indexes (45+ for performance)
- `idx_order_customer_id` - Order lookup by customer
- `idx_order_status` - Status-based filtering
- `idx_stock_product_warehouse` - Inventory lookup
- `idx_price_sku` - Price lookup by SKU
- And 41 more covering common queries

### API Endpoints (53 total)

**Pricing:** 6 endpoints
- GET /api/v1/pricing/:productId
- POST /api/v1/pricing/calculate
- GET /api/v1/pricing/:productId/tiers
- POST /api/v1/pricing/promotions
- GET /api/v1/pricing/promotions
- DELETE /api/v1/pricing/promotions/:id

**Inventory:** 11 endpoints
- GET /api/v1/inventory/:productId
- POST /api/v1/inventory/check
- GET /api/v1/inventory/:productId/movements
- POST /api/v1/inventory/reserve
- DELETE /api/v1/inventory/reservations/:id
- POST /api/v1/inventory/adjust
- GET /api/v1/inventory/alerts
- POST /api/v1/inventory/alerts/:id/acknowledge
- GET /api/v1/inventory/warehouses
- POST /api/v1/inventory/sync/smartbill
- POST /api/v1/inventory/sync/suppliers

**Orders:** 10 endpoints
- POST /api/v1/orders
- GET /api/v1/orders
- GET /api/v1/orders/:id
- GET /api/v1/orders/number/:orderNumber
- PATCH /api/v1/orders/:id/status
- POST /api/v1/orders/:id/partial-delivery
- POST /api/v1/orders/:id/cancel
- POST /api/v1/orders/:id/proforma
- GET /api/v1/orders/:id/status-history
- GET /api/v1/orders/customer/:customerId

**Quotations:** 8 endpoints
- POST /api/v1/quotations/quotes
- GET /api/v1/quotations/quotes
- GET /api/v1/quotations/quotes/:id
- POST /api/v1/quotations/quotes/:id/send
- POST /api/v1/quotations/quotes/:id/accept
- POST /api/v1/quotations/quotes/:id/reject
- POST /api/v1/quotations/quotes/:id/convert
- GET /api/v1/quotations/quotes/:id/pdf

**SmartBill:** 7 endpoints
- POST /api/v1/smartbill/invoices
- POST /api/v1/smartbill/proformas
- GET /api/v1/smartbill/invoices/:id
- GET /api/v1/smartbill/proformas/:id
- POST /api/v1/smartbill/sync-stock
- GET /api/v1/smartbill/warehouses
- GET /api/v1/smartbill/invoices/:invoiceId/status
- POST /api/v1/smartbill/invoices/:invoiceId/paid

**Suppliers:** 10 endpoints
- GET /api/v1/suppliers/suppliers
- GET /api/v1/suppliers/suppliers/:id
- GET /api/v1/suppliers/suppliers/:id/products
- POST /api/v1/suppliers/suppliers/:id/sync
- POST /api/v1/suppliers/suppliers/sync-all
- GET /api/v1/suppliers/suppliers/:id/statistics
- GET /api/v1/suppliers/suppliers/:id/sku-mappings
- POST /api/v1/suppliers/suppliers/:id/sku-mappings
- DELETE /api/v1/suppliers/sku-mappings/:mappingId
- GET /api/v1/suppliers/suppliers/:id/unmapped-products

**WooCommerce:** 10 endpoints
- POST /api/v1/woocommerce/sync/product/:productId
- POST /api/v1/woocommerce/sync/all
- POST /api/v1/woocommerce/sync/stock/:productId
- POST /api/v1/woocommerce/sync/price/:productId
- POST /api/v1/woocommerce/sync/categories
- POST /api/v1/woocommerce/pull/orders
- GET /api/v1/woocommerce/sync/status
- GET /api/v1/woocommerce/sync/failed
- POST /api/v1/woocommerce/sync/retry
- GET /api/v1/woocommerce/mappings/:productId

**System:** 3 endpoints
- GET /health
- GET /metrics
- OpenAPI documentation

### Testing

#### Test Coverage
- **35+ use-case tests** covering all business logic
- **3 integration tests** for critical workflows:
  - Order → Inventory → SmartBill flow
  - Pricing → WooCommerce flow
  - Pricing → Quotation → Order flow
- Unit tests for domain entities and services
- Controller tests for HTTP layer

#### Test Scenarios
- Pricing calculations with all discount combinations
- Order state machine transitions
- Inventory reservation and allocation
- Multi-warehouse fulfillment
- Quotation auto-expiry
- Supplier price change detection
- SmartBill invoice creation

### Documentation

#### Code-Level
- JSDoc comments on all public methods
- Type definitions for all domain models
- Inline comments for complex algorithms
- Architecture diagrams in comments

#### Developer Guides
- Quick start guide (README.md)
- Complete architecture documentation
- Module creation guide with examples
- API reference with curl examples
- Deployment procedures
- Scalability strategies
- Business rules reference

### DevOps & Infrastructure

#### Docker Support
- Development image (Dockerfile.dev)
- Production image (Dockerfile.prod, multi-stage)
- docker-compose.yml with PostgreSQL, Redis, API

#### Database Migrations
- TypeORM migration system
- Automatic schema versioning
- Rollback support
- Seed data for testing

#### Environment Configuration
- .env.example with all variables documented
- Environment validation on startup
- Support for multiple environments (dev, staging, prod)

#### Monitoring & Logging
- Winston structured logging (JSON format)
- Request-level logging with user/action
- Error stack traces
- Performance metrics collection

### Known Issues & Limitations

1. **Module 2-7 Status:** Currently in development, 7 more modules planned
2. **WooCommerce Sync:** One-way only (CYPHER → WC), not bidirectional
3. **No Real-time WebSocket:** Uses polling, not WebSocket for updates
4. **Manual Order Pulling:** WooCommerce orders require manual trigger, not automatic
5. **Pricing:** Standard customer gets 0% discount (no baseline discount)

### Breaking Changes
None (initial release v0.1.0)

### Dependencies

**Production (16 packages):**
- express 4.18.2
- typeorm 0.3.20
- pg 8.11.3 (PostgreSQL driver)
- redis 4.6.12
- bullmq 5.1.1 (Job queue)
- ioredis 5.3.2 (Redis client)
- joi 17.11.0 (Validation)
- jsonwebtoken 9.0.2
- bcrypt 5.1.1
- winston 3.11.0 (Logging)
- axios 1.6.5 (HTTP client)
- uuid 9.0.0
- date-fns 3.3.1
- dotenv 16.3.1
- helmet 7.1.0 (Security headers)
- cors 2.8.5
- compression 1.7.4
- morgan 1.10.0 (HTTP logging)

**Development (14 packages):**
- typescript 5.3.3
- ts-node 10.9.2
- ts-node-dev 2.0.0
- jest 29.7.0 (Testing)
- ts-jest 29.1.2
- supertest 6.3.4 (HTTP testing)
- eslint 8.56.0
- prettier 3.2.4
- And type definitions (@types/*)

### Contributors

- Development Team (CYPHER ERP)
- Claude AI (Documentation & architecture)

### License

Proprietary - Ledux.ro. All rights reserved.

---

## Previous Versions

### [Initial Setup] - 2025-01-15

- Project initialization
- Basic Express server
- Database schema design
- Initial module structures

---

**Changelog Format:**
- Uses [Keep a Changelog](https://keepachangelog.com/) format
- Semantic versioning: MAJOR.MINOR.PATCH
- Sections: Added, Changed, Deprecated, Removed, Fixed, Security
- Commit hash: Included for traceability
- Date: ISO 8601 format (YYYY-MM-DD)

**Next Review:** 2025-03-07 (Monthly)
**Maintainer:** Development Team
**Last Updated:** 2025-02-07

