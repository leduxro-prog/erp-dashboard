# Build Baseline Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore `npm run build` on a clean worktree without changing runtime behavior beyond minimal compile-safe compatibility fixes.

**Architecture:** Fix one independent build-failure domain at a time, using the smallest source-compatible change and running `npm run build` after each domain. Avoid broad refactors, avoid disabling production features silently, and treat Google Auth as approval-gated because project policy freezes that flow.

**Tech Stack:** TypeScript, Express module loader, TypeORM, Jest, Docker Compose runtime.

---

## Baseline Evidence

Fresh command in `/root/.config/superpowers/worktrees/cypher-erp/build-baseline-remediation`:

```bash
npm run build
```

Current failure categories:

- B2B route/controller contract drift:
  - missing `listProductsSchema`
  - missing `B2BController.previewDocument`
  - missing `B2BOrderController.downloadOrderModelPdf`
- Orders module still imports NestJS decorators in an Express/TypeORM codebase.
- `search-index` module imports files that do not exist.
- `shared/utils/brand-strategy.ts` is missing but used by Settings and SEO.
- SmartBill imports missing `CreateB2BProforma` use case.
- `src/server.ts` imports missing `website-sync.routes`.
- Suppliers module has missing service/scraper files and contract drift.
- Users module has controller/module/service drift; Google Auth path is involved and must not be changed without explicit owner approval.

## Non-Negotiable Rules

- Do not modify Google Auth behavior without explicit owner approval.
- Do not remove live route wiring just to make build pass unless the route is confirmed unused or replaced by a safe compatibility implementation.
- Do not add NestJS dependencies; remove leftover NestJS decorators/imports instead.
- Do not change production DB or migrations as part of build restoration unless a task explicitly requires it and is separately approved.
- Run `npm run build` after each task or explain why it cannot yet pass.
- Do not commit unless explicitly requested.

---

### Task 1: Fix B2B Route/Controller Contract Drift

**Files:**
- Modify: `modules/b2b-portal/src/api/validators/b2b.validators.ts`
- Modify: `modules/b2b-portal/src/api/controllers/B2BController.ts`
- Modify: `modules/b2b-portal/src/api/controllers/B2BOrderController.ts`
- Test: `modules/b2b-portal/tests/api/controllers/B2BProductDetailsGallery.test.ts`

**Step 1: Add `listProductsSchema`**

Add an exported Joi schema allowing the query params already consumed by `B2BController.listProducts`:

```ts
export const listProductsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().allow('').optional(),
  category: Joi.string().allow('').optional(),
  stock: Joi.string().valid('stock', 'local', 'supplier').optional(),
  compact: Joi.boolean().truthy('true').falsy('false').optional(),
  sort: Joi.string().valid('newest', 'name', 'price_asc', 'price_desc', 'stock').optional(),
  kelvin: Joi.alternatives().try(Joi.number(), Joi.array().items(Joi.number())).optional(),
  ip: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  brand: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  mountingType: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  mounting_type: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  stripType: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  strip_type: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  ledVoltage: Joi.alternatives().try(Joi.number(), Joi.array().items(Joi.number())).optional(),
  led_voltage: Joi.alternatives().try(Joi.number(), Joi.array().items(Joi.number())).optional(),
  lightColor: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  light_color: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
}).unknown(false);
```

Keep it permissive enough to avoid reintroducing catalog `400` errors.

**Step 2: Add safe `previewDocument` compatibility method**

Add `previewDocument(req, res, next)` to `B2BController` only if it can be made safe:

- allow only `http:` and `https:` URLs
- reject localhost/private/link-local/internal hosts
- set short timeout
- cap response size
- return clear `400` for invalid URL and `502` for fetch failure

If this cannot be implemented safely in the current pass, remove the route only after confirming the frontend does not depend on it. Current evidence shows frontend does call it, so prefer safe method.

**Step 3: Add `downloadOrderModelPdf` compatibility method**

Add `downloadOrderModelPdf(req, res, next)` to `B2BOrderController` by delegating to an existing order PDF/model method if one exists. If no generator exists, return `501 Not Implemented` with typed method present so build passes without pretending to generate a PDF.

**Step 4: Verify**

Run:

```bash
npm run test -- --runInBand modules/b2b-portal/tests/api/controllers/B2BProductDetailsGallery.test.ts
npm run build
```

Expected: B2B-specific errors disappear. Other domains may still fail.

---

### Task 2: Remove NestJS Remnants From Orders Infrastructure

**Files:**
- Modify: `modules/orders/src/infrastructure/cache/OrderCache.ts`
- Modify: `modules/orders/src/infrastructure/mappers/OrderMapper.ts`
- Modify: `modules/orders/src/infrastructure/repositories/TypeOrmOrderRepository.ts`

**Step 1: Remove Nest imports/decorators**

Delete imports from `@nestjs/common` and `@nestjs/typeorm`.

Remove `@Injectable()` and `@InjectDataSource()` decorators.

Keep constructor signatures as plain TypeScript.

**Step 2: Verify**

Run:

```bash
npm run build
```

Expected: `@nestjs/*` errors disappear.

---

### Task 3: Restore Missing `brand-strategy` Utility

**Files:**
- Create: `shared/utils/brand-strategy.ts`

**Step 1: Implement used exports only**

Provide exactly the exports consumed by Settings and SEO:

- `BrandStrategySettings`
- `getDefaultBrandStrategy()`
- `resolveBrandStrategyFromSettings(settings?: unknown)`
- `getBrandVisualShortlist(strategy?: BrandStrategySettings)`
- `loadBrandStrategySync()`

The default shape must include fields used by current code:

- `brandName`
- `website`
- `seo.titleSuffix`
- `seo.metaDescriptionCta`

**Step 2: Keep it deterministic**

Do not perform async I/O. `loadBrandStrategySync()` may read local config only if it fails closed to defaults.

**Step 3: Verify**

Run:

```bash
npm run build
```

Expected: `@shared/utils/brand-strategy` errors disappear.

---

### Task 4: Restore Search Index Module Shell

**Files:**
- Create: `modules/search-index/src/api/image-search-admin.routes.ts`
- Create: `modules/search-index/src/api/ImageSearchAdminController.ts`
- Create: `modules/search-index/src/services/ImageSearchIndexer.ts`
- Create: `modules/search-index/src/jobs/ImageSearchIndexJob.ts`
- Test: `modules/search-index/tests/SearchIndexModule.test.ts`

**Step 1: Implement minimal compile-safe shell**

Implement the interfaces implied by `search-index-module.ts`:

- admin router factory exposing `/admin/image-search/health`
- controller with health/status method
- indexer service with no-op status methods
- job class with start/stop or schedule methods expected by module

**Step 2: Avoid fake indexing**

Return explicit status like `disabled` or `not_configured` rather than pretending indexing ran.

**Step 3: Verify**

Run:

```bash
npm run test -- --runInBand modules/search-index/tests/SearchIndexModule.test.ts
npm run build
```

Expected: search-index missing file errors disappear.

---

### Task 5: Restore SmartBill B2B Proforma Use Case

**Files:**
- Create: `modules/smartbill/src/application/use-cases/CreateB2BProforma.ts`
- Read pattern: `modules/smartbill/src/application/use-cases/CreateProforma.ts`
- Read pattern: `modules/smartbill/src/application/use-cases/CreateProformaFromQuote.ts`

**Step 1: Match constructor expected by `modules/smartbill/src/index.ts`**

Implement `CreateB2BProformaUseCase` with the exact constructor signature currently used.

**Step 2: Fail safely if B2B payload is insufficient**

If required order/customer fields are missing, return a clear error/result and log; do not generate invalid invoices.

**Step 3: Verify**

Run:

```bash
npm run build
```

Expected: SmartBill missing use-case error disappears.

---

### Task 6: Restore Website Sync Route Shell Safely

**Files:**
- Create: `src/routes/website-sync.routes.ts`

**Step 1: Implement `createWebsiteSyncRouter(dataSource, env)`**

The route module must export the function expected by `src/server.ts`.

Use token protection from `env` and return `401/403` for missing/invalid token.

If actual sync handlers are not present, expose a health/status endpoint and return `501` for mutation endpoints.

**Step 2: Verify**

Run:

```bash
npm run build
```

Expected: `website-sync.routes` missing module error disappears.

---

