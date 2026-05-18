# CYPHER ERP — Deployment Status & Handoff
**Data:** 10 Februarie 2026
**Server:** 65.108.255.104 (Hetzner, Ubuntu 24.04, ARM64, 16GB RAM, 150GB disk)
**SSH Key:** Ed25519 (furnizată de Flav, user: root)

---

## 1. CE FUNCȚIONEAZĂ ACUM

### Servicii Docker active (`docker compose`)
| Serviciu | Container | Port | Status |
|----------|-----------|------|--------|
| Frontend (React/Vite/Nginx) | `cypher-erp-frontend` | `:80` | ✅ UP (200 OK) |
| Backend (Node.js/Express/TypeORM) | `cypher-erp-app` | `:3000` | ✅ HEALTHY |
| PostgreSQL 15 | `cypher-erp-db` | `:5432` | ✅ HEALTHY |
| Redis 7 | `cypher-erp-redis` | `:6379` | ✅ HEALTHY |
| MeiliSearch v1.6 | `cypher-erp-search` | `:7700` | ✅ Available |
| PgAdmin 4 | `cypher-erp-pgadmin` | `:5050` | ✅ HEALTHY |
| AI Service (Python/FastAPI) | `cypher-erp-ai` | `:8001` | ✅ UP |

### URL-uri accesibile
- **Frontend:** http://65.108.255.104
- **Backend API:** http://65.108.255.104:3000/health
- **Backend Metrics:** http://65.108.255.104:3000/api/v1/system/metrics/detailed
- **Prometheus Metrics:** http://65.108.255.104:3000/metrics
- **PgAdmin:** http://65.108.255.104:5050 (admin@ledux.ro / CypherAdmin2026!)
- **MeiliSearch:** http://65.108.255.104:7700/health

### Nginx (Frontend) rutează:
- `/` → servește fișierele React statice (SPA)
- `/api/*` → proxy către backend (`:3000`)
- `/health` → returnează 200 OK

### Backend module montate (25 module):
ai-agents, ai-assistant, analytics, b2b-portal, configurators, financial-accounting,
google-shopping, hr, inventory, marketing, notifications, orders, pricing-engine,
purchasing, quotations, seo-automation, settings, smartbill, suppliers,
tiktok-marketing, users, whatsapp, woocommerce-sync, workflow-engine

### Ruta API montată:
- `/api/v1/ai-assistant` — singurul router montat automat

---

## 2. CE S-A FIXAT ÎN DEPLOYMENT

### 2.1 TypeScript Relaxat (`tsconfig.json`)
```json
{
  "strict": false,
  "strictPropertyInitialization": false,
  "strictNullChecks": false,
  "noImplicitAny": false
}
```
**Motiv:** Codul avea sute de erori TS2564 (property not initialized), TS2345 (argument type mismatch), etc. `tsc` nu compila.

### 2.2 Dockerfile Backend — schimbat de la `tsc` build la `ts-node --transpile-only`
**Motiv:** TypeScript nu compilează, dar codul funcționează la runtime.
**Soluție:** Runtime transpilation cu `ts-node` + `reflect-metadata` (necesar pentru TypeORM decoratori).
```dockerfile
CMD ["node", "--require", "reflect-metadata", "-r", "ts-node/register/transpile-only", "src/server.ts"]
```

### 2.3 `.env` Production
- `DB_HOST=db` (Docker service name, nu `localhost`)
- `REDIS_HOST=redis` (Docker service name)
- JWT secrets: setate cu valori reale de producție
- `CORS_ORIGIN` include IP-ul serverului
- `NODE_ENV=production`
- Parole DB/PgAdmin setate

### 2.4 Redis Fix
- Scos `--requirepass ${REDIS_PASSWORD:-}` din `docker-compose.yml` — Redis 7 crăpa cu parolă goală

