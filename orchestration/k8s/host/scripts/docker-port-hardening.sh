#!/usr/bin/env bash

set -euo pipefail

IFACE="${IFACE:-eth0}"
PORTS="${PORTS:-5678,8011}"
INPUT_PORTS="${INPUT_PORTS:-5678,8011,30617,31013}"

ensure_rule_v4() {
  if ! iptables -C DOCKER-USER -i "$IFACE" -p tcp -m multiport --dports "$PORTS" -j DROP 2>/dev/null; then
    iptables -I DOCKER-USER -i "$IFACE" -p tcp -m multiport --dports "$PORTS" -j DROP
  fi
}

ensure_rule_v6() {
  if ! ip6tables -C DOCKER-USER -i "$IFACE" -p tcp -m multiport --dports "$PORTS" -j DROP 2>/dev/null; then
    ip6tables -I DOCKER-USER -i "$IFACE" -p tcp -m multiport --dports "$PORTS" -j DROP
  fi
}

ensure_input_rule_v4() {
  if ! iptables -C INPUT -i "$IFACE" -p tcp -m multiport --dports "$INPUT_PORTS" -j DROP 2>/dev/null; then
    iptables -I INPUT 1 -i "$IFACE" -p tcp -m multiport --dports "$INPUT_PORTS" -j DROP
  fi
}

ensure_input_rule_v6() {
  if ! ip6tables -C INPUT -i "$IFACE" -p tcp -m multiport --dports "$INPUT_PORTS" -j DROP 2>/dev/null; then
    ip6tables -I INPUT 1 -i "$IFACE" -p tcp -m multiport --dports "$INPUT_PORTS" -j DROP
  fi
}

ensure_rule_v4
ensure_rule_v6
ensure_input_rule_v4
ensure_input_rule_v6
