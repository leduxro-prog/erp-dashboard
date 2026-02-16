# Handoff Package - Data/DB (AI 2)
**Cypher ERP - B2B Module**
**Version:** 1.0
**Date:** 2026-02-13

---

## 1. Overview

Acest document servește ca handoff complet de la AI 2 (Data/DB) către celelalte echipe. Include toate informațiile necesare pentru integrarea cu schema de date definită.

### 1.1 Status Handoff

| Team | Handoff Date | Status | Owner |
|------|--------------|--------|-------|
| AI 1 (Infrastructure) | TBD | ⏳ Pending | TBD |
| AI 3 (Events) | TBD | ⏳ Pending | TBD |
| AI 6 (Pricing) | TBD | ⏳ Pending | TBD |
| AI 7 (Checkout) | TBD | ⏳ Pending | TBD |
| AI 8 (Credit) | TBD | ⏳ Pending | TBD |
| AI 9 (Catalog/Search) | TBD | ⏳ Pending | TBD |

---

## 2. Database Information

### 2.1 Connection Details

| Parametru | Valoare |
|-----------|---------|
| Database Name | `cypher_erp` |
| Host | TBD |
| Port | 5432 |
| Version | PostgreSQL 15+ |
| Extensions | `uuid-ossp`, `pgcrypto` |

### 2.2 Schemas

| Schema | Descriere | Owner | Access Role |
|--------|-----------|-------|-------------|
| `b2b` | Toate tabelele B2B | AI 2 | `b2b_rw` |
| `erp` | Tabele ERP existente | ERP Team | `erp_rw` |
| `shared` | Outbox, observability | AI 2 / AI 3 | ALL (READ) |

### 2.3 Environment Variables

```bash
# Database connection
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=cypher_erp
DB_USER=b2b_app       # sau erp_app, report_app
DB_PASSWORD=***

# Schema access
DB_SCHEMA=b2b         # sau erp, shared

# Connection pool
DB_POOL_MIN=5
DB_POOL_MAX=20
```

---

## 3. Handoff pentru AI 1 (Infrastructure)

### 3.1 Schema Names

Schemele definite sunt:
- `b2b` - B2B module
- `erp` - ERP module
- `shared` - Shared resources

### 3.2 DB Environment Setup

1. **Create database:**
```sql
CREATE DATABASE cypher_erp;
```

2. **Run migrations in order:**
```bash
# Set up roles and schemas
psql -d cypher_erp -f migrations/0001-roles-and-schemas.sql

# Create core tables
psql -d cypher_erp -f migrations/0002-catalog-customers-pricing-stock.sql
psql -d cypher_erp -f migrations/0003-cart-orders-snapshots.sql
psql -d cypher-erp -f migrations/0004-credit-accounts-ledger.sql
psql -d cypher-erp -f migrations/0005-outbox-events.sql
psql -d cypher-erp -f migrations/0006-indexing-partitioning-retention.sql
```

3. **Configure connections:**
   - B2B app: `b2b_app` role, schema `b2b`
   - ERP app: `erp_app` role, schema `erp`
   - Reporting: `report_app` role, read-only views

### 3.3 Migration Rollout Procedure

1. **Pre-deploy:**
   ```bash
   # Backup
   pg_dump -d cypher_erp > backup_pre_migration.sql

   # Test migration on staging
   ```

2. **Deploy:**
   ```bash
   # Apply migration
   psql -d cypher_erp -f migrations/{version}.sql

   # Verify
   psql -d cypher_erp -f db/benchmarks/critical-queries.sql
   ```

3. **Post-deploy:**
   ```bash
   # Update stats
   psql -d cypher_erp -c "ANALYZE;"

   # Monitor logs
   ```

4. **Rollback if needed:**
   ```bash
   # Extract DOWN script
   psql -d cypher_erp -f migrations/{version}-down.sql
   ```

### 3.4 Connection Pooling

Se recomandă PgBouncer:

```ini
[databases]
cypher_erp = host=localhost port=5432 dbname=cypher_erp

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

---

## 4. Handoff pentru AI 3 (Events)

### 4.1 Outbox Structure

**Tabel:** `shared.outbox_events`

```sql
CREATE TABLE shared.outbox_events (
    id UUID PRIMARY KEY,
    event_id UUID UNIQUE NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_domain shared_event_domain NOT NULL,
    source_service VARCHAR(100) NOT NULL,
    source_entity_type VARCHAR(100),
    source_entity_id UUID,
    correlation_id VARCHAR(255),
    causation_id UUID,
    parent_event_id UUID,
    payload JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    priority shared_event_priority NOT NULL DEFAULT 'normal',
    status shared_outbox_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    error_message TEXT,
    ...
);
```

### 4.2 Idempotency Keys

**Tabel:** `shared.processed_events`

```sql
CREATE TABLE shared.processed_events (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    consumer_name VARCHAR(255) NOT NULL,  -- Unique per consumer
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ...
    CONSTRAINT uq_processed_events UNIQUE (consumer_name, event_id)
);
```

**Idempotency check:**
```sql
SELECT * FROM shared.is_event_processed(event_id, consumer_name);
```

**Record processing:**
```sql
SELECT * FROM shared.record_event_processing(
    p_event_id, p_event_type, p_consumer_name,
    p_status, p_result, p_output, p_error_message, ...
);
```

### 4.3 Event Metadata Fields

| Field | Tip | Descriere |
|-------|-----|-----------|
| `event_id` | UUID | ID unic eveniment |
| `event_type` | VARCHAR | Tip eveniment (e.g., `order.created`) |
| `event_domain` | ENUM | Domeniu: catalog, customer, order, etc. |
| `correlation_id` | VARCHAR | ID corelație pentru tranzacții |
| `causation_id` | UUID | ID eveniment cauzal |
| `parent_event_id` | UUID | ID eveniment părinte |
| `payload` | JSONB | Payload eveniment |
| `metadata` | JSONB | Metadate suplimentare |
| `priority` | ENUM | Prioritate: low, normal, high, critical |

### 4.4 Event Domains

```sql
CREATE TYPE shared_event_domain AS ENUM (
    'catalog',      -- Product-related events
    'customer',     -- Customer-related events
    'order',        -- Order-related events
    'payment',      -- Payment-related events
    'credit',       -- Credit-related events
    'inventory',    -- Inventory-related events
    'shipping',     -- Shipping-related events
    'notification', -- Notification events
    'system'        -- System events
);
```

### 4.5 Helper Functions

**Get next batch of events:**
```sql
SELECT * FROM shared.get_next_events(
    p_consumer_name => 'b2b_order_handler',
    p_batch_size => 10,
    p_max_attempts => 3
);
```

**Mark events as processing:**
```sql
SELECT shared.mark_events_processing(ARRAY[uuid1, uuid2, ...]);
```

**Mark events as published:**
```sql
SELECT shared.mark_events_published(ARRAY[uuid1, uuid2, ...]);
```

**Mark events as failed:**
```sql
SELECT shared.mark_events_failed(
    ARRAY[uuid1, uuid2],
    'Connection timeout',
    'TIMEOUT',
    60000
);
```

---

## 5. Handoff pentru AI 6 (Pricing)

### 5.1 Tabele Contract

#### `b2b.price_books`
Cărți de preț pentru diferite segmenturi de clienți.

```sql
CREATE TABLE b2b.price_books (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,
    applicable_tier b2b_customer_tier,
    ...
);
```

#### `b2b.price_book_entries`
Prețuri individuale în cărți de preț.

```sql
CREATE TABLE b2b.price_book_entries (
    id UUID PRIMARY KEY,
    price_book_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID,
    price NUMERIC(18,4) NOT NULL CHECK (price >= 0),
    currency CHAR(3) NOT NULL,
    price_type b2b_price_type NOT NULL DEFAULT 'list',
    discount_percent NUMERIC(5,2),
    discount_fixed NUMERIC(18,4),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,
    ...
    CONSTRAINT uq_price_entries UNIQUE (price_book_id, product_id, variant_id, valid_from)
);
```

### 5.2 Price Types

```sql
CREATE TYPE b2b_price_type AS ENUM (
    'list',          -- Standard list price
    'net',           -- Net price (after discount)
    'promotion',     -- Promotional price
    'special',       -- Special/custom price
    'cost'           -- Cost price (internal)
);
```

### 5.3 Constrângeri Financiare

1. **Prețuri pozitive:** `CHECK (price >= 0)`
2. **Valabilitate:** `CHECK (valid_to IS NULL OR valid_to > valid_from)`
3. **Unicitate:** `(price_book_id, product_id, variant_id, valid_from)`

### 5.4 Query pentru Preț Curent

```sql
-- Get current price for a product in a price book
SELECT pbe.price, pbe.currency, pbe.discount_percent
FROM b2b.price_book_entries pbe
WHERE pbe.price_book_id = ?
  AND pbe.product_id = ?
  AND pbe.valid_from <= NOW()
  AND (pbe.valid_to IS NULL OR pbe.valid_to > NOW())
