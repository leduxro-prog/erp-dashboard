#!/bin/bash
# ==============================================================================
# Smoke Tests - Hetzner Post-Deploy
# ==============================================================================
# Runs basic health checks against the Hetzner server.
# Idempotent - safe to run multiple times.
#
# Usage:
#   ./scripts/smoke-hetzner.sh                          # uses HETZNER_HOST env
#   HETZNER_HOST=65.108.255.104 ./scripts/smoke-hetzner.sh
#   ./scripts/smoke-hetzner.sh http://65.108.255.104    # explicit base URL
# ==============================================================================

set -euo pipefail

# ---------- Config ----------
if [ -n "${1:-}" ]; then
  BASE_URL="$1"
elif [ -n "${HETZNER_HOST:-}" ]; then
  BASE_URL="http://${HETZNER_HOST}"
else
  echo "[ERROR] No target specified."
  echo "Usage: HETZNER_HOST=<ip> $0"
  echo "   or: $0 http://<ip>"
  exit 1
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

PASS=0
FAIL=0
TOTAL=0

# ---------- Helpers ----------
check() {
  local name="$1"
  local url="$2"
  local expected_code="${3:-200}"
  TOTAL=$((TOTAL + 1))

  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 15 "$url" 2>/dev/null || echo "000")

  if [ "$code" = "$expected_code" ]; then
    echo "[PASS] $name (HTTP $code)"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name -> $url (HTTP $code, expected $expected_code)"
    FAIL=$((FAIL + 1))
  fi
}

check_post_any() {
  local name="$1"
  local url="$2"
  local payload="$3"
  shift 3
  TOTAL=$((TOTAL + 1))

  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 15 \
    -X POST -H 'Content-Type: application/json' -d "$payload" "$url" 2>/dev/null || echo "000")

  for expected in "$@"; do
    if [ "$code" = "$expected" ]; then
      echo "[PASS] $name (HTTP $code)"
      PASS=$((PASS + 1))
      return
    fi
  done

  echo "[FAIL] $name -> $url (HTTP $code, expected one of: $*)"
  FAIL=$((FAIL + 1))
}

check_json_field() {
  local name="$1"
  local url="$2"
  local field="$3"
  local expected="$4"
  TOTAL=$((TOTAL + 1))

  local body
  body=$(curl -sf --connect-timeout 10 --max-time 15 "$url" 2>/dev/null || echo "")

  if [ -z "$body" ]; then
    echo "[FAIL] $name -> $url (no response)"
    FAIL=$((FAIL + 1))
    return
  fi

  local value
  value=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field',''))" 2>/dev/null || echo "")

  if [ "$value" = "$expected" ]; then
    echo "[PASS] $name ($field=$value)"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $name ($field='$value', expected '$expected')"
    FAIL=$((FAIL + 1))
  fi
}

# ---------- Smoke Checks ----------
echo "============================================"
echo "  Hetzner Smoke Tests"
echo "  Target: $BASE_URL"
echo "  Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"
echo ""

# Backend health (direct port)
check "Backend health (port 3000)" "$BASE_URL:3000/health"

# API v1 health (via nginx proxy)
check "API v1 health (via nginx)"  "$BASE_URL/api/v1/health"

# Frontend root (nginx serves React)
check "Frontend root"              "$BASE_URL/"

# B2B endpoints
check "B2B products filters"       "$BASE_URL/api/v1/b2b/products/filters"
check "B2B product categories"     "$BASE_URL/api/v1/b2b/products/categories"

# Auth endpoints exist (should not be 404)
check_post_any "ERP login endpoint exists" "$BASE_URL/api/v1/users/login" '{}' \
  "200" "400" "401" "403" "429"
check_post_any "B2B login endpoint exists" "$BASE_URL/api/v1/b2b-auth/login" '{}' \
  "200" "400" "401" "403" "429"

echo ""
echo "============================================"
echo "  Results: $PASS/$TOTAL passed, $FAIL failed"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "[ERROR] $FAIL smoke check(s) failed!"
  exit 1
fi

echo ""
echo "[OK] All smoke checks passed."
exit 0
