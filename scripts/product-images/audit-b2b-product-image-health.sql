-- B2B product image health audit.
-- Run with psql. Each result set uses section, metric, item_count, sample_product_ids, sample_values.

WITH table_health AS (
  SELECT
    'product_images' AS table_name,
    COUNT(*)::bigint AS total_rows,
    COUNT(*) FILTER (WHERE image_url IS NOT NULL AND BTRIM(image_url) <> '')::bigint AS rows_with_url,
    COUNT(DISTINCT product_id)::bigint AS products_with_rows
  FROM product_images
  UNION ALL
  SELECT
    'inventory_product_projection',
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE primary_image_url IS NOT NULL AND BTRIM(primary_image_url) <> '')::bigint,
    COUNT(DISTINCT product_id)::bigint
  FROM inventory_product_projection
  UNION ALL
  SELECT
    'product_assets',
    COUNT(*)::bigint,
    COUNT(*) FILTER (
      WHERE COALESCE(BTRIM(storage_url), '') <> '' OR COALESCE(BTRIM(source_url), '') <> ''
    )::bigint,
    COUNT(DISTINCT product_id)::bigint
  FROM product_assets
)
SELECT
  'section_table_health' AS section,
  table_name AS metric,
  total_rows AS item_count,
  products_with_rows AS product_count,
  rows_with_url AS url_count,
  NULL::text AS sample_product_ids,
  NULL::text AS sample_values
FROM table_health
ORDER BY metric;

WITH active_product_urls AS (
  SELECT
    p.id,
    p.sku,
    p.name,
    BTRIM(COALESCE(p.image_url, '')) AS image_url,
    LOWER(BTRIM(COALESCE(p.image_url, ''))) AS lower_url
  FROM products p
  WHERE p.is_active = true
    AND p.deleted_at IS NULL
), categorized AS (
  SELECT 'bad_optimized' AS metric, id, image_url
  FROM active_product_urls
  WHERE lower_url <> ''
    AND lower_url !~ '^https?://'
    AND (
      lower_url LIKE '%/optimized/uploads/optimized/%'
      OR lower_url LIKE '%/uploads/optimized/%'
      OR lower_url LIKE '%/uploads/products/%'
    )
  UNION ALL
  SELECT 'azzardo_placeholder', id, image_url
  FROM active_product_urls
  WHERE lower_url LIKE '%pl-default-thickbox_default.jpg%'
  UNION ALL
  SELECT 'woo_placeholder', id, image_url
  FROM active_product_urls
  WHERE lower_url LIKE '%woocommerce-placeholder%'
  UNION ALL
  SELECT 'object_storage', id, image_url
  FROM active_product_urls
  WHERE lower_url ~ '^https?://'
    AND (
      lower_url LIKE '%supabase%'
      OR lower_url LIKE '%storage.googleapis.com%'
      OR lower_url LIKE '%digitaloceanspaces.com%'
      OR lower_url LIKE '%amazonaws.com%'
      OR lower_url LIKE '%cloudfront.net%'
      OR lower_url LIKE '%r2.cloudflarestorage.com%'
    )
)
SELECT
  'section_url_categories' AS section,
  metric,
  COUNT(*)::bigint AS item_count,
  COUNT(DISTINCT id)::bigint AS product_count,
  NULL::bigint AS url_count,
  ARRAY_TO_STRING((ARRAY_AGG(id::text ORDER BY id))[1:20], ', ') AS sample_product_ids,
  ARRAY_TO_STRING((ARRAY_AGG(image_url ORDER BY id))[1:10], ' | ') AS sample_values
FROM categorized
GROUP BY metric
ORDER BY metric;

WITH active_assets AS (
  SELECT
    pa.product_id,
    BTRIM(COALESCE(pa.storage_url, '')) AS storage_url,
    BTRIM(COALESCE(pa.source_url, '')) AS source_url,
    LOWER(BTRIM(COALESCE(pa.storage_url, ''))) AS lower_storage_url,
    LOWER(BTRIM(COALESCE(pa.source_url, ''))) AS lower_source_url
  FROM product_assets pa
  JOIN products p ON p.id = pa.product_id
  WHERE p.is_active = true
    AND p.deleted_at IS NULL
    AND pa.is_active = true
    AND pa.asset_type = 'image'
), asset_url_candidates AS (
  SELECT product_id, 'storage_url' AS url_source, storage_url AS candidate_url, lower_storage_url AS lower_url
  FROM active_assets
  WHERE storage_url <> ''
  UNION ALL
  SELECT product_id, 'source_url', source_url, lower_source_url
  FROM active_assets
  WHERE source_url <> ''
), candidate_rows AS (
  SELECT 'products_with_assets' AS metric, product_id, COALESCE(NULLIF(storage_url, ''), source_url) AS sample_value
  FROM active_assets
  UNION ALL
  SELECT 'object_storage_candidates', product_id, candidate_url
  FROM asset_url_candidates
  WHERE lower_url ~ '^https?://'
    AND lower_url NOT LIKE '%pl-default-thickbox_default.jpg%'
    AND lower_url NOT LIKE '%woocommerce-placeholder%'
    AND url_source = 'storage_url'
  UNION ALL
  SELECT 'local_upload_candidates', product_id, candidate_url
  FROM asset_url_candidates
  WHERE lower_url LIKE '/uploads/%'
    OR lower_url LIKE '/optimized/%'
  UNION ALL
  SELECT 'external_http_candidates', product_id, candidate_url
  FROM asset_url_candidates
  WHERE lower_url ~ '^https?://'
    AND lower_url NOT LIKE '%pl-default-thickbox_default.jpg%'
    AND lower_url NOT LIKE '%woocommerce-placeholder%'
    AND url_source = 'source_url'
)
SELECT
  'section_asset_candidate_coverage' AS section,
  metric,
  COUNT(*)::bigint AS item_count,
  COUNT(DISTINCT product_id)::bigint AS product_count,
  COUNT(*) FILTER (WHERE sample_value IS NOT NULL AND sample_value <> '')::bigint AS url_count,
  ARRAY_TO_STRING((ARRAY_AGG(DISTINCT product_id::text ORDER BY product_id::text))[1:20], ', ') AS sample_product_ids,
  ARRAY_TO_STRING((ARRAY_AGG(DISTINCT sample_value ORDER BY sample_value) FILTER (WHERE sample_value IS NOT NULL AND sample_value <> ''))[1:10], ' | ') AS sample_values
