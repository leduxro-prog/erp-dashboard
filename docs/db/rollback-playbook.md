# Rollback Playbook
**Cypher ERP - B2B Module**
**Version:** 1.0
**Date:** 2026-02-13

---

## 1. Overview

Acest document definește procedura standard de rollback pentru migrațiile de bază de date în Cypher ERP B2B.

### 1.1 Principii de Rollback

| Principiu | Descriere |
|-----------|-----------|
| **Safety First** | Nu facem rollback fără backup valid |
| **Quick Decision** | Rollback în prima oră dacă probleme critice |
| **Documented** | Toate rollback-urile sunt documentate |
| **Tested** | Rollback testat pe staging înainte de prod |
| **Communicated** - Stakeholder-ii notificați |

---

## 2. Rollback Triggers

### 2.1 Critical (Rollback Imediat)

- ❌ Erori critice în logs
- ❌ Performanță degradată > 50%
- ❌ Pierdere de date
- ❌ Funcționalitate P0 nu funcționează
- ❌ Timeout pe query-uri critice

### 2.2 High (Rollback în 1 oră)

- ⚠️ Performanță degradată 20-50%
- ⚠️ Erori neașteptate frecvente
- ⚠️ Feature critic parțial nefuncțional
- ⚠️ Warning-uri mari în logs

### 2.3 Medium (Monitorizează + Decide)

- 📉 Performanță degradată < 20%
- 📉 Erori non-critice ocazionale
- 📉 Feature non-critic afectat

### 2.4 Low (Monitorizează)

- 📊 Warning-uri minore
- 📊 Performanță în limite acceptabile
- 📊 Probleme documentate cunoscute

---

## 3. Rollback Procedure

### 3.1 Pre-Rollback Checklist

- [ ] Probleme confirmate
- [ ] Impact evaluat
- [ ] Rollback planificat
- [ ] Backup verificat disponibil
- [ ] Echipa notificată
- [ ] Timp de stoppage estimat
- [ ] Stakeholder-i notificați

### 3.2 Rollback Steps

```
1. Stop Application
   └── Docker: docker compose down

2. Backup Current State (for safety)
   └── pg_dump -h host -U user -d db > rollback_backup.sql

3. Execute Rollback Script
   └── psql -h host -U user -d db -f migrations/{version}-down.sql

4. Verify Rollback
   └── Run verification queries

5. Restore Previous Code
   └── git checkout {previous_version}

6. Restart Application
   └── docker compose up -d

7. Verify Functionality
   └── Run smoke tests

8. Communicate Completion
   └── Notify team and stakeholders
```

### 3.3 Post-Rollback Checklist

- [ ] DB verificat la starea anterioară
- [ ] Aplicația pornită funcțională
- [ ] Smoke tests trecute
- [ ] Logs verificate (fără erori)
- [ ] Performanță la nivelul normal
- [ ] Echipa notificată
- [ ] Post-mortem programat

---

## 4. Rollback Scripts

### 4.1 Generic Rollback Script

