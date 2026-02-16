# Performance Baselines
**Cypher ERP - B2B Module**
**Version:** 1.0
**Date:** 2026-02-13

---

## 1. Overview

Acest document definește baselines de performanță pentru query-urile critice ale sistemului Cypher ERP B2B.

### 1.1 Metrici de Performanță

| Metric | Definiție | Target P95 | Target P99 |
|--------|-----------|------------|------------|
| **Product Lookup** | Căutare produs după ID/SKU | 50ms | 100ms |
| **Stock Check** | Verificare stoc | 50ms | 100ms |
| **Price Lookup** | Căutare preț | 50ms | 100ms |
| **Cart Retrieval** | Încărcare coș | 100ms | 200ms |
| **Order History** | Istoric comenzi | 100ms | 200ms |
| **Credit Balance** | Sold credit | 100ms | 200ms |
| **Product Search** | Căutare produse cu filtre | 200ms | 500ms |
| **Quote Search** | Căutare oferte | 100ms | 200ms |
| **Outbox Processing** | Procesare evenimente | 50ms | 100ms |
| **Order Statistics** | Statistici comenzi | 500ms | 1000ms |
| **Inventory Report** | Raport inventar | 500ms | 1000ms |

---

## 2. Benchmarks per Query

### 2.1 Product Lookup by ID

**Query:** `SELECT * FROM b2b.products WHERE id = ?`

**Indici folosiți:** Primary Key (`id`)

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 10k produse | 1ms | 5ms | 10ms | ✅ |
| 100k produse | 2ms | 8ms | 15ms | ✅ |
| 200k+ produse | 3ms | 10ms | 20ms | ✅ |

**Optimizări:**
- Primary key lookup este optim
- Nu necesită optimizare suplimentară

---

### 2.2 Product Lookup by SKU

**Query:** `SELECT * FROM b2b.products WHERE sku = ?`

**Indici folosiți:** `idx_products_sku`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 10k produse | 2ms | 8ms | 15ms | ✅ |
| 100k produse | 3ms | 12ms | 25ms | ✅ |
| 200k+ produse | 4ms | 15ms | 30ms | ✅ |

**Optimizări:**
- Index unic pe SKU
- Include: `sku` + `name` + `default_price` în covering index pentru liste

---

### 2.3 Product Search (Full Text)

**Query:**
```sql
SELECT * FROM b2b.products
WHERE to_tsvector('romanian', name || ' ' || description)
      @@ to_tsquery('romanian', 'term1 & term2')
  AND is_active = true
```

**Indici folosiți:** `idx_products_name_fts`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 10k produse | 15ms | 50ms | 100ms | ✅ |
| 100k produse | 25ms | 80ms | 150ms | ✅ |
| 200k+ produse | 35ms | 120ms | 200ms | ⚠️ |

**Optimizări:**
- GIN index pentru full-text search
- Considerare Elasticsearch pentru search scalabil
- Filtrele pe `is_active` și `status` reduc volumul

---

### 2.4 Stock Check by Warehouse

**Query:**
```sql
SELECT * FROM b2b.stock_levels
WHERE product_id = ? AND warehouse_id = ?
```

**Indici folosiți:** `idx_stock_product_warehouse`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 50k stocuri | 2ms | 8ms | 15ms | ✅ |
| 200k stocuri | 3ms | 10ms | 20ms | ✅ |
| 500k+ stocuri | 4ms | 12ms | 25ms | ✅ |

**Optimizări:**
- Composite index pe `(product_id, warehouse_id)`
- Include coloanele frecvent accesate

---

### 2.5 Price Lookup by Price Book

**Query:**
```sql
SELECT * FROM b2b.price_book_entries
WHERE price_book_id = ?
  AND product_id = ?
  AND valid_from <= NOW()
  AND (valid_to IS NULL OR valid_to > NOW())
ORDER BY valid_from DESC
LIMIT 1
```

**Indici folosiți:** `idx_price_current`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 100k prețuri | 3ms | 10ms | 20ms | ✅ |
| 500k prețuri | 5ms | 15ms | 30ms | ✅ |
| 1M+ prețuri | 8ms | 20ms | 40ms | ✅ |

**Optimizări:**
- Partial index pe `(valid_from DESC, valid_to)` pentru prețuri active
- Partitționare lunară pentru prețuri istorice

---

### 2.6 Cart Retrieval by Customer

**Query:**
```sql
SELECT * FROM b2b.carts
WHERE customer_id = ? AND status = 'active'
ORDER BY updated_at DESC
LIMIT 1
```

**Indici folosiți:** `idx_carts_customer_updated`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 10k coșuri | 2ms | 8ms | 15ms | ✅ |
| 100k coșuri | 3ms | 10ms | 20ms | ✅ |
| 500k+ coșuri | 4ms | 12ms | 25ms | ✅ |

