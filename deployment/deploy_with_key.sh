#!/bin/bash

# Deployment Script using SSH Key
# Usage: ./deploy_with_key.sh

SERVER_IP="65.108.255.104"
SERVER_USER="root"
SSH_KEY="deployment/hetzner_key"
TARGET_DIR="/opt/cypher-erp"

# SSH Options: Disable host key checking for automation, use specific key
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "=== Deploying with SSH Key to $SERVER_IP ==="

# 1. Verify connection
echo "Checking connection..."
ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "echo 'Connection Successful'"
if [ $? -ne 0 ]; then
    echo "Connection failed! Check key or IP."
    exit 1
fi

# 2. Upload Setup Script & Execute (if needed)
echo "Uploading setup script..."
scp $SSH_OPTS deployment/setup_server.sh $SERVER_USER@$SERVER_IP:/root/setup_server.sh
ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "chmod +x /root/setup_server.sh && /root/setup_server.sh"

# 3. Create target directory
ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "mkdir -p $TARGET_DIR"

# 4. Sync Files
echo "Syncing application files..."
rsync -avz -e "ssh $SSH_OPTS" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'coverage' \
    --exclude '.env' \
    ./ $SERVER_USER@$SERVER_IP:$TARGET_DIR

# 5. Copy .env
echo "Copying .env..."
scp $SSH_OPTS .env $SERVER_USER@$SERVER_IP:$TARGET_DIR/.env

# 6. Start Services
echo "Starting Docker services..."
ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "cd $TARGET_DIR && docker compose up -d --build"

echo "=== Deployment Complete! ==="
