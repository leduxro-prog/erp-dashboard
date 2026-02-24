# Kubernetes Canary and Cutover Runbook

## Scope

Canary rollout for stateless services (`cypher-app`, `cypher-frontend`) with fast rollback.

## Prerequisites

- Metrics server + ingress controller installed.
- Secrets applied (`cypher-app-secrets`).
- Images pushed for target release.
- Staging overlay configured (`orchestration/k8s/overlays/staging/*`).

## Canary Flow

1. Deploy baseline

```bash
kubectl apply -k orchestration/k8s/overlays/staging
kubectl rollout status deployment/cypher-app -n cypher --timeout=180s
kubectl rollout status deployment/cypher-frontend -n cypher --timeout=180s
kubectl get pods -n cypher
```

2. Create canary deployment (same manifest with `-canary` name) at 10% traffic equivalent.
- If using NGINX ingress canary annotations, route header/cookie-based first.
- If using service mesh, split traffic 90/10.

3. Observe for 30-60 minutes
- 5xx rate
- p95 latency
- pod restarts
- DB connection pressure
- smoke probes:

```bash
curl -fsS https://staging-erp.example.com/health
curl -fsS -H "Authorization: Bearer <token>" "https://staging-erp.example.com/api/v1/orders?page=1&limit=5"
curl -fsS -H "Authorization: Bearer <token>" "https://staging-erp.example.com/api/v1/suppliers/suppliers?limit=5&offset=0"
```

4. Promote to 50% then 100%
- Step up only when SLO is green at each stage.

## Rollback

```bash
kubectl rollout undo deployment/cypher-app -n cypher
kubectl rollout undo deployment/cypher-frontend -n cypher
kubectl rollout status deployment/cypher-app -n cypher --timeout=180s
kubectl rollout status deployment/cypher-frontend -n cypher --timeout=180s
```

## Production Cutover Notes

- Freeze schema changes during cutover window unless migration is pre-validated.
- Keep previous image tag pinned for immediate rollback.
- Execute post-cutover smoke on login, inventory, orders, and settings endpoints.
