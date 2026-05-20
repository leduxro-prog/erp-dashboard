# T0 Enterprise Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the launch-blocking enterprise audit risks that can cause fraudulent B2B orders, credit/stock races, duplicate/lost side effects, unsafe rollback, and public internal-service exposure.

**Architecture:** Apply small, test-first hardening changes around existing module seams. Favor DB-enforced atomic state transitions, strict request validation, server-side pricing/stock calculation, private cache boundaries, and operational fail-fast behavior. Do not refactor broad module architecture during T0 unless required to close a blocker.

**Tech Stack:** Node.js, TypeScript, Express, TypeORM, PostgreSQL, RabbitMQ, Redis, React/Vite, Docker Compose, GitHub Actions.

---

## Scope Rules

- Do not modify Google OAuth/auth flow without explicit owner approval.
- Do not run data-changing production SQL without explicit approval.
- Do not stop/restart production containers during implementation unless explicitly approved.
- Keep fixes minimal and covered by targeted regression tests.
- Commit after each task group passes its targeted tests.
- Preserve untracked `backups/` artifacts unless cleanup is explicitly approved.

## Task 1: B2B Order Trust Boundary

**Files:**
- Modify: `modules/b2b-portal/src/api/validators/b2b.validators.ts`
- Modify: `modules/b2b-portal/src/api/routes/b2b.routes.ts`
- Modify: `modules/b2b-portal/src/api/controllers/B2BOrderController.ts`
- Test: create `modules/b2b-portal/tests/api/controllers/B2BOrderTrustBoundary.test.ts`

**Step 1: Write failing API/controller tests**

Create tests that prove:
- `price`, `unit_price`, `discount`, `subtotal`, and `total` fields from client payload are rejected or ignored.
- `quantity <= 0` returns `400`.
- order total uses trusted server/catalog price, not client-supplied price.
- stock decrement uses validated positive quantity.

Minimal test cases:

```ts
it('rejects client supplied order item prices', async () => {
  const response = await request(app)
    .post('/api/v1/b2b/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      items: [{ product_id: 1, quantity: 2, price: 0 }],
    });

  expect(response.status).toBe(400);
});

it('rejects non-positive quantities', async () => {
  const response = await request(app)
    .post('/api/v1/b2b/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      items: [{ product_id: 1, quantity: -1 }],
    });

  expect(response.status).toBe(400);
});
```

**Step 2: Run failing tests**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BOrderTrustBoundary.test.ts
```

Expected: FAIL before validation/controller fix.

**Step 3: Add strict order payload schema**

In `b2b.validators.ts`, add or update an order-create schema:

```ts
export const createB2BOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().uuid()).required(),
        quantity: Joi.number().integer().min(1).max(9999).required(),
      }).unknown(false),
    )
    .min(1)
    .required(),
  notes: Joi.string().max(2000).optional().allow('', null),
  shipping_address_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().uuid()).optional(),
  billing_address_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().uuid()).optional(),
}).unknown(false);
```

Adapt field names to current controller contract if it uses snake/camel names.

**Step 4: Mount validation on order routes**

In `b2b.routes.ts`, apply validation middleware before `orderController.createOrder` for all create-order routes.

**Step 5: Remove client price fallback**

In `B2BOrderController.ts`, replace client price usage:

```ts
const basePrice = item.price ?? product.base_price;
```

with trusted server-side pricing only:

```ts
const basePrice = product.base_price;
```

If tier pricing exists, compute from server-side customer tier and product pricing tables only.

**Step 6: Verify affected-row stock update**

After any stock decrement/update, verify affected row count. If the update did not affect the expected row, throw and rollback the transaction.

**Step 7: Run targeted tests**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BOrderTrustBoundary.test.ts
npm test -- --runInBand modules/b2b-portal/tests/application/ConvertCartToOrder.test.ts
npm run build
```

Expected: PASS.

**Step 8: Commit**

```bash
git add modules/b2b-portal/src/api/validators/b2b.validators.ts modules/b2b-portal/src/api/routes/b2b.routes.ts modules/b2b-portal/src/api/controllers/B2BOrderController.ts modules/b2b-portal/tests/api/controllers/B2BOrderTrustBoundary.test.ts
git commit -m "fix: harden b2b order trust boundary"
```

