#!/bin/bash

# Deployment Script for Hetzner CAX21
# Usage: ./deploy.sh

SERVER_IP="65.108.255.104"
SERVER_USER="root"
TARGET_DIR="/opt/cypher-erp"
SSH_CMD="ssh $SERVER_USER@$SERVER_IP"

echo "Deploying to $SERVER_USER@$SERVER_IP..."

# 1. Verify connection
echo "Verifying SSH connection..."
$SSH_CMD "echo 'Connection successful'"

# 2. Create target directory
echo "Creating target directory..."
$SSH_CMD "mkdir -p $TARGET_DIR"

# 3. Request Password once if needed for rsync? 
# Note: It's better to use SSH keys. If using password, rsync will prompt.
echo "Syncing files..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude 'coverage' --exclude '.env' ./ $SERVER_USER@$SERVER_IP:$TARGET_DIR

# 4. Copy .env (if it exists locally, or handle securely)
if [ -f .env ]; then
    echo "Copying .env file..."
    scp .env $SERVER_USER@$SERVER_IP:$TARGET_DIR/.env
else
    echo "WARNING: .env file not found locally. Ensure it exists on the server!"
fi

# 5. Run Docker Compose
echo "Starting services..."
$SSH_CMD "cd $TARGET_DIR && docker compose -f docker-compose.yml up -d --build"

echo "Deployment complete!"