```bash
#!/bin/bash
# rollback.sh - Generic rollback script
# Usage: ./rollback.sh <migration_version>

set -e

MIGRATION_VERSION=$1
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cypher_erp}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="/var/backups/cypher-erp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate input
if [ -z "$MIGRATION_VERSION" ]; then
    log_error "Migration version required"
    echo "Usage: $0 <migration_version>"
    exit 1
fi

# Check if migration exists
MIGRATION_FILE="migrations/${MIGRATION_VERSION}-*.sql"
if ! ls $MIGRATION_FILE 1> /dev/null 2>&1; then
    log_error "Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Pre-rollback backup
log_info "Creating pre-rollback backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    > "$BACKUP_DIR/backup_before_rollback_${MIGRATION_VERSION}_${TIMESTAMP}.sql"

if [ $? -ne 0 ]; then
    log_error "Backup failed! Aborting rollback."
    exit 1
fi

log_info "Backup created: $BACKUP_DIR/backup_before_rollback_${MIGRATION_VERSION}_${TIMESTAMP}.sql"

# Extract DOWN script from migration file
log_info "Extracting DOWN script..."
DOWN_FILE="/tmp/rollback_${MIGRATION_VERSION}_${TIMESTAMP}.sql"

# Extract lines after "DOWN (Rollback)" marker
awk '/-- DOWN \(Rollback\)/,0' $MIGRATION_FILE > $DOWN_FILE

# Execute rollback
log_info "Executing rollback for migration $MIGRATION_VERSION..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DOWN_FILE"

if [ $? -ne 0 ]; then
    log_error "Rollback failed!"
    log_error "Backup available at: $BACKUP_DIR/backup_before_rollback_${MIGRATION_VERSION}_${TIMESTAMP}.sql"
    exit 1
fi

# Cleanup
rm -f "$DOWN_FILE"

log_info "Rollback completed successfully!"
log_info "Backup preserved at: $BACKUP_DIR/backup_before_rollback_${MIGRATION_VERSION}_${TIMESTAMP}.sql"
```

### 4.2 Rollback Individual Migrations

#### Migration 0001: Roles and Schemas

```sql
-- DOWN (Rollback)
DROP FUNCTION IF EXISTS b2b.set_timestamps() CASCADE;
DROP FUNCTION IF EXISTS b2b.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS grant_schema_permissions() CASCADE;
DROP FUNCTION IF EXISTS has_schema_access(text) CASCADE;

DROP ROLE IF EXISTS b2b_app;
DROP ROLE IF EXISTS erp_app;
DROP ROLE IF EXISTS report_app;
DROP ROLE IF EXISTS b2b_rw;
DROP ROLE IF EXISTS erp_rw;
DROP ROLE IF EXISTS report_ro;

DROP SCHEMA IF EXISTS b2b CASCADE;
DROP SCHEMA IF EXISTS erp CASCADE;
DROP SCHEMA IF EXISTS shared CASCADE;

-- Optionally drop extensions (be careful with shared resources)
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS "pgcrypto";
```

#### Migration 0002: Catalog, Customers, Pricing, Stock

```sql
-- DOWN (Rollback)
DROP TABLE IF EXISTS b2b.customer_shipping_addresses CASCADE;
DROP TABLE IF EXISTS b2b.customer_contacts CASCADE;
DROP TABLE IF EXISTS b2b.customer_tiers CASCADE;
DROP TABLE IF EXISTS b2b.customers CASCADE;
DROP TABLE IF EXISTS b2b.stock_levels CASCADE;
DROP TABLE IF EXISTS b2b.price_book_entries CASCADE;
DROP TABLE IF EXISTS b2b.price_books CASCADE;
DROP TABLE IF EXISTS b2b.product_attributes CASCADE;
DROP TABLE IF EXISTS b2b.product_media CASCADE;
DROP TABLE IF EXISTS b2b.product_variants CASCADE;
DROP TABLE IF EXISTS b2b.products CASCADE;

DROP TYPE IF EXISTS b2b_product_status;
DROP TYPE IF EXISTS b2b_customer_tier;
DROP TYPE IF EXISTS b2b_customer_status;
DROP TYPE IF EXISTS b2b_stock_level_status;
DROP TYPE IF EXISTS b2b_price_type;
```

#### Migration 0003: Cart, Orders, Snapshots

```sql
-- DOWN (Rollback)
DROP TABLE IF EXISTS b2b.order_shipments CASCADE;
DROP TABLE IF EXISTS b2b.order_items_snapshot CASCADE;
DROP TABLE IF EXISTS b2b.order_items CASCADE;
DROP TABLE IF EXISTS b2b.orders CASCADE;
DROP TABLE IF EXISTS b2b.quote_items_snapshot CASCADE;
DROP TABLE IF EXISTS b2b.quote_items CASCADE;
DROP TABLE IF EXISTS b2b.quotes CASCADE;
DROP TABLE IF EXISTS b2b.cart_items CASCADE;
DROP TABLE IF EXISTS b2b.carts CASCADE;

DROP TYPE IF EXISTS b2b_cart_status;
DROP TYPE IF EXISTS b2b_quote_status;
DROP TYPE IF EXISTS b2b_order_status;
DROP TYPE IF EXISTS b2b_payment_status;
DROP TYPE IF EXISTS b2b_shipping_status;
```