### Task 7: Suppliers Contract Reconciliation

**Files:**
- Modify: `modules/suppliers/src/domain/ports/IScraper.ts`
- Modify: `modules/suppliers/src/application/dtos/supplier.dtos.ts`
- Modify: `modules/suppliers/src/application/ports/ISupplierRepository.ts`
- Modify: `modules/suppliers/src/domain/repositories/ISupplierRepository.ts`
- Modify: `modules/suppliers/src/domain/index.ts`
- Modify: `modules/suppliers/src/domain/entities/SupplierProduct.ts`
- Modify: `modules/suppliers/src/infrastructure/repositories/TypeOrmSupplierRepository.ts`
- Modify: `modules/suppliers/src/infrastructure/composition-root.ts`
- Modify: `modules/suppliers/src/infrastructure/jobs/SupplierSyncJob.ts`
- Create or remove imports for missing scrapers/services after confirming intent.

**Step 1: Extend types with optional fields already consumed**

Add optional fields to `ScrapedProduct`, `SupplierProduct`, and `ScrapeResult` rather than rewriting use-cases.

**Step 2: Add missing repository method signatures**

Add signatures for methods already called:

- `upsertProductSpecifications`
- `getSyncReports`

Add `CategoryMarkup` and `ManufacturerMarkup` types if repository implementation uses them.

**Step 3: Resolve missing services/scrapers intentionally**

For missing files referenced by imports, either:

- create compile-safe real/minimal implementations, or
- remove unsupported supplier codes/imports from `ScraperFactory` if feature is not ready.

Do not leave fake scraper behavior that appears production-ready.

**Step 4: Fix strict typing issues in `AcaLightingScraper`**

Add explicit element/array types instead of broad `any` where practical.

**Step 5: Verify**

Run:

```bash
npm --prefix modules/suppliers run typecheck
npm run build
```

Expected: suppliers errors disappear.

---

### Task 8: Users Module Compile Fixes (Google Auth Approval Gate)

**Files:**
- Modify: `modules/users/src/users-module.ts`
- Modify only with explicit approval: `modules/users/src/application/services/UserService.ts`
- Modify only with explicit approval: Google login path in `modules/users/src/api/controllers/UserController.ts`

**Step 1: Fix non-Google constructor wiring**

Instantiate `TwoFactorAuthService` and pass it to `UserController` if this is only constructor drift.

**Step 2: Fix B2B user payload shape**

Update old B2B event user creation payload to current `UserService.create()` DTO:

- `email`
- generated password
- `first_name`
- `last_name`
- valid `UserRole`

Drop unsupported `username` and `isActive` fields.

**Step 3: HOLD for Google Auth method**

`UserController` calls `findOrCreateGoogleUser()`. Adding this method changes backend Google login behavior. Because project policy freezes Google Auth, stop and request explicit owner approval before implementing or altering this path.

If approval is granted, implement additive compatibility only:

- do not remove existing Google route
- do not change frontend OAuth wiring
- create users with safe defaults and no enumeration behavior
- add source-level regression test for Google wiring preservation

**Step 4: Verify**

Run:

```bash
npm run build
```

Expected: users errors disappear after approved Google-compatible fix.

---

### Task 9: Final Build Verification

**Files:**
- None

**Step 1: Run full build**

Run:

```bash
npm run build
```

Expected: PASS.

**Step 2: Run relevant targeted tests**

Run at minimum:

```bash
npm run test -- --runInBand \
  modules/b2b-portal/tests/api/controllers/B2BProductDetailsGallery.test.ts \
  modules/search-index/tests/SearchIndexModule.test.ts
```

Add supplier/users/smartbill tests if touched and available.

**Step 3: Re-run B2B image targeted test in image remediation worktree before merge/deploy**

Do not deploy image remediation until this build baseline passes in the same codebase branch.

---

## Stop Points

- Stop before Task 8 Google method implementation until owner explicitly approves Google Auth backend compatibility changes.
- Stop if supplier fixes require DB migrations or behavior changes beyond compile-time contract alignment.
- Stop if any task requires removing a production route rather than providing a safe compatibility implementation.
- Stop if `npm run build` reveals new errors outside the scoped category after a task; re-plan that category before continuing.
