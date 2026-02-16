# AGENTS.md — Cypher ERP

## Build & Run

```bash
# Backend
npm run build                  # tsc && tsc-alias (strict mode, zero errors expected)
npm run dev                    # ts-node-dev --respawn src/server.ts (port 8000)
npm run lint                   # eslint 'src/**/*.ts' 'shared/**/*.ts' 'modules/**/*.ts'
npm run lint:fix               # eslint --fix
npm run format                 # prettier --write

# Frontend (cd frontend/)
npm run dev                    # vite (port 3000, proxies /api -> 8000)
npm run build                  # vite build
npm run type-check             # tsc --noEmit
```

## Test Commands

```bash
npm test                       # all unit tests (jest --passWithNoTests)
npm run test:integration       # jest --config jest.integration.config.ts
npm run test:e2e               # jest --config jest.e2e.config.ts (serial, 60s timeout)

# Single test file (most common)
npx jest path/to/File.test.ts
npx jest --testPathPattern=CreateOrder

# Single module tests
npx jest modules/orders/tests

# Integration single file
npx jest --config jest.integration.config.ts tests/integration/orders-inventory.integration.test.ts
```

Test locations: module tests live in `modules/<name>/tests/`, shared unit tests in `tests/unit/`,
integration in `tests/integration/`. Jest setup sets `JWT_SECRET` and `NODE_ENV=test` automatically.

## Architecture

Hexagonal / Clean Architecture with 31 backend modules under `modules/`.

```
modules/<name>/src/
├── domain/            # Entities, value objects, repository INTERFACES (ports)
├── application/       # Use cases, DTOs, application services, error classes
├── infrastructure/    # TypeORM entities, repository IMPLEMENTATIONS, cache, mappers, composition-root.ts
├── api/               # Express controllers, routes, Joi/Zod validators
└── index.ts           # ICypherModule export + re-exports
```

Each module has a **composition root** (`infrastructure/composition-root.ts`) that wires
repositories -> use cases -> controllers -> router. Modules are auto-discovered by
`shared/module-system/module-loader.ts` and mounted at `/api/v1/<moduleName>`.

Shared code lives in `shared/` (errors, middleware, types, utils, event bus, metrics).
Frontend is React 18 + Vite + Tailwind at `frontend/`.

## TypeScript & Path Aliases

Backend: `tsconfig.json` — strict: true, target: ES2022, module: commonjs.

```
@shared/*   -> shared/*
@modules/*  -> modules/*
@database/* -> database/*
```

Frontend: `frontend/tsconfig.json` — strict: true, noImplicitAny: false.

```
@/*         -> ./src/*
```

Within modules use **relative imports**. Cross-module use `@shared/` alias.
Avoid direct cross-module imports (e.g., `../../../inventory/src/...`).

## Code Style

**Prettier** (enforced): printWidth 100, singleQuote, trailingComma "all", semi, 2-space indent, LF.

**ESLint** rules:

- `no-console: warn`
- `@typescript-eslint/no-unused-vars: error` (prefix unused args with `_`)
- `@typescript-eslint/no-explicit-any: warn` — avoid `any` in new code
- `import/order: error` — groups: builtin > external > internal > parent > sibling > index, alphabetized, blank lines between groups

## Naming Conventions

| What                  | Convention              | Example                               |
| --------------------- | ----------------------- | ------------------------------------- |
| Domain entities       | PascalCase              | `Order.ts`, `Price.ts`                |
| Use cases             | PascalCase verb-noun    | `CreateOrder.ts`, `CalculatePrice.ts` |
| Controllers           | PascalCase + Controller | `OrderController.ts`                  |
| Routes                | kebab-case + .routes    | `order.routes.ts`                     |
| Repository interfaces | I + PascalCase          | `IOrderRepository.ts`                 |
| Repository impls      | TypeOrm + PascalCase    | `TypeOrmOrderRepository.ts`           |
| DB entities           | PascalCase + Entity     | `OrderEntity.ts`                      |
| Error classes         | PascalCase + Error      | `InsufficientStockError.ts`           |
| Tests                 | source name + .test.ts  | `CreateOrder.test.ts`                 |
| Frontend services     | kebab-case + .service   | `auth.service.ts`                     |
| Frontend stores       | kebab-case + .store     | `auth.store.ts`                       |
| Variables/functions   | camelCase               | `calculateTotal`                      |
| Constants             | UPPER_SNAKE_CASE        | `ERROR_ORDER_NOT_FOUND`               |
| Enums/Types           | PascalCase              | `OrderStatus`, `PricingTier`          |

## Error Handling

Two co-existing hierarchies:

1. **Shared `BaseError`** (`shared/errors/BaseError.ts`) — has `code`, `statusCode`, `isOperational`.
   Subclasses: `NotFoundError`(404), `ValidationError`(400), `UnauthorizedError`(401),
   `ForbiddenError`(403), `ConflictError`(409), `BusinessRuleError`(422).

2. **Module-level errors** — plain `extends Error` with `this.name` set. Used in domain/application.
   Example: `OrderNotFoundError`, `InsufficientStockError`.

**API response format** (`shared/utils/response.ts`):

```typescript
successResponse(data, meta?)          // { success: true, data, meta? }
errorResponse(code, message, status)  // { success: false, error: { code, message, statusCode } }
paginatedResponse(data, total, page, limit)
```

Error codes are centralized in `shared/constants/error-codes.ts`.

## Test Patterns

```typescript
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('CreateOrder Use Case', () => {
  let useCase: CreateOrder;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockRepo = { save: jest.fn(), findById: jest.fn() } as any;
    useCase = new CreateOrder(mockRepo);
  });

  it('should create order with valid input', async () => {
    mockRepo.save.mockResolvedValue(buildSavedOrder());
    const result = await useCase.execute(buildInput());
    expect(result.id).toBeDefined();
  });
});
```

Use `jest.Mocked<InterfaceType>` for typed mocks. Create builder functions for test data.
Each test gets fresh mocks in `beforeEach`.

## Frontend Stack

React 18, Vite, Tailwind CSS, React Router v6, Zustand (state), TanStack React Query (server state),
Lucide React (icons), Recharts (charts), react-hot-toast. Two separate auth systems:

- ERP: `apiClient` (custom fetch wrapper, `auth_token` in localStorage), login at `/login`
- B2B: `b2bApi` (axios instance, Zustand `b2b-auth-storage`), login at `/b2b-store/login`

## CI Pipeline (.github/workflows/ci.yml)

5 jobs: lint -> test (PostgreSQL 15 + Redis 7 containers) -> build -> security (npm audit) -> docker.
PRs use `build:incremental` and `test:changed`. Pushes run full `test:coverage`.
Gate command: `npm run ci:green` (build + frontend build + critical tests).
