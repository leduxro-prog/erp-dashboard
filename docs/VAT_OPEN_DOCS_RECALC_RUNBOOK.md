# VAT 21% Open Documents Runbook

This runbook standardizes VAT maintenance for open/draft documents only.

## Scope

- Recalculation script: `scripts/recalculate-open-docs-vat-21.sql`
- Report script: `scripts/report-open-docs-vat-21.sql`
- Wrapper CLI: `scripts/recalculate-open-docs-vat-21.sh`
- Business rule: only open statuses are eligible (`draft`/`pending`/quote-phase/open B2B states).

## Dry-Run Report (no data changes)

```bash
bash scripts/recalculate-open-docs-vat-21.sh --dry-run --guard --database-url "$DATABASE_URL"
```

Output columns:

- `target`: checked table
- `status_scope`: statuses included in check
- `mismatches`: rows where VAT math is not aligned to 21%
- `sample_ids`: up to 5 IDs for quick investigation

The report also includes a synthetic `__TOTAL__` row.

`--guard` fails with non-zero exit when `__TOTAL__.mismatches > 0`.

## Apply Recalculation + Before/After Report

```bash
bash scripts/recalculate-open-docs-vat-21.sh --apply --guard --database-url "$DATABASE_URL"
```

Behavior:

1. Prints report before changes.
2. Executes recalculation SQL (open documents only, mismatch rows only).
3. Prints report after changes.
4. Fails if remaining mismatches are detected (`--guard`).

## Kubernetes Staging Mode

Use this mode when DB is accessible only in-cluster:

```bash
DATA_NS=cypher-data \
DB_DEPLOYMENT=postgres-staging \
DB_USER=cypher_user \
DB_NAME=cypher_erp \
bash scripts/recalculate-open-docs-vat-21.sh --dry-run --guard --k8s
```

The script runs `psql` through `kubectl exec deploy/<DB_DEPLOYMENT>`.

## One-Command Prelaunch Verification

Run static VAT guard + DB dry-run guard + HTTP smoke in one command:

```bash
APP_BASE_URL=https://erp.ledux.ro \
B2B_BASE_URL=https://b2b.ledux.ro \
DATA_NS=cypher-data \
DB_DEPLOYMENT=postgres-staging \
DB_USER=cypher_user \
DB_NAME=cypher_erp \
bash scripts/prelaunch-vat-readiness.sh "$APP_BASE_URL"
```

For full go-live drill (including host launch readiness), use:

```bash
bash scripts/vat-go-live-drill.sh \
  --base-url "https://erp.ledux.ro" \
  --b2b-url "https://b2b.ledux.ro" \
  --apply-if-needed
```
