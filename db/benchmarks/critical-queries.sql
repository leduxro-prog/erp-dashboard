-- ================================================================
-- Critical Queries Benchmark Script
-- Cypher ERP - B2B Module
-- ================================================================
-- Purpose: Benchmark critical query patterns for performance
-- Target: P95 < 300ms for catalog queries, < 100ms for others
-- Usage: psql -d cypher_erp -f critical-queries.sql
-- ================================================================

-- ================================================================
-- SETUP: Generate Test Data (run once)
-- ================================================================

-- Note: This section is commented out to avoid accidental data generation
-- Uncomment and run separately if test data is needed

/*
-- Generate test products
INSERT INTO b2b.products (sku, name, default_price, category_id, is_active)
SELECT
    'PRD-' || LPAD(i::TEXT, 6, '0') AS sku,
    'Test Product ' || i AS name,
    (random() * 1000)::NUMERIC(18,4) AS default_price,
    (random() * 10 + 1)::UUID AS category_id,
    random() < 0.8 AS is_active
FROM generate_series(1, 10000) AS s(i);

-- Generate test customers
INSERT INTO b2b.customers (customer_code, company_name, email, status)
SELECT
    'CUST-' || LPAD(i::TEXT, 6, '0') AS customer_code,
    'Test Company ' || i AS company_name,
    'customer' || i || '@test.com' AS email,
    'active' AS status
FROM generate_series(1, 1000) AS s(i);

-- Generate test orders
INSERT INTO b2b.orders (
    order_number, customer_id, status, total_amount, currency, created_at
)
SELECT
    'ORD-' || LPAD(i::TEXT, 10, '0') AS order_number,
    (random() * 999 + 1)::UUID AS customer_id,
    CASE random()
        WHEN < 0.1 THEN 'pending'
        WHEN < 0.5 THEN 'confirmed'
        WHEN < 0.8 THEN 'shipped'
        ELSE 'delivered'
    END AS status,
    (random() * 5000)::NUMERIC(18,4) AS total_amount,
    'RON' AS currency,
    NOW() - (random() * 365)::INTERVAL AS created_at
FROM generate_series(1, 50000) AS s(i);
*/

-- ================================================================
-- BENCHMARK 1: Product Lookup by ID
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 1: Product Lookup by ID'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM b2b.products
WHERE id = (SELECT id FROM b2b.products WHERE is_active = true LIMIT 1);

-- Alternative: Warm up run
SELECT COUNT(*) FROM b2b.products WHERE id = (SELECT id FROM b2b.products WHERE is_active = true LIMIT 1);

EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY OFF)
SELECT *
FROM b2b.products
WHERE id = (SELECT id FROM b2b.products WHERE is_active = true LIMIT 1);

-- ================================================================
-- BENCHMARK 2: Product Lookup by SKU
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 2: Product Lookup by SKU'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM b2b.products
WHERE sku = (SELECT sku FROM b2b.products WHERE is_active = true LIMIT 1);

-- ================================================================
-- BENCHMARK 3: Product Search by Name (Full Text)
-- Expected: < 200ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 3: Product Search by Name (Full Text)'
\echo '========================================================'

-- Warm up
SELECT COUNT(*) FROM b2b.products
WHERE to_tsvector('romanian', COALESCE(name, '') || ' ' || COALESCE(description, ''))
      @@ to_tsquery('romanian', 'test & product');

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, sku, name, default_price, default_currency
FROM b2b.products
WHERE to_tsvector('romanian', COALESCE(name, '') || ' ' || COALESCE(description, ''))
      @@ to_tsquery('romanian', 'test & product')
  AND is_active = true
ORDER BY default_price ASC
LIMIT 50;

-- ================================================================
-- BENCHMARK 4: Catalog Listing with Filters
-- Expected: < 300ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 4: Catalog Listing with Filters'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    p.id,
    p.sku,
    p.name,
    p.default_price,
    p.default_currency,
    p.status,
    sl.quantity_available,
    sl.status AS stock_status
FROM b2b.products p
LEFT JOIN b2b.stock_levels sl ON sl.product_id = p.id
WHERE p.is_active = true
  AND p.status = 'active'
  AND (sl.quantity_available > 0 OR sl.quantity_available IS NULL)