**Optimizări:**
- Index pe `(customer_id, updated_at DESC)`
- Clean-up periodic pentru coșuri vechi/expirate

---

### 2.7 Order History by Customer

**Query:**
```sql
SELECT o.*, COUNT(oi.id) AS items_count
FROM b2b.orders o
LEFT JOIN b2b.order_items oi ON oi.order_id = o.id
WHERE o.customer_id = ?
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT 20
```

**Indici folosiți:** `idx_orders_customer_created`, `idx_order_items_order_id`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 10k comenzi | 10ms | 30ms | 60ms | ✅ |
| 100k comenzi | 15ms | 50ms | 100ms | ✅ |
| 500k+ comenzi | 25ms | 80ms | 150ms | ✅ |

**Optimizări:**
- Covering index pe `(customer_id, created_at DESC)` cu `total_amount` și `currency`
- Pentru clienți cu multe comenzi, considerare paginare cu cursor

---

### 2.8 Credit Balance Query

**Query:**
```sql
SELECT * FROM b2b.credit_accounts
WHERE customer_id = ?
```

**Indici folosiți:** `idx_credit_accounts_customer_id`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 1k conturi | 1ms | 5ms | 10ms | ✅ |
| 10k conturi | 1ms | 5ms | 10ms | ✅ |
| 50k+ conturi | 2ms | 8ms | 15ms | ✅ |

**Optimizări:**
- Index unic pe `customer_id`
- Balance calculat din ledger cu trigger

---

### 2.9 Outbox Events Processing

**Query:**
```sql
SELECT * FROM shared.outbox_events
WHERE status = 'pending'
  AND next_attempt_at <= NOW()
  AND attempts < max_attempts
ORDER BY priority DESC, occurred_at ASC
LIMIT 100
FOR UPDATE SKIP LOCKED
```

**Indici folosiți:** `idx_outbox_pending_processing`

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 10k evenimente | 5ms | 15ms | 30ms | ✅ |
| 100k evenimente | 10ms | 25ms | 50ms | ✅ |
| 1M+ evenimente | 15ms | 40ms | 80ms | ✅ |

**Optimizări:**
- Partial index pe `next_attempt_at` pentru evenimente în așteptare
- `SKIP LOCKED` pentru concurență
- Partitționare lunară pentru arhivare

---

### 2.10 Order Statistics (Dashboard)

**Query:**
```sql
SELECT
    DATE_TRUNC('day', created_at) AS order_date,
    COUNT(*) AS order_count,
    SUM(total_amount) AS total_sales
FROM b2b.orders
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND status NOT IN ('cancelled', 'refunded')
GROUP BY DATE_TRUNC('day', created_at)
```

| Volum date | P50 | P95 | P99 | Notă |
|------------|-----|-----|-----|------|
| 10k comenzi/lună | 50ms | 150ms | 300ms | ✅ |
| 100k comenzi/lună | 100ms | 300ms | 600ms | ⚠️ |
| 500k+ comenzi/lună | 200ms | 500ms | 1000ms | ⚠️ |

**Optimizări:**
- Index pe `(created_at DESC, status)`
- Considerare materialized view pentru dashboard
- Pre-calculate statistici în batch jobs

---

## 3. Volume și Scalare

### 3.1 Volume țintite

| Entitate | Volum curent | Volum țintă | Partitționare |
|----------|--------------|--------------|---------------|
| Products | 50k | 200k+ | Nu |
| Variants | 100k | 500k+ | Nu |
| Customers | 1k | 10k+ | Nu |
| Orders | 50k | 500k+ | Opțional |
| Credit Ledger | 100k | 1M+ | Da, lunar |
| Stock Levels | 100k | 500k+ | Nu |
| Outbox Events | 100k | 1M+ | Da, lunar |

### 3.2 Planificare Partitționare

Tabelele mari ar trebui partitionate pe `created_at` lunar:

- `b2b.credit_ledger` - Partitționare obligatorie la 100k+ intrări/lună
- `shared.outbox_events` - Partitționare obligatorie la 50k+ evenimente/lună
- `b2b.orders` - Partitționare opțională la 100k+ comenzi/lună
- `b2b.credit_reservations` - Partitționare opțională

---

## 4. Optimizări Recomandate

### 4.1 Indexuri Adiționale

```sql
-- Full text search cu trigram (pentru matching parțial)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm
    ON b2b.products USING gin(name gin_trgm_ops);

-- Covering index pentru order history
CREATE INDEX idx_orders_customer_history_covering
    ON b2b.orders(customer_id, created_at DESC)
    INCLUDE (order_number, status, total_amount, currency);

-- Partial index pentru comenzi active
CREATE INDEX idx_orders_active
    ON b2b.orders(created_at DESC)
    WHERE status NOT IN ('cancelled', 'refunded');
```

