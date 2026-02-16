# WooCommerce to ERP Integration - Implementation Summary

## Overview

This implementation provides a real, production-ready integration between WooCommerce and CYPHER ERP with the following features:

1. **Real webhook intake** from WooCommerce (orders, products, customers)
2. **Transform Woo events to ERP domain events**
3. **Persist smartbill_id** in order/invoice records
4. **Idempotency with deduplication** by event_id
5. **Retry mechanism with backoff** for failed operations
6. **Dead Letter Queue** for permanently failed operations
7. **Outbox pattern** for unified replay (Woo + SmartBill + ERP)

## Files Created/Modified

### Core Webhook Components

1. **`src/api/controllers/WooCommerceWebhookController.ts`** (NEW)
   - Real webhook endpoint for receiving WooCommerce events
   - Signature verification (HMAC-SHA256)
   - Handles orders, products, customers events
   - Admin endpoints for DLQ management and statistics

2. **`src/api/routes/woocommerce-webhook.routes.ts`** (NEW)
   - Routes for webhook intake
   - Public endpoints for webhooks and health
   - Admin endpoints for DLQ management

### Event Transformation

3. **`src/application/transformers/WebhookEventTransformer.ts`** (NEW)
   - Transforms WooCommerce payloads to ERP domain events
   - Supports: order.created/updated/deleted, product.created/updated/deleted, customer.created/updated/deleted
   - Preserves smartbill_id from WooCommerce metadata
   - Generates correlation_id and causation_id

4. **`src/application/transformers/index.ts`** (NEW)
   - Exports transformer types and classes

### Reliability Services

5. **`src/application/services/WebhookReliabilityService.ts`** (UPDATED)
   - Added statistics gathering
   - Added dead letter retry methods
   - Added batch retry for multiple IDs
   - Added cleanup for old logs
   - Added get webhook log by ID

### Outbox Integration

6. **`src/infrastructure/outbox/OutboxEventPublisher.ts`** (NEW)
   - Writes ERP domain events to `shared.outbox_events` table
   - Supports single and batch publishing
   - Includes payload size tracking
   - Connection pool management

7. **`src/infrastructure/outbox/index.ts`** (NEW)
   - Exports outbox components

### Retry Mechanism

8. **`src/infrastructure/workers/WebhookRetryWorker.ts`** (NEW)
   - Cron-based retry worker with configurable schedule
   - Processes failed webhooks with exponential backoff
   - Configurable batch size and concurrency
   - Manual retry support

9. **`src/infrastructure/workers/index.ts`** (NEW)
   - Exports worker components

### Dead Letter Queue

10. **`src/infrastructure/dlq/DeadLetterQueueManager.ts`** (NEW)
    - Get DLQ entries with pagination
    - Search by error message
    - Get by topic filtering
    - Statistics aggregation (by topic, by error, date range)
    - Replay single/batch entries
    - Delete single/batch entries
    - Delete entries older than date
    - Export DLQ to JSON

11. **`src/infrastructure/dlq/index.ts`** (NEW)
    - Exports DLQ components

### Database Migrations

12. **`src/database/AddSmartbillIdToOrders.ts`** (NEW)
    - Migration to add smartbill_id to orders table
    - Adds woo_order_id for direct reference
    - Adds woo_webhook_id for tracking
    - Includes proper indexes

### Composition Root

13. **`src/infrastructure/WebhookCompositionRoot.ts`** (NEW)
    - Orchestrates webhook composition
    - Creates all components (reliability, transformer, outbox, retry, DLQ)
    - Start/stop lifecycle management
    - Health check aggregation

### Module Exports

14. **`src/index.ts`** (UPDATED)
    - Added exports for new components
    - Added webhook composition methods
    - Updated module to v2.0.0
    - Added getWebhookRouter() method
    - Enhanced health check to include webhook composition

### Package Configuration

15. **`package.json`** (UPDATED)
    - Added `pg` dependency for outbox
    - Added `cron` dependency for retry worker
    - Added `@woocommerce/woocommerce-rest-api` dependency

### Documentation

16. **`README.md`** (UPDATED)
    - Complete documentation of new architecture
    - API endpoints
    - Environment variables
    - Troubleshooting guide

## Database Schema

### woocommerce_webhook_logs Table

Existing table enhanced with:

- `id` (uuid, primary key)
- `webhook_id` (varchar(100), unique index) - Idempotency key
- `topic` (varchar(50)) - Event type
- `payload` (jsonb) - Full webhook data
- `status` (enum) - pending, processing, completed, failed, dead_letter
- `retry_count` (integer, default 0)
- `last_retry_at` (timestamp, nullable)
- `next_retry_at` (timestamp, nullable)
- `error_message` (text, nullable)
- `signature_verified` (boolean)
- `created_at` (timestamp)
- `processed_at` (timestamp, nullable)

### orders Table Extensions

New columns added:

- `smartbill_id` (varchar(100), nullable, indexed) - Link to SmartBill
- `woo_order_id` (bigint, nullable, indexed) - WooCommerce order ID
- `woo_webhook_id` (varchar(255), nullable) - Original webhook ID

