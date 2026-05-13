# SmartBill B2B Idempotency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make automatic B2B SmartBill proforma creation durable and idempotent without duplicate external proformas or silent permanent blocks.

**Architecture:** Treat SmartBill creation as a durable state machine. Persist a local `pending_external` proforma before the external call; after success, transition it to SmartBill's returned status with external identifiers. If the external call rejects before returning an id/number, transition to `requires_reconciliation` because the external outcome may be unknown; future event retries must not call SmartBill again until an operator resolves/retries intentionally.

**Tech Stack:** TypeScript, TypeORM repository/domain entity, Jest unit tests, existing `smartbill_proformas.status` varchar column.

---

## Enterprise Rules

- Do not rely on deleting rows or swallowing persistence failures.
- Do not issue a second SmartBill external call while a previous attempt is `pending_external` or `requires_reconciliation`.
- Treat network/API rejection without SmartBill id/number as unknown outcome, not safe retry.
- Keep schema changes compatible with the existing varchar `status` column.
- Preserve existing non-B2B SmartBill flows unless tests prove otherwise.

---

### Task 1: Model Durable Proforma Lifecycle States

**Files:**
- Modify: `modules/smartbill/src/domain/entities/SmartBillProforma.ts`
- Test: `modules/smartbill/tests/application/CreateB2BProforma.test.ts`

**Step 1: Add failing tests for state behavior**

Extend the SmartBill B2B test suite to verify:

- New B2B creation saves a `pending_external` local proforma before `apiClient.createProforma()`.
- Existing `pending_external` proforma blocks a duplicate external call.
- Existing `requires_reconciliation` proforma blocks a duplicate external call.
- External rejection transitions the saved local row to `requires_reconciliation`.

Run:

```bash
npm run test -- --runInBand modules/smartbill/tests/application/CreateB2BProforma.test.ts
```

Expected: new/updated tests fail before implementation.

**Step 2: Add domain states and transition methods**

Update `ProformaStatus` to include:

- `pending_external`
- `requires_reconciliation`
- `failed`

Add methods to `SmartBillProforma`:

```ts
markPendingExternal(): void
markRequiresReconciliation(): void
markFailed(): void
isExternalCreationInProgressOrUnknown(): boolean
isTerminallyBlockedForExternalCreate(): boolean
```

Keep existing `markIssued`, `markSent`, `markConverted`, `markCancelled` behavior unchanged.

**Step 3: Verify domain tests through use-case tests**

Run the SmartBill B2B test suite.

Expected: tests still fail until use-case state machine is updated.

---

### Task 2: Update B2B Proforma Use Case To Use State Machine

**Files:**
- Modify: `modules/smartbill/src/application/use-cases/CreateB2BProforma.ts`
- Test: `modules/smartbill/tests/application/CreateB2BProforma.test.ts`

**Step 1: Replace generic existing guard**

Current behavior blocks any existing non-cancelled proforma. Replace with explicit behavior:

- If existing has `smartBillId` or `proformaNumber`, throw duplicate/existing proforma error before external call.
- If existing status is `pending_external` or `requires_reconciliation`, throw reconciliation/in-progress error before external call.
- If existing status is `cancelled` or `failed`, create/reuse according to existing repository capabilities without issuing duplicates. For this pass, create a new attempt only after failed/cancelled status is explicit.

**Step 2: Persist pending state before external call**

Before `apiClient.createProforma()`, call:

```ts
proforma.markPendingExternal();
const savedPendingProforma = await repository.saveProforma(proforma);
```

The test must assert save happens before API call.

**Step 3: Transition success with update**

After SmartBill response:

```ts
savedPendingProforma.markIssued(apiResponse.id, apiResponse.number, apiResponse.status as any);
await repository.updateProforma(savedPendingProforma);
```

Then persist B2B order reference and publish success event.

**Step 4: Transition unknown external result**

If `apiClient.createProforma()` rejects before returning an id/number:

```ts
savedPendingProforma.markRequiresReconciliation();
await repository.updateProforma(savedPendingProforma);
throw error;
```

If this update fails, do not swallow it. Throw a `ProformaCreationError` that says the attempt is left `pending_external` and requires operator reconciliation. This avoids pretending the system is retryable when persistence failed.

**Step 5: Verify**

Run:

```bash
npm run test -- --runInBand modules/smartbill/tests/application/CreateB2BProforma.test.ts
```

Expected: SmartBill B2B tests pass.

---

### Task 3: Full Targeted Verification

### Task 3: Add Atomic Persistence Boundary

**Files:**
- Modify: `modules/smartbill/src/infrastructure/entities/SmartBillProformaEntity.ts`
- Create: `database/migrations/1747110000000-AddSmartBillB2BProformaActiveUniqueIndex.ts`
- Modify: `modules/smartbill/src/application/use-cases/CreateB2BProforma.ts`
- Test: `modules/smartbill/tests/application/CreateB2BProforma.test.ts`

**Step 1: Add failing tests for concurrency safety**

Add tests proving:

- An existing `cancelled` or `failed` row with `smartBillId`/`proformaNumber` still blocks a new external call.
- A duplicate-key failure while inserting `pending_external` is handled before any external call.

Run the SmartBill B2B test suite and verify the tests fail before implementation.

**Step 2: Add database-level unique active B2B order boundary**

Add a migration that creates a partial unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_smartbill_b2b_proformas_active_order_unique
  ON smartbill_proformas("orderId")
  WHERE "orderId" LIKE 'B2B-%'
    AND status IN ('draft', 'pending_external', 'requires_reconciliation', 'issued', 'sent', 'converted');
```

Before creating it, fail with a clear exception if duplicate active B2B rows already exist.

Add the matching TypeORM `@Index` metadata on `SmartBillProformaEntity`.

**Step 3: Handle unique insert race before external call**

Wrap the pending-row save. If persistence reports unique violation (`23505` or duplicate-key message), re-read by `orderId` and throw a `ProformaCreationError` before calling SmartBill.

**Step 4: Block external identifiers independent of status**

Use `existing.isTerminallyBlockedForExternalCreate()` before status-specific retry logic. Any row with `smartBillId` or `proformaNumber` must block another external call regardless of `failed` or `cancelled` status.

**Step 5: Verify**

Run:

```bash
npm run test -- --runInBand modules/smartbill/tests/application/CreateB2BProforma.test.ts
```

Expected: all SmartBill B2B tests pass.

---

### Task 4: Full Targeted Verification

**Files:**
- No new production files expected beyond Tasks 1-2.

**Step 1: Run build**

```bash
npm run build
```

Expected: TypeScript build succeeds.

**Step 2: Run targeted regression suite**

```bash
npm run test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BProductDetailsGallery.test.ts modules/search-index/tests/SearchIndexModule.test.ts modules/smartbill/tests/application/CreateB2BProforma.test.ts modules/suppliers/tests/application/ScrapeSupplierStock.test.ts modules/users/tests/UsersModule.test.ts modules/seo-automation/tests/domain/MetaTagGenerator.test.ts src/routes/website-sync.routes.test.ts shared/utils/brand-strategy.test.ts
```

Expected: all targeted suites pass.

**Step 3: Check diff whitespace**

```bash
git diff --check
```

Expected: no output.

**Step 4: Request final review**

Ask for final review focused on:

- no duplicate SmartBill external calls
- unknown external outcome requires reconciliation
- no silent swallowed persistence failures
- image remediation previous findings remain resolved
