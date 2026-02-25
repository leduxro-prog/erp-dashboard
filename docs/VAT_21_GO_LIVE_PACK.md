# VAT 21% Go-Live Pack (Open Docs Only)

Use this pack during release window to enforce VAT 21% safely for non-final documents.

## 1) Pre-Deploy Backup (Mandatory)

```bash
# on Hetzner host
systemctl start cypher-k8s-backup.service

# verify latest artifact exists
ls -lt /root/backups/cypher_k8s_*.sql.gz | head -n 3

# verify manifest for latest backup
ls -lt /root/backups/cypher_k8s_*.manifest | head -n 3
```

Use the latest `.manifest` file to validate checksum + baseline table counters.

## 2) Guard Dry-Run (No Data Changes)

```bash
# on Hetzner host, project root
DATA_NS=cypher-data \
DB_DEPLOYMENT=postgres-staging \
DB_USER=cypher_user \
DB_NAME=cypher_erp \
bash scripts/recalculate-open-docs-vat-21.sh --dry-run --guard --k8s
```

Expected: `__TOTAL__` mismatches is `0`.

## 3) Apply Recalculation (Open Docs Only)

Run only if dry-run shows mismatches:

```bash
DATA_NS=cypher-data \
DB_DEPLOYMENT=postgres-staging \
DB_USER=cypher_user \
DB_NAME=cypher_erp \
bash scripts/recalculate-open-docs-vat-21.sh --apply --guard --k8s
```

Behavior:

1. Report before update (with sample IDs)
2. Apply SQL update for open statuses only
3. Report after update
4. Non-zero exit if mismatches remain

## 4) Smoke + VAT Guard Gate

CI/CD now enforces:

- static source guard against VAT 19% literals (`node scripts/check-vat-literals.cjs`)
- post-deploy staging VAT DB guard in `deploy-hetzner.yml`

Optional one-command prelaunch gate (local operator run):

```bash
APP_BASE_URL=https://erp.ledux.ro \
B2B_BASE_URL=https://b2b.ledux.ro \
DATA_NS=cypher-data \
DB_DEPLOYMENT=postgres-staging \
DB_USER=cypher_user \
DB_NAME=cypher_erp \
bash scripts/prelaunch-vat-readiness.sh "$APP_BASE_URL"
```

Host-level launch readiness can also enforce VAT DB guard:

```bash
VAT_GUARD_REQUIRED=true \
DATA_NS=cypher-data \
DB_DEPLOYMENT=postgres-staging \
DB_USER=cypher_user \
DB_NAME=cypher_erp \
bash orchestration/k8s/launch-readiness-check.sh
```

Do not mark release green if VAT guard fails.

## 5) Rollback Procedure

Trigger rollback if:

- VAT guard fails after apply
- smoke tests fail
- unexpected document totals appear in UI/API

Rollback actions:

```bash
# app rollback
kubectl -n cypher rollout undo deployment/cypher-app
kubectl -n cypher rollout undo deployment/cypher-frontend
kubectl -n cypher rollout status deployment/cypher-app --timeout=240s
kubectl -n cypher rollout status deployment/cypher-frontend --timeout=240s

# if DB restore is required, use latest validated backup
# (example - adjust file path)
gunzip -c /root/backups/cypher_k8s_<timestamp>.sql.gz | \
  kubectl -n cypher-data exec -i deploy/postgres-staging -- \
  psql -U cypher_user -d cypher_erp
```

After rollback/restore, re-run dry-run VAT guard and smoke tests.

## 6) One-command VAT Go-Live Drill

This orchestrates dry-run VAT report, optional auto-apply, prelaunch readiness, and host launch readiness:

```bash
bash scripts/vat-go-live-drill.sh \
  --base-url "https://erp.ledux.ro" \
  --b2b-url "https://b2b.ledux.ro" \
  --apply-if-needed
```

For rehearsal without backup trigger:

```bash
bash scripts/vat-go-live-drill.sh \
  --base-url "https://erp.ledux.ro" \
  --b2b-url "https://b2b.ledux.ro" \
  --no-backup
```
