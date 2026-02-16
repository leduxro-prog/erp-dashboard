# Cypher ERP — Full Audit Report

**Date**: 2026-02-15
**Auditor**: Claude Opus 4.6 (Antigravity)
**Scope**: Complete ERP + B2B Portal (backend + frontend), all 22 modules, 73 entities, infrastructure
**Codebase**: `/opt/cypher-erp` — Express/TypeScript, PostgreSQL, Redis, RabbitMQ, React/Vite

---

## Executive Summary

| Category        | Critical | High   | Medium | Low    | Total   |
| --------------- | -------- | ------ | ------ | ------ | ------- |
| Security        | 14       | 8      | 9      | 3      | 34      |
| Logic Bugs      | 11       | 12     | 16     | 5      | 44      |
| Incomplete/Stub | 8        | 6      | 12     | 4      | 30      |
| Data Model      | 7        | 5      | 6      | 3      | 21      |
| Performance     | 0        | 2      | 6      | 4      | 12      |
| Frontend        | 4        | 6      | 8      | 6      | 24      |
| Domain-Specific | 2        | 3      | 2      | 0      | 7       |
| **TOTAL**       | **46**   | **42** | **59** | **25** | **172** |

**Module Completeness Overview:**

| Module               | Completeness | Status                           |
| -------------------- | ------------ | -------------------------------- |
| Users                | 70%          | Functional but security gaps     |
| Orders               | 75%          | Domain layer is dead code        |
| Inventory            | 80%          | Route conflicts, domain bypassed |
| Pricing Engine       | 65%          | Event handlers all stubs         |
| Products             | **0%**       | NO MODULE EXISTS                 |
| Warehouse            | **0%**       | Embedded in Inventory            |
| SmartBill            | 80%          | Date format & idempotency bugs   |
| Banking              | 70%          | PDF parsing non-functional       |
| Financial Accounting | 80%          | Disconnected from SmartBill      |
| Marketing            | 60%          | Usage limits unenforced          |
| WooCommerce Sync     | 85%          | Dual controller confusion        |
| B2B Portal Backend   | 75%          | 29 issues (7 critical)           |
| B2B Portal Frontend  | 70%          | Mock data, type issues           |
| Notifications        | 75%          | Dispatch never called            |
| Settings             | 40%          | Plaintext secrets                |
| WhatsApp             | 35%          | 9 controller methods are stubs   |
| SEO                  | 40%          | 4 of 5 repos unimplemented       |
| AI (Python)          | 40%          | Scraper always returns empty     |
| AI (TypeScript)      | 30%          | Deprecated model, no auth        |
| Scheduler            | 70%          | WhatsApp sending is stub         |
| Analytics            | 70%          | Depends on 5 unverified ports    |
| Workflow Engine      | 80%          | Analytics endpoint 501           |
| Configurators        | 80%          | Decent                           |
| Outbox Relay         | 90%          | Best module                      |
| Security Module      | 70%          | JWT revocation is TODO           |

---

## PART 1: CRITICAL ISSUES (Must Fix Before Production)

### SEC-01: Admin Endpoints Have No Authentication

**Severity: CRITICAL | Location: `src/server.ts:303-515`**

All `/api/v1/admin/*` and `/api/v1/system/*` endpoints are mounted without any `authenticate` or `requireRole` middleware. Anyone can:

- Read/export all audit logs
- Replay DLQ events (re-execute payments/invoices)
- View all system metrics and module info

### SEC-02: Webhook Signature Verification Bypass

**Severity: CRITICAL | Location: `B2BPortalWebhookController.ts`**

If the `x-b2b-signature` header is simply omitted, signature verification is skipped entirely. An attacker can send arbitrary webhook payloads.

### SEC-03: Hardcoded JWT Fallback Secrets

**Severity: CRITICAL | Location: `JwtService.ts:21-23`**

```ts
this.accessSecret = process.env.JWT_SECRET || 'your-secret-key';
```

If env var is missing, JWTs are signed with a public string.

### SEC-04: Docker Default Credentials

**Severity: CRITICAL | Location: `docker-compose.yml:84-108`**

Default passwords for PostgreSQL, JWT, RabbitMQ, MeiliSearch, pgAdmin are all hardcoded as fallbacks. Production containers will use these if `.env` is incomplete.