ORDER BY pbe.valid_from DESC
LIMIT 1;
```

---

## 6. Handoff pentru AI 7 (Checkout)

### 6.1 Tabele Contract

#### `b2b.carts`
Coșuri de cumpărături.

```sql
CREATE TABLE b2b.carts (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    status b2b_cart_status NOT NULL DEFAULT 'active',
    is_default BOOLEAN NOT NULL DEFAULT true,
    items_count INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    price_book_id UUID,
    ...
    CONSTRAINT uq_carts_default_customer UNIQUE (customer_id) WHERE is_default = true
);
```

#### `b2b.cart_items`
Itemi în coș.

```sql
CREATE TABLE b2b.cart_items (
    id UUID PRIMARY KEY,
    cart_id UUID NOT NULL,
    product_id UUID NOT NULL,
    unit_price NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    tax_rate NUMERIC(5,4) NOT NULL,
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(18,4) NOT NULL,
    ...
);
```

#### `b2b.orders`
Comenzi.

```sql
CREATE TABLE b2b.orders (
    id UUID PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    source_type VARCHAR(50) NOT NULL,  -- cart, quote, manual, api
    source_id UUID,
    correlation_id VARCHAR(255) UNIQUE,
    status b2b_order_status NOT NULL DEFAULT 'pending',
    total_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    price_book_id UUID,
    credit_account_id UUID,
    credit_amount_reserved NUMERIC(18,4) NOT NULL DEFAULT 0,
    ...
);
```

### 6.2 Order Status Flow

```sql
CREATE TYPE b2b_order_status AS ENUM (
    'pending',              -- Awaiting processing
    'confirmed',            -- Stock reserved, order confirmed
    'processing',           -- Being picked/packed
    'ready_to_ship',        -- Ready for handover to carrier
    'shipped',              -- In transit
    'delivered',            -- Delivered to customer
    'cancelled',            -- Cancelled by customer/system
    'refunded',             -- Fully refunded
    'partially_refunded',   -- Partial refund processed
    'returned',             -- Goods returned
    'on_hold'               -- On hold (payment issue, etc.)
);
```

### 6.3 Snapshot Tables

#### `b2b.order_items_snapshot`

```sql
CREATE TABLE b2b.order_items_snapshot (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    unit_price NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL,
    tax_rate NUMERIC(5,4) NOT NULL,
    tax_amount NUMERIC(18,4) NOT NULL,
    discount_percent NUMERIC(5,2),
    discount_fixed NUMERIC(18,4),
    discount_amount NUMERIC(18,4) NOT NULL,
    quantity BIGINT NOT NULL,
    stock_available BIGINT,
    stock_reserved BIGINT,
    stock_status b2b_stock_level_status,
    price_book_id UUID,
    subtotal NUMERIC(18,4) NOT NULL,
    line_total NUMERIC(18,4) NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ...
);
```

**IMPORTANT:** Snapshot-ul obligatoriu la confirmarea comenzii!

### 6.4 Flux Tranzacțional

Checkout/order într-o tranzacție unică pentru scrierile financiare:

```sql
BEGIN;

