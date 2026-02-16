# Event Governance - Cypher ERP B2B
**Version:** 1.0
**Date:** 2026-02-13
**Status:** APPROVED

---

## 1. Overview

Acest document definește guvernanța pentru sistemul de evenimente asincrone în Cypher ERP B2B.

### 1.1 Principii Fundamentale

| Principiu | Descriere |
|-----------|-----------|
| **Event-Driven** | Toate integrările interne folosesc evenimente |
| **At-Least-Once Delivery** | Mesajele pot fi livrate de mai multe ori |
| **Idempotency Obligatorie** | Consumatorii trebuie să fie idempotenți |
| **Versioned Events** | Schimbările de schema sunt versionate |
| **Contract-Based** | Producătorii și consumatorii au contracte definite |
| **Observable** | Toate evenimentele sunt trase și monitorizate |

---

## 2. Naming Conventions

### 2.1 Event Type Format

Format: `{domain}.{entity}.{action}`

**Format detaliat:**
```
{domain}.{aggregate}.{event_name}
```

**Exemple:**
- `cart.updated` - Coș modificat
- `quote.created` - Ofertă creată
- `order.created` - Comandă creată
- `order.cancelled` - Comandă anulată
- `order.confirmed` - Comandă confirmată
- `credit.changed` - Schimbare credit
- `product.updated` - Produs modificat
- `stock.changed` - Stoc modificat
- `price.changed` - Preț modificat
- `payment.started` - Plată inițiată
- `payment.completed` - Plată finalizată
- `notification.sent` - Notificare trimisă

### 2.2 Domain Definitions

| Domain | Descriere | Owner |
|--------|-----------|-------|
| `cart` | Shopping cart operations | AI 7 (Checkout) |
| `quote` | Quote/Devis operations | AI 6 (Pricing) |
| `order` | Order lifecycle | AI 7 (Checkout) |
| `credit` | Credit account operations | AI 8 (Credit) |
| `product` | Product catalog | AI 9 (Catalog) |
| `stock` | Inventory/Stock | Inventory Team |
| `price` | Pricing changes | AI 6 (Pricing) |
| `payment` | Payment processing | Payment Team |
| `notification` | Notifications | AI 4 (Jobs) |
| `shipping` | Shipping operations | Shipping Team |
| `customer` | Customer operations | Customer Service |
| `invoice` | Billing/Invoicing | Finance Team |

### 2.3 Action Nouns

| Acțiune | Utilizare | Exemplu |
|---------|----------|---------|
| `created` | Entitate nouă creată | `order.created` |
| `updated` | Entitate actualizată | `product.updated` |
| `deleted` | Entitate ștearsă | `product.deleted` |
| `cancelled` | Acțiune anulată | `order.cancelled` |
| `confirmed` | Acțiune confirmată | `order.confirmed` |
| `rejected` | Acțiune respinsă | `quote.rejected` |
| `expired` | Expirare | `quote.expired` |
| `approved` | Aprobare | `credit.approved` |
| `rejected` | Respingere | `credit.rejected` |
| `captured` | Captură (credit/plată) | `credit.captured` |
| `released` | Eliberare (credit) | `credit.released` |
| `started` | Început proces | `payment.started` |
| `completed` | Proces complet | `payment.completed` |
| `failed` | Proces eșuat | `payment.failed` |
| `reserved` | Rezervare (stoc/credit) | `stock.reserved` |
| `changed` | Schimbare generică | `stock.changed` |

### 2.4 Naming Rules Anti-Patterns

❌ **NU FOLOSI:**
- Acțiuni verbale de tip imperative (`createOrder`, `updateProduct`)
- CamelCase (`OrderCreated`, `QuoteCreated`)
- Sufixele gen `-event`, `event-` (`order-created-event`)
- Namespace-uri fără semantică (`com.cypher.events.order.created`)
- Acțiuni vagi (`happened`, `occurred`, `modified`)

✅ **FOLOSEȘTE:**
- Nume descriptive și specifice
- Lowercase cu punct separator
- Acțiuni bazate pe verb la timp trecut sau noun
- Semantică clară a domeniului

---

## 3. Versioning Strategy

### 3.1 Semantic Versioning

Format: `{event_type}:{major}.{minor}`

**Reguli:**
- **Major version** (X.0): Breaking change, compatibilitate întreruptă
- **Minor version** (X.Y): Schimbare backward compatible (adăugare câmpuri)

