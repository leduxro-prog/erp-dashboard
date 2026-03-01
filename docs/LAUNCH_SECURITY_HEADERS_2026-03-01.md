# Launch Security Headers Validation - 2026-03-01

## Scope

Validation for Nginx hardening in `frontend/nginx.conf` with Google Auth preserved.

## Applied Controls

- `server_tokens off`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- CSP tightened for script execution (no `'unsafe-inline'` in `script-src`)
- Google domains preserved in CSP (`https://accounts.google.com`, `https://apis.google.com`)

## Verification Commands and Results

### 1) Header verification

Command:

```bash
curl -sI https://erp.ledux.ro -k | grep -Ei "content-security-policy|strict-transport-security|cross-origin-opener-policy|cross-origin-embedder-policy|server"
```

Observed:

- `Server: nginx`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Content-Security-Policy` contains `script-src 'self' ... https://accounts.google.com https://apis.google.com` with nonce and **without** `'unsafe-inline'`.

### 2) Config syntax validation

Command:

```bash
docker run --rm --add-host app:127.0.0.1 -v "/root/.config/superpowers/worktrees/cypher-erp/pr1-backlog-cleanup/frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
```

Result: `syntax is ok` and `test is successful`.

### 3) Controlled rollout checks

Commands:

```bash
docker compose --env-file /opt/cypher-erp/.env -p cypher-erp up -d app
docker compose --env-file /opt/cypher-erp/.env -p cypher-erp up -d frontend
curl -sS -k https://65.108.255.104/health
```

Result: health endpoint returned `200` post-rollout.

### 4) API smoke spot-check (post rollout)

Command:

```bash
API_BASE_URL="http://65.108.255.104/api/v1" npx jest tests/smoke/ApiSmokeTests.ts --runInBand
```

Result: `32/32 PASS`.

## Decision

- Header hardening: **PASS**
- Google Auth CSP domains retained: **PASS**
- Post-deploy health: **PASS**
- API smoke regression check: **PASS**

Status: **GO (security header scope)**
