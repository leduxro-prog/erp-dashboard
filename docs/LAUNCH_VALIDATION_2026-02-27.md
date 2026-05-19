# Launch Validation Evidence - 2026-02-27

## Executive Status

- Decision: `GO`
- Go-live gate: `PASS=27`, `FAIL=0`
- Core services healthy during full watch window:
  - `cypher-erp-app-1`
  - `cypher-erp-frontend-1`
  - `cypher-erp-redis`
  - `cypher-erp-db`
  - `cypher-rabbitmq`

## Commands Executed

```bash
bash scripts/t0-go-live-check.sh
bash scripts/go-live-gate.sh
```

## T0 Critical Checks

- Frontend health: `200`
- Backend internal health: PASS
- Redis auth ping: `PONG`
- Authenticated smoke:
  - `USERS_GET=200`
  - `USERS_POST=201`
  - `USERS_DELETE=204`
  - `SETTINGS_GET=200`
  - `SETTINGS_PUT=200`

## SLI Snapshot (from gate run)

- `5XX=0`
- `ERR5_RATE=0.00%`
- `p95=5.79ms`
- `p99=105.47ms`

## Business-Critical Functional Validation

Focused runtime smoke executed inside `cypher-erp-app-1` against live APIs.

### PASS Matrix

- `GET /api/v1/b2b/products?search=MOD279WL-L14B3K` -> `200`
- Duplicate merge behavior -> exactly `1` product row
- Merged ids -> `merged_product_ids.length = 2`
- Combined stock tuple -> `stock_local=2`, `stock_supplier=87`, `stock_total=89`
- `GET /api/v1/b2b/products/5076104` -> `200`
- B2B detail includes `custom_specs.resurse_maytoni` with:
  - `model_3d_360`
  - `eticheta_energetica_pdf`
  - `plan_tehnic_blueprint`
- `GET /api/v1/inventory/products?search=MOD242PL-L33BK` (admin token) -> `200`
- Inventory payload includes `specifications.custom_specs.resurse_maytoni`

## Frontend/Build Validation

- Frontend production build: PASS

```bash
cd frontend && npm run build
```

## Targeted Regression Test

- Supplier stock scraping unit suite: PASS (`11/11`)

```bash
npm test -- --runInBand modules/suppliers/tests/application/ScrapeSupplierStock.test.ts
```

## Notes

- `modules/suppliers/src/infrastructure/scrapers/BusinessCentralScraper.ts` is currently untracked in this workspace and must be included in release staging to avoid stock parsing regressions.
