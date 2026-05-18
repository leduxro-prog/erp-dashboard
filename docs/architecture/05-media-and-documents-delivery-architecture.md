# Task 5 - Media and Documents Delivery Architecture

## Objective

Define long-term media/document architecture with object storage + CDN delivery, explicit access policy, and projection metadata shape for 100k catalog scale.

## Asset Classes (Required)

- primary product images
- gallery images
- supplier assets
- datasheets
- certificates
- installation documents
- warranty documents
- compliance documents

## Ownership Model

- ERP owns asset metadata and publication intent.
- Asset binaries are stored in object storage buckets, not served from ERP runtime.
- Published catalog stores normalized asset references (URL + checksum + mime + version + visibility).

## Storage Layout (Example)

- `s3://ledux-media-prod/products/{productId}/images/{assetVersion}/{file}`
- `s3://ledux-media-prod/products/{productId}/documents/{class}/{assetVersion}/{file}`
- `s3://ledux-media-prod/suppliers/{supplierCode}/assets/{assetVersion}/{file}`

## CDN and URL Strategy

- Public CDN base: `https://cdn.ledux.ro/`
- Stable URL pattern includes version segment for immutable caching.
- Cache-control:
  - images: long TTL immutable
  - documents: immutable for versioned assets, short TTL for latest aliases

## Access Policy

- Public assets (PDP-visible): unsigned CDN URLs.
- Restricted assets (supplier-private/compliance-internal): signed URLs with short expiry.
- Access mode is explicit in projection (`public` or `signed`).

## Invalidation and Versioning

- No in-place mutation of published binaries.
- New binary -> new `assetVersion` + new URL.
- Invalidation is event-driven only for mutable aliases (if used), not for immutable URLs.

## Projection Metadata Shape

See schema: `contracts/published-asset-ref-v1.schema.json`.

Required fields:

- `assetClass`
- `url`
- `checksum`
- `mimeType`
- `sizeBytes`
- `version`
- `access`
- `origin` (`erp`, `supplier`, `derived`)
- `updatedAt`

## Alignment Guardrails

- Retail and B2B read asset references from published catalog projection only.
- ERP must not be final binary delivery path.
- Media/doc refresh events update projection metadata and trigger search/index refresh where relevant.
