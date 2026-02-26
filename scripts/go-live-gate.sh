#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_CONTAINER="${APP_CONTAINER:-cypher-erp-app-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-cypher-erp-redis}"
DB_CONTAINER="${DB_CONTAINER:-cypher-erp-db}"
DB_USER="${DB_USER:-cypher_user}"
DB_NAME="${DB_NAME:-cypher_erp}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
SINCE_WINDOW="${SINCE_WINDOW:-30m}"
WATCH_CHECKPOINTS="${WATCH_CHECKPOINTS:-3}"
WATCH_INTERVAL_SEC="${WATCH_INTERVAL_SEC:-600}"
WATCH_LOG_FILE="${WATCH_LOG_FILE:-/tmp/cypher-postlaunch-watch.log}"

PASS=0
FAIL=0

ok() {
  printf '[PASS] %s\n' "$1"
  PASS=$((PASS + 1))
}

bad() {
  printf '[FAIL] %s\n' "$1"
  FAIL=$((FAIL + 1))
}

section() {
  printf '\n=== %s ===\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[ERROR] Missing required command: %s\n' "$1"
    exit 1
  fi
}

run_prelaunch_backup() {
  section "Prelaunch Backup"

  mkdir -p "$BACKUP_DIR"
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_file="$BACKUP_DIR/prelaunch-${ts}.dump"

  if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$backup_file"; then
    size_mb="$(python3 - <<PY
from pathlib import Path
print(f"{Path('$backup_file').stat().st_size/1024/1024:.2f}")
PY
)"
    ok "Backup created: $backup_file (${size_mb} MB)"
  else
    bad "Backup failed"
  fi
}

run_t0_gate() {
  section "T0 Gate"
  if SINCE_WINDOW="$SINCE_WINDOW" APP_CONTAINER="$APP_CONTAINER" REDIS_CONTAINER="$REDIS_CONTAINER" \
    "$SCRIPT_DIR/t0-go-live-check.sh"; then
    ok "T0 gate passed"
  else
    bad "T0 gate failed"
  fi
}

run_checkpoint() {
  idx="$1"
  total="$2"

  printf '\n--- Post-launch checkpoint %s/%s (%s) ---\n' "$idx" "$total" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$WATCH_LOG_FILE"

  snapshot="$(docker ps --format '{{.Names}}\t{{.Status}}')"
  printf '%s\n' "$snapshot" | tee -a "$WATCH_LOG_FILE"

  for svc in cypher-erp-frontend-1 "$APP_CONTAINER" "$REDIS_CONTAINER" cypher-erp-db cypher-rabbitmq; do
    line="$(printf '%s\n' "$snapshot" | grep -E "^${svc}[[:space:]]" || true)"
    if [ -n "$line" ] && printf '%s' "$line" | grep -q '(healthy)'; then
      ok "checkpoint $idx: $svc healthy"
    else
      bad "checkpoint $idx: $svc not healthy"
    fi
  done

  front_code="$(curl -s -o /tmp/gate-front.out -w '%{http_code}' http://127.0.0.1:8080/health || true)"
  if [ "$front_code" = "200" ]; then
    ok "checkpoint $idx: frontend health 200"
  else
    bad "checkpoint $idx: frontend health $front_code"
  fi

  if docker exec "$APP_CONTAINER" wget --quiet --tries=1 --spider http://127.0.0.1:3000/health; then
    ok "checkpoint $idx: app internal health"
  else
    bad "checkpoint $idx: app internal health failed"
  fi

  redis_ping="$(docker exec "$REDIS_CONTAINER" sh -lc 'redis-cli -a "$REDIS_PASSWORD" ping' 2>/tmp/gate-redis.err || true)"
  if [ "$redis_ping" = "PONG" ]; then
    ok "checkpoint $idx: redis auth ping"
  else
    bad "checkpoint $idx: redis auth ping failed"
  fi
}

run_postlaunch_watch() {
  section "Post-launch Watch"
  : > "$WATCH_LOG_FILE"

  i=1
  while [ "$i" -le "$WATCH_CHECKPOINTS" ]; do
    run_checkpoint "$i" "$WATCH_CHECKPOINTS"
    if [ "$i" -lt "$WATCH_CHECKPOINTS" ]; then
      sleep "$WATCH_INTERVAL_SEC"
    fi
    i=$((i + 1))
  done

  docker logs "$APP_CONTAINER" --since "$SINCE_WINDOW" > /tmp/gate-app-window.log 2>&1 || true
  printf '\n--- SLI snapshot (%s) ---\n' "$SINCE_WINDOW" | tee -a "$WATCH_LOG_FILE"
  python3 - <<'PY' | tee -a "$WATCH_LOG_FILE"
import re
from collections import Counter

p='/tmp/gate-app-window.log'
status=Counter()
lat=[]

with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        m=re.search(r'^(GET|POST|PUT|DELETE)\s(\S+)\s(\d{3})\s([0-9]+\.?[0-9]*)\sms', line)
        if not m:
            continue
        status[int(m.group(3))]+=1
        lat.append(float(m.group(4)))

def pct(arr, p):
    if not arr:
        return 0.0
    arr=sorted(arr)
    i=int(round((p/100)*(len(arr)-1)))
    return arr[i]

total=sum(status.values())
e5=sum(v for k,v in status.items() if 500 <= k <= 599)
e4=sum(v for k,v in status.items() if 400 <= k <= 499)
rate=(e5/total*100) if total else 0
print(f'TOTAL={total} 4XX={e4} 5XX={e5} ERR5_RATE={rate:.2f}% P95_MS={pct(lat,95):.2f} P99_MS={pct(lat,99):.2f}')
PY

  ok "Post-launch watch completed"
  printf 'Watch log: %s\n' "$WATCH_LOG_FILE"
}

main() {
  require_command docker
  require_command curl
  require_command python3

  section "Go-Live Gate"
  printf 'Time: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  run_prelaunch_backup
  run_t0_gate
  run_postlaunch_watch

  section "Decision"
  printf 'Checks: PASS=%d FAIL=%d\n' "$PASS" "$FAIL"

  if [ "$FAIL" -eq 0 ]; then
    printf 'GO\n'
    exit 0
  fi

  printf 'NO-GO\n'
  exit 1
}

main "$@"