#### Migration 0004: Credit Accounts and Ledger

```sql
-- DOWN (Rollback)
DROP TRIGGER IF EXISTS credit_ledger_balance_update ON b2b.credit_ledger;
DROP FUNCTION IF EXISTS b2b.update_credit_account_balance() CASCADE;
DROP FUNCTION IF EXISTS b2b.is_reservation_valid_for_release(UUID) CASCADE;
DROP FUNCTION IF EXISTS b2b.calculate_available_credit(UUID) CASCADE;
DROP FUNCTION IF EXISTS b2b.calculate_reserved_amount(UUID) CASCADE;
DROP FUNCTION IF EXISTS b2b.calculate_credit_balance(UUID) CASCADE;

DROP TABLE IF EXISTS b2b.credit_invoice_items CASCADE;
DROP TABLE IF EXISTS b2b.credit_invoices CASCADE;
DROP TABLE IF EXISTS b2b.credit_transactions CASCADE;
DROP TABLE IF EXISTS b2b.credit_reservations CASCADE;
DROP TABLE IF EXISTS b2b.credit_ledger CASCADE;
DROP TABLE IF EXISTS b2b.credit_accounts CASCADE;

DROP TYPE IF EXISTS b2b_credit_entry_type;
DROP TYPE IF EXISTS b2b_credit_status;
DROP TYPE IF EXISTS b2b_reservation_status;
```

#### Migration 0005: Outbox Events

```sql
-- DOWN (Rollback)
DROP FUNCTION IF EXISTS shared.delete_discarded_events(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS shared.archive_published_events(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS shared.mark_events_failed(UUID[], VARCHAR, VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS shared.mark_events_published(UUID[]) CASCADE;
DROP FUNCTION IF EXISTS shared.mark_events_processing(UUID[]) CASCADE;
DROP FUNCTION IF EXISTS shared.get_next_events(VARCHAR, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS shared.record_event_processing(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, JSONB, VARCHAR, VARCHAR, JSONB, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS shared.is_event_processed(UUID, VARCHAR) CASCADE;

DROP VIEW IF EXISTS shared.consumer_processing_stats;
DROP VIEW IF EXISTS shared.failed_events_alert;
DROP VIEW IF EXISTS shared.outbox_events_summary;

DROP TABLE IF EXISTS shared.event_replay CASCADE;
DROP TABLE IF EXISTS shared.dead_letter_queue CASCADE;
DROP TABLE IF EXISTS shared.event_subscriptions CASCADE;
DROP TABLE IF EXISTS shared.processed_events CASCADE;
DROP TABLE IF EXISTS shared.outbox_events CASCADE;

DROP TYPE IF EXISTS shared_event_priority;
DROP TYPE IF EXISTS shared_event_domain;
DROP TYPE IF EXISTS shared_outbox_status;
```

#### Migration 0006: Indexing, Partitioning, Retention