### SEC-05: Users Module — No Auth on CRUD

**Severity: CRITICAL | Location: `UserController.ts:32-34`**

`GET /users`, `POST /users`, `DELETE /users/:id` — no authentication. Anyone can list users, create admin accounts, or delete users.

### SEC-06: 2FA Routes Unprotected

**Severity: CRITICAL | Location: `UserController.ts:27-30`**

2FA setup/verify/disable endpoints have no `authenticate` middleware. The separate `twofa.routes.ts` (which does have auth) is dead code — never wired into the module.

### SEC-07: Settings Module Stores Secrets in Plaintext

**Severity: CRITICAL | Location: `SettingsService.ts:179-216`**

SmartBill tokens, WooCommerce secrets, SMTP passwords, SMS API secrets are stored in a plain JSON file on disk with no encryption.

### SEC-08: Supplier Credentials in Plaintext JSON Column

**Severity: CRITICAL | Location: `SupplierEntityDb.credentials`**

API keys and passwords stored as plain JSON in the database.

### SEC-09: B2B Cart IDOR — No Ownership Check

**Severity: CRITICAL | Location: `B2BCatalogController.ts`**

Cart operations don't verify the cart belongs to the authenticated customer. User A can modify User B's cart.

### SEC-10: B2B Bulk Order — No Transaction, No Stock Deduction

**Severity: CRITICAL | Location: `B2BController.ts`**

`createBulkOrder` creates orders without wrapping in a DB transaction AND never deducts stock from `stock_levels`. Two concurrent bulk orders can oversell.

### FIN-01: VAT Rate 21% Instead of 19%

**Severity: CRITICAL | Location: 12+ files**

`VAT_RATE = 0.21` is used across the entire codebase. Romania's standard VAT is **19%**. Every customer is overcharged by 2%.

Locations:

- `shared/constants/pricing-tiers.ts:7`
- `shared/types/common.types.ts:103`
- `Order.ts:90`
- `OrderController.ts:47`
- `OrderCalculationService.ts:18`
- `OfflineTransactionService.ts:84-85`
- `SmartBillInvoice.ts:91`
- `SmartBillProforma.ts:78`
- `cart.store.ts:224`

### DATA-01: No Product Entity

**Severity: CRITICAL**

The ERP has **NO TypeORM `ProductEntity`**. `ProductPriceEntity` maps to `products` but has only 10 pricing columns. The `shared/types/product.types.ts` defines 30+ fields that exist nowhere in ORM code.

### DATA-02: No Customer Entity

**Severity: CRITICAL**

No `@Entity('customers')` exists anywhere. `customer.types.ts` defines 35+ fields. All customer ops use raw SQL.

### DATA-03: No Category Entity

**Severity: CRITICAL**

No `@Entity('categories')` exists. Products have `category_id` with no FK relation.

### DATA-04: Zero Validation Decorators on ALL 73 Entities

**Severity: CRITICAL**

Not a single entity uses `class-validator`. No `@IsEmail`, `@Length`, `@IsNotEmpty`. Invalid data can be persisted to any table.

### DATA-05: 7 Different PK Strategies Across 73 Entities

**Severity: CRITICAL**

UUID auto, UUID manual, integer auto, integer increment, bigint, varchar — cross-module FK type mismatches everywhere.

### LOGIC-01: Order Search Filter Silently Dropped

**Severity: CRITICAL | Location: `TypeOrmOrderRepository.ts:148-154`**

`data.filter(...)` result is NOT assigned back to `data`. Search does nothing.

### LOGIC-02: Partial Delivery Not Persisted

**Severity: CRITICAL | Location: `OrderController.ts:187-211`**

`recordPartialDelivery` updates in memory but never calls `repository.update()`. Changes are lost.

### LOGIC-03: Order Number Race Condition

**Severity: CRITICAL | Location: `TypeOrmOrderRepository.ts:58-62`**

Two concurrent orders generate the same number (COUNT+1 without row lock).

### LOGIC-04: Status Transitions Not Validated

**Severity: CRITICAL | Location: `OrderController.ts:151-185`**

Any status string is accepted — the domain `OrderStatusMachine` is completely bypassed.

