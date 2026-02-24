#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SWARM_DIR="$ROOT_DIR/orchestration/swarm"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
STACK_NAME="${STACK_NAME:-cypher}"
DEPLOY_AI="${DEPLOY_AI:-false}"

ensure_cmd() {
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

load_env() {
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

ensure_cmd docker
ensure_swarm_active
load_env

echo "[INFO] Preparing secrets..."
ENV_FILE="$ENV_FILE" "$SWARM_DIR/prepare-secrets.sh"

echo "[INFO] Deploying core stack: $STACK_NAME"
docker stack deploy -c "$SWARM_DIR/stack.core.yml" "$STACK_NAME"

if [[ "$DEPLOY_AI" == "true" ]]; then
  echo "[INFO] Deploying AI overlay"
  docker stack deploy -c "$SWARM_DIR/stack.core.yml" -c "$SWARM_DIR/stack.ai.yml" "$STACK_NAME"
fi

echo "[INFO] Stack services"
docker stack services "$STACK_NAME"
