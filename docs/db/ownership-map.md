# Data Ownership Map & Conventions
**Cypher ERP - B2B Module**
**Version:** 1.0
**Date:** 2026-02-13

---

## 1. Overview

Acest document definește convențiile de bază de date, structura schemelor și regulile de ownership pentru sistemul Cypher ERP B2B.

### 1.1 Principii Fundamentale

| Principiu | Descriere |
|-----------|-----------|
| **Source of Truth** | PostgreSQL este singura sursă de adevăr |
| **Schema Isolation** | B2B și ERP sunt separate pe schemă și roluri |
| **Financial Integrity** | Snapshot-uri obligatorii pentru quote/order |
| **Idempotency** | Outbox pattern cu processed_events tracking |
| **Auditability** | Toate modificările sunt tranzabile și auditate |
| **No Deletes** | Soft delete sau arhivare, fără hard delete pe date critice |

---

## 2. Schema Ownership Map

### 2.1 Structure Overview

```
cypher_erp (database)
├── b2b (schema)           -> Owned by B2B Module
├── erp (schema)           -> Owned by ERP Module
└── shared (schema)        -> Cross-cutting (outbox, observability)
```

### 2.2 Schema Ownership Table

| Schema | Owner | Access Role | Descriere |
|--------|-------|-------------|-----------|
| `b2b` | AI 2 (Data/DB) + AI 6/7/8 | `b2b_rw` | Toate tabelele B2B (produse, clienți, comenzi, credite) |
| `erp` | Existing ERP | `erp_rw` | Tabelele ERP existente (inventar ERP, contabilitate, etc.) |
| `shared` | AI 2 (Data/DB) | ALL (READ) | Outbox, processed_events, observability |

### 2.3 Table Ownership by Schema

#### Schema `b2b`

| Tabel | Owner Team | Modificare | Read | Notes |
|-------|------------|------------|------|-------|
| `b2b.products` | Catalog Team (AI 9) | b2b_rw | ALL | Master produse |
| `b2b.product_variants` | Catalog Team (AI 9) | b2b_rw | ALL | Variante produse |
| `b2b.product_media` | Catalog Team (AI 9) | b2b_rw | ALL | Media produse |
| `b2b.product_attributes` | Catalog Team (AI 9) | b2b_rw | ALL | Atribute produse |
| `b2b.price_books` | Pricing Team (AI 6) | b2b_rw | ALL | Cărți de preț |
| `b2b.stock_levels` | Inventory Team | b2b_rw | ALL | Niveluri stoc |
| `b2b.customers` | Customer Service | b2b_rw | ALL | Clienți B2B |
| `b2b.customer_tiers` | Sales Team | b2b_rw | ALL | Nivele clienți |
| `b2b.credit_accounts` | Credit Team (AI 8) | b2b_rw | ALL | Conturi credit |
| `b2b.credit_ledger` | Credit Team (AI 8) | b2b_rw | ALL | Append-only ledger |
| `b2b.cart` | Checkout Team (AI 7) | b2b_rw | ALL | Coșuri active |
| `b2b.cart_items` | Checkout Team (AI 7) | b2b_rw | ALL | Itemi în coș |
| `b2b.quotes` | Pricing Team (AI 6) | b2b_rw | ALL | Oferte/Devis |
| `b2b.quote_items_snapshot` | Pricing Team (AI 6) | b2b_rw | ALL | Snapshot oferte |
| `b2b.orders` | Checkout Team (AI 7) | b2b_rw | ALL | Comenzi finalizate |
| `b2b.order_items` | Checkout Team (AI 7) | b2b_rw | ALL | Itemi comandă |
| `b2b.order_items_snapshot` | Checkout Team (AI 7) | b2b_rw | ALL | Snapshot comenzi |

#### Schema `shared`

