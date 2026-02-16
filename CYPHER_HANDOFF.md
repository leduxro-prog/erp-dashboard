# CYPHER ERP — Handoff Document for AI Continuation

**Data:** 8 Februarie 2026
**Proiect:** CYPHER ERP pentru Ledux.ro
**Locatie:** `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/`
**Branch:** `develop` (31 commits)
**Scor Audit:** 83.25/100 (Grade A-)

---

## 1. CE ESTE CYPHER ERP

CYPHER este un sistem ERP/CRM enterprise construit de la zero pentru **Ledux.ro**, o firma de e-commerce din Romania specializata in iluminat LED. Sistemul gestioneaza pricing dinamic, stocuri multi-depozit, comenzi cu 14 stari, facturare SmartBill, sincronizare WooCommerce, portal B2B, notificari multi-canal, marketing automation, analytics si SEO.

### Business Context
- **Firma:** Ledux.ro — iluminat LED, Romania
- **Model:** Hybrid (stoc propriu + dropshipping)
- **Furnizori:** 5 (Aca Lighting, Masterled, Arelux, Braytron, FSL)
- **SKU-uri:** ~10,000 produse
- **Clienti B2B:** 100+ cu 4 tier-uri (0%/5%/10%/15% discount)
- **TVA Romania:** 19%
- **Depozite:** 3 locatii cu alocare bazata pe prioritate
- **Facturare:** SmartBill (ANAF compliance)
- **E-commerce:** WooCommerce (sync unidirectional Cypher → Web)

### Tech Stack
- **Runtime:** Node.js 20 LTS
- **Limbaj:** TypeScript 5.3+ (strict mode)
- **Framework:** Express.js
- **Database:** PostgreSQL 15 (TypeORM, connection pool 5-25)
- **Cache:** Redis 7 (L1 LRU in-memory → L2 Redis → L3 DB)
- **Queue:** BullMQ
- **Auth:** JWT + RBAC
- **Logging:** Winston (structured JSON)
- **Validare:** Joi
- **Teste:** Jest

---

## 2. ARHITECTURA

### Pattern: Hexagonal (Clean Architecture)
Fiecare modul urmeaza structura:
```
modules/{module-name}/
  src/
    domain/           # Entitati, repositories (interfete), services, errors
    application/      # Use-cases, DTOs, ports (interfete)
    infrastructure/   # TypeORM repos, API clients, jobs, cache, mappers
    api/              # Controllers, routes, validators
    index.ts          # Barrel exports
    {module}-module.ts # ICypherModule implementation
```

