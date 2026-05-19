#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK_NAME="${STACK_NAME:-cypher-staging}"
DB_SERVICE="${DB_SERVICE:-${STACK_NAME}_db}"
DB_USER="${DB_USER:-cypher_user}"
DB_NAME="${DB_NAME:-cypher_erp}"

BASE_SCHEMA_SQL="$ROOT_DIR/database/init-scripts/001-schema.sql"
ENSURE_NOTIFICATIONS_SQL="$ROOT_DIR/orchestration/swarm/sql/ensure-notifications-schema.sql"
ENSURE_USERS_SQL="$ROOT_DIR/orchestration/swarm/sql/ensure-users-schema.sql"
ENSURE_ORDERS_SUPPLIERS_SQL="$ROOT_DIR/orchestration/swarm/sql/ensure-orders-suppliers-schema.sql"
ENSURE_AUDIT_LOGS_SQL="$ROOT_DIR/orchestration/swarm/sql/ensure-audit-logs-schema.sql"

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "[ERROR] Missing file: $path"
    exit 1
  fi
}

require_file "$BASE_SCHEMA_SQL"
require_file "$ENSURE_NOTIFICATIONS_SQL"
require_file "$ENSURE_USERS_SQL"
require_file "$ENSURE_ORDERS_SUPPLIERS_SQL"
require_file "$ENSURE_AUDIT_LOGS_SQL"

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E "^${DB_SERVICE}\." | head -n 1 || true)"

if [[ -z "$DB_CONTAINER" ]]; then
  echo "[ERROR] Could not find running DB container for service: $DB_SERVICE"
  echo "[HINT] Check: docker service ls | grep ${STACK_NAME}_db"
  exit 1
fi

echo "[INFO] Using DB container: $DB_CONTAINER"

HAS_USERS_TABLE="$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 0 ELSE 1 END;")"

if [[ "$HAS_USERS_TABLE" == "0" ]]; then
  echo "[INFO] users table not found - applying base schema"
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$BASE_SCHEMA_SQL"
else
  echo "[INFO] users table already present - skipping base schema import"
fi

echo "[INFO] Applying notifications compatibility schema"
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$ENSURE_NOTIFICATIONS_SQL"

echo "[INFO] Applying users compatibility schema"
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$ENSURE_USERS_SQL"

echo "[INFO] Applying orders/suppliers compatibility schema"
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$ENSURE_ORDERS_SUPPLIERS_SQL"

echo "[INFO] Applying audit logs compatibility schema"
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$ENSURE_AUDIT_LOGS_SQL"

echo "[INFO] Database schema bootstrap complete"
