# Entity Relationship Diagram - Cypher ERP B2B
**Version:** 1.0
**Date:** 2026-02-13

---

## Overview

Acest document descrie diagrama de relații între entitățile din baza de date Cypher ERP B2B.

---

## Schema Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                         cypher_erp (Database)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│  │  b2b schema  │    │  erp schema  │    │ shared schema│        │
│  │  (B2B data)  │    │  (ERP data)  │    │ (cross-cut)  │        │
│  └──────────────┘    └──────────────┘    └──────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## b2b Schema - Catalog Domain

```
┌───────────────────────────────────────────────────────────────────────┐
│                          CATALOG DOMAIN                               │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐         ┌──────────────────────────────┐
│        b2b.products          │         │    b2b.product_variants      │
├──────────────────────────────┤         ├──────────────────────────────┤
│ PK  id (UUID)               │         │ PK  id (UUID)               │
│ UQ  sku                      │         │ FK   product_id ─────────────┤
│ UQ  ean_gtin                 │         │ UQ   sku                      │
│     name                      │         │     variant_name              │
│     description               │         │     price_override            │
│ FK   category_id ───┐        │         │     stock_level               │
│ FK   brand_id ───────┼────────┘         │     stock_status              │
│     default_price      │                  └──────────────────────────────┘
│     default_currency   │
│     tax_rate          │
│     is_active         │
└───────────────────────┘
         │                │
         │                │
         ▼                ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│    b2b.product_media        │         │  b2b.product_attributes      │
├──────────────────────────────┤         ├──────────────────────────────┤
│ PK  id (UUID)               │         │ PK  id (UUID)               │
│ FK   product_id ─────────────┼────────┤ FK   product_id ─────────────┤
│ FK   variant_id ─────────────┼────────┤ FK   variant_id ─────────────┤
│     media_type               │         │     attribute_name           │
│     url                      │         │     attribute_value          │
│     is_primary               │         │     attribute_group           │
└──────────────────────────────┘         └──────────────────────────────┘
```

---

## b2b Schema - Pricing Domain

```
┌───────────────────────────────────────────────────────────────────────┐
│                          PRICING DOMAIN                               │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐         ┌──────────────────────────────┐
│      b2b.price_books         │         │  b2b.price_book_entries     │
├──────────────────────────────┤         ├──────────────────────────────┤
│ PK  id (UUID)               │         │ PK  id (UUID)               │
│ UQ  code                      │         │ FK   price_book_id ──────────┤
│     name                      │         │ FK   product_id ─────────────┼─┐
│     is_default                │         │ FK   variant_id ─────────────┼─┼─┐
│     applicable_tier           │         │     price                    │ │ │ │
│     valid_from                │         │     price_type               │ │ │ │
│     valid_to                  │         │     discount_percent         │ │ │ │
└──────────────────────────────┘         │     valid_from              │ │ │ │
                                            │     valid_to                │ │ │ │
                                            └────────────────────────────┘ │ │ │
                                                                                   │ │
┌──────────────────────────────┐         ┌──────────────────────────────┐          │ │
│    b2b.customer_tiers        │         │    b2b.stock_levels          │          │ │
├──────────────────────────────┤         ├──────────────────────────────┤          │ │
│ PK  id (UUID)               │         │ PK  id (UUID)               │          │ │
│ UQ  code                      │         │ FK   product_id ─────────────────────────┘ │
│ UQ  tier (enum)              │         │ FK   variant_id ────────────────────────────┘
│     name                      │         │ UQ   (product_id, variant_id, warehouse_id)│
│     discount_percent          │         │     quantity_available      │
│     default_price_book_id ─────┘         │     quantity_reserved       │
└──────────────────────────────┘         │     quantity_on_order       │
                                            │     stock_status           │
                                            │     warehouse_id           │
                                            └────────────────────────────┘
```

---

## b2b Schema - Customer Domain

