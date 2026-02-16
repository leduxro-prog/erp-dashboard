-- ================================================================
-- Migration: 0006 - Indexing, Partitioning, and Retention
-- Author: AI 2 (Data/DB)
-- Date: 2026-02-13
-- ================================================================
-- Description: Additional indexes, table partitioning, and retention policies
-- Impact: Performance optimization for high-volume tables and data lifecycle management
-- Rollback: DROP INDEX IF EXISTS ...; DROP FUNCTION IF EXISTS ...; etc.
-- ================================================================

-- ================================================================
-- PARTITIONING SETUP
-- ================================================================

-- Enable required extension for partitioning (already included in Postgres 10+)
-- CREATE EXTENSION IF NOT EXISTS "pg_partman" CASCADE; -- For automated partition management

-- ================================================================
-- PARTITIONED TABLE: b2b.credit_ledger
-- Partitioned by month on created_at
-- ================================================================

-- Convert existing table to partitioned (if data exists, need to migrate)
-- For new deployment, we create as partitioned from start

-- Note: If b2b.credit_ledger already has data, you need to:
-- 1. CREATE TABLE b2b.credit_ledger_new (same schema, partitioned)
-- 2. Copy data from old to new
-- 3. DROP b2b.credit_ledger_old
-- 4. RENAME b2b.credit_ledger_new to b2b.credit_ledger

-- For this migration, we create the partition structure
-- Assuming empty table or new deployment

-- Create function to create monthly partitions
CREATE OR REPLACE FUNCTION b2b.create_monthly_partition(
    p_schema_name TEXT,
    p_table_name TEXT,
    p_partition_date DATE,
    p_default_future_partitions INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_partition_name TEXT;
    v_partition_start TEXT;
    v_partition_end TEXT;
    v_i INTEGER;
    v_current_date DATE;
BEGIN
    -- Create partitions for the specified month
    v_partition_name := format('%s_%s_%s',
        p_table_name,
        to_char(p_partition_date, 'YYYY'),
        to_char(p_partition_date, 'MM'));

    v_partition_start := to_char(p_partition_date, 'YYYY-MM-01');
    v_partition_end := to_char(p_partition_date + INTERVAL '1 month', 'YYYY-MM-01');

    -- Create partition if it doesn't exist
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %s.%s PARTITION OF %s.%s
         FOR VALUES FROM (%L) TO (%L)',
        p_schema_name, v_partition_name,
        p_schema_name, p_table_name,
        v_partition_start, v_partition_end
    );

    -- Create future partitions
    FOR v_i IN 1..p_default_future_partitions LOOP
        v_current_date := p_partition_date + (v_i || ' months')::INTERVAL;
        v_partition_name := format('%s_%s_%s',
            p_table_name,
            to_char(v_current_date, 'YYYY'),
            to_char(v_current_date, 'MM'));

        v_partition_start := to_char(v_current_date, 'YYYY-MM-01');
        v_partition_end := to_char(v_current_date + INTERVAL '1 month', 'YYYY-MM-01');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %s.%s PARTITION OF %s.%s
             FOR VALUES FROM (%L) TO (%L)',
            p_schema_name, v_partition_name,
            p_schema_name, p_table_name,
            v_partition_start, v_partition_end
        );
    END LOOP;

    -- Add indexes to partitions (indexes are created on parent, but we need to ensure)
    -- Note: Indexes on parent are automatically created on all partitions
END;
$$ LANGUAGE plpgsql;

-- Create partitions for current and next months
-- Assuming tables exist from previous migrations
-- These are wrapper functions to be called after initial data load

-- ================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ================================================================

-- ================================================================
-- Indexes for b2b.products
-- ================================================================

-- Full text search index for product name and description
CREATE INDEX IF NOT EXISTS idx_products_name_fts
    ON b2b.products USING gin(to_tsvector('romanian', COALESCE(name, '') || ' ' || COALESCE(description, '')));

-- Trigram index for partial matching (requires pg_trgm)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX idx_products_name_trgm ON b2b.products USING gin(name gin_trgm_ops);
-- CREATE INDEX idx_products_sku_trgm ON b2b.products USING gin(sku gin_trgm_ops);

-- Covering index for catalog listing (includes commonly accessed columns)
CREATE INDEX IF NOT EXISTS idx_products_catalog_listing
    ON b2b.products(is_active, status, created_at DESC)
    INCLUDE (name, sku, default_price, default_currency);

