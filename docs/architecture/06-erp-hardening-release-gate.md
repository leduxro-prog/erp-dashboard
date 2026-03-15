# Task 6 - ERP Ingest Hardening as Release-Gated Policy

## Objective

Promote ERP ingest hardening from optional runtime settings to explicit release-gated requirements for production.

## Mandatory Production Policy

Production must enforce all:

- `ERP_SYNC_INGEST_TOKEN` present and non-empty
- `ERP_SYNC_HMAC_SECRET` present and non-empty
- `ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST=true`
- `ERP_SYNC_REQUIRE_HMAC_SIGNATURE=true`

If any condition fails, release gate status is `blocked`.

## Staging and Rehearsal Policy

- Rehearsal should mirror production requirements unless an explicit waiver is approved.
- Staging may run weaker controls only if labeled as non-production-hardening and documented.
- Weak staging config cannot be confused with production-ready posture.

## Release Gate Behavior

Gate evaluator (artifact): `src/config/erp-sync-release-gate.ts`

Outputs:

- `status`: `pass` or `blocked`
- `environmentIntent`
- `checks[]` with per-rule pass/fail
- `violations[]`

## Governance Rule

- Production deployment approval requires `status=pass` from hardening gate.
- Any override requires documented exception with owner + expiry date.

## Alignment

This policy matches approved architecture constraints:

- versioned events and idempotent pipeline remain unchanged
- hardening controls become mandatory for production readiness
- no direct ERP-to-commerce transactional DB shortcut writes introduced
