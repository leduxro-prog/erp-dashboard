#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
CURL_FLAGS=(--silent --show-error --location)

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  printf 'FAIL seo smoke -> python3 or python is required for body previews\n'
  exit 1
fi

if [[ "${ALLOW_INSECURE:-0}" == "1" ]]; then
  CURL_FLAGS+=(--insecure)
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

auth_args=()
if [[ -n "$AUTH_TOKEN" ]]; then
  auth_args+=(--header "Authorization: Bearer $AUTH_TOKEN")
fi

request() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_statuses="$4"
  local body="${5:-}"

  local body_file="$tmp_dir/body.$RANDOM"
  local headers_file="$tmp_dir/headers.$RANDOM"
  local curl_args=("${CURL_FLAGS[@]}" --request "$method" --dump-header "$headers_file" --output "$body_file" --write-out '%{http_code}')

  if [[ -n "$body" ]]; then
    curl_args+=(--header 'Content-Type: application/json' --data "$body")
  fi

  if [[ ${#auth_args[@]} -gt 0 ]]; then
    curl_args+=("${auth_args[@]}")
  fi

  local status
  status="$(curl "${curl_args[@]}" "$BASE_URL$path")"

  local matched=0
  IFS='|' read -r -a allowed_statuses <<< "$expected_statuses"
  for allowed_status in "${allowed_statuses[@]}"; do
    if [[ "$status" == "$allowed_status" ]]; then
      matched=1
      break
    fi
  done

  if [[ "$matched" != "1" ]]; then
    printf 'FAIL %s -> expected %s got %s\n' "$name" "$expected_statuses" "$status"
    printf 'Path: %s\n' "$path"
    printf 'Body preview:\n'
    "$PYTHON_BIN" - <<'PY' "$body_file"
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
print(path.read_text(errors='replace')[:800])
PY
    exit 1
  fi

  printf 'PASS %s -> %s\n' "$name" "$status"
}

request 'public sitemap xml' GET '/api/v1/seo/sitemap.xml' '200'
request 'public robots txt' GET '/api/v1/seo/robots.txt' '200'
request 'public audit summary' GET '/api/v1/seo/audits/summary' '200'
request 'public sitemap status' GET '/api/v1/seo/sitemap/status' '200'
request 'public structured data templates' GET '/api/v1/seo/structured-data/templates' '200'
request \
  'sitemap config update route presence' \
  PUT \
  '/api/v1/seo/sitemap/config' \
  '200|401|403' \
  '{"autoRegenerate":true,"regenerateFrequency":"daily","changeFrequency":"daily"}'
