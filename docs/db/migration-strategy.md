# Migration Strategy - Expand/Contract Pattern
**Cypher ERP - B2B Module**
**Version:** 1.0
**Date:** 2026-02-13

---

## 1. Overview

Acest document descrie strategia de migrare pentru baza de date folosind pattern-ul expand/contract. Această strategie asigură migrații zero-downtime și compatibilitate backward.

### 1.1 Principii

| Principiu | Descriere |
|-----------|-----------|
| **Zero Downtime** | Migrările nu întrerup aplicația |
| **Backward Compatible** | Vechea și noua versiune pot coexistă |
| **Idempotent** | Migrările pot fi rulate de mai multe ori în siguranță |
| **Rollable Back** | Fiecare migrare are un rollback definit |
| **Monotonic** | Schimbările sunt doar adăugitive, nu distructive |

---

## 2. Expand/Contract Pattern

Pattern-ul expand/contract constă în 4 faze:

### 2.1 Faza 1: Expand

**Obiectiv:** Adaugă noile structuri fără a elimina cele vechi.

**Operațiuni permise:**
- Creare tabele noi
- Adăugare coloane noi (nullable)
- Adăugare indexuri noi
- Adăugare funcții noi
- Adăugare view-uri noi
- Adăugare ENUM-uri noi

**Exemplu:**

```sql
-- UP (Expand)
ALTER TABLE b2b.orders ADD COLUMN new_field VARCHAR(100);
CREATE INDEX idx_orders_new_field ON b2b.orders(new_field) WHERE new_field IS NOT NULL;

-- DOWN
DROP INDEX IF EXISTS idx_orders_new_field;
ALTER TABLE b2b.orders DROP COLUMN IF EXISTS new_field;
```

### 2.2 Faza 2: Backfill

**Obiectiv:** Populează datele noi în coloanele adăugate.

**Strategii:**
- Batch processing pentru volume mari
- Lock minim (ROW SHARE, nu table lock)
- Progress tracking
- Ability to resume on failure

**Exemplu:**

```sql
-- Backfill script
DO $$
DECLARE
    v_batch_size INTEGER := 10000;
    v_updated INTEGER;
    v_total_updated INTEGER := 0;
BEGIN
    LOOP
        UPDATE b2b.orders
        SET new_field = calculated_field
        WHERE new_field IS NULL
        LIMIT v_batch_size;

        GET DIAGNOSTICS v_updated = ROW_COUNT;
        v_total_updated := v_total_updated + v_updated;

        RAISE NOTICE 'Updated % rows (total: %)', v_updated, v_total_updated;

        COMMIT; -- Commit between batches

        EXIT WHEN v_updated = 0;
    END LOOP;

    RAISE NOTICE 'Backfill complete: % rows updated', v_total_updated;
END;
$$;
```

### 2.3 Faza 3: Read Switch

**Obiectiv:** Aplicația începe să scrie în noul format și să citească din el.

**Pași:**
1. Deploy noua versiune de aplicație care scrie dual-write
2. Verifică consistența datelor
3. Deploy noua versiune care citește din noul format

**Exemplu:**

```sql
-- Make new column NOT NULL after backfill is complete
ALTER TABLE b2b.orders
    ALTER COLUMN new_field SET NOT NULL;

-- Update default value
ALTER TABLE b2b.orders
    ALTER COLUMN new_field SET DEFAULT 'default_value';
```

### 2.4 Faza 4: Contract

**Obiectiv:** Elimină structurile vechi după 1-2 release-uri stabile.

**Operațiuni permise:**
- Eliminarea coloanelor vechi
- Eliminarea indexurilor vechi
- Eliminarea funcțiilor vechi
- Eliminarea tabelelor vechi

**ATENȚIE:** Contract se face într-un release separat, numai după ce toate instanțele aplicației rulează pe noua versiune.

**Exemplu:**

```sql
-- UP (Contract)
DROP INDEX IF EXISTS idx_orders_old_field;
ALTER TABLE b2b.orders DROP COLUMN old_field;

-- DOWN
ALTER TABLE b2b.orders ADD COLUMN old_field VARCHAR(100);
CREATE INDEX idx_orders_old_field ON b2b.orders(old_field);
-- Nota: Nu pot restaura datele pierdute
```

