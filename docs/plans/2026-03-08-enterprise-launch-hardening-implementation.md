# Enterprise Launch Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden `erp.ledux.ro` and `b2b.ledux.ro` to enterprise, production-ready level by closing access-control gaps, separating ERP/B2B identity cleanly, finishing SEO/static-asset wiring, and validating launch readiness without touching frozen Google Auth flows.

**Architecture:** Execute in phased waves over the existing brownfield codebase. First enforce server-side business/security contracts (`settings`, public B2B visibility, route auth), then separate host/domain identity in the SPA and static delivery layer, then finish SEO/static asset/runtime polish, then run smoke/regression/release gates. Use focused `gpt-5.3` subagents per independent domain, with the orchestrator integrating between waves.

**Tech Stack:** Node.js, Express, TypeScript, React, Vite, Nginx, PostgreSQL, Jest, ts-node, shell smoke tests, Docker Compose.

---

## Execution Rules

- Do not modify Google Auth behavior, contracts, or deployment policy beyond read-only verification. Respect `docs/GOOGLE_AUTH_HARDENING_2026-03-05.md` and the freeze policy.
- The repository is currently dirty. Do not use git worktrees until a clean snapshot strategy exists; execute in the current tree with narrow file scopes and frequent verification.
- Use `gpt-5.3` subagents only for independent workstreams that do not need to edit the same files in parallel.
- Before claiming completion for any task, run the verification command in that same step.

## Execution Notes - 2026-03-08

- Google Auth remains frozen; read-only verification only.
- Repository is dirty; no worktree is used for this execution batch.
- Launch target remains `lansam maine`.
- Every completion claim must be backed by same-step verification evidence.
- Commit steps listed in this plan require explicit user request before execution.

## Subagent Dispatch Map

- **Agent A - Security/Contracts (`gpt-5.3`)**
  - Skills: `security-engineer`, `test-driven-development`, `verification-before-completion`
  - Scope: settings exposure, B2B public visibility enforcement, unauthenticated endpoint coverage
- **Agent B - Frontend Identity/Domain Split (`gpt-5.3`)**
  - Skills: `frontend-engineer`, `brainstorming`, `verification-before-completion`
  - Scope: host-aware metadata, ERP vs B2B app identity, favicon/manifest/static shell behavior
- **Agent C - SEO/Runtime Wiring (`gpt-5.3`)**
  - Skills: `software-engineer`, `qa-engineer`, `verification-before-completion`
  - Scope: SEO module endpoint parity, sitemap/config consistency, smoke/regression harness
- **Orchestrator (main session)**
  - Skills: `writing-plans`, `dispatching-parallel-agents`, `requesting-code-review`, `verification-before-completion`
  - Scope: sequencing, conflict resolution, final verification, release recommendation

---

### Task 1: Establish brownfield baseline and freeze boundaries

**Files:**
- Read: `docs/GOOGLE_AUTH_HARDENING_2026-03-05.md`
- Read: `docs/LAUNCH_VALIDATION_2026-03-05.md`
- Read: `docs/AUDIT_REMEDIATION_UPDATE_2026-02-28.md`
- Read: `scripts/go-live-gate.sh`
- Modify: `docs/plans/2026-03-08-enterprise-launch-hardening-implementation.md`

**Step 1: Record immutable constraints**

Write a short section in the plan execution notes listing:
- Google Auth frozen
- repo dirty / no worktree yet
- launch target is `lansam maine`
- production verification must be evidence-based

**Step 2: Verify current public surface**

Run:
```bash
curl -sS https://erp.ledux.ro/health && printf '\n---\n' && curl -sS https://erp.ledux.ro/api/v1/settings && printf '\n---\n' && curl -sS 'https://erp.ledux.ro/api/v1/b2b/products?limit=1'
```
Expected: health `ok`, sanitized public settings only, B2B payload behavior confirmed before changes.

**Step 3: Save baseline evidence**

Append command outputs and date to a new launch note in:
- `docs/LAUNCH_VALIDATION_2026-03-08.md`

**Step 4: Commit**

```bash
git add docs/plans/2026-03-08-enterprise-launch-hardening-implementation.md docs/LAUNCH_VALIDATION_2026-03-08.md
git commit -m "docs: record enterprise launch hardening baseline"
```