### Module System
- **Interfata:** `ICypherModule` (shared/module-system/module.interface.ts)
- **Registry:** Topological sort by dependencies (Kahn's algorithm)
- **Loader:** Auto-discovery din `modules/` directory
- **Lifecycle:** register → initialize → start → stop
- **Health:** Fiecare modul raporteaza health individual

### Fisiere Cheie Infrastructura
| Fisier | Ce face |
|--------|---------|
| `src/server.ts` | Express bootstrap, middleware stack, module loading, graceful shutdown |
| `src/data-source.ts` | TypeORM DataSource cu connection pool, read replica support |
| `src/config/env.validation.ts` | Joi schema pt 60+ env vars |
| `shared/module-system/module.interface.ts` | Contractul ICypherModule |
| `shared/module-system/module-registry.ts` | Singleton registry, dependency sort |
| `shared/module-system/module-loader.ts` | Auto-discovery, duck-typing validation |
| `shared/api/api-registry.ts` | 13 API-uri pre-configurate (SmartBill, WooCommerce, furnizori, shipping, payments, email) |
| `shared/api/api-client-factory.ts` | Singleton cu circuit breaker, rate limiter, retry per API |
| `shared/cache/cache-manager.ts` | L1/L2/L3 cache cu metrics (hit/miss/eviction/latency) |
| `shared/alerting/alert-manager.ts` | Multi-channel alerts (webhook, email, PagerDuty) cu deduplication |
| `shared/middleware/auth.middleware.ts` | JWT verify + requireRole RBAC |
| `shared/middleware/data-change-tracker.ts` | Before/after audit trail |
| `shared/utils/feature-flags-advanced.ts` | Redis-backed, percentage rollout, role-based |
| `shared/utils/pagination.ts` | Cursor-based + offset, MAX_PAGE_SIZE=200 |
| `shared/utils/circuit-breaker.ts` | CLOSED/OPEN/HALF_OPEN state machine |
| `shared/utils/batch-processor.ts` | 100K+ items cu backpressure, retry |
| `shared/utils/stream-processor.ts` | CSV/JSON export/import fara memory full load |
| `shared/utils/event-bus.ts` | Redis Pub/Sub cu reconnection retry |

---

## 3. CELE 14 MODULE IMPLEMENTATE

### A. Module Core (7) — Fully implemented cu routes, tests, composition roots

| # | Modul | Fisiere | Teste | Dependente | Ce face |
|---|-------|---------|-------|------------|---------|
| 1 | **pricing-engine** | 44 | 7 | — | Calcul pret dinamic: Cost × (1+Margin) × (1-TierDiscount) × (1-VolumeDiscount). 4 tier-uri, promotii, volume discounts |
| 2 | **inventory** | 44 | 8 | — | Stocuri multi-depozit (3 locatii), rezervari, miscari, low stock alerts. AlertCheckJob (batch optimizat) |
| 3 | **orders** | 38 | 9 | inventory | Comenzi cu 14 stari, livrare partiala, proforma/factura, status machine complet |
| 4 | **quotations** | 43 | 12 | inventory, pricing-engine | Oferte cu PDF, reminders, auto-expiry 15 zile, conversie la comanda |
| 5 | **smartbill** | 33 | 4 | orders | Integrare SmartBill: facturi, proforme, sync stoc, ANAF compliance |
| 6 | **suppliers** | 44 | 6 | — | 5 furnizori cu scrapere (Aca, Masterled, Arelux, Braytron, FSL), SKU mapping |
| 7 | **woocommerce-sync** | 46 | 9 | inventory, orders | Sync bidirectional: produse, comenzi, clienti. Real-time + full sync + retry |

### B. Module Noi (7) — Implementate cu domain, use-cases, module entry, dar necesita completare

| # | Modul | Fisiere | Teste | Dependente | Ce face |
|---|-------|---------|-------|------------|---------|
| 8 | **notifications** | 47 | 1 | — | Multi-canal: email (Nodemailer), SMS (Twilio), WhatsApp, push, in-app. Template engine, quiet hours |
| 9 | **configurators** | 37 | 4 | pricing-engine | Configurator magnetic track + LED strip. Calcul componente, compatibilitate, pret |
| 10 | **b2b-portal** | 30 | 1 | orders, pricing-engine | Inregistrare B2B cu validare CUI/IBAN, approval workflow, credit management, bulk ordering |
| 11 | **whatsapp** | 29 | 4 | notifications | WhatsApp Business API: notificari comenzi, conversatii suport, template messaging |
| 12 | **marketing** | 35 | 3 | notifications | Campanii, discount codes, email sequences, audience segmentation |
| 13 | **analytics** | 33 | 4 | — | Dashboards, rapoarte, KPI-uri, forecasting, metric snapshots |
| 14 | **seo-automation** | 31 | 2 | — | Meta tags, sitemap, structured data (JSON-LD), SEO audits |

---

## 4. SECURITATE IMPLEMENTATA

- **JWT Authentication** — Aplicat pe TOATE cele 8 route files
- **RBAC** — `requireRole('admin')` pe endpoint-uri sensibile (DELETE, sync, etc.)
- **Rate Limiting** — 1000 req/h general, 20 req/h pe /auth
- **CORS** — Whitelist cu origin-uri din env
- **Helmet** — CSP strict, HSTS, X-Frame-Options DENY
- **CSRF** — Origin/Referer validation (production only)
- **Input Sanitization** — XSS strip, prototype pollution, MongoDB ops
- **Request ID** — UUID v4 pe fiecare request (X-Request-ID header)
- **Audit Trail** — Who/what/when/where pe fiecare request
- **Data Change Tracking** — Before/after cu sensitive field hashing

---

## 5. OBSERVABILITATE IMPLEMENTATA

- **Winston Logger** — Structured JSON, file rotation, module-scoped
- **Metrics** — Request count, duration, p50/p95/p99, cache hit/miss
- **Health Checks** — /health/live, /health/ready, /health/detailed (cu real checks pt SmartBill, WooCommerce, Redis, PostgreSQL)
- **Alert Manager** — 10 reguli pre-definite, deduplication 5min, escalation 15min
- **Feature Flags** — Redis-backed, runtime toggle, percentage rollout, role-based
- **Tracing** — Request ID + Trace ID + Span ID propagation

---

## 6. DOCUMENTATIE EXISTENTA

| Fisier | Continut |
|--------|----------|
| `docs/ARCHITECTURE.md` | Arhitectura completa, ADR-uri, diagrame |
| `docs/MODULE_CREATION_GUIDE.md` | Ghid pas-cu-pas pt module noi |
| `docs/API_REFERENCE.md` | Toate endpoint-urile cu request/response |
| `docs/DEPLOYMENT_GUIDE.md` | Docker, manual deploy, env vars |
| `docs/SCALABILITY_GUIDE.md` | L1/L2/L3 cache, batch processing, stream processing |
| `docs/BUSINESS_RULES.md` | Formula pret, tier-uri, TVA, reguli stoc |
| `docs/CHANGELOG.md` | Istoric modificari |
| `AUDIT_REPORT.md` | Raport audit complet cu scoruri |
| `OBSERVABILITY_IMPLEMENTATION.md` | Ghid alerting, tracking, feature flags |
| `OBSERVABILITY_API_ENDPOINTS.md` | REST API reference pt observability |
| `OBSERVABILITY_QUICK_START.md` | Quick start pt monitoring |

---

## 7. CLAUDE SKILLS CREATE

4 skill-uri custom create in `~/.claude/skills/`:

| Skill | Ce face | SKILL.md lines |
|-------|---------|----------------|
| `cypher-module-generator` | Genereaza modul nou cu arhitectura hexagonala completa | 1,951 |
| `cypher-code-audit` | Audit enterprise: security, architecture, performance, quality | 183 + script |
| `cypher-api-test` | Smoke tests, integration tests, load tests | 1,210 + script |
| `cypher-deployment` | Deploy Docker/manual, health checks, migrations | 859 + 2 scripts |

---

## 8. GIT HISTORY (31 commits pe develop)

```
399fbc4 docs: add comprehensive enterprise audit report (83.25/100)
ec81854 feat: add alerting system, data change tracking, advanced feature flags
9bbf5c2 arch: add 100+ barrel exports (index.ts) at all layer boundaries
6103340 arch: implement ICypherModule for all 14 modules, add composition roots
f54238a quality: replace console.log with structured logger, fix as any casts
f5f8316 perf: fix N+1 query in AlertCheckJob, batch reservation saves
3db82da security: apply JWT auth to all module routes, enforce pagination limits
c1a3a75 feat(seo-automation): meta tags, sitemap, structured data, SEO audits
fd1bd38 feat(analytics): dashboards, reports, forecasting, metric snapshots
39c0bb6 feat(marketing): campaigns, discount codes, email sequences
2135fad feat(whatsapp): WhatsApp Business API integration
4343a9e feat(b2b-portal): B2B registration, approval, credit management
26cf1c3 feat(configurators): magnetic track + LED strip product configurators
d35e406 feat(notifications): multi-channel notification system
bef9c21 chore: add package-lock.json
b5d21fe docs: complete enterprise documentation (7 guides)
...earlier commits: scalability layer, multi-API adapter, module system, enterprise fixes, initial modules
```

---

## 9. CE MAI TREBUIE IMPLEMENTAT (PRIORITIZAT)

### PRIORITATE CRITICA (Sprint 1 — 2-3 zile)

#### 9.1 Database Migrations
**Status:** NU exista nicio migratie TypeORM
**Ce trebuie:**
- Crearea migratiilor initiale pt TOATE entitatile din cele 14 module
- `src/database/migrations/` — momentan gol
- Fiecare modul are entitati TypeORM in `infrastructure/entities/` dar nu au migration files
- Comanda: `typeorm migration:generate -d src/data-source.ts`
- **Fisiere relevante:** `src/data-source.ts` (migrations: `database/migrations/*.ts`)

#### 9.2 Eliminare `as any` ramase (145 instante)
**Status:** 145 ramase (din 178 initial, fixate 33)
**Ce trebuie:**
- Majoritatea sunt in teste si edge-cases
- Prioritate: fisierele din `modules/notifications/src/infrastructure/` si `modules/seo-automation/`
- Comanda pt gasire: `grep -rn "as any" modules/ --include="*.ts"`

#### 9.3 Eliminare `console.log` ramase (28 instante)
**Status:** 28 ramase (din 60 initial, fixate 32)
**Ce trebuie:**
- Majoritatea in shared layer: api-client-factory, api-client, rate-limiter, webhook-manager, query-optimizer, module-loader, module-registry, batch-processor, circuit-breaker, event-bus
- Inlocuire cu `import { logger } from '@shared/utils/logger'`
- Comanda: `grep -rn "console.log" shared/ --include="*.ts"`

#### 9.4 data-source.ts — Entitati lipsa
**Status:** Doar 6 module au entitati inregistrate in data-source.ts
**Ce trebuie:**
- Adaugare entity paths pt: notifications, configurators, b2b-portal, whatsapp, marketing, analytics, seo-automation
- Fisier: `src/data-source.ts` linia cu `entities: [...]`

---

### PRIORITATE HIGH (Sprint 2 — 1 saptamana)

#### 9.5 Teste — Acoperire 10.5% (target 30%+)
**Status:** 87 test files / 1,061 TS files
**Ce trebuie:**
- Module noi au 1-4 teste fiecare (insuficient)
- Fiecare use-case trebuie minimum 3 teste: happy path, error case, edge case
- Integration tests pt: API routes, database operations
- Module prioritare: notifications (1 test!), b2b-portal (1 test!), marketing (3 teste)
- Skill: foloseste `cypher-code-audit` skill pt audit pe fiecare modul

#### 9.6 Route Files pt Module Noi
**Status:** Doar 8 module au route files. 6 module (configurators, b2b-portal, whatsapp, marketing, analytics, seo-automation) au rute definite in module-entry DAR unele nu au fisier explicit `*.routes.ts`
**Ce trebuie:**
- Verificare ca TOATE modulele care expun API au routes + controllers + validators
- Adaugare auth middleware pe noile rute (pattern: `router.use(authenticateJWT)`)
- Adaugare Joi validators pe fiecare endpoint

#### 9.7 TypeORM Entities pentru Module Noi
**Status:** Module noi (8-14) au entitati in domain/ dar unele nu au TypeORM entity decorators
**Ce trebuie:**
- Verificare si completare `@Entity()`, `@Column()`, `@PrimaryGeneratedColumn()` pt:
  - analytics: Dashboard, Report, MetricSnapshot, Forecast
  - b2b-portal: B2BCustomer, CreditTransaction, SavedCart
  - configurators: Configuration, ConfiguratorTemplate
  - marketing: Campaign, DiscountCode, EmailSequence, AudienceSegment
  - notifications: Notification, NotificationTemplate, NotificationPreference, NotificationBatch
  - seo-automation: SeoAudit, MetaTag, Sitemap, StructuredData
  - whatsapp: WhatsAppMessage, WhatsAppConversation, WhatsAppTemplate

#### 9.8 Composition Roots — Dependency Injection Complet
**Status:** Toate modulele au composition-root.ts DAR unele sunt minimale
**Ce trebuie:**
- Verificare ca fiecare composition-root face DI corect: repository → use-cases → controller → router
- Module noi pot avea composition-root gol sau cu TODO-uri

---

### PRIORITATE MEDIUM (Sprint 3 — 2 saptamani)

#### 9.9 CI/CD Pipeline
**Status:** NU exista
**Ce trebuie:**
- `.github/workflows/ci.yml` — lint, test, build
- `.github/workflows/deploy.yml` — deploy pe staging/production
- `Dockerfile` + `docker-compose.yml` (vezi `docs/DEPLOYMENT_GUIDE.md`)
- `npm audit` automatizat

#### 9.10 Prometheus Metrics Export
**Status:** Metrics colectate intern dar nu exportate in format Prometheus
**Ce trebuie:**
- Endpoint `/metrics` cu format Prometheus text
- Grafana dashboard templates
- Labels: module, method, status, path

#### 9.11 OAuth2 / Social Login
**Status:** Doar JWT basic
**Ce trebuie:**
- Google OAuth2 pt admin panel
- Optional: Facebook/Apple login pt portal B2B

#### 9.12 API Key Rotation
**Status:** Chei statice in env vars
**Ce trebuie:**
- Sistem de rotatie automata pt SmartBill, WooCommerce API keys
- Vault integration (HashiCorp Vault sau AWS Secrets Manager)

#### 9.13 Input Validation 100%
**Status:** ~70% acoperire
**Ce trebuie:**
- Joi/Zod schemas pe TOATE endpoint-urile (unele module noi nu au validators/)
- Request body + query params + path params

#### 9.14 JSDoc Coverage 80%+
**Status:** ~60%
**Ce trebuie:**
- Toate functiile publice, interfetele si clasele trebuie JSDoc
- Prioritate: shared layer, domain entities, use-cases

#### 9.15 Email Templates
**Status:** Notifications module exista dar template-urile sunt placeholder
**Ce trebuie:**
- HTML email templates pt: order confirmation, shipping notification, invoice, quotation, B2B approval
- Responsive design, brand Ledux.ro

#### 9.16 Frontend Admin Panel
**Status:** NU exista frontend — doar API backend
**Ce trebuie:**
- React/Next.js admin panel
- Dashboard cu metrici, management comenzi, stocuri, clienti, facturi
- Aceasta este o componenta majora care necesita proiect separat

---

## 10. ENV VARS NECESARE

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cypher_erp
DB_USERNAME=cypher
DB_PASSWORD=<secret>
DB_POOL_MAX=25
DB_POOL_MIN=5

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<optional>

# JWT
JWT_SECRET=<min 32 chars>
JWT_EXPIRES_IN=24h

# SmartBill
SMARTBILL_API_URL=https://ws.smartbill.ro/SMBWS/api
SMARTBILL_USERNAME=<user>
SMARTBILL_TOKEN=<token>
SMARTBILL_COMPANY_CIF=<CIF>
SMARTBILL_SERIES_INVOICE=<series>
SMARTBILL_SERIES_PROFORMA=<series>
SMARTBILL_WAREHOUSE=<warehouse>

# WooCommerce
WOOCOMMERCE_URL=https://ledux.ro
WOOCOMMERCE_KEY=<key>
WOOCOMMERCE_SECRET=<secret>

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://ledux.ro,https://admin.ledux.ro
LOG_LEVEL=info
API_PREFIX=/api/v1

# Alerting
ALERT_WEBHOOK_URL=<slack/discord webhook>
ALERT_EMAIL_TO=admin@ledux.ro
ALERT_PAGERDUTY_KEY=<optional>

# WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_PHONE_ID=<phone_id>
WHATSAPP_TOKEN=<token>

# Email (Notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASS=<pass>
SENDGRID_API_KEY=<optional>
```

---

## 11. COMENZI UTILE

```bash
# Navigare
cd /sessions/hopeful-wizardly-babbage/mnt/erp/cypher/

# Vezi structura
find modules -maxdepth 1 -type d | sort

# Cauta probleme
grep -rn "as any" modules/ --include="*.ts" | wc -l
grep -rn "console.log" modules/ shared/ --include="*.ts" | wc -l
grep -rn "TODO" modules/ shared/ --include="*.ts"

# Git
git log --oneline
git diff --stat HEAD~5

# Numaratoare
find . -name "*.ts" -not -path "*/node_modules/*" | wc -l       # Total TS files
find . -name "*.test.ts" -o -name "*.spec.ts" | wc -l           # Test files
find . -name "*.ts" -not -path "*/node_modules/*" -exec wc -l {} + | tail -1  # Total lines

# Module
find modules -name "composition-root.ts" | sort
find modules -name "*.routes.ts" | sort
find modules -name "*-module.ts" -o -name "*Module.ts" | sort
find modules -name "index.ts" | wc -l
```

---

## 12. REGULI DE DEZVOLTARE

1. **Hexagonal Architecture** — Domain layer ZERO imports din infrastructure
2. **ICypherModule** — Orice modul nou TREBUIE sa implementeze interfata
3. **Barrel Exports** — index.ts la fiecare layer boundary
4. **Auth** — Toate rutele sub `router.use(authenticateJWT)` + `requireRole()` pe admin
5. **Logger** — Winston (`createModuleLogger(name)`) NU console.log
6. **Errors** — Extinde `BaseError`, NU throw generic Error
7. **Pagination** — MAX_PAGE_SIZE=200, prefer cursor-based
8. **Tests** — Minimum 3 per use-case: happy, error, edge
9. **Types** — ZERO `as any` in production code
10. **Commits** — Conventional commits: `feat:`, `fix:`, `perf:`, `docs:`, `arch:`

---

## 13. STATISTICI FINALE

| Metric | Valoare |
|--------|---------|
| Total TS files | 1,061 |
| Total linii cod | 110,195 |
| Module implementate | 14 |
| Test files | 87 |
| Git commits | 31 |
| Barrel exports (index.ts) | 167 |
| Composition roots | 15 |
| Route files | 8 |
| API-uri externe configurate | 13 |
| Middleware-uri shared | 10 |
| Documentatii | 11 fisiere .md |
| Claude Skills | 4 |
| Scor audit | 83.25/100 (A-) |

---

## 14. FORMULA DE PRICING (REFERINTA RAPIDA)

```
FinalPrice = Cost × (1 + Margin%) × (1 - TierDiscount%) × (1 - VolumeDiscount%)

Margins: Min 30%, Standard 60%, Premium 100%
TVA Romania: 19%

Customer Tiers:
  Tier 0 (Retail): 0% discount
  Tier 1 (Bronze): 5% discount
  Tier 2 (Silver): 10% discount
  Tier 3 (Gold): 15% discount
```

---

## 15. NEXT STEPS RECOMANDATE (IN ORDINE)

1. **Database migrations** — Fara ele, nimic nu porneste real
2. **Completare entitati TypeORM** pt module 8-14
3. **Inregistrare entitati** in `data-source.ts`
4. **Teste** — minim 30% coverage
5. **CI/CD pipeline** — GitHub Actions
6. **Docker compose** — PostgreSQL + Redis + App
7. **Eliminare `as any`** si `console.log` ramase
8. **Frontend admin panel** — React/Next.js

---

*Acest document contine TOATE informatiile necesare pentru a continua dezvoltarea CYPHER ERP intr-o sesiune noua de Claude Cowork.*