---

## 3. Migration Structure

### 3.1 File Naming

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

### 3.2 Migration Template

```sql
-- ================================================================
-- Migration: {version} - {description}
-- Author: AI 2 (Data/DB)
-- Date: YYYY-MM-DD
-- ================================================================
-- Description: Detailed description of what this migration does
--
-- Impact: What tables/columns are affected
-- Downtime Required: Yes/No
-- Backward Compatible: Yes/No
-- Rollback Safe: Yes/No
--
-- Dependencies: {list of migration versions this depends on}
-- ================================================================

-- ================================================================
-- PHASE 1: EXPAND
-- ================================================================

-- Create new tables
CREATE TABLE IF NOT EXISTS b2b.new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
);

-- Add new columns (nullable)
ALTER TABLE b2b.existing_table ADD COLUMN new_field VARCHAR(100);

-- Create new indexes
CREATE INDEX idx_new_field ON b2b.existing_table(new_field) WHERE new_field IS NOT NULL;

-- ================================================================
-- PHASE 2: BACKFILL (separate script for large tables)
-- ================================================================

-- See backfill template below

-- ================================================================
-- PHASE 3: READ SWITCH (separate migration if needed)
-- ================================================================

-- After application deployment, make column NOT NULL
-- ALTER TABLE b2b.existing_table ALTER COLUMN new_field SET NOT NULL;

-- ================================================================
-- PHASE 4: CONTRACT (separate migration, 1-2 releases later)
-- ================================================================

-- DROP COLUMN old_column;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Verify migration succeeded
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM b2b.new_table;

    IF v_count = 0 THEN
        RAISE EXCEPTION 'Migration failed: new_table is empty';
    END IF;

    RAISE NOTICE 'Migration verification passed: % rows in new_table', v_count;
END;
$$;

\echo 'Migration {version} completed successfully'

-- ================================================================
-- DOWN (Rollback)
-- ================================================================
-- DROP TABLE IF EXISTS b2b.new_table CASCADE;
-- DROP INDEX IF EXISTS idx_new_field;
-- ALTER TABLE b2b.existing_table DROP COLUMN IF EXISTS new_field;
```

---

## 4. Backfill Strategy

### 4.1 Backfill Template

```sql
-- ================================================================
-- Backfill Script for {migration}
-- ================================================================
-- This script populates new columns with data from old structures
-- Run in batches to avoid long-running transactions
-- ================================================================

DO $$
DECLARE
    v_batch_size INTEGER := 10000;          -- Adjust based on table size
    v_delay_ms INTEGER := 100;            -- Delay between batches to reduce load
    v_processed INTEGER := 0;
    v_total_updated INTEGER := 0;
    v_start_time TIMESTAMPTZ;
    v_elapsed INTERVAL;
    v_rows_remaining INTEGER;
BEGIN
    v_start_time := NOW();

    RAISE NOTICE 'Starting backfill at %', v_start_time;

    -- Get total rows to process
    SELECT COUNT(*) INTO v_rows_remaining
    FROM b2b.orders
    WHERE new_field IS NULL;

    RAISE NOTICE 'Total rows to backfill: %', v_rows_remaining;

    -- Process in batches
    WHILE v_rows_remaining > 0 LOOP
        UPDATE b2b.orders
        SET new_field = calculated_value
        WHERE new_field IS NULL
        LIMIT v_batch_size;

        GET DIAGNOSTICS v_processed = ROW_COUNT;
        v_total_updated := v_total_updated + v_processed;

        -- Commit each batch
        COMMIT;

        -- Calculate remaining
        SELECT COUNT(*) INTO v_rows_remaining
        FROM b2b.orders
        WHERE new_field IS NULL;

        -- Progress report
        v_elapsed := NOW() - v_start_time;
        RAISE NOTICE 'Processed % rows (total: %, remaining: %, elapsed: %)',
                     v_processed, v_total_updated, v_rows_remaining, v_elapsed;

        -- Add delay between batches
        IF v_rows_remaining > 0 AND v_processed > 0 THEN
            PERFORM pg_sleep(v_delay_ms / 1000.0);
        END IF;
    END LOOP;

    v_elapsed := NOW() - v_start_time;
    RAISE NOTICE 'Backfill complete! Total rows updated: %, Time taken: %',
                 v_total_updated, v_elapsed;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Backfill failed: %', SQLERRM;
END;
$$;
```