ORDER BY p.created_at DESC
LIMIT 50;

-- ================================================================
-- BENCHMARK 5: Stock Check by Warehouse
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 5: Stock Check by Warehouse'
\echo '========================================================'

-- Get a test product and warehouse
WITH test_data AS (
    SELECT p.id AS product_id, sl.warehouse_id
    FROM b2b.products p
    JOIN b2b.stock_levels sl ON sl.product_id = p.id
    LIMIT 1
)
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    product_id,
    warehouse_id,
    quantity_available,
    quantity_reserved,
    status
FROM b2b.stock_levels
WHERE (product_id, warehouse_id) IN (
    SELECT product_id, warehouse_id FROM test_data
);

-- ================================================================
-- BENCHMARK 6: Price Lookup by Price Book
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 6: Price Lookup by Price Book'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    pbe.product_id,
    pbe.variant_id,
    pbe.price,
    pbe.currency,
    pbe.discount_percent,
    pbe.valid_from,
    pbe.valid_to
FROM b2b.price_book_entries pbe
WHERE pbe.price_book_id = (SELECT id FROM b2b.price_books WHERE is_default = true LIMIT 1)
  AND pbe.valid_from <= NOW()
  AND (pbe.valid_to IS NULL OR pbe.valid_to > NOW())
ORDER BY pbe.product_id, pbe.valid_from DESC
LIMIT 100;

-- ================================================================
-- BENCHMARK 7: Cart Retrieval by Customer
-- Expected: < 100ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 7: Cart Retrieval by Customer'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    c.id,
    c.status,
    c.items_count,
    c.subtotal,
    c.tax_amount,
    c.total_amount,
    c.currency,
    c.updated_at
FROM b2b.carts c
WHERE c.customer_id = (SELECT id FROM b2b.customers LIMIT 1)
  AND c.status = 'active'
ORDER BY c.updated_at DESC
LIMIT 1;

-- ================================================================
-- BENCHMARK 8: Cart Items with Product Details
-- Expected: < 100ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 8: Cart Items with Product Details'
\echo '========================================================'

WITH cart_data AS (
    SELECT id FROM b2b.carts
    WHERE customer_id = (SELECT id FROM b2b.customers LIMIT 1)
      AND status = 'active'
    LIMIT 1
)
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    ci.id,
    ci.product_id,
    ci.product_sku,
    ci.product_name,
    ci.quantity,
    ci.unit_price,
    ci.currency,
    ci.line_total,
    p.default_price,
    p.default_currency,
    p.is_active
FROM b2b.cart_items ci
JOIN b2b.products p ON p.id = ci.product_id
WHERE ci.cart_id = (SELECT id FROM cart_data)
ORDER BY ci.display_order;

-- ================================================================
-- BENCHMARK 9: Customer Order History
-- Expected: < 100ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 9: Customer Order History'
-- echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    o.total_amount,
    o.currency,
    o.created_at,
    COUNT(oi.id) AS items_count
FROM b2b.orders o
LEFT JOIN b2b.order_items oi ON oi.order_id = o.id
WHERE o.customer_id = (SELECT id FROM b2b.customers LIMIT 1)
GROUP BY o.id, o.order_number, o.status, o.payment_status, o.total_amount, o.currency, o.created_at
ORDER BY o.created_at DESC
LIMIT 20;

-- ================================================================
-- BENCHMARK 10: Order Status Updates
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 10: Order Status Update'
\echo '========================================================'

-- Note: This is a write operation, so we wrap in a transaction
BEGIN;
EXPLAIN (ANALYZE, BUFFERS)
UPDATE b2b.orders
SET status = 'processing',
    updated_at = NOW()
WHERE id = (SELECT id FROM b2b.orders WHERE status = 'pending' LIMIT 1)
RETURNING id, order_number, status;
ROLLBACK;

-- ================================================================
-- BENCHMARK 11: Credit Balance Query
-- Expected: < 100ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 11: Credit Balance Query'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    ca.id,
    ca.account_number,
    ca.credit_limit,
    ca.current_balance,
    ca.available_credit,
    ca.reserved_amount,
    ca.status
