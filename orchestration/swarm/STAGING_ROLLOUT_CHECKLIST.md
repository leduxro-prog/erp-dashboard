# Swarm Staging Rollout Checklist

## 1. Prepare

```bash
docker swarm init
export STACK_NAME=cypher-staging
export APP_IMAGE=ghcr.io/your-org/cypher-erp-app:<tag>
export FRONTEND_IMAGE=ghcr.io/your-org/cypher-erp-frontend:<tag>
```

## 2. Create Secrets

```bash
ENV_FILE=.env.staging ./orchestration/swarm/prepare-secrets.sh
```

## 3. Deploy

```bash
ENV_FILE=.env.staging STACK_NAME=cypher-staging FRONTEND_PUBLISHED_PORT=18080 ./orchestration/swarm/deploy-stack.sh
```

## 4. Bootstrap DB Schema (fresh volume or first deploy)

```bash
STACK_NAME=cypher-staging ./orchestration/swarm/bootstrap-db-schema.sh
```

## 5. Verify

```bash
docker stack services cypher-staging
docker stack ps cypher-staging
curl -fsS http://<staging-host>:18080/health
curl -fsS http://<staging-host>:18080/api/v1/health
```

## 6. Functional Smoke

- Login API success/failure path.
- Inventory list endpoint latency and pagination.
- Orders listing endpoint (`GET /api/v1/orders?page=1&limit=5`).
- Suppliers listing endpoint (`GET /api/v1/suppliers/suppliers?limit=5&offset=0`).
- Supplier sync trigger endpoint.
- Redis, RabbitMQ, DB connectivity from app logs.
- For `PUT`/`POST` smoke calls via curl, include `Authorization: Bearer <token>` (or valid `Origin`/`Referer`) to pass CSRF checks.

## 7. Rollback Drill

Use `ROLLBACK_DRILL.md` on staging and capture recovery time.
