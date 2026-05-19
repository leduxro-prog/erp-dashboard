-- B2B product image remediation dry-run.
-- Read-only: emits candidate counts and rows only. It must not update production data.
-- Run with psql. Result sets:
--   1) section_remediation_candidate_counts
--   2) section_remediation_candidate_rows

WITH active_products AS (
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
    sku,
    name,
    current_image_url,
    NULL::text AS recommended_image_url,
    NULL::text AS safe_asset_source,
    'legacy optimized local image_url has no safe product_assets URL' AS reason
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
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'current products.image_url is unsafe and safe product_assets URL exists'
  FROM review_classified_products
  WHERE has_unsafe_image_url = true
    AND safe_asset_url IS NOT NULL
    AND is_azzardo_placeholder = false
    AND is_azzardo_code_mismatch = false
    AND is_azzardo_metadata_mismatch = false

  UNION ALL

  SELECT
    'azzardo_placeholder',
    'manual_review_required',
    product_id,
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'products.image_url contains pl-default-thickbox_default.jpg'
  FROM review_classified_products
  WHERE is_azzardo_placeholder = true

  UNION ALL

  SELECT
    'azzardo_code_mismatch',
    'manual_review_required',
    product_id,
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'SKU AZ code differs from AZ code embedded in image URL: ' || sku_az_code || ' <> ' || image_az_code
  FROM review_classified_products
  WHERE is_azzardo_code_mismatch = true

  UNION ALL

  SELECT
    'azzardo_metadata_mismatch',
    'manual_review_required',
    product_id,
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'metadata supplierFeed.supplierSku differs from SKU: ' || supplier_sku || ' <> ' || UPPER(BTRIM(COALESCE(sku, '')))
  FROM review_classified_products
  WHERE is_azzardo_metadata_mismatch = true
)
SELECT
  'section_remediation_candidate_counts' AS section,
  remediation_category,
  action_recommendation,
  COUNT(*)::bigint AS row_count,
  COUNT(DISTINCT product_id)::bigint AS product_count,
  ARRAY_TO_STRING((ARRAY_AGG(product_id::text ORDER BY product_id))[1:20], ', ') AS sample_product_ids,
  ARRAY_TO_STRING((ARRAY_AGG(COALESCE(NULLIF(current_image_url, ''), '<blank>') ORDER BY product_id))[1:10], ' | ') AS sample_current_image_urls
FROM remediation_candidates
GROUP BY remediation_category, action_recommendation
ORDER BY remediation_category, action_recommendation;

WITH active_products AS (
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
    sku,
    name,
    current_image_url,
    NULL::text AS recommended_image_url,
    NULL::text AS safe_asset_source,
    'legacy optimized local image_url has no safe product_assets URL' AS reason
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
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'current products.image_url is unsafe and safe product_assets URL exists'
  FROM review_classified_products
  WHERE has_unsafe_image_url = true
    AND safe_asset_url IS NOT NULL
    AND is_azzardo_placeholder = false
    AND is_azzardo_code_mismatch = false
    AND is_azzardo_metadata_mismatch = false

  UNION ALL

  SELECT
    'azzardo_placeholder',
    'manual_review_required',
    product_id,
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'products.image_url contains pl-default-thickbox_default.jpg'
  FROM review_classified_products
  WHERE is_azzardo_placeholder = true

  UNION ALL

  SELECT
    'azzardo_code_mismatch',
    'manual_review_required',
    product_id,
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'SKU AZ code differs from AZ code embedded in image URL: ' || sku_az_code || ' <> ' || image_az_code
  FROM review_classified_products
  WHERE is_azzardo_code_mismatch = true

  UNION ALL

  SELECT
    'azzardo_metadata_mismatch',
    'manual_review_required',
    product_id,
    sku,
    name,
    current_image_url,
    safe_asset_url,
    safe_asset_source,
    'metadata supplierFeed.supplierSku differs from SKU: ' || supplier_sku || ' <> ' || UPPER(BTRIM(COALESCE(sku, '')))
  FROM review_classified_products
  WHERE is_azzardo_metadata_mismatch = true
)
SELECT
  'section_remediation_candidate_rows' AS section,
  remediation_category,
  action_recommendation,
  product_id,
  sku,
  name,
  current_image_url,
  recommended_image_url,
  safe_asset_source,
  reason
FROM remediation_candidates
ORDER BY remediation_category, product_id;
