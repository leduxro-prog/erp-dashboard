#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BASE_URL="${1:-${APP_BASE_URL:-}}"
if [[ -z "$BASE_URL" ]]; then
  echo "[ERROR] Missing BASE URL."
  echo "Usage: bash scripts/prelaunch-vat-readiness.sh http://<host>"
  echo "   or: APP_BASE_URL=http://<host> bash scripts/prelaunch-vat-readiness.sh"
  exit 1
fi

if [[ "$BASE_URL" =~ ^https?://([0-9]{1,3}\.){3}[0-9]{1,3}(/|$) ]]; then
  echo "[WARN] BASE_URL uses a raw IP. Host-based ingress may return 502 for IP requests."
  echo "[WARN] Prefer FQDN targets (for example: https://erp.ledux.ro) and set B2B_BASE_URL if needed."
fi

echo "============================================"
echo "  VAT 21% Prelaunch Readiness"
echo "  Target: $BASE_URL"
echo "  Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"

echo ""
echo "[STEP 1/3] Static VAT literal guard"
(
  cd "$ROOT_DIR"
  node scripts/check-vat-literals.cjs
)

echo ""
echo "[STEP 2/3] DB open-doc VAT guard (k8s dry-run)"
(
  cd "$ROOT_DIR"
  DATA_NS="${DATA_NS:-cypher-data}" \
  DB_DEPLOYMENT="${DB_DEPLOYMENT:-postgres-staging}" \
  DB_USER="${DB_USER:-cypher_user}" \
  DB_NAME="${DB_NAME:-cypher_erp}" \
  bash scripts/recalculate-open-docs-vat-21.sh --dry-run --guard --k8s
)

echo ""
echo "[STEP 3/3] HTTP smoke checks"
(
  cd "$ROOT_DIR"
  bash scripts/smoke-hetzner.sh "$BASE_URL"
)

echo ""
echo "[OK] VAT prelaunch readiness passed."