**Exemple:**
- `order.created:1.0` - Versiune inițială
- `order.created:1.1` - Adăugare câmp opțional `metadata`
- `order.created:2.0` - Redenumire câmp sau schimbare tip

### 3.2 When to Bump Version

| Schimbare | Version | Consumatori | Producători |
|-----------|---------|-------------|-------------|
| Adăugare câmp opțional | Minor | Nu se schimbă | Actualizează producător |
| Adăugare câmp obligatoriu cu default | Minor | Nu se schimbă | Actualizează producător |
| Modificare tip câmp (compatible) | Minor | Nu se schimbă | Actualizează producător |
| Redenumire câmp | Major | Actualizează consumatori | Actualizează producător |
| Ștergere câmp | Major | Actualizează consumatori | Actualizează producător |
| Schimbare tip incompatibil | Major | Actualizează consumatori | Actualizează producător |
| Schimbare structură complexă | Major | Actualizează consumatori | Actualizează producător |

### 3.3 Version Evolution Lifecycle

```
1.0 (Initial) ──> 1.1 (Backward Compatible) ──> 1.2 (Backward Compatible)
                                                              │
                                                              ▼
                                                          2.0 (Breaking)
                                                              │
                                    ┌─────────────────────────┴─────────────────────────┐
                                    │                                                   │
                              1.x Support Coexist                                   │
                                    │                                                   │
                                    ▼                                                   ▼
                              Deprecation Period                              2.0 Only
                            (3-6 months)                                    (1.x removed)
```

### 3.4 Deprecation Policy

1. **Period de deprecere:** 3-6 luni
2. **Warning period:** 1 lună înainte de eliminare
3. **Comunicare:** Notificare prin Slack/email + documentare
4. **Support în paralel:** Până la 2 versiuni majore suportate simultan
5. **Eliminare automată:** După 6 luni fără utilizare

---

## 4. Event Ownership

### 4.1 Event Ownership Map

| Event Type | Owner Team | Domain | Producer | Consumers |
|------------|-------------|---------|-----------|------------|
| `cart.*` | AI 7 (Checkout) | cart | Checkout API | Search, Pricing |
| `quote.*` | AI 6 (Pricing) | quote | Pricing API | Checkout, ERP |
| `order.*` | AI 7 (Checkout) | order | Checkout API | ERP, Credit, Shipping, Notification, Search |
| `credit.*` | AI 8 (Credit) | credit | Credit API | ERP, Notification |
| `product.*` | AI 9 (Catalog) | product | Catalog API | Search, Pricing, ERP |
| `stock.*` | Inventory | stock | Inventory API | Catalog, Checkout |
| `price.*` | AI 6 (Pricing) | price | Pricing API | Catalog, Checkout |
| `payment.*` | Payment | payment | Payment API | Order, Notification, ERP |
| `notification.*` | AI 4 (Jobs) | notification | Notification Service | Multiple |
| `shipping.*` | Shipping | shipping | Shipping API | Order, Notification |
| `customer.*` | Customer Service | customer | Customer API | ERP, Credit, Marketing |
| `invoice.*` | Finance | invoice | Billing Service | ERP, Credit |

### 4.2 Ownership Responsibilities

**Owner-ul evenimentului este responsabil pentru:**

1. **Definirea structurii evenimentului**
   - JSON Schema validă
   - Documentație completă
   - Exemple de payload

2. **Version management**
   - Decizia de bump version
   - Notificare consumatori
   - Suport pentru versioning

3. **Schema registry**
   - Publicare JSON Schemas
   - Validare la publicare
   - Actualizare registry

4. **Monitoring**
   - Publică succes/fail rate
   - Consumator health
   - Alerte pentru probleme

5. **Support**
   - Întrebări consumatori
   - Troubleshooting
   - Depanare probleme

### 4.3 Consumer Responsibilities

Consumatorii sunt responsabili pentru:

1. **Idempotency**
   - Verificare processed_events
   - Procesare fără side effects la dublu-delivery

2. **Schema validation**
   - Validare JSON Schema
   - Gestionare versiuni multiple
   - Upgrade la noi versiuni

3. **Error handling**
   - Retry la erori transient
   - Nu reprocesa erori permanente
   - Notificare la DLQ

4. **Monitoring**
   - Consum rate
   - Processing time
   - Error rate