```
┌───────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER DOMAIN                                │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│       b2b.customers         │
├──────────────────────────────┤
│ PK  id (UUID)               │
│ UQ  customer_code            │
│ UQ  email                    │
│     company_name             │
│     fiscal_code              │
│     customer_tier (enum)     │
│     status (enum)            │
│     credit_limit             │
│     payment_terms            │
│     billing_address (JSONB)   │
│     shipping_address (JSONB) │
└──────────────────────────────┘
         │
         │ 1:N
         ├───────────────────────────────────────────────────────┐
         │                                                       │
         ▼                                                       ▼
┌──────────────────────────────┐                    ┌──────────────────────────────┐
│  b2b.customer_contacts      │                    │b2b.customer_shipping_addresses│
├──────────────────────────────┤                    ├──────────────────────────────┤
│ PK  id (UUID)               │                    │ PK  id (UUID)               │
│ FK   customer_id ─────────────┤                    │ FK   customer_id ─────────────┤
│     first_name               │                    │     label                     │
│     last_name                │                    │     is_default                │
│     email                    │                    │     address_line1             │
│     phone                    │                    │     city                      │
│     is_primary               │                    │     postal_code               │
└──────────────────────────────┘                    │     country_code              │
                                                     └────────────────────────────┘
```

---

## b2b Schema - Cart & Checkout Domain