FROM b2b.credit_accounts ca
WHERE ca.customer_id = (SELECT id FROM b2b.customers LIMIT 1);

-- Alternative using ledger (should be same speed)
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    cl.credit_account_id,
    COUNT(*) AS transaction_count,
    SUM(cl.amount) AS balance,
    MAX(cl.balance_after) AS latest_balance
FROM b2b.credit_ledger cl
WHERE cl.credit_account_id = (SELECT id FROM b2b.credit_accounts LIMIT 1)
GROUP BY cl.credit_account_id;

-- ================================================================
-- BENCHMARK 12: Order Items Snapshot Retrieval
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 12: Order Items Snapshot Retrieval'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    ois.id,
    ois.product_id,
    ois.product_name,
    ois.product_sku,
    ois.unit_price,
    ois.currency,
    ois.quantity,
    ois.line_total,
    ois.stock_available,
    ois.stock_reserved,
    ois.snapshot_at
FROM b2b.order_items_snapshot ois
WHERE ois.order_id = (SELECT id FROM b2b.orders LIMIT 1)
ORDER BY ois.snapshot_at DESC;

-- ================================================================
-- BENCHMARK 13: Outbox Events Pending Processing
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 13: Outbox Events Pending Processing'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    oe.id,
    oe.event_id,
    oe.event_type,
    oe.event_domain,
    oe.priority,
    oe.attempts,
    oe.next_attempt_at
FROM shared.outbox_events oe
WHERE oe.status = 'pending'
  AND oe.next_attempt_at <= NOW()
  AND oe.attempts < oe.max_attempts
ORDER BY oe.priority DESC, oe.occurred_at ASC
LIMIT 100;

-- ================================================================
-- BENCHMARK 14: Product Search with Category Filter
-- Expected: < 200ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 14: Product Search with Category Filter'
\echo '========================================================'

WITH test_category AS (
    SELECT id FROM b2b.products WHERE category_id IS NOT NULL LIMIT 1
)
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    p.id,
    p.sku,
    p.name,
    p.default_price,
    p.default_currency,
    p.status
FROM b2b.products p
WHERE p.category_id = (SELECT id FROM test_category)
  AND p.is_active = true
ORDER BY p.created_at DESC
LIMIT 50;

-- ================================================================
-- BENCHMARK 15: Low Stock Alert Query
-- Expected: < 100ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 15: Low Stock Alert Query'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    sl.id,
    sl.product_id,
    p.sku AS product_sku,
    p.name AS product_name,
    sl.warehouse_id,
    sl.quantity_available,
    sl.reorder_level,
    sl.status
FROM b2b.stock_levels sl
JOIN b2b.products p ON p.id = sl.product_id
WHERE sl.quantity_available <= COALESCE(sl.reorder_level, 0)
  AND sl.status = 'in_stock'
ORDER BY sl.quantity_available ASC
LIMIT 100;

-- ================================================================
-- BENCHMARK 16: Quote Search by Customer
-- Expected: < 100ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 16: Quote Search by Customer'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    q.id,
    q.quote_number,
    q.status,
    q.total_amount,
    q.currency,
    q.valid_from,
    q.valid_to,
    COUNT(qi.id) AS items_count
FROM b2b.quotes q
LEFT JOIN b2b.quote_items qi ON qi.quote_id = q.id
WHERE q.customer_id = (SELECT id FROM b2b.customers LIMIT 1)
GROUP BY q.id, q.quote_number, q.status, q.total_amount, q.currency, q.valid_from, q.valid_to
ORDER BY q.created_at DESC
LIMIT 20;

-- ================================================================
-- BENCHMARK 17: Credit Reservation Lookup
-- Expected: < 50ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 17: Credit Reservation Lookup'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    cr.id,
    cr.reservation_number,
    cr.amount,
    cr.currency,
    cr.status,
    cr.created_at,
    cr.expires_at,
    o.order_number
FROM b2b.credit_reservations cr
JOIN b2b.orders o ON o.id = cr.order_id
WHERE cr.credit_account_id = (SELECT id FROM b2b.credit_accounts LIMIT 1)
  AND cr.status IN ('pending', 'active')
