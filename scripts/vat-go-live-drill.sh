#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BASE_URL="${BASE_URL:-}"
B2B_URL="${B2B_URL:-}"
APPLY_IF_NEEDED="false"
RUN_BACKUP="true"

DATA_NS="${DATA_NS:-cypher-data}"
DB_DEPLOYMENT="${DB_DEPLOYMENT:-postgres-staging}"
DB_USER="${DB_USER:-cypher_user}"
DB_NAME="${DB_NAME:-cypher_erp}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/vat-go-live-drill.sh --base-url <url> --b2b-url <url> [options]

Options:
  --base-url URL        ERP URL (example: https://erp.ledux.ro)
  --b2b-url URL         B2B URL (example: https://b2b.ledux.ro)
  --apply-if-needed     If dry-run finds mismatches, apply open-doc VAT recalculation
  --no-backup           Skip manual backup trigger step
  --help                Show this help

Environment defaults:
  DATA_NS, DB_DEPLOYMENT, DB_USER, DB_NAME
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift
      ;;
    --b2b-url)
      B2B_URL="${2:-}"
      shift
      ;;
    --apply-if-needed)
      APPLY_IF_NEEDED="true"
      ;;
    --no-backup)
      RUN_BACKUP="false"
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

if [[ -z "$BASE_URL" || -z "$B2B_URL" ]]; then
  echo "[ERROR] --base-url and --b2b-url are required"
  usage
  exit 1
fi

if [[ "$RUN_BACKUP" == "true" ]]; then
  echo "[STEP] Trigger backup service"
  systemctl start cypher-k8s-backup.service
fi

echo "[STEP] VAT dry-run report"
DRY_OUTPUT="$(
  cd "$ROOT_DIR"
  DATA_NS="$DATA_NS" \
  DB_DEPLOYMENT="$DB_DEPLOYMENT" \
  DB_USER="$DB_USER" \
  DB_NAME="$DB_NAME" \
  bash scripts/recalculate-open-docs-vat-21.sh --dry-run --k8s
 )"
printf '%s\n' "$DRY_OUTPUT"

TOTAL_MISMATCHES="$(printf '%s\n' "$DRY_OUTPUT" | awk -F'|' '$1=="__TOTAL__" {v=$3} END {print v}')"
if [[ -z "$TOTAL_MISMATCHES" ]]; then
  echo "[ERROR] Could not parse __TOTAL__ mismatches from dry-run output"
  exit 1
fi

if (( TOTAL_MISMATCHES > 0 )); then
  echo "[WARN] Found $TOTAL_MISMATCHES mismatch(es) in open documents"
  if [[ "$APPLY_IF_NEEDED" == "true" ]]; then
    echo "[STEP] Applying VAT recalculation for open documents"
    (
      cd "$ROOT_DIR"
      DATA_NS="$DATA_NS" \
      DB_DEPLOYMENT="$DB_DEPLOYMENT" \
      DB_USER="$DB_USER" \
      DB_NAME="$DB_NAME" \
      bash scripts/recalculate-open-docs-vat-21.sh --apply --guard --k8s
    )
  else
    echo "[ERROR] Dry-run mismatch found. Re-run with --apply-if-needed or apply manually."
    exit 1
  fi
fi

echo "[STEP] Prelaunch VAT readiness"
(
  cd "$ROOT_DIR"
  APP_BASE_URL="$BASE_URL" \
  B2B_BASE_URL="$B2B_URL" \
  DATA_NS="$DATA_NS" \
  DB_DEPLOYMENT="$DB_DEPLOYMENT" \
  DB_USER="$DB_USER" \
  DB_NAME="$DB_NAME" \
  bash scripts/prelaunch-vat-readiness.sh "$BASE_URL"
)

echo "[STEP] Host launch readiness with VAT guard"
(
  cd "$ROOT_DIR"
  VAT_GUARD_REQUIRED=true \
  DATA_NS="$DATA_NS" \
  DB_DEPLOYMENT="$DB_DEPLOYMENT" \
  DB_USER="$DB_USER" \
  DB_NAME="$DB_NAME" \
  BASE_URL="$BASE_URL" \
  B2B_URL="$B2B_URL" \
  bash orchestration/k8s/launch-readiness-check.sh
)

echo "[OK] VAT go-live drill completed successfully."