### 4.2 Backfill Best Practices

| Practică | Descriere |
|----------|-----------|
| **Batch Size** | 10,000 pentru tabele mari, mai puțin pentru backfill-uri complexe |
| **Delay Between Batches** | 100-500ms pentru a reduce încărcarea pe DB |
| **Progress Tracking** | Log-uri detaliate pentru a monitoriza progresul |
| **Resume Capability** | Backfill-ul trebuie să poată fi reluat de unde a rămas |
| **Lock Mode** | Folosește `LIMIT` pentru a evita table locks lungi |
| **Testing** | Rulează pe staging înainte de producție |
| **Monitoring** | Monitorizează performanța DB în timpul backfill-ului |

---

## 5. Rollback Strategy

### 5.1 Rollback Criteria

Se face rollback când:
- Migrarea eșuează pe producție
- Probleme de performanță detectate
- Bug-uri în noua structură
- Cerințe de business schimbate

### 5.2 Rollback Types

| Tip | Descriere | Risc |
|-----|-----------|------|
| **Code Rollback** | Deploy codul vechi, DB rămâne | Scăzut |
| **DB Rollback** | Rulează scriptul DOWN | Mediu |
| **Data Restore** | Restore din backup | Ridicat - pierdere date |

### 5.3 Rollback Procedure

1. **Assess impact:** Determină ce s-a modificat
2. **Stop new migrations:** Nu permite migrări noi în timpul rollback-ului
3. **Backup:** Fă backup înainte de rollback
4. **Rollback DB:** Rulează scriptul DOWN al migrării
5. **Rollback Code:** Deploy codul vechi
6. **Verify:** Verifică funcționalitatea
7. **Post-mortem:** Analizează cauzele

### 5.4 Rollback Risk Assessment

| Operațiune | Risc | Observații |
|------------|------|------------|
| CREATE TABLE | Scăzut | DROP TABLE e rapid |
| ADD COLUMN | Scăzut | DROP COLUMN e rapid |
| DROP COLUMN | Ridicat | Datele se pierd |
| DROP TABLE | Ridicat | Datele se pierd |
| MODIFY DATA | Ridicat | Necesită backup |
| CHANGE TYPE | Ridicat | Necesită conversie |

---

## 6. Migration Checklist

### 6.1 Pre-Migration Checklist

- [ ] Migrare testată pe staging cu date reale
- [ ] Backup al bazei de date creat
- [ ] Plan de rollback definit și testat
- [ ] Timpul de estimat comunicat stakeholder-ilor
- [ ] Echipa de operațiuni notificată
- [ ] Monitoring configurat
- [ ] Rollback documentat
- [ ] Comunicare către utilizatori (dacă afectează UX)

### 6.2 Migration Execution Checklist

- [ ] Backup confirmat complet
- [ ] Migrare pornită
- [ ] Progres monitorizat
- [ ] Verificări post-migrare rulate
- [ ] Performance verificat
- [ ] Logs verificate pentru erori
- [ ] Funcționalitate cheie testată
- [ ] Echipa notificată despre completare

### 6.3 Post-Migration Checklist

- [ ] Verificări de integritate rulate
- [ ] Indexuri create
- [ ] Statistici actualizate (ANALYZE)
- [ ] Monitorizare activă pentru 24h
- [ ] Problema raportată și documentată
- [ ] Plan de follow-up definit

---

## 7. Verification Queries

### 7.1 Standard Verifications

```sql
-- Check migration was applied
SELECT * FROM schema_migrations WHERE version = '{version}';

-- Check table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'b2b' AND table_name = '{table_name}';

-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'b2b'
  AND table_name = '{table_name}'
  AND column_name = '{column_name}';

-- Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'b2b' AND tablename = '{table_name}';

-- Check row counts
SELECT COUNT(*) FROM b2b.{table_name};

-- Check data consistency
SELECT COUNT(*) FROM b2b.{table_name} WHERE {new_column} IS NULL;
```

