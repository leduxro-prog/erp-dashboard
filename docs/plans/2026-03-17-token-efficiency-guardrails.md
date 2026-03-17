# Token Efficiency Guardrails (No Quality Regression)

## Scope

Execution guardrails for backlog delivery in this repository, optimized for low token usage while preserving verification quality and implementation speed.

## Deterministic Policy

- Prefer exact-path reads over broad scans once file locations are known.
- Run independent discovery in parallel (`glob`/`read`/`grep`) and avoid serial lookup chains.
- Cache discovered module/file map per session and reuse it.
- Stop reading once required symbols/contracts are confirmed.
- Favor targeted test commands over full-suite runs during task-level iteration.

## Response Compaction Rules

- Lead with deltas and decisions, then evidence.
- Report repetitive checks as one-line command/result bullets.
- Expand details only on failure branches.
- Avoid dumping generated or unchanged file content.

## Tool-Usage Guardrails

- Batch parallel read/search calls when there is no dependency between them.
- Avoid duplicate reads of unchanged files.
- Use line offsets for large files instead of repeated small slices.
- Use shell for execution only (tests/build/git), not for source file reads.

## Validation Rule

- Every “done” claim must be backed by at least one executed verification command and observed output.
- If a global suite is known-red for unrelated reasons, run and report the minimal targeted suite for touched scope.
