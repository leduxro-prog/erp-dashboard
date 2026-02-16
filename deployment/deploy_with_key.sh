#!/bin/bash
# ==============================================================================
# Deploy to Hetzner via SSH Key (key-based auth only)
# ==============================================================================
# Usage:
#   ./deployment/deploy_with_key.sh
#   SSH_KEY=/path/to/key ./deployment/deploy_with_key.sh
#
# Required environment variables (or defaults):
#   HETZNER_HOST       - Server IP/hostname  (default: from env)
#   HETZNER_USER       - SSH user            (default: root)
#   SSH_KEY            - Path to SSH key     (default: ~/.ssh/hetzner_deploy)
#   TARGET_DIR         - Remote project dir  (default: /opt/cypher-erp)
# ==============================================================================

set -euo pipefail

# ---------- Config (from env, no hardcoded secrets) ----------
SERVER_IP="${HETZNER_HOST:?ERROR: HETZNER_HOST env var is required}"
SERVER_USER="${HETZNER_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hetzner_deploy}"
TARGET_DIR="${HETZNER_TARGET_DIR:-/opt/cypher-erp}"

# Strict SSH options: key-only, no password fallback, fail-fast
SSH_OPTS="-i $SSH_KEY -o PasswordAuthentication=no -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
SSH_CMD="ssh $SSH_OPTS $SERVER_USER@$SERVER_IP"
SCP_CMD="scp $SSH_OPTS"
RSYNC_SSH="ssh $SSH_OPTS"

# ---------- Validation ----------
if [ ! -f "$SSH_KEY" ]; then
  echo "[ERROR] SSH key not found: $SSH_KEY"
  echo "Set SSH_KEY env var to point to your private key."
  exit 1
fi

# Ensure key permissions are correct
chmod 600 "$SSH_KEY"

echo "=== Deploying to $SERVER_USER@$SERVER_IP via SSH key ==="
echo "    Key:       $SSH_KEY"
echo "    Target:    $TARGET_DIR"
echo ""

# ---------- 1. Verify connection ----------
echo "[1/5] Verifying SSH connection..."
$SSH_CMD "echo 'Connection verified'" || {
  echo "[ERROR] SSH connection failed. Check key and host."
  exit 1
}

# ---------- 2. Pre-deploy backup ----------
echo "[2/5] Creating pre-deploy database backup..."
$SSH_CMD "cd $TARGET_DIR && \
  docker compose exec -T db pg_dump -U \$(grep DB_USER .env | cut -d= -f2) \$(grep DB_NAME .env | cut -d= -f2) | \
  gzip > /tmp/cypher-pre-deploy-\$(date +%Y%m%d%H%M%S).sql.gz" \
  2>/dev/null || echo "[WARN] DB backup failed (non-blocking, continuing)"

# ---------- 3. Create target directory ----------
echo "[3/5] Ensuring target directory exists..."
$SSH_CMD "mkdir -p $TARGET_DIR"

# ---------- 4. Sync files ----------
echo "[4/5] Syncing application files..."
rsync -avz --delete \
  -e "$RSYNC_SSH" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'coverage' \
  --exclude '.env' \
  --exclude 'logs' \
  --exclude 'deployment/hetzner_key' \
  ./ "$SERVER_USER@$SERVER_IP:$TARGET_DIR"

# ---------- 5. Build and restart ----------
echo "[5/5] Building and restarting Docker services..."
$SSH_CMD "cd $TARGET_DIR && docker compose build --no-cache app frontend && docker compose up -d --force-recreate app frontend"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Run smoke checks:"
echo "  scripts/smoke-hetzner.sh"
