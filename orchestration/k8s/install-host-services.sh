#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST_DIR="$ROOT_DIR/orchestration/k8s/host"

install -m 0755 "$HOST_DIR/scripts/docker-port-hardening.sh" /usr/local/sbin/docker-port-hardening.sh
install -m 0755 "$HOST_DIR/scripts/cypher-k8s-backup.sh" /usr/local/sbin/cypher-k8s-backup.sh
install -m 0755 "$HOST_DIR/scripts/cypher-k8s-restore-drill.sh" /usr/local/sbin/cypher-k8s-restore-drill.sh

install -m 0644 "$HOST_DIR/systemd/docker-port-hardening.service" /etc/systemd/system/docker-port-hardening.service
install -m 0644 "$HOST_DIR/systemd/cypher-k8s-backup.service" /etc/systemd/system/cypher-k8s-backup.service
install -m 0644 "$HOST_DIR/systemd/cypher-k8s-backup.timer" /etc/systemd/system/cypher-k8s-backup.timer
install -m 0644 "$HOST_DIR/systemd/cypher-k8s-restore-drill.service" /etc/systemd/system/cypher-k8s-restore-drill.service
install -m 0644 "$HOST_DIR/systemd/cypher-k8s-restore-drill.timer" /etc/systemd/system/cypher-k8s-restore-drill.timer
install -m 0644 "$HOST_DIR/systemd/cypher-launch-readiness.service" /etc/systemd/system/cypher-launch-readiness.service
install -m 0644 "$HOST_DIR/systemd/cypher-launch-readiness.timer" /etc/systemd/system/cypher-launch-readiness.timer
install -m 0644 "$HOST_DIR/systemd/cypher-go-live-gate.service" /etc/systemd/system/cypher-go-live-gate.service
install -m 0644 "$HOST_DIR/systemd/cypher-go-live-gate.timer" /etc/systemd/system/cypher-go-live-gate.timer

if [[ ! -f /etc/default/cypher-launch-readiness ]]; then
  install -m 0600 "$HOST_DIR/env/cypher-launch-readiness.example" /etc/default/cypher-launch-readiness
fi

if [[ ! -f /etc/default/cypher-k8s-backup ]]; then
  install -m 0600 "$HOST_DIR/env/cypher-k8s-backup.example" /etc/default/cypher-k8s-backup
fi

if [[ ! -f /etc/default/cypher-k8s-restore-drill ]]; then
  install -m 0600 "$HOST_DIR/env/cypher-k8s-restore-drill.example" /etc/default/cypher-k8s-restore-drill
fi

if [[ ! -f /etc/default/cypher-go-live-gate ]]; then
  install -m 0600 "$HOST_DIR/env/cypher-go-live-gate.example" /etc/default/cypher-go-live-gate
fi

systemctl daemon-reload
systemctl enable --now docker-port-hardening.service
systemctl enable --now cypher-k8s-backup.timer
systemctl enable --now cypher-k8s-restore-drill.timer
systemctl enable --now cypher-launch-readiness.timer
systemctl enable --now cypher-go-live-gate.timer

echo "Host services installed and enabled."