-- Index for price filter queries
CREATE INDEX IF NOT EXISTS idx_products_price_range
    ON b2b.products(default_price, default_currency)
    WHERE is_active = true;

-- Index for category/brand filter queries
CREATE INDEX IF NOT EXISTS idx_products_category_brand
    ON b2b.products(category_id, brand_id, is_active)
    WHERE category_id IS NOT NULL AND brand_id IS NOT NULL;

-- ================================================================
-- Indexes for b2b.stock_levels
-- ================================================================

-- Index for low stock alerts
CREATE INDEX IF NOT EXISTS idx_stock_low_stock
    ON b2b.stock_levels(quantity_available, reorder_level)
    WHERE quantity_available <= COALESCE(reorder_level, 0);

-- Covering index for stock check by product
CREATE INDEX IF NOT EXISTS idx_stock_check
    ON b2b.stock_levels(product_id, warehouse_id)
    INCLUDE (quantity_available, quantity_reserved, status);

-- Index for stock transfers between warehouses
CREATE INDEX IF NOT EXISTS idx_stock_warehouse_transfer
    ON b2b.stock_levels(warehouse_id, product_id)
    INCLUDE (quantity_available, quantity_reserved, quantity_in_transit);

-- ================================================================
-- Indexes for b2b.price_book_entries
-- ================================================================

-- Index for current price lookup (composite with validity)
CREATE INDEX IF NOT EXISTS idx_price_current
    ON b2b.price_book_entries(product_id, variant_id, valid_from DESC, valid_to)
    WHERE valid_to IS NULL OR valid_to > NOW();

-- Covering index for price book listing
CREATE INDEX IF NOT EXISTS idx_price_book_listing
    ON b2b.price_book_entries(price_book_id, product_id)
    INCLUDE (price, currency, discount_percent, valid_from, valid_to);

-- ================================================================
-- Indexes for b2b.orders
-- ================================================================

-- Covering index for customer order history
CREATE INDEX IF NOT EXISTS idx_orders_customer_history
    ON b2b.orders(customer_id, created_at DESC)
    INCLUDE (order_number, status, total_amount, currency);

-- Index for orders by date range
CREATE INDEX IF NOT EXISTS idx_orders_date_range
    ON b2b.orders(created_at DESC, status)
    WHERE status NOT IN ('cancelled', 'refunded');

-- Index for external reference lookup
CREATE INDEX IF NOT EXISTS idx_orders_external_lookup
    ON b2b.orders(external_ref)
    WHERE external_ref IS NOT NULL;

-- Index for orders pending approval
CREATE INDEX IF NOT EXISTS idx_orders_pending_approval
    ON b2b.orders(customer_id, created_at)
    WHERE requires_approval = true AND status = 'pending';

-- Index for orders by payment status
CREATE INDEX IF NOT EXISTS idx_orders_payment_pending
    ON b2b.orders(payment_status, created_at DESC)
    WHERE payment_status IN ('pending', 'partial', 'failed');

-- ================================================================
-- Indexes for b2b.order_items
-- ================================================================

-- Index for items by product (for sales analytics)
CREATE INDEX IF NOT EXISTS idx_order_items_product_sales
    ON b2b.order_items(product_id, order_id)
    INCLUDE (quantity_ordered, unit_price, line_total, created_at);

-- Index for items pending shipping
CREATE INDEX IF NOT EXISTS idx_order_items_pending_ship
    ON b2b.order_items(item_status, warehouse_id)
    WHERE item_status IN ('pending', 'processing');

-- ================================================================
-- Indexes for b2b.credit_ledger
-- ================================================================

-- Index for ledger by account and entry type
CREATE INDEX IF NOT EXISTS idx_credit_ledger_account_type
    ON b2b.credit_ledger(credit_account_id, entry_type, created_at DESC);

-- Index for active reservations
CREATE INDEX IF NOT EXISTS idx_credit_ledger_active_reservations
    ON b2b.credit_ledger(credit_account_id, entry_type, reservation_status)
    WHERE entry_type = 'reserve' AND reservation_status IN ('pending', 'active');

-- Covering index for balance calculation
CREATE INDEX IF NOT EXISTS idx_credit_ledger_balance
    ON b2b.credit_ledger(credit_account_id, created_at DESC)
    INCLUDE (amount, balance_after);

-- ================================================================
-- Indexes for b2b.credit_reservations
-- ================================================================

-- Index for expiring reservations
CREATE INDEX IF NOT EXISTS idx_credit_reservations_expiring
    ON b2b.credit_reservations(expires_at)
    WHERE status IN ('pending', 'active');

