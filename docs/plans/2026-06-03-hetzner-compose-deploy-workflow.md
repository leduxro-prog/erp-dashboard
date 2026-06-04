# Hetzner Compose Deploy Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the GitHub Actions Hetzner deployment use the Docker Compose runtime that is actually running on the live VPS.

**Architecture:** Keep the existing SSH-based deploy pipeline and secrets, but replace k3s/kubectl rollout assumptions with Docker Compose commands executed in `HETZNER_TARGET_DIR`. Preserve a blocking pre-deploy backup, sync files before build, rebuild only `app` and `frontend`, and run the existing HTTP smoke checks after rollout.

**Tech Stack:** GitHub Actions, SSH, rsync, Docker Compose, Jest policy tests.

---

### Task 1: Add Regression Test for Compose Runtime

**Files:**
- Modify: `tests/unit/DeploymentRuntimePolicy.test.ts`

**Step 1: Write the failing test**

Update the deployment runtime policy test to assert that `.github/workflows/deploy-hetzner.yml` does not call Kubernetes-only commands (`cypher-k8s-backup.service`, `k3s ctr`, `kubectl`) and does call Docker Compose build/up commands for `app` and `frontend`.

**Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/DeploymentRuntimePolicy.test.ts --runInBand`

Expected: FAIL because the current workflow still contains `cypher-k8s-backup.service`, `k3s ctr`, and `kubectl` rollout commands.

### Task 2: Replace k3s Deploy Steps with Docker Compose

**Files:**
- Modify: `.github/workflows/deploy-hetzner.yml`

**Step 1: Implement minimal workflow change**

Replace the pre-deploy backup with a blocking Docker Compose backup command that creates `backups/github-actions/<timestamp>/`, writes `docker compose ps`, attempts best-effort rollback image capture from the currently running app/frontend containers, archives mutable directories if present, and performs a blocking PostgreSQL dump from `cypher-erp-db`.

Replace Kubernetes rollout with:

```bash
cd "$HETZNER_TARGET_DIR"
docker compose build app frontend
docker compose up -d app frontend
docker compose ps app frontend
```

Replace rollback job with a conservative `docker compose up -d app frontend` plus health/status output, because Docker Compose has no previous Kubernetes ReplicaSet to undo.

Replace the VAT guard `--k8s` usage with `docker exec cypher-erp-db psql ...` through `--database-url` only if a direct DB URL is available, otherwise keep it out of this deploy workflow.

**Step 2: Run test to verify it passes**

Run: `npx jest tests/unit/DeploymentRuntimePolicy.test.ts --runInBand`

Expected: PASS.

### Task 3: Verify Locally and on GitHub

**Files:**
- No code changes unless verification fails.

**Step 1: Local verification**

Run: `npm run build`
Expected: PASS.

Run: `npx jest tests/unit/DeploymentRuntimePolicy.test.ts --runInBand`
Expected: PASS.

**Step 2: Remote workflow verification**

Push through PR/merge, then run: `gh workflow run deploy-hetzner.yml --ref main -f skip_build_checks=false`.

Expected: deploy job reaches Docker Compose rollout and smoke checks pass.

**Step 3: Live smoke checks**

Run:

```bash
curl -fsSL http://65.108.255.104/health
curl -fsS https://b2b.ledux.ro/health
curl -fsS "https://b2b.ledux.ro/api/v1/b2b/products?page=1&limit=12&compact=true&sort=newest"
curl -fsS "https://b2b.ledux.ro/api/v1/b2b/products/filters"
```

Expected: all return successful responses.
