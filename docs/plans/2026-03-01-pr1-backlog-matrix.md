# PR #1 Backlog Matrix (Branch vs Main)

Generated from `git diff --name-only origin/main...HEAD` on `2026-03-01`.

## Summary

- Remaining files in branch vs `main`: `163`
- Domain buckets:
  - `ci_release`: `15`
  - `security_nginx`: `1`
  - `suppliers_catalog`: `14`
  - `auth_users_wms`: `8`
  - `inventory_projection`: `18`
  - `k8s_ops`: `38`
  - `docs`: `7`
  - `other`: `62`

## Done (already in main)

These capabilities are already merged to `main` (via isolated PR #3) and should be treated as baseline, not reimplemented.

| Item | Owner | Risk if diverged | Verification command |
|---|---|---|---|
| Workflow/pricing compatibility migration (`database/migrations/1740853000000-WorkflowAndPricingCompatibility.sql`) | Backend | High | `docker exec cypher-erp-db psql -U cypher_user -d cypher_erp -c "select count(*) from workflow_templates;"` |
| Workflow repository quoted-column fixes (`WorkflowTemplateRepository`, `WorkflowInstanceRepository`) | Backend | High | `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts -t "workflow engine templates endpoint" --runInBand` |
| Smoke hardening for enterprise endpoints (`tests/smoke/ApiSmokeTests.ts`) | QA/API | Medium | `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts --runInBand` |
| CI artifact v4 uplift + changed-tests script baseline (`.github/workflows/ci.yml`, `.github/workflows/release-gate.yml`, `.gitignore`, `scripts/test-changed-modules.js`) | DevEx | High | `gh pr checks 3` (historical reference), `npm run test:changed` |
| T0 runbook baseline (`docs/GO_LIVE_T0_CHECK_2026-03-01.md`) | Ops | Medium | `bash scripts/t0-go-live-check.sh` |

## In PR #1 only (candidate)

These are still branch-only candidate slices and require intentional closure.

| Slice | Owner | Branch-only footprint | Risk | Verification command |
|---|---|---|---|---|
| Nginx security hardening | Frontend/Ops | `frontend/nginx.conf` | High (security drift) | `docker compose exec frontend nginx -t` + `curl -sI https://erp.ledux.ro -k` |
| Suppliers + catalog ingestion merge/parsing | Backend | `modules/suppliers/**`, `shared/utils/simple-xml-feed.ts` | High (stock/catalog correctness) | `npm test -- --runInBand modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts` |
| Auth/users contract adjustments | Backend | `modules/users/**`, `shared/services/JwtService.ts`, `src/routes/auth.routes.ts`, auth tests | High (login/session regressions) | `npm test -- --runInBand tests/integration/auth-middleware.integration.test.ts` |
| Inventory projection/read-model changes | Backend | `modules/inventory/**`, `shared/read-model/**`, `shared/cache/**` | High (inventory data consistency) | `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts -t "Inventory" --runInBand` |
| K8s/ops rollout artifacts | DevOps | `orchestration/k8s/**`, `orchestration/swarm/**` | Medium | `bash orchestration/k8s/launch-readiness-check.sh` (where applicable) |
| VAT/change docs updates | Ops/Finance | `docs/VAT_*`, `docs/LAUNCH_*` | Low/Medium | `bash scripts/prelaunch-vat-readiness.sh` |

## Missing implementation/evidence

Gaps that still need closure for PR #1 cleanup execution:

1. **Branch alignment with main baseline**
   - Missing: rebase/sync evidence to avoid reintroducing already merged fixes.
   - Verify: `git fetch origin && git rebase origin/main && git status -sb`.

2. **Nginx hardening proof doc not finalized in this branch context**
   - Missing: `docs/LAUNCH_SECURITY_HEADERS_2026-03-01.md` with header output evidence.
   - Verify: `curl -sI https://erp.ledux.ro -k | grep -Ei "content-security-policy|strict-transport-security|cross-origin-opener-policy|cross-origin-embedder-policy|server"`.

3. **Supplier edge-case tests for duplicate-code merge + availability variants**
   - Missing: explicit failing->passing evidence sequence in tests.
   - Verify: `npm test -- --runInBand modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts`.

4. **Auth contract edge-case closure evidence**
   - Missing: focused auth middleware/refresh/JWT suite closure logs.
   - Verify:
     - `npm test -- --runInBand tests/integration/auth-middleware.integration.test.ts`
     - `npm test -- --runInBand tests/integration/auth-refresh-route.integration.test.ts`
     - `npm test -- --runInBand tests/unit/JwtService.test.ts`

5. **Inventory projection slice closure evidence**
   - Missing: targeted regression proof for projection/read cache path.
   - Verify: `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts -t "Inventory|Products" --runInBand`.

6. **Final PR #1 closure note with command-backed evidence**
   - Missing: consolidated comment/evidence after all slices.
   - Verify: `gh pr comment 1 --body "...evidence..."` and link command outputs.