### LOGIC-05: Inventory Route Ordering Conflict

**Severity: CRITICAL | Location: `inventory.routes.ts:30-33`**

`GET /:productId` is before `GET /alerts` and `GET /warehouses`. Express matches top-down — `/alerts` is unreachable.

---

## PART 2: HIGH-SEVERITY ISSUES

### SEC-11: CSRF Bypass When Headers Missing

**Location: `csrf.middleware.ts:112-119`** — Both `Origin` and `Referer` absent → request allowed.

### SEC-12: Global Error Handler Leaks Error Messages

**Location: `src/server.ts:523-527`** — `err.message` sent to client in production.

### SEC-13: Open Redirect on B2B Login

**Location: `B2BLoginPage.tsx:12`** — Redirect URL from query string with no validation.

### SEC-14: Auth Tokens in localStorage (Both ERP and B2B)

XSS-vulnerable. Should use HttpOnly cookies only.

### SEC-15: Weak Temp Password Fails Own Validation

**Location: `users-module.ts:69`** — `Math.random().toString(36).slice(-8)` has no uppercase/special chars but `UserService.ts:20-31` requires them.

### SEC-16: Backup Codes Stored Plaintext

**Location: `TwoFactorAuthService.ts:62`** — Comment says "Should be hashed!" but they're stored as-is.

### SEC-17: Sanitize Middleware Fails Open

**Location: `sanitize.middleware.ts:143-145`** — On error, continues with unsanitized input.

### SEC-18: Database & Redis Ports Exposed to Host

**Location: `docker-compose.yml:211, 282, 507-511`** — PostgreSQL 5432, Redis 6379, RabbitMQ AMQP exposed.

### FIN-02: SmartBill Date Format Wrong

**Location: `CreateInvoice.ts:142`** — Sends Unix timestamp, API expects `YYYY-MM-DD`.

### FIN-03: No Idempotency on Invoice Creation

**Location: `CreateInvoice.ts:63-70`** — If DB save fails after SmartBill API succeeds, orphan invoice exists in SmartBill.

### FIN-04: Banking PDF Import Non-Functional

**Location: `BankingController.ts:71`** — PDF binary buffer treated as UTF-8 text. Produces garbage.

### FIN-05: Three Disconnected Financial Systems

SmartBill, Banking, Financial Accounting operate independently. Creating a SmartBill invoice doesn't create an AR Invoice. Confirming a bank match doesn't update invoice payment status.

### FIN-06: Journal Posting Without Transaction

**Location: `GeneralLedgerService.ts:40-73`** — Account balances updated in loop without DB transaction. Failure mid-loop corrupts ledger.

### FIN-07: Currency Defaults to USD

**Location: `ArInvoice.ts:57`, `ApInvoice.ts:70`** — Should be RON.

### LOGIC-06: All Domain Layers Are Dead Code

Every module (Orders, Inventory, Pricing) has well-designed domain entities and use-cases that are **completely bypassed**. Controllers talk directly to TypeORM repos.

### LOGIC-07: Pricing Events — All 4 Handlers Empty

**Location: `pricing-module.ts:350-401`** — `onProductCreated`, `onProductDeleted`, `onInventoryUpdated`, `onWooCommerceSyncRequest` are empty TODOs.

### LOGIC-08: Marketing Usage Limits Unenforced

**Location: `TypeOrmDiscountCodeRepository.ts:101-104`** — `getCustomerUsageCount()` always returns 0.

### LOGIC-09: Tax Rate 0.21 Labeled as "19%"

**Location: `Order.ts:90`** — Comment says "19% VAT for Romania" but value is `0.21` (21%).

### LOGIC-10: Duplicate Audit Log Migrations

**Location: `database/migrations/`** — Two migrations create `audit_logs` with incompatible schemas (UUID vs INTEGER `user_id`).

### LOGIC-11: Event Bus Duplicate Handler Registration

**Location: `event-bus.ts:239-251`** — Each `subscribe()` adds a new `message` listener. O(n²) handler invocations.

---

## PART 3: MEDIUM-SEVERITY ISSUES (59 total)

### Infrastructure

