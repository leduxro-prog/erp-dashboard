# Cypher ERP - Release Checklist

## Overview

This checklist provides a comprehensive guide for releasing the Cypher ERP system to production. It covers pre-release preparation, deployment steps, post-deployment verification, and rollback procedures.

**Last Updated:** 2026-02-13
**Current Version:** 0.1.0
**Target SLA:** 5-minute rollback capability

---

## Table of Contents

- [Pre-Release Checklist](#pre-release-checklist)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedures](#rollback-procedures)
- [Emergency Contacts](#emergency-contacts)
- [Release Notes Template](#release-notes-template)

---

## Pre-Release Checklist

Complete all items in this section before initiating a release.

### Code & Testing

- [ ] All tests passing in CI/CD pipeline
  - [ ] Unit tests (>70% coverage)
  - [ ] Integration tests
  - [ ] Smoke tests
- [ ] Code review completed for all changes
- [ ] Security scan passed (no critical vulnerabilities)
- [ ] ESLint checks passing
- [ ] TypeScript compilation successful
- [ ] Manual QA completed on staging environment

### Feature Validation

- [ ] New features tested and documented
- [ ] Breaking changes identified and communicated
- [ ] API changes documented
- [ ] Database migrations reviewed and tested
- [ ] Configuration changes documented
- [ ] Third-party integrations validated

### Infrastructure & Configuration

- [ ] Docker images built and pushed
- [ ] Environment variables reviewed and updated
- [ ] Secrets/certificates checked and rotated if needed
- [ ] Backup strategy verified
- [ ] Monitoring dashboards updated
- [ ] Alert rules configured for new features

### Documentation

- [ ] Release notes drafted
- [ ] API documentation updated
- [ ] User-facing documentation updated
- [ ] Known issues documented
- [ ] Migration guide provided (if breaking changes)

### Release Gate

- [ ] Release gate workflow passed
- [ ] All manual approvals obtained
- [ ] Performance benchmarks met
- [ ] Rollback drill completed successfully

---

## Deployment Steps

### 1. Preparation (15 minutes before deployment)

```bash
# Set release version
export RELEASE_VERSION="v1.0.0"
export TARGET_ENVIRONMENT="production"

# Verify you're on the correct branch
git checkout main
git pull origin main

# Create release tag
git tag -a "$RELEASE_VERSION" -m "Release $RELEASE_VERSION"
git push origin "$RELEASE_VERSION"

# Take current state snapshot
./scripts/backup.sh --pre-release
```

### 2. Pre-Deployment Checks (5 minutes)

```bash
# Run smoke tests on staging
npm run test:smoke

# Verify all services are healthy
curl http://staging.cypher.ro/health/live
curl http://staging.cypher.ro/health/detailed

# Check database connections
docker compose exec db pg_isready -U cypher_user
```

### 3. Database Backup (2 minutes)

```bash
# Backup database before deployment
docker compose exec db pg_dump -U cypher_user cypher_erp > backups/pre-deploy-$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
head -n 20 backups/pre-deploy-*.sql | grep "PostgreSQL database dump"
```

### 4. Deploy Application (Variable time)

```bash
# Option A: Using Docker Compose
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Option B: Using CI/CD
# Trigger release-gate workflow from GitHub Actions
```

### 5. Run Database Migrations (If applicable)

```bash
# Verify migrations to run
npm run migration:show

# Run migrations
npm run migration:run

# Verify migration success
npm run migration:show
```

### 6. Service Health Check (2 minutes)

```bash
# Wait for services to start
sleep 30

# Check health endpoints
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/detailed

# Check Docker container status
docker compose ps
```

### 7. Smoke Tests (5 minutes)

```bash
# Run smoke tests against production
API_BASE_URL=https://erp.cypher.ro/api/v1 npm run test -- tests/smoke/ApiSmokeTests.ts

# Check results
# All tests should pass
```

---

## Post-Deployment Verification

### Critical Path (First 15 minutes)

- [ ] Health endpoints responding with 200 OK
- [ ] Database connectivity verified
- [ ] Redis connection verified
- [ ] RabbitMQ connection verified
- [ ] Application version matches release
- [ ] No error spikes in logs
- [ ] Error rate below threshold (<0.5%)

### Functional Verification (15-30 minutes)

- [ ] User login working
- [ ] Products loading correctly
- [ ] Cart functionality working
- [ ] Order creation working
- [ ] Settings persistence working
- [ ] API endpoints responding
- [ ] WebSocket connections (if applicable)

### Performance Verification (30-60 minutes)

- [ ] API response times within SLA
  - [ ] P95 latency < 500ms
  - [ ] P99 latency < 1000ms
- [ ] Database query performance stable
- [ ] Memory usage within limits
- [ ] CPU usage normal
- [ ] No memory leaks detected

### Business Verification (1-2 hours)

- [ ] B2B clients can log in
- [ ] Orders processing correctly
- [ ] Invoice generation working
- [ ] SmartBill integration working
- [ ] WooCommerce sync working
- [ ] Email notifications working

### Monitoring Verification (Continuous for 24 hours)

- [ ] Metrics collection active
- [ ] Alerts configured correctly
- [ ] Dashboards displaying correctly
- [ ] Log aggregation working
- [ ] Error tracking active (Sentry/other)

---

## Rollback Procedures

### When to Rollback

Initiate rollback immediately if any of the following occur:

1. **Critical issues:**
   - Application completely unavailable
   - Data corruption detected
   - Security vulnerability exploited
   - Database migration failed

2. **Performance issues:**
   - P99 latency > 5 seconds for 5+ minutes
   - Error rate > 5% for 5+ minutes
   - Database connection pool exhausted

3. **Functional issues:**
   - Core functionality broken (login, checkout)
   - Data loss detected
   - Payment processing failures

### Automated Rollback

The CI/CD pipeline includes automatic rollback triggers:

```yaml
triggers:
  - smoke_test_failure
  - error_rate_threshold_exceeded
  - performance_degradation
  - health_check_failure
```

### Manual Rollback

If you need to manually rollback:

```bash
# Quick rollback to previous version
./scripts/rollback.sh --force

# Rollback to specific version
./scripts/rollback.sh --version v0.9.0

# Rollback to specific commit
./scripts/rollback.sh --commit <commit-hash>

# Rollback without database changes
./scripts/rollback.sh --skip-db
```

### Rollback Checklist

- [ ] Decision made to rollback
- [ ] Rollback command executed
- [ ] Health checks passing on previous version
- [ ] Database integrity verified
- [ ] Data consistency checked
- [ ] Stakeholders notified
- [ ] Incident report created
- [ ] Root cause analysis initiated

### Rollback Verification

After rollback, verify:

```bash
# Check version
curl http://localhost:3000/health/detailed | jq '.checks.system'

# Check health endpoints
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready

# Run smoke tests
npm run test:smoke

# Verify database integrity
docker compose exec db psql -U cypher_user -d cypher_erp -c "SELECT COUNT(*) FROM users;"
```

### Rollback Communication Template

```
SUBJECT: Production Rollback - Cypher ERP

Dear Team,

A production rollback has been initiated for Cypher ERP.

Details:
- Time: [TIMESTAMP]
- Version Rolled Back From: [VERSION]
- Version Rolled Back To: [VERSION]
- Reason: [REASON]
- Rollback Initiated By: [NAME]

Current Status:
- [ ] Rollback In Progress
- [ ] Rollback Complete
- [ ] Services Recovered
- [ ] Verification Complete

Next Steps:
- Root cause analysis in progress
- ETA for fix deployment: [TIME]

Contact: [NAME] - [PHONE/EMAIL]
```

---

## Emergency Contacts

### On-Call Rotation

| Role | Name | Phone | Email |
|------|------|-------|-------|
| DevOps Lead | TBD | TBD | devops@cypher.ro |
| Backend Lead | TBD | TBD | backend@cypher.ro |
| Frontend Lead | TBD | TBD | frontend@cypher.ro |
| Database Admin | TBD | TBD | dba@cypher.ro |

### Escalation Path

1. **Level 1 (Immediate):** DevOps on-call
2. **Level 2 (30 min):** Engineering Manager
3. **Level 3 (1 hour):** CTO
4. **Level 4 (Critical):** CEO

### Communication Channels

- **Primary:** Slack #deployments
- **Secondary:** Email distribution list
- **Emergency:** Phone call chain

---

## Release Notes Template

```markdown
# Release [VERSION] - [DATE]

## Summary

[Brief description of the release]

## What's New

- [Feature 1]
- [Feature 2]
- [Feature 3]

## Improvements

- [Improvement 1]
- [Improvement 2]

## Bug Fixes

- [Bug fix 1]
- [Bug fix 2]

## Breaking Changes

> WARNING: This release includes breaking changes

- [Breaking change 1]
- [Breaking change 2]

## Migration Notes

[Instructions for migrating from previous version]

## Known Issues

- [Known issue 1]
- [Known issue 2]

## Database Changes

- [Migration 1]
- [Migration 2]

## API Changes

### New Endpoints

- `POST /api/v1/endpoint` - Description

### Modified Endpoints

- `GET /api/v1/endpoint` - Changed field X

### Deprecated Endpoints

- `GET /api/v1/old-endpoint` - Will be removed in version X.Y.Z

## Configuration Changes

- `NEW_ENV_VAR` - Description
- `UPDATED_ENV_VAR` - Description

## Testing

- Unit tests: [PASS/FAIL]
- Integration tests: [PASS/FAIL]
- Smoke tests: [PASS/FAIL]
- Performance tests: [PASS/FAIL]

## Upgrade Instructions

[Step-by-step upgrade instructions]

## Rollback Instructions

[Rollback procedure if issues occur]

## Contributors

- [Name]
- [Name]

## Related Issues

- #[Issue Number]
- #[Issue Number]
```

---

## Appendix

### Useful Commands

```bash
# Check deployment status
docker compose ps

# View logs
docker compose logs -f app

# Check health
curl http://localhost:3000/health/detailed | jq

# Database backup
docker compose exec db pg_dump -U cypher_user cypher_erp > backup.sql

# Database restore
docker compose exec -T db psql -U cypher_user cypher_erp < backup.sql

# View recent migrations
npm run migration:show

# Run smoke tests
npm run test:smoke

# Check container resource usage
docker stats
```

### Monitoring Endpoints

- Health: http://localhost:3000/health/live
- Readiness: http://localhost:3000/health/ready
- Detailed: http://localhost:3000/health/detailed
- Metrics: http://localhost:3000/metrics

### External Monitoring

- Prometheus: http://monitoring.cypher.ro:9090
- Grafana: http://monitoring.cypher.ro:3000
- RabbitMQ Management: http://monitoring.cypher.ro:15672

---

## Change Log

| Date | Version | Changed By | Description |
|------|---------|------------|-------------|
| 2026-02-13 | 1.0 | Claude | Initial release checklist |
