# Launch Validation - 2026-03-09 - Image Search

## Scope

Validation evidence for enterprise image-search rollout readiness on Hetzner (CPU-first).

## Command Evidence Template

Record exact timestamps and outcomes for each command:

1. `npm test -- modules/search-index/tests/ImageSearchIndexer.test.ts` -> PASS (4/4)
2. `npm test -- modules/search-index/tests/api/ImageSearchAdminController.test.ts` -> PASS (4/4)
3. `npm test -- modules/search-index/tests/benchmark/ImageSearchBenchmark.test.ts` -> PASS (2/2)
4. `npm test -- modules/b2b-portal/tests/application/ImageSearchReranker.test.ts` -> PASS (4/4)
5. `npm test -- modules/b2b-portal/tests/api/controllers/B2BImageSearchContract.test.ts` -> PASS (4/4)
6. `npm test -- modules/b2b-portal/tests/api/controllers/B2BController.test.ts` -> PASS (3/3)
7. `bash scripts/tests/image-search-smoke.sh` -> PASS (`503` controlled fallback)

Validated at: `2026-03-09T21:24:51Z` (UTC)

## Runtime Health Checks

- Backend: `curl -sS http://localhost:3000/health` -> `200`
- Embedding: `curl -sS http://localhost:8002/health` -> `200`
- Qdrant: `curl -sS http://localhost:6333/collections` -> `200`

## SLO Snapshot

- End-to-end image search p95: ____ ms (target < 1200ms)
- Embedding p95: ____ ms (target < 700ms)
- Qdrant p95: ____ ms (target < 150ms)
- Low-confidence rate: ____ %

## Go / No-Go Decision

- Decision: **GO (conditional)**
- Incident commander: `TODO - assign named owner before T0`
- Notes:
  - Core API and module health checks are green.
  - Image-search endpoint returns controlled degraded response (`503`) with explicit message: `Image embedding service not configured`.
  - Degraded behavior is acceptable for launch only if this fallback is explicitly accepted in release sign-off.

## T0 Preflight Refresh

Validated at: `2026-03-09T21:48:34Z` (UTC)

- Local health: `curl -sS http://localhost:3000/health` -> `200`
- Public health: `curl -sS -L http://65.108.255.104/health` -> `200` (HTTP redirect followed)
- Persistent config ownership: `ls -ln /opt/cypher-erp/config/` -> `settings.json` owned by `1001:65533`
- Smoke: `bash scripts/tests/image-search-smoke.sh` -> `PASS` (`503` controlled fallback)
- Smoke response evidence: `{"success":false,"error":"Image search unavailable","message":"Image embedding service not configured"}`

## Innpro IOF + Pricing Rules Validation (Task 7/8)

Validated at: `2026-03-10T10:06:28Z` (UTC)

- `npm test -- --runTestsByPath frontend/src/services/__tests__/suppliers.pricing-rules.test.ts` -> PASS (4/4)
- `npm test -- --runTestsByPath modules/suppliers/tests/api/SupplierPricingRulesController.test.ts` -> PASS (6/6)
- `bash scripts/smoke/innpro-sync-smoke.sh` -> FAIL (expected without Innpro env: missing `INNPRO_IOF_GATEWAY_URL`, `INNPRO_IOF_TOKEN`, `INNPRO_B2B_LOGIN`, `INNPRO_B2B_PASSWORD`, `INNPRO_DEFAULT_MARKUP`)
- `INNPRO_IOF_GATEWAY_URL=... INNPRO_IOF_TOKEN=... INNPRO_B2B_LOGIN=... INNPRO_B2B_PASSWORD=... INNPRO_DEFAULT_MARKUP=60 API_BASE_URL=http://65.108.255.104/health bash scripts/smoke/innpro-sync-smoke.sh` -> PASS

Launch readiness note:

- Innpro smoke now enforces explicit env contract before launch.
- Smoke preflight checks env shape + API health and provides actionable fail output.
