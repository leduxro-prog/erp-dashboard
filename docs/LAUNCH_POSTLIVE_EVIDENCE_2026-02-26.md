# Launch Post-Live Evidence - 2026-02-26

## Executive Status

- Status: GO, stable in production.
- Post-launch watch (T+15/T+30/T+45/T+60): all PASS.
- Current core services remain healthy:
  - `cypher-erp-app-1`
  - `cypher-erp-frontend-1`
  - `cypher-erp-redis`
  - `cypher-erp-db`
  - `cypher-rabbitmq`

## Final Validation (17:39 UTC)

Command:

```bash
SINCE_WINDOW=60m APP_CONTAINER=cypher-erp-app-1 REDIS_CONTAINER=cypher-erp-redis ./scripts/t0-go-live-check.sh
```

Result:

- Decision: `GO`
- Checks: `PASS=13`, `FAIL=0`
- Auth smoke:
  - `USERS_GET=200`
  - `USERS_POST=201`
  - `USERS_DELETE=204`
  - `SETTINGS_GET=200`
  - `SETTINGS_PUT=200`
- SLI snapshot (60m):
  - `5XX=0` (`ERR5_RATE=0.00%`)
  - `p95=3.40ms`
  - critical endpoints healthy

## Queue Stability (Supplier Sync)

- Repeatable job schedule fixed to 4-hour cadence:
  - pattern: `0 0 6-21/4 * * *`
- Queue state after fix: no stuck prioritized jobs.
- Manual sync confirmations:
  - supplier `11`: manual success logged
  - supplier `14`: manual success logged

## Functional Outcomes Confirmed

- Product image search endpoint operational.
- B2B product detail returns enriched `specifications` payload.
- Product settings persistence and user CRUD stable.

## Operational Artefacts

- Post-launch watch log: `/tmp/cypher-launch-watch.log`
- Last T0 gate output: terminal run at `2026-02-26T17:39:45Z`