## Task 2: B2B Credit And Stock Atomicity

**Files:**
- Modify: `modules/b2b-portal/src/api/controllers/B2BOrderController.ts`
- Test: create `modules/b2b-portal/tests/api/controllers/B2BOrderConcurrency.test.ts`

**Step 1: Write failing concurrent credit test**

Create a test where a customer has available credit for one order, then two simultaneous order creates race.

Expected behavior:
- exactly one succeeds.
- one fails with `409` or `400` credit-limit error.
- `credit_used` increases once.
- no orphan order/items remain for failed request.

**Step 2: Write failing concurrent stock test**

Create a test where available stock is `1`, then two simultaneous order creates each request quantity `1`.

Expected behavior:
- exactly one succeeds.
- one fails with stock error.
- stock never goes below zero.

**Step 3: Run tests to confirm failure**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BOrderConcurrency.test.ts
```

Expected: FAIL before atomic updates.

**Step 4: Implement customer credit row lock/conditional update**

Inside the order transaction, replace read-then-write credit checks with one of these patterns:

```sql
SELECT * FROM b2b_customers WHERE id = $1 FOR UPDATE;
```

or:

```sql
UPDATE b2b_customers
SET credit_used = credit_used + $1
WHERE id = $2
  AND credit_limit - credit_used >= $1
RETURNING id, credit_limit, credit_used;
```

Throw if no row is returned.

**Step 5: Implement atomic stock reservation/decrement**

Use a conditional update:

```sql
UPDATE stock_levels
SET quantity = quantity - $1
WHERE product_id = $2
  AND quantity >= $1
RETURNING product_id, quantity;
```

Adapt table/column names to the actual stock source used by `B2BOrderController`.

**Step 6: Verify targeted tests**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BOrderConcurrency.test.ts
npm test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BOrderTrustBoundary.test.ts
npm run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add modules/b2b-portal/src/api/controllers/B2BOrderController.ts modules/b2b-portal/tests/api/controllers/B2BOrderConcurrency.test.ts
git commit -m "fix: make b2b credit and stock updates atomic"
```

## Task 3: B2B Customer Data Exposure

**Files:**
- Modify: `modules/b2b-portal/src/api/routes/b2b.routes.ts`
- Modify: `modules/b2b-portal/src/api/controllers/B2BController.ts`
- Test: create `modules/b2b-portal/tests/api/controllers/B2BCustomerAccess.test.ts`

**Step 1: Write failing access tests**

Prove:
- normal B2B user cannot list all customers.
- normal B2B user can read only their own customer record if self endpoint exists.
- ERP admin can list customers if that route is intended for admin use.

**Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BCustomerAccess.test.ts
```

Expected: FAIL before authorization fix.

**Step 3: Restrict `GET /customers`**

Choose the minimal safe behavior:
- admin-only if it is an admin route.
- or self-scoped response if it is a portal route.

Do not expose `creditLimit`, `usedCredit`, `totalSpent`, or other customer financial fields to unrelated B2B accounts.

**Step 4: Verify**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BCustomerAccess.test.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add modules/b2b-portal/src/api/routes/b2b.routes.ts modules/b2b-portal/src/api/controllers/B2BController.ts modules/b2b-portal/tests/api/controllers/B2BCustomerAccess.test.ts
git commit -m "fix: restrict b2b customer data access"
```

## Task 4: Public/Private B2B Catalog Cache Isolation

**Files:**
- Modify: `modules/b2b-portal/src/api/routes/b2b.routes.ts`
- Test: create `modules/b2b-portal/tests/api/B2BCatalogCachePolicy.test.ts`

**Step 1: Write failing cache policy tests**

Prove:
- anonymous product listing returns `Cache-Control: public` only for anonymous-safe payloads.
- authenticated product listing returns `Cache-Control: private`.
- authenticated response includes `Vary: Authorization, Cookie, Accept-Encoding` or equivalent.