5. **Feedback către owner**
   - Raportare probleme schema
   - Cereri noi evenimente
   - Sugestii de îmbunătățire

---

## 5. Envelope Structure

### 5.1 Standard Envelope

```typescript
interface EventEnvelope {
  // Identificare
  event_id: string;              // UUID v4 - unic global
  event_type: string;            // ex: "order.created"
  event_version: string;          // ex: "1.0"

  // Timestamp
  occurred_at: string;           // ISO 8601 UTC

  // Proveniență
  producer: string;               // ex: "b2b-api", "erp-sync"
  producer_version?: string;      // ex: "1.2.3"
  producer_instance?: string;     // ex: "b2b-api-pod-123"

  // Corelație
  correlation_id: string;         // UUID - propage prin lanț
  causation_id?: string;          // UUID - eveniment cauzal
  parent_event_id?: string;       // UUID - eveniment părinte
  trace_id?: string;             // Distributed tracing

  // Destinație
  routing_key?: string;          // Override routing key
  priority?: 'low' | 'normal' | 'high' | 'critical';

  // Payload
  payload: any;                  // Event payload (validat)

  // Metadate suplimentare
  metadata?: Record<string, any>;
}
```

### 5.2 Envelope Example

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "order.created",
  "event_version": "1.0",
  "occurred_at": "2026-02-13T10:00:00.000Z",
  "producer": "b2b-api",
  "producer_version": "1.2.3",
  "correlation_id": "660e8400-e29b-41d4-a716-446655440001",
  "causation_id": "550e8400-e29b-41d4-a716-446655440000",
  "trace_id": "770e8400-e29b-41d4-a716-446655440002",
  "priority": "normal",
  "routing_key": "order.created",
  "payload": {
    "order_id": "order-123",
    "order_number": "ORD-00000123",
    "customer_id": "cust-456",
    "total_amount": 1234.50,
    "currency": "RON",
    "status": "pending",
    "items": [...]
  },
  "metadata": {
    "source_ip": "10.0.0.1",
    "user_agent": "Mozilla/5.0...",
    "environment": "production"
  }
}
```

### 5.3 Envelope Validation Rules

| Câmp | Obligatoriu | Format | Validare |
|------|-------------|--------|----------|
| `event_id` | Da | UUID v4 | Pattern valid |
| `event_type` | Da | domain.entity.action | Regex `^[a-z]+\.[a-z]+\.[a-z]+$` |
| `event_version` | Da | X.Y | Semantic version |
| `occurred_at` | Da | ISO 8601 UTC | Format valid |
| `producer` | Da | string | Non-empty |
| `correlation_id` | Da | UUID v4 | Pattern valid |
| `payload` | Da | object | Validat per JSON Schema |
| `priority` | Nu | enum | low/normal/high/critical |

---

## 6. Backward Compatibility

### 6.1 Backward Compatible Changes

✅ **Permis fără version bump major:**

1. **Adăugare câmp nou** (opțional)
   ```json
   // v1.0
   { "name": "John" }

   // v1.1 - backward compatible
   { "name": "John", "age": 30 }
   ```

2. **Adăugare câmp nou cu default**
   ```json
   // v1.1 - backward compatible
   { "name": "John", "status": "active" }
   ```

3. **Extindere enum** (doar adăugare, nu ștergere)
   ```json
   // v1.0
   { "type": "active" }

   // v1.1 - backward compatible
   { "type": "archived" }
   ```

4. **Adăugare element în array**
   ```json
   // v1.0
   { "tags": ["red"] }

   // v1.1 - backward compatible
   { "tags": ["red", "blue"] }
   ```

5. **Relaxare constraint** (ex: max -> higher)
   ```json
   // v1.0 - maxLength: 100
   // v1.1 - maxLength: 200
   ```

### 6.2 Breaking Changes

❌ **Necesită version bump major:**

1. **Ștergere câmp**
2. **Redenumire câmp**
3. **Schimbare tip câmp** (incompatibil)
4. **Schimbare structură obiect**
5. **Modificare enum** (ștergere valoare)
6. **Întărirea constraint** (ex: min/max)
7. **Schimbare semantică a câmpului**

**Exemple:**

```json
// v1.0
{ "name": "John", "age": 30 }

