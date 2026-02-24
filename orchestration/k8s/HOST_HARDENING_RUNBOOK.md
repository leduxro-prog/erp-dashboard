# Host Hardening Runbook (K8s Cutover)

Use this runbook after moving ERP traffic to Kubernetes ingress.

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

## Post-Change Health Checks

```bash
curl -fsS https://erp.ledux.ro/health
curl -fsS https://erp.ledux.ro/api/v1/health
curl -fsS -I https://b2b.ledux.ro/
kubectl get pods -n cypher
```
