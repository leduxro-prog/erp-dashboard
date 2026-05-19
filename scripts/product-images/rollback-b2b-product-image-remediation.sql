-- B2B product image remediation rollback script.
-- DANGER: This mutates products.image_url and products.metadata.
-- Restores exact previous values from ops_backup_product_images_20260510 only when:
--   - product metadata is still marked with b2bProductImageRemediation20260510, and
--   - current products.image_url still matches the image value applied by the remediation.
-- Required invocation:
--   psql "$DATABASE_URL" \
--     -v approved_b2b_product_image_rollback=I_APPROVE_B2B_PRODUCT_IMAGE_ROLLBACK_20260510 \
--     -f scripts/product-images/rollback-b2b-product-image-remediation.sql

\if :{?approved_b2b_product_image_rollback}
\else
  \set approved_b2b_product_image_rollback 'NOT_APPROVED'
\endif

SELECT set_config(
  'app.approved_b2b_product_image_rollback',
  :'approved_b2b_product_image_rollback',
  false
) AS approval_status;

DO $$
BEGIN
  IF current_setting('app.approved_b2b_product_image_rollback', true) <> 'I_APPROVE_B2B_PRODUCT_IMAGE_ROLLBACK_20260510' THEN
    RAISE EXCEPTION 'Missing approval: set approved_b2b_product_image_rollback=I_APPROVE_B2B_PRODUCT_IMAGE_ROLLBACK_20260510';
  END IF;
END $$;

BEGIN;

ALTER TABLE ops_backup_product_images_20260510
  ADD COLUMN IF NOT EXISTS applied_image_url text;

ALTER TABLE ops_backup_product_images_20260510
  ADD COLUMN IF NOT EXISTS remediation_marker text NOT NULL DEFAULT 'b2bProductImageRemediation20260510';

WITH rollback_eligible_rows AS (
  SELECT
    p.id AS product_id,
    b.previous_image_url,
    b.previous_metadata,
    b.remediation_category,
    b.action_recommendation,
    b.applied_image_url,
    b.remediation_marker
  FROM ops_backup_product_images_20260510 b
  JOIN products p ON p.id = b.product_id
  WHERE COALESCE(b.remediation_marker, '') = 'b2bProductImageRemediation20260510'
    AND p.metadata ? 'b2bProductImageRemediation20260510'
    AND p.metadata->'b2bProductImageRemediation20260510'->>'actionRecommendation' = b.action_recommendation
    AND p.metadata->'b2bProductImageRemediation20260510'->>'remediationCategory' = b.remediation_category
    AND BTRIM(COALESCE(p.image_url, '')) = BTRIM(COALESCE(b.applied_image_url, ''))
), restored_products AS (
  UPDATE products p
  SET
    image_url = rer.previous_image_url,
    metadata = rer.previous_metadata,
    updated_at = NOW()
  FROM rollback_eligible_rows rer
  WHERE p.id = rer.product_id
  RETURNING
    p.id AS product_id,
    rer.remediation_category,
    rer.action_recommendation,
    rer.previous_image_url AS restored_image_url
)
SELECT
  'section_rollback_summary' AS section,
  remediation_category,
  action_recommendation,
  COUNT(*)::bigint AS restored_count,
  ARRAY_TO_STRING((ARRAY_AGG(product_id::text ORDER BY product_id))[1:20], ', ') AS sample_product_ids
FROM restored_products
GROUP BY remediation_category, action_recommendation
ORDER BY remediation_category, action_recommendation;

COMMIT;
