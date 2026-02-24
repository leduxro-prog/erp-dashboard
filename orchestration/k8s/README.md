# Kubernetes Deployment Package

This folder contains a production-oriented baseline for Cypher app/frontend on Kubernetes.

## Included

- Namespace, Deployments, Services, Ingress
- HPA for `cypher-app`
- PDB for app/frontend
- ConfigMap for non-secret runtime config
- Secret template for required secrets
- Staging overlay for host/data-plane/runtime values
- Staging rollout checklist with concrete validation commands

## Apply Order

1. Create real secrets from staging template:

```bash
cp orchestration/k8s/overlays/staging/app-secret.staging.example.yaml \
  orchestration/k8s/overlays/staging/app-secret.staging.yaml
# edit values in app-secret.staging.yaml
kubectl apply -f orchestration/k8s/overlays/staging/app-secret.staging.yaml
```

2. Render and apply staging overlay:

```bash
kubectl kustomize orchestration/k8s/overlays/staging >/tmp/cypher-k8s-staging.yaml
kubectl apply -k orchestration/k8s/overlays/staging
kubectl rollout status deployment/cypher-app -n cypher --timeout=180s
kubectl rollout status deployment/cypher-frontend -n cypher --timeout=180s
```

3. Run idempotent DB compatibility bootstrap:

```bash
bash orchestration/k8s/bootstrap-db-schema.sh
```

4. Seed/reset staging admin for smoke tests (optional):

```bash
ADMIN_EMAIL=admin@ledux.ro \
ADMIN_PASSWORD='ChangeMeNow-Strong-Password' \
bash orchestration/k8s/seed-admin-user.sh
```

## Important

- This package deploys stateless app/frontend only.
- Data plane (`PostgreSQL`, `Redis`, `RabbitMQ`, `Meilisearch`) should be provided as managed services or dedicated HA stateful cluster.
- For quick staging on-cluster data plane, use `overlays/staging/data-plane.yaml` and run the helper scripts above.
- `DB_USERNAME` is explicitly set in ConfigMap to satisfy runtime validation.
- Uploads are mounted on `cypher-uploads-pvc`; ensure your StorageClass supports `ReadWriteMany` or patch this for your environment.
- Update image references before rollout:
  - `ghcr.io/your-org/cypher-erp-app:latest`
  - `ghcr.io/your-org/cypher-erp-frontend:latest`

## Next Hardening

- Add canary strategy (Argo Rollouts or service mesh traffic split).
- Add Prometheus ServiceMonitor and alert rules.
- Add NetworkPolicy per namespace/service.

See `STAGING_ROLLOUT_CHECKLIST.md` for end-to-end staging apply/smoke/rollback.
See `CANARY_CUTOVER_RUNBOOK.md` for phased promotion and rollback flow.
See `HOST_HARDENING_RUNBOOK.md` for post-cutover host firewall/runtime hardening.
Use `launch-readiness-check.sh` for one-command launch verification.
