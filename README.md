# CYPHER ERP/CRM System

**Custom ERP/CRM for Ledux.ro** — LED Lighting E-Commerce (Romania)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd cypher
cp .env.example .env    # Edit with your credentials
npm install

# 2. Start PostgreSQL + Redis
docker compose up -d postgres redis

# 3. Run migrations
npm run migration:run

# 4. Start development server
npm run dev
```

Server starts at `http://localhost:3000`. Health check: `GET /health`.

## Tech Stack

- **Runtime:** Node.js 20 LTS + TypeScript 5.3+
- **Framework:** Express.js 4.18
- **Database:** PostgreSQL 15 (TypeORM)
- **Cache/Queue:** Redis 7 (BullMQ)
- **Architecture:** Hexagonal (Clean Architecture)
- **Testing:** Jest + Supertest

## Project Structure

```
cypher/
├── shared/              ← Shared types, interfaces, events, utils
│   ├── types/           ← TypeScript type definitions
│   ├── interfaces/      ← Module contracts (IPricingService, etc.)
│   ├── events/          ← Event Bus event definitions
│   ├── utils/           ← Logger, EventBus, Validator, DateUtils
│   └── constants/       ← Order statuses, pricing tiers, error codes
├── modules/             ← Business modules (hexagonal architecture)
│   ├── pricing-engine/  ← Dynamic pricing, tiers, discounts
│   ├── inventory/       ← Stock management, sync
│   ├── orders/          ← Order processing (14 statuses)
│   ├── quotations/      ← Quote generation, PDF, reminders
│   ├── suppliers/       ← Supplier scraping, SKU mapping
│   ├── smartbill/       ← SmartBill API integration
│   └── woocommerce-sync/← Cypher → WooCommerce sync
├── database/            ← Migrations, seeds, schema
├── infrastructure/      ← Docker, Nginx, CI/CD
└── src/                 ← Express server entry point
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |
| `npm run docker:up` | Start all Docker services |
| `npm run migration:run` | Run database migrations |

## Multi-Agent Protocol

This project uses two AI agents working in parallel:
- **Agent A (Core):** pricing, inventory, orders, quotes, suppliers, smartbill, woocommerce
- **Agent B (Secondary):** b2b-portal, configurators, analytics, whatsapp, notifications

See `CYPHER_ORCHESTRATION_PROTOCOL.md` for rules.

## License

Proprietary — Ledux.ro. All rights reserved.
