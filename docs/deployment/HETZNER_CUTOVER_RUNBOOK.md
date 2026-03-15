# Hetzner Domain Cutover Runbook

**Status:** PREPARED - DO NOT EXECUTE until all product implementation is confirmed complete.

**Estimated cutover time:** < 30 minutes
**Rollback time:** < 10 minutes

---

## Table of Contents

1. [Pre-Cutover Checks](#1-pre-cutover-checks)
2. [DNS Switch Plan](#2-dns-switch-plan)
3. [TLS Plan](#3-tls-plan)
4. [Validation Matrix](#4-validation-matrix)
5. [Rollback Plan](#5-rollback-plan)
6. [Post-Cutover Monitoring](#6-post-cutover-monitoring)

---

## 1. Pre-Cutover Checks

Run ALL of these before starting the cutover. Every check must pass.

### 1.1 CI/CD Green

```bash
# Run full CI check
npm run ci:green

# Expected: zero errors, all tests pass
```

### 1.2 Database Backup

```bash
# SSH to Hetzner
ssh -i ~/.ssh/hetzner_deploy root@<HETZNER_IP>

# Create timestamped backup
cd /opt/cypher-erp
docker compose exec -T db pg_dump \
  -U $(grep DB_USER .env | cut -d= -f2) \
  $(grep DB_NAME .env | cut -d= -f2) \
  | gzip > /root/backups/cypher-pre-cutover-$(date +%Y%m%d%H%M%S).sql.gz

# Verify backup is non-empty
ls -lh /root/backups/cypher-pre-cutover-*.sql.gz
```

### 1.3 Health Endpoints

```bash
# From Hetzner server (current IP-based access)
curl -sf http://localhost:3000/health | jq .
curl -sf http://localhost/api/v1/health | jq .

# Both must return HTTP 200 with { "status": "ok" }
```

### 1.4 Queue Health (RabbitMQ)

```bash
# Check RabbitMQ is running and queues are empty/low
docker exec cypher-rabbitmq rabbitmqctl list_queues name messages consumers

# No queue should have stuck messages
```

### 1.5 Smoke Scripts

```bash
# Run from repo root
./scripts/smoke-hetzner.sh
./scripts/smoke-domain-ready.sh

# Both must exit 0
```

---

## 2. DNS Switch Plan

### 2.1 Lower TTL (Do 24-48 hours before cutover)

In your DNS provider (e.g. Cloudflare, Route53, Hetzner DNS):

| Record         | Current TTL | Set To  |
| -------------- | ----------- | ------- |
| `ledux.ro`     | 3600        | **300** |
| `www.ledux.ro` | 3600        | **300** |
| `api.ledux.ro` | 3600        | **300** |
| `erp.ledux.ro` | 3600        | **300** |

### 2.2 Create/Update A Records

At cutover time, update A records to Hetzner IP:

```
ledux.ro          A    <HETZNER_IP>
www.ledux.ro      A    <HETZNER_IP>    (or CNAME -> ledux.ro)
api.ledux.ro      A    <HETZNER_IP>
erp.ledux.ro      A    <HETZNER_IP>
```

### 2.3 DNS Propagation Verification

```bash
# Check propagation (run from your local machine)
dig +short ledux.ro A
dig +short api.ledux.ro A
dig +short erp.ledux.ro A

# All should resolve to <HETZNER_IP>

# Use external propagation checker
# https://www.whatsmydns.net/#A/ledux.ro
```

### 2.4 Verification Window

Wait **5 minutes** after DNS change, then verify:

```bash
curl -sf https://ledux.ro/ | head -5
curl -sf https://api.ledux.ro/health | jq .
```

---

## 3. TLS Plan

### 3.1 Install Certbot (if not already)

```bash
ssh -i ~/.ssh/hetzner_deploy root@<HETZNER_IP>

apt-get update && apt-get install -y certbot python3-certbot-nginx
```

### 3.2 Issue Certificates

```bash
# Stop nginx temporarily (if port 80 conflict with Docker)
docker compose stop frontend

# Issue cert for all domains
certbot certonly --standalone \
  -d ledux.ro \
  -d www.ledux.ro \
  -d api.ledux.ro \
  -d erp.ledux.ro \
  --non-interactive \
  --agree-tos \
  --email admin@ledux.ro

# Restart frontend
docker compose start frontend
```

### 3.3 Configure Nginx for TLS

Update `frontend/nginx.conf` to include:

```nginx
server {
    listen 443 ssl;
    server_name ledux.ro www.ledux.ro api.ledux.ro erp.ledux.ro;

    ssl_certificate     /etc/letsencrypt/live/ledux.ro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ledux.ro/privkey.pem;

    # ... existing location blocks ...
}

server {
    listen 80;
    server_name ledux.ro www.ledux.ro api.ledux.ro erp.ledux.ro;
    return 301 https://$host$request_uri;
}
```

### 3.4 Cert Renewal

```bash
# Test auto-renewal
certbot renew --dry-run

# Add cron job
echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/cypher-erp/docker-compose.yml restart frontend" \
  | crontab -
```

### 3.5 Validate TLS

```bash
# Check cert validity
echo | openssl s_client -connect ledux.ro:443 -servername ledux.ro 2>/dev/null | openssl x509 -noout -dates

# Check HTTPS works
curl -sf https://ledux.ro/ -o /dev/null -w "%{http_code}\n"
curl -sf https://api.ledux.ro/health -o /dev/null -w "%{http_code}\n"
```

---

## 4. Validation Matrix

After DNS propagation and TLS are confirmed, run this complete validation:

| #   | Check                       | URL / Action                                         | Expected                    | Status |
| --- | --------------------------- | ---------------------------------------------------- | --------------------------- | ------ |
| 1   | Backend health              | `GET https://api.ledux.ro/health`                    | 200, `{"status":"ok"}`      | [ ]    |
| 2   | API v1 health               | `GET https://api.ledux.ro/api/v1/health`             | 200                         | [ ]    |
| 3   | Frontend loads              | `GET https://ledux.ro/`                              | 200, HTML with React bundle | [ ]    |
| 4   | ERP login                   | POST `/api/v1/users/login` with valid creds          | 200, JWT returned           | [ ]    |
| 5   | ERP auth - protected route  | GET `/api/v1/users/me` with JWT                      | 200, user object            | [ ]    |
| 6   | B2B login                   | POST `/api/v1/b2b-auth/login` with B2B creds         | 200, B2B JWT returned       | [ ]    |
| 7   | B2B products                | GET `/api/v1/b2b/products/filters`                   | 200                         | [ ]    |
| 8   | B2B categories              | GET `/api/v1/b2b/products/categories`                | 200                         | [ ]    |
| 9   | Forgot password (ERP)       | POST `/api/v1/users/forgot-password`                 | 200 (email queued)          | [ ]    |
| 10  | Reset password (ERP)        | POST `/api/v1/users/reset-password` with valid token | 200                         | [ ]    |
| 11  | SmartBill sync              | Trigger manual sync or check last sync timestamp     | No errors in logs           | [ ]    |
| 12  | Brand Manager - list brands | GET `/api/v1/brands`                                 | 200, array                  | [ ]    |
| 13  | Brand Manager - CRUD        | Create/update/delete a test brand                    | All return 2xx              | [ ]    |
| 14  | CORS - domain origin        | Request from https://ledux.ro to api.ledux.ro        | No CORS errors              | [ ]    |
| 15  | Cookies - secure            | Login and check Set-Cookie header                    | Secure; Domain=.ledux.ro    | [ ]    |

---

## 5. Rollback Plan

If anything fails during cutover, execute immediately:

### 5.1 DNS Rollback

Revert A records to the previous IP (save the old IP before cutover!):

```
Previous IP: ____________ (FILL IN BEFORE CUTOVER)
```

```bash
# In DNS provider, set all A records back to previous IP
# ledux.ro        A  <PREVIOUS_IP>
# api.ledux.ro    A  <PREVIOUS_IP>
# erp.ledux.ro    A  <PREVIOUS_IP>
# www.ledux.ro    A  <PREVIOUS_IP>
```

### 5.2 Container Rollback (if containers are broken)

```bash
ssh -i ~/.ssh/hetzner_deploy root@<HETZNER_IP>
cd /opt/cypher-erp

# Restore from backup image
docker compose down app frontend
docker compose up -d app frontend

# If DB was migrated and needs rollback:
gunzip -c /root/backups/cypher-pre-cutover-<TIMESTAMP>.sql.gz | \
  docker compose exec -T db psql -U $(grep DB_USER .env | cut -d= -f2) $(grep DB_NAME .env | cut -d= -f2)
```

### 5.3 Verification After Rollback

```bash
# Verify old access path still works
curl -sf http://<HETZNER_IP>:3000/health
curl -sf http://<HETZNER_IP>/api/v1/health

# Run smoke tests
./scripts/smoke-hetzner.sh
```

---

## 6. Post-Cutover Monitoring

After successful cutover, monitor for 24 hours:

### 6.1 Immediate (First 30 minutes)

- [ ] All validation matrix checks pass
- [ ] No 5xx errors in `docker logs cypher-erp-app --tail 100`
- [ ] No CORS errors in browser console
- [ ] Login/logout works for both ERP and B2B
- [ ] SmartBill sync runs without errors

### 6.2 First 4 Hours

- [ ] Check error rate in logs: `docker logs cypher-erp-app --since 4h | grep -c ERROR`
- [ ] Memory usage stable: `docker stats --no-stream`
- [ ] DB connections stable: `docker compose exec db psql -U cypher_user -c "SELECT count(*) FROM pg_stat_activity"`

### 6.3 24-Hour Follow-up

- [ ] Raise DNS TTL back to 3600
- [ ] Confirm cert auto-renewal cron is working
- [ ] Remove old infrastructure if applicable
- [ ] Update team documentation with new URLs

---

## Appendix: Environment Variables to Update at Cutover

Update `.env` on Hetzner server:

```bash
APP_URL=https://api.ledux.ro
FRONTEND_URL=https://ledux.ro
PUBLIC_BASE_URL=https://api.ledux.ro
COOKIE_DOMAIN=.ledux.ro
COOKIE_SECURE=true
CORS_ORIGINS=https://ledux.ro,https://www.ledux.ro,https://erp.ledux.ro,https://api.ledux.ro
```

Then restart app:

```bash
docker compose restart app frontend
```
