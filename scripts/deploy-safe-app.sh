#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="${IMAGE_NAME:-cypher-erp-app:latest}"
NETWORK_NAME="${NETWORK_NAME:-cypher-erp_cypher-network}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"

APP_CONTAINER="${APP_CONTAINER:-cypher-erp-app}"
DB_CONTAINER="${DB_CONTAINER:-cypher-erp-db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-cypher-erp-redis}"
RABBIT_CONTAINER="${RABBIT_CONTAINER:-cypher-rabbitmq}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-cypher-erp-frontend}"
B2B_PORTAL_FLAG="${FEATURE_FLAG_ENABLE_B2B_PORTAL:-true}"

OLD_APP_CONTAINER=""
HAVE_OLD_APP="false"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Missing required command: $cmd"
    exit 1
  fi
}

log() {
  echo "[INFO] $1"
}

warn() {
  echo "[WARN] $1"
}

fail() {
  echo "[ERROR] $1"
  exit 1
}

read_env_var() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi
  printf '%s' "${line#*=}"
}

url_encode() {
  local raw="$1"
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$raw"
}

build_redis_url() {
  local redis_password redis_db encoded_password
  redis_password="$(read_env_var REDIS_PASSWORD || true)"
  redis_db="$(read_env_var REDIS_DB || true)"
  redis_db="${redis_db:-0}"

  if [[ -n "$redis_password" ]]; then
    encoded_password="$(url_encode "$redis_password")"
    printf 'redis://:%s@redis:6379/%s' "$encoded_password" "$redis_db"
    return
  fi

  printf 'redis://redis:6379/%s' "$redis_db"
}

container_exists() {
  local name="$1"
  docker inspect "$name" >/dev/null 2>&1
}

container_running() {
  local name="$1"
  docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null | grep -q '^true$'
}

ensure_container_running() {
  local name="$1"

  if ! container_exists "$name"; then
    fail "Container missing: $name"
  fi

  if ! container_running "$name"; then
    log "Starting container: $name"
    docker start "$name" >/dev/null
  fi
}

ensure_network() {
  if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    log "Creating network: $NETWORK_NAME"
    docker network create --driver bridge "$NETWORK_NAME" >/dev/null
  fi
}