**Step 2: Run failing tests**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/B2BCatalogCachePolicy.test.ts
```

Expected: FAIL before header fix.

**Step 3: Split cache headers by auth state**

In catalog route middleware:

```ts
if (req.headers.authorization || req.cookies?.b2b_access_token) {
  res.setHeader('Cache-Control', 'private, max-age=30');
  res.setHeader('Vary', 'Authorization, Cookie, Accept-Encoding');
} else {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.setHeader('Vary', 'Accept-Encoding');
}
```

Adapt token/cookie names to current auth implementation.

**Step 4: Verify**

Run:

```bash
npm test -- --runInBand modules/b2b-portal/tests/api/B2BCatalogCachePolicy.test.ts
npm test -- --runInBand modules/b2b-portal/tests/api/B2BCatalogVisibility.test.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add modules/b2b-portal/src/api/routes/b2b.routes.ts modules/b2b-portal/tests/api/B2BCatalogCachePolicy.test.ts
git commit -m "fix: isolate b2b catalog cache by auth state"
```

## Task 5: Auth Session Wiring Guardrails

**Files:**
- Modify: `src/server.ts`
- Modify: `frontend/src/services/b2b-api.ts`
- Test: create/update `tests/integration/auth-refresh-route.integration.test.ts`
- Test: create `frontend/src/services/__tests__/b2b-api-refresh.test.ts`

**Step 1: Write server auth route/cookie parser test**

Prove:
- cookie parser is registered before auth middleware.
- `/api/v1/auth/refresh` route exists if frontend calls it.
- logout/refresh do not require refresh token in localStorage fallback.

**Step 2: Write B2B refresh recursion test**

Prove:
- a `401` from `/b2b-auth/refresh` does not recursively call refresh forever.
- concurrent `401`s use a single refresh attempt.

**Step 3: Run failing tests**

Run:

```bash
npm test -- --runInBand tests/integration/auth-refresh-route.integration.test.ts
npm --prefix frontend test -- b2b-api-refresh
```

Expected: FAIL before fixes, depending on current coverage.

**Step 4: Register cookie parser and auth routes**

In `src/server.ts`:

```ts
app.use(cookieParser());
app.use(`${apiPrefix}/auth`, authRoutes);
```

Place `cookieParser()` before auth/CSRF middleware.

**Step 5: Fix B2B refresh recursion**

In `frontend/src/services/b2b-api.ts`:
- do not run refresh interceptor for `/b2b-auth/refresh`.
- use a bare axios client for refresh.
- add `_retry` guard.
- add single-flight refresh promise.

**Step 6: Verify**

Run:

```bash
npm test -- --runInBand tests/integration/auth-refresh-route.integration.test.ts
npm --prefix frontend test -- b2b-api-refresh
npm run build
npm --prefix frontend run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/server.ts frontend/src/services/b2b-api.ts tests/integration/auth-refresh-route.integration.test.ts frontend/src/services/__tests__/b2b-api-refresh.test.ts
git commit -m "fix: harden auth refresh wiring"
```

## Task 6: Rollback And Backup Safety

**Files:**
- Modify: `scripts/rollback.sh`
- Modify: `.github/workflows/deploy-hetzner.yml`
- Test: update `tests/rollback/RollbackDrillTests.ts`

**Step 1: Write failing rollback drill expectations**

Prove:
- backup filename generated by rollback script is the same filename pattern restore searches.
- failed `pg_dump` is not swallowed.
- restore uses `ON_ERROR_STOP=1` or `pg_restore --exit-on-error`.

**Step 2: Run failing test**

Run:

```bash
npm test -- --runInBand tests/rollback/RollbackDrillTests.ts
```

Expected: FAIL before script fix if coverage is added.

**Step 3: Fix backup artifact naming and strict failure**

Use one consistent artifact, preferably custom format:

```bash
database_dump="$backup_path/database.dump"
pg_dump -Fc --file "$database_dump" ...
```

If keeping SQL format, remove `|| true` and restore exactly that filename.

**Step 4: Make pre-deploy backup blocking**

In `.github/workflows/deploy-hetzner.yml`, replace non-blocking backup warnings with hard failure for production deploy.

**Step 5: Verify**

Run:

```bash
npm test -- --runInBand tests/rollback/RollbackDrillTests.ts
npm run build
```

Expected: PASS.

**Step 6: Commit**

```bash
git add scripts/rollback.sh .github/workflows/deploy-hetzner.yml tests/rollback/RollbackDrillTests.ts
git commit -m "fix: make rollback database backup strict"
```

## Task 7: Runtime Exposure And Deployment Path Controls

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/deploy-hetzner.yml`
- Modify: `scripts/go-live-gate.sh`
- Test: create/update `tests/unit/HostTopology.test.ts`
- Test: create `tests/unit/DeploymentRuntimePolicy.test.ts`

