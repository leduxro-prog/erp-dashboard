#!/bin/bash
# ==============================================================================
# Domain Readiness Checks
# ==============================================================================
# Validates that the application is configured correctly for domain-based
# access (pre-cutover check). Runs against current Hetzner server.
#
# This script checks configuration, NOT DNS. It verifies the app would work
# correctly once DNS is pointed at this server.
#
# Usage:
#   ./scripts/smoke-domain-ready.sh
#   HETZNER_HOST=65.108.255.104 ./scripts/smoke-domain-ready.sh
# ==============================================================================

set -euo pipefail

# ---------- Config ----------
HETZNER_HOST="${HETZNER_HOST:-${1:-}}"

if [ -z "$HETZNER_HOST" ]; then
  echo "[ERROR] No target specified."
  echo "Usage: HETZNER_HOST=<ip> $0"
  echo "   or: $0 <ip>"
  exit 1
fi

BASE_URL="http://${HETZNER_HOST}"

PASS=0
FAIL=0
WARN=0
TOTAL=0

# ---------- Helpers ----------
pass() {
  echo "[PASS] $1"
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
}

fail() {
  echo "[FAIL] $1"
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
}

warn() {
  echo "[WARN] $1"
  WARN=$((WARN + 1))
  TOTAL=$((TOTAL + 1))
}

# ---------- Checks ----------
echo "============================================"
echo "  Domain Readiness Checks"
echo "  Target: $HETZNER_HOST"
echo "  Time:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"
echo ""

# --- 1. Backend is running ---
echo "--- Service Health ---"

code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "${BASE_URL}:3000/health" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  pass "Backend health endpoint responds (HTTP $code)"
else
  fail "Backend health endpoint (HTTP $code)"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "${BASE_URL}/" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  pass "Frontend serves HTML (HTTP $code)"
else
  fail "Frontend not responding (HTTP $code)"
fi

# --- 2. CORS headers include domain ---
echo ""
echo "--- CORS Configuration ---"

cors_response=$(curl -s -D - -o /dev/null --connect-timeout 10 \
  -H "Origin: https://ledux.ro" \
  "${BASE_URL}:3000/health" 2>/dev/null || echo "")

if echo "$cors_response" | grep -qi "access-control-allow-origin.*ledux.ro"; then
  pass "CORS allows https://ledux.ro origin"
else
  warn "CORS does not explicitly return ledux.ro (may need env update at cutover)"
fi

cors_creds=$(echo "$cors_response" | grep -i "access-control-allow-credentials" || echo "")
if echo "$cors_creds" | grep -qi "true"; then
  pass "CORS credentials enabled"
else
  warn "CORS credentials header not detected"
fi

# --- 3. API endpoints functional ---
echo ""
echo "--- API Endpoints ---"

code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "${BASE_URL}/api/v1/health" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  pass "API v1 health via nginx proxy"
else
  fail "API v1 health via nginx proxy (HTTP $code)"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "${BASE_URL}/api/v1/b2b/products/filters" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  pass "B2B products filters"
else
  fail "B2B products filters (HTTP $code)"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "${BASE_URL}/api/v1/b2b/products/categories" 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then
  pass "B2B product categories"
else
  fail "B2B product categories (HTTP $code)"
fi

# --- 4. Auth endpoints exist (not 404) ---
echo ""
echo "--- Auth Endpoints ---"

code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 \
  -X POST -H "Content-Type: application/json" -d '{}' \
  "${BASE_URL}/api/v1/users/login" 2>/dev/null || echo "000")
if [ "$code" != "404" ] && [ "$code" != "000" ]; then
  pass "ERP auth login endpoint exists (HTTP $code)"
else
  fail "ERP auth login endpoint missing (HTTP $code)"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 \
  -X POST -H "Content-Type: application/json" -d '{}' \
  "${BASE_URL}/api/v1/b2b-auth/login" 2>/dev/null || echo "000")
if [ "$code" != "404" ] && [ "$code" != "000" ]; then
  pass "B2B auth login endpoint exists (HTTP $code)"
else
  fail "B2B auth login endpoint missing (HTTP $code)"
fi

# --- 5. Frontend bundle check ---
echo ""
echo "--- Frontend Bundle ---"

frontend_html=$(curl -sf --connect-timeout 10 "${BASE_URL}/" 2>/dev/null || echo "")
if echo "$frontend_html" | grep -q "script.*src.*assets"; then
  pass "Frontend HTML contains bundled JS assets"
elif echo "$frontend_html" | grep -q "<script"; then
  warn "Frontend has script tags but no recognizable Vite asset pattern"
else
  fail "Frontend HTML missing JavaScript bundle"
fi

if echo "$frontend_html" | grep -q "<div id=\"root\""; then
  pass "Frontend has React root element"
else
  warn "Frontend missing <div id=\"root\"> (may use different mount point)"
fi

# --- 6. Container status (if SSH available) ---
echo ""
echo "--- Docker Containers (via API) ---"

# Check if we can reach expected ports
for port_service in "3000:backend" "80:frontend" "5432:postgres" "6379:redis"; do
  port="${port_service%%:*}"
  service="${port_service##*:}"

  reachable=1
  if command -v nc >/dev/null 2>&1; then
    nc -z -w3 "$HETZNER_HOST" "$port" >/dev/null 2>&1 && reachable=0
  else
    timeout 3 bash -c "</dev/tcp/$HETZNER_HOST/$port" >/dev/null 2>&1 && reachable=0
  fi

  if [ "$port" = "3000" ] || [ "$port" = "80" ]; then
    if [ "$reachable" -eq 0 ]; then
      pass "Port $port ($service) is reachable"
    else
      fail "Port $port ($service) not reachable"
    fi
  else
    if [ "$reachable" -ne 0 ]; then
      pass "Port $port ($service) not externally exposed (correct for production)"
    else
      warn "Port $port ($service) is externally reachable - consider firewall restriction"
    fi
  fi
done

# ---------- Summary ----------
echo ""
echo "============================================"
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "  Total:   $TOTAL checks"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "[NOT READY] $FAIL check(s) failed. Fix before cutover."
  exit 1
fi

if [ "$WARN" -gt 0 ]; then
  echo ""
  echo "[MOSTLY READY] $WARN warning(s). Review before cutover."
  exit 0
fi

echo ""
echo "[READY] All domain readiness checks passed."
exit 0
