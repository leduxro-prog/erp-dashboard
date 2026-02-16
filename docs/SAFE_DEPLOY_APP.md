# Safe Backend Deploy (No Compose Network Recreate)

Use this flow when `docker compose up` tries to remove `cypher-erp_cypher-network` and fails with `active endpoints`.

## Command

```bash
cd /opt/cypher-erp
npm run deploy:safe
```

## What it does

1. Builds backend image (`docker compose build app`).
2. Verifies required containers are running (`cypher-erp-db`, `cypher-erp-redis`).
3. Ensures network aliases: `db`, `redis`, `rabbitmq`.
4. Forces Redis policy `maxmemory-policy=noeviction` (runtime hardening).
5. Recreates only `cypher-erp-app` with the new image.
6. Builds a safe `REDIS_URL` override from `REDIS_PASSWORD` (URL-encoded), to avoid fallback-to-localhost parsing issues.
7. Keeps rollback path: if checks fail, restores previous app container automatically.
8. Restarts `cypher-erp-frontend` to refresh Nginx upstream.
9. Runs hard-gate checks:
   - `http://localhost:3000/health`
   - `http://localhost/api/v1/health`
   - `http://localhost/api/v1/b2b/products/filters`
   - `http://localhost/api/v1/b2b/products/categories`

## Notes

- This script intentionally avoids `docker compose up` for runtime replacement because of the network recreation issue.
- If database or redis containers are missing, script stops early instead of creating empty containers/volumes.
