#!/bin/bash

# Server Setup Script for Hetzner CAX21
# Installs Docker, Docker Compose, and configures Firewall

set -e

echo "Updating system..."
apt-get update && apt-get upgrade -y

echo "Installing dependencies..."
apt-get install -y apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release

echo "Installing Docker..."
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository (ARM64 detected automatically by arch)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "Configuring Firewall (UFW)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp # Allow API direct access if needed, or stick to Nginx proxy
ufw --force enable

echo "System ready!"
docker --version
docker compose version
