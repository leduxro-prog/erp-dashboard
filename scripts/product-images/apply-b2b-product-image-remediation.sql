-- B2B product image remediation apply script.
-- DANGER: This mutates products.image_url and products.metadata.
-- Approval gate: run only after reviewing dry-run output and approved candidates.
-- Required invocation:
--   psql "$DATABASE_URL" \
--     -v approved_b2b_product_image_remediation=I_APPROVE_B2B_PRODUCT_IMAGE_REMEDIATION_20260510 \
--     -f scripts/product-images/apply-b2b-product-image-remediation.sql
-- Safety properties:
--   - Fails closed unless the approval variable above is supplied.
--   - Re-derives the same candidate set as the dry-run before updating.
--   - Approved rows must exactly match product_id, action_recommendation,
--     current_image_url, and recommended_image_url for replacement actions.
--   - Fails closed on duplicate/conflicting approved rows before any update.
--   - Backs up exact previous image_url and metadata, plus applied values, before any update.
--   - The approved candidate CTE is intentionally empty until populated from reviewed dry-run rows.

\if :{?approved_b2b_product_image_remediation}
\else
  \set approved_b2b_product_image_remediation 'NOT_APPROVED'
\endif

SELECT set_config(
  'app.approved_b2b_product_image_remediation',
  :'approved_b2b_product_image_remediation',
  false
) AS approval_status;

DO $$
BEGIN
  IF current_setting('app.approved_b2b_product_image_remediation', true) <> 'I_APPROVE_B2B_PRODUCT_IMAGE_REMEDIATION_20260510' THEN
    RAISE EXCEPTION 'Missing approval: set approved_b2b_product_image_remediation=I_APPROVE_B2B_PRODUCT_IMAGE_REMEDIATION_20260510';
  END IF;
END $$;

BEGIN;

