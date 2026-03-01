# PR #1 Backlog Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining PR #1 backlog safely by executing prioritized vertical slices with verification evidence after every slice.

**Architecture:** First, create an explicit backlog matrix from branch-vs-main diff so we stop guessing. Then execute highest-value slices one-by-one (CI resilience, launch security hardening, supplier/catalog, auth+inventory contracts), with TDD-style verification and smoke evidence before moving to the next slice. Preserve launch stability and keep Google Auth frozen.

**Tech Stack:** Git/GitHub, Node.js/TypeScript, Jest, Docker Compose, Nginx, curl, GitHub Actions.

---

### Task 1: Build Explicit Remaining-Work Matrix

**Files:**
- Create: `docs/plans/2026-03-01-pr1-backlog-matrix.md`
- Reference: `docs/plans/2026-03-01-pr1-backlog-cleanup-design.md`

**Step 1: Export branch-vs-main file diff**

Run: `git diff --name-only origin/main...HEAD > /tmp/pr1_remaining_files.txt`
Expected: `/tmp/pr1_remaining_files.txt` exists and is non-empty.

**Step 2: Group files by domain**

Run:
`python3 - <<'PY'
from pathlib import Path
files=Path('/tmp/pr1_remaining_files.txt').read_text().splitlines()
groups={
 'ci_release':[], 'security_nginx':[], 'suppliers_catalog':[], 'auth_users_wms':[],
 'inventory_projection':[], 'k8s_ops':[], 'docs':[], 'other':[]
}
for f in files:
    if f.startswith('.github/workflows/') or f.startswith('scripts/'): groups['ci_release'].append(f)
    elif f.startswith('frontend/nginx.conf'): groups['security_nginx'].append(f)
    elif f.startswith('modules/suppliers/') or f.startswith('shared/utils/simple-xml-feed.ts'): groups['suppliers_catalog'].append(f)
    elif f.startswith('modules/users/') or f.startswith('shared/services/JwtService.ts') or f.startswith('src/routes/auth.routes.ts') or f.startswith('tests/integration/auth') or f.startswith('tests/unit/JwtService'): groups['auth_users_wms'].append(f)
    elif f.startswith('modules/inventory/') or f.startswith('shared/read-model/') or f.startswith('shared/cache/') or f.startswith('shared/constants/cache-keys.ts'): groups['inventory_projection'].append(f)
    elif f.startswith('orchestration/'): groups['k8s_ops'].append(f)
    elif f.startswith('docs/'): groups['docs'].append(f)
    else: groups['other'].append(f)
for k,v in groups.items():
    print(k, len(v))
PY`

Expected: counts printed per domain.

**Step 3: Write matrix document with status tags**

In `docs/plans/2026-03-01-pr1-backlog-matrix.md`, create sections:
- `Done (already in main)`
- `In PR #1 only (candidate)`
- `Missing implementation/evidence`

Expected: matrix includes owner, risk, and verification command per item.

**Step 4: Commit matrix checkpoint**

```bash
git add docs/plans/2026-03-01-pr1-backlog-matrix.md
git commit -m "docs: map remaining PR1 backlog into execution matrix"
```

### Task 2: Rebase Candidate Scope on Current Main

**Files:**
- Modify: branch history and conflict-resolved files

**Step 1: Rebase branch onto updated main**

Run: `git fetch origin && git rebase origin/main`
Expected: branch includes latest merged stabilization baseline.

**Step 2: Resolve conflicts with minimal policy**

Policy:
- keep launch-stabilization behavior from `main`
- keep PR #1 intent only where still needed
- no opportunistic refactors

Expected: `git rebase --continue` completes.

**Step 3: Verify clean tree after rebase**

Run: `git status -sb`
Expected: no conflict markers, branch clean.

**Step 4: Commit conflict resolutions (if produced as regular commits)**

```bash
git add <resolved-files>
git commit -m "chore: align PR1 backlog branch with merged main baseline"
```

### Task 3: Slice A - CI/Release Reliability Closure

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release-gate.yml`
- Modify: `.gitignore`
- Create/Modify: `scripts/test-changed-modules.js`

**Step 1: Add/verify failing CI reproduction locally**

Run: `npm run test:changed`
Expected before fix (if missing script): module-not-found failure.

**Step 2: Implement minimal CI fixes**

Ensure:
- `actions/upload-artifact@v4` in workflows
- `scripts/test-changed-modules.js` present and tracked
- PR lint/prettier changed-files mode; push retains full checks
- Lighthouse not blocking PR scope for this backlog cleanup branch

**Step 3: Run local verification**

Run:
- `npm run build:incremental`
- `npm run test:changed`

Expected: both pass.

**Step 4: Commit slice A**

```bash
git add .github/workflows/ci.yml .github/workflows/release-gate.yml .gitignore scripts/test-changed-modules.js
git commit -m "ci: stabilize pr checks for PR1 backlog execution"
```

### Task 4: Slice B - Nginx Security Hardening Completion

**Files:**
- Modify: `frontend/nginx.conf`
- Create: `docs/LAUNCH_SECURITY_HEADERS_2026-03-01.md`
- Reference: `docs/plans/2026-03-01-nginx-security-hardening.md`

**Step 1: Write verification-first header checks**

Run: `curl -sI https://erp.ledux.ro -k`
Expected: capture baseline headers.

