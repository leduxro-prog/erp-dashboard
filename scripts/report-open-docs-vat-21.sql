-- VAT 21% consistency report for open/draft documents.
--
-- Output columns:
--   target       - checked table name
--   status_scope - statuses included in the check
--   mismatches   - rows that do not match 21% VAT formulas
--   sample_ids   - up to 5 example IDs for quick triage
--
-- Last row is a synthetic aggregate:
--   target='__TOTAL__', mismatches=<sum of all mismatches>

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

CREATE TEMP TABLE vat_open_docs_report (
  target TEXT NOT NULL,
  status_scope TEXT NOT NULL,
  mismatches BIGINT NOT NULL,
  sample_ids TEXT NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'public.orders',
        'quote_pending,quote_sent,quote_accepted',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT o.id::text
              FROM orders o
              WHERE o.status::text IN ('quote_pending', 'quote_sent', 'quote_accepted')
                AND o.deleted_at IS NULL
                AND (
                  ABS(COALESCE(o.tax_amount, 0) - ROUND(GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 0.21, 2)) > 0.01
                  OR ABS(
                    COALESCE(o.total_amount, 0)
                    - ROUND(
                      GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 1.21
                      + COALESCE(o.shipping_cost, 0),
                      2
                    )
                  ) > 0.01
                )
              ORDER BY o.updated_at DESC NULLS LAST, o.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM orders o
      WHERE o.status::text IN ('quote_pending', 'quote_sent', 'quote_accepted')
        AND o.deleted_at IS NULL
        AND (
          ABS(COALESCE(o.tax_amount, 0) - ROUND(GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 0.21, 2)) > 0.01
          OR ABS(
            COALESCE(o.total_amount, 0)
            - ROUND(
              GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 1.21
              + COALESCE(o.shipping_cost, 0),
              2
            )
          ) > 0.01
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('public.orders (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('public.orders') IS NOT NULL AND to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'public.order_items',
        'parent:quote_pending,quote_sent,quote_accepted',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT oi.id::text
              FROM order_items oi
              JOIN orders o ON o.id = oi.order_id
              WHERE o.status::text IN ('quote_pending', 'quote_sent', 'quote_accepted')
                AND o.deleted_at IS NULL
                AND ABS(
                  COALESCE(oi.tax_amount, 0)
                  - ROUND(GREATEST(oi.line_total - COALESCE(oi.discount_amount, 0), 0) * 0.21, 2)
                ) > 0.01
              ORDER BY oi.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status::text IN ('quote_pending', 'quote_sent', 'quote_accepted')
        AND o.deleted_at IS NULL
        AND ABS(
          COALESCE(oi.tax_amount, 0)
          - ROUND(GREATEST(oi.line_total - COALESCE(oi.discount_amount, 0), 0) * 0.21, 2)
        ) > 0.01;
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('public.order_items (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('public.quotes') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'public.quotes',
        'draft,pending,sent,viewed',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT q.id::text
              FROM quotes q
              WHERE q.status::text IN ('draft', 'pending', 'sent', 'viewed')
                AND (
                  ABS(COALESCE(q.tax_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 0.21, 2)) > 0.01
                  OR ABS(COALESCE(q.total_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 1.21, 2)) > 0.01
                )
              ORDER BY q.updated_at DESC NULLS LAST, q.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM quotes q
      WHERE q.status::text IN ('draft', 'pending', 'sent', 'viewed')
        AND (
          ABS(COALESCE(q.tax_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 0.21, 2)) > 0.01
          OR ABS(COALESCE(q.total_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 1.21, 2)) > 0.01
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('public.quotes (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('public.quotes') IS NOT NULL AND to_regclass('public.quote_items') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'public.quote_items',
        'parent:draft,pending,sent,viewed',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT qi.id::text
              FROM quote_items qi
              JOIN quotes q ON q.id = qi.quote_id
              WHERE q.status::text IN ('draft', 'pending', 'sent', 'viewed')
                AND ABS(
                  COALESCE(qi.tax_amount, 0)
                  - ROUND(GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 0.21, 2)
                ) > 0.01
              ORDER BY qi.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM quote_items qi
      JOIN quotes q ON q.id = qi.quote_id
      WHERE q.status::text IN ('draft', 'pending', 'sent', 'viewed')
        AND ABS(
          COALESCE(qi.tax_amount, 0)
          - ROUND(GREATEST((qi.quantity * qi.unit_price) - COALESCE(qi.discount_amount, 0), 0) * 0.21, 2)
        ) > 0.01;
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('public.quote_items (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('public.b2b_orders') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'public.b2b_orders',
        'PENDING,CONFIRMED,PROCESSING,ON_HOLD',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT bo.id::text
              FROM b2b_orders bo
              WHERE UPPER(bo.status) IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'ON_HOLD')
                AND (
                  ABS(COALESCE(bo.vat_amount, 0) - ROUND(GREATEST(bo.subtotal - COALESCE(bo.discount_amount, 0), 0) * 0.21, 2)) > 0.01
                  OR ABS(
                    COALESCE(bo.total, 0)
                    - ROUND(
                      GREATEST(bo.subtotal - COALESCE(bo.discount_amount, 0), 0) * 1.21
                      + COALESCE(bo.shipping_cost, 0),
                      2
                    )
                  ) > 0.01
                )
              ORDER BY bo.updated_at DESC NULLS LAST, bo.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM b2b_orders bo
      WHERE UPPER(bo.status) IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'ON_HOLD')
        AND (
          ABS(COALESCE(bo.vat_amount, 0) - ROUND(GREATEST(bo.subtotal - COALESCE(bo.discount_amount, 0), 0) * 0.21, 2)) > 0.01
          OR ABS(
            COALESCE(bo.total, 0)
            - ROUND(
              GREATEST(bo.subtotal - COALESCE(bo.discount_amount, 0), 0) * 1.21
              + COALESCE(bo.shipping_cost, 0),
              2
            )
          ) > 0.01
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('public.b2b_orders (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('b2b.orders') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'b2b.orders',
        'pending,confirmed,processing,on_hold',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT o.id::text
              FROM b2b.orders o
              WHERE o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
                AND o.deleted_at IS NULL
                AND (
                  ABS(COALESCE(o.tax_amount, 0) - ROUND(GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
                  OR ABS(
                    COALESCE(o.total_amount, 0)
                    - ROUND(
                      GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 1.21
                      + COALESCE(o.shipping_amount, 0),
                      4
                    )
                  ) > 0.0001
                )
              ORDER BY o.updated_at DESC NULLS LAST, o.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM b2b.orders o
      WHERE o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
        AND o.deleted_at IS NULL
        AND (
          ABS(COALESCE(o.tax_amount, 0) - ROUND(GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
          OR ABS(
            COALESCE(o.total_amount, 0)
            - ROUND(
              GREATEST(o.subtotal - COALESCE(o.discount_amount, 0), 0) * 1.21
              + COALESCE(o.shipping_amount, 0),
              4
            )
          ) > 0.0001
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('b2b.orders (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('b2b.orders') IS NOT NULL AND to_regclass('b2b.order_items') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'b2b.order_items',
        'parent:pending,confirmed,processing,on_hold',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT oi.id::text
              FROM b2b.order_items oi
              JOIN b2b.orders o ON o.id = oi.order_id
              WHERE o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
                AND o.deleted_at IS NULL
                AND (
                  ABS(COALESCE(oi.tax_rate, 0) - 0.21) > 0.0001
                  OR ABS(COALESCE(oi.tax_amount, 0) - ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
                  OR ABS(COALESCE(oi.line_total, 0) - ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
                )
              ORDER BY oi.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM b2b.order_items oi
      JOIN b2b.orders o ON o.id = oi.order_id
      WHERE o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
        AND o.deleted_at IS NULL
        AND (
          ABS(COALESCE(oi.tax_rate, 0) - 0.21) > 0.0001
          OR ABS(COALESCE(oi.tax_amount, 0) - ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
          OR ABS(COALESCE(oi.line_total, 0) - ROUND(GREATEST(oi.subtotal - COALESCE(oi.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('b2b.order_items (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('b2b.orders') IS NOT NULL AND to_regclass('b2b.order_items_snapshot') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'b2b.order_items_snapshot',
        'parent:pending,confirmed,processing,on_hold',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT os.id::text
              FROM b2b.order_items_snapshot os
              JOIN b2b.orders o ON o.id = os.order_id
              WHERE o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
                AND o.deleted_at IS NULL
                AND (
                  ABS(COALESCE(os.tax_rate, 0) - 0.21) > 0.0001
                  OR ABS(COALESCE(os.tax_amount, 0) - ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
                  OR ABS(COALESCE(os.line_total, 0) - ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
                )
              ORDER BY os.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM b2b.order_items_snapshot os
      JOIN b2b.orders o ON o.id = os.order_id
      WHERE o.status::text IN ('pending', 'confirmed', 'processing', 'on_hold')
        AND o.deleted_at IS NULL
        AND (
          ABS(COALESCE(os.tax_rate, 0) - 0.21) > 0.0001
          OR ABS(COALESCE(os.tax_amount, 0) - ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
          OR ABS(COALESCE(os.line_total, 0) - ROUND(GREATEST(os.subtotal - COALESCE(os.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('b2b.order_items_snapshot (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('b2b.quotes') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'b2b.quotes',
        'draft,sent',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT q.id::text
              FROM b2b.quotes q
              WHERE q.status::text IN ('draft', 'sent')
                AND q.deleted_at IS NULL
                AND (
                  ABS(COALESCE(q.tax_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
                  OR ABS(COALESCE(q.total_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
                )
              ORDER BY q.updated_at DESC NULLS LAST, q.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM b2b.quotes q
      WHERE q.status::text IN ('draft', 'sent')
        AND q.deleted_at IS NULL
        AND (
          ABS(COALESCE(q.tax_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
          OR ABS(COALESCE(q.total_amount, 0) - ROUND(GREATEST(q.subtotal - COALESCE(q.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('b2b.quotes (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('b2b.quotes') IS NOT NULL AND to_regclass('b2b.quote_items') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'b2b.quote_items',
        'parent:draft,sent',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT qi.id::text
              FROM b2b.quote_items qi
              JOIN b2b.quotes q ON q.id = qi.quote_id
              WHERE q.status::text IN ('draft', 'sent')
                AND q.deleted_at IS NULL
                AND (
                  ABS(COALESCE(qi.tax_rate, 0) - 0.21) > 0.0001
                  OR ABS(COALESCE(qi.tax_amount, 0) - ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
                  OR ABS(COALESCE(qi.line_total, 0) - ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
                )
              ORDER BY qi.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM b2b.quote_items qi
      JOIN b2b.quotes q ON q.id = qi.quote_id
      WHERE q.status::text IN ('draft', 'sent')
        AND q.deleted_at IS NULL
        AND (
          ABS(COALESCE(qi.tax_rate, 0) - 0.21) > 0.0001
          OR ABS(COALESCE(qi.tax_amount, 0) - ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
          OR ABS(COALESCE(qi.line_total, 0) - ROUND(GREATEST(qi.subtotal - COALESCE(qi.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('b2b.quote_items (missing)', 'n/a', 0, '');
  END IF;

  IF to_regclass('b2b.quotes') IS NOT NULL AND to_regclass('b2b.quote_items_snapshot') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO vat_open_docs_report (target, status_scope, mismatches, sample_ids)
      SELECT
        'b2b.quote_items_snapshot',
        'parent:draft,sent',
        COUNT(*),
        COALESCE(
          array_to_string(
            ARRAY(
              SELECT qs.id::text
              FROM b2b.quote_items_snapshot qs
              JOIN b2b.quotes q ON q.id = qs.quote_id
              WHERE q.status::text IN ('draft', 'sent')
                AND q.deleted_at IS NULL
                AND (
                  ABS(COALESCE(qs.tax_rate, 0) - 0.21) > 0.0001
                  OR ABS(COALESCE(qs.tax_amount, 0) - ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
                  OR ABS(COALESCE(qs.line_total, 0) - ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
                )
              ORDER BY qs.id
              LIMIT 5
            ),
            ', '
          ),
          ''
        )
      FROM b2b.quote_items_snapshot qs
      JOIN b2b.quotes q ON q.id = qs.quote_id
      WHERE q.status::text IN ('draft', 'sent')
        AND q.deleted_at IS NULL
        AND (
          ABS(COALESCE(qs.tax_rate, 0) - 0.21) > 0.0001
          OR ABS(COALESCE(qs.tax_amount, 0) - ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 0.21, 4)) > 0.0001
          OR ABS(COALESCE(qs.line_total, 0) - ROUND(GREATEST(qs.subtotal - COALESCE(qs.discount_amount, 0), 0) * 1.21, 4)) > 0.0001
        );
    $sql$;
  ELSE
    INSERT INTO vat_open_docs_report VALUES ('b2b.quote_items_snapshot (missing)', 'n/a', 0, '');
  END IF;
END
$$;

SELECT target, status_scope, mismatches, sample_ids
FROM (
  SELECT target, status_scope, mismatches, sample_ids, 0 AS sort_order
  FROM vat_open_docs_report
  UNION ALL
  SELECT '__TOTAL__', '', COALESCE(SUM(mismatches), 0)::BIGINT, '', 1 AS sort_order
  FROM vat_open_docs_report
) rows
ORDER BY sort_order, target;

COMMIT;
