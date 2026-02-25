#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

APP_NS="${APP_NS:-cypher}"
DATA_NS="${DATA_NS:-cypher-data}"
BASE_URL="${BASE_URL:-https://erp.ledux.ro}"
B2B_URL="${B2B_URL:-https://b2b.ledux.ro}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"
TLS_MIN_VALID_DAYS="${TLS_MIN_VALID_DAYS:-14}"
RESTORE_DRILL_MAX_AGE_DAYS="${RESTORE_DRILL_MAX_AGE_DAYS:-45}"
PROJECTION_STALE_THRESHOLD_SECONDS="${PROJECTION_STALE_THRESHOLD_SECONDS:-300}"
PROJECTION_QUEUE_MAX="${PROJECTION_QUEUE_MAX:-5000}"
PROJECTION_FAILED_MAX="${PROJECTION_FAILED_MAX:-0}"
LEGACY_CONTAINER_REGEX="${LEGACY_CONTAINER_REGEX:-^(cypher-erp-app-1|cypher-erp-db|cypher-erp-redis|cypher-rabbitmq)$}"
AUTH_SMOKE_REQUIRED="${AUTH_SMOKE_REQUIRED:-false}"
AUTH_LOGIN_RETRIES="${AUTH_LOGIN_RETRIES:-3}"
AUTH_LOGIN_RETRY_DELAY_SEC="${AUTH_LOGIN_RETRY_DELAY_SEC:-2}"
REQUIRE_APP_SECRET="${REQUIRE_APP_SECRET:-true}"
REQUIRE_DATA_SECRET="${REQUIRE_DATA_SECRET:-true}"
REQUIRE_RESTORE_DRILL_SUCCESS="${REQUIRE_RESTORE_DRILL_SUCCESS:-false}"
VAT_GUARD_REQUIRED="${VAT_GUARD_REQUIRED:-true}"
DB_DEPLOYMENT="${DB_DEPLOYMENT:-postgres-staging}"
DB_USER="${DB_USER:-cypher_user}"
DB_NAME="${DB_NAME:-cypher_erp}"

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

url_host() {
  URL_VALUE="$1" python3 - <<'PY'
from urllib.parse import urlparse
import os
u = os.environ.get('URL_VALUE', '')
print(urlparse(u).hostname or '')
PY
}

check_tls_days_remaining() {
  local host="$1"
  local min_days="$2"

  local end_date
  end_date="$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2-)"
  [[ -n "$end_date" ]] || fail "Could not read TLS cert end date for ${host}"

  local end_epoch now_epoch remaining_days
  end_epoch="$(date -d "$end_date" +%s)"
  now_epoch="$(date +%s)"
  remaining_days="$(( (end_epoch - now_epoch) / 86400 ))"

  if (( remaining_days < min_days )); then
    fail "TLS cert for ${host} expires in ${remaining_days} days (< ${min_days})"
  fi

  pass "TLS cert for ${host} valid for ${remaining_days} days"
}

read_kv_file_value() {
  local file_path="$1"
  local key="$2"
  python3 - "$file_path" "$key" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]

if not path.exists():
    print("")
    raise SystemExit(0)

value = ""
for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
    if line.startswith(f"{key}="):
        value = line.split("=", 1)[1]
        break

print(value)
PY
}

