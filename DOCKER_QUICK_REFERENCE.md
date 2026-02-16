# CYPHER ERP - Docker Quick Reference

## Quick Start Commands

### Development Setup
```bash
# First time setup
cp .env.example .env

# Start all services with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View application logs
docker compose logs -f app

# Access services
# - App: http://localhost:3000
# - Database: localhost:5432 (user: cypher_user)
# - Redis: localhost:6379
# - PgAdmin: http://localhost:5050 (admin@ledux.ro / admin)
```

### Common Development Tasks
```bash
# Run linting
docker compose exec app npm run lint

# Run tests
docker compose exec app npm run test

# Build project
docker compose exec app npm run build

# Run migrations
docker compose exec app npm run migration:run

# Access PostgreSQL
docker compose exec db psql -U cypher_user -d cypher_erp_dev

# Access Redis
docker compose exec redis redis-cli

# Shell access to app container
docker compose exec app sh
```

### Stopping & Cleanup
```bash
# Stop all services (keeps data)
docker compose down

# Stop and remove all data (WARNING: destructive)
docker compose down -v

# Full cleanup including images
docker compose down -v && docker system prune -a
```

## Production Commands

### Building Production Image
```bash
# Build image
docker build -t cypher-erp:1.0.0 .

# Tag for registry
docker tag cypher-erp:1.0.0 myregistry.azurecr.io/cypher-erp:1.0.0

# Push to registry
docker push myregistry.azurecr.io/cypher-erp:1.0.0
```

### Production Deployment
```bash
# Load production environment
cp .env.example .env.prod
# Edit .env.prod with production values

# Start services
docker compose -f docker-compose.yml --env-file .env.prod up -d

# Verify services
docker compose ps

# Check health
docker compose exec app curl http://localhost:3000/health
```

## Monitoring Commands

### Service Status
```bash
# View all services
docker compose ps

# View container resource usage
docker stats

# Watch resource usage in real-time
docker stats --no-stream=false
```

### Logging
```bash
# View logs (all services)
docker compose logs

# Follow logs (tail -f style)
docker compose logs -f

# View specific service logs
docker compose logs app
docker compose logs db
docker compose logs redis

# Last 100 lines
docker compose logs --tail=100

# With timestamps
docker compose logs --timestamps

# Since specific time
docker compose logs --since 2024-02-07T10:00:00
```

### Health Checks
```bash
# View health status
docker compose ps

# Manual health check
docker compose exec app wget --quiet --tries=1 --spider http://localhost:3000/health && echo "Healthy" || echo "Unhealthy"

# Database health
docker compose exec db pg_isready -U cypher_user

# Redis health
docker compose exec redis redis-cli ping
```

## Debugging

### Access Container Shell
```bash
# App container
docker compose exec app sh

# Database container
docker compose exec db sh

# Redis container
docker compose exec redis sh
```

### View Container Processes
```bash
# Inside app container
docker compose exec app ps aux

# View Node.js processes
docker compose exec app ps aux | grep node
```

### Network Diagnostics
```bash
# Test DNS resolution
docker compose exec app nslookup db
docker compose exec app nslookup redis

# Test connectivity
docker compose exec app wget -O /dev/null http://db:5432
docker compose exec app nc -zv redis 6379
```

### Database Debugging
```bash
# Connect to PostgreSQL
docker compose exec db psql -U cypher_user -d cypher_erp_dev

# Common psql commands
\dt              # List tables
\d+ table_name   # Describe table
SELECT * FROM table LIMIT 5;
```

### Redis Debugging
```bash
# Redis CLI
docker compose exec redis redis-cli

# Check Redis info
docker compose exec redis redis-cli INFO

# Monitor Redis commands
docker compose exec redis redis-cli MONITOR

# Get all keys
docker compose exec redis redis-cli KEYS "*"
```

## Environment Variables

### Essential Variables
```bash
NODE_ENV=production|development|test
PORT=3000
DB_HOST=db                          # Docker network name
DB_PASSWORD=<strong_password>
REDIS_HOST=redis
JWT_SECRET=<random_base64_string>
```

### Generate Secrets
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate secure password
openssl rand -base64 24
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs app

# Verify port availability
docker compose port app 3000

# Restart container
docker compose restart app
```

### Database connection failed
```bash
# Check database health
docker compose exec db pg_isready -U cypher_user

# View database logs
docker compose logs db

# Restart database
docker compose restart db
```

### Redis connection failed
```bash
# Test Redis
docker compose exec redis redis-cli ping

# Check Redis logs
docker compose logs redis

# View Redis info
docker compose exec redis redis-cli INFO
```

### High memory usage
```bash
# Check resource limits
docker compose ps

# Monitor in real-time
docker stats

# Kill process in container
docker compose exec app kill -9 <PID>
```

## Performance Optimization

### Resource Configuration
Edit docker-compose.yml:
```yaml
resources:
  limits:
    cpus: '4'          # Increase from 2 if needed
    memory: 2G         # Increase from 1G if needed
  reservations:
    cpus: '2'
    memory: 1G
```

### Logging Optimization
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "200m"   # Increase if high volume
    max-file: "20"     # Keep more files
```

## Volume Management

### View volumes
```bash
docker volume ls
```

### Inspect volume
```bash
docker volume inspect cypher_db-data
```

### Backup database volume
```bash
docker run --rm -v cypher_db-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/db-backup.tar.gz /data
```

### Restore database volume
```bash
docker run --rm -v cypher_db-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/db-backup.tar.gz
```

## Network Debugging

### Inspect network
```bash
docker network inspect cypher_cypher-network
```

### Connect container to debug
```bash
docker run -it --network cypher_cypher-network --rm alpine sh
# Inside container:
# nslookup app
# nc -zv app 3000
```

## CI/CD Integration

### Local testing of CI jobs
```bash
# Install act (GitHub Actions local runner)
brew install act

# Run CI locally
act push -b

# Run specific job
act -j lint
act -j test
```

### View GitHub Actions logs
```bash
# List workflow runs
gh run list

# View specific run
gh run view <run-id>

# View job logs
gh run view <run-id> -v
```

## Useful Aliases

Add to ~/.bashrc or ~/.zshrc:
```bash
alias dc='docker compose'
alias dcup='docker compose up -d'
alias dcdown='docker compose down'
alias dclogs='docker compose logs -f'
alias dcps='docker compose ps'
alias dcexec='docker compose exec'
alias dcrestart='docker compose restart'
alias dcbuild='docker compose build'
```

## File Locations

```
/sessions/funny-laughing-darwin/mnt/erp/cypher/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── .dockerignore
├── .env.example
├── .env                 (create from example, not in git)
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── DEPLOYMENT_GUIDE.md
├── CI_CD_SETUP_SUMMARY.md
└── DOCKER_QUICK_REFERENCE.md (this file)
```

---

**Last Updated**: February 2024
**CYPHER ERP Version**: 0.1.0
