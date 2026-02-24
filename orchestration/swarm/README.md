# Swarm Deployment Package

This folder provides a Swarm-first deployment path for rapid enterprise hardening.

## Files

- `stack.core.yml` - core services (frontend, app, db, redis, rabbitmq, meilisearch)
- `stack.ai.yml` - optional AI overlay (ai-service, ollama)
- `prepare-secrets.sh` - creates required Docker Swarm secrets from `.env`
- `deploy-stack.sh` - deploys stack and optional AI overlay
- `bootstrap-db-schema.sh` - bootstraps base DB schema + compatibility patches for clean staging volumes
- `prometheus.swarm.yml` - Prometheus scrape config for Swarm tasks/services
- `sql/ensure-notifications-schema.sql` - idempotent notifications schema compatibility patch
- `sql/ensure-users-schema.sql` - idempotent users schema compatibility patch
- `sql/ensure-orders-suppliers-schema.sql` - idempotent orders/suppliers compatibility patch
- `ROLLBACK_DRILL.md` - rollback validation steps
- `STAGING_ROLLOUT_CHECKLIST.md` - staged deployment checklist and smoke tests

## Prerequisites

1. Docker Swarm initialized on target host or cluster:

```bash
docker swarm init
```

2. Production images available on all Swarm nodes:

```bash
export APP_IMAGE=ghcr.io/your-org/cypher-erp-app:latest
export FRONTEND_IMAGE=ghcr.io/your-org/cypher-erp-frontend:latest
export AI_IMAGE=ghcr.io/your-org/cypher-erp-ai-service:latest
```

3. `.env` populated with required values:
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_SECRET_B2B`
- `JWT_REFRESH_SECRET_B2B`
- `REDIS_PASSWORD`
- `RABBITMQ_PASSWORD`
- `MEILI_MASTER_KEY`

## Deploy Core Stack

```bash
./orchestration/swarm/deploy-stack.sh
```

## Deploy Core + AI

```bash
DEPLOY_AI=true ./orchestration/swarm/deploy-stack.sh
```

## Bootstrap DB Schema (Fresh Staging Volume)

```bash
STACK_NAME=cypher-staging ./orchestration/swarm/bootstrap-db-schema.sh
```

## Operational Commands

```bash
docker stack services cypher
docker stack ps cypher
docker service logs -f cypher_app
docker service scale cypher_app=5
docker service scale cypher_frontend=2
```

## Notes

- `depends_on` semantics are not used in Swarm; health checks + restart policies handle recovery.
- Stateful services are pinned to manager node (`replicas: 1`) in this package.
- For multi-node stateful HA, move db/redis/rabbitmq to managed services or dedicated clustered data plane.
