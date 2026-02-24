#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

DATA_NS="${DATA_NS:-cypher-data}"
DB_DEPLOYMENT="${DB_DEPLOYMENT:-postgres-staging}"
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

echo "[INFO] Verifying DB deployment exists: $DATA_NS/$DB_DEPLOYMENT"
kubectl -n "$DATA_NS" get deploy "$DB_DEPLOYMENT" >/dev/null

run_psql() {
  kubectl -n "$DATA_NS" exec "deploy/$DB_DEPLOYMENT" -- \
    psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

apply_sql_file() {
  local file="$1"
  kubectl -n "$DATA_NS" exec -i "deploy/$DB_DEPLOYMENT" -- \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$file"
}

HAS_USERS_TABLE="$(run_psql -tAc "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 0 ELSE 1 END;")"
HAS_USERS_TABLE="$(echo "$HAS_USERS_TABLE" | tr -d '[:space:]')"

if [[ "$HAS_USERS_TABLE" == "0" ]]; then
  echo "[INFO] users table not found - applying base schema"
  apply_sql_file "$BASE_SCHEMA_SQL"
else
  echo "[INFO] users table already present - skipping base schema import"
fi

echo "[INFO] Applying notifications compatibility schema"
apply_sql_file "$ENSURE_NOTIFICATIONS_SQL"

echo "[INFO] Applying users compatibility schema"
apply_sql_file "$ENSURE_USERS_SQL"

echo "[INFO] Applying orders/suppliers compatibility schema"
apply_sql_file "$ENSURE_ORDERS_SUPPLIERS_SQL"

echo "[INFO] Applying audit logs compatibility schema"
apply_sql_file "$ENSURE_AUDIT_LOGS_SQL"

echo "[INFO] Kubernetes DB schema bootstrap complete"