ensure_network_alias() {
  local container_name="$1"
  local alias_name="$2"

  local aliases
  aliases="$(docker inspect -f "{{json (index .NetworkSettings.Networks \"$NETWORK_NAME\").Aliases}}" "$container_name" 2>/dev/null || true)"

  if [[ -z "$aliases" || "$aliases" == "null" ]]; then
    log "Connecting $container_name to $NETWORK_NAME with alias $alias_name"
    docker network connect --alias "$alias_name" "$NETWORK_NAME" "$container_name" >/dev/null 2>&1 || true
    return
  fi

  if ! grep -q "\"$alias_name\"" <<<"$aliases"; then
    warn "Alias '$alias_name' missing on $container_name, reconnecting endpoint"
    docker network disconnect "$NETWORK_NAME" "$container_name" >/dev/null 2>&1 || true
    docker network connect --alias "$alias_name" "$NETWORK_NAME" "$container_name" >/dev/null
  fi
}

enforce_redis_noeviction() {
  local redis_password

  if ! container_exists "$REDIS_CONTAINER"; then
    warn "Redis container missing, cannot enforce noeviction policy"
    return
  fi

  redis_password="$(read_env_var REDIS_PASSWORD || true)"

  if [[ -n "$redis_password" ]]; then
    docker exec "$REDIS_CONTAINER" redis-cli -a "$redis_password" CONFIG SET maxmemory-policy noeviction >/dev/null || {
      warn "Failed to enforce Redis noeviction policy"
      return
    }
  else
    docker exec "$REDIS_CONTAINER" redis-cli CONFIG SET maxmemory-policy noeviction >/dev/null || {
      warn "Failed to enforce Redis noeviction policy"
      return
    }
  fi

  log "Redis maxmemory-policy set to noeviction"
}

wait_for_app_health() {
  local retries=45
  local delay=2

  for ((i=1; i<=retries; i++)); do
    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$APP_CONTAINER" 2>/dev/null || true)"

    if [[ "$status" == "healthy" ]]; then
      return
    fi

    if curl -sf "http://localhost:3000/health" >/dev/null 2>&1; then
      return
    fi

    sleep "$delay"
  done

  docker logs "$APP_CONTAINER" --tail 120 || true
  return 1
}

wait_for_frontend_health() {
  if ! container_exists "$FRONTEND_CONTAINER"; then
    warn "Frontend container not found, skipping frontend refresh"
    return
  fi

  docker restart "$FRONTEND_CONTAINER" >/dev/null

  local retries=30
  for ((i=1; i<=retries; i++)); do
    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$FRONTEND_CONTAINER" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      return
    fi
    sleep 2
  done

  warn "Frontend health is not healthy yet, continuing"
}

expect_200() {
  local url="$1"
  local tmp_file
  tmp_file="$(mktemp)"

  local code
  code="$(curl -s -o "$tmp_file" -w '%{http_code}' "$url" || true)"

  if [[ "$code" != "200" ]]; then
    echo "[ERROR] Endpoint check failed: $url (HTTP $code)"
    echo "[ERROR] Response:"
    cat "$tmp_file"
    rm -f "$tmp_file"
    return 1
  fi

  rm -f "$tmp_file"
}

backup_current_app_container() {
  if ! container_exists "$APP_CONTAINER"; then
    return 0
  fi

  OLD_APP_CONTAINER="${APP_CONTAINER}-predeploy-$(date +%Y%m%d%H%M%S)"
  log "Backing up existing app container to $OLD_APP_CONTAINER"

  docker rename "$APP_CONTAINER" "$OLD_APP_CONTAINER" >/dev/null || return 1
  docker stop "$OLD_APP_CONTAINER" >/dev/null || return 1
  HAVE_OLD_APP="true"
}

rollback_app_container() {
  if [[ "$HAVE_OLD_APP" != "true" || -z "$OLD_APP_CONTAINER" ]]; then
    warn "No previous app container available for rollback"
    return 1
  fi

  warn "Rolling back to previous app container: $OLD_APP_CONTAINER"
  docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
  docker rename "$OLD_APP_CONTAINER" "$APP_CONTAINER" >/dev/null || return 1
  docker start "$APP_CONTAINER" >/dev/null || return 1
  wait_for_app_health || warn "Rollback app health check failed"
  wait_for_frontend_health || true
}

cleanup_backup_app_container() {
  if [[ "$HAVE_OLD_APP" != "true" || -z "$OLD_APP_CONTAINER" ]]; then
    return 0
  fi

  if container_exists "$OLD_APP_CONTAINER"; then
    docker rm -f "$OLD_APP_CONTAINER" >/dev/null 2>&1 || true
  fi
}

start_and_verify_new_app() {
  local redis_url
  redis_url="$(build_redis_url)"

  log "Starting new app container"
  docker run -d \
    --name "$APP_CONTAINER" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias app \
    -p 3000:3000 \
    --env-file "$ENV_FILE" \
    -e PORT=3000 \
    -e API_PREFIX=/api/v1 \
    -e DB_HOST=db \
    -e DB_PORT=5432 \
    -e REDIS_HOST=redis \
    -e REDIS_PORT=6379 \
    -e REDIS_URL="$redis_url" \
    -e RABBITMQ_HOST=rabbitmq \
    -e RABBITMQ_PORT=5672 \
    -e FEATURE_FLAG_ENABLE_B2B_PORTAL="$B2B_PORTAL_FLAG" \
    -v "$PROJECT_ROOT/logs:/app/logs" \
    -v "$PROJECT_ROOT/config:/app/config" \
    "$IMAGE_NAME" >/dev/null || return 1

  wait_for_app_health || return 1
  wait_for_frontend_health

  log "Running endpoint checks"
  expect_200 "http://localhost:3000/health" || return 1
  expect_200 "http://localhost/api/v1/health" || return 1
  expect_200 "http://localhost/api/v1/b2b/products/filters" || return 1
  expect_200 "http://localhost/api/v1/b2b/products/categories" || return 1
}

main() {
  require_command docker
  require_command curl
  require_command node

  [[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"

  log "Building backend image"
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" build app

  ensure_network

  ensure_container_running "$DB_CONTAINER"
  ensure_container_running "$REDIS_CONTAINER"

  if container_exists "$RABBIT_CONTAINER"; then
    ensure_container_running "$RABBIT_CONTAINER"
  else
    warn "RabbitMQ container not found ($RABBIT_CONTAINER), continuing"
  fi

  ensure_network_alias "$DB_CONTAINER" "db"
  ensure_network_alias "$REDIS_CONTAINER" "redis"
  if container_exists "$RABBIT_CONTAINER"; then
    ensure_network_alias "$RABBIT_CONTAINER" "rabbitmq"
  fi

  enforce_redis_noeviction

  backup_current_app_container || fail "Failed to backup existing app container"

  if ! start_and_verify_new_app; then
    warn "New app deployment failed, attempting rollback"
    rollback_app_container || fail "Deploy failed and rollback failed"
    fail "Deploy failed; rollback completed"
  fi

  cleanup_backup_app_container

  log "Safe deploy completed successfully"
}

main "$@"