| Tabel | Owner | Access | Descriere |
|-------|-------|--------|-----------|
| `shared.outbox_events` | Events Team (AI 3) | ALL | Coadă evenimente pentru messaging |
| `shared.processed_events` | Events Team (AI 3) | ALL | Idempotency tracking |

---

## 3. Naming Conventions

### 3.1 General Rules

| Element | Convention | Exemple |
|---------|------------|---------|
| **Schema names** | lowercase, snake_case | `b2b`, `erp`, `shared` |
| **Table names** | lowercase, snake_case, singular | `products`, `credit_ledger`, `order_items_snapshot` |
| **Column names** | lowercase, snake_case | `first_name`, `created_at`, `is_active` |
| **Primary keys** | `id` | `id` |
| **Foreign keys** | `{table}_id` | `product_id`, `customer_id`, `order_id` |
| **Index names** | `idx_{table}_{columns}` | `idx_products_sku`, `idx_orders_customer_created` |
| **Unique constraints** | `uq_{table}_{columns}` | `uq_products_sku`, `uq_cart_customer_default` |
| **Foreign key constraints** | `fk_{table}_{ref_table}` | `fk_cart_items_cart`, `fk_orders_customer` |
| **Check constraints** | `ck_{table}_{condition}` | `ck_products_price_positive` |
| **Enums** | `{entity}_{field}_type` | `credit_entry_type`, `order_status` |

### 3.2 Prefixes pentru Cross-Schema References

| Prefix | Schema | Utilizare |
|--------|--------|-----------|
| `b2b_` | b2b schema | Pentru tabele accesate din alte scheme |
| `erp_` | erp schema | Pentru tabele accesate din alte scheme |
| `shared_` | shared schema | Pentru tabele cross-cutting |

---

## 4. Data Type Conventions

### 4.1 Standard Types

| Tip de Date | Postgres Type | Utilizare | Exemple |
|-------------|---------------|-----------|---------|
| **ID** | `UUID` | Primary keys, foreign keys | `id` |
| **Money** | `NUMERIC(18,4)` | Prețuri, sume, valori monetare | `unit_price`, `total_amount` |
| **Currency** | `CHAR(3)` ISO 4217 | Cod monedă | `currency` (RON, EUR, USD) |
| **Timestamp** | `TIMESTAMPTZ` | Data+ora cu timezone | `created_at`, `updated_at` |
| **Date** | `DATE` | Date fără oră | `birth_date`, `valid_from` |
| **Boolean** | `BOOLEAN` | Flag-uri binare | `is_active`, `is_default` |
| **Text Short** | `VARCHAR(n)` | String-uri cu lungime fixă | `email VARCHAR(255)`, `phone VARCHAR(20)` |
| **Text Long** | `TEXT` | String-uri lungi, JSON | `description`, `metadata` |
| **JSON** | `JSONB` | Structuri flexibile | `attributes`, `metadata` |
| **Enum** | Custom ENUM | Valori fixe | `status`, `entry_type` |
| **Integer** | `INTEGER` | Numere mici, ID-uri legacy | `priority`, `version` |
| **Bigint** | `BIGINT` | Numere mari, contori | `quantity`, `stock_level` |

### 4.2 Tipuri Interzise

❌ **NU FOLOSI:**
- `FLOAT` sau `DOUBLE PRECISION` - inexact pentru bani
- `TIMESTAMP` fără timezone - ambiguitate timezone
- `MONEY` - dependent de locale, folosește `NUMERIC(18,4)`

### 4.3 Money Format Standard

```sql
-- Corect - pentru prețuri și sume
price NUMERIC(18,4) NOT NULL
currency CHAR(3) NOT NULL DEFAULT 'RON'

-- Totaluri
subtotal NUMERIC(18,4) NOT NULL CHECK (subtotal >= 0)
tax_amount NUMERIC(18,4) NOT NULL CHECK (tax_amount >= 0)
total_amount NUMERIC(18,4) NOT NULL CHECK (total_amount >= 0)
discount_amount NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0)
```