-- 1. Create order from cart
INSERT INTO b2b.orders (...)
VALUES (...);

-- 2. Reserve credit
INSERT INTO b2b.credit_ledger (...)
VALUES (entry_type => 'reserve', ...);

-- 3. Reserve stock
UPDATE b2b.stock_levels SET quantity_reserved = quantity_reserved + ? WHERE ...;

-- 4. Create order items snapshot
INSERT INTO b2b.order_items_snapshot (...)
VALUES (...);

-- 5. Create outbox event
INSERT INTO shared.outbox_events (...)
VALUES (event_type => 'order.created', ...);

-- 6. Mark cart as converted
UPDATE b2b.carts SET status = 'converted' WHERE id = ?;

COMMIT;
```

---

## 7. Handoff pentru AI 8 (Credit)

### 7.1 Tabele Contract

#### `b2b.credit_accounts`

```sql
CREATE TABLE b2b.credit_accounts (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL UNIQUE,
    account_number VARCHAR(50) NOT NULL UNIQUE,
    credit_limit NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    current_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
    available_credit NUMERIC(18,4) NOT NULL DEFAULT 0,
    reserved_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    status b2b_credit_status NOT NULL DEFAULT 'pending',
    payment_terms VARCHAR(50) NOT NULL DEFAULT 'net30',
    ...
);
```

#### `b2b.credit_ledger` (APPEND-ONLY)

```sql
CREATE TABLE b2b.credit_ledger (
    id UUID PRIMARY KEY,
    credit_account_id UUID NOT NULL,
    entry_number BIGSERIAL NOT NULL,
    entry_type b2b_credit_entry_type NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    correlation_id VARCHAR(255),
    amount NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    balance_after NUMERIC(18,4) NOT NULL,
    reservation_id UUID,
    reservation_status b2b_reservation_status,
    reservation_expires_at TIMESTAMPTZ,
    linked_entry_id UUID,  -- Link capture to reserve, release to reserve
    ...
    CONSTRAINT ck_credit_ledger_balance CHECK (balance_after >= 0),
    CONSTRAINT ck_credit_ledger_capture_requires_reserve CHECK (
        entry_type != 'capture' OR linked_entry_id IS NOT NULL
    )
);
```

### 7.2 Entry Types

```sql
CREATE TYPE b2b_credit_entry_type AS ENUM (
    'reserve',              -- Reserve credit for order (debit)
    'capture',              -- Finalize reserved amount (debit confirmed)
    'release',              -- Release reservation (credit back)
    'manual_adjustment',    -- Manual adjustment (+ or -)
    'refund',               -- Refund after payment (credit)
    'penalty',              -- Late payment penalty (debit)
    'interest',             -- Interest charge (debit)
    'payment',              -- Customer payment (credit)
    'credit_limit_increase', -- Credit limit increase (credit)
    'credit_limit_decrease'  -- Credit limit decrease (debit)
);
```

### 7.3 Constrângeri Financiare

1. **Append-only:** Nu se fac UPDATE sau DELETE pe ledger
2. **Balance non-negativ:** `CHECK (balance_after >= 0)`
3. **Capture fără reserve = invalid:** `CHECK (entry_type != 'capture' OR linked_entry_id IS NOT NULL)`
4. **Release doar până la expirare sau anulare**

### 7.4 Rezervare și Captură

```sql
BEGIN;

-- Reserve credit
INSERT INTO b2b.credit_ledger (
    credit_account_id, entry_type, amount, balance_after, ...
) VALUES (
    ?, 'reserve', -100.00, (SELECT current_balance - 100 FROM b2b.credit_accounts WHERE id = ?), ...
);

