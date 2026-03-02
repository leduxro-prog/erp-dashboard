# Go-Live T0 Check - 2026-03-01

## Scope

Validation for critical launch paths after workflow/pricing compatibility fix and backend/frontend restart.

## Final Status

- Overall: PASS (go-live checks passed)
- Blocking errors: none in validated scope

## Mandatory Matrix Evidence

| Area | Scenario | Result |
|---|---|---|
| Health | `GET /health` public | PASS (`200`) |
| Health | `GET /api/v1/health/ready` and `/api/v1/health/detailed` | PASS (`200`/`200`) |
| API Users | `GET /api/v1/users` unauthenticated | PASS (`401`, protected) |
| API Users | auth CRUD smoke (public HTTPS): create/delete | PASS (`201`/`204`) |
| API Users | auth CRUD smoke (internal): list/create/delete | PASS (`200`/`201`/`204`) |
| API Settings | auth get+put (internal) | PASS (`200`/`200`) |
| Workflow | `GET /api/v1/workflow-engine/templates` authenticated | PASS (`200`) |
| Workflow | `POST /api/v1/workflow-engine/instances` authenticated | PASS (`201`) |
| Pricing | `GET /api/v1/pricing-engine/:id` authenticated | PASS (`200`) |
| Pricing+Workflow | guardrail violation => approval workflow creation | PASS (`422 PRICING_APPROVAL_REQUIRED` + `approvalRequest.status=created`) |
| Smoke Suite | `tests/smoke/ApiSmokeTests.ts` | PASS (`32/32`) |
| Volume Permissions | `/opt/cypher-erp/config` ownership | PASS (`1001:1001`) |

## Applied Runtime Fixes (Validated)

1. Added DB compatibility tables for workflow and pricing (`volume_discount_rules`, `workflow_*` tables).
2. Seeded default active pricing approval template (`pricing_calculation`).
3. Fixed workflow repository SQL for quoted camelCase columns.
4. Rebuilt/redeployed backend and restarted frontend.

## Important Operator Note

- Authenticated API checks must use HTTPS directly when testing with curl.
- Using `curl -L http://...` may drop `Authorization` during redirect and produce false `401`.

## SLI Snapshot (Recent Window)

- Backend request sample analyzed: `372` requests
- `5xx` responses observed: `0`
- Critical endpoint latency: `p95=59.574ms`, `p99=239.28ms`, `max=283.316ms`

## T0 Command Pack (Copy/Paste)

```bash
# 1) Health
curl -sS https://65.108.255.104/health -k

# 2) Generate temporary admin JWT from runtime secret (on host with Docker access)
docker exec cypher-erp-app-1 node -e "const fs=require('fs');const jwt=require('jsonwebtoken');const secret=fs.readFileSync(process.env.JWT_SECRET_FILE,'utf8').trim();process.stdout.write(jwt.sign({id:'1',email:'ops@ledux.ro',role:'admin'},secret,{expiresIn:'20m'}));" > /tmp/admin_token_t0.txt

# 3) Auth sanity
TOKEN=$(tr -d '\n' < /tmp/admin_token_t0.txt)
curl -sS https://65.108.255.104/api/v1/workflow-engine/templates -k -H "Authorization: Bearer $TOKEN"
curl -sS https://65.108.255.104/api/v1/users -k -H "Authorization: Bearer $TOKEN"

# 4) Smoke suite
cd /opt/cypher-erp
API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts --runInBand
```

## Rollback Trigger Reminder

Trigger rollback if any of the following occurs for >5 minutes:

- critical endpoint health failures
- sustained `5xx` beyond agreed threshold
- pricing/workflow path returns unhandled server errors in production flow

## PR1 Backlog Cleanup Evidence (2026-03-01T22:12Z)

Executed from branch `chore/pr1-backlog-cleanup-plan` in worktree `/root/.config/superpowers/worktrees/cypher-erp/pr1-backlog-cleanup`.

- `npm test -- --runInBand modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts` -> PASS (`5/5`)
- `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts -t "Products|Inventory|workflow" --runInBand` -> PASS (`6 passed`, `26 skipped`)
- `npm test -- --runInBand tests/integration/auth-middleware.integration.test.ts` -> PASS (`19/19`)
- `npm test -- --runInBand tests/integration/auth-refresh-route.integration.test.ts` -> PASS (`4/4`)
- `npm test -- --runInBand tests/unit/JwtService.test.ts` -> PASS (`34/34`)
- `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts --runInBand` -> PASS (`32/32`)
- `bash scripts/t0-go-live-check.sh` -> PASS (`GO`, `13 PASS`, `0 FAIL`)
- `npm run build:incremental` -> FAIL (pre-existing branch drift; missing modules/contracts in `modules/suppliers`, `modules/smartbill`, `modules/seo-automation`, `modules/users`)

### Notes

- Supplier scraper edge cases closed and validated:
  - duplicate supplier code merge across case/whitespace variants
  - Business Central availability text variants (`In stoc`, `Stoc limitat`, `La comanda`)
- Auth contract edge case closed and validated:
  - Authorization header accepts case-insensitive `Bearer` prefix with variable spacing.

## PR1 Backlog Cleanup Evidence (2026-03-02T06:23Z)

Root-cause remediation pass for branch compile drift completed.

- `npm run build:incremental` -> PASS
- `npm test -- --runInBand modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts` -> PASS (`5/5`)
- `npm test -- --runInBand tests/integration/auth-middleware.integration.test.ts` -> PASS (`19/19`)
- `npm test -- --runInBand tests/integration/auth-refresh-route.integration.test.ts` -> PASS (`4/4`)
- `npm test -- --runInBand tests/unit/JwtService.test.ts` -> PASS (`34/34`)
- `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts --runInBand` -> PASS (`32/32`)
- `bash scripts/t0-go-live-check.sh` -> PASS (`GO`, `13 PASS`, `0 FAIL`)

### Root Causes Closed

- Missing compile-time modules/files restored: `shared/utils/brand-strategy.ts`, SmartBill `CreateB2BProforma` use case, supplier service/scraper placeholders required by branch references.
- Supplier contract drift aligned between domain ports and use cases (`ScrapedProduct`, `SupplierProduct`, `SupplierProductSpecification`, `ScrapeResult`, repository contract methods).
- Auth/users compile drift aligned by adding `findOrCreateGoogleUser` in `UserService` and deferring Google client import to runtime inside controller method.