### Task 2: Re-audit and lock the public/private settings contract

**Files:**
- Modify: `modules/settings/src/application/services/SettingsService.ts`
- Modify: `modules/settings/src/api/controllers/SettingsController.ts`
- Modify: `modules/settings/src/settings-module.ts`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Create: `modules/settings/tests/api/SettingsAccess.test.ts`

**Step 1: Write the failing test**

Add API coverage for:
- `GET /api/v1/settings` returns only allowed public fields
- `GET /api/v1/settings/private` unauthenticated -> `401`
- `PUT /api/v1/settings` unauthenticated -> `401`
- no secret-bearing fields from `integrations`, `security`, `notifications`, `system` appear in public payload

**Step 2: Run test to verify it fails**

Run:
```bash
npx jest modules/settings/tests/api/SettingsAccess.test.ts --runInBand
```
Expected: FAIL if any overexposed field or missing guard remains.

**Step 3: Write minimal implementation**

Ensure:
- `getPublicSettings()` returns only explicit whitelist
- settings routes keep authenticated/private split
- frontend settings admin screen consumes private/admin path only

**Step 4: Run test to verify it passes**

Run:
```bash
npx jest modules/settings/tests/api/SettingsAccess.test.ts --runInBand
```
Expected: PASS

**Step 5: Commit**

```bash
git add modules/settings/src/application/services/SettingsService.ts modules/settings/src/api/controllers/SettingsController.ts modules/settings/src/settings-module.ts frontend/src/pages/SettingsPage.tsx modules/settings/tests/api/SettingsAccess.test.ts
git commit -m "fix: harden public and private settings access"
```

### Task 3: Enforce B2B catalog visibility on the server, not only in UI

**Files:**
- Modify: `modules/b2b-portal/src/api/controllers/B2BCatalogController.ts`
- Modify: `modules/b2b-portal/src/api/controllers/B2BController.ts`
- Modify: `modules/b2b-portal/src/api/routes/b2b.routes.ts`
- Modify: `modules/b2b-portal/src/b2b-module.ts`
- Modify: `modules/settings/src/application/services/SettingsService.ts`
- Modify: `frontend/src/pages/b2b-store/B2BStoreCatalogPage.tsx`
- Modify: `frontend/src/pages/b2b-store/B2BProductDetailPage.tsx`
- Create: `modules/b2b-portal/tests/api/B2BCatalogVisibility.test.ts`

**Step 1: Write the failing test**

Cover these cases:
- `catalogVisibility=public` -> anonymous catalog allowed
- `catalogVisibility=login_only` -> anonymous catalog and/or price/stock fields blocked per product policy
- `catalogVisibility=hidden` -> anonymous catalog hidden entirely
- authenticated B2B account still sees allowed fields

**Step 2: Run test to verify it fails**

Run:
```bash
npx jest modules/b2b-portal/tests/api/B2BCatalogVisibility.test.ts --runInBand
```
Expected: FAIL on current public exposure mismatch.

**Step 3: Write minimal implementation**

Implement a single server-side policy path that decides:
- anonymous list access
- anonymous detail access
- public visibility of `price`, `stock_local`, `stock_supplier`, `stock_total`, credit-related data

Do not rely on frontend hiding only.

**Step 4: Run targeted verification**

Run:
```bash
npx jest modules/b2b-portal/tests/api/B2BCatalogVisibility.test.ts --runInBand && curl -sS 'https://erp.ledux.ro/api/v1/b2b/products?limit=1'
```
Expected: tests PASS; live/API contract can be validated later in deploy environment according to policy.

**Step 5: Commit**

```bash
git add modules/b2b-portal/src/api/controllers/B2BCatalogController.ts modules/b2b-portal/src/api/controllers/B2BController.ts modules/b2b-portal/src/api/routes/b2b.routes.ts modules/b2b-portal/src/b2b-module.ts modules/settings/src/application/services/SettingsService.ts frontend/src/pages/b2b-store/B2BStoreCatalogPage.tsx frontend/src/pages/b2b-store/B2BProductDetailPage.tsx modules/b2b-portal/tests/api/B2BCatalogVisibility.test.ts
git commit -m "fix: enforce b2b catalog visibility on the server"
```