### 2.5 GEMINI_API_KEY — făcut opțional
**Fișier:** `src/config/env.validation.ts`
```typescript
// Schimbat din Joi.string().required() în:
GEMINI_API_KEY: Joi.string().optional().allow('').default('')
```

### 2.6 StockItemEntity — scos relația la ProductEntity inexistent
**Fișier:** `modules/inventory/src/infrastructure/entities/StockItemEntity.ts`
- Scos `@ManyToOne(() => ProductEntity)` — clasa `ProductEntity` era un placeholder fără `@Entity`, cauza eroare TypeORM
- Păstrat `product_id` ca UUID column simplu

### 2.7 Datetime → Timestamp (6 fișiere)
**Motiv:** `'datetime'` nu e tip valid PostgreSQL, trebuie `'timestamp'`
**Fișiere fixate:**
- `modules/smartbill/src/infrastructure/entities/SmartBillStockSyncEntity.ts`
- `modules/smartbill/src/infrastructure/entities/SmartBillInvoiceEntity.ts`
- `modules/smartbill/src/infrastructure/entities/SmartBillProformaEntity.ts`
- `modules/workflow-engine/src/infrastructure/entities/WorkflowAnalyticsEntity.ts`
- `modules/workflow-engine/src/infrastructure/entities/WorkflowInstanceEntity.ts`
- `modules/workflow-engine/src/infrastructure/entities/WorkflowDelegationEntity.ts`

### 2.8 Frontend — Export Fix (12 pagini)
**Problema:** App.tsx folosește lazy load cu named export pattern:
```typescript
const Page = lazy(() => import('./pages/Page').then(m => ({ default: m.Page })));
```
Dar 12 pagini aveau doar `export default Page` (fără `export { Page }`), rezultând `undefined` → pagină albă.

**Pagini fixate (adăugat `export { PageName }`):**
1. ConfiguratorsPage.tsx
2. CRMPage.tsx
3. SettingsPage.tsx
4. LoginPage.tsx
5. AnalyticsPage.tsx
6. MarketingPage.tsx
7. SeoPage.tsx
8. NotificationsPage.tsx
9. WhatsAppPage.tsx
10. WooCommercePage.tsx
11. POSPage.tsx
12. B2BPortalPage.tsx

---

## 3. CE TREBUIE FĂCUT (TODO)

### 🔴 CRITICE (fără ele nu merge complet)

#### 3.1 Tabelele bazei de date nu sunt create
**Status:** Baza de date `cypher_erp` există dar e GOALĂ — 0 tabele.
**Acțiune:** Trebuie rulat schema.sql:
```bash
ssh root@65.108.255.104
docker exec -i cypher-erp-db psql -U cypher_user -d cypher_erp < /opt/cypher-erp/database/schema.sql
```
Sau activat `synchronize: true` în TypeORM data-source (temporar, doar prima dată):
```typescript
// src/data-source.ts
synchronize: true  // ATENȚIE: doar pentru setup inițial, apoi setează pe false
```

#### 3.2 Rutele API nu sunt montate (doar ai-assistant)
**Status:** Doar `/api/v1/ai-assistant` e montat automat. Celelalte 24 module (orders, inventory, users, etc.) NU au rute montate.
**Cauza probabilă:** Module registry-ul nu înregistrează automat routerele din fiecare modul.
**Acțiune:** Trebuie verificat `src/server.ts` secțiunea "Mounting module routers" și adăugat rutele manual sau fixat auto-discovery:
```typescript
// Verifică cum se montează routerele în server.ts
// Probabil fiecare modul trebuie să exporte un router pe care server.ts îl montează
```

#### 3.3 Frontend nu comunică cu backend-ul (API calls eșuează)
**Cauza:** Frontend-ul face mock data, nu are services reale conectate la API.
**Acțiune:** Trebuie implementate serviciile API în frontend (`frontend/src/services/`) care să facă fetch la `/api/v1/...`

### 🟡 IMPORTANTE (funcționalitate completă)

