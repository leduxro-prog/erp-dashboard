# Host Hardening Runbook (K8s Cutover)

Use this runbook after moving ERP traffic to Kubernetes ingress.

## Apply From Repository

```bash
sudo bash orchestration/k8s/install-host-services.sh
```

This installs host scripts and systemd units from `orchestration/k8s/host/` and enables required timers/services.

## Goals

- Keep only `80/443/22` publicly reachable for ERP host traffic.
- Block direct access to ingress NodePorts and non-ERP published ports.
- Ensure controls survive service and host restarts.

## Network Controls Applied

- UFW denies for:
  - `30617/tcp` (ingress HTTP NodePort)
  - `31013/tcp` (ingress HTTPS NodePort)
  - `5678/tcp` (n8n)
  - `8011/tcp` (private-gpt)
- Docker-level block (DOCKER-USER chain) for `5678,8011`.
- INPUT-chain block on `eth0` for `5678,8011,30617,31013`.

## Persistent Enforcement Service

- Script: `/usr/local/sbin/docker-port-hardening.sh`
- Unit: `/etc/systemd/system/docker-port-hardening.service`

Verify:

```bash
systemctl is-enabled docker-port-hardening.service
systemctl is-active docker-port-hardening.service
iptables -L INPUT -n -v --line-numbers | head -n 20
iptables -L DOCKER-USER -n -v --line-numbers
```

## Disable Legacy Runtime Paths

- Legacy compose autostart disabled:

```bash
systemctl is-enabled cypher-erp.service
```

Expected: `disabled`.

- Swarm disabled:

```bash
docker info --format '{{.Swarm.LocalNodeState}}'
```

Expected: `inactive`.

## Backup Automation

- Script: `/usr/local/sbin/cypher-k8s-backup.sh`
- Timer: `/etc/systemd/system/cypher-k8s-backup.timer`
- Schedule: daily at `03:15 UTC`

Verify:

```bash
systemctl list-timers --all | grep cypher-k8s-backup
ls -lh /root/backups/cypher_k8s_*.sql.gz
```

## Continuous Launch Readiness

- Script: `orchestration/k8s/launch-readiness-check.sh`
- Unit: `/etc/systemd/system/cypher-launch-readiness.service`
- Timer: `/etc/systemd/system/cypher-launch-readiness.timer`
- Optional env file: `/etc/default/cypher-launch-readiness`
- Schedule: every 15 minutes

Verify:

```bash
systemctl is-enabled cypher-launch-readiness.timer
systemctl is-active cypher-launch-readiness.timer
systemctl list-timers --all | grep cypher-launch-readiness
```

To enable authenticated smoke in periodic checks, set `ADMIN_EMAIL` and `ADMIN_PASSWORD`
in `/etc/default/cypher-launch-readiness` (600 permissions).
You can also tune projection queue guardrails with:

- `PROJECTION_STALE_THRESHOLD_SECONDS`
- `PROJECTION_QUEUE_MAX`
- `PROJECTION_FAILED_MAX`

Authentication behavior controls:

- `AUTH_SMOKE_REQUIRED` (`false` by default)
- `AUTH_LOGIN_RETRIES` (default `3`)
- `AUTH_LOGIN_RETRY_DELAY_SEC` (default `2`)

Readiness also fails if legacy ERP containers are running (configurable via
`LEGACY_CONTAINER_REGEX`).

## Post-Change Health Checks

```bash
curl -fsS https://erp.ledux.ro/health
curl -fsS https://erp.ledux.ro/api/v1/health
curl -fsS -I https://b2b.ledux.ro/
kubectl get pods -n cypher
```
