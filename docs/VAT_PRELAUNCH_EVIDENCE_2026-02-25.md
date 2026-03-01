# VAT Prelaunch Evidence - 2026-02-25

## Environment

- Target URL: `https://erp.ledux.ro`
- B2B URL: `https://b2b.ledux.ro`
- Kubernetes namespaces: `cypher`, `cypher-data`
- DB deployment: `postgres-staging`

Note: host-based ingress expects FQDN targets; raw IP smoke checks can return `502` even when services are healthy.

## One-command readiness

Executed:

```bash
APP_BASE_URL=https://erp.ledux.ro B2B_BASE_URL=https://b2b.ledux.ro \
DATA_NS=cypher-data DB_DEPLOYMENT=postgres-staging DB_USER=cypher_user DB_NAME=cypher_erp \
bash scripts/prelaunch-vat-readiness.sh "$APP_BASE_URL"
```

Result: **PASS**

- Static VAT literal guard: PASS
- DB open-doc VAT guard (`__TOTAL__ = 0`): PASS
- HTTP smoke (`5/5`): PASS

## SQL consistency checks (staging)

Open docs mismatch counts:

- `orders_open_mismatch = 0`
- `quotes_open_mismatch = 0`
- `b2b_orders_open_mismatch = 0`

Finalized docs touched during recalculation window:

- `orders_final_updated_in_window = 0`
- `quotes_final_updated_in_window = 0`
- `b2b_orders_final_updated_in_window = 0`

## Gate decision

Current VAT gate status for launch: **GO**.

## Host Launch Readiness (with VAT guard)

Executed:

```bash
VAT_GUARD_REQUIRED=true \
DATA_NS=cypher-data \
DB_DEPLOYMENT=postgres-staging \
DB_USER=cypher_user \
DB_NAME=cypher_erp \
BASE_URL=https://erp.ledux.ro \
B2B_URL=https://b2b.ledux.ro \
bash orchestration/k8s/launch-readiness-check.sh
```

Result: **PASS**

- Kubernetes/deployments/ingress: PASS
- VAT open-doc dry-run guard: PASS
- Backup timers + latest backup age: PASS
- TLS validity checks (`erp.ledux.ro`, `b2b.ledux.ro`): PASS
- Public health checks: PASS
- Authenticated smoke: SKIPPED (credentials not provided in this run)

## Re-validation snapshot (latest)

Executed again after readiness/CI hardening updates:

- `node scripts/check-vat-literals.cjs` -> PASS
- `bash scripts/recalculate-open-docs-vat-21.sh --dry-run --guard --k8s` -> PASS (`__TOTAL__ = 0`)
- `bash scripts/smoke-hetzner.sh "https://erp.ledux.ro"` with `B2B_BASE_URL=https://b2b.ledux.ro` -> PASS (`5/5`)

## End-to-end go-live drill

Executed:

```bash
bash scripts/vat-go-live-drill.sh \
  --base-url "https://erp.ledux.ro" \
  --b2b-url "https://b2b.ledux.ro" \
  --no-backup
```

Result: **PASS**

- VAT dry-run report: PASS (`__TOTAL__ = 0`)
- Prelaunch VAT readiness (3-step): PASS
- Host launch readiness (with VAT guard): PASS

## Fresh backup confirmation (pre-go-live)

Manual backup trigger executed:

```bash
systemctl start cypher-k8s-backup.service
```

Service result: `status=0/SUCCESS` (completed).

Latest artifact:

- `/root/backups/cypher_k8s_20260225_074520.sql.gz`
- SHA256: `0a009076e25f0e07eaed87c002192260c96d66845ff8e73660eb82eedeb6b886`
- Manifest counters: `users=13`, `products=28642`, `orders=0`, `suppliers=13`

## Integration updates completed

- `orchestration/k8s/launch-readiness-check.sh` now includes VAT open-doc dry-run guard when `VAT_GUARD_REQUIRED=true`.
- `orchestration/k8s/STAGING_ROLLOUT_CHECKLIST.md` includes VAT guard env block in the one-command readiness step.