-- Link capture to reserve (later)
INSERT INTO b2b.credit_ledger (
    credit_account_id, entry_type, amount, balance_after, linked_entry_id, ...
) VALUES (
    ?, 'capture', -100.00, (SELECT current_balance - 100 FROM b2b.credit_accounts WHERE id = ?), ?reserve_id, ...
);

COMMIT;
```

---

## 8. Handoff pentru AI 9 (Catalog/Search)

### 8.1 Tabele Contract

#### `b2b.products`

```sql
CREATE TABLE b2b.products (
    id UUID PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    supplier_sku VARCHAR(100),
    ean_gtin VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID,
    brand_id UUID,
    status b2b_product_status NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT true,
    default_price NUMERIC(18,4) CHECK (default_price >= 0),
    default_currency CHAR(3) NOT NULL DEFAULT 'RON',
    tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1900,
    slug VARCHAR(255),
    manage_stock BOOLEAN NOT NULL DEFAULT true,
    min_stock_level INTEGER,
    max_stock_level INTEGER,
    ...
    CONSTRAINT uq_products_sku UNIQUE (sku),
    CONSTRAINT uq_products_ean_gtin UNIQUE (ean_gtin)
);
```

#### `b2b.product_variants`

```sql
CREATE TABLE b2b.product_variants (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL,
    sku VARCHAR(50) NOT NULL,
    variant_name VARCHAR(255),
    variant_type VARCHAR(50),
    variant_value VARCHAR(100),
    price_override NUMERIC(18,4) CHECK (price_override >= 0),
    stock_level INTEGER NOT NULL DEFAULT 0,
    stock_status b2b_stock_level_status NOT NULL DEFAULT 'in_stock',
    ...
);
```

### 8.2 Indexuri de Căutat

**Indexuri minime:**
```sql
-- Product identifiers
CREATE INDEX idx_products_sku ON b2b.products(sku);
CREATE INDEX idx_products_supplier_sku ON b2b.products(supplier_sku);
CREATE INDEX idx_products_ean_gtin ON b2b.products(ean_gtin);

-- Filters
CREATE INDEX idx_products_brand ON b2b.products(brand_id);
CREATE INDEX idx_products_category ON b2b.products(category_id);
CREATE INDEX idx_products_status ON b2b.products(status);
CREATE INDEX idx_products_is_active ON b2b.products(is_active);

-- Time-based
CREATE INDEX idx_products_updated_at ON b2b.products(updated_at DESC);
```

**Full text search:**
```sql
CREATE INDEX idx_products_name_fts
    ON b2b.products USING gin(to_tsvector('romanian', COALESCE(name, '') || ' ' || COALESCE(description, '')));
```

### 8.3 Feed Incremental

Pentru search extern (Elasticsearch), folosiți:

```sql
-- Get products modified since last sync
SELECT * FROM b2b.products
WHERE updated_at > ?last_sync_time;

-- Get variant changes
SELECT * FROM b2b.product_variants
WHERE updated_at > ?last_sync_time;

-- Get price changes
SELECT * FROM b2b.price_book_entries
WHERE updated_at > ?last_sync_time;

-- Get stock changes
SELECT * FROM b2b.stock_levels
WHERE updated_at > ?last_sync_time;
```

### 8.4 Full Text Query

```sql
-- Full text search example
SELECT
    p.id,
    p.sku,
    p.name,
    p.default_price,
    p.default_currency,
    ts_rank(p.search_vector, query) AS rank
