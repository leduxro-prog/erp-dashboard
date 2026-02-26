# Launch Changeset Scope - 2026-02-26

Use this scope for a focused launch commit from the current dirty tree.

## Core files (launch + stability)

- `scripts/t0-go-live-check.sh`
- `scripts/go-live-gate.sh`
- `scripts/deploy-safe-app.sh`
- `modules/suppliers/src/application/use-cases/ScrapeSupplierStock.ts`
- `modules/suppliers/src/infrastructure/jobs/SupplierSyncJob.ts`
- `modules/b2b-portal/src/api/controllers/B2BController.ts`
- `modules/inventory/src/api/controllers/InventoryImageControllerService.ts`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `.env.example`

## Host automation files (systemd gate)

- `orchestration/k8s/install-host-services.sh`
- `orchestration/k8s/host/systemd/cypher-go-live-gate.service`
- `orchestration/k8s/host/systemd/cypher-go-live-gate.timer`
- `orchestration/k8s/host/env/cypher-go-live-gate.example`

## Evidence docs

- `docs/LAUNCH_POSTLIVE_EVIDENCE_2026-02-26.md`

## Suggested selective stage command

```bash
git add \
  scripts/t0-go-live-check.sh \
  scripts/go-live-gate.sh \
  scripts/deploy-safe-app.sh \
  modules/suppliers/src/application/use-cases/ScrapeSupplierStock.ts \
  modules/suppliers/src/infrastructure/jobs/SupplierSyncJob.ts \
  modules/b2b-portal/src/api/controllers/B2BController.ts \
  modules/inventory/src/api/controllers/InventoryImageControllerService.ts \
  docker-compose.yml \
  docker-compose.dev.yml \
  .env.example \
  orchestration/k8s/install-host-services.sh \
  orchestration/k8s/host/systemd/cypher-go-live-gate.service \
  orchestration/k8s/host/systemd/cypher-go-live-gate.timer \
  orchestration/k8s/host/env/cypher-go-live-gate.example \
  docs/LAUNCH_POSTLIVE_EVIDENCE_2026-02-26.md \
  docs/LAUNCH_CHANGESET_SCOPE_2026-02-26.md
```