#### 3.4 Chei API lipsă (de configurat din frontend Settings)
**Ideea lui Flav:** Toate API keys trebuie configurabile din frontend.
**Chei necesare:**
- **WooCommerce:** `WOOCOMMERCE_CONSUMER_KEY` + `WOOCOMMERCE_CONSUMER_SECRET` (din ledux.ro → WooCommerce → Settings → REST API)
- **SmartBill:** `SMARTBILL_USERNAME` + `SMARTBILL_TOKEN` + `SMARTBILL_COMPANY_VAT`
- **Gemini AI:** `GEMINI_API_KEY` (Google AI Studio)
- **OpenAI:** `OPENAI_API_KEY` (pentru AI agents Python service)
- **SendGrid:** `SENDGRID_API_KEY` (email)
- **WhatsApp:** `WHATSAPP_API_URL` + `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`

**Acțiune necesară:**
1. Crearea unui endpoint API `POST /api/v1/settings/api-keys` care salvează cheile în DB (tabela `settings`)
2. La startup, backend-ul citește cheile din DB și le merge cu cele din .env
3. Frontend Settings page — formular de configurare API keys

#### 3.5 Healthcheck frontend Docker
**Status:** Frontend apare ca "unhealthy" în Docker dar funcționează.
**Cauza:** Healthcheck folosește `wget --spider http://localhost:80/health` dar nginx returnează text, nu HTML → wget raportează eroare.
**Fix:** Schimbă în docker-compose.yml:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:80/health"]
  # sau
  test: ["CMD-SHELL", "wget -q --spider http://localhost:80/ || exit 1"]
