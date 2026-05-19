#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:8080}"
ERP_WEB_BASE_URL="${ERP_WEB_BASE_URL:-$WEB_BASE_URL}"
B2B_WEB_BASE_URL="${B2B_WEB_BASE_URL:-$WEB_BASE_URL}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
ERP_HOST_HEADER="${ERP_HOST_HEADER:-}"
B2B_HOST_HEADER="${B2B_HOST_HEADER:-}"

CURL_FLAGS=(--silent --show-error --location)
if [[ "${ALLOW_INSECURE:-0}" == "1" ]]; then
  CURL_FLAGS+=(--insecure)
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

pass() {
  printf 'PASS %s\n' "$1"
}

skip() {
  printf 'SKIP %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1"
  exit 1
}

request() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected_statuses="$4"
  local body="${5:-}"
  local host_header="${6:-}"

  local body_file="$tmp_dir/body.$RANDOM"
  local headers_file="$tmp_dir/headers.$RANDOM"
  touch "$body_file" "$headers_file"
  local curl_args=("${CURL_FLAGS[@]}" --request "$method" --dump-header "$headers_file" --output "$body_file" --write-out '%{http_code}')

  if [[ -n "$body" ]]; then
    curl_args+=(--header 'Content-Type: application/json' --data "$body")
  fi

  if [[ -n "$AUTH_TOKEN" ]]; then
    curl_args+=(--header "Authorization: Bearer $AUTH_TOKEN")
  fi

  if [[ -n "$host_header" ]]; then
    curl_args+=(--header "Host: $host_header")
  fi

  local status
  status="$(curl "${curl_args[@]}" "$url" || printf '000')"

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
    printf 'URL: %s\n' "$url"
    python3 - <<'PY' "$body_file"
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
print(path.read_text(errors='replace')[:1200])
PY
    exit 1
  fi

  printf '%s\n%s\n%s\n' "$status" "$headers_file" "$body_file"
}

assert_header_matches() {
  local name="$1"
  local headers_file="$2"
  local pattern="$3"

  python3 - <<'PY' "$name" "$headers_file" "$pattern"
import pathlib
import re
import sys

name = sys.argv[1]
headers = pathlib.Path(sys.argv[2]).read_text(errors='replace')
pattern = sys.argv[3]

if not re.search(pattern, headers, flags=re.IGNORECASE | re.MULTILINE):
    print(f'FAIL {name} -> missing header pattern {pattern}')
    print(headers[:800])
    raise SystemExit(1)

print(f'PASS {name}')
PY
}

assert_body_contains() {
  local name="$1"
  local body_file="$2"
  local needle="$3"

  python3 - <<'PY' "$name" "$body_file" "$needle"
import pathlib
import sys

name = sys.argv[1]
body = pathlib.Path(sys.argv[2]).read_text(errors='replace')
needle = sys.argv[3]

if needle not in body:
    print(f'FAIL {name} -> missing body fragment: {needle}')
    print(body[:1200])
    raise SystemExit(1)

print(f'PASS {name}')
PY
}

assert_body_not_contains() {
  local name="$1"
  local body_file="$2"
  local needle="$3"

  python3 - <<'PY' "$name" "$body_file" "$needle"
import pathlib
import sys

name = sys.argv[1]
body = pathlib.Path(sys.argv[2]).read_text(errors='replace')
needle = sys.argv[3]

if needle in body:
    print(f'FAIL {name} -> unexpected body fragment: {needle}')
    print(body[:1200])
    raise SystemExit(1)

print(f'PASS {name}')
PY
}

assert_body_matches() {
  local name="$1"
  local body_file="$2"
  local pattern="$3"

  python3 - <<'PY' "$name" "$body_file" "$pattern"
import pathlib
import re
import sys

name = sys.argv[1]
body = pathlib.Path(sys.argv[2]).read_text(errors='replace')
pattern = sys.argv[3]

if not re.search(pattern, body, flags=re.IGNORECASE | re.MULTILINE):
    print(f'FAIL {name} -> missing body pattern: {pattern}')
    print(body[:1200])
    raise SystemExit(1)

print(f'PASS {name}')
PY
}

printf 'Launch smoke started at %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mapfile -t health_result < <(request 'health' GET "$API_BASE_URL/health" '200')
assert_header_matches 'health content-type' "${health_result[1]}" '^content-type:.*application/json'
assert_body_contains 'health payload' "${health_result[2]}" 'ok'

mapfile -t settings_result < <(request 'public settings policy' GET "$API_BASE_URL/api/v1/settings" '200')
python3 - <<'PY' "${settings_result[2]}"
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text())
keys = sorted(payload.keys())
expected = ['b2b', 'brandStrategy', 'general']
forbidden = {'integrations', 'notifications', 'security', 'system'}

if keys != expected:
    print(f'FAIL public settings policy -> keys {keys} != {expected}')
    raise SystemExit(1)

if forbidden.intersection(payload.keys()):
    print(f'FAIL public settings policy -> leaked forbidden keys {sorted(forbidden.intersection(payload.keys()))}')
    raise SystemExit(1)

