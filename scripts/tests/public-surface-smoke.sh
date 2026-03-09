#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CURL_FLAGS=(--silent --show-error --location)

if [[ "${ALLOW_INSECURE:-0}" == "1" ]]; then
  CURL_FLAGS+=(--insecure)
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

request() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_statuses="$4"
  local body="${5:-}"
  local require_rate_limit_header="${6:-0}"

  local body_file="$tmp_dir/body.$$"
  local headers_file="$tmp_dir/headers.$$"

  local curl_args=("${CURL_FLAGS[@]}" --request "$method" --dump-header "$headers_file" --output "$body_file" --write-out '%{http_code}')

  if [[ -n "$body" ]]; then
    curl_args+=(--header 'Content-Type: application/json' --data "$body")
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
    printf 'Body:\n'
    sed -n '1,40p' "$body_file"
    exit 1
  fi

  if [[ "$require_rate_limit_header" == "1" ]]; then
    if ! grep -qi '^ratelimit-limit:' "$headers_file"; then
      printf 'FAIL %s -> missing RateLimit header\n' "$name"
      printf 'Path: %s\n' "$path"
      exit 1
    fi
  fi

  printf 'PASS %s -> %s\n' "$name" "$status"
}

request 'users list private' GET '/api/v1/users' '401|403'
request 'orders list private' GET '/api/v1/orders' '401|403'
request 'inventory stock private' GET '/api/v1/inventory/stock' '401|403'
request 'smartbill invoices private' POST '/api/v1/smartbill/invoices' '401|403' '{}'
request 'meta ads status private' GET '/api/v1/meta-ads/status' '401|403'
request 'public settings readable' GET '/api/v1/settings' 200 '' 1
request 'private settings private' GET '/api/v1/settings/private' '401|403'
request 'public b2b catalog readable' GET '/api/v1/b2b/products?limit=1' 200 '' 1
request 'b2b document preview private' GET '/api/v1/b2b/documents/preview?url=https%3A%2F%2Fexample.com%2Fspec.pdf' '401|403'
request 'public seo audit summary' GET '/api/v1/seo/audits/summary' '200'
request 'public seo sitemap status' GET '/api/v1/seo/sitemap/status' '200'
request 'public seo structured data templates' GET '/api/v1/seo/structured-data/templates' '200'
request 'public seo structured data payload' GET '/api/v1/seo/structured-data/123' '200'