### 4.4 Timestamp Standard

```sql
-- Timestamp cu timezone
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at TIMESTAMPTZ  -- NULL pentru active, setat pentru soft delete

-- Date ranges
valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW()
valid_to TIMESTAMPTZ
```

---

## 5. ID Strategy

### 5.1 UUIDv7 Standard

Toate tabelele folosesc `UUID` ca primary key.

**Recomandare:** UUIDv7 pentru ordonare naturală după timp.
**Fallback:** UUIDv4 dacă UUIDv7 nu este disponibil.

```sql
-- Postgres 15+ cu uuid-ossp extension
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Pentru UUIDv7 (dacă implementat)
-- id UUID PRIMARY KEY DEFAULT uuid_generate_v7()
```

### 5.2 ID Naming

| Nume | Utilizare |
|------|-----------|
| `id` | Primary key al tabelului |
| `{table}_id` | Foreign key spre alt tabel |
| `{ref}_id` | Foreign key cu nume specializat (ex: `parent_id`) |

### 5.3 Composite Keys

- Folosite doar pentru constraint-uri unique, nu ca PK
- Ex: `(customer_id, product_id, valid_from)` pentru prețuri

---

## 6. Timestamp Conventions

### 6.1 Standard Columns

Fiecare tabel **trebuie** să aibă:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Tabelele cu soft delete:

```sql
deleted_at TIMESTAMPTZ  -- NULL = activ
```

### 6.2 Trigger pentru updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER {table}_updated_at
    BEFORE UPDATE ON {table}
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 6.3 Date Range Fields

Pentru tabele cu validitate temporală:

```sql
valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW()
valid_to TIMESTAMPTZ
```

Constraint pentru validitate:

```sql
CHECK (valid_to IS NULL OR valid_to > valid_from)
```

---

## 7. Enum Definitions

### 7.1 Common Enums

#### Order Status

```sql
CREATE TYPE b2b_order_status AS ENUM (
    'pending',           -- Awaiting processing
    'confirmed',         -- Stock reserved
    'processing',        -- Being picked/packed
    'ready_to_ship',     -- Ready for handover
    'shipped',           -- In transit
    'delivered',         -- Delivered to customer
    'cancelled',         -- Cancelled by customer/system
    'refunded',          -- Fully refunded
    'partially_refunded' -- Partial refund
);
```

#### Quote Status

```sql
CREATE TYPE b2b_quote_status AS ENUM (
    'draft',             -- Draft, not sent
    'sent',              -- Sent to customer
    'accepted',          -- Accepted - becomes order
    'rejected',          -- Rejected by customer
    'expired',           -- Expired validity
    'cancelled'          -- Cancelled before acceptance
);
```

#### Credit Entry Type

```sql
CREATE TYPE b2b_credit_entry_type AS ENUM (
    'reserve',           -- Reserve credit for order
    'capture',           -- Finalize reserved amount
    'release',           -- Release reservation
    'manual_adjustment', -- Manual adjustment (+/-)
    'refund',            -- Refund after payment
    'penalty'            -- Late payment penalty
);
```

#### Cart Status

```sql
CREATE TYPE b2b_cart_status AS ENUM (
    'active',            -- Currently active
    'abandoned',         -- Not accessed > 7 days
    'converted',         -- Converted to order
    'expired'            -- Expired by system
);
```

#### Stock Level

```sql
CREATE TYPE b2b_stock_level AS ENUM (
    'in_stock',          -- Available for sale
    'low_stock',         -- Below threshold
    'out_of_stock',      -- Zero quantity
    'on_order',          -- On backorder
    'discontinued'       -- No longer available
);
```

---

## 8. Constraint Standards

### 8.1 Primary Key

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### 8.2 Foreign Key

```sql
-- Standard cu cascade
customer_id UUID NOT NULL
CONSTRAINT fk_orders_customer
    REFERENCES b2b.customers(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
```

