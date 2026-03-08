# SEO Auto Draft Queue Runbook

## Purpose

Operate and troubleshoot automatic SEO draft generation with bulk approve/apply workflow.

## Scope

- Queue creation for new/missing/modified products
- Admin review actions (`approve`, `reject`, `apply`)
- Scheduler and event-triggered queue generation

## Key Endpoints

- `POST /api/v1/seo/queue/refresh`
- `GET /api/v1/seo/queue`
- `GET /api/v1/seo/queue/:changesetId`
- `POST /api/v1/seo/queue/approve`
- `POST /api/v1/seo/queue/reject`
- `POST /api/v1/seo/queue/apply`

## Safety Rules

- `approve/reject/apply` must be scoped by `product_id` or `locale`, unless `apply_all=true`.
- Actor identity is taken from authenticated user, not from request payload.
- Apply updates only approved fields and updates fingerprint state after successful apply.

## Daily Checks

1. Health

```bash
curl -sS http://127.0.0.1:8080/health
curl -sS http://127.0.0.1:8080/api/v1/seo/health
```

2. Queue backlog

```bash
curl -sS "http://127.0.0.1:8080/api/v1/seo/queue?status=pending&limit=50&page=1"
```

3. Recent apply activity

```bash
curl -sS "http://127.0.0.1:8080/api/v1/seo/queue?status=superseded&limit=50&page=1"
```

## Common Operations

### Approve all pending for a locale

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/seo/queue/approve \
  -H "Content-Type: application/json" \
  -d '{"locale":"ro","status":"pending"}'
```

### Reject all pending for one product

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/seo/queue/reject \
  -H "Content-Type: application/json" \
  -d '{"product_id":12345,"status":"pending"}'
```

### Apply approved globally (explicit)

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/seo/queue/apply \
  -H "Content-Type: application/json" \
  -d '{"apply_all":true}'
```

## Incident Guide

### Symptom: queue not filling automatically

Check:
- scheduler enabled config (`SEO_QUEUE_AUTORUN_ENABLED` / feature flag)
- module startup logs for queue autotrigger
- errors tagged with `[seo-automation][queue-autotrigger]`

Actions:
1. Fix config and restart backend.
2. Trigger manual refresh on specific scope.

### Symptom: apply fails

Check:
- payload scope (`product_id`/`locale` or `apply_all=true`)
- queue item status (`approved` required)
- DB availability and transaction errors

Actions:
1. Retry scoped apply first.
2. Inspect server logs for SQL and validation errors.
3. Re-run approve flow for pending items if needed.

### Symptom: repeated scheduler failures

Check:
- DB query latency/failures in logs
- drift between `seo_metadata` and `seo_product_state`

Actions:
1. Resolve DB issue.
2. Run catch-up through normal scheduler cycle or manual refresh.
3. Confirm backlog decreases.

## Verification Checklist (Post-Deploy)

- `GET /api/v1/seo/queue` returns entries with `items`
- approve/reject endpoints reject unscoped payloads when `apply_all` is absent/false
- apply endpoint works for scoped payloads and explicit `apply_all=true`
- queue auto-trigger logs are present for failures
- SEO queue test suite passes in CI