-- Covering index for reservation lookup
CREATE INDEX IF NOT EXISTS idx_credit_reservations_lookup
    ON b2b.credit_reservations(credit_account_id, order_id)
    INCLUDE (amount, status, expires_at);

-- ================================================================
-- Indexes for shared.outbox_events
-- ================================================================

-- Index for events awaiting processing
CREATE INDEX IF NOT EXISTS idx_outbox_pending_processing
    ON shared.outbox_events(next_attempt_at, priority DESC)
    WHERE status IN ('pending', 'failed') AND attempts < max_attempts;

-- Index for events by correlation chain
CREATE INDEX IF NOT EXISTS idx_outbox_correlation_chain
    ON shared.outbox_events(correlation_id, occurred_at)
    WHERE correlation_id IS NOT NULL;

-- Index for events by source entity
CREATE INDEX IF NOT EXISTS idx_outbox_source_entity
    ON shared.outbox_events(source_entity_type, source_entity_id)
    WHERE source_entity_type IS NOT NULL;

-- ================================================================
-- PARTITIONED TABLE: shared.outbox_events
-- Monthly partitioning on occurred_at
-- ================================================================

-- Create function to maintain outbox partitions
CREATE OR REPLACE FUNCTION shared.maintain_outbox_partitions(p_months_ahead INTEGER DEFAULT 3)
RETURNS void AS $$
DECLARE
    v_current_month_start DATE;
    v_i INTEGER;
    v_partition_name TEXT;
    v_partition_start TEXT;
    v_partition_end TEXT;
BEGIN
    v_current_month_start := DATE_TRUNC('month', CURRENT_DATE);

    -- Create current month partition
    FOR v_i IN 0..p_months_ahead LOOP
        v_partition_name := format('outbox_events_%s_%s',
            to_char(v_current_month_start + (v_i || ' months')::INTERVAL, 'YYYY'),
            to_char(v_current_month_start + (v_i || ' months')::INTERVAL, 'MM'));

        v_partition_start := to_char(v_current_month_start + (v_i || ' months')::INTERVAL, 'YYYY-MM-01');
        v_partition_end := to_char(v_current_month_start + ((v_i + 1) || ' months')::INTERVAL, 'YYYY-MM-01');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS shared.%s PARTITION OF shared.outbox_events
             FOR VALUES FROM (%L) TO (%L)',
            v_partition_name,
            v_partition_start,
            v_partition_end
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- RETENTION POLICIES
-- ================================================================

-- Create function to manage retention for partitioned tables
CREATE OR REPLACE FUNCTION b2b.manage_retention(
    p_schema TEXT,
    p_table_prefix TEXT,
    p_retention_months INTEGER,
    p_archive_schema TEXT DEFAULT 'archive'
)
RETURNS INTEGER AS $$
DECLARE
    v_cutoff_date DATE;
    v_partition_name TEXT;
    v_archive_partition_name TEXT;
    v_partitions TEXT[];
    v_part TEXT;
    v_count INTEGER := 0;
BEGIN
    -- Calculate cutoff date
    v_cutoff_date := CURRENT_DATE - (p_retention_months || ' months')::INTERVAL;

    -- Get list of partitions older than retention period
    FOR v_partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = p_schema
          AND tablename LIKE (p_table_prefix || '_%')
          AND substring(tablename from '\d{4}_\d{2}$')::date < v_cutoff_date
    LOOP
        v_partitions := array_append(v_partitions, v_partition_name);
    END LOOP;

    -- Process each old partition
    FOREACH v_part IN ARRAY v_partitions LOOP
        -- Rename to archived (in same schema for simplicity, could be different)
        v_archive_partition_name := v_part || '_archived_' || to_char(CURRENT_DATE, 'YYYYMMDD');

        EXECUTE format('ALTER TABLE %s.%s RENAME TO %s.%s',
            p_schema, v_part,
            p_schema, v_archive_partition_name);

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- RETENTION SCHEDULED JOBS (Manual or via external scheduler)
-- ================================================================