**Step 2: Apply hardening changes without Google Auth breakage**

Implement exactly:
- `server_tokens off;`
- add COOP/COEP headers
- keep HSTS preload-ready
- remove `'unsafe-inline'` from `script-src` only
- preserve Google domains in CSP

**Step 3: Validate Nginx and deploy safely**

Run:
- `docker compose exec frontend nginx -t`
- `docker compose up -d app && curl -sS http://localhost:3000/health`
- `docker compose up -d frontend && curl -sS https://65.108.255.104/health -k`

Expected: config valid, services healthy.

**Step 4: Record evidence and commit**

```bash
git add frontend/nginx.conf docs/LAUNCH_SECURITY_HEADERS_2026-03-01.md
git commit -m "security: complete nginx header hardening for launch"
```

### Task 5: Slice C - Suppliers/Catalog Contract Closure

**Files:**
- Modify: `modules/suppliers/src/infrastructure/scrapers/BusinessCentralScraper.ts`
- Modify: `modules/suppliers/src/application/use-cases/ScrapeSupplierStock.ts`
- Modify: `modules/suppliers/src/application/use-cases/ImportSupplierProducts.ts`
- Test: `modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts`

**Step 1: Write/expand failing tests for remaining edge cases**

Add tests for:
- duplicate supplier code merge behavior
- availability parsing variants from Business Central payloads

**Step 2: Run test to observe failure**

Run: `npm test -- --runInBand modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts`
Expected: failing assertions for uncovered edge cases.

**Step 3: Implement minimal fix**

Adjust parsing/merge logic only where test fails.

**Step 4: Re-run supplier tests + smoke subset**

Run:
- `npm test -- --runInBand modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts`
- `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts -t "Products|Inventory|workflow" --runInBand`

Expected: tests pass and no API regression.

**Step 5: Commit slice C**

```bash
git add modules/suppliers/src/application/use-cases/ImportSupplierProducts.ts modules/suppliers/src/application/use-cases/ScrapeSupplierStock.ts modules/suppliers/src/infrastructure/scrapers/BusinessCentralScraper.ts modules/suppliers/tests/infrastructure/BusinessCentralScraper.test.ts
git commit -m "fix: close remaining supplier parsing and merge edge cases"
```

### Task 6: Slice D - Auth/Users/Inventory Contract Closure

**Files:**
- Modify: `shared/middleware/auth.middleware.ts`
- Modify: `shared/services/JwtService.ts`
- Modify: `modules/users/src/api/validators/auth.validators.ts`
- Modify: `modules/inventory/src/api/routes/inventory.routes.ts`
- Tests: `tests/integration/auth-middleware.integration.test.ts`, `tests/integration/auth-refresh-route.integration.test.ts`, `tests/unit/JwtService.test.ts`

**Step 1: Add failing tests for remaining contract gaps**

Focus:
- token parsing/refresh edge cases
- role validation strictness
- protected route auth behavior

**Step 2: Run focused test set (expect fail)**

Run:
- `npm test -- --runInBand tests/integration/auth-middleware.integration.test.ts`
- `npm test -- --runInBand tests/integration/auth-refresh-route.integration.test.ts`
- `npm test -- --runInBand tests/unit/JwtService.test.ts`

**Step 3: Implement minimal contract fixes**

Only changes required for failing assertions.

**Step 4: Re-run focused tests + full smoke**

Run:
- same three test commands above
- `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts --runInBand`

Expected: pass across auth/user/inventory touched areas.

**Step 5: Commit slice D**

```bash
git add shared/middleware/auth.middleware.ts shared/services/JwtService.ts modules/users/src/api/validators/auth.validators.ts modules/inventory/src/api/routes/inventory.routes.ts tests/integration/auth-middleware.integration.test.ts tests/integration/auth-refresh-route.integration.test.ts tests/unit/JwtService.test.ts
git commit -m "fix: close remaining auth and contract edge cases for PR1"
```

### Task 7: Final Branch Verification and PR Update

**Files:**
- Modify: `docs/GO_LIVE_T0_CHECK_2026-03-01.md` (append new evidence)
- Modify: PR description/comments via `gh`

**Step 1: Run final verification gate**

Run:
- `npm run build:incremental`
- `API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts --runInBand`
- `bash scripts/t0-go-live-check.sh`

Expected: all pass.

**Step 2: Update evidence doc**

Append executed commands + outcomes + timestamp in `docs/GO_LIVE_T0_CHECK_2026-03-01.md`.

**Step 3: Push and update PR #1**

Run:
- `git push -u origin <branch>`
- `gh pr comment 1 --body "<slice closure summary + evidence>"`

Expected: PR has auditable closure log.

**Step 4: Final commit for docs-only updates**

```bash
git add docs/GO_LIVE_T0_CHECK_2026-03-01.md
git commit -m "docs: record PR1 backlog cleanup verification evidence"
```