**Cascade Rules:**
- `ON DELETE RESTRICT` - Protejează datele critice
- `ON DELETE CASCADE` - Doar pentru dependent non-critice (media, snapshots)
- `ON UPDATE CASCADE` - Pentru UUID (nu se schimbă de obicei)

### 8.3 Unique Constraints

```sql
CONSTRAINT uq_customers_email UNIQUE (email),
CONSTRAINT uq_products_sku UNIQUE (sku)
```

### 8.4 Check Constraints

```sql
CONSTRAINT ck_price_positive CHECK (unit_price >= 0),
CONSTRAINT ck_discount_valid CHECK (discount_percent >= 0 AND discount_percent <= 100),
CONSTRAINT ck_quantity_positive CHECK (quantity > 0),
CONSTRAINT ck_dates_valid CHECK (valid_to IS NULL OR valid_to > valid_from)
```

### 8.5 Not Null Constraints

Toate coloanele critice trebuie `NOT NULL`:

```sql
email VARCHAR(255) NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
quantity BIGINT NOT NULL CHECK (quantity > 0)
```

---

## 9. Indexing Standards

### 9.1 Naming Convention

```sql
-- Index simplu
CREATE INDEX idx_{table}_{column} ON {table}({column});

-- Index compus
CREATE INDEX idx_{table}_{col1}_{col2} ON {table}({col1}, {col2});

-- Index unic
CREATE UNIQUE INDEX idx_{table}_{col}_unique ON {table}({col});

-- Index partial
CREATE INDEX idx_{table}_{col}_active ON {table}({col}) WHERE is_active = true;

-- Index GIN pentru JSONB
CREATE INDEX idx_{table}_{metadata} ON {table} USING GIN (metadata);
```

### 9.2 Indexes pentru Foreign Keys

Toate foreign keys trebuie indexate:

```sql
CREATE INDEX idx_orders_customer_id ON b2b.orders(customer_id);
CREATE INDEX idx_order_items_order_id ON b2b.order_items(order_id);
```

### 9.3 Indexes pentru Query Patterns

| Pattern | Index |
|---------|-------|
| Lookup by code | `(code)`, `(sku)`, `(ean_gtin)` |
| Filter by status | `(status, created_at DESC)` |
| Customer history | `(customer_id, created_at DESC)` |
| Date range queries | `(created_at)`, `(valid_from, valid_to)` |
| Full text search | GIN index cu to_tsvector |

### 9.4 Covering Indexes

Pentru query-uri performante:

```sql
CREATE INDEX idx_orders_customer_status_created
    ON b2b.orders(customer_id, status, created_at DESC)
    INCLUDE (total_amount, currency);
```

---

## 10. Migration Conventions

### 10.1 Migration Naming

Format: `{version}-{description}.sql`

Exemple:
```
0001-roles-and-schemas.sql
0002-catalog-customers-pricing-stock.sql
0003-cart-orders-snapshots.sql
0004-credit-accounts-ledger.sql
0005-outbox-events.sql
0006-indexing-partitioning-retention.sql
```

### 10.2 Migration Structure

```sql
-- ================================================================
-- Migration: {version} - {description}
-- Author: AI 2 (Data/DB)
-- Date: YYYY-MM-DD
-- ================================================================
-- Description: Detailed description of what this migration does
-- Impact: What tables/columns are affected
-- Rollback: Rollback script or notes
-- ================================================================

-- UP (Apply) =====================================================

-- DDL statements
-- CREATE TABLE ...
-- CREATE INDEX ...
-- ALTER TABLE ...

-- Verify
-- \echo 'Migration {version} completed successfully'

-- ================================================================
-- DOWN (Rollback) - Uncomment to rollback
-- ================================================================
-- DROP TABLE IF EXISTS ... CASCADE;
-- DROP INDEX IF EXISTS ...;
-- DROP TYPE IF EXISTS ...;
```