### Task 4: Audit unauthenticated ERP/B2B endpoints and close strays

**Files:**
- Modify: `src/server.ts`
- Modify: `modules/*/src/**/routes/*.ts` (only the routes proven exposed)
- Modify: `shared/middleware/rate-limit.middleware.ts`
- Create: `tests/smoke/PublicSurfacePolicy.test.ts`
- Create: `scripts/tests/public-surface-smoke.sh`

**Step 1: Write the failing test**

Create a smoke matrix for anonymous requests against:
- `/api/v1/users`
- `/api/v1/orders`
- `/api/v1/inventory/stock`
- `/api/v1/smartbill/invoices`
- `/api/v1/meta-ads/status`
- `/api/v1/settings`
- `/api/v1/b2b/products`
- `/api/v1/seo/*` endpoints intended to be public or private

**Step 2: Run test to verify it fails**

Run:
```bash
npx jest tests/smoke/PublicSurfacePolicy.test.ts --runInBand
```
Expected: FAIL if any route exposes more than its policy.

**Step 3: Write minimal implementation**

Normalize anonymous policy:
- explicit allowlist for intended public routes
- auth middleware for all others
- add rate limiting to public data endpoints if missing

**Step 4: Run test and shell smoke**

Run:
```bash
npx jest tests/smoke/PublicSurfacePolicy.test.ts --runInBand && bash scripts/tests/public-surface-smoke.sh
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/server.ts shared/middleware/rate-limit.middleware.ts tests/smoke/PublicSurfacePolicy.test.ts scripts/tests/public-surface-smoke.sh modules
git commit -m "fix: tighten anonymous api surface policy"
```

### Task 5: Split ERP and B2B identity by host and route family

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/b2b-store/B2BStoreLayout.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`
- Modify: `frontend/src/services/retargeting.ts`
- Create: `frontend/src/utils/runtime-branding.ts`
- Create: `frontend/src/components/seo/RuntimeHead.tsx`
- Create: `frontend/src/components/seo/__tests__/runtime-branding.test.tsx`

**Step 1: Write the failing test**

Add coverage for host-aware branding:
- `erp.ledux.ro` -> ERP title/meta/theme/favicons
- `b2b.ledux.ro` -> B2B storefront title/meta/theme/favicons
- B2B portal routes keep B2B identity even when mounted in same SPA

**Step 2: Run test to verify it fails**

Run:
```bash
npx jest frontend/src/components/seo/__tests__/runtime-branding.test.tsx --runInBand
```
Expected: FAIL because shell metadata is still generic.

**Step 3: Write minimal implementation**

Implement runtime head management that sets:
- document title
- description
- theme-color
- canonical base / social basics where appropriate
- favicon and manifest links per host/route family

Do not change Google auth login logic.

**Step 4: Run test to verify it passes**

Run:
```bash
npx jest frontend/src/components/seo/__tests__/runtime-branding.test.tsx --runInBand
```
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/index.html frontend/src/App.tsx frontend/src/pages/b2b-store/B2BStoreLayout.tsx frontend/src/components/layout/AppLayout.tsx frontend/src/services/retargeting.ts frontend/src/utils/runtime-branding.ts frontend/src/components/seo/RuntimeHead.tsx frontend/src/components/seo/__tests__/runtime-branding.test.tsx
git commit -m "feat: split runtime identity for erp and b2b hosts"
```