// v2.0 - BREAKING
{ "full_name": "John Doe", "age_years": 30 }
```

### 6.3 Compatibility Matrix

| Consumator v1 | Producător v1.0 | Producător v1.1 | Producător v2.0 |
|---------------|-----------------|-----------------|-----------------|
| v1.0 | ✅ | ✅ | ❌ |
| v1.1 | ✅ | ✅ | ❌ |
| v2.0 | ✅ | ✅ | ✅ |

---

## 7. Schema Repository

### 7.1 Schema Storage

**Locație:** `/opt/cypher-erp/events/schemas/`

**Structura:**
```
events/
└── schemas/
    ├── common/
    │   ├── envelope-v1.json
    │   └── metadata-v1.json
    ├── cart/
    │   └── cart-updated-v1.json
    ├── quote/
    │   ├── quote-created-v1.json
    │   └── quote-created-v2.json
    ├── order/
    │   ├── order-created-v1.json
    │   ├── order-cancelled-v1.json
    │   └── order-updated-v1.json
    ├── credit/
    │   └── credit-changed-v1.json
    ├── product/
    │   └── product-updated-v1.json
    ├── stock/
    │   └── stock-changed-v1.json
    ├── price/
    │   └── price-changed-v1.json
    └── registry.json
```

### 7.2 Schema Registry

`events/schemas/registry.json`

```json
{
  "version": "1.0",
  "last_updated": "2026-02-13T10:00:00Z",
  "events": {
    "cart.updated": {
      "current_version": "1.0",
      "owner": "checkout-team",
      "deprecated": false,
      "deprecation_date": null,
      "compatibility": {
        "min_consumer_version": "1.0",
        "max_consumer_version": null
      },
      "schema": "cart/cart-updated-v1.json"
    },
    "quote.created": {
      "current_version": "1.0",
      "owner": "pricing-team",
      "deprecated": false,
      "schema": "quote/quote-created-v1.json"
    },
    "order.created": {
      "current_version": "1.0",
      "owner": "checkout-team",
      "deprecated": false,
      "schema": "order/order-created-v1.json"
    },
    "order.cancelled": {
      "current_version": "1.0",
      "owner": "checkout-team",
      "deprecated": false,
      "schema": "order/order-cancelled-v1.json"
    },
    "credit.changed": {
      "current_version": "1.0",
      "owner": "credit-team",
      "deprecated": false,
      "schema": "credit/credit-changed-v1.json"
    },
    "product.updated": {
      "current_version": "1.0",
      "owner": "catalog-team",
      "deprecated": false,
      "schema": "product/product-updated-v1.json"
    },
    "stock.changed": {
      "current_version": "1.0",
      "owner": "inventory-team",
      "deprecated": false,
      "schema": "stock/stock-changed-v1.json"
    },
    "price.changed": {
      "current_version": "1.0",
      "owner": "pricing-team",
      "deprecated": false",
      "schema": "price/price-changed-v1.json"
    }
  }
}
```

---

## 8. Contract Testing

### 8.1 Producer Contract Tests

**Scop:** Verifică că producătorul generează evenimente conform schema.

**Cazuri de test:**

1. **Valid event structure**
   - Toate câmpurile envelope sunt prezente
   - Tipurile sunt corecte
   - Formatele sunt valide

2. **Valid JSON Schema**
   - Payload validează cu schema
   - Toate câmpurile obligatorii sunt prezente

3. **Unicity**
   - `event_id` este unic
   - `event_type` este în registry

4. **Timestamps**
   - `occurred_at` este în trecut (max 5 min diferență)
   - `occurred_at` este ISO 8601

5. **Correlation**
   - `correlation_id` este valid UUID

### 8.2 Consumer Contract Tests

**Scop:** Verifică că consumatorul poate procesa evenimentul.

**Cazuri de test:**

1. **Deserialize**
   - Evenimentul poate fi deserializat
   - Tipurile TypeScript sunt corecte

2. **Schema validation**
   - Payload validează cu schema
   - Versiunea este suportată

3. **Idempotency**
   - Procesare dublă nu are side effects
   - `processed_events` este verificat

4. **Error handling**
   - Erori valide sunt tratate
   - Nu se crash la payload invalid

5. **Version compatibility**
   - Poate procesa versiuni multiple
   - Versiuni incompatibile sunt respinse

### 8.3 Integration în CI

```yaml
# .github/workflows/event-contract-tests.yml
name: Event Contract Tests