### 10.3 Expand/Contract Pattern

1. **Expand** - Adaugă tabele/coloane noi (nullable)
2. **Backfill** - Populează datele noi în batch-uri
3. **Read Switch** - Aplicația citește noul model
4. **Contract** - Elimină vechiul model după 1-2 release-uri

---

## 11. Audit and Logging

### 11.1 Audit Columns

Pentru tabelele critice:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by UUID,           -- User who created record
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_by UUID,           -- User who last updated record
deleted_at TIMESTAMPTZ,     -- Soft delete timestamp
deleted_by UUID             -- User who deleted record
```

### 11.2 Audit Tables

Pentru tabelele financiare, se consideră audit table separat:

```sql
CREATE TABLE b2b.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(255) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 12. Security Standards

### 12.1 Password Management

- Role passwords stocate separat, nu în cod
- Folosire `.pgpass` sau variabile de mediu
- Rotire periodică a parolelor

### 12.2 Row-Level Security (RLS)

Pentru date sensibile:

```sql
ALTER TABLE b2b.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_isolation ON b2b.customers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

### 12.3 Encryption

- Parole: hashing cu bcrypt/scrypt
- Date PII: considerați pgcrypto pentru encryption la nevoie

---

## 13. Documentation Standards

### 13.1 Table Comments

```sql
COMMENT ON TABLE b2b.products IS 'Master product catalog for B2B customers. Contains base product information.';
COMMENT ON COLUMN b2b.products.sku IS 'Stock Keeping Unit - unique identifier for inventory';
COMMENT ON COLUMN b2b.products.is_active IS 'Product availability flag. Soft delete mechanism.';
```

### 13.2 ERD Documentation

- Actualizat la fiecare migration major
- Include relationships, cardinalities, constraints
- Public în `/docs/db/erd.md`

---

## 14. Performance Baselines

### 14.1 Target Metrics

| Metric | Target | Critical |
|--------|--------|----------|
| Catalog lookup by ID | < 50ms | < 100ms |
| Catalog search (indexed) | < 200ms | < 500ms |
| Stock check | < 50ms | < 100ms |
| Price lookup | < 50ms | < 100ms |
| Cart retrieval | < 100ms | < 200ms |
| Order creation | < 300ms | < 500ms |
| Credit balance query | < 100ms | < 200ms |

### 14.2 Volume Targets

| Metric | Target |
|--------|--------|
| Products | 200,000+ |
| Variants | 500,000+ |
| Orders/day | 10,000+ |
| Credit entries/month | 100,000+ |

---

## 15. Checklist pentru Noi Tabele

Înainte de a crea un tabel nou:

- [ ] Numele respectă convenția (lowercase, snake_case, singular)
- [ ] Schema corectă (b2b, erp, shared)
- [ ] Primary key `id UUID`
- [ ] `created_at` și `updated_at` TIMESTAMPTZ
- [ ] Foreign keys au constraint și index
- [ ] Enum-urile definite separat
- [ ] Money types = NUMERIC(18,4) + CHAR(3)
- [ ] Check constraints pentru validare
- [ ] Indexes pentru query patterns anticipate
- [ ] Table comments adăugate
- [ ] Migration script creat
- [ ] Rollback script pregătit
- [ ] Testate pe DB staging

---

## 16. Appendix: Quick Reference

### Column Types Quick Reference

```sql
-- ID
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Money
price NUMERIC(18,4) NOT NULL CHECK (price >= 0)

-- Timestamps
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- Enum
status b2b_order_status NOT NULL DEFAULT 'pending'

-- JSON metadata
metadata JSONB NOT NULL DEFAULT '{}'

-- FK cu constraint
customer_id UUID NOT NULL
CONSTRAINT fk_orders_customer
    REFERENCES b2b.customers(id)
    ON DELETE RESTRICT

-- Soft delete
deleted_at TIMESTAMPTZ
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** AI 2 (Data/DB Architect)
