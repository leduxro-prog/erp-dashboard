# Kubernetes Staging Rollout Checklist

## 1. Preflight

```bash
kubectl cluster-info
kubectl get nodes
kubectl get ingressclass
```

## 2. Prepare Secrets

```bash
cp orchestration/k8s/overlays/staging/app-secret.staging.example.yaml \
  orchestration/k8s/overlays/staging/app-secret.staging.yaml
# fill real values, then apply
kubectl apply -f orchestration/k8s/overlays/staging/app-secret.staging.yaml
```

## 3. Render and Apply

```bash
kubectl kustomize orchestration/k8s/overlays/staging >/tmp/cypher-k8s-staging.yaml
kubectl apply -k orchestration/k8s/overlays/staging
```

## 4. Bootstrap DB Schema (Idempotent)

```bash
bash orchestration/k8s/bootstrap-db-schema.sh
```

## 5. Seed/Reset Staging Admin (Optional but Recommended)

```bash
ADMIN_EMAIL=admin@ledux.ro \
ADMIN_PASSWORD='ChangeMeNow-Strong-Password' \
bash orchestration/k8s/seed-admin-user.sh
```

Rotate the password immediately after smoke if this account is shared.

## 6. Rollout Gates

```bash
kubectl rollout status deployment/cypher-app -n cypher --timeout=180s
kubectl rollout status deployment/cypher-frontend -n cypher --timeout=180s
kubectl get pods -n cypher -o wide
kubectl get ingress -n cypher
```

## 7. Health Checks

```bash
curl -fsS https://staging-erp.example.com/health
curl -fsS https://staging-erp.example.com/api/v1/health
```

## 8. API Smoke

Use a valid bearer token for state-changing requests to pass CSRF checks.

```bash
curl -fsS -H "Authorization: Bearer <token>" https://staging-erp.example.com/api/v1/users
curl -fsS https://staging-erp.example.com/api/v1/settings
curl -fsS -H "Authorization: Bearer <token>" "https://staging-erp.example.com/api/v1/orders?page=1&limit=5"
curl -fsS -H "Authorization: Bearer <token>" "https://staging-erp.example.com/api/v1/inventory/products?page=1&limit=5"
curl -fsS -H "Authorization: Bearer <token>" "https://staging-erp.example.com/api/v1/suppliers/suppliers?limit=5&offset=0"
```

## 9. Rollback Drill

```bash
kubectl set image deployment/cypher-app app=ghcr.io/your-org/cypher-erp-app:does-not-exist -n cypher
kubectl rollout status deployment/cypher-app -n cypher --timeout=90s || true
kubectl rollout undo deployment/cypher-app -n cypher
kubectl rollout status deployment/cypher-app -n cypher --timeout=180s
```