serialized = json.dumps(payload)
for leaked in ('consumerSecret', 'token', 'password', 'secret'):
    if leaked in serialized:
        print(f'FAIL public settings policy -> leaked token-like field {leaked}')
        raise SystemExit(1)

print('PASS public settings policy')
PY

mapfile -t products_result < <(request 'b2b visibility policy request' GET "$API_BASE_URL/api/v1/b2b/products?limit=1" '200|401|403|404')
python3 - <<'PY' "${settings_result[2]}" "${products_result[0]}" "${products_result[2]}"
import json
import pathlib
import sys

settings = json.loads(pathlib.Path(sys.argv[1]).read_text())
status = sys.argv[2]
body_path = pathlib.Path(sys.argv[3])
catalog_visibility = settings.get('b2b', {}).get('catalogVisibility')
denied = {'401', '403', '404'}

if catalog_visibility == 'public':
    if status != '200':
        print(f'FAIL b2b visibility policy -> public catalog expected 200, got {status}')
        raise SystemExit(1)
    print('PASS b2b visibility policy')
    raise SystemExit(0)

if catalog_visibility == 'hidden':
    if status not in denied:
        print(f'FAIL b2b visibility policy -> hidden catalog expected one of {sorted(denied)}, got {status}')
        raise SystemExit(1)
    print('PASS b2b visibility policy')
    raise SystemExit(0)

if catalog_visibility != 'login_only':
    print(f'FAIL b2b visibility policy -> unsupported catalogVisibility {catalog_visibility!r}')
    raise SystemExit(1)

if status in denied:
    print('PASS b2b visibility policy')
    raise SystemExit(0)

if status != '200':
    print(f'FAIL b2b visibility policy -> unexpected status {status} for login_only')
    raise SystemExit(1)

payload = json.loads(body_path.read_text())
products = payload.get('data', {}).get('products', [])
product = products[0] if products else {}
for forbidden_field in ('price', 'stock_local', 'stock_supplier', 'stock_total', 'credit_limit', 'discount_tiers'):
    if forbidden_field in product:
        print(f'FAIL b2b visibility policy -> login_only leaked {forbidden_field}')
        raise SystemExit(1)

print('PASS b2b visibility policy')
PY

mapfile -t erp_shell_result < <(request 'erp login shell' GET "$ERP_WEB_BASE_URL/login" '200' '' "$ERP_HOST_HEADER")
assert_header_matches 'erp login shell content-type' "${erp_shell_result[1]}" '^content-type:.*text/html'
assert_body_contains 'erp login shell root' "${erp_shell_result[2]}" '<div id="root"></div>'
assert_body_contains 'erp login shell title' "${erp_shell_result[2]}" 'Ledux ERP'
assert_body_matches 'erp login shell production bootstrap' "${erp_shell_result[2]}" '<script[^>]+src="/assets/[^\"]+\.js"'
assert_body_contains 'erp host shell metadata title' "${erp_shell_result[2]}" '<title>Ledux ERP</title>'
assert_body_contains 'erp host shell metadata canonical' "${erp_shell_result[2]}" 'href="https://erp.ledux.ro/"'
assert_body_contains 'erp host shell metadata manifest' "${erp_shell_result[2]}" 'href="/erp/manifest.webmanifest"'
assert_body_contains 'erp host shell metadata favicon' "${erp_shell_result[2]}" 'href="/erp/favicon.svg"'
assert_body_not_contains 'erp host shell metadata excludes b2b title' "${erp_shell_result[2]}" '<title>Ledux B2B</title>'

mapfile -t b2b_shell_result < <(request 'b2b storefront shell' GET "$B2B_WEB_BASE_URL/b2b-store" '200' '' "$B2B_HOST_HEADER")
assert_header_matches 'b2b storefront shell content-type' "${b2b_shell_result[1]}" '^content-type:.*text/html'
assert_body_contains 'b2b storefront shell root' "${b2b_shell_result[2]}" '<div id="root"></div>'
assert_body_matches 'b2b storefront shell production bootstrap' "${b2b_shell_result[2]}" '<script[^>]+src="/assets/[^\"]+\.js"'

