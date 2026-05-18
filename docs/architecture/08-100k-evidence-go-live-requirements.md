# Task 8 - 100k Evidence Requirements for Go-Live

## Objective

Define non-negotiable evidence gates for enterprise readiness on the final target dataset (not synthetic-only) before declaring platform ready.

## Required Evidence Categories

### 1) Dataset scale evidence

- `productCount >= 100000` in published catalog read model
- reconciliation parity against ERP export snapshot

### 2) Completeness evidence

- image completeness threshold
- document completeness threshold (datasheets/certificates/install/compliance classes)
- technical facet coverage threshold on required domain fields

### 3) Performance evidence

- browse latency p95
- search latency p95
- PDP latency p95
- measured on final-like dataset and production-like infrastructure profile

### 4) Replay/reindex evidence

- full replay completion report
- alias-swap reindex completion report
- rollback drill proof and recovery time

### 5) Surface integrity evidence

- retail visibility contract validation
- b2b visibility/pricing contract validation
- no direct ERP runtime browse dependency in steady-state profile

## Minimum Threshold Baseline (Policy)

- `productCount >= 100000`
- `imageCompletenessPct >= 98`
- `documentCompletenessPct >= 95`
- `facetCoveragePct >= 97`
- `browseP95Ms <= 350`
- `searchP95Ms <= 250`
- `pdpP95Ms <= 200`
- `replayValidationPassed = true`
- `reindexValidationPassed = true`
- `erpDatasetParityPassed = true`

## Evidence Gate Artifact

- Example policy input: `config/go-live-evidence-100k.example.yaml`
- Gate evaluator: `src/readiness/evidence-gate.cjs`

## Governance Rule

Go-live readiness status is `blocked` if any required threshold fails.

No enterprise-ready declaration without final dataset evidence.