timestamp_age_days() {
  local timestamp_utc="$1"
  python3 - "$timestamp_utc" <<'PY'
from datetime import datetime, timezone
import sys

value = sys.argv[1].strip()
try:
    dt = datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
except ValueError:
    print(-1)
    raise SystemExit(0)

age_seconds = int((datetime.now(timezone.utc) - dt).total_seconds())
print(age_seconds // 86400)
PY
}

printf 'Running launch readiness checks...\n'

check_cmd 'Kubernetes API reachable' kubectl cluster-info
check_cmd 'Application namespace exists' kubectl get ns "$APP_NS"
check_cmd 'Data namespace exists' kubectl get ns "$DATA_NS"

check_cmd 'cypher-app deployment available' kubectl -n "$APP_NS" rollout status deploy/cypher-app --timeout=90s
check_cmd 'cypher-frontend deployment available' kubectl -n "$APP_NS" rollout status deploy/cypher-frontend --timeout=90s
check_cmd 'Ingress resource present' kubectl -n "$APP_NS" get ingress cypher-ingress

if [[ "${VAT_GUARD_REQUIRED,,}" == "true" ]]; then
  vat_guard_script="$ROOT_DIR/scripts/recalculate-open-docs-vat-21.sh"
  [[ -f "$vat_guard_script" ]] || fail "VAT guard script missing: $vat_guard_script"

  if DATA_NS="$DATA_NS" DB_DEPLOYMENT="$DB_DEPLOYMENT" DB_USER="$DB_USER" DB_NAME="$DB_NAME" \
    bash "$vat_guard_script" --dry-run --guard --k8s >/tmp/launch-vat-guard.out 2>&1; then
    pass 'VAT open-doc dry-run guard passed'
  else
    cat /tmp/launch-vat-guard.out
    fail 'VAT open-doc dry-run guard failed'
  fi
fi

if [[ "${REQUIRE_APP_SECRET,,}" == "true" ]]; then
  check_cmd 'App secret present' kubectl -n "$APP_NS" get secret cypher-app-secrets
fi

if [[ "${REQUIRE_DATA_SECRET,,}" == "true" ]]; then
  check_cmd 'Data-plane secret present' kubectl -n "$DATA_NS" get secret cypher-data-secrets
fi

check_cmd 'docker-port-hardening service active' systemctl is-active docker-port-hardening.service
check_cmd 'docker-port-hardening service enabled' systemctl is-enabled docker-port-hardening.service
check_cmd 'K8s backup timer active' systemctl is-active cypher-k8s-backup.timer
check_cmd 'K8s backup timer enabled' systemctl is-enabled cypher-k8s-backup.timer
check_cmd 'K8s restore drill timer active' systemctl is-active cypher-k8s-restore-drill.timer
check_cmd 'K8s restore drill timer enabled' systemctl is-enabled cypher-k8s-restore-drill.timer

if command -v docker >/dev/null 2>&1; then
  legacy_running="$(docker ps --format '{{.Names}}' | grep -E "${LEGACY_CONTAINER_REGEX}" || true)"
  if [[ -n "$legacy_running" ]]; then
    fail "Legacy ERP containers still running: ${legacy_running//$'\n'/, }"
  fi
  pass 'Legacy ERP containers are not running'
fi

if ls /root/backups/cypher_k8s_*.sql.gz >/dev/null 2>&1; then
  latest_backup="$(ls -1t /root/backups/cypher_k8s_*.sql.gz | head -n 1)"
  pass "Latest K8s backup found: ${latest_backup}"

  backup_mtime="$(stat -c %Y "$latest_backup")"
  now_epoch="$(date +%s)"
  backup_age_hours="$(( (now_epoch - backup_mtime) / 3600 ))"
  if (( backup_age_hours > BACKUP_MAX_AGE_HOURS )); then
    fail "Latest backup is ${backup_age_hours}h old (> ${BACKUP_MAX_AGE_HOURS}h)"
  fi
  pass "Latest backup age ${backup_age_hours}h within threshold"
else
  fail 'No K8s backup artifact found in /root/backups'
fi

if [[ "${REQUIRE_RESTORE_DRILL_SUCCESS,,}" == "true" ]]; then
  restore_report="/root/backups/restore-drill-last.txt"
  [[ -f "$restore_report" ]] || fail 'No restore drill report found in /root/backups/restore-drill-last.txt'

  restore_verdict="$(read_kv_file_value "$restore_report" verdict)"
  [[ "$restore_verdict" == "GO" ]] || fail "Latest restore drill verdict is ${restore_verdict:-unknown}"

  restore_timestamp="$(read_kv_file_value "$restore_report" timestamp_utc)"
  restore_age_days="$(timestamp_age_days "$restore_timestamp")"
  [[ "$restore_age_days" =~ ^[0-9]+$ ]] || fail 'Invalid restore drill timestamp in report'
  if (( restore_age_days > RESTORE_DRILL_MAX_AGE_DAYS )); then
    fail "Latest restore drill is ${restore_age_days}d old (> ${RESTORE_DRILL_MAX_AGE_DAYS}d)"
  fi

  pass "Latest restore drill report verdict GO (${restore_age_days}d old)"
fi

base_host="$(url_host "$BASE_URL")"
b2b_host="$(url_host "$B2B_URL")"
[[ -n "$base_host" ]] || fail "Invalid BASE_URL host: ${BASE_URL}"
[[ -n "$b2b_host" ]] || fail "Invalid B2B_URL host: ${B2B_URL}"

check_tls_days_remaining "$base_host" "$TLS_MIN_VALID_DAYS"
check_tls_days_remaining "$b2b_host" "$TLS_MIN_VALID_DAYS"

health_code="$(curl -s -o /tmp/launch-health.out -w '%{http_code}' "${BASE_URL}/health")"
api_health_code="$(curl -s -o /tmp/launch-api-health.out -w '%{http_code}' "${BASE_URL}/api/v1/health")"
b2b_store_code="$(curl -s -o /tmp/launch-b2b-store.out -w '%{http_code}' "${B2B_URL}/b2b-store")"

[[ "$health_code" == "200" ]] || fail "${BASE_URL}/health returned ${health_code}"
[[ "$api_health_code" == "200" ]] || fail "${BASE_URL}/api/v1/health returned ${api_health_code}"
[[ "$b2b_store_code" == "200" ]] || fail "${B2B_URL}/b2b-store returned ${b2b_store_code}"
pass 'Public health endpoints reachable'

if [[ "${AUTH_SMOKE_REQUIRED,,}" == "true" && ( -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ) ]]; then
  fail 'AUTH_SMOKE_REQUIRED=true but ADMIN_EMAIL/ADMIN_PASSWORD are not set'
fi

if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  token=""
  login_payload=""

  for attempt in $(seq 1 "$AUTH_LOGIN_RETRIES"); do
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

    if [[ -n "$token" ]]; then
      break
    fi

    if (( attempt < AUTH_LOGIN_RETRIES )); then
      sleep "$AUTH_LOGIN_RETRY_DELAY_SEC"
    fi
  done

  if [[ -z "$token" ]]; then
    if [[ "${AUTH_SMOKE_REQUIRED,,}" == "true" ]]; then
      fail 'Admin login failed during readiness smoke'
    fi

    printf '[WARN] Admin login failed during readiness smoke; skipping authenticated API checks.\n'
    printf 'Launch readiness checks completed with warnings.\n'
    exit 0
  fi

  users_code="$(curl -s -o /tmp/launch-users.out -w '%{http_code}' "${BASE_URL}/api/v1/users" -H "Authorization: Bearer ${token}")"
  settings_code="$(curl -s -o /tmp/launch-settings.out -w '%{http_code}' "${BASE_URL}/api/v1/settings" -H "Authorization: Bearer ${token}")"
  orders_code="$(curl -s -o /tmp/launch-orders.out -w '%{http_code}' "${BASE_URL}/api/v1/orders?page=1&limit=3" -H "Authorization: Bearer ${token}")"
  inventory_code="$(curl -s -o /tmp/launch-inventory.out -w '%{http_code}' "${BASE_URL}/api/v1/inventory/products?limit=3&offset=0" -H "Authorization: Bearer ${token}")"
  suppliers_code="$(curl -s -o /tmp/launch-suppliers.out -w '%{http_code}' "${BASE_URL}/api/v1/suppliers/suppliers?limit=3&offset=0" -H "Authorization: Bearer ${token}")"
  projection_status_code="$(curl -s -o /tmp/launch-projection.out -w '%{http_code}' "${BASE_URL}/api/v1/inventory/products/projection/status?staleThresholdSeconds=${PROJECTION_STALE_THRESHOLD_SECONDS}" -H "Authorization: Bearer ${token}")"

  [[ "$users_code" == "200" ]] || fail "Authenticated /users returned ${users_code}"
  [[ "$settings_code" == "200" ]] || fail "Authenticated /settings returned ${settings_code}"
  [[ "$orders_code" == "200" ]] || fail "Authenticated /orders returned ${orders_code}"
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