**Step 1: Write topology tests**

Prove:
- internal services like Qdrant/n8n/embedding service are not exposed on `0.0.0.0` in production compose.
- deploy workflow does not apply incomplete K8s overlays unless K8s runtime is explicitly enabled.
- scheduled readiness scripts do not perform state-changing API calls.

**Step 2: Run failing tests**

Run:

```bash
npm test -- --runInBand tests/unit/HostTopology.test.ts tests/unit/DeploymentRuntimePolicy.test.ts
```

Expected: FAIL before config/script fixes.

**Step 3: Bind internal services safely**

In `docker-compose.yml`, change public bindings:

```yaml
ports:
  - "127.0.0.1:6333:6333"
```

Apply equivalent localhost binding or remove host port exposure for Qdrant, n8n, and image embedding service if present in this compose file.

**Step 4: Gate K8s deployment path**

Either:
- repair missing K8s manifests and validate `kubectl kustomize`, or
- disable K8s deploy path in production workflow until runtime decision is made.

Minimal T0 preference: fail fast if K8s is selected but `kubectl kustomize orchestration/k8s/overlays/staging` fails.

**Step 5: Split go-live gate modes**

Update `scripts/go-live-gate.sh` to support:
- read-only continuous readiness.
- explicit state-changing smoke mode for launch window only.

**Step 6: Verify**

Run:

```bash
npm test -- --runInBand tests/unit/HostTopology.test.ts tests/unit/DeploymentRuntimePolicy.test.ts
npm run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add docker-compose.yml .github/workflows/deploy-hetzner.yml scripts/go-live-gate.sh tests/unit/HostTopology.test.ts tests/unit/DeploymentRuntimePolicy.test.ts
git commit -m "fix: reduce runtime exposure and gate deploy path"
```

## Task 8: Full Verification Gate

**Files:**
- No source edits unless verification finds a new blocker.

**Step 1: Run backend build**

```bash
npm run build
```

Expected: exit `0`.

**Step 2: Run frontend build**

```bash
npm --prefix frontend run build
```

Expected: exit `0`.

**Step 3: Run targeted T0 tests**

```bash
npm test -- --runInBand \
  modules/b2b-portal/tests/api/controllers/B2BOrderTrustBoundary.test.ts \
  modules/b2b-portal/tests/api/controllers/B2BOrderConcurrency.test.ts \
  modules/b2b-portal/tests/api/controllers/B2BCustomerAccess.test.ts \
  modules/b2b-portal/tests/api/B2BCatalogCachePolicy.test.ts \
  tests/integration/auth-refresh-route.integration.test.ts \
  tests/rollback/RollbackDrillTests.ts \
  tests/unit/HostTopology.test.ts \
  tests/unit/DeploymentRuntimePolicy.test.ts
```

Expected: all PASS.

**Step 4: Run full serial suite**

```bash
npm test -- --runInBand
```

Expected: all suites PASS.

**Step 5: Run audits/security checks**

```bash
npm audit --omit=dev --audit-level=high
npm --prefix frontend audit --omit=dev --audit-level=high
```

Expected: no high/critical vulnerabilities or documented waivers.

**Step 6: Check worktree**

```bash
git status --short
```

Expected: only approved artifacts; `backups/` may remain untracked if generated by rollback drill.

## Post-Plan Notes

- This plan intentionally does not fix every audit finding. It focuses on T0 launch blockers.
- Remaining T+1/T+7 items should be planned separately: observability deployment, outbox lease/DLQ hardening if not fully covered, dependency replacement (`xlsx`), catalog pagination/facet materialization, module-boundary ports, and CI SAST/SCA/secrets gates.