```sql
-- DOWN (Rollback)
DROP FUNCTION IF EXISTS b2b.reindex_table(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS b2b.vacuum_analyze_all_tables() CASCADE;
DROP FUNCTION IF EXISTS b2b.analyze_all_tables() CASCADE;

DROP FUNCTION IF EXISTS shared.cleanup_resolved_dlq(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS shared.cleanup_discarded_events(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS shared.archive_old_outbox_events(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS b2b.archive_old_credit_ledger(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS b2b.manage_retention(TEXT, TEXT, INTEGER, TEXT) CASCADE;

DROP FUNCTION IF EXISTS b2b.expire_old_reservations() CASCADE;

DROP VIEW IF EXISTS shared.table_sizes;
DROP VIEW IF EXISTS shared.index_usage_stats;
DROP VIEW IF EXISTS shared.partition_row_counts;
DROP VIEW IF EXISTS shared.partition_sizes;

DROP FUNCTION IF EXISTS shared.maintain_outbox_partitions(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS b2b.create_monthly_partition(TEXT, TEXT, DATE, INTEGER) CASCADE;

DROP INDEX IF EXISTS idx_outbox_source_entity;
DROP INDEX IF EXISTS idx_outbox_correlation_chain;
DROP INDEX IF EXISTS idx_outbox_pending_processing;

DROP INDEX IF EXISTS idx_credit_reservations_lookup;
DROP INDEX IF EXISTS idx_credit_reservations_expiring;

DROP INDEX IF EXISTS idx_credit_ledger_balance;
DROP INDEX IF EXISTS idx_credit_ledger_active_reservations;
DROP INDEX IF EXISTS idx_credit_ledger_account_type;

DROP INDEX IF EXISTS idx_order_items_pending_ship;
DROP INDEX IF EXISTS idx_order_items_product_sales;

DROP INDEX IF EXISTS idx_orders_payment_pending;
DROP INDEX IF EXISTS idx_orders_pending_approval;
DROP INDEX IF EXISTS idx_orders_external_lookup;
DROP INDEX IF EXISTS idx_orders_date_range;
DROP INDEX IF EXISTS idx_orders_customer_history;

DROP INDEX IF EXISTS idx_price_book_listing;
DROP INDEX IF EXISTS idx_price_current;

DROP INDEX IF EXISTS idx_stock_warehouse_transfer;
DROP INDEX IF EXISTS idx_stock_check;
DROP INDEX IF EXISTS idx_stock_low_stock;

DROP INDEX IF EXISTS idx_products_category_brand;
DROP INDEX IF EXISTS idx_products_price_range;
DROP INDEX IF EXISTS idx_products_catalog_listing;
DROP INDEX IF EXISTS idx_products_name_fts;
```

---

## 5. Rollback Scenarios

### 5.1 Scenario: Column Addition Failed

**Situație:** S-a adăugat coloana nouă dar backfill-ul a eșuat.

**Rollback:**
```sql
DROP INDEX IF EXISTS idx_new_column;
ALTER TABLE b2b.orders DROP COLUMN IF EXISTS new_column;
```

**Verificare:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'new_column';
-- Should return 0 rows
```

### 5.2 Scenario: Table Creation Failed

**Situație:** Tabelul nou creat dar constraint-uri invalide.

**Rollback:**
```sql
DROP TABLE IF EXISTS b2b.new_table CASCADE;
```

**Verificare:**
```sql
SELECT * FROM information_schema.tables
WHERE table_schema = 'b2b' AND table_name = 'new_table';
-- Should return 0 rows
```

### 5.3 Scenario: Index Creation Caused Performance Issues

**Situație:** Index nou scade performanța la INSERT.

**Rollback:**
```sql
DROP INDEX IF EXISTS idx_problematic_index;
```

**Verificare:**
```sql
SELECT * FROM pg_indexes WHERE indexname = 'idx_problematic_index';
-- Should return 0 rows
```

### 5.4 Scenario: Data Corruption During Backfill

**Situație:** Backfill-ul a corupt datele.

**Rollback:**
```bash
# 1. Stop application
docker compose down

# 2. Restore from backup
psql -h host -U user -d db < backup_before_migration.sql

# 3. Start application
docker compose up -d
```

---

## 6. Verification Queries

### 6.1 Post-Rollback Verification

```sql
-- Check DB version
SELECT version();

-- Check schemas exist
SELECT nspname FROM pg_namespace
WHERE nspname IN ('b2b', 'erp', 'shared')
ORDER BY nspname;