if [[ -n "$B2B_HOST_HEADER" ]]; then
  mapfile -t b2b_host_catalog_result < <(request 'b2b dedicated host catalog shell' GET "$B2B_WEB_BASE_URL/catalog" '200' '' "$B2B_HOST_HEADER")
  assert_header_matches 'b2b dedicated host catalog shell content-type' "${b2b_host_catalog_result[1]}" '^content-type:.*text/html'
  assert_body_contains 'b2b dedicated host catalog shell root' "${b2b_host_catalog_result[2]}" '<div id="root"></div>'
  assert_body_matches 'b2b dedicated host catalog shell production bootstrap' "${b2b_host_catalog_result[2]}" '<script[^>]+src="/assets/[^\"]+\.js"'

  mapfile -t b2b_host_login_result < <(request 'b2b dedicated host login shell' GET "$B2B_WEB_BASE_URL/login" '200' '' "$B2B_HOST_HEADER")
  assert_header_matches 'b2b dedicated host login shell content-type' "${b2b_host_login_result[1]}" '^content-type:.*text/html'
  assert_body_contains 'b2b dedicated host login shell root' "${b2b_host_login_result[2]}" '<div id="root"></div>'
  assert_body_matches 'b2b dedicated host login shell production bootstrap' "${b2b_host_login_result[2]}" '<script[^>]+src="/assets/[^\"]+\.js"'
  assert_body_contains 'b2b host shell metadata title' "${b2b_host_login_result[2]}" '<title>Ledux B2B</title>'
  assert_body_contains 'b2b host shell metadata canonical' "${b2b_host_login_result[2]}" 'href="https://b2b.ledux.ro/"'
  assert_body_contains 'b2b host shell metadata manifest' "${b2b_host_login_result[2]}" 'href="/b2b/manifest.webmanifest"'
  assert_body_contains 'b2b host shell metadata favicon' "${b2b_host_login_result[2]}" 'href="/b2b/favicon.svg"'
  assert_body_not_contains 'b2b host shell metadata excludes erp title' "${b2b_host_login_result[2]}" '<title>Ledux ERP</title>'

  printf 'PASS host identity -> dedicated B2B host header reaches host-level storefront shells (/catalog, /login).\n'
elif [[ -n "$ERP_HOST_HEADER" ]]; then
  printf 'INFO host identity smoke received only ERP host header (%s); dedicated B2B host-level route assertions remain skipped until B2B_HOST_HEADER is set.\n' "$ERP_HOST_HEADER"
else
  skip 'host identity smoke not asserted until B2B_HOST_HEADER is set; raw IP/localhost alone cannot prove dedicated-host storefront routing'
fi

printf 'INFO retail ledux.ro stays outside this SPA smoke; host split coverage only targets erp.ledux.ro and b2b.ledux.ro.\n'

mapfile -t favicon_result < <(request 'static asset correctness favicon' GET "$ERP_WEB_BASE_URL/favicon.ico" '200')
assert_header_matches 'static asset correctness favicon content-type' "${favicon_result[1]}" '^content-type:(?!.*text/html)'

mapfile -t erp_icon_result < <(request 'static asset correctness erp icon' GET "$ERP_WEB_BASE_URL/erp/favicon.svg" '200')
assert_header_matches 'static asset correctness erp icon content-type' "${erp_icon_result[1]}" '^content-type:.*image/svg\+xml'
assert_body_contains 'static asset correctness erp icon body' "${erp_icon_result[2]}" '<svg'

mapfile -t b2b_icon_result < <(request 'static asset correctness b2b icon' GET "$B2B_WEB_BASE_URL/b2b/favicon.svg" '200')
assert_header_matches 'static asset correctness b2b icon content-type' "${b2b_icon_result[1]}" '^content-type:.*image/svg\+xml'
assert_body_contains 'static asset correctness b2b icon body' "${b2b_icon_result[2]}" '<svg'

mapfile -t erp_manifest_result < <(request 'static asset correctness erp manifest' GET "$ERP_WEB_BASE_URL/erp/manifest.webmanifest" '200')
assert_header_matches 'static asset correctness erp manifest content-type' "${erp_manifest_result[1]}" '^content-type:.*(json|application/manifest\+json|application/octet-stream)'
assert_body_contains 'static asset correctness erp manifest body' "${erp_manifest_result[2]}" 'Ledux ERP'

mapfile -t b2b_manifest_result < <(request 'static asset correctness b2b manifest' GET "$B2B_WEB_BASE_URL/b2b/manifest.webmanifest" '200')
assert_header_matches 'static asset correctness b2b manifest content-type' "${b2b_manifest_result[1]}" '^content-type:.*(json|application/manifest\+json|application/octet-stream)'
assert_body_contains 'static asset correctness b2b manifest body' "${b2b_manifest_result[2]}" 'Ledux B2B'

# Launch-critical public settings policy and b2b visibility policy are asserted inline above.
# scripts/tests/public-surface-smoke.sh remains a broader regression suite, but it is not a
# launch gate dependency because it also covers non-launch admin surface expectations.
printf 'INFO launch gate keeps public settings policy and b2b visibility policy inline; broader scripts/tests/public-surface-smoke.sh stays outside the final go/no-go path\n'

# Delegate to scripts/tests/seo-smoke.sh for seo status/config parity coverage.
printf 'Running delegated seo status/config parity matrix\n'
BASE_URL="$API_BASE_URL" AUTH_TOKEN="$AUTH_TOKEN" ALLOW_INSECURE="${ALLOW_INSECURE:-0}" bash "$SCRIPT_DIR/seo-smoke.sh"
pass 'seo status/config parity'

# Delegate to scripts/tests/bundle-budget-check.sh for ERP login shell and B2B storefront shell bundle budgets.
printf 'Running delegated ERP login shell and B2B storefront shell bundle budget matrix\n'
bash "$SCRIPT_DIR/bundle-budget-check.sh"
pass 'erp login shell bundle budget'
pass 'b2b storefront shell bundle budget'

printf 'Launch smoke passed.\n'
