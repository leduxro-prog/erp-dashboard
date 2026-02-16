# Deployment Guide

**Version:** 0.1.0
**Target Audience:** DevOps engineers, system administrators
**Last Updated:** February 2025

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Production Checklist](#production-checklist)
6. [Environment Variables](#environment-variables)
7. [Database Migrations](#database-migrations)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum (Development):**
- 2 CPU cores
- 2 GB RAM
- 20 GB storage

**Recommended (Production - 100K products, 500+ customers):**
- 4+ CPU cores
- 8-16 GB RAM
- 200+ GB storage (SSD)
- PostgreSQL 15+
- Redis 7+

### Required Software

```bash
# Node.js 20 LTS
node --version  # v20.x.x

# npm 10+
npm --version   # 10.x.x

# PostgreSQL 15
psql --version  # psql (PostgreSQL) 15.x

# Redis 7
redis-cli --version  # redis-cli 7.x.x

# Git
git --version   # git version 2.x.x

# Docker & Docker Compose (for containerized deployment)
docker --version  # Docker 24.x.x
docker compose --version  # Docker Compose 2.x.x
```

---

## Local Development Setup

### Step 1: Clone Repository

```bash
git clone <repo-url> cypher
cd cypher
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit with your settings
nano .env

# Required changes:
# - DB_PASSWORD=your_secure_password
# - JWT_SECRET=your_jwt_secret_change_me
# - SMARTBILL_USERNAME=your_smartbill_username
# - SMARTBILL_TOKEN=your_smartbill_token
# - WOOCOMMERCE_CONSUMER_KEY=your_wc_key
# - WOOCOMMERCE_CONSUMER_SECRET=your_wc_secret
```

### Step 4: Start Services with Docker Compose

```bash
# Start PostgreSQL, Redis, and app
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Step 5: Run Migrations

```bash
npm run migration:run
```

### Step 6: Seed Database (Optional)

```bash
npm run seed
```

### Step 7: Start Development Server

```bash
npm run dev

# Server running at http://localhost:3000
# Health check: curl http://localhost:3000/health
```

---

## Docker Deployment

### Development Image

**File:** `infrastructure/docker/Dockerfile.dev`

```bash
# Build development image
docker build -t cypher:dev -f infrastructure/docker/Dockerfile.dev .

# Run with Docker Compose (preferred)
docker compose up -d

# Or run manually
docker run -p 3000:3000 \
  --env-file .env \
  --network cypher_network \
  cypher:dev
```

### Production Image

**File:** `infrastructure/docker/Dockerfile.prod`

```bash
# Build production image (multi-stage, optimized)
docker build -t cypher:latest -f infrastructure/docker/Dockerfile.prod .

# Tag for registry
docker tag cypher:latest docker.io/myregistry/cypher:latest

# Push to registry
docker push docker.io/myregistry/cypher:latest

# Run production container
docker run -d \
  -p 3000:3000 \
  --name cypher-api \
  --restart unless-stopped \
  --env-file .env.production \
  -e NODE_ENV=production \
  --network cypher_network \
  docker.io/myregistry/cypher:latest
```

### Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL with persistent volume
  postgres:
    image: postgres:15-alpine
    container_name: cypher_postgres_prod
    restart: always
    environment:
      POSTGRES_DB: cypher_erp
      POSTGRES_USER: cypher_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
      - ./database/backup:/backup
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U cypher_user -d cypher_erp']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - cypher_network

  # Redis for caching and pub/sub
  redis:
    image: redis:7-alpine
    container_name: cypher_redis_prod
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data_prod:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - cypher_network

  # CYPHER API
  api:
    image: cypher:latest
    container_name: cypher_api_prod
    restart: always
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
    ports:
      - '3000:3000'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - cypher_network
    logging:
      driver: json-file
      options:
        max-size: '10m'
        max-file: '3'

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: cypher_nginx_prod
    restart: always
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infrastructure/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - cypher_network

volumes:
  postgres_data_prod:
    driver: local
  redis_data_prod:
    driver: local

networks:
  cypher_network:
    driver: bridge
```

**Deploy:**

```bash
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f api

# Stop services
docker compose -f docker-compose.prod.yml down
```

---

## Manual Deployment

### Step 1: Install Node.js Dependencies

```bash
npm install --production
```

### Step 2: Build TypeScript

```bash
npm run build

# Output in dist/ directory
ls -la dist/
```

### Step 3: Configure Environment

```bash
# Create production .env file
cat > .env.production << EOF
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1

# Database
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=cypher_erp
DB_USERNAME=cypher_user
DB_PASSWORD=your_secure_password
DB_SSL=true
DB_LOGGING=false

# Redis
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# JWT
JWT_SECRET=your_jwt_secret_change_me
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# External APIs
SMARTBILL_API_URL=https://ws.smartbill.ro/SMBWS/api
SMARTBILL_USERNAME=your_username
SMARTBILL_TOKEN=your_token

WOOCOMMERCE_URL=https://ledux.ro
WOOCOMMERCE_CONSUMER_KEY=your_key
WOOCOMMERCE_CONSUMER_SECRET=your_secret

# CORS
CORS_ORIGINS=https://ledux.ro,https://admin.ledux.ro

# Logging
LOG_LEVEL=info
EOF

# Restrict permissions
chmod 600 .env.production
```

### Step 4: Create Application User

```bash
# Create non-root user for running application
sudo useradd -m -s /bin/bash cypher
sudo chown -R cypher:cypher /home/cypher/cypher-app
```

### Step 5: Set Up Systemd Service

**File:** `/etc/systemd/system/cypher.service`

```ini
[Unit]
Description=CYPHER ERP API
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=cypher
WorkingDirectory=/home/cypher/cypher-app
EnvironmentFile=/home/cypher/cypher-app/.env.production
ExecStart=/usr/bin/node /home/cypher/cypher-app/dist/src/server.js
Restart=on-failure
RestartSec=10

# Resource limits
LimitNOFILE=65535
LimitNPROC=65535

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cypher

[Install]
WantedBy=multi-user.target
```

**Enable and start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable cypher
sudo systemctl start cypher

# View logs
sudo journalctl -u cypher -f

# Check status
sudo systemctl status cypher
```

### Step 6: Run Migrations

```bash
sudo -u cypher npm run migration:run
```

### Step 7: Set Up Nginx Reverse Proxy

**File:** `/etc/nginx/sites-available/cypher`

```nginx
upstream cypher_backend {
    server localhost:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.ledux.ro;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.ledux.ro;

    # SSL certificates (from Let's Encrypt or your CA)
    ssl_certificate /etc/letsencrypt/live/api.ledux.ro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ledux.ro/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;
    gzip_min_length 1000;

    # Request body size limit
    client_max_body_size 10k;

    # Proxy to backend
    location / {
        proxy_pass http://cypher_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://cypher_backend;
        access_log off;
    }

    # Metrics endpoint (restrict to internal IPs)
    location /metrics {
        proxy_pass http://cypher_backend;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
    }
}
```

**Enable:**

```bash
sudo ln -s /etc/nginx/sites-available/cypher /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Production Checklist

### Pre-Deployment

- [ ] All tests passing: `npm test`
- [ ] Code linting clean: `npm run lint`
- [ ] TypeScript compiles: `npm run build`
- [ ] Environment variables set and validated
- [ ] Database backups created
- [ ] SSL certificates obtained and installed
- [ ] Load balancer/reverse proxy configured
- [ ] Monitoring/alerting configured

### Security

- [ ] `JWT_SECRET` rotated and securely stored (use Vault/Secrets Manager)
- [ ] `DB_PASSWORD` securely stored (not in code)
- [ ] `REDIS_PASSWORD` set (not using default)
- [ ] HTTPS/TLS configured and enforced
- [ ] CORS origins restricted to known domains only
- [ ] Rate limiting enabled and appropriate
- [ ] Input validation and sanitization active
- [ ] CSRF protection enabled
- [ ] Audit logging configured
- [ ] Security headers set (Helmet.js)

### Database

- [ ] PostgreSQL 15+ installed and running
- [ ] Connection pooling configured (min: 5, max: 20)
- [ ] Indexes created on frequently queried fields
- [ ] Backup schedule configured (daily)
- [ ] Restore procedure tested
- [ ] Migrations tested in staging first
- [ ] Slow query log enabled

### Cache & Queue

- [ ] Redis 7+ installed and running
- [ ] Persistence enabled (RDB + AOF)
- [ ] Memory management configured
- [ ] Eviction policy set: `allkeys-lru`
- [ ] BullMQ queues configured with retries

### Monitoring

- [ ] Prometheus metrics endpoint accessible
- [ ] Log aggregation configured (ELK, Datadog, etc.)
- [ ] Health check endpoint monitored
- [ ] CPU/Memory/Disk alerts set
- [ ] Database query performance monitoring
- [ ] Error rate threshold alerting

### Operations

- [ ] Graceful shutdown procedure tested
- [ ] Log rotation configured (prevent disk fill)
- [ ] Cron jobs scheduled (supplier sync, SmartBill sync, backups)
- [ ] Runbook created for common tasks
- [ ] On-call rotation established

---

## Environment Variables

### Complete .env Reference

```bash
# ============================================
# Application Configuration
# ============================================
NODE_ENV=production                    # development, staging, production
PORT=3000                              # API server port
API_PREFIX=/api/v1                     # API route prefix
APP_NAME="CYPHER ERP"                  # Application name
APP_URL=https://api.ledux.ro           # Public API URL

# ============================================
# Database (PostgreSQL)
# ============================================
DB_HOST=db.example.com                 # PostgreSQL hostname
DB_PORT=5432                           # PostgreSQL port
DB_NAME=cypher_erp                     # Database name
DB_USERNAME=cypher_user                # Database user
DB_PASSWORD=your_secure_password       # Database password (use Vault)
DB_SSL=true                            # Use SSL connection
DB_LOGGING=false                       # Log SQL queries (disable in prod)

# Connection pooling
DB_POOL_MAX=20                         # Maximum connections
DB_POOL_MIN=5                          # Minimum connections
DB_IDLE_TIMEOUT=30000                  # Idle timeout (ms)
DB_CONNECTION_TIMEOUT=5000             # Connection timeout (ms)
DB_STATEMENT_TIMEOUT=30000             # Query timeout (ms)

# ============================================
# Redis
# ============================================
REDIS_HOST=redis.example.com           # Redis hostname
REDIS_PORT=6379                        # Redis port
REDIS_PASSWORD=your_redis_password     # Redis password
REDIS_DB=0                             # Redis database number

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET=your_jwt_secret_change_me   # JWT signing secret (use Vault)
JWT_EXPIRES_IN=24h                     # Access token expiration
JWT_REFRESH_SECRET=your_refresh_secret # Refresh token secret
JWT_REFRESH_EXPIRES_IN=7d              # Refresh token expiration

# ============================================
# SmartBill Integration
# ============================================
SMARTBILL_API_URL=https://ws.smartbill.ro/SMBWS/api
SMARTBILL_USERNAME=your_username       # SmartBill username
SMARTBILL_TOKEN=your_token             # SmartBill API token
SMARTBILL_COMPANY_VAT=RO12345678       # Your company VAT ID
SMARTBILL_INVOICE_SERIES=FL            # Invoice series (FL = monthly)
SMARTBILL_SYNC_INTERVAL_MS=900000      # Sync every 15 minutes

# ============================================
# WooCommerce Integration
# ============================================
WOOCOMMERCE_URL=https://ledux.ro       # WooCommerce site URL
WOOCOMMERCE_CONSUMER_KEY=your_key      # WooCommerce API key
WOOCOMMERCE_CONSUMER_SECRET=your_secret # WooCommerce API secret
WOOCOMMERCE_VERSION=wc/v3              # WooCommerce API version

# ============================================
# WhatsApp Business (Agent B)
# ============================================
WHATSAPP_API_URL=https://graph.instagram.com/v18.0
WHATSAPP_API_TOKEN=your_token          # WhatsApp Business API token
WHATSAPP_PHONE_NUMBER_ID=123456789     # WhatsApp phone number ID

# ============================================
# Email (SendGrid)
# ============================================
SENDGRID_API_KEY=your_sendgrid_key     # SendGrid API key
EMAIL_FROM=noreply@ledux.ro            # From email address
EMAIL_FROM_NAME="Ledux.ro"             # From display name

# ============================================
# Supplier Scraping
# ============================================
SUPPLIER_SYNC_INTERVAL_MS=14400000     # 4 hours
SUPPLIER_SCRAPE_TIMEOUT_MS=30000       # 30 seconds per supplier
SUPPLIER_SCRAPE_MAX_RETRIES=3          # Retry 3 times

# ============================================
# Logging
# ============================================
LOG_LEVEL=info                         # debug, info, warn, error
LOG_FORMAT=json                        # json or combined

# ============================================
# Rate Limiting
# ============================================
RATE_LIMIT_WINDOW_MS=3600000           # 1 hour sliding window
RATE_LIMIT_MAX_REQUESTS=1000           # Max 1000 requests/hour

# ============================================
# CORS
# ============================================
CORS_ORIGINS=https://ledux.ro,https://admin.ledux.ro
CORS_CREDENTIALS=true
```

---

## Database Migrations

### View Migration Status

```bash
npm run typeorm migration:show
```

### Run Migrations

```bash
# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Run specific migration
npm run typeorm migration:run -- --transaction=all
```

### Create Migration

```bash
# Generate migration based on entity changes
npm run migration:generate -- -n AddNewTable

# Edit migration file in database/migrations/
# Run: npm run migration:run
```

### Backup Before Migration

```bash
# Create backup before critical migrations
pg_dump -h localhost -U cypher_user cypher_erp > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Run migration
npm run migration:run

# Verify success
npm run typeorm migration:show
```

---

## Monitoring & Logging

### Prometheus Metrics

Endpoint: `GET /metrics`

```bash
# Scrape configuration for Prometheus
cat > /etc/prometheus/cypher.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cypher-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
EOF
```

### Log Aggregation with ELK Stack

```bash
# Filebeat configuration to send logs to Elasticsearch
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/cypher/*.log
  fields:
    app: cypher-api

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "CYPHER ERP Monitoring",
    "panels": [
      {
        "title": "Requests Per Minute",
        "targets": [{ "expr": "rate(http_requests_total[1m])" }]
      },
      {
        "title": "Response Time (p95)",
        "targets": [{ "expr": "histogram_quantile(0.95, http_request_duration_seconds)" }]
      },
      {
        "title": "Database Connections",
        "targets": [{ "expr": "pg_stat_activity_count" }]
      }
    ]
  }
}
```

---

## Backup & Recovery

### Database Backup

```bash
# Manual backup
pg_dump -h $DB_HOST -U $DB_USERNAME -d $DB_NAME > cypher_backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -h $DB_HOST -U $DB_USERNAME -d $DB_NAME | gzip > cypher_backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup with custom format (faster restore)
pg_dump -h $DB_HOST -U $DB_USERNAME -F custom -d $DB_NAME > cypher_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore from Backup

```bash
# From SQL dump
psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME < cypher_backup_20250207_100000.sql

# From compressed dump
gunzip < cypher_backup_20250207_100000.sql.gz | psql -h $DB_HOST -U $DB_USERNAME -d $DB_NAME

# From custom format
pg_restore -h $DB_HOST -U $DB_USERNAME -d $DB_NAME cypher_backup_20250207_100000.dump
```

### Automated Backup Cron Job

```bash
# File: /home/cypher/backup-cypher-db.sh
#!/bin/bash

BACKUP_DIR="/backups/cypher"
DB_HOST="db.example.com"
DB_NAME="cypher_erp"
DB_USER="cypher_user"

mkdir -p $BACKUP_DIR

# Create backup
BACKUP_FILE="$BACKUP_DIR/cypher_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "cypher_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"

# Cron job: Add to crontab -e
# 0 2 * * * /home/cypher/backup-cypher-db.sh  # Daily at 2 AM
```

### Redis Persistence

Redis is configured with RDB (snapshots) and AOF (append-only file):

```
# /etc/redis/redis.conf

# RDB snapshots
save 900 1        # Save after 900 seconds if at least 1 key changed
save 300 10       # Save after 300 seconds if at least 10 keys changed
save 60 10000     # Save after 60 seconds if at least 10000 keys changed

# AOF (recommended)
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec  # Sync every second
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker compose logs api
# or
sudo journalctl -u cypher -n 100

# Common issues:
# 1. Database not running: docker compose logs postgres
# 2. Port already in use: lsof -i :3000
# 3. Environment variables missing: cat .env | grep -E "^[A-Z]"
# 4. Migrations failed: npm run migration:run -- --dryrun
```

### Slow Queries

```bash
# Enable slow query log
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second
SELECT pg_reload_conf();

# View slow queries
SELECT query, calls, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Create missing indexes
CREATE INDEX idx_order_customer ON orders(customer_id);
ANALYZE;  # Update statistics
```

### High Memory Usage

```bash
# Check Node.js memory
ps aux | grep node

# Check Redis memory
redis-cli INFO memory

# Check PostgreSQL memory
ps aux | grep postgres

# If Redis is using too much:
redis-cli INFO memory
redis-cli MEMORY STATS  # Detailed breakdown
redis-cli FLUSHALL  # Clear all keys (CAREFUL!)
```

### Database Connection Pool Exhausted

```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# See which queries are running
SELECT pid, usename, application_name, state, query FROM pg_stat_activity WHERE state != 'idle';

# Kill idle connections (if safe)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle' AND query_start < now() - interval '30 minutes';
```

### Rate Limiting Issues

```bash
# Check rate limit status
curl -I -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/pricing/123

# Response headers:
# X-RateLimit-Limit: 1000
# X-RateLimit-Remaining: 999
# X-RateLimit-Reset: 1707386400

# If hitting limit, check Redis key:
redis-cli KEYS "ratelimit:*"
redis-cli GET "ratelimit:192.168.1.100"
```

### Event Bus Not Working

```bash
# Check Redis connection
redis-cli PING  # Should return PONG

# Check subscriptions
redis-cli PUBSUB CHANNELS

# Check if events are being published
redis-cli MONITOR  # Shows all Redis commands in real-time
```

---

**Document Version:** 0.1.0
**Last Updated:** February 2025
**Questions?** Contact devops@ledux.ro