-- Check key tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'b2b'
ORDER BY table_name;

-- Check row counts for critical tables
SELECT
    'products' as table_name, COUNT(*) as row_count
FROM b2b.products
UNION ALL
SELECT 'customers', COUNT(*) FROM b2b.customers
UNION ALL
SELECT 'orders', COUNT(*) FROM b2b.orders;

-- Check no orphaned foreign keys
SELECT COUNT(*) FROM b2b.order_items
WHERE order_id NOT IN (SELECT id FROM b2b.orders);

-- Check constraints are valid
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'b2b.orders'::regclass
ORDER BY conname;
```

### 6.2 Performance Verification

```sql
-- Critical query performance
EXPLAIN ANALYZE
SELECT * FROM b2b.orders
WHERE customer_id = (SELECT id FROM b2b.customers LIMIT 1)
ORDER BY created_at DESC
LIMIT 100;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'b2b'
ORDER BY idx_scan DESC
LIMIT 10;

-- Check table statistics
SELECT schemaname, tablename, n_live_tup, n_dead_tup,
       autovacuum_count, vacuum_count
FROM pg_stat_user_tables
WHERE schemaname = 'b2b'
ORDER BY tablename;
```

---

## 7. Emergency Rollback

### 7.1 When to Use Emergency Rollback

- ❌ Performanță complet blocată
- ❌ Pierdere de date
- ❌ Aplicația nu pornește
- ❌ Erori critice în loguri

### 7.2 Emergency Rollback Procedure

```bash
#!/bin/bash
# emergency_rollback.sh

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cypher_erp}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="/var/backups/cypher-erp"

# Find latest backup
LATEST_BACKUP=$(ls -t $BACKUP_DIR/backup_before_migration_*.sql | head -1)

echo "EMERGENCY ROLLBACK"
echo "=================="
echo "Using backup: $LATEST_BACKUP"
echo ""
echo "This will:"
echo "  1. Stop the application"
echo "  2. Restore the database"
echo "  3. Start the application"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Stop application
echo "Stopping application..."
docker compose down

# Restore backup
echo "Restoring backup..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$LATEST_BACKUP"

if [ $? -ne 0 ]; then
    echo "ERROR: Restore failed!"
    exit 1
fi

# Start application
echo "Starting application..."
docker compose up -d

echo ""
echo "EMERGENCY ROLLBACK COMPLETED"
echo "============================"
echo "Please verify application functionality"
```

---

## 8. Post-Mortem Template

### 8.1 Post-Molltem Questions

1. **Ce s-a întâmplat?**
2. **Care a fost cauza?**
3. **Ce a funcționat bine în rollback?**
4. **Ce nu a funcționat bine?**
5. **Ce putem îmbunătăți?**
6. **Trebuie să actualizăm documentația?**

### 8.2 Post-Mortem Template

```markdown
# Post-Mortem: Rollback of Migration {version}

## Date
- Date: {date}
- Migration: {version}
- Rolled back by: {person}

## Problem Description
{Description of what went wrong}

## Impact Assessment
- Impact Level: {Critical/High/Medium/Low}
- Downtime: {X minutes}
- Affected Users: {count or all}

## Root Cause
{Root cause analysis}

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Migration started |
| HH:MM | Problem detected |
| HH:MM | Rollback initiated |
| HH:MM | Rollback completed |

## Rollback Process
{Description of rollback process}

## Lessons Learned
{What we learned}

## Action Items
| Item | Owner | Due Date |
|------|-------|----------|
| Fix migration bug | {person} | {date} |
| Update documentation | {person} | {date} |

## Attachments
- Logs: {link}
- Metrics: {link}
```

---

## 9. Contact Information

| Rol | Persoană | Contact |
|-----|----------|---------|
| DBA Lead | TBD | TBD |
| Engineering Lead | TBD | TBD |
| DevOps Lead | TBD | TBD |
| Product Owner | TBD | TBD |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** AI 2 (Data/DB Architect)
