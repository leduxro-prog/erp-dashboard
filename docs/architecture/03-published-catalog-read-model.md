# Task 3 - Published Catalog Read Model (100k)

## Objective

Define the read-optimized published catalog model for browse/search/facets/PDP while keeping ERP as source of truth and direct ERP browse as transition-only.

## Architecture Position

- ERP remains source of truth for catalog master, stock, pricing inputs/rules, taxonomy, technical specs, and document metadata.
- Publication pipeline materializes a read model consumed by retail and B2B.
- Direct ERP runtime reads are transitional and must be phased out for 100k steady-state traffic.

## Projection Identity

Stable identity keys:

- `productId` (internal immutable product key)
- `sku` (internal SKU)
- `erpProductId` (ERP reference)
- `sourceVersion` (monotonic publication sequence)
- `projectionVersion` (schema version)

## Projection Payload Groups

### Commercial fields

- `currency`
- `listPrice`
- `promoPrice`
- `priceRulesVersion`
- `stock.available`
- `stock.backorderable`

### Technical attributes

- `lumens`
- `kelvin`
- `cri`
- `ipRating`
- `wattage`
- `voltage`
- `mountingType`
- `dimensions` (`length`, `width`, `height`, `unit`)
- `ean`
- `supplierCodes[]`
- `manufacturerCodes[]`
- `complianceFlags[]`

### Visibility and publication

- `visibility.retail`
- `visibility.b2b`
- `assortment.retailCollections[]`
- `assortment.b2bSegments[]`
- `lifecycleState` (`draft`, `published`, `withdrawn`)
- `publishState.retail`
- `publishState.b2b`

### Media/doc references

- `media.primaryImage`
- `media.gallery[]`
- `documents.datasheets[]`
- `documents.certificates[]`
- `documents.installation[]`
- `documents.warranty[]`
- `documents.compliance[]`

References are object-storage/CDN URLs with metadata, not ERP runtime binary links.

## Update Semantics

Publication contract supports idempotent partial projection updates.

Update modes:

- `upsert-partial` - merge selected fields by path, keep untouched fields
- `upsert-full` - replace full projection for product
- `withdraw` - set lifecycle and visibility to non-public

Required processing behavior:

1. Validate contract version and idempotency key.
2. Ignore stale events (`sourceVersion` older than current projection).
3. Apply merge semantics for partial updates.
4. Emit downstream search update signal.
5. Emit media/document metadata refresh signal when corresponding field groups changed.

## Replay and Full Rebuild Triggers

Mandatory replay triggers:

- projection schema version bump
- taxonomy rebuild
- pricing rule engine version bump
- compliance model changes
- reindex corruption or alias rollback event

Replay behavior:

- idempotent by `idempotencyKey`
- checkpointed batches
- reconciliation report with missing/failed projections

## Transition Policy (Explicit)

Direct ERP browse usage is allowed only as transition fallback and must be behind explicit feature flag + SLO budget.

Target end state:

- retail and B2B browse/search/PDP read from published catalog read model + search index
- ERP no longer serves high-volume runtime browse directly

## Contract Artifact

- Schema: `contracts/catalog-publication-event-v1.schema.json`