-- Function to archive old credit ledger entries
CREATE OR REPLACE FUNCTION b2b.archive_old_credit_ledger(p_retention_months INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
BEGIN
    -- This would move old partitions to archive
    -- For manual execution or scheduled job
    RETURN b2b.manage_retention('b2b', 'credit_ledger', p_retention_months);
END;
$$ LANGUAGE plpgsql;

-- Function to archive old outbox events
CREATE OR REPLACE FUNCTION shared.archive_old_outbox_events(p_retention_months INTEGER DEFAULT 6)
RETURNS INTEGER AS $$
BEGIN
    -- Move published events older than retention period
    RETURN b2b.manage_retention('shared', 'outbox_events', p_retention_months);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up discarded outbox events
CREATE OR REPLACE FUNCTION shared.cleanup_discarded_events(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM shared.outbox_events
    WHERE status = 'discarded'
      AND failed_at < NOW() - (p_days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up resolved dead letter queue items
CREATE OR REPLACE FUNCTION shared.cleanup_resolved_dlq(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM shared.dead_letter_queue
    WHERE resolution_status = 'resolved'
      AND resolved_at < NOW() - (p_days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old credit reservations
CREATE OR REPLACE FUNCTION b2b.expire_old_reservations()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE b2b.credit_reservations
        SET status = 'expired',
            released_at = NOW(),
            updated_at = NOW()
        WHERE status IN ('pending', 'active')
          AND expires_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM expired;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- VIEWS FOR MONITORING PARTITIONS
-- ================================================================

-- View: Partition sizes
CREATE OR REPLACE VIEW shared.partition_sizes AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname IN ('b2b', 'shared')
  AND tablename LIKE '%_20%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

COMMENT ON VIEW shared.partition_sizes IS 'Monitor partition table sizes';

-- View: Partition row counts
CREATE OR REPLACE VIEW shared.partition_row_counts AS
SELECT
    schemaname,
    tablename,
    substring(tablename from '\d{4}_\d{2}$') AS partition_month,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname IN ('b2b', 'shared')
  AND tablename LIKE '%_20%'
ORDER BY substring(tablename from '\d{4}_\d{2}$') DESC;

COMMENT ON VIEW shared.partition_row_counts IS 'Partition row counts and activity';

-- ================================================================
-- VIEWS FOR PERFORMANCE MONITORING
-- ================================================================

-- View: Index usage statistics
CREATE OR REPLACE VIEW shared.index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW'
        WHEN idx_scan < 1000 THEN 'MEDIUM'
        ELSE 'HIGH'
    END AS usage_level
FROM pg_stat_user_indexes
WHERE schemaname IN ('b2b', 'shared')
ORDER BY idx_scan ASC;

COMMENT ON VIEW shared.index_usage_stats IS 'Index usage statistics - identify unused indexes';

-- View: Table sizes
CREATE OR REPLACE VIEW shared.table_sizes AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
    n_live_tup,
    n_dead_tup,
    autovacuum_count,
    vacuum_count
FROM pg_stat_user_tables psut
JOIN pg_tables pt ON psut.schemaname = pt.schemaname AND psut.tablename = pt.tablename
WHERE pt.schemaname IN ('b2b', 'shared')
  AND pt.tablename NOT LIKE '%_20%'
ORDER BY pg_total_relation_size(pt.schemaname||'.'||pt.tablename) DESC;

COMMENT ON VIEW shared.table_sizes IS 'Table sizes and statistics';

-- ================================================================
-- MAINTENANCE FUNCTIONS
-- ================================================================

-- Function to analyze all tables
CREATE OR REPLACE FUNCTION b2b.analyze_all_tables()
RETURNS void AS $$
DECLARE
    v_table RECORD;
BEGIN
    FOR v_table IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'b2b'
    LOOP
        EXECUTE format('ANALYZE %s.%s', v_table.schemaname, v_table.tablename);
        RAISE NOTICE 'Analyzed: %.%', v_table.schemaname, v_table.tablename;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to vacuum analyze all tables
CREATE OR REPLACE FUNCTION b2b.vacuum_analyze_all_tables()
RETURNS void AS $$
DECLARE
    v_table RECORD;
BEGIN
    FOR v_table IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'b2b'
    LOOP
        EXECUTE format('VACUUM (ANALYZE) %s.%s', v_table.schemaname, v_table.tablename);
        RAISE NOTICE 'VACUUM analyzed: %.%', v_table.schemaname, v_table.tablename;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to reindex specific tables
CREATE OR REPLACE FUNCTION b2b.reindex_table(p_schema TEXT, p_table TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE format('REINDEX TABLE %s.%s', p_schema, p_table);
    RAISE NOTICE 'Reindexed: %.%', p_schema, p_table;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- INITIAL PARTITION CREATION
-- ================================================================

-- Create initial partitions for current and next months
-- Note: This assumes tables are created as partitioned from start
-- For existing tables, need to migrate to partitioned structure

-- Example: Create partitions for credit_ledger (if partitioned)
-- SELECT b2b.create_monthly_partition('b2b', 'credit_ledger', CURRENT_DATE, 3);

-- Example: Create partitions for outbox_events (if partitioned)
-- SELECT shared.maintain_outbox_partitions(3);

-- ================================================================
-- SUGGESTED CRON JOBS (for reference, implement externally)
-- ================================================================

-- Weekly: Analyze tables for query optimizer
-- 0 2 * * 0 psql -c "SELECT b2b.analyze_all_tables();"

-- Monthly: Create new partitions for next month
-- 0 3 1 * * psql -c "SELECT shared.maintain_outbox_partitions(6);"

-- Monthly: Archive old data
-- 0 4 2 * * psql -c "SELECT b2b.archive_old_credit_ledger(24);"
-- 0 4 2 * * psql -c "SELECT shared.archive_old_outbox_events(6);"

-- Daily: Expire old reservations
-- 0 5 * * * psql -c "SELECT b2b.expire_old_reservations();"

-- Weekly: Cleanup discarded events
-- 0 6 * * 0 psql -c "SELECT shared.cleanup_discarded_events(30);"

-- ================================================================
-- COMMENTS SUMMARY
-- ================================================================

\echo 'Migration 0006 completed successfully - Indexing, Partitioning, and Retention setup'

-- ================================================================
-- DOWN (Rollback)
-- ================================================================
-- DROP FUNCTION IF EXISTS b2b.reindex_table(TEXT, TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS b2b.vacuum_analyze_all_tables() CASCADE;
-- DROP FUNCTION IF EXISTS b2b.analyze_all_tables() CASCADE;
--
-- DROP FUNCTION IF EXISTS shared.cleanup_resolved_dlq(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS shared.cleanup_discarded_events(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS shared.archive_old_outbox_events(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS b2b.archive_old_credit_ledger(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS b2b.manage_retention(TEXT, TEXT, INTEGER, TEXT) CASCADE;
--
-- DROP FUNCTION IF EXISTS b2b.expire_old_reservations() CASCADE;
--
-- DROP VIEW IF EXISTS shared.table_sizes;
-- DROP VIEW IF EXISTS shared.index_usage_stats;
-- DROP VIEW IF EXISTS shared.partition_row_counts;
-- DROP VIEW IF EXISTS shared.partition_sizes;
--
-- DROP FUNCTION IF EXISTS shared.maintain_outbox_partitions(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS b2b.create_monthly_partition(TEXT, TEXT, DATE, INTEGER) CASCADE;
--
-- DROP INDEX IF EXISTS idx_outbox_source_entity;
-- DROP INDEX IF EXISTS idx_outbox_correlation_chain;
-- DROP INDEX IF EXISTS idx_outbox_pending_processing;
--
-- DROP INDEX IF EXISTS idx_credit_reservations_lookup;
-- DROP INDEX IF EXISTS idx_credit_reservations_expiring;
--
-- DROP INDEX IF EXISTS idx_credit_ledger_balance;
-- DROP INDEX IF EXISTS idx_credit_ledger_active_reservations;
-- DROP INDEX IF EXISTS idx_credit_ledger_account_type;
--
-- DROP INDEX IF EXISTS idx_order_items_pending_ship;
-- DROP INDEX IF EXISTS idx_order_items_product_sales;
--
-- DROP INDEX IF EXISTS idx_orders_payment_pending;
-- DROP INDEX IF EXISTS idx_orders_pending_approval;
-- DROP INDEX IF EXISTS idx_orders_external_lookup;
-- DROP INDEX IF EXISTS idx_orders_date_range;
-- DROP INDEX IF EXISTS idx_orders_customer_history;
--
-- DROP INDEX IF EXISTS idx_price_book_listing;
-- DROP INDEX IF EXISTS idx_price_current;
--
-- DROP INDEX IF EXISTS idx_stock_warehouse_transfer;
-- DROP INDEX IF EXISTS idx_stock_check;
-- DROP INDEX IF EXISTS idx_stock_low_stock;
--
-- DROP INDEX IF EXISTS idx_products_category_brand;
-- DROP INDEX IF EXISTS idx_products_price_range;
-- DROP INDEX IF EXISTS idx_products_catalog_listing;
-- DROP INDEX IF EXISTS idx_products_name_fts;
