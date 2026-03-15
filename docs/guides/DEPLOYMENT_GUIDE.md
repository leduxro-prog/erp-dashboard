# CYPHER ERP - Deployment & CI/CD Guide

This document provides comprehensive guidance on deploying CYPHER ERP using Docker, Docker Compose, and GitHub Actions CI/CD pipelines.

## Table of Contents

1. [Docker Setup](#docker-setup)
2. [Local Development with Docker](#local-development-with-docker)
3. [Production Deployment](#production-deployment)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Monitoring & Health Checks](#monitoring--health-checks)
6. [Troubleshooting](#troubleshooting)

---

## Docker Setup

### Project Structure

```
cypher/
├── Dockerfile              # Multi-stage production Docker image
├── docker-compose.yml      # Production/staging composition
├── docker-compose.dev.yml  # Development overrides
├── .dockerignore           # Files excluded from Docker build
├── .github/
│   └── workflows/
│       ├── ci.yml         # Continuous Integration pipeline
│       └── deploy.yml     # Continuous Deployment pipeline
└── .env.example           # Environment variables template
```

### Dockerfile Details

The Dockerfile uses a **multi-stage build** approach:

#### Stage 1: Builder
- Base: `node:20-alpine`
- Installs build dependencies (Python, Make, G++)
- Installs npm dependencies with `npm ci`
- Compiles TypeScript to JavaScript

#### Stage 2: Production Runtime
- Base: `node:20-alpine`
- Minimal image with production dependencies only
- Non-root user `nodejs` (UID: 1001) for security
- Health check endpoint: `http://localhost:3000/health`
- Signal handling with `dumb-init`
- Resource limits enforced

### Security Features

- **Non-root User**: Runs as `nodejs:nodejs` (1001:1001)
- **Minimal Image**: Production stage excludes dev dependencies
- **Health Checks**: Automatic monitoring and restart on failure
- **Read-only Filesystem**: Recommended for hardening
- **Resource Limits**: CPU and memory constraints enforced

---

## Local Development with Docker

### Prerequisites

- Docker Desktop 20.10+
- Docker Compose 2.0+
- Node.js 20+ (for direct development)

### Quick Start

#### 1. Setup Environment

```bash
cp .env.example .env
# Edit .env with your development settings
```

#### 2. Start Services with Development Overrides

```bash
# Start all services with development configuration
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker compose logs -f app

# Access services:
# - App: http://localhost:3000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - PgAdmin: http://localhost:5050
```

#### 3. Run Database Migrations

```bash
docker compose exec app npm run migration:run
```

#### 4. Seed Database (Optional)

```bash
docker compose exec app npm run seed
```

### Development Features

- **Hot Reload**: Source code mounted as volume, ts-node-dev watches for changes
- **Debug Port**: Port 9229 exposed for Node.js debugger
- **Log Level**: Set to `debug` for detailed output
- **Database Logging**: Enabled to see SQL queries
- **Live Dependencies**: npm_modules mounted from container to prevent conflicts

### Useful Commands

```bash
# Start services
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Stop services
docker compose down

# View logs
docker compose logs -f app
docker compose logs -f db
docker compose logs -f redis

# Access container shell
docker compose exec app sh

# Run npm commands
docker compose exec app npm run build
docker compose exec app npm run lint
docker compose exec app npm run test

# Database operations
docker compose exec db psql -U cypher_user -d cypher_erp_dev
docker compose exec app npm run migration:generate -- -n "MigrationName"

# Stop and remove all data
docker compose down -v
```

---

## Production Deployment

### Environment Configuration

#### Critical Variables for Production

```bash
# Application
NODE_ENV=production
PORT=3000

# Database (use strong passwords in secrets manager)
DB_HOST=db                          # Internal Docker network hostname
DB_PASSWORD=${SECURE_DB_PASSWORD}   # From secrets manager

# Redis
REDIS_PASSWORD=${SECURE_REDIS_PASSWORD}

# JWT Secrets (generate with: `openssl rand -base64 32`)
JWT_SECRET=${SECURE_JWT_SECRET}
JWT_REFRESH_SECRET=${SECURE_REFRESH_SECRET}

# Third-party APIs
SMARTBILL_API_URL=https://ws.smartbill.ro/SMBWS/api
SMARTBILL_USERNAME=${SMARTBILL_USERNAME}
SMARTBILL_TOKEN=${SMARTBILL_TOKEN}

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Docker Image Building

#### Build for Specific Environment

```bash
# Build production image
docker build -t cypher-erp:1.0.0 .
docker build -t cypher-erp:latest .

# Tag for registry
docker tag cypher-erp:latest myregistry.azurecr.io/cypher-erp:latest

# Push to registry
docker push myregistry.azurecr.io/cypher-erp:latest
```

### Docker Compose Production Deployment

```bash
# Load environment from file
cp .env.example .env.prod
# Edit .env.prod with production values

# Start services (without development overrides)
docker compose -f docker-compose.yml --env-file .env.prod up -d

# Verify all services are running
docker compose ps

# Check health
docker compose exec app curl http://localhost:3000/health
```

### Data Persistence

The production compose file includes three named volumes:

1. **db-data**: PostgreSQL database files
   - Persists across container restarts
   - Recommended backup strategy: daily snapshots

2. **redis-data**: Redis persistent store
   - AOF (Append-Only File) enabled
   - Survives process crashes

3. **pgadmin-data**: PgAdmin configuration
   - Optional for database administration

### Resource Limits

Production containers have strict resource limits:

```yaml
app:
  limits: 2 CPU, 1GB RAM
  reservations: 1 CPU, 512MB RAM

db:
  limits: 1 CPU, 512MB RAM
  reservations: 0.5 CPU, 256MB RAM

redis:
  limits: 0.5 CPU, 256MB RAM
  reservations: 0.25 CPU, 128MB RAM
```

### Health Checks

All services include health checks:

- **App**: HTTP GET /health every 30s
- **Database**: pg_isready every 10s
- **Redis**: PING command every 10s

Failed health checks trigger automatic restarts.

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. CI Pipeline (.github/workflows/ci.yml)

Runs on: `push` to main/develop, `pull_request` to main/develop

**Jobs:**

1. **lint** - Code style and formatting
   - ESLint validation
   - Prettier formatting check
   - Fails on errors

2. **test** - Unit and integration tests
   - Starts PostgreSQL and Redis test containers
   - Jest with coverage reporting
   - Coverage uploaded to Codecov
   - Test artifacts archived

3. **build** - TypeScript compilation
   - Compiles src/ to dist/
   - Validates build output
   - Archives dist/ for future jobs

4. **security** - Dependency scanning
   - npm audit (moderate level)
   - Generates audit report
   - Warns on vulnerabilities

5. **docker** - Docker image building
   - Only runs on main/develop branches
   - Uses Docker buildx for caching
   - Scans image for vulnerabilities (optional)

6. **status** - Overall pipeline status
   - Determines if CI passed or failed

#### 2. Deploy Pipeline (.github/workflows/deploy.yml)

Runs on: `push` to main/develop, manual trigger via workflow_dispatch

**Jobs:**

1. **deploy-staging** - Auto-deploys develop branch
   - Builds Docker image
   - Pushes to AWS ECR
   - Updates ECS service
   - Runs smoke tests

2. **deploy-production** - Manual approval for main branch
   - Requires environment approval
   - Creates database backup
   - Pushes image to ECR
   - Updates production ECS cluster
   - Waits for service stabilization

3. **smoke-test** - Post-deployment verification
   - Verifies health endpoints
   - Checks critical API routes
   - Fails if services unhealthy

4. **rollback** - Automatic rollback on failure
   - Reverts to previous task definition
   - Notifies team via Slack
   - Runs if smoke tests fail

### Required Secrets

Configure these in GitHub repository settings:

```
AWS_ACCESS_KEY_ID           # AWS credentials
AWS_SECRET_ACCESS_KEY
AWS_ACCOUNT_ID              # AWS account ID (123456789)

SLACK_WEBHOOK              # Slack notifications for deployments
```

### Workflow Triggers

```yaml
# Automatic triggers
push:
  branches: [main, develop, 'feature/**']
pull_request:
  branches: [main, develop]

# Manual trigger
workflow_dispatch:
  inputs:
    environment:
      options: [staging, production]
```

### Pipeline Flow

```
Push to branch
    ↓
┌─────────────────────────────────────┐
│  CI Pipeline                        │
│  ├─ Lint (eslint, prettier)         │
│  ├─ Test (jest, coverage)           │
│  ├─ Build (typescript)              │
│  ├─ Security (npm audit)            │
│  └─ Docker (build image)            │
└─────────────────────────────────────┘
    ↓
If develop branch → Auto deploy to staging
If main branch    → Await manual approval → Deploy to production
    ↓
┌─────────────────────────────────────┐
│  Deploy Pipeline                    │
│  ├─ Build & Push Docker image       │
│  ├─ Update ECS service              │
│  ├─ Run smoke tests                 │
│  └─ Auto-rollback on failure        │
└─────────────────────────────────────┘
```

---

## Monitoring & Health Checks

### Health Endpoint

Application provides health check endpoint:

```bash
curl http://localhost:3000/health

# Response:
{
  "status": "ok",
  "timestamp": "2024-02-07T10:30:00Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### Docker Health Status

```bash
# View health status
docker compose ps

# Example output:
NAME                    STATUS
cypher-erp-app          Up 5 minutes (healthy)
cypher-erp-db           Up 5 minutes (healthy)
cypher-erp-redis        Up 5 minutes (healthy)
```

### Logs

```bash
# View application logs
docker compose logs app

# Follow logs in real-time
docker compose logs -f app

# View specific service logs
docker compose logs db
docker compose logs redis

# View logs with timestamps
docker compose logs --timestamps app

# Last 100 lines
docker compose logs --tail=100 app
```

### Monitoring Integration

Configure these optional integrations:

- **Sentry**: Error tracking (SENTRY_DSN)
- **DataDog**: Infrastructure monitoring
- **New Relic**: Application performance monitoring
- **Slack**: Deployment notifications (SLACK_WEBHOOK)

---

## Troubleshooting

### Common Issues

#### Container fails to start

```bash
# Check logs
docker compose logs app

# Common causes:
# - Port 3000 already in use
# - Database connection failed
# - Missing environment variables

# Solution: Check .env file and dependencies
docker compose down
docker compose up --build
```

#### Database connection issues

```bash
# Verify database is healthy
docker compose exec db pg_isready -U cypher_user

# Check PostgreSQL logs
docker compose logs db

# Connect to database directly
docker compose exec db psql -U cypher_user -d cypher_erp
```

#### Redis connection issues

```bash
# Test Redis connection
docker compose exec redis redis-cli ping

# Check Redis logs
docker compose logs redis

# Monitor Redis activity
docker compose exec redis redis-cli monitor
```

#### Build failures

```bash
# Clean build
docker compose down
docker system prune -a
docker compose up --build

# Check TypeScript compilation
docker compose exec app npm run build

# Check npm dependencies
docker compose exec app npm list
```

### Performance Optimization

```bash
# Monitor resource usage
docker stats

# Increase resource limits in docker-compose.yml if needed
resources:
  limits:
    cpus: '4'
    memory: 2G
```

### Secrets Management

**Never** commit secrets to repository:

```bash
# Use environment files (add to .gitignore)
.env
.env.prod
.env.staging

# For CI/CD: Use GitHub Secrets
Settings → Secrets and variables → Actions

# For local development
cp .env.example .env
# Edit .env with local values
```

### Cleanup

```bash
# Stop all services
docker compose down

# Remove all data (WARNING: destructive)
docker compose down -v

# Remove images
docker rmi cypher-erp:latest

# Full cleanup
docker compose down -v
docker system prune -a
```

---

## Production Checklist

Before deploying to production:

- [ ] Environment variables configured in secrets manager
- [ ] Database backups automated
- [ ] Health checks verified working
- [ ] Resource limits set appropriately
- [ ] Logging configured (centralized preferred)
- [ ] Monitoring tools connected
- [ ] Slack notifications enabled
- [ ] Rollback procedure tested
- [ ] Database migrations tested in staging
- [ ] Load testing completed
- [ ] Security scanning passed
- [ ] SSL/TLS certificates configured
- [ ] DNS records pointing to correct endpoint
- [ ] Rate limiting enabled
- [ ] CORS properly configured

---

## Support & Documentation

- **Project**: CYPHER ERP/CRM System for Ledux.ro
- **Repository**: GitHub
- **Issue Tracking**: GitHub Issues
- **Docker Documentation**: https://docs.docker.com
- **GitHub Actions**: https://docs.github.com/en/actions

