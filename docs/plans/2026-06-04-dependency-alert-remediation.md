# Dependency Alert Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clear the new npm Dependabot alerts reported on 2026-06-04 while preserving current ERP/B2B runtime behavior.

**Architecture:** This is a dependency-only remediation. Prefer lockfile/package updates that move vulnerable packages to patched versions, then validate with audits, build, targeted tests, CI, deploy, and live smoke checks.

**Tech Stack:** Node.js, npm lockfiles, React/Vite frontend, TypeScript backend, GitHub Actions, Docker Compose Hetzner deploy.

---

### Task 1: Capture Current Alert Baseline

**Files:**
- Read-only: GitHub Dependabot API
- Read-only: `package.json`
- Read-only: `package-lock.json`
- Read-only: `frontend/package.json`
- Read-only: `frontend/package-lock.json`

**Step 1: List open alerts**

Run:
```bash
gh api repos/leduxro-prog/erp-dashboard/dependabot/alerts?state=open --jq '.[] | [.number, .dependency.manifest_path, .dependency.package.name, .security_advisory.severity, .security_advisory.summary, .security_vulnerability.vulnerable_version_range, (.security_vulnerability.first_patched_version.identifier // "none")] | @tsv'
```

Expected: alerts are listed with package, severity, vulnerable range, and patched version.

**Step 2: Run npm audit baseline**

Run:
```bash
npm audit --audit-level=moderate
npm audit --audit-level=moderate --prefix frontend
```

Expected: current audit output identifies vulnerable packages or confirms GitHub-only advisory coverage.

### Task 2: Apply Minimal Dependency Updates

**Files:**
- Modify: `package.json` only if direct dependency ranges must change
- Modify: `package-lock.json`
- Modify: `frontend/package.json` only if direct dependency ranges must change
- Modify: `frontend/package-lock.json`

**Step 1: Prefer npm audit fix**

Run:
```bash
npm audit fix
npm audit fix --prefix frontend
```

Expected: patched transitive versions are selected where possible without force upgrades.

**Step 2: Manually update remaining direct ranges only if needed**

If alerts remain for packages with patched versions but `npm audit fix` cannot update them, update the minimum direct ranges with `npm install <package>@<patched-version>` in the relevant workspace.

Expected: no broad dependency upgrades beyond packages needed to satisfy advisories.

### Task 3: Verify Locally

**Files:**
- Read-only verification across repo.

**Step 1: Audits**

Run:
```bash
npm audit --audit-level=moderate
npm audit --audit-level=moderate --prefix frontend
```

Expected: `found 0 vulnerabilities` for both.

**Step 2: Builds**

Run:
```bash
npm run build
npm run build --prefix frontend
```

Expected: both complete successfully.

**Step 3: Targeted regression tests**

Run:
```bash
npx jest tests/unit/DeploymentRuntimePolicy.test.ts --runInBand
npx jest tests/smoke/InventoryImageUploadPolicy.test.ts --runInBand
```

Expected: all targeted tests pass.

**Step 4: Diff review**

Run:
```bash
git diff --check
git diff -- package.json package-lock.json frontend/package.json frontend/package-lock.json
```

Expected: no whitespace errors; dependency diff is limited to patched packages and required transitive updates.

### Task 4: PR, CI, Deploy, Live Smoke

**Files:**
- GitHub PR only.

**Step 1: Commit and PR**

Run:
```bash
git add package.json package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "fix: remediate npm dependency alerts"
git push -u origin fix/dependency-alerts-2026-06-04
gh pr create --base main --head fix/dependency-alerts-2026-06-04 --title "fix: remediate npm dependency alerts"
```

Expected: PR opens with dependency-only diff.

**Step 2: CI and merge**

Run:
```bash
gh pr checks <PR_NUMBER> --watch
gh pr merge <PR_NUMBER> --squash --delete-branch
```

Expected: CI passes before merge.

**Step 3: Confirm alerts clear and deploy passes**

Run:
```bash
gh api repos/leduxro-prog/erp-dashboard/dependabot/alerts?state=open --jq 'length'
gh run list --workflow deploy-hetzner.yml --branch main --limit 1 --json databaseId,status,conclusion,url,headSha
```

Expected: open alert count is `0`; deploy is successful.

**Step 4: Live smoke**

Run:
```bash
curl -fsSL http://65.108.255.104/health
curl -fsS https://b2b.ledux.ro/health
curl -fsS "https://b2b.ledux.ro/api/v1/b2b/products?page=1&limit=3&compact=true&sort=newest"
curl -fsS "https://b2b.ledux.ro/api/v1/b2b/products/filters"
```

Expected: ERP/B2B health OK; B2B catalog products and filters return `success: true`.
