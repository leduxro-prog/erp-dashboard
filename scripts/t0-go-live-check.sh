#!/bin/bash

set -euo pipefail

APP_CONTAINER="${APP_CONTAINER:-cypher-erp-app-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-cypher-erp-redis}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:8080/health}"
SINCE_WINDOW="${SINCE_WINDOW:-30m}"

PASS=0
FAIL=0

ok() {
  printf '[PASS] %s\n' "$1"
  PASS=$((PASS + 1))
}

bad() {
  printf '[FAIL] %s\n' "$1"
  FAIL=$((FAIL + 1))
}

section() {
  printf '\n=== %s ===\n' "$1"
}

section "T0 Go-Live Check"
printf 'Time: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

section "Container Health"
health_snapshot="$(docker ps --format '{{.Names}}\t{{.Status}}')"
printf '%s\n' "$health_snapshot"

for svc in cypher-erp-frontend-1 "$APP_CONTAINER" "$REDIS_CONTAINER" cypher-erp-db cypher-rabbitmq; do
  line="$(printf '%s\n' "$health_snapshot" | grep -E "^${svc}[[:space:]]" || true)"
  if [ -n "$line" ] && printf '%s' "$line" | grep -q '(healthy)'; then
    ok "$svc healthy"
  else
    bad "$svc not healthy"
  fi
done

section "Health Endpoints"
frontend_code="$(curl -s -o /tmp/t0-frontend-health.out -w '%{http_code}' "$FRONTEND_HEALTH_URL" || true)"
if [ "$frontend_code" = "200" ]; then
  ok "Frontend health HTTP 200"
else
  bad "Frontend health HTTP $frontend_code"
fi

if docker exec "$APP_CONTAINER" wget --quiet --tries=1 --spider http://127.0.0.1:3000/health; then
  ok "Backend internal health reachable"
else
  bad "Backend internal health failed"
fi

redis_ping="$(docker exec "$REDIS_CONTAINER" sh -lc 'redis-cli -a "$REDIS_PASSWORD" ping' 2>/tmp/t0-redis.err || true)"
if [ "$redis_ping" = "PONG" ]; then
  ok "Redis auth ping PONG"
else
  bad "Redis auth ping failed"
  if [ -s /tmp/t0-redis.err ]; then
    printf 'Redis stderr: %s\n' "$(tr '\n' ' ' < /tmp/t0-redis.err)"
  fi
fi

section "Authenticated Smoke (Users + Settings)"
docker exec "$APP_CONTAINER" node -e "const jwt=require('jsonwebtoken'); const fs=require('fs'); const secret=fs.readFileSync(process.env.JWT_SECRET_FILE,'utf8').trim(); const token=jwt.sign({id:'1',email:'admin@cypher.local',role:'admin'},secret,{expiresIn:'1h'}); const headers={Authorization:'Bearer '+token}; const users='http://127.0.0.1:3000/api/v1/users'; const settings='http://127.0.0.1:3000/api/v1/settings'; (async()=>{ const out=[]; const ug=await fetch(users,{headers}); out.push('USERS_GET='+ug.status); const payload={email:'smoke.user.'+Date.now()+'@cypher.local',password:'SmokeTest123!',first_name:'Smoke',last_name:'User',role:'sales'}; const up=await fetch(users,{method:'POST',headers:{...headers,'Content-Type':'application/json',Origin:'http://127.0.0.1:8080',Referer:'http://127.0.0.1:8080/'},body:JSON.stringify(payload)}); out.push('USERS_POST='+up.status); if(up.status===200||up.status===201){ const b=await up.json(); const id=(b&&b.data&&b.data.id)||b.id; if(id){ const ud=await fetch(users+'/'+id,{method:'DELETE',headers:{...headers,Origin:'http://127.0.0.1:8080',Referer:'http://127.0.0.1:8080/'}}); out.push('USERS_DELETE='+ud.status);} else {out.push('USERS_DELETE=NO_ID');} } else { out.push('USERS_DELETE=SKIP'); } const sg=await fetch(settings,{headers}); out.push('SETTINGS_GET='+sg.status); if(sg.status===200){ const sbody=await sg.json(); const putPayload=(sbody&&typeof sbody==='object'&&sbody.data&&typeof sbody.data==='object')?sbody.data:sbody; const sp=await fetch(settings,{method:'PUT',headers:{...headers,'Content-Type':'application/json',Origin:'http://127.0.0.1:8080',Referer:'http://127.0.0.1:8080/'},body:JSON.stringify(putPayload)}); out.push('SETTINGS_PUT='+sp.status);} else {out.push('SETTINGS_PUT=SKIP');} console.log(out.join('\\n')); })().catch(e=>{ console.error(e); process.exit(1); });" > /tmp/t0-smoke.out

cat /tmp/t0-smoke.out

for expected in "USERS_GET=200" "USERS_POST=201" "USERS_DELETE=204" "SETTINGS_GET=200" "SETTINGS_PUT=200"; do
  if grep -q "$expected" /tmp/t0-smoke.out; then
    ok "$expected"
  else
    bad "$expected missing"
  fi
done

section "SLI Snapshot (${SINCE_WINDOW})"
docker logs "$APP_CONTAINER" --since "$SINCE_WINDOW" > /tmp/t0-app-window.log 2>&1 || true
python3 - <<'PY'
import re
from collections import Counter

p='/tmp/t0-app-window.log'
status=Counter(); lat=[]
per= {'/health':Counter(), '/api/v1/users':Counter(), '/api/v1/settings':Counter()}

with open(p,'r',encoding='utf-8',errors='ignore') as f:
    for line in f:
        m=re.search(r'^(GET|POST|PUT|DELETE)\s(\S+)\s(\d{3})\s([0-9]+\.?[0-9]*)\sms', line)
        if not m:
            continue
        _, path, code, ms = m.group(1), m.group(2), int(m.group(3)), float(m.group(4))
        status[code]+=1
        lat.append(ms)
        for k in per:
            if path.startswith(k):
                per[k][code]+=1

def pct(arr,p):
    if not arr:
        return 0
    arr=sorted(arr)
    i=int(round((p/100)*(len(arr)-1)))
    return arr[i]

total=sum(status.values())
e5=sum(v for k,v in status.items() if 500<=k<=599)
e4=sum(v for k,v in status.items() if 400<=k<=499)
rate=(e5/total*100) if total else 0
print(f'TOTAL={total} 4XX={e4} 5XX={e5} ERR5_RATE={rate:.2f}% P95_MS={pct(lat,95):.2f} P99_MS={pct(lat,99):.2f}')
for k in ['/health','/api/v1/users','/api/v1/settings']:
    tt=sum(per[k].values())
    s5=sum(v for c,v in per[k].items() if 500<=c<=599)
    print(f'{k} TOTAL={tt} 5XX={s5} CODES={dict(sorted(per[k].items()))}')
PY

section "Decision"
printf 'Checks: PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf 'GO\n'
  exit 0
fi

printf 'NO-GO\n'
exit 1