```
┌───────────────────────────────────────────────────────────────────────┐
│                     CART & CHECKOUT DOMAIN                            │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐         ┌──────────────────────────────┐
│        b2b.carts            │         │      b2b.cart_items         │
├──────────────────────────────┤         ├──────────────────────────────┤
│ PK  id (UUID)               │         │ PK  id (UUID)               │
│ FK   customer_id ─────────────┤         │ FK   cart_id ────────────────┼─────────┐
│ FK   user_id                │         │ FK   customer_id ─────────────┼──┐      │
│ FK   price_book_id ─────────┼─┐       │ FK   product_id ─────────────┼──┼───┐  │
│     cart_code                │ │       │ FK   variant_id ──────────────┼──┼───┼──┼──┐
│     status (enum)            │ │       │     unit_price               │  │   │  │  │  │
│     is_default              │ │       │     quantity                 │  │   │  │  │  │
│     total_amount             │ │       │     line_total               │  │   │  │  │  │
│     expires_at               │ │       └──────────────────────────────┘  │   │  │  │  │
└──────────────────────────────┘                                        │   │  │  │  │
                                                                          │   │  │  │  │
┌──────────────────────────────┐         ┌──────────────────────────────┐ │   │  │  │  │
│        b2b.quotes           │         │    b2b.quote_items          │ │   │  │  │  │
├──────────────────────────────┤         ├──────────────────────────────┤ │   │  │  │  │
│ PK  id (UUID)               │         │ PK  id (UUID)               │ │   │  │  │  │
│ UQ  quote_number             │         │ FK   quote_id ────────────────┼───┼──┼──┼──┼──┤
│ FK   customer_id ─────────────┤         │ FK   customer_id ─────────────┼──┐ │  │  │  │  │
│ FK   price_book_id ─────────┼─┐       │ FK   product_id ─────────────┼──┼──┼──┼──┼──┼──┤
│ FK   shipping_address_id ─────┼─┼─┐     │ FK   variant_id ──────────────┼──┼──┼──┼──┼──┼──┼──┤
│     status (enum)            │ │ │     │     unit_price               │  │  │  │  │  │  │  │  │
│     total_amount             │ │ │     │     quantity                 │  │  │  │  │  │  │  │  │
│     valid_from              │ │ │     │     line_total               │  │  │  │  │  │  │  │  │
│     valid_to                │ │ │     └──────────────────────────────┘  │  │  │  │  │  │  │  │
│     converted_to_order_id ────┼─┼─┐                                       │  │  │  │  │  │  │
└──────────────────────────────┘ │ │ │                                       │  │  │  │  │  │  │
                                 │ │ │     ┌──────────────────────────────┐  │  │  │  │  │  │  │
                                 │ │ └────│ b2b.quote_items_snapshot     │  │  │  │  │  │  │  │
                                 │ │     ├──────────────────────────────┤  │  │  │  │  │  │  │
                                 │ │     │ FK   quote_id ────────────────┼──┼──┼──┼──┼──┼──┼──┤
                                 │ └─────│ FK   product_id ───────────────┼──┼──┼──┼──┼──┼──┼──┼──┤
                                 │       │     unit_price (snapshot)     │  │  │  │  │  │  │  │  │
                                 │       │     stock_available           │  │  │  │  │  │  │  │  │
                                 │       └──────────────────────────────┘  │  │  │  │  │  │  │  │
                                 │                                         │  │  │  │  │  │  │
┌──────────────────────────────┐ │     ┌──────────────────────────────┐  │  │  │  │  │  │  │
│        b2b.orders            │ │     │      b2b.order_items        │  │  │  │  │  │  │  │
├──────────────────────────────┤ │     ├──────────────────────────────┤  │  │  │  │  │  │  │
│ PK  id (UUID)               │ │     │ PK  id (UUID)               │  │  │  │  │  │  │  │
│ UQ  order_number             │ │     │ FK   order_id ────────────────┼──┼──┼──┼──┼──┼──┼──┤
│ UQ  correlation_id           │ │     │ FK   customer_id ─────────────┼──┼──┼──┼──┼──┼──┼──┼──┤
│ FK   customer_id ─────────────┼─┼─┐   │ FK   product_id ─────────────┼──┼──┼──┼──┼──┼──┼──┼──┤
│ FK   price_book_id ─────────┼─┼─┼─┐ │ FK   variant_id ─────────────┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│ FK   credit_account_id ─────┼─┼─┼─┼─┼─│     quantity_ordered          │  │  │  │  │  │  │  │  │  │
│ FK   shipping_address_id ─────┼─┼─┼─┼─┼─│     line_total               │  │  │  │  │  │  │  │  │  │
│     source_type (cart/quote)  │ │ │ │ │ │     status                   │  │  │  │  │  │  │  │  │
│     source_id ───────────────┼─┼─┼─┼─┼─┼─└──────────────────────────────┘  │  │  │  │  │  │  │  │
│     status (enum)            │ │ │ │ │ │                                │  │  │  │  │  │  │  │
│     total_amount             │ │ │ │ │ │     ┌──────────────────────────────┐  │  │  │  │  │  │  │
│     credit_amount_reserved   │ │ │ │ │ └────│ b2b.order_items_snapshot     │  │  │  │  │  │  │  │
└──────────────────────────────┘ │ │ │ │     ├──────────────────────────────┤  │  │  │  │  │  │  │
                                 │ │ │     │ FK   order_id ────────────────┼──┼──┼──┼──┼──┼──┼──┤
                                 │ └─────│ FK   product_id ───────────────┼──┼──┼──┼──┼──┼──┼──┼──┤
                                 │       │     unit_price (snapshot)     │  │  │  │  │  │  │  │  │
                                 │       │     stock_available           │  │  │  │  │  │  │  │  │
                                 │       └──────────────────────────────┘  │  │  │  │  │  │  │  │
                                 │                                         │  │  │  │  │  │  │
                                 │     ┌──────────────────────────────┐  │  │  │  │  │  │  │
                                 └────│    b2b.order_shipments      │  │  │  │  │  │  │  │
                                       ├──────────────────────────────┤  │  │  │  │  │  │  │
                                       │ FK   order_id ────────────────┼──┼──┼──┼──┼──┼──┼──┤
                                       │     tracking_number           │  │  │  │  │  │  │  │
                                       │     status                   │  │  │  │  │  │  │  │
                                       └──────────────────────────────┘  │  │  │  │  │  │  │
                                                                             │  │  │  │  │
```

---

## b2b Schema - Credit Domain

