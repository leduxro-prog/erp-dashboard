#!/bin/bash

# CYPHER ERP - Hetzner CAX21 Setup Script
# This script installs Docker, Docker Compose, and sets up the project.

set -e

echo "🚀 Starting CYPHER ERP Setup on Hetzner CAX21..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker & Docker Compose
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed successfully."
else
    echo "✅ Docker is already installed."
fi

# 3. Setup Project Directory
PROJECT_DIR="/opt/cypher-erp"
echo "📂 Setting up project directory at $PROJECT_DIR..."

if [ ! -d "$PROJECT_DIR" ]; then
    echo "⚠️  Project directory not found. Please clone the repository to $PROJECT_DIR or run this script inside the project root."
    # Fallback to current directory if it looks like the project
    if [ -f "docker-compose.yml" ]; then
        PROJECT_DIR=$(pwd)
        echo "ℹ️  Using current directory: $PROJECT_DIR"
    else
        exit 1
    fi
else
    cd $PROJECT_DIR
fi

# 4. Configure Environment
echo "⚙️  Configuring environment..."
if [ ! -f .env.production ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.production
        echo "📝 Created .env.production from example. Please edit it with your secrets!"
        
        # Set production default values
        sed -i 's/NODE_ENV=development/NODE_ENV=production/' .env.production
        sed -i 's/PORT=3000/PORT=80/' .env.production # CAX21 is a server, so we likely want port 80/443 exposed via a reverse proxy later, but for now standard ports
        
        # Generate random secrets
        JWT_SECRET=$(openssl rand -base64 32)
        REFRESH_SECRET=$(openssl rand -base64 32)
        REDIS_PASSWORD=$(openssl rand -base64 24)
        DB_PASSWORD=$(openssl rand -base64 24)
        
        # Escape special characters for sed
        JWT_SECRET=${JWT_SECRET//\//\\/}
        REFRESH_SECRET=${REFRESH_SECRET//\//\\/}
        REDIS_PASSWORD=${REDIS_PASSWORD//\//\\/}
        DB_PASSWORD=${DB_PASSWORD//\//\\/}
        
        sed -i "s/your_jwt_secret_change_me_in_production/$JWT_SECRET/" .env.production
        sed -i "s/your_refresh_secret_change_me/$REFRESH_SECRET/" .env.production
        sed -i "s/REDIS_PASSWORD=/REDIS_PASSWORD=$REDIS_PASSWORD/" .env.production
        sed -i "s/cypher_secret_change_me/$DB_PASSWORD/" .env.production
        
        echo "🔑 Generated secure JWT secrets and Database/Redis passwords."
    else
        echo "❌ .env.example not found!"
        exit 1
    fi
else
    echo "✅ .env.production already exists."
fi

# 5. Start Services
echo "🚀 Starting services with Docker Compose..."
# Stop any existing containers
docker compose -f docker-compose.yml down --remove-orphans || true

# Start fresh
docker compose -f docker-compose.yml --env-file .env.production up -d --build

echo " "
echo "✅ Setup Complete!"
echo " "
echo "🌐 Application should be running at: http://$(curl -s ifconfig.me):3000"
echo " "
echo "👉 Next steps:"
echo "1. Edit .env.production to add your database passwords and API keys."
echo "2. Run 'docker compose -f docker-compose.yml --env-file .env.production restart' to apply changes."
echo "3. Check logs with 'docker compose logs -f'."
