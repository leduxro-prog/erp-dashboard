#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] Missing command: $1"
    exit 1
  fi
}

ensure_swarm_active() {
  local state
  state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"
  if [[ "$state" != "active" ]]; then
    echo "[ERROR] Docker Swarm is not active. Run: docker swarm init"
    exit 1
  fi
}

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

      if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"

        if [[ "$value" =~ ^\"(.*)\"$ ]]; then
          value="${BASH_REMATCH[1]}"
        elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
          value="${BASH_REMATCH[1]}"
        fi

        export "$key=$value"
      fi
    done < "$ENV_FILE"
  fi
}

create_secret_if_missing() {
  local secret_name="$1"
  local value="$2"

  if docker secret inspect "$secret_name" >/dev/null 2>&1; then
    echo "[INFO] Secret already exists: $secret_name"
    return
  fi

  if [[ -z "$value" ]]; then
    echo "[ERROR] Secret value missing for: $secret_name"
    exit 1
  fi

  printf '%s' "$value" | docker secret create "$secret_name" - >/dev/null
  echo "[INFO] Secret created: $secret_name"
}

warn_if_weak_meili_key() {
  local value="$1"
  if [[ ${#value} -lt 16 ]]; then
    echo "[WARN] MEILI_MASTER_KEY should be at least 16 characters in production."
  fi
}

require_cmd docker
ensure_swarm_active
load_env_file

create_secret_if_missing "cypher_db_password" "${DB_PASSWORD:-}"
create_secret_if_missing "cypher_jwt_secret" "${JWT_SECRET:-}"
create_secret_if_missing "cypher_jwt_refresh_secret" "${JWT_REFRESH_SECRET:-}"
create_secret_if_missing "cypher_jwt_secret_b2b" "${JWT_SECRET_B2B:-}"
create_secret_if_missing "cypher_jwt_refresh_secret_b2b" "${JWT_REFRESH_SECRET_B2B:-}"
create_secret_if_missing "cypher_redis_password" "${REDIS_PASSWORD:-}"
create_secret_if_missing "cypher_rabbitmq_password" "${RABBITMQ_PASSWORD:-}"
warn_if_weak_meili_key "${MEILI_MASTER_KEY:-}"
create_secret_if_missing "cypher_meili_master_key" "${MEILI_MASTER_KEY:-}"

echo "[INFO] Swarm secrets are ready."
