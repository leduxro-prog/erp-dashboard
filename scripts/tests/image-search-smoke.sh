#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
B2B_IMAGE_ENDPOINT="${B2B_IMAGE_ENDPOINT:-${API_BASE}/b2b/products/search-by-image}"
ADMIN_HEALTH_ENDPOINT="${ADMIN_HEALTH_ENDPOINT:-${API_BASE}/search-index/admin/image-search/health}"
BACKEND_HEALTH_ENDPOINT="${BACKEND_HEALTH_ENDPOINT:-http://localhost:3000/health}"
EMBEDDING_HEALTH_ENDPOINT="${EMBEDDING_HEALTH_ENDPOINT:-http://localhost:8002/health}"
QDRANT_HEALTH_ENDPOINT="${QDRANT_HEALTH_ENDPOINT:-http://localhost:6333/collections}"

TMP_IMAGE="/tmp/image-search-smoke.jpg"

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-20}"
  local sleep_seconds="${4:-1}"

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  printf "FAIL: %s not ready at %s\n" "${name}" "${url}"
  return 1
}

printf "[1/6] Backend health...\n"
wait_for_url "backend" "${BACKEND_HEALTH_ENDPOINT}" 10 1

printf "[2/6] Embedding service health...\n"
wait_for_url "embedding-service" "${EMBEDDING_HEALTH_ENDPOINT}" 30 1

printf "[3/6] Qdrant health...\n"
wait_for_url "qdrant" "${QDRANT_HEALTH_ENDPOINT}" 20 1

printf "[4/6] Search-index admin health (optional endpoint)...\n"
admin_status_code=$(curl -sS -o /tmp/image-search-admin-health-response.json -w "%{http_code}" "${ADMIN_HEALTH_ENDPOINT}" || true)
if [[ "${admin_status_code}" != "200" && "${admin_status_code}" != "401" && "${admin_status_code}" != "403" ]]; then
  printf "WARN: admin health endpoint not reachable at %s\n" "${ADMIN_HEALTH_ENDPOINT}"
fi

printf "[5/6] Generate tiny smoke image...\n"
python3 - <<'PY'
import base64
from pathlib import Path

img_b64 = (
    b"/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEA8QDxAQEA8QEA8PDw8QEA8QEA8PFREWFhUR"
    b"FRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGi0fHyUtLS0tLS0tLS0t"
    b"LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/"
    b"xAAXAAADAQAAAAAAAAAAAAAAAAAAAQMC/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQ"
    b"AAAB2gD/xAAZEAEAAgMAAAAAAAAAAAAAAAAAAQIRITH/2gAIAQEAAT8Ammpf/8QAFBEBAAAAAAAAA"
    b"AAAAAAAAAAAAP/aAAgBAgEBPwCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwCf/9k="
)
Path('/tmp/image-search-smoke.jpg').write_bytes(base64.b64decode(img_b64))
PY

printf "[6/6] Image-search request (expects 200 or controlled 503)...\n"
status_code=""
for ((i=1; i<=20; i++)); do
  status_code=$(curl -sS -o /tmp/image-search-smoke-response.json -w "%{http_code}" \
    -X POST "${B2B_IMAGE_ENDPOINT}" \
    -F "image=@${TMP_IMAGE};type=image/jpeg" \
    -F "limit=5")

  if [[ "${status_code}" == "200" || "${status_code}" == "503" ]]; then
    break
  fi

  if [[ "${status_code}" == "404" || "${status_code}" == "502" ]]; then
    sleep 1
    continue
  fi

  printf "FAIL: unexpected status code %s\n" "${status_code}"
  cat /tmp/image-search-smoke-response.json
  exit 1
done

if [[ "${status_code}" != "200" && "${status_code}" != "503" ]]; then
  printf "FAIL: endpoint not ready, last status %s\n" "${status_code}"
  cat /tmp/image-search-smoke-response.json
  exit 1
fi

printf "PASS: image-search smoke finished with status %s\n" "${status_code}"