on:
  pull_request:
    paths:
      - 'events/schemas/**'
      - 'events/contracts/**'
  push:
    branches: [main]

jobs:
  producer-contracts:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        event: [cart.updated, quote.created, order.created, order.cancelled,
                credit.changed, product.updated, stock.changed, price.changed]
    steps:
      - uses: actions/checkout@v3
      - name: Validate Producer Contracts
        run: npm run test:contract:producer -- --event ${{ matrix.event }}

  consumer-contracts:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        consumer: [search-indexer, pricing-worker, credit-worker,
                   erp-sync, notification-worker]
    steps:
      - uses: actions/checkout@v3
      - name: Validate Consumer Contracts
        run: npm run test:contract:consumer -- --consumer ${{ matrix.consumer }}

  schema-compatibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check Schema Compatibility
        run: npm run test:schema:compatibility
```

---

## 9. Approval Process

### 9.1 New Event Creation

1. **Proponent creează draft schema**
2. **Review de echipă owner**
3. **Review de echipă arhitectură**
4. **Approval final**
5. **Publicare în registry**

### 9.2 Schema Change Request

1. **Proponent deschide PR**
2. **Automated tests rulează**
3. **Contract tests trebuie să treacă**
4. **Review de owner**
5. **Notificare consumatori (dacă breaking)**
6. **Merge**

### 9.3 Breaking Change Process

1. **Notificare pre-merge (3 luni înainte)**
2. **Discuție cu consumatori**
3. **Creare versiune nouă (ex: v2.0)**
4. **Perioadă de suport în paralel**
5. **Notificare deprecare**
6. **Eliminare vechi versiune**

---

## 10. Monitoring and Observability

### 10.1 Metrics to Track

| Metric | Source | Alert |
|--------|--------|-------|
| Events Published per Second | Outbox relay | < 100/s for > 5min |
| Publish Failure Rate | Outbox relay | > 0.1% |
| Events Consumed per Second | Consumers | < 50/s for > 5min |
| Consumer Error Rate | Consumers | > 0.5% |
| DLQ Rate | DLQ queue | > 0 |
| Queue Lag | RabbitMQ | > 1000 messages |
| Processing Time P95 | Consumers | > 1s |

### 10.2 Alerts

| Alert | Severity | Threshold | Duration |
|-------|----------|-----------|----------|
| Outbox Relay Down | Critical | Service unavailable | 1 min |
| DLQ Not Empty | Critical | Count > 0 | Immediate |
| High Consumer Error Rate | High | Error rate > 1% | 5 min |
| Queue Lag Growing | Warning | Lag > 5000 messages | 10 min |
| Publish Failure | High | Failure rate > 0.5% | 5 min |

---

## 11. Policies Summary

| Policy | Valoare |
|--------|---------|
| Event naming | `domain.entity.action` |
| Versioning | Semantic (X.Y) |
| Major version bump | Breaking changes |
| Minor version bump | Backward compatible |
| Deprecation period | 3-6 luni |
| Support versions | 2 majore în paralel |
| Delivery guarantee | At-least-once |
| Idempotency | Obligatoriu |
| Envelope version | Current: 1.0 |
| Schema format | JSON Schema Draft 7 |

---

## 12. Quick Reference

### 12.1 Event Types P0

| Event Type | Version | Owner | Schema |
|------------|---------|-------|--------|
| `cart.updated` | 1.0 | Checkout | `cart/cart-updated-v1.json` |
| `quote.created` | 1.0 | Pricing | `quote/quote-created-v1.json` |
| `order.created` | 1.0 | Checkout | `order/order-created-v1.json` |
| `order.cancelled` | 1.0 | Checkout | `order/order-cancelled-v1.json` |
| `credit.changed` | 1.0 | Credit | `credit/credit-changed-v1.json` |
| `product.updated` | 1.0 | Catalog | `product/product-updated-v1.json` |
| `stock.changed` | 1.0 | Inventory | `stock/stock-changed-v1.json` |
| `price.changed` | 1.0 | Pricing | `price/price-changed-v1.json` |

### 12.2 Contact

| Rol | Persoană | Email |
|-----|----------|-------|
| Event Architect | TBD | TBD |
| RabbitMQ Admin | TBD | TBD |
| Schema Owner | TBD | TBD |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Owner:** AI 3 (Event Bus Engineer)
**Next Review:** 2026-05-13
