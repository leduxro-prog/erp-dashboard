# Task 4 - Search and Faceted Index Model (Lighting/Electrical/Electronics)

## Objective

Define canonical search/index model for 100k products with alias-swap reindex, rollback, and freshness controls.

## Index Contract

Index mapping artifact:

- `contracts/search-index-product-v1.opensearch.json`

Domain-required indexed fields included:

- category tree
- brand/manufacturer
- lumens
- kelvin
- cri
- ip
- wattage
- voltage
- mounting type
- dimensions
- ean
- supplier/manufacturer codes
- certification/compliance flags
- media/document references
- retail/b2b visibility

## Alias Strategy

Aliases:

- write alias: `catalog_products_write`
- read alias: `catalog_products_read`

Versioned indices:

- `catalog_products_vYYYYMMDDHHMM` (immutable generation)

Publish flow:

1. Create new generation index with mapping.
2. Bulk ingest/replay projection snapshots.
3. Validate cardinality + doc completeness + sampling checks.
4. Atomically swap read alias to new index.
5. Keep prior index for rollback window.

## Rollback Strategy

- If post-swap errors or SLA breach occurs, atomically point `catalog_products_read` to previous generation.
- Keep at least one previous generation and replay checkpoints.
- Trigger reconciliation job after rollback to detect event drift.

## Freshness Targets

- projection-to-index lag p95: <= 120s
- full replay for 100k baseline: <= 90 minutes in rehearsal target capacity
- search read SLA for browse/filter/PDP support:
  - p95 browse/filter query <= 250ms
  - p95 PDP lookup <= 150ms

## Guardrails

- No direct ERP browse dependency for final runtime path.
- Retail/B2B visibility flags must be indexed and query-enforced separately.
- Reindex and rollback must be automatable and auditable via runbook.