FROM candidate_rows
GROUP BY metric
ORDER BY metric;

SELECT
  'section_reused_product_image_urls' AS section,
  'reused_products.image_url' AS metric,
  COUNT(*)::bigint AS item_count,
  COUNT(DISTINCT p.id)::bigint AS product_count,
  1::bigint AS url_count,
  ARRAY_TO_STRING((ARRAY_AGG(p.id::text ORDER BY p.id))[1:20], ', ') AS sample_product_ids,
  BTRIM(p.image_url) AS sample_values
FROM products p
WHERE p.is_active = true
  AND p.deleted_at IS NULL
  AND p.image_url IS NOT NULL
  AND BTRIM(p.image_url) <> ''
GROUP BY BTRIM(p.image_url)
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, BTRIM(p.image_url)
LIMIT 50;

WITH azzardo_codes AS (
  SELECT
    p.id,
    p.sku,
    p.name,
    p.image_url,
    UPPER((REGEXP_MATCH(COALESCE(p.sku, '') || ' ' || COALESCE(p.name, ''), '(AZ[0-9]{4,})', 'i'))[1]) AS product_code,
    UPPER((REGEXP_MATCH(COALESCE(p.image_url, ''), '(AZ[0-9]{4,})', 'i'))[1]) AS image_code
  FROM products p
  WHERE p.is_active = true
    AND p.deleted_at IS NULL
    AND (
      COALESCE(p.sku, '') ~* 'AZ[0-9]{4,}'
      OR COALESCE(p.name, '') ~* 'AZ[0-9]{4,}'
      OR COALESCE(p.image_url, '') ~* 'AZ[0-9]{4,}'
    )
), mismatches AS (
  SELECT *
  FROM azzardo_codes
  WHERE product_code IS NOT NULL
    AND image_code IS NOT NULL
    AND product_code <> image_code
)
SELECT
  'section_azzardo_image_code_mismatch' AS section,
  'mismatch_count' AS metric,
  COUNT(*)::bigint AS item_count,
  COUNT(DISTINCT id)::bigint AS product_count,
  NULL::bigint AS url_count,
  ARRAY_TO_STRING((ARRAY_AGG(id::text ORDER BY id))[1:20], ', ') AS sample_product_ids,
  ARRAY_TO_STRING((ARRAY_AGG(product_code || ' <> ' || image_code || ' :: ' || COALESCE(sku, '') || ' :: ' || COALESCE(image_url, '') ORDER BY id))[1:10], ' | ') AS sample_values
FROM mismatches;

WITH active_products AS (
  SELECT
    p.id,
    p.sku,
    p.name,
    BTRIM(COALESCE(p.image_url, '')) AS image_url,
    LOWER(BTRIM(COALESCE(p.image_url, ''))) AS lower_url
  FROM products p
  WHERE p.is_active = true
    AND p.deleted_at IS NULL
), unsafe_products AS (
  SELECT *
  FROM active_products
  WHERE lower_url = ''
    OR lower_url LIKE '%pl-default-thickbox_default.jpg%'
    OR lower_url LIKE '%woocommerce-placeholder%'
    OR lower_url !~ '^https?://'
), asset_url_candidates AS (
  SELECT
    pa.product_id,
    candidate.candidate_url,
    LOWER(candidate.candidate_url) AS lower_url
  FROM product_assets pa
  CROSS JOIN LATERAL (
    VALUES
      (BTRIM(COALESCE(pa.storage_url, ''))),
      (BTRIM(COALESCE(pa.source_url, '')))
  ) AS candidate(candidate_url)
  WHERE pa.is_active = true
    AND pa.asset_type = 'image'
    AND candidate.candidate_url <> ''
), safe_asset_candidates AS (
  SELECT product_id, candidate_url
  FROM asset_url_candidates
  WHERE lower_url ~ '^https?://'
    AND lower_url NOT LIKE '%pl-default-thickbox_default.jpg%'
    AND lower_url NOT LIKE '%woocommerce-placeholder%'
), matched AS (
  SELECT
    up.id,
    up.image_url,
    MIN(sac.candidate_url) AS candidate_url
  FROM unsafe_products up
  JOIN safe_asset_candidates sac ON sac.product_id = up.id
  GROUP BY up.id, up.image_url
)
SELECT
  'section_unsafe_product_image_with_safe_asset' AS section,
  'unsafe_products_with_safe_asset_candidate' AS metric,
  COUNT(*)::bigint AS item_count,
  COUNT(DISTINCT id)::bigint AS product_count,
  COUNT(DISTINCT candidate_url)::bigint AS url_count,
  ARRAY_TO_STRING((ARRAY_AGG(id::text ORDER BY id))[1:20], ', ') AS sample_product_ids,
  ARRAY_TO_STRING((ARRAY_AGG(COALESCE(NULLIF(image_url, ''), '<blank>') || ' => ' || candidate_url ORDER BY id))[1:10], ' | ') AS sample_values
FROM matched;