### 7.2 Performance Verifications

```sql
-- EXPLAIN ANALYZE critical query
EXPLAIN ANALYZE
SELECT * FROM b2b.orders
WHERE customer_id = '{test_id}'
ORDER BY created_at DESC
LIMIT 100;

-- Check index usage
SELECT * FROM pg_stat_user_indexes
WHERE schemaname = 'b2b' AND tablename = '{table_name}';

-- Check table statistics
SELECT * FROM pg_stat_user_tables
WHERE schemaname = 'b2b' AND tablename = '{table_name}';
```

---

## 8. Migration Scenarios

### 8.1 Adding a New Column

**Scenario:** Adăugăm coloana `customer_segment` pe `b2b.customers`

**Migration 1 (Expand):**
```sql
ALTER TABLE b2b.customers ADD COLUMN customer_segment VARCHAR(50);
```

**Backfill:**
```sql
UPDATE b2b.customers
SET customer_segment = calculate_segment(total_spend)
WHERE customer_segment IS NULL;
```

**Migration 2 (Read Switch):**
```sql
ALTER TABLE b2b.customers
    ALTER COLUMN customer_segment SET NOT NULL,
    ALTER COLUMN customer_segment SET DEFAULT 'standard';
```

### 8.2 Renaming a Column

**Scenario:** Redenumim `customer_name` în `client_name`

**Migration 1 (Expand):**
```sql
ALTER TABLE b2b.customers ADD COLUMN client_name VARCHAR(255);
UPDATE b2b.customers SET client_name = customer_name;
```

**Migration 2 (Read Switch - code change):**
- Deploy noua versiune care scrie în ambele coloane

**Migration 3 (Contract - after 2 releases):**
```sql
ALTER TABLE b2b.customers DROP COLUMN customer_name;
```

### 8.3 Changing Data Type

**Scenario:** Modificăm `order_number` din VARCHAR(50) în VARCHAR(100)

**Migration 1 (Expand):**
```sql
ALTER TABLE b2b.orders ADD COLUMN order_number_new VARCHAR(100);
UPDATE b2b.orders SET order_number_new = order_number;
```

**Migration 2 (Read Switch):**
```sql
ALTER TABLE b2b.orders DROP CONSTRAINT uq_orders_number;
ALTER TABLE b2b.orders ADD CONSTRAINT uq_orders_number_new UNIQUE (order_number_new);
```

**Migration 3 (Contract):**
```sql
ALTER TABLE b2b.orders DROP COLUMN order_number;
ALTER TABLE b2b.orders RENAME COLUMN order_number_new TO order_number;
ALTER TABLE b2b.orders RENAME CONSTRAINT uq_orders_number_new TO uq_orders_number;
```

---

## 9. Common Pitfalls

| Pitfall | Soluție |
|---------|---------|
| **Long-running transactions** | Folosește batch processing |
| **Table locks** | Evita `LOCK TABLE`, folosește `LIMIT` în UPDATE |
| **No rollback plan** | Definește întotdeauna scriptul DOWN |
| **Skipping staging tests** | Testează mereu pe staging cu date reale |
| **Not monitoring** | Monitorizează performanța în timpul migrării |
| **Forgetting indexes** | Adaugă indexuri pentru noile coloane |
| **Breaking backward compatibility** | Nu elimina structuri vechi prematur |
| **Large backfills in single transaction** | Folosește batch processing cu COMMIT între |

---

## 10. Best Practices

1. **Idempotent migrations:** Scripturile pot fi rulate de mai multe ori
2. **Small, atomic changes:** Una migrare = una schimbare logică
3. **Always include DOWN:** Rollback trebuie să fie posibil
4. **Test with real data:** Datele de test pot fi diferite
5. **Document dependencies:** Notează migrările dependente
6. **Version control:** Ține migrările în git
7. **Peer review:** Migrările criticale trebuie review
8. **Automated testing:** Teste automate pentru verificări
9. **Gradual rollout:** Deploy cu canary dacă e posibil
10. **Post-mortem** Analizează orice problemă

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** AI 2 (Data/DB Architect)