CREATE TABLE IF NOT EXISTS ops_backup_product_images_20260510 (
  product_id bigint PRIMARY KEY,
  previous_image_url text,
  previous_metadata jsonb,
  backup_reason text NOT NULL,
  remediation_category text NOT NULL,
  action_recommendation text NOT NULL,
  recommended_image_url text,
  applied_image_url text,
  remediation_marker text NOT NULL DEFAULT 'b2bProductImageRemediation20260510',
  backed_up_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE ops_backup_product_images_20260510
  ADD COLUMN IF NOT EXISTS applied_image_url text;

ALTER TABLE ops_backup_product_images_20260510
  ADD COLUMN IF NOT EXISTS remediation_marker text NOT NULL DEFAULT 'b2bProductImageRemediation20260510';

WITH approved_candidates AS (
  -- COMMENT-APPROVAL REQUIRED: add reviewed rows copied from dry-run candidate output.
  -- Clear example after approval only:
  -- SELECT 123::bigint AS product_id,
  --        'clear_image_url_only'::text AS action_recommendation,
  --        '/optimized/uploads/optimized/products/123/old.webp'::text AS current_image_url,
  --        NULL::text AS recommended_image_url
  -- UNION ALL
  -- Replace example after approval only:
  -- SELECT 456::bigint AS product_id,
  --        'replace_with_safe_asset'::text AS action_recommendation,
  --        '/optimized/uploads/optimized/products/456/old.webp'::text AS current_image_url,
  --        'https://storage.example/products/456/new.webp'::text AS recommended_image_url
  SELECT
    NULL::bigint AS product_id,
    NULL::text AS action_recommendation,
    NULL::text AS current_image_url,
    NULL::text AS recommended_image_url
  WHERE false
), approved_conflicts AS (
  SELECT
    product_id,
    COUNT(*) AS row_count,
    COUNT(DISTINCT action_recommendation) AS action_count,
    COUNT(DISTINCT current_image_url) AS current_image_count,
    COUNT(DISTINCT COALESCE(recommended_image_url, '<NULL>')) AS recommended_image_count
  FROM approved_candidates
  GROUP BY product_id
  HAVING COUNT(*) > 1
    OR COUNT(DISTINCT action_recommendation) > 1
    OR COUNT(DISTINCT current_image_url) > 1
    OR COUNT(DISTINCT COALESCE(recommended_image_url, '<NULL>')) > 1
), approved_shape_errors AS (
  SELECT product_id
  FROM approved_candidates
  WHERE product_id IS NULL
    OR action_recommendation NOT IN ('clear_image_url_only', 'replace_with_safe_asset')
    OR current_image_url IS NULL
    OR (action_recommendation = 'clear_image_url_only' AND recommended_image_url IS NOT NULL)
    OR (action_recommendation = 'replace_with_safe_asset' AND BTRIM(COALESCE(recommended_image_url, '')) !~* '^https?://')
), active_products AS (
  SELECT
    p.id AS product_id,
    p.sku,
    p.name,
    UPPER(NULLIF(BTRIM(COALESCE(p.metadata #>> '{supplierFeed,supplierSku}', '')), '')) AS supplier_sku,
    BTRIM(COALESCE(p.image_url, '')) AS current_image_url,
    LOWER(BTRIM(COALESCE(p.image_url, ''))) AS lower_image_url
  FROM products p
  WHERE p.is_active = true
    AND p.deleted_at IS NULL
), asset_url_candidates AS (
  SELECT
    pa.product_id,
    pa.id AS asset_id,
    COALESCE(pa.is_primary, false) AS is_primary,
    pa.sort_order,
    candidate.url_source,
    candidate.candidate_url,
    LOWER(candidate.candidate_url) AS lower_candidate_url
  FROM product_assets pa
  CROSS JOIN LATERAL (
    VALUES
      ('storage_url', BTRIM(COALESCE(pa.storage_url, ''))),
      ('source_url', BTRIM(COALESCE(pa.source_url, '')))
  ) AS candidate(url_source, candidate_url)
  WHERE pa.is_active = true
    AND pa.asset_type = 'image'
    AND candidate.candidate_url <> ''
), safe_asset_candidates AS (
  SELECT
    product_id,
    url_source,
    candidate_url,
    ROW_NUMBER() OVER (
      PARTITION BY product_id
      ORDER BY
        is_primary DESC,
        sort_order ASC NULLS LAST,
        asset_id ASC,
        CASE url_source WHEN 'storage_url' THEN 0 ELSE 1 END,
        candidate_url
    ) AS candidate_rank
  FROM asset_url_candidates
  WHERE lower_candidate_url ~ '^https?://'
    AND lower_candidate_url NOT LIKE '%pl-default-thickbox_default.jpg%'
    AND lower_candidate_url NOT LIKE '%woocommerce-placeholder%'
), primary_safe_assets AS (
  SELECT
    product_id,
    url_source AS safe_asset_source,
    candidate_url AS safe_asset_url
  FROM safe_asset_candidates
  WHERE candidate_rank = 1
), annotated_products AS (
  SELECT
    ap.*,
    psa.safe_asset_source,
    psa.safe_asset_url,
    UPPER((REGEXP_MATCH(COALESCE(ap.sku, ''), '(AZ[0-9]{4})', 'i'))[1]) AS sku_az_code,
    UPPER((REGEXP_MATCH(ap.current_image_url, '(AZ[0-9]{4})', 'i'))[1]) AS image_az_code,
    (
      ap.lower_image_url = ''
      OR ap.lower_image_url LIKE '%pl-default-thickbox_default.jpg%'
      OR ap.lower_image_url LIKE '%woocommerce-placeholder%'
      OR ap.lower_image_url !~ '^https?://'
    ) AS has_unsafe_image_url
  FROM active_products ap
  LEFT JOIN primary_safe_assets psa ON psa.product_id = ap.product_id
), review_classified_products AS (
  SELECT
    *,
    lower_image_url LIKE '%pl-default-thickbox_default.jpg%' AS is_azzardo_placeholder,
    (
      sku_az_code IS NOT NULL
      AND image_az_code IS NOT NULL
      AND sku_az_code <> image_az_code
    ) AS is_azzardo_code_mismatch,
    (
      sku_az_code IS NOT NULL
      AND supplier_sku IS NOT NULL
      AND supplier_sku <> UPPER(BTRIM(COALESCE(sku, '')))
    ) AS is_azzardo_metadata_mismatch
  FROM annotated_products
), remediation_candidates AS (
  SELECT
    'legacy_emptyable_image_url' AS remediation_category,
    'clear_image_url_only' AS action_recommendation,
    product_id,
    current_image_url,
    NULL::text AS recommended_image_url,
    NULL::text AS applied_image_url,
    'legacy optimized local image_url has no safe product_assets URL' AS backup_reason
  FROM review_classified_products
  WHERE lower_image_url LIKE '/optimized/uploads/optimized/%'
    AND safe_asset_url IS NULL
    AND is_azzardo_placeholder = false
    AND is_azzardo_code_mismatch = false
    AND is_azzardo_metadata_mismatch = false

  UNION ALL

  SELECT
    'safe_asset_replacement',
    'replace_with_safe_asset',
    product_id,
    current_image_url,
    safe_asset_url,
    safe_asset_url,
    'current products.image_url is unsafe and safe product_assets URL exists'
  FROM review_classified_products
  WHERE has_unsafe_image_url = true
    AND safe_asset_url IS NOT NULL
    AND is_azzardo_placeholder = false
    AND is_azzardo_code_mismatch = false
    AND is_azzardo_metadata_mismatch = false
), matched_approved_candidates AS (
  SELECT
    rc.*
  FROM approved_candidates ac
  JOIN remediation_candidates rc
    ON rc.product_id = ac.product_id
   AND rc.action_recommendation = ac.action_recommendation
   AND rc.current_image_url = ac.current_image_url
   AND (
     rc.action_recommendation = 'clear_image_url_only'
     OR rc.recommended_image_url = ac.recommended_image_url
   )
), unmatched_approved_candidates AS (
  SELECT ac.product_id
  FROM approved_candidates ac
  LEFT JOIN matched_approved_candidates mac
    ON mac.product_id = ac.product_id
   AND mac.action_recommendation = ac.action_recommendation
   AND mac.current_image_url = ac.current_image_url
   AND (
     mac.action_recommendation = 'clear_image_url_only'
     OR mac.recommended_image_url = ac.recommended_image_url
   )
  WHERE mac.product_id IS NULL
), validation_guard AS (
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM approved_conflicts) THEN 1 / (SELECT COUNT(*) FROM approved_candidates WHERE false)
    WHEN EXISTS (SELECT 1 FROM approved_shape_errors) THEN 1 / (SELECT COUNT(*) FROM approved_candidates WHERE false)
    WHEN EXISTS (SELECT 1 FROM unmatched_approved_candidates) THEN 1 / (SELECT COUNT(*) FROM approved_candidates WHERE false)
    ELSE 1
  END AS ok
), validated_matches AS (
  SELECT mac.*
  FROM validation_guard vg
  LEFT JOIN matched_approved_candidates mac ON true
  WHERE vg.ok = 1
    AND mac.product_id IS NOT NULL
), backup_insert AS (
  INSERT INTO ops_backup_product_images_20260510 (
    product_id,
    previous_image_url,
    previous_metadata,
    backup_reason,
    remediation_category,
    action_recommendation,
    recommended_image_url,
    applied_image_url,
    remediation_marker
  )
  SELECT
    p.id,
    p.image_url,
    p.metadata,
    mac.backup_reason,
    mac.remediation_category,
    mac.action_recommendation,
    mac.recommended_image_url,
    mac.applied_image_url,
    'b2bProductImageRemediation20260510'
  FROM validated_matches mac
  JOIN products p ON p.id = mac.product_id
  ON CONFLICT (product_id) DO NOTHING
  RETURNING product_id
), updated_products AS (
  UPDATE products p
  SET
    image_url = mac.applied_image_url,
    metadata = COALESCE(p.metadata, '{}'::jsonb) || jsonb_build_object(
      'b2bProductImageRemediation20260510', jsonb_build_object(
        'actionRecommendation', mac.action_recommendation,
        'remediationCategory', mac.remediation_category,
        'appliedImageUrl', mac.applied_image_url,
        'appliedAt', NOW()
      )
    ),
    updated_at = NOW()
  FROM validated_matches mac
  JOIN backup_insert bi ON bi.product_id = mac.product_id
  WHERE p.id = mac.product_id
    AND BTRIM(COALESCE(p.image_url, '')) = mac.current_image_url
  RETURNING p.id AS product_id, mac.action_recommendation, p.image_url AS applied_image_url
)
SELECT
  'section_apply_summary' AS section,
  action_recommendation,
  COUNT(*)::bigint AS updated_count,
  ARRAY_TO_STRING((ARRAY_AGG(product_id::text ORDER BY product_id))[1:20], ', ') AS sample_product_ids
FROM updated_products
GROUP BY action_recommendation
ORDER BY action_recommendation;

COMMIT;