1. **Stub CacheManager** (`server.ts:52-60`) — All calls are no-ops
2. **Stub ApiClientFactory** (`server.ts:62-66`) — Returns empty objects
3. **Stub FeatureFlagService** (`server.ts:68-77`) — `set()` is no-op
4. **Rate limiters use in-memory store** (`rate-limit.middleware.ts`) — Per-instance counters, not shared
5. **Metrics double-count** (`metrics-middleware.ts:264-265`) — Both `finish` and `close` events counted
6. **CacheService key prefix bug** (`CacheService.ts:46-102`) — Redis key vs memory cache key mismatch
7. **Data source entity paths** (`data-source.ts:32-36`) — `.ts` globs won't work in compiled JS
8. **JWT_SECRET_B2B not validated** at startup
9. **Audit runs before auth** (`server.ts:209-211`) — userId always undefined initially
10. **Middleware monkey-patching chain** — 5 middlewares override `res.send`/`res.json`
11. **Global mutable state** (`data-change-tracker.ts:344`) — `(global as any).currentUserId` unsafe in concurrent env
12. **Health check calls external APIs** (`health.middleware.ts:216-220`) — DDoS amplification risk

### B2B Backend

13. **B2B Checkout — no stock deduction** (`B2BCheckoutService.processCheckout`)
14. **Invoice count query ignores filters** (`B2BInvoiceController.ts`)
15. **LIMIT/OFFSET swapped** (`B2BPaymentController.ts:139`)
16. **Profile field mismatch** (`B2BCustomerController.ts:144`) — `billing_address` vs actual `legal_address`
17. **Credit transaction ID collision** — `Date.now()` + `Math.random()` insufficient
18. **Cart N+1 volume discount queries** (`B2BCartController.ts`)
19. **B2B module event handlers all stubs** (`b2b-module.ts`)

### Financial

20. **No duplicate invoice guard** (`CreateInvoice.ts`)
21. **No optimistic locking on payments** (`AccountsReceivableService.ts:28-42`, `SmartBillController.ts:161-225`)
22. **Banking matching ignores extracted invoice numbers** (`TypeOrmBankingRepository.ts:250-263`)
23. **KPI queries non-existent tables** (`FinancialKPIService.ts:127,166`)
24. **No input validation on financial routes** (`FinancialAccountingController.ts`)
25. **No RBAC on financial routes**
26. **Validator orderId type mismatch** — integer validated, UUID stored

### Marketing

27. **`validFrom` not checked** (`DiscountCode.ts:111-133`)
28. **Race condition on discount usage** (`ApplyDiscountCode.ts:114-125`)
29. **BUY_X_GET_Y unimplemented** (`DiscountCode.ts:207-213`)
30. **`minimumOrderAmount=0` treated as null** (`CreateDiscountCode.ts:141`)
31. **Campaign metrics skip zero values** (`Campaign.ts:212-227`)
32. **LoyaltyProgramService has no routes** — Dead code
33. **GenerateDiscountCodes O(n) per code** (`GenerateDiscountCodes.ts:117-124`)

### WooCommerce

34. **Two overlapping webhook controllers**
35. **Webhook returns 500** — triggers WooCommerce retry but idempotency already logged
36. **Webhook idempotency only patches `res.json`** — misses `res.send`/`res.end`
37. **Order webhook runs full PullOrders** instead of processing specific order

### Other Modules

38. **Notifications: SendNotification never dispatches** (`SendNotification.ts:139-162`)
39. **SEO: 4 of 5 repos unimplemented** (empty TODOs)
40. **WhatsApp: 9 controller methods are stubs**
41. **AI scraper always returns empty** (`mcp_agent.py:83-133`)
42. **AI chatbot no auth** (`api.py`)
43. **AI deprecated model** (`AiService.ts:15`) — `gemini-pro` → use `gemini-2.0-flash`
44. **AI sends entire client list** (`AiService.ts:47`) — PII leak to AI provider
45. **Scheduler WhatsApp stub** (`SchedulerService.ts:253-265`)
46. **Checkout TransactionOrchestrator 5 TODOs** (`TransactionOrchestrator.ts:339-572`)
47. **Quotations uses stub services** (`quotations/src/index.ts:45-73`)
48. **JWT revocation is TODO** (`JwtParser.ts:158`)

### Frontend

