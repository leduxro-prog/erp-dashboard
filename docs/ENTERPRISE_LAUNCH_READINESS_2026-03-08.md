# Enterprise Launch Readiness - 2026-03-08

## Decision

GO

## Scope Completed

- Public/private settings contract regression coverage added and verified.
- B2B catalog visibility policy corrected for the clarified architecture:
  - `public` keeps anonymous catalog access.
  - `login_only` redacts protected commercial fields for anonymous B2B users.
  - `hidden` denies anonymous catalog access.
- Anonymous B2B document preview no longer bypasses auth.
- ERP and B2B runtime identity split implemented.
- Dedicated `b2b.ledux.ro` host-level storefront routes implemented without collapsing retail `ledux.ro` into this SPA.
- Real branded static assets and manifests added for ERP and B2B.
- SEO parity/status smoke and bundle budget checks added and verified.
- Launch smoke and go-live gate hardened and validated end-to-end.

## Verified Evidence

- `npx jest modules/settings/tests/api/SettingsAccess.test.ts --runInBand` -> PASS
- `npx jest modules/b2b-portal/tests/api/B2BCatalogVisibility.test.ts --runInBand` -> PASS
- `npx jest tests/smoke/PublicSurfacePolicy.test.ts --runInBand` -> PASS
- `npx jest frontend/src/components/seo/__tests__/runtime-branding.test.tsx --runInBand` -> PASS
- `npm --prefix frontend run type-check` -> PASS
- `npx jest tests/smoke/StaticAssetSmoke.test.ts --runInBand` -> PASS
- `npx jest modules/seo-automation/tests/api/SeoEndpointsParity.test.ts --runInBand` -> PASS
- `bash -n scripts/tests/seo-smoke.sh` -> PASS
- `BASE_URL="http://127.0.0.1:8080" bash scripts/tests/seo-smoke.sh` -> PASS
- `bash scripts/tests/bundle-budget-check.sh` -> PASS
- `npx jest tests/smoke/LaunchSurfaceSmoke.test.ts --runInBand` -> PASS
- `ERP_HOST_HEADER="erp.ledux.ro" B2B_HOST_HEADER="b2b.ledux.ro" API_BASE_URL="http://127.0.0.1:8080" WEB_BASE_URL="http://127.0.0.1:8080" ERP_WEB_BASE_URL="http://127.0.0.1:8080" B2B_WEB_BASE_URL="http://127.0.0.1:8080" bash scripts/tests/launch-smoke.sh` -> PASS
- `ERP_HOST_HEADER="erp.ledux.ro" B2B_HOST_HEADER="b2b.ledux.ro" API_BASE_URL="http://127.0.0.1:8080" WEB_BASE_URL="http://127.0.0.1:8080" ERP_WEB_BASE_URL="http://127.0.0.1:8080" B2B_WEB_BASE_URL="http://127.0.0.1:8080" WATCH_CHECKPOINTS=1 WATCH_INTERVAL_SEC=0 bash scripts/go-live-gate.sh` -> GO

## Runtime Snapshot

- T0 gate passed.
- Launch smoke passed.
- Post-launch watch passed.
- Latest gate result: `PASS=12 FAIL=0` -> `GO`.
- Latest observed SLI snapshot during gate:
  - `TOTAL=605`
  - `4XX=235`
  - `5XX=0`
  - `ERR5_RATE=0.00%`
  - `P95_MS=27262.16`
  - `P99_MS=52933.52`

## Important Architectural Clarifications Locked In

- `ledux.ro` is retail and remains outside this SPA scope.
- `b2b.ledux.ro` is the dedicated B2B website.
- `erp.ledux.ro` is the dedicated ERP/admin surface.
- Google Auth remains frozen; no behavioral changes were made to it in this batch.

## Residual Risks

- Host-identity smoke now verifies B2B dedicated-host route reachability via `Host` header, but this is still lighter-weight than full browser/E2E validation on the real FQDNs.
- `scripts/t0-go-live-check.sh` still deserves a follow-up hardening pass for full parity with the now-flexible container detection in `scripts/go-live-gate.sh`.
- SEO public surface is now truthfully tested as public; if business policy later requires admin-only SEO configuration writes, that needs a separate product/security decision and implementation batch.
- The working tree remains broadly dirty from prior work; this batch avoided destructive cleanup and no commit was created.

## Recommendation

- Operational recommendation for current runtime: GO.
- Product recommendation after launch: follow up with
  1. real FQDN browser validation for `erp.ledux.ro` and `b2b.ledux.ro`
  2. `t0-go-live-check.sh` service-name hardening
  3. cleanup/commit strategy for the dirty repository
