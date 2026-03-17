# Backlog Enterprise Design (Execution Snapshot)

## Goal

Deliver enterprise backlog milestones with safe runtime activation, backward-compatible API/UI contracts, and focused verification evidence.

## Implemented Design Decisions

- Sales KPI source switch is flag-gated with fallback to legacy path.
- Purchasing runtime no longer returns `501`; module initializes real controllers/use-cases.
- Purchasing persistence layer added with TypeORM entities and repositories; runtime defaults to in-memory unless `PURCHASING_RUNTIME_MODE=typeorm`.
- Financial accounting AP repository is concrete and wired (no `null` dependency).
- Purchasing invoice approval emits `purchasing.invoice.approved`; financial-accounting subscribes and creates AP invoice idempotently.
- Frontend now includes `/hr` page, route, and sidebar entry.
- Smoke coverage added for `/checkout`, `/configurators`, `/hr`, `/marketing` route presence/dependency surface.

## Operational Safety

- Runtime mode guard prevents premature DB-coupled purchasing activation before migration rollout.
- AP event handler is idempotent by `(organizationId, invoiceNumber)` check.
- Targeted test-first verification used per task batch.