FROM (
    SELECT
        p.*,
        to_tsvector('romanian', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) AS search_vector
    FROM b2b.products p
    WHERE p.is_active = true
) p, to_tsquery('romanian', ?search_terms) query
WHERE p.search_vector @@ query
ORDER BY p.search_vector <=> query, p.name ASC
LIMIT ?limit OFFSET ?offset;
```

---

## 9. Riscuri și Blocaje

### 9.1 Riscuri Întâmpinate

| Risc | Mitigare | Status |
|------|----------|--------|
| Performanță la 200k+ produse | Indexuri complete, FTS, considerare Elasticsearch | ✅ Mitigated |
| Ledger append-only poate crește | Partitționare lunară, arhivare automată | ✅ Mitigated |
| Outbox events volum mare | Partitționare lunară, cleanup automat | ✅ Mitigated |
| Concurrency pe orders | `FOR UPDATE SKIP LOCKED`, transacții scurte | ✅ Mitigated |

### 9.2 Blocaje pentru Alte Echipe

| Blocaj | Descriere | Dependență |
|--------|-----------|------------|
| **Schema names fixe** | B2B, ERP, shared - nu se schimbă | Toate echipele |
| **UUID IDs** | Primary keys sunt UUID | Toate echipele |
| **Money format** | NUMERIC(18,4) + CHAR(3) | AI 6, 7, 8 |
| **Timestamps** | TIMESTAMPTZ peste tot | Toate echipele |
| **Snapshot obligatoriu** | Snapshot la confirmare comandă | AI 7 |
| **Ledger append-only** | Nu se modifică intrări istorice | AI 8 |
| **Outbox pattern** | Toate evenimentele prin outbox | AI 3, 7 |
| **Idempotency** | Fiecare consumer verifică processed_events | AI 3 |

---

## 10. Checklist pentru Recepție

### 10.1 Către Toate Echipele

- [ ] Schema names documentate și înțelese
- [ ] Migration scripts revizuite
- [ ] Rollback playbook înțeles
- [ ] Connection pooling configurat
- [ ] Environment variables definite

### 10.2 AI 3 (Events)

- [ ] Outbox structure înțeleasă
- [ ] Idempotency pattern implementat
- [ ] Event domains mapuite
- [ ] Helper functions documentate

### 10.3 AI 6 (Pricing)

- [ ] Price books structure înțeleasă
- [ ] Price entry constraints acceptate
- [ ] Price types definite
- [ ] Indexuri pentru prețuri verificate

### 10.4 AI 7 (Checkout)

- [ ] Cart structure acceptată
- [ ] Order flow înțeles
- [ ] Snapshot tables obligatoriu acceptate
- [ ] Tranzacție unică pentru checkout

### 10.5 AI 8 (Credit)

- [ ] Credit accounts structure acceptată
- [ ] Ledger append-only acceptat
- [ ] Entry types înțelese
- [ ] Constraints pentru capture/release acceptate

### 10.6 AI 9 (Catalog/Search)

- [ ] Product structure acceptată
- [ ] Indexuri definite și înțelese
- [ ] Feed incremental documentat
- [ ] FTS query example verificat

---

## 11. Contact și Suport

### 11.1 Documentație

| Document | Locație |
|----------|---------|
| Ownership Map | `/opt/cypher-erp/docs/db/ownership-map.md` |
| Migration Strategy | `/opt/cypher-erp/docs/db/migration-strategy.md` |
| Rollback Playbook | `/opt/cypher-erp/docs/db/rollback-playbook.md` |
| Performance Baselines | `/opt/cypher-erp/docs/db/performance-baselines.md` |
| Critical Queries | `/opt/cypher-erp/db/benchmarks/critical-queries.sql` |

### 11.2 Migration Scripts

| Versiune | Descriere | Fișier |
|----------|-----------|--------|
| 0001 | Roles and Schemas | `migrations/0001-roles-and-schemas.sql` |
| 0002 | Catalog, Customers, Pricing, Stock | `migrations/0002-catalog-customers-pricing-stock.sql` |
| 0003 | Cart, Orders, Snapshots | `migrations/0003-cart-orders-snapshots.sql` |
| 0004 | Credit Accounts and Ledger | `migrations/0004-credit-accounts-ledger.sql` |
| 0005 | Outbox Events | `migrations/0005-outbox-events.sql` |
| 0006 | Indexing, Partitioning, Retention | `migrations/0006-indexing-partitioning-retention.sql` |

### 11.3 Contact

| Rol | Persoană | Contact |
|-----|----------|---------|
| DBA Lead | TBD | TBD |
| AI 2 (Data/DB) | TBD | TBD |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** AI 2 (Data/DB Architect)
