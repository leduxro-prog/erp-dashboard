#!/usr/bin/env bash

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
DATA_NS="${DATA_NS:-cypher-data}"
DB_DEPLOYMENT="${DB_DEPLOYMENT:-postgres-staging}"
DB_USER="${DB_USER:-cypher_user}"
DB_NAME="${DB_NAME:-cypher_erp}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
KUBECONFIG="${KUBECONFIG:-/root/.kube/config}"

export KUBECONFIG

mkdir -p "$BACKUP_DIR"

ts="$(date +%Y%m%d_%H%M%S)"
out="$BACKUP_DIR/cypher_k8s_${ts}.sql.gz"
tmp_out="${out}.tmp"

cleanup_failed_tmp() {
  rm -f "$tmp_out"
}

trap cleanup_failed_tmp ERR INT TERM

kubectl -n "$DATA_NS" exec "deploy/$DB_DEPLOYMENT" -- pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$tmp_out"

mv "$tmp_out" "$out"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cypher_k8s_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