## Environment Variables

| Variable | Description | Default |
|-----------|-------------|----------|
| WOOCOMMERCE_URL | WooCommerce store URL | https://ledux.ro |
| WOOCOMMERCE_CONSUMER_KEY | API consumer key | - |
| WOOCOMMERCE_CONSUMER_SECRET | API consumer secret | - |
| WOOCOMMERCE_WEBHOOK_SECRET | Webhook signature secret | - |
| WOO_RETRY_ENABLED | Enable retry worker | true |
| WOO_RETRY_CRON | Retry worker cron pattern | */1 * * * * |
| WOO_RETRY_BATCH_SIZE | Retry batch size | 50 |
| WOO_RETRY_CONCURRENCY | Max concurrent retries | 10 |

## Webhook Topics Supported

- `order.created` - New orders from WooCommerce
- `order.updated` - Order changes
- `order.deleted` - Order deletions/cancellations
- `product.created` - New products
- `product.updated` - Product changes
- `product.deleted` - Product deletions
- `customer.created` - New customers
- `customer.updated` - Customer changes
- `customer.deleted` - Customer deletions

## Idempotency Implementation

1. Unique constraint on `woocommerce_webhook_logs.webhook_id`
2. Pre-processing check using `isDuplicate()` method
3. Early return for duplicates (success without processing)

## Retry Strategy

Exponential backoff with 5 max attempts:

```
Attempt 1: 1 second delay
Attempt 2: 2 seconds delay
Attempt 3: 4 seconds delay
Attempt 4: 8 seconds delay
Attempt 5: 16 seconds delay (then to DLQ)
```

## Dead Letter Queue Operations

After max retries, events go to DLQ (status = 'dead_letter'):

- `GET /api/woocommerce/webhook/dead-letter` - List DLQ entries
- `GET /api/woocommerce/webhook/dead-letter?topic=order.created` - Filter by topic
- `POST /api/woocommerce/webhook/dead-letter/:id/retry` - Replay single entry
- `POST /api/woocommerce/webhook/dead-letter/batch-retry` - Batch replay
- Delete operations (programmatic, no endpoint exposed yet)

## Outbox Integration

All ERP domain events are written to `shared.outbox_events`:

```sql
INSERT INTO shared.outbox_events (
  event_id, event_type, event_version, event_domain,
  source_service, source_entity_type, source_entity_id,
  correlation_id, causation_id, payload, payload_size,
  metadata, content_type, priority, publish_to,
  status, attempts, max_attempts, next_attempt_at,
  occurred_at, created_at
) VALUES (...)
```

This enables unified replay across:
- WooCommerce webhook events
- SmartBill invoice events
- ERP internal events

## SmartBill Integration

When WooCommerce orders are created:

1. Extract `smartbill_id` from `order.meta_data` (if present)
2. Store in `orders.smartbill_id` column
3. Link order to SmartBill invoice for reconciliation

## API Endpoints

### Public (No Authentication)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/woocommerce/webhook` | Main webhook endpoint |
| GET | `/api/woocommerce/webhook/health` | Health check |

### Admin (Authentication Required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/woocommerce/webhook/stats` | Webhook statistics |
| GET | `/api/woocommerce/webhook/dead-letter` | DLQ entries (paginated) |
| POST | `/api/woocommerce/webhook/dead-letter/:id/retry` | Replay single entry |
| POST | `/api/woocommerce/webhook/dead-letter/batch-retry` | Batch replay |

## Testing Recommendations

1. **Webhook Signature Testing**
   - Use tools like `curl` with proper HMAC signature
   - Test duplicate handling by sending same webhook_id twice

2. **Idempotency Testing**
   - Send identical webhooks multiple times
   - Verify only one is processed

3. **Retry Testing**
   - Force failures and verify retry scheduling
   - Check exponential backoff timing

4. **DLQ Testing**
   - Fail webhooks > 5 times
   - Verify they move to DLQ
   - Test replay functionality

5. **Outbox Testing**
   - Verify events are written to `shared.outbox_events`
   - Test event replay from outbox

## Monitoring

Key metrics to monitor:

1. **Webhook Stats**: pending, processing, completed, failed, dead_letter counts
2. **Retry Worker Status**: running/stopped, last execution time
3. **DLQ Count**: Number of permanently failed events
4. **Outbox Health**: Connection status, write latency

## Deployment Notes

1. Set up webhooks in WooCommerce with the proper endpoint URL
2. Configure webhook secret in both WooCommerce and environment variables
3. Ensure PostgreSQL user has permissions to write to `shared.outbox_events`
4. Run the migration to add columns to orders table
5. Configure cron schedule based on load requirements
6. Set up monitoring for webhook endpoints and DLQ

## Future Enhancements

1. Add rate limiting to webhook endpoints
2. Implement webhook signature rotation
3. Add web UI for DLQ management
4. Support for WooCommerce webhook redelivery handling
5. Add metrics export for Prometheus/StatsD
6. Implement circuit breaker for outbox publisher
7. Add webhook delivery status reporting back to WooCommerce