49. **ERP Dashboard 100% mock data** (`DashboardPage.tsx`)
50. **B2BPortal.tsx is dead code duplicate** (100% static data)
51. **B2BPortalPage.tsx partially mock** — only registrations tab works
52. **B2BProfilePage is stub** (31 lines)
53. **B2BCheckoutPage uses raw fetch** — bypasses b2bApi interceptor
54. **stores/index.ts missing cart/favorites exports**
55. **No Error Boundaries** for lazy-loaded pages
56. **Blob URL memory leak** (`b2b-api.ts:previewInvoice()`)
57. **Mixed Romanian/English UI** — no i18n
58. **B2BPaymentsPage "Restanțe" hardcoded = 0**
59. **CreditWidget potential infinite re-render**

---

## PART 4: MODULE COMPLETENESS DETAILS

### Modules That DO NOT EXIST (need creation)

1. **Products Module** — No product catalog, categories, or product CRUD
2. **Warehouse Module** — No standalone warehouse management

### Modules That Are Mostly Stubs (<50%)

3. **WhatsApp** (35%) — 9 of 12 controller methods are TODOs
4. **AI TypeScript** (30%) — Minimal Gemini wrapper
5. **AI Python** (40%) — Scaffolded framework with empty business logic
6. **SEO** (40%) — 4 of 5 repositories unimplemented
7. **Settings** (40%) — Works but stores secrets in plaintext
8. **Google Shopping / TikTok** (25%) — API client shells

### Modules With Critical Gaps (50-75%)

9. **Marketing** (60%) — Usage limits unenforced, BUY_X_GET_Y stub
10. **Pricing Engine** (65%) — All event handlers empty
11. **Users** (70%) — No auth on CRUD, no password reset
12. **Banking** (70%) — PDF parsing non-functional
13. **B2B Frontend** (70%) — Mock data, type issues
14. **B2B Backend** (75%) — 29 issues found
15. **Notifications** (75%) — Dispatch never called
16. **Orders** (75%) — Domain layer dead code, race conditions

### Modules That Are Mostly Complete (>75%)

17. **Inventory** (80%) — Route conflict, domain bypassed
18. **Financial Accounting** (80%) — Disconnected from other financial modules
19. **Workflow Engine** (80%) — Analytics not implemented
20. **Configurators** (80%) — Solid
21. **SmartBill** (80%) — Date format bug
22. **WooCommerce Sync** (85%) — Dual controller confusion
23. **Outbox Relay** (90%) — Best module in codebase

---

## PART 5: DATABASE & SCHEMA ISSUES

### Missing Core Entities

- **ProductEntity** — Only `ProductPriceEntity` with 10 columns
- **CustomerEntity** — No ORM entity at all
- **CategoryEntity** — No ORM entity at all
- **ProductTranslationEntity** — Interface exists, no entity
- **ProductImageEntity** — Interface exists, no entity

### Naming Inconsistencies

- ~50/50 split between snake_case and camelCase column naming
- Entity class suffixes: `Entity`, `EntityDb`, no suffix — all mixed

### Missing Indexes (Performance Risk)

- `BankAccountEntity` — ZERO indexes (not even on IBAN)
- `BankTransactionEntity` — ZERO indexes
- `PaymentMatchEntity` — ZERO indexes
- `ProductPriceEntity` — No index on SKU or category_id
- `VolumeDiscountRuleEntity` — No index on product_id
- `UserEntity` — No index on role or is_active

### Missing Relations

Most entities define FK columns but NO `@ManyToOne`/`@OneToMany`:

- `OrderEntity.customer_id` → no relation
- `OrderItemEntity.product_id` → no relation
- `StockItemEntity.product_id` → no relation
- All `*Entity.created_by` → no relation to UserEntity

### No Soft Delete

Zero entities use `@DeleteDateColumn`. But 20+ raw SQL queries reference `deleted_at IS NULL`.

### Orphaned/Duplicate Migrations

- `customer_addresses` table has migration but NO entity
- Two `audit_log(s)` migrations with incompatible schemas
- Only 13 migrations for 73 entities — most rely on `synchronize: true`

---

## PART 6: DOMAIN-SPECIFIC RECOMMENDATIONS (Lighting/Electrical/Electronics)

### Missing Product Specifications

For a lighting/electrical distributor, the product model needs:

| Field                 | Type    | Why                                 |
| --------------------- | ------- | ----------------------------------- |
| Wattage (W)           | number  | Core electrical spec                |
| Voltage (V)           | string  | "220-240V", "12V"                   |
| Lumens (lm)           | number  | Light output                        |
| Color Temperature (K) | number  | 2700K warm, 6500K cool              |
| IP Rating             | string  | "IP44", "IP65" — ingress protection |
| CRI                   | number  | Color Rendering Index (80+, 90+)    |
| Beam Angle            | number  | Degrees                             |
| Socket/Base Type      | string  | E27, GU10, G13, etc.                |
| Dimmable              | boolean | Yes/No                              |
| Energy Rating         | string  | A++, A+, A, B                       |
| Lamp Life             | number  | Hours (25000, 50000)                |
| Power Factor          | number  | 0.0-1.0                             |
| Frequency             | string  | "50Hz", "50-60Hz"                   |

### Missing Domain Entities

1. **ProductCertification** — CE, RoHS, WEEE, ENEC compliance tracking
2. **WarrantyTracking** — Per-product/per-order warranty periods
3. **SerialNumberTracking** — For high-value electronics
4. **TechnicalDataSheet** — PDF/document management per product
5. **ProductCompatibility** — Which driver fits which luminaire, which lamp fits which fixture
6. **ProductLifecycle** — Obsolescence tracking, replacement SKU mapping
7. **InstallationGuide** — For B2B customers, installer instructions
8. **Compliance/Safety** — Product recall tracking, safety certifications

### Recommended B2B Features for Electrical Distribution

1. **Technical Product Search** — Filter by wattage, voltage, lumens, IP rating, socket type
2. **Compatibility Checker** — "Show compatible drivers for luminaire X"
3. **Project Lists** — B2B customers create project-based shopping lists (e.g., "Hotel Renovation 2026")
4. **Quick Reorder** — Repeat previous orders (common in B2B electrical supply)
5. **Volume Calculator** — "How many fixtures for X m² at Y lux?"
6. **Datasheet Downloads** — PDF technical sheets per product
7. **EOL Notifications** — Email when a product they buy is being discontinued
8. **RoHS/CE Compliance Reports** — Exportable per-project compliance documentation
9. **Light Planning Integration** — DIALux/Relux file imports
10. **Cable Calculator** — Calculate required cable section based on load/distance
11. **Multi-unit Pricing Display** — Show price per unit, per pack, per pallet
12. **Stock Alerts** — Subscribe to back-in-stock notifications per product

---

## PART 7: TOP 20 PRIORITIES FOR IMMEDIATE FIX

### P0 — Fix Before Any Customer Use

1. **Fix VAT rate** from 0.21 to 0.19 across ALL 12+ locations
2. **Add auth middleware** to ALL admin/system endpoints in server.ts
3. **Fix webhook signature bypass** in B2BPortalWebhookController
4. **Add auth to Users CRUD endpoints**
5. **Fix order number race condition** (use DB sequence)
6. **Fix order search** (assign filter result back)
7. **Fix partial delivery** (call repository.update)

### P1 — Fix Within First Week

8. **Remove hardcoded JWT fallback secrets**
9. **Encrypt settings/supplier credentials at rest**
10. **Fix SmartBill date format** (timestamp → YYYY-MM-DD)
11. **Fix inventory route ordering** (move `/alerts` before `/:productId`)
12. **Add stock deduction to B2B checkout/bulk order**
13. **Wire 2FA routes properly** (use twofa.routes.ts, remove duplicates)
14. **Fix B2B cart IDOR** (add ownership check)
15. **Fix LIMIT/OFFSET swap** in B2BPaymentController

### P2 — Fix Within First Month

16. **Create ProductEntity** with proper TypeORM mapping
17. **Create CustomerEntity** with proper TypeORM mapping
18. **Link financial systems** (SmartBill → AR Invoice → Banking)
19. **Replace mock data** in ERP Dashboard and B2B Portal pages
20. **Add class-validator decorators** to critical entities

---

_Report generated by 7 parallel audit agents examining 300+ source files across 22 modules._
_Total lines of code audited: ~80,000+ (backend) + ~30,000+ (frontend)_
