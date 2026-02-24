#!/usr/bin/env bash

set -euo pipefail

APP_NS="${APP_NS:-cypher}"
DATA_NS="${DATA_NS:-cypher-data}"
BASE_URL="${BASE_URL:-https://erp.ledux.ro}"
B2B_URL="${B2B_URL:-https://b2b.ledux.ro}"
PROJECTION_STALE_THRESHOLD_SECONDS="${PROJECTION_STALE_THRESHOLD_SECONDS:-300}"
PROJECTION_QUEUE_MAX="${PROJECTION_QUEUE_MAX:-5000}"
PROJECTION_FAILED_MAX="${PROJECTION_FAILED_MAX:-0}"

pass() {
  printf '[PASS] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  exit 1
}

check_cmd() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass "$label"
  else
    fail "$label"
  fi
}

printf 'Running launch readiness checks...\n'

check_cmd 'Kubernetes API reachable' kubectl cluster-info
check_cmd 'Application namespace exists' kubectl get ns "$APP_NS"
check_cmd 'Data namespace exists' kubectl get ns "$DATA_NS"

check_cmd 'cypher-app deployment available' kubectl -n "$APP_NS" rollout status deploy/cypher-app --timeout=90s
check_cmd 'cypher-frontend deployment available' kubectl -n "$APP_NS" rollout status deploy/cypher-frontend --timeout=90s
check_cmd 'Ingress resource present' kubectl -n "$APP_NS" get ingress cypher-ingress

check_cmd 'docker-port-hardening service active' systemctl is-active docker-port-hardening.service
check_cmd 'docker-port-hardening service enabled' systemctl is-enabled docker-port-hardening.service
check_cmd 'K8s backup timer active' systemctl is-active cypher-k8s-backup.timer
check_cmd 'K8s backup timer enabled' systemctl is-enabled cypher-k8s-backup.timer

if ls /root/backups/cypher_k8s_*.sql.gz >/dev/null 2>&1; then
  latest_backup="$(ls -1t /root/backups/cypher_k8s_*.sql.gz | head -n 1)"
  pass "Latest K8s backup found: ${latest_backup}"
else
  fail 'No K8s backup artifact found in /root/backups'
fi

health_code="$(curl -s -o /tmp/launch-health.out -w '%{http_code}' "${BASE_URL}/health")"
api_health_code="$(curl -s -o /tmp/launch-api-health.out -w '%{http_code}' "${BASE_URL}/api/v1/health")"
b2b_store_code="$(curl -s -o /tmp/launch-b2b-store.out -w '%{http_code}' "${B2B_URL}/b2b-store")"

[[ "$health_code" == "200" ]] || fail "${BASE_URL}/health returned ${health_code}"
[[ "$api_health_code" == "200" ]] || fail "${BASE_URL}/api/v1/health returned ${api_health_code}"
[[ "$b2b_store_code" == "200" ]] || fail "${B2B_URL}/b2b-store returned ${b2b_store_code}"
pass 'Public health endpoints reachable'

if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  login_payload="$(curl -s -X POST "${BASE_URL}/api/v1/users/login" \
    -H 'Content-Type: application/json' \
    -H "Origin: ${BASE_URL}" \
    -H "Referer: ${BASE_URL}/login" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")"

  token="$(LOGIN_JSON="$login_payload" python3 - <<'PY'
import json,os
try:
  d=json.loads(os.environ['LOGIN_JSON'])
  print(d.get('token',''))
except Exception:
  print('')
PY
)"

  [[ -n "$token" ]] || fail 'Admin login failed during readiness smoke'

  users_code="$(curl -s -o /tmp/launch-users.out -w '%{http_code}' "${BASE_URL}/api/v1/users" -H "Authorization: Bearer ${token}")"
  inventory_code="$(curl -s -o /tmp/launch-inventory.out -w '%{http_code}' "${BASE_URL}/api/v1/inventory/products?limit=3&offset=0" -H "Authorization: Bearer ${token}")"
  suppliers_code="$(curl -s -o /tmp/launch-suppliers.out -w '%{http_code}' "${BASE_URL}/api/v1/suppliers/suppliers?limit=3&offset=0" -H "Authorization: Bearer ${token}")"
  projection_status_code="$(curl -s -o /tmp/launch-projection.out -w '%{http_code}' "${BASE_URL}/api/v1/inventory/products/projection/status?staleThresholdSeconds=${PROJECTION_STALE_THRESHOLD_SECONDS}" -H "Authorization: Bearer ${token}")"

  [[ "$users_code" == "200" ]] || fail "Authenticated /users returned ${users_code}"
  [[ "$inventory_code" == "200" ]] || fail "Authenticated /inventory returned ${inventory_code}"
  [[ "$suppliers_code" == "200" ]] || fail "Authenticated /suppliers returned ${suppliers_code}"

  [[ "$projection_status_code" == "200" ]] || fail "Projection status returned ${projection_status_code}"

  projection_eval="$(python3 - <<'PY'
import json

try:
  data = json.load(open('/tmp/launch-projection.out'))
except Exception:
  print('parse_error')
  raise SystemExit(0)

payload = data.get('data') or {}
queue = payload.get('queue') or {}
projection = payload.get('projection') or {}

pending = int(queue.get('pending') or 0)
retry = int(queue.get('retry') or 0)
failed = int(queue.get('failed') or 0)
processing = int(queue.get('processing') or 0)
queue_pressure = pending + retry + processing
stale_rows = int(projection.get('staleRows') or 0)
total_rows = int(projection.get('totalRows') or 0)

print(f"{failed}|{queue_pressure}|{stale_rows}|{total_rows}")
PY
)"

[[ "$projection_eval" != "parse_error" ]] || fail 'Failed to parse projection status response'
projection_failed="${projection_eval%%|*}"
projection_rest="${projection_eval#*|}"
projection_queue_pressure="${projection_rest%%|*}"
projection_rest2="${projection_rest#*|}"
projection_stale_rows="${projection_rest2%%|*}"
projection_total_rows="${projection_rest2#*|}"

if (( projection_failed > PROJECTION_FAILED_MAX )); then
  fail "Projection queue failed jobs ${projection_failed} exceeds ${PROJECTION_FAILED_MAX}"
fi

if (( projection_queue_pressure > PROJECTION_QUEUE_MAX )); then
  fail "Projection queue pressure ${projection_queue_pressure} exceeds ${PROJECTION_QUEUE_MAX}"
fi

if (( projection_stale_rows > 0 && projection_queue_pressure > 0 )); then
  printf '[WARN] Projection stale rows=%s (total=%s) with queue pressure=%s.\n' "$projection_stale_rows" "$projection_total_rows" "$projection_queue_pressure"
fi

  pass 'Projection status checks passed'
  pass 'Authenticated API smoke checks passed'
else
  printf '[WARN] Skipping authenticated smoke (set ADMIN_EMAIL and ADMIN_PASSWORD).\n'
fi

printf 'Launch readiness checks completed successfully.\n'