```
┌───────────────────────────────────────────────────────────────────────┐
│                          CREDIT DOMAIN                                │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│      b2b.credit_accounts    │
├──────────────────────────────┤
│ PK  id (UUID)               │
│ FK   customer_id ─────────────┐
│ UQ  account_number           │ │
│     credit_limit             │ │
│     current_balance          │ │
│     available_credit         │ │
│     reserved_amount          │ │
│     status (enum)            │ │
│     payment_terms            │ │
│     credit_score              │ │
└──────────────────────────────┘ │
         │                      │
         │ 1:N                  │
         ▼                      │
┌──────────────────────────────┐ │
│    b2b.credit_ledger        │ │   (APPEND-ONLY)
├──────────────────────────────┤ │
│ PK  id (UUID)               │ │
│ FK   credit_account_id ───────┼─┘
│ FK   linked_entry_id ──────────┐
│     entry_number (seq)        │
│     entry_type (enum)         │
│     amount                    │
│     balance_after             │
│     reference_type            │
│     reference_id              │
│     reservation_id            │
│     reservation_status        │
│     reservation_expires_at    │
└──────────────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  b2b.credit_reservations    │         │  b2b.credit_transactions   │
├──────────────────────────────┤         ├──────────────────────────────┤
│ PK  id (UUID)               │         │ PK  id (UUID)               │
│ FK   credit_account_id ───────┤         │ FK   credit_account_id ───────┤
│ FK   order_id ─────────────────────────┤     transaction_type         │
│ UQ  reservation_number      │         │     reference_id              │
│ FK   reserve_entry_id ─────────────────┤     status                   │
│ FK   capture_entry_id ──────────────────┤     payment_method            │
│ FK   release_entry_id ───────────────────┘     amount                    │
│     status (enum)            │         │     error_message             │
│     amount                   │         └──────────────────────────────┘
│     expires_at               │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│    b2b.credit_invoices      │         │  b2b.credit_invoice_items   │
├──────────────────────────────┤         ├──────────────────────────────┤
│ PK  id (UUID)               │         │ PK  id (UUID)               │
│ FK   credit_account_id ───────┤         │ FK   invoice_id ───────────────┼─────────┐
│ FK   customer_id ─────────────┼────────┤     reference_type            │         │
│ UQ  invoice_number           │         │     reference_id              │         │
│     period_start             │         │     amount                    │         │
│     period_end               │         │     line_total                │         │
│     opening_balance          │         │     transaction_date          │         │
│     closing_balance          │         └──────────────────────────────┘         │
│     status                   │                                                       │
│     due_date                 │                                                       │
└──────────────────────────────┘                                                       │
                                                                                      │
```

---

## shared Schema - Events Domain

```
┌───────────────────────────────────────────────────────────────────────┐
│                           EVENTS DOMAIN                               │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐         ┌──────────────────────────────┐
│   shared.outbox_events     │         │shared.processed_events      │
├──────────────────────────────┤         ├──────────────────────────────┤
│ PK  id (UUID)               │         │ PK  id (UUID)               │
│ UQ  event_id                │         │ FK   event_id ───────────────┼───────┐
│     event_type               │         │ FK   consumer_name ───────────┼───┐   │
│     event_domain (enum)      │         │ UQ   (consumer_name, event_id)│   │   │
│     source_service           │         │     status                   │   │   │
│     source_entity_type       │         │     processed_at             │   │   │
│     source_entity_id         │         │     result                   │   │   │
│     correlation_id           │         │     error_message            │   │   │
│     payload (JSONB)          │         │     retry_count              │   │   │
│     priority (enum)          │         │     next_retry_at            │   │   │
│     status (enum)            │         └──────────────────────────────┘   │   │
│     attempts                 │                                                   │
│     next_attempt_at          │         ┌──────────────────────────────┐      │   │
│     published_at             │         │ shared.event_subscriptions   │      │   │
│     error_message            │         ├──────────────────────────────┤      │   │
└──────────────────────────────┘         │ PK  id (UUID)               │      │   │
         │                               │ UQ   (consumer_name, event_type) │  │   │
         ▼                               │     event_type               │      │   │
┌──────────────────────────────┐         │     event_domain (enum)      │      │   │
│ shared.dead_letter_queue     │         │     is_active                │      │   │
├──────────────────────────────┤         │     delivery_mode            │      │   │
│ PK  id (UUID)               │         │     max_retries              │      │   │
│ FK   original_event_id ─────────────────│     retry_backoff_ms         │      │   │
│     consumer_name            │         └──────────────────────────────┘      │   │
│     original_payload         │                                                       │
│     error_message            │         ┌──────────────────────────────┐      │   │
│     resolution_status        │         │shared.event_replay          │      │   │
│     can_retry                │         ├──────────────────────────────┤      │   │
└──────────────────────────────┘         │ PK  replay_session_id (UUID) │      │   │
                                        │ FK   event_id ───────────────┼──────┼───┼───┐
                                        │     consumer_name            │      │   │   │   │
                                        │     replay_mode               │      │   │   │   │
                                        │     replay_status             │      │   │   │   │
                                        │     requested_by              │      │   │   │   │
                                        └──────────────────────────────┘      │   │   │   │
                                                                               │   │   │
```

