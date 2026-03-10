#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env"
fi

required_vars=(
  INNPRO_IOF_GATEWAY_URL
  INNPRO_IOF_TOKEN
  INNPRO_B2B_LOGIN
  INNPRO_B2B_PASSWORD
  INNPRO_DEFAULT_MARKUP
)

missing=()
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    missing+=("${var_name}")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'ERROR: missing required env vars for Innpro smoke: %s\n' "${missing[*]}"
  printf 'Hint: define them in .env based on .env.example\n'
  exit 1
fi

printf '[1/4] Innpro env contract: OK\n'

if [[ "${INNPRO_IOF_GATEWAY_URL}" != https://* && "${INNPRO_IOF_GATEWAY_URL}" != http://* ]]; then
  printf 'ERROR: INNPRO_IOF_GATEWAY_URL must be an HTTP(S) URL\n'
  exit 1
fi

if ! [[ "${INNPRO_DEFAULT_MARKUP}" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  printf 'ERROR: INNPRO_DEFAULT_MARKUP must be numeric\n'
  exit 1
fi

printf '[2/4] Innpro config shape: OK\n'

health_url="${API_BASE_URL:-http://localhost:3000/health}"
if curl -fsS "${health_url}" >/dev/null; then
  printf '[3/4] API health check (%s): OK\n' "${health_url}"
else
  printf 'ERROR: API health check failed at %s\n' "${health_url}"
  exit 1
fi

printf '[4/4] Smoke preconditions satisfied. Ready for Innpro sync run.\n'
printf 'PASS\n'
