-- Recalculate VAT to 21% for open/draft documents only.
-- Safe to re-run (idempotent): it only touches non-final statuses.
--
-- Run with:
--   psql "$DATABASE_URL" -f scripts/recalculate-open-docs-vat-21.sql
--   bash scripts/recalculate-open-docs-vat-21.sh --dry-run --guard
--   bash scripts/recalculate-open-docs-vat-21.sh --apply --guard

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $$
DECLARE
  updated_count BIGINT;
BEGIN
  -- ERP orders (open quote phase only)
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    UPDATE orders
    SET tax_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2),
        total_amount = ROUND(
          GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21
          + COALESCE(shipping_cost, 0),
          2
        ),
        updated_at = NOW()
    WHERE status::text IN ('quote_pending', 'quote_sent', 'quote_accepted')
      AND deleted_at IS NULL
      AND (
        ABS(
          COALESCE(tax_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2)
        ) > 0.01
        OR ABS(
          COALESCE(total_amount, 0)
          - ROUND(
            GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21
            + COALESCE(shipping_cost, 0),
            2
          )
        ) > 0.01
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'orders updated: %', updated_count;

    UPDATE order_items oi
    SET tax_amount = ROUND(GREATEST(oi.line_total - COALESCE(oi.discount_amount, 0), 0) * 0.21, 2),
        updated_at = NOW()
    FROM orders o
    WHERE oi.order_id = o.id
      AND o.status::text IN ('quote_pending', 'quote_sent', 'quote_accepted')
      AND o.deleted_at IS NULL
      AND ABS(
        COALESCE(oi.tax_amount, 0)
        - ROUND(GREATEST(oi.line_total - COALESCE(oi.discount_amount, 0), 0) * 0.21, 2)
      ) > 0.01;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'order_items updated: %', updated_count;
  ELSE
    RAISE NOTICE 'orders table not found, skipping ERP orders update';
  END IF;

  -- ERP quotes (open only)
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quotes'
  ) THEN
    UPDATE quotes
    SET tax_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2),
        total_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21, 2),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('taxRate', 0.21),
        updated_at = NOW()
    WHERE status::text IN ('draft', 'pending', 'sent', 'viewed')
      AND (
        ABS(
          COALESCE(tax_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2)
        ) > 0.01
        OR ABS(
          COALESCE(total_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21, 2)
        ) > 0.01
        OR (metadata->>'taxRate') IS DISTINCT FROM '0.21'
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'quotes updated: %', updated_count;

    UPDATE quote_items qi
    SET tax_amount = ROUND(
          GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 0.21,
          2
        ),
        updated_at = NOW()
    FROM quotes q
    WHERE qi.quote_id = q.id
      AND q.status::text IN ('draft', 'pending', 'sent', 'viewed')
      AND ABS(
        COALESCE(qi.tax_amount, 0)
        - ROUND(
          GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 0.21,
          2
        )
      ) > 0.01;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'quote_items updated: %', updated_count;
  ELSE
    RAISE NOTICE 'quotes table not found, skipping ERP quotes update';
  END IF;

  -- Alternative quotations module tables (if present)
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quotations'
  ) THEN
    UPDATE quotations
    SET tax_rate = 21,
        tax_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2),
        total_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21, 2),
        updated_at = NOW()
    WHERE status IN ('draft', 'pending', 'sent', 'viewed')
      AND deleted_at IS NULL
      AND (
        COALESCE(tax_rate, 0) <> 21
        OR ABS(
          COALESCE(tax_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2)
        ) > 0.01
        OR ABS(
          COALESCE(total_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21, 2)
        ) > 0.01
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'quotations updated: %', updated_count;

    UPDATE quotation_items qi
    SET tax_rate = 21,
        tax_amount = ROUND(
          GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 0.21,
          2
        ),
        total_amount = ROUND(
          GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 1.21,
          2
        )
    FROM quotations q
    WHERE qi.quotation_id = q.id
      AND q.status IN ('draft', 'pending', 'sent', 'viewed')
      AND q.deleted_at IS NULL
      AND (
        COALESCE(qi.tax_rate, 0) <> 21
        OR ABS(
          COALESCE(qi.tax_amount, 0)
          - ROUND(
            GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 0.21,
            2
          )
        ) > 0.01
        OR ABS(
          COALESCE(qi.total_amount, 0)
          - ROUND(
            GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 1.21,
            2
          )
        ) > 0.01
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'quotation_items updated: %', updated_count;
  ELSE
    RAISE NOTICE 'quotations table not found, skipping alternative quotations update';
  END IF;

  -- Legacy B2B orders table
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'b2b_orders'
  ) THEN
    UPDATE b2b_orders
    SET vat_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2),
        total = ROUND(
          GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21
          + COALESCE(shipping_cost, 0),
          2
        ),
        updated_at = NOW()
    WHERE UPPER(status) IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'ON_HOLD')
      AND (
        ABS(
          COALESCE(vat_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 2)
        ) > 0.01
        OR ABS(
          COALESCE(total, 0)
          - ROUND(
            GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21
            + COALESCE(shipping_cost, 0),
            2
          )
        ) > 0.01
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'b2b_orders updated: %', updated_count;
  ELSE
    RAISE NOTICE 'b2b_orders table not found, skipping legacy B2B update';
  END IF;

  -- New B2B schema orders and quotes
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'b2b' AND table_name = 'orders'
  ) THEN
    UPDATE b2b.orders
    SET tax_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 4),
        total_amount = ROUND(
          GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21
          + COALESCE(shipping_amount, 0),
          4
        ),
        updated_at = NOW()
    WHERE status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
      AND deleted_at IS NULL
      AND (
        ABS(
          COALESCE(tax_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 4)
        ) > 0.0001
        OR ABS(
          COALESCE(total_amount, 0)
          - ROUND(
            GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21
            + COALESCE(shipping_amount, 0),
            4
          )
        ) > 0.0001
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'b2b.orders updated: %', updated_count;

    UPDATE b2b.order_items oi
    SET tax_rate = 0.21,
        tax_amount = ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 0.21, 4),
        line_total = ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 1.21, 4),
        updated_at = NOW()
    FROM b2b.orders o
    WHERE oi.order_id = o.id
      AND o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
      AND o.deleted_at IS NULL
      AND (
        ABS(COALESCE(oi.tax_rate, 0) - 0.21) > 0.0001
        OR ABS(
          COALESCE(oi.tax_amount, 0)
          - ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 0.21, 4)
        ) > 0.0001
        OR ABS(
          COALESCE(oi.line_total, 0)
          - ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 1.21, 4)
        ) > 0.0001
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'b2b.order_items updated: %', updated_count;

    UPDATE b2b.order_items_snapshot os
    SET tax_rate = 0.21,
        tax_amount = ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 0.21, 4),
        line_total = ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 1.21, 4)
    FROM b2b.orders o
    WHERE os.order_id = o.id
      AND o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
      AND o.deleted_at IS NULL
      AND (
        ABS(COALESCE(os.tax_rate, 0) - 0.21) > 0.0001
        OR ABS(
          COALESCE(os.tax_amount, 0)
          - ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 0.21, 4)
        ) > 0.0001
        OR ABS(
          COALESCE(os.line_total, 0)
          - ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 1.21, 4)
        ) > 0.0001
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'b2b.order_items_snapshot updated: %', updated_count;
  ELSE
    RAISE NOTICE 'b2b.orders table not found, skipping new B2B orders update';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'b2b' AND table_name = 'quotes'
  ) THEN
    UPDATE b2b.quotes
    SET tax_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 4),
        total_amount = ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21, 4),
        updated_at = NOW()
    WHERE status::text IN ('draft', 'sent')
      AND deleted_at IS NULL
      AND (
        ABS(
          COALESCE(tax_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 0.21, 4)
        ) > 0.0001
        OR ABS(
          COALESCE(total_amount, 0)
          - ROUND(GREATEST(subtotal - COALESCE(discount_amount, 0), 0) * 1.21, 4)
        ) > 0.0001
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'b2b.quotes updated: %', updated_count;

    UPDATE b2b.quote_items qi
    SET tax_rate = 0.21,
        tax_amount = ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 0.21, 4),
        line_total = ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 1.21, 4),
        updated_at = NOW()
    FROM b2b.quotes q
    WHERE qi.quote_id = q.id
      AND q.status::text IN ('draft', 'sent')
      AND q.deleted_at IS NULL
      AND (
        ABS(COALESCE(qi.tax_rate, 0) - 0.21) > 0.0001
        OR ABS(
          COALESCE(qi.tax_amount, 0)
          - ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 0.21, 4)
        ) > 0.0001
        OR ABS(
          COALESCE(qi.line_total, 0)
          - ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 1.21, 4)
        ) > 0.0001
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'b2b.quote_items updated: %', updated_count;

    UPDATE b2b.quote_items_snapshot qs
    SET tax_rate = 0.21,
        tax_amount = ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 0.21, 4),
        line_total = ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 1.21, 4)
    FROM b2b.quotes q
    WHERE qs.quote_id = q.id
      AND q.status::text IN ('draft', 'sent')
      AND q.deleted_at IS NULL
      AND (
        ABS(COALESCE(qs.tax_rate, 0) - 0.21) > 0.0001
        OR ABS(
          COALESCE(qs.tax_amount, 0)
          - ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 0.21, 4)
        ) > 0.0001
        OR ABS(
          COALESCE(qs.line_total, 0)
          - ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 1.21, 4)
        ) > 0.0001
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'b2b.quote_items_snapshot updated: %', updated_count;
  ELSE
    RAISE NOTICE 'b2b.quotes table not found, skipping new B2B quotes update';
  END IF;
END
$$;

COMMIT;