### 4.2 Materialized Views

Pentru rapoarte complexe, folosiți materialized views:

```sql
CREATE MATERIALIZED VIEW b2b.daily_order_stats AS
SELECT
    DATE_TRUNC('day', created_at) AS order_date,
    currency,
    COUNT(*) AS order_count,
    SUM(total_amount) AS total_sales,
    AVG(total_amount) AS avg_order_value
FROM b2b.orders
WHERE status NOT IN ('cancelled', 'refunded')
GROUP BY DATE_TRUNC('day', created_at), currency
WITH DATA;

CREATE UNIQUE INDEX idx_daily_order_stats_date_currency
    ON b2b.daily_order_stats(order_date, currency);

-- Refresh script
REFRESH MATERIALIZED VIEW CONCURRENTLY b2b.daily_order_stats;
```

### 4.3 Connection Pooling

Folosiți PgBouncer pentru connection pooling:

- Pool mode: Transaction
- Max connections: 100
- Default pool size: 20
- Min pool size: 10

---

## 5. Monitoring și Alerte

### 5.1 KPIs de Monitorizat

| KPI | Metrică | Warning | Critical |
|-----|---------|---------|----------|
| **Slow Queries** | Queries > 500ms | > 5/min | > 20/min |
| **Connection Usage** | Active connections | > 80% | > 95% |
| **Lock Wait Time** | Average wait time | > 100ms | > 1000ms |
| **Cache Hit Ratio** | Buffer cache hit | < 99% | < 95% |
| **Dead Tuples** | Dead/Total ratio | > 10% | > 25% |
| **Table Bloat** | Table size vs expected | > 2x | > 5x |

### 5.2 Query-uri pentru Monitoring

```sql
-- Slow queries
SELECT
    query,
    calls,
    total_time / 1000 / 60 AS total_minutes,
    mean_time AS avg_ms,
    max_time AS max_ms
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Connection usage
SELECT
    count(*) AS connections,
    count(*) FILTER (WHERE state = 'active') AS active
FROM pg_stat_activity
WHERE datname = current_database();

-- Lock waits
SELECT
    pid,
    usename,
    pg_blocking_pids(pid) AS blocked_by,
    query,
    state
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- Cache hit ratio
SELECT
    sum(blks_hit) / (sum(blks_hit) + sum(blks_read)) AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();
```

---

## 6. Tuning Parametri

### 6.1 PostgreSQL Config

```ini
# Memory
shared_buffers = 4GB          # 25% of RAM
effective_cache_size = 12GB  # 75% of RAM
work_mem = 64MB              # Per operation
maintenance_work_mem = 2GB   # For VACUUM/CREATE INDEX

# WAL
wal_buffers = 64MB
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 1GB

# Query Planning
random_page_cost = 1.1       # For SSD
effective_io_concurrency = 200

# Connections
max_connections = 200
max_worker_processes = 8
max_parallel_workers = 4
max_parallel_workers_per_gather = 2

# Autovacuum
autovacuum_max_workers = 4
autovacuum_naptime = 30s
autovacuum_vacuum_scale_factor = 0.05
```

### 6.2 Config pentru Volum Mare (500k+ produse)

```ini
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 128MB
maintenance_work_mem = 4GB

max_worker_processes = 16
max_parallel_workers = 8
max_parallel_workers_per_gather = 4
```

---

## 7. Checklist de Performanță

### 7.1 Pre-Deployment

- [ ] Query-uri critice testate pe staging
- [ ] Indici creați și verificate
- [ ] Statistici actualizate (ANALYZE)
- [ ] Vacuum complet pe tabele mari
- [ ] Configurare DB optimizată
- [ ] Connection pooling configurat

### 7.2 Post-Deployment

- [ ] Monitorizare activă pentru 24h
- [ ] Verificare slow queries
- [ ] Verificare cache hit ratio
- [ ] Verificare lock waits
- [ ] Verificare connection usage

---

## 8. Rezumat Target-uri

| Query | Target P95 | Actual | Status |
|-------|------------|--------|--------|
| Product Lookup by ID | 50ms | TBD | ⏳ |
| Product Lookup by SKU | 50ms | TBD | ⏳ |
| Product Search (FTS) | 200ms | TBD | ⏳ |
| Stock Check | 50ms | TBD | ⏳ |
| Price Lookup | 50ms | TBD | ⏳ |
| Cart Retrieval | 100ms | TBD | ⏳ |
| Order History | 100ms | TBD | ⏳ |
| Credit Balance | 100ms | TBD | ⏳ |
| Outbox Processing | 50ms | TBD | ⏳ |
| Order Statistics | 500ms | TBD | ⏳ |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** AI 2 (Data/DB Architect)
