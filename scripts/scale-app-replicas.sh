#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPOSE_BASE="${COMPOSE_BASE:-$PROJECT_ROOT/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
NETWORK_NAME="${NETWORK_NAME:-cypher-erp_cypher-network}"
IMAGE_NAME="${IMAGE_NAME:-cypher-erp-app:latest}"

APP1="cypher-erp-app"
APP2="cypher-erp-app-2"
APP3="cypher-erp-app-3"
DB_CONTAINER="${DB_CONTAINER:-cypher-erp-db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-cypher-erp-redis}"
RABBIT_CONTAINER="${RABBIT_CONTAINER:-cypher-rabbitmq}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-cypher-erp-frontend}"
REPLICA_ENV_FILE=""

TARGET_REPLICAS="${1:-}"

if [[ -z "$TARGET_REPLICAS" ]]; then
  echo "Usage: $0 <1|2|3>"
  exit 1
fi

if [[ "$TARGET_REPLICAS" != "1" && "$TARGET_REPLICAS" != "2" && "$TARGET_REPLICAS" != "3" ]]; then
  echo "[ERROR] Target replicas must be 1, 2, or 3"
  exit 1
fi

compose() { docker compose -f "$COMPOSE_BASE" "$@"; }

cleanup() {
  if [[ -n "${REPLICA_ENV_FILE}" && -f "${REPLICA_ENV_FILE}" ]]; then
    rm -f "${REPLICA_ENV_FILE}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

wait_healthy() {
  local container="$1"
  local retries=45

  for ((i=1; i<=retries; i++)); do
    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || true)"
    if [[ "$status" == "healthy" || "$status" == "none" ]]; then
      return 0
    fi
    sleep 2
  done

  echo "[ERROR] Container did not become healthy: $container"
  docker logs --tail 120 "$container" || true
  exit 1
}

ensure_container_running() {
  local name="$1"
  docker inspect "$name" >/dev/null 2>&1 || {
    echo "[ERROR] Missing container: $name"
    exit 1
  }
  local running
  running="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || true)"
  if [[ "$running" != "true" ]]; then
    docker start "$name" >/dev/null
  fi
}

start_replica() {
  local container_name="$1"

  local image_id
  image_id="$(docker image inspect "$IMAGE_NAME" --format '{{.Id}}')"

  local env_file
  env_file="${REPLICA_ENV_FILE}"

  if docker inspect "$container_name" >/dev/null 2>&1; then
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  fi

  docker run -d \
    --name "$container_name" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias app \
    --label com.cypher.replica=true \
    --env-file "$env_file" \
    --health-cmd="wget --quiet --tries=1 --spider http://127.0.0.1:3000/health" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=30s \
    -v "$PROJECT_ROOT/logs:/app/logs" \
    -v "$PROJECT_ROOT/config:/app/config" \
    -v "$PROJECT_ROOT/uploads:/app/uploads" \
    "$image_id" >/dev/null
}

stop_replica() {
  local container_name="$1"
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}

echo "[INFO] Ensuring base app is running"
compose up -d app
wait_healthy "$APP1"

REPLICA_ENV_FILE="$(mktemp /tmp/cypher-erp-replica-env.XXXXXX)"
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$APP1" > "$REPLICA_ENV_FILE"

ensure_container_running "$DB_CONTAINER"
ensure_container_running "$REDIS_CONTAINER"
if docker inspect "$RABBIT_CONTAINER" >/dev/null 2>&1; then
  ensure_container_running "$RABBIT_CONTAINER"
fi

if [[ "$TARGET_REPLICAS" -ge 2 ]]; then
  echo "[INFO] Starting app2"
  start_replica "$APP2"
  wait_healthy "$APP2"
else
  echo "[INFO] Stopping app2"
  stop_replica "$APP2"
fi

if [[ "$TARGET_REPLICAS" -ge 3 ]]; then
  echo "[INFO] Starting app3"
  start_replica "$APP3"
  wait_healthy "$APP3"
else
  echo "[INFO] Stopping app3"
  stop_replica "$APP3"
fi

echo "[INFO] Restarting frontend to refresh upstream DNS"
docker restart "$FRONTEND_CONTAINER" >/dev/null 2>&1 || true

echo "[INFO] Current app containers:"
docker ps --format '{{.Names}}\t{{.Status}}' | python3 -c "import sys; rows=[r.strip() for r in sys.stdin if r.strip()];
for row in rows:
  name=row.split('\t',1)[0]
  if name in ('cypher-erp-app','cypher-erp-app-2','cypher-erp-app-3'):
    print(row)
"

echo "[INFO] Replica scale action completed: target=$TARGET_REPLICAS"
