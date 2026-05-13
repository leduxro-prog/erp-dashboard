-- Azzardo product image manual review export.
-- Read-only: emits candidate rows only. It must not update production data.
--
-- Review workflow:
--   1) Export this result set to CSV or inspect it in psql.
--   2) Fill review_classification with one of:
--      - valid_family_image
--      - wrong_product_image
--      - placeholder_only
--      - metadata_only_mismatch
--   3) Fill review_notes with reviewer context before any approved remediation.
--
-- Candidate rules: active products whose SKU contains AZ[0-9]{4} and at least one of:
--   - products.image_url contains pl-default-thickbox_default.jpg
--   - products.image_url contains a different AZ[0-9]{4} code than the SKU
--   - products.metadata.supplierFeed.supplierSku differs from the SKU

WITH azzardo_products AS (
  SELECT
    p.id AS product_id,
    p.sku,
    p.name,
    BTRIM(COALESCE(p.image_url, '')) AS image_url,
    LOWER(BTRIM(COALESCE(p.image_url, ''))) AS lower_image_url,
    UPPER((REGEXP_MATCH(COALESCE(p.sku, ''), '(AZ[0-9]{4})', 'i'))[1]) AS azzardo_code,
    UPPER((REGEXP_MATCH(COALESCE(p.image_url, ''), '(AZ[0-9]{4})', 'i'))[1]) AS url_az_code,
    UPPER(NULLIF(BTRIM(COALESCE(p.metadata #>> '{supplierFeed,supplierSku}', '')), '')) AS supplier_sku
  FROM products p
  WHERE p.is_active = true
    AND p.deleted_at IS NULL
    AND COALESCE(p.sku, '') ~* 'AZ[0-9]{4}'
), review_candidates AS (
  SELECT
    *,
    lower_image_url LIKE '%pl-default-thickbox_default.jpg%' AS is_placeholder_only,
    (
      url_az_code IS NOT NULL
      AND azzardo_code IS NOT NULL
      AND url_az_code <> azzardo_code
    ) AS has_wrong_url_code,
    (
      supplier_sku IS NOT NULL
      AND supplier_sku <> UPPER(BTRIM(COALESCE(sku, '')))
    ) AS has_supplier_sku_mismatch
  FROM azzardo_products
)
SELECT
  product_id,
  sku,
  name,
  image_url,
  url_az_code,
  supplier_sku,
  azzardo_code,
  NULL::text AS review_classification,
  NULL::text AS review_notes,
  CONCAT_WS(
    '; ',
    CASE WHEN is_placeholder_only THEN 'placeholder_only_candidate' END,
    CASE WHEN has_wrong_url_code THEN 'url_az_code_differs_from_sku' END,
    CASE WHEN has_supplier_sku_mismatch THEN 'metadata_supplier_sku_differs_from_sku' END
  ) AS review_reasons
FROM review_candidates
WHERE is_placeholder_only
   OR has_wrong_url_code
   OR has_supplier_sku_mismatch
ORDER BY product_id;