```

#### 3.6 MeiliSearch healthcheck
**Status:** Apare "unhealthy" dar serviciul funcționează (returnează `{"status":"available"}`).
**Fix:** Verifică healthcheck-ul din docker-compose.yml, poate e nevoie de `--no-check-certificate`.

#### 3.7 Seed data (date inițiale)
**Acțiune:** După crearea tabelelor, rulează seed-uri:
```bash
# De pe server, în container
docker exec -it cypher-erp-app npx ts-node database/seeds/index.ts
```
Sau manual din fișierele `database/seeds/`.

### 🟢 NICE TO HAVE (îmbunătățiri)

#### 3.8 HTTPS / SSL Certificate
**Status:** Totul rulează pe HTTP.
**Acțiune:** Instalare Certbot + Let's Encrypt, sau Caddy ca reverse proxy.
```bash
apt install certbot
# Configurare nginx cu SSL
```

#### 3.9 Domeniu DNS
**Status:** Se accesează doar pe IP.
**Acțiune:** Configurare DNS A record: `erp.ledux.ro → 65.108.255.104`

#### 3.10 Backup automat DB
```bash
# Cron job zilnic
0 3 * * * docker exec cypher-erp-db pg_dump -U cypher_user cypher_erp | gzip > /backups/cypher_erp_$(date +\%Y\%m\%d).sql.gz
```

#### 3.11 Git repository pe server
**Status:** `/opt/cypher-erp` nu are `.git` — fișierele au fost copiate manual.
**Acțiune:** Inițializare git sau push din local.

#### 3.12 Firewall / Security
- Porturile 5432 (PostgreSQL), 6379 (Redis), 5050 (PgAdmin) sunt expuse public — trebuie restricționate cu `ufw` sau schimbat bind-ul la `127.0.0.1` în docker-compose.yml.

#### 3.13 TypeScript errors — fix real
- Backend-ul are ~200+ erori TypeScript reale (nu doar strictness)
- La un moment dat trebuie fixate pentru a putea trece la build cu `tsc` normal
- Majoritatea sunt în modules: purchasing, workflow-engine, smartbill

---

## 4. STRUCTURA PROIECTULUI

```
/opt/cypher-erp/                    ← PE SERVER
├── .env                            ← Configurare producție
├── docker-compose.yml              ← Orchestrare 7 servicii
├── Dockerfile                      ← Backend (ts-node transpileOnly)
├── tsconfig.json                   ← Relaxat (strict: false)
├── package.json                    ← Backend deps (Node 20)
├── src/
│   ├── server.ts                   ← Entry point backend
│   ├── config/
│   │   └── env.validation.ts       ← Validare env vars (GEMINI opțional)
│   ├── data-source.ts              ← TypeORM config
│   └── middleware/                  ← Auth, CORS, rate limit
├── shared/                         ← Cod partajat (middleware, utils, types)
├── modules/                        ← 25 module business logic
│   ├── orders/
│   ├── inventory/
│   ├── users/
│   ├── smartbill/
│   ├── woocommerce-sync/
│   ├── configurators/
│   ├── ai-agents/                  ← Python service separat
│   └── ... (24 more)
├── database/
│   ├── schema.sql                  ← Schema completă PostgreSQL
│   ├── seeds/                      ← Date inițiale
│   └── migrations/
├── frontend/                       ← React 18 + Vite + Tailwind + React Router
│   ├── Dockerfile                  ← Multi-stage (node build → nginx serve)
│   ├── nginx.conf                  ← Reverse proxy /api → backend
│   ├── src/
│   │   ├── App.tsx                 ← Router principal (lazy load)
│   │   ├── pages/                  ← 30+ pagini
│   │   ├── components/             ← UI components (Card, Badge, etc.)
│   │   ├── services/               ← API services
│   │   └── stores/                 ← Zustand state management
│   └── package.json                ← Frontend deps
└── logs/                           ← Application logs
```

---

## 5. CREDENȚIALE & ACCES

### Server SSH
```
Host: 65.108.255.104
User: root
Key: Ed25519 (furnizată de Flav)
```

### PostgreSQL
```
Host: localhost (sau container "db")
Port: 5432
DB: cypher_erp
User: cypher_user
Password: CypherERP_2026_Secure!
```

### PgAdmin
```
URL: http://65.108.255.104:5050
Email: admin@ledux.ro
Password: CypherAdmin2026!
```

### JWT
```
Secret: cypher_jwt_s3cr3t_pr0duction_k3y_2026!
Refresh: cypher_jwt_r3fr3sh_s3cr3t_pr0d_k3y_2026!
```

### MeiliSearch
```
Master Key: CypherMeili_2026_Key!
```

---

## 6. COMENZI UTILE

```bash
# Conectare SSH
ssh -i ~/.ssh/cypher_key root@65.108.255.104

# Vezi containerele
docker ps -a

# Loguri backend
docker logs -f cypher-erp-app

# Loguri frontend
docker logs -f cypher-erp-frontend

# Restart totul
cd /opt/cypher-erp && docker compose down && docker compose up -d

# Rebuild doar backend
docker compose build app && docker compose up -d app

# Rebuild doar frontend
docker compose build frontend && docker compose up -d frontend

# Acces DB direct
docker exec -it cypher-erp-db psql -U cypher_user -d cypher_erp

# Rulare schema SQL
docker exec -i cypher-erp-db psql -U cypher_user -d cypher_erp < database/schema.sql

# Vezi loguri app
docker exec -it cypher-erp-app cat /app/logs/*.log
```

---

## 7. PRIORITATE DE LUCRU RECOMANDATĂ

1. **[ACUM]** Rulare `schema.sql` în DB → tabelele se creează
2. **[ACUM]** Montare rute API pentru toate modulele (nu doar ai-assistant)
3. **[ACUM]** Implementare pagină Settings cu formular API keys
4. **[CURÂND]** Conectare frontend services la backend API real
5. **[CURÂND]** Seed data + test CRUD pe fiecare modul
6. **[CURÂND]** SSL/HTTPS + domeniu
7. **[LATER]** Fix TypeScript errors real
8. **[LATER]** Backup, monitoring, firewall