---

## Cross-Schema Relationships

```
┌─────────────────────┐         ┌─────────────────────┐
│     erp schema      │         │     b2b schema      │
├─────────────────────┤         ├─────────────────────┤
│                     │         │                     │
│  erp.users          │◄────────│  b2b.credits...   │
│  (for FK refs)      │         │  (approved_by)     │
│                     │         │                     │
│  erp.* (existing)   │         │  (read-only via    │
│                     │         │   views)            │
└─────────────────────┘         └─────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐
│   shared schema     │         │     b2b schema      │
├─────────────────────┤         ├─────────────────────┤
│                     │         │                     │
│  outbox_events      │◄────────│  (all b2b tables)  │
│  (published from    │         │  write events       │
│   b2b)              │         │                     │
└─────────────────────┘         └─────────────────────┘
```

---

## Key Relationships Summary

| Tabel Sursă | Tabel Destinație | Tip Relație | Notă |
|-------------|------------------|-------------|------|
| b2b.customers | b2b.credit_accounts | 1:1 | Un cont per client |
| b2b.customers | b2b.carts | 1:N | Un coș activ per client |
| b2b.customers | b2b.quotes | 1:N | Multiple oferte |
| b2b.customers | b2b.orders | 1:N | Istoric comenzi |
| b2b.products | b2b.product_variants | 1:N | Variante produs |
| b2b.products | b2b.stock_levels | 1:N | Stoc per warehouse |
| b2b.products | b2b.price_book_entries | 1:N | Multiple prețuri |
| b2b.carts | b2b.cart_items | 1:N | Itemi în coș |
| b2b.quotes | b2b.quote_items | 1:N | Itemi ofertă |
| b2b.orders | b2b.order_items | 1:N | Itemi comandă |
| b2b.orders | b2b.order_items_snapshot | 1:N | Snapshot financiar |
| b2b.quotes | b2b.quote_items_snapshot | 1:N | Snapshot financiar |
| b2b.credit_accounts | b2b.credit_ledger | 1:N | Istoric tranzacții |
| b2b.credit_accounts | b2b.credit_reservations | 1:N | Rezervări active |
| b2b.credit_ledger | b2b.credit_ledger | 1:1 | Link pentru capture/release |
| b2b.orders | b2b.credit_reservations | 1:1 | Rezervare per comandă |
| b2b.orders | b2b.order_shipments | 1:N | Multiple livrări |
| shared.outbox_events | shared.processed_events | 1:N | Consumeri multipli |
| shared.outbox_events | shared.outbox_events | 1:N | Lanț evenimente |

---

## Appendix: Column Types Reference

| Tip de Date | Postgres Type | Utilizare |
|-------------|---------------|-----------|
| ID | UUID | Primary/Foreign keys |
| Money | NUMERIC(18,4) | Prețuri, sume |
| Currency | CHAR(3) | Cod monedă (RON, EUR) |
| Timestamp | TIMESTAMPTZ | Data+ora cu timezone |
| Date | DATE | Date fără oră |
| Boolean | BOOLEAN | Flag-uri binare |
| Text Short | VARCHAR(n) | String-uri cu lungime fixă |
| Text Long | TEXT | String-uri lungi |
| JSON | JSONB | Structuri flexibile |
| Enum | Custom ENUM | Valori fixe |
| Integer | INTEGER/BIGINT | Contori, cantități |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Maintainer:** AI 2 (Data/DB Architect)