ORDER BY cr.expires_at ASC;

-- ================================================================
-- BENCHMARK 18: Customer Credit Ledger Summary
-- Expected: < 200ms
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 18: Customer Credit Ledger Summary'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    cl.entry_type,
    COUNT(*) AS transaction_count,
    SUM(cl.amount) AS total_amount,
    MIN(cl.created_at) AS first_transaction,
    MAX(cl.created_at) AS last_transaction
FROM b2b.credit_ledger cl
WHERE cl.credit_account_id = (SELECT id FROM b2b.credit_accounts LIMIT 1)
GROUP BY cl.entry_type
ORDER BY MIN(cl.created_at) DESC;

-- ================================================================
-- BENCHMARK 19: Order Statistics (Dashboard)
-- Expected: < 500ms (aggregation query)
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 19: Order Statistics (Dashboard)'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    DATE_TRUNC('day', created_at) AS order_date,
    COUNT(*) AS order_count,
    SUM(total_amount) AS total_sales,
    AVG(total_amount) AS avg_order_value,
    currency
FROM b2b.orders
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND status NOT IN ('cancelled', 'refunded')
GROUP BY DATE_TRUNC('day', created_at), currency
ORDER BY order_date DESC;

-- ================================================================
-- BENCHMARK 20: Product Inventory Report
-- Expected: < 500ms (aggregation query)
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK 20: Product Inventory Report'
\echo '========================================================'

EXPLAIN (ANALYZE, BUFFERS)
SELECT
    p.id,
    p.sku,
    p.name,
    p.status AS product_status,
    SUM(sl.quantity_available) AS total_available,
    SUM(sl.quantity_reserved) AS total_reserved,
    SUM(sl.quantity_available + sl.quantity_reserved) AS total_stock,
    COUNT(DISTINCT sl.warehouse_id) AS warehouse_count
FROM b2b.products p
LEFT JOIN b2b.stock_levels sl ON sl.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.sku, p.name, p.status
HAVING COALESCE(SUM(sl.quantity_available), 0) <= COALESCE(SUM(sl.reorder_level), 0)
   OR SUM(sl.quantity_available) IS NULL
ORDER BY COALESCE(SUM(sl.quantity_available), 0) ASC
LIMIT 100;

-- ================================================================
-- SUMMARY REPORT
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'BENCHMARK SUMMARY'
\echo '========================================================'
\echo 'Run EXPLAIN ANALYZE above and record the execution times'
\echo ''
\echo 'Expected P95 Targets:'
\echo '  Product Lookup:              < 50ms'
\echo '  Stock Check:                  < 50ms'
\echo '  Price Lookup:                 < 50ms'
\echo '  Cart Retrieval:              < 100ms'
\echo '  Order History:                < 100ms'
\echo '  Credit Balance:               < 100ms'
\echo '  Product Search:               < 200ms'
\echo '  Quote Search:                 < 100ms'
\echo '  Outbox Processing:            < 50ms'
\echo '  Inventory Report:             < 500ms'
\echo '  Order Statistics:             < 500ms'
\echo ''
\echo 'To capture full JSON output, run with FORMAT JSON option'
\echo ''

-- ================================================================
-- INDEX USAGE ANALYSIS
-- ================================================================

\echo '========================================================'
\echo 'INDEX USAGE ANALYSIS'
\echo '========================================================'

SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW'
        WHEN idx_scan < 1000 THEN 'MEDIUM'
        ELSE 'HIGH'
    END AS usage_level
FROM pg_stat_user_indexes
WHERE schemaname IN ('b2b', 'shared')
ORDER BY idx_scan ASC;

-- ================================================================
-- TABLE STATISTICS
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'TABLE STATISTICS'
\echo '========================================================'

SELECT
    schemaname,
    tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count
FROM pg_stat_user_tables
WHERE schemaname IN ('b2b', 'shared')
ORDER BY n_live_tup DESC
LIMIT 20;

-- ================================================================
-- TABLE SIZES
-- ================================================================

\echo ''
\echo '========================================================'
\echo 'TABLE SIZES'
\echo '========================================================'

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname IN ('b2b', 'shared')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