### Task 6: Serve real static assets for favicon, manifest, and branded metadata

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/nginx.conf`
- Modify: `infrastructure/nginx/nginx.conf`
- Create: `frontend/public/favicon.ico`
- Create: `frontend/public/manifest.webmanifest`
- Create: `frontend/public/icons/*`
- Create: `frontend/public/erp/*`
- Create: `frontend/public/b2b/*`
- Create: `tests/smoke/StaticAssetSmoke.test.ts`

**Step 1: Write the failing test**

Cover:
- `/favicon.ico` is an icon, not HTML
- `/manifest.webmanifest` returns manifest JSON
- branded icon URLs resolve with `200`

**Step 2: Run test to verify it fails**

Run:
```bash
npx jest tests/smoke/StaticAssetSmoke.test.ts --runInBand
```
Expected: FAIL on current SPA fallback behavior.

**Step 3: Write minimal implementation**

Add real public assets and Nginx rules so static files are served before SPA fallback.

**Step 4: Run verification**

Run:
```bash
npx jest tests/smoke/StaticAssetSmoke.test.ts --runInBand
```
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/vite.config.ts frontend/nginx.conf infrastructure/nginx/nginx.conf frontend/public tests/smoke/StaticAssetSmoke.test.ts
git commit -m "fix: serve branded static metadata assets correctly"
```

### Task 7: Finish SEO module parity and sitemap truthfulness

**Files:**
- Modify: `modules/seo-automation/src/api/controllers/SeoController.ts`
- Modify: `modules/seo-automation/src/seo-module.ts`
- Modify: `modules/seo-automation/src/infrastructure/repositories/TypeOrmAuditRepository.ts`
- Modify: `frontend/src/services/seo.service.ts`
- Modify: `frontend/src/pages/SeoPage.tsx`
- Create: `modules/seo-automation/tests/api/SeoEndpointsParity.test.ts`
- Create: `scripts/tests/seo-smoke.sh`

**Step 1: Write the failing test**

Add parity checks for:
- `GET /api/v1/seo/sitemap/status`
- `GET /api/v1/seo/structured-data/templates`
- config endpoint existence if referenced by UI
- summary endpoint payloads expected by frontend

**Step 2: Run test to verify it fails**

Run:
```bash
npx jest modules/seo-automation/tests/api/SeoEndpointsParity.test.ts --runInBand
```
Expected: FAIL where UI references missing/incorrect backend routes.

**Step 3: Write minimal implementation**

Ensure:
- every frontend-called SEO endpoint exists or frontend stops calling it
- sitemap status reflects actual generated state
- config/status/reporting contracts are internally consistent

**Step 4: Run verification**

Run:
```bash
npx jest modules/seo-automation/tests/api/SeoEndpointsParity.test.ts --runInBand && bash scripts/tests/seo-smoke.sh
```
Expected: PASS

**Step 5: Commit**

```bash
git add modules/seo-automation/src/api/controllers/SeoController.ts modules/seo-automation/src/seo-module.ts modules/seo-automation/src/infrastructure/repositories/TypeOrmAuditRepository.ts frontend/src/services/seo.service.ts frontend/src/pages/SeoPage.tsx modules/seo-automation/tests/api/SeoEndpointsParity.test.ts scripts/tests/seo-smoke.sh
git commit -m "fix: align seo api contracts with runtime status"
```

### Task 8: Trim public-page payload and remove avoidable initial weight

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/index.html`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/b2b-store/B2BStoreLayout.tsx`
- Create: `scripts/tests/bundle-budget-check.sh`

**Step 1: Write the failing budget check**

Define budgets for:
- unauth ERP login shell
- B2B storefront shell
- vendor charting libraries not preloaded on public pages

**Step 2: Run budget check to verify it fails**

Run:
```bash
bash scripts/tests/bundle-budget-check.sh
```
Expected: FAIL if heavy vendor chunks are still eagerly pulled for public/login entry.

**Step 3: Write minimal implementation**

Reduce unnecessary initial cost by:
- ensuring chart-heavy routes stay lazy
- removing any eager preload usage not needed on first paint
- keeping public/login and storefront shells minimal

**Step 4: Run budget check to verify it passes**

Run:
```bash
bash scripts/tests/bundle-budget-check.sh
```
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/vite.config.ts frontend/index.html frontend/src/pages/LoginPage.tsx frontend/src/pages/b2b-store/B2BStoreLayout.tsx scripts/tests/bundle-budget-check.sh
git commit -m "perf: reduce public shell bundle cost"
```

### Task 9: Build launch smoke and regression suite for ERP + B2B

**Files:**
- Modify: `scripts/go-live-gate.sh`
- Modify: `docs/release-checklist.md`
- Create: `scripts/tests/launch-smoke.sh`
- Create: `tests/smoke/LaunchSurfaceSmoke.test.ts`
- Modify: `docs/LAUNCH_VALIDATION_2026-03-08.md`

**Step 1: Write the failing smoke/test matrix**

Include:
- `/health`
- public settings policy
- B2B visibility policy
- ERP login page shell
- B2B storefront shell
- static asset correctness
- SEO status/config parity

**Step 2: Run it to verify failures are visible**

Run:
```bash
npx jest tests/smoke/LaunchSurfaceSmoke.test.ts --runInBand && bash scripts/tests/launch-smoke.sh
```
Expected: FAIL until prior tasks are finished.

**Step 3: Implement final harness updates**

Update gate scripts and checklist so release verification is one-command reproducible.

**Step 4: Run final verification**

Run:
```bash
npx jest tests/smoke/LaunchSurfaceSmoke.test.ts --runInBand && bash scripts/tests/launch-smoke.sh && bash scripts/go-live-gate.sh
```
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/go-live-gate.sh docs/release-checklist.md scripts/tests/launch-smoke.sh tests/smoke/LaunchSurfaceSmoke.test.ts docs/LAUNCH_VALIDATION_2026-03-08.md
git commit -m "test: add enterprise launch smoke and go-live gate coverage"
```

### Task 10: Final review, code audit, and production readiness summary

**Files:**
- Modify: `docs/LAUNCH_VALIDATION_2026-03-08.md`
- Create: `docs/ENTERPRISE_LAUNCH_READINESS_2026-03-08.md`

**Step 1: Request code review**

Run a dedicated review pass over touched files using `requesting-code-review`.

**Step 2: Run full verification suite**

Run:
```bash
npx jest modules/settings/tests/api/SettingsAccess.test.ts --runInBand && npx jest modules/b2b-portal/tests/api/B2BCatalogVisibility.test.ts --runInBand && npx jest tests/smoke/PublicSurfacePolicy.test.ts --runInBand && npx jest frontend/src/components/seo/__tests__/runtime-branding.test.tsx --runInBand && npx jest tests/smoke/StaticAssetSmoke.test.ts --runInBand && npx jest modules/seo-automation/tests/api/SeoEndpointsParity.test.ts --runInBand && npx jest tests/smoke/LaunchSurfaceSmoke.test.ts --runInBand && bash scripts/tests/public-surface-smoke.sh && bash scripts/tests/seo-smoke.sh && bash scripts/tests/bundle-budget-check.sh && bash scripts/tests/launch-smoke.sh && bash scripts/go-live-gate.sh
```
Expected: PASS

**Step 3: Write readiness report**

Summarize:
- what changed
- what is verified
- residual known risks
- no-touch Google Auth note
- explicit go/no-go recommendation

**Step 4: Commit**

```bash
git add docs/LAUNCH_VALIDATION_2026-03-08.md docs/ENTERPRISE_LAUNCH_READINESS_2026-03-08.md
git commit -m "docs: publish enterprise launch readiness report"
```

---

## Recommended Execution Order

1. Task 1 sequentially in main session
2. Dispatch Tasks 2-4 with `gpt-5.3` by domain, but do not let agents edit the same route/controller files simultaneously
3. After integration, dispatch Tasks 5-7 in parallel where files do not overlap
4. Run Task 8 only after branding/static asset design is settled
5. Finish with Tasks 9-10 sequentially

## Required Skills During Execution

- Before coding each wave: `brainstorming` (short scoped design refresh if scope changed)
- Before each implementation task: `test-driven-development`
- On any failing/ambiguous behavior: `systematic-debugging`
- Before any success claim: `verification-before-completion`
- Before final wrap-up: `requesting-code-review`
- If moving execution into a fresh isolated tree later: `using-git-worktrees`

## Subagent Execution Prompt Template

Use this template for each `gpt-5.3` subagent:

```text
You are a focused implementation subagent working inside /opt/cypher-erp.

Task: <paste one task from this plan only>
Constraints:
- Do not touch Google Auth flows.
- Do not broaden scope beyond listed files.
- Follow TDD: test first, verify fail, minimal fix, verify pass.
- Return: files changed, tests run, result, risks, and anything needing orchestrator integration.
```

## Completion Condition

This plan is complete only when Task 10 verification passes and `docs/ENTERPRISE_LAUNCH_READINESS_2026-03-08.md` contains an explicit evidence-backed go/no-go decision.
