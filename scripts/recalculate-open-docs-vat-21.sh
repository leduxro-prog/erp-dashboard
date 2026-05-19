#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLY_SQL="$ROOT_DIR/scripts/recalculate-open-docs-vat-21.sql"
REPORT_SQL="$ROOT_DIR/scripts/report-open-docs-vat-21.sql"

MODE="dry-run"
FAIL_ON_MISMATCH="false"
K8S_MODE="false"
DATABASE_URL="${DATABASE_URL:-}"

DATA_NS="${DATA_NS:-cypher-data}"
DB_DEPLOYMENT="${DB_DEPLOYMENT:-postgres-staging}"
DB_USER="${DB_USER:-cypher_user}"
DB_NAME="${DB_NAME:-cypher_erp}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/recalculate-open-docs-vat-21.sh [options]

Options:
  --dry-run            Report-only mode (default)
  --report-only        Alias for --dry-run
  --apply              Run recalculation SQL, with report before/after
  --guard              Exit non-zero when mismatches > 0
  --database-url URL   PostgreSQL connection URL (or set DATABASE_URL)
  --k8s                Run psql through kubectl exec deploy/<DB_DEPLOYMENT>
  --help               Show this help

Kubernetes mode env vars:
  DATA_NS, DB_DEPLOYMENT, DB_USER, DB_NAME
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run|--report-only)
      MODE="dry-run"
      ;;
    --apply)
      MODE="apply"
      ;;
    --guard)
      FAIL_ON_MISMATCH="true"
      ;;
    --database-url)
      DATABASE_URL="${2:-}"
      if [[ -z "$DATABASE_URL" ]]; then
        echo "[ERROR] --database-url requires a value"
        exit 1
      fi
      shift
      ;;
    --k8s)
      K8S_MODE="true"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "$APPLY_SQL" ]]; then
  echo "[ERROR] Missing SQL file: $APPLY_SQL"
  exit 1
fi

if [[ ! -f "$REPORT_SQL" ]]; then
  echo "[ERROR] Missing SQL file: $REPORT_SQL"
  exit 1
fi

run_report_raw() {
  if [[ "$K8S_MODE" == "true" ]]; then
    kubectl -n "$DATA_NS" exec -i "deploy/$DB_DEPLOYMENT" -- \
      psql -X -qAt -F '|' -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -f - < "$REPORT_SQL"
    return
  fi

  if [[ -n "$DATABASE_URL" ]]; then
    psql "$DATABASE_URL" -X -qAt -F '|' -v ON_ERROR_STOP=1 -f "$REPORT_SQL"
  else
    psql -X -qAt -F '|' -v ON_ERROR_STOP=1 -f "$REPORT_SQL"
  fi
}

run_apply() {
  if [[ "$K8S_MODE" == "true" ]]; then
    kubectl -n "$DATA_NS" exec -i "deploy/$DB_DEPLOYMENT" -- \
      psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -f - < "$APPLY_SQL"
    return
  fi

  if [[ -n "$DATABASE_URL" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$APPLY_SQL"
  else
    psql -v ON_ERROR_STOP=1 -f "$APPLY_SQL"
  fi
}

print_report() {
  local raw_report="$1"
  local total="0"

  echo "target|status_scope|mismatches|sample_ids"
  while IFS='|' read -r target status_scope mismatches sample_ids; do
    [[ -z "${target:-}" ]] && continue
    if [[ "$target" == "__TOTAL__" ]]; then
      total="${mismatches:-0}"
    fi
    echo "$target|$status_scope|$mismatches|$sample_ids"
  done <<< "$raw_report"

  if [[ -z "$total" ]]; then
    total="0"
  fi

  REPORT_TOTAL="$total"
}

run_guard_check() {
  if [[ "$FAIL_ON_MISMATCH" == "true" && "$REPORT_TOTAL" -gt 0 ]]; then
    echo "[ERROR] VAT guard failed: found $REPORT_TOTAL open-doc VAT mismatch(es)."
    exit 1
  fi
}

if [[ "$K8S_MODE" == "true" ]]; then
  kubectl -n "$DATA_NS" get deploy "$DB_DEPLOYMENT" >/dev/null
fi

echo "[INFO] VAT open-doc recalculation mode: $MODE"
if [[ "$K8S_MODE" == "true" ]]; then
  echo "[INFO] Connection: kubectl exec deploy/$DB_DEPLOYMENT in namespace $DATA_NS"
else
  if [[ -n "$DATABASE_URL" ]]; then
    echo "[INFO] Connection: DATABASE_URL provided"
  else
    echo "[INFO] Connection: default local psql environment"
  fi
fi

echo ""
echo "[INFO] Report BEFORE"
BEFORE_REPORT="$(run_report_raw)"
print_report "$BEFORE_REPORT"
echo "[INFO] Total mismatches before: $REPORT_TOTAL"

if [[ "$MODE" == "apply" ]]; then
  echo ""
  echo "[INFO] Applying SQL recalculation for open documents only"
  run_apply

  echo ""
  echo "[INFO] Report AFTER"
  AFTER_REPORT="$(run_report_raw)"
  print_report "$AFTER_REPORT"
  echo "[INFO] Total mismatches after: $REPORT_TOTAL"
fi

run_guard_check

echo ""
echo "[OK] VAT open-doc check finished."
