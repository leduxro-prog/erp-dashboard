#!/usr/bin/env bash

set -euo pipefail

APP_NS="${APP_NS:-cypher}"
APP_DEPLOYMENT="${APP_DEPLOYMENT:-cypher-app}"
DATA_NS="${DATA_NS:-cypher-data}"
DB_DEPLOYMENT="${DB_DEPLOYMENT:-postgres-staging}"
DB_USER="${DB_USER:-cypher_user}"
DB_NAME="${DB_NAME:-cypher_erp}"

ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
ADMIN_FIRST_NAME="${ADMIN_FIRST_NAME:-Admin}"
ADMIN_LAST_NAME="${ADMIN_LAST_NAME:-User}"
ADMIN_PHONE="${ADMIN_PHONE:-0700000000}"
ADMIN_ROLE="${ADMIN_ROLE:-admin}"

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "[ERROR] ADMIN_EMAIL and ADMIN_PASSWORD are required"
  echo "[HINT] Example: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='StrongPass#123' bash orchestration/k8s/seed-admin-user.sh"
  exit 1
fi

echo "[INFO] Verifying app and DB deployments"
kubectl -n "$APP_NS" get deploy "$APP_DEPLOYMENT" >/dev/null
kubectl -n "$DATA_NS" get deploy "$DB_DEPLOYMENT" >/dev/null

echo "[INFO] Generating bcrypt hash inside app runtime"
PASSWORD_HASH="$(kubectl -n "$APP_NS" exec "deploy/$APP_DEPLOYMENT" -- \
  node -e "const bcrypt=require('bcrypt'); process.stdout.write(bcrypt.hashSync(process.argv[1], 10));" -- "$ADMIN_PASSWORD")"

case "$ADMIN_ROLE" in
  admin|manager|sales|inventory|finance|b2b_client|guest) ;;
  *)
    echo "[ERROR] Invalid ADMIN_ROLE: $ADMIN_ROLE"
    exit 1
    ;;
esac

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

ADMIN_EMAIL_ESC="$(sql_escape "$ADMIN_EMAIL")"
PASSWORD_HASH_ESC="$(sql_escape "$PASSWORD_HASH")"
ADMIN_FIRST_NAME_ESC="$(sql_escape "$ADMIN_FIRST_NAME")"
ADMIN_LAST_NAME_ESC="$(sql_escape "$ADMIN_LAST_NAME")"
ADMIN_PHONE_ESC="$(sql_escape "$ADMIN_PHONE")"
ADMIN_ROLE_ESC="$(sql_escape "$ADMIN_ROLE")"

echo "[INFO] Upserting admin user: $ADMIN_EMAIL"
kubectl -n "$DATA_NS" exec "deploy/$DB_DEPLOYMENT" -- psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "
    INSERT INTO users (
      email,
      password_hash,
      first_name,
      last_name,
      phone_number,
      role,
      is_active,
      email_verified,
      failed_login_attempts,
      locked_until
    ) VALUES (
      '$ADMIN_EMAIL_ESC',
      '$PASSWORD_HASH_ESC',
      '$ADMIN_FIRST_NAME_ESC',
      '$ADMIN_LAST_NAME_ESC',
      '$ADMIN_PHONE_ESC',
      '$ADMIN_ROLE_ESC'::user_role,
      true,
      true,
      0,
      NULL
    )
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone_number = EXCLUDED.phone_number,
      role = EXCLUDED.role,
      is_active = true,
      email_verified = true,
      failed_login_attempts = 0,
      locked_until = NULL;
  "

echo "[INFO] Admin user upsert completed"
