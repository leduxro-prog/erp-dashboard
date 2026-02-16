# WooCommerce Sync Module

## Overview

This module provides real-time integration between WooCommerce and CYPHER ERP. It handles webhook intake, event transformation, outbox publishing for unified replay, retry with backoff, and Dead Letter Queue management.

## Architecture

### Components

1. **Webhook Controller** (`src/api/controllers/WooCommerceWebhookController.ts`)
   - Receives real webhooks from WooCommerce (orders, products, customers)
   - Verifies HMAC-SHA256 signatures
   - Returns 200 on success/error to prevent WooCommerce redelivery loops

2. **Event Transformer** (`src/application/transformers/WebhookEventTransformer.ts`)
   - Transforms WooCommerce payloads to ERP domain events
   - Maps event types (order.created -> order.created, etc.)
   - Preserves smartbill_id from WooCommerce metadata

3. **Webhook Reliability Service** (`src/application/services/WebhookReliabilityService.ts`)
   - Signature verification
   - Idempotency (deduplication by webhook_id)
   - Status tracking (pending, processing, completed, failed, dead_letter)
   - Retry scheduling with exponential backoff

4. **Outbox Event Publisher** (`src/infrastructure/outbox/OutboxEventPublisher.ts`)
   - Writes ERP events to `shared.outbox_events` table
   - Enables unified replay across all modules (WooCommerce + SmartBill + ERP)

5. **Retry Worker** (`src/infrastructure/workers/WebhookRetryWorker.ts`)
   - Cron-based retry worker
   - Processes failed webhooks with exponential backoff
   - Configurable concurrency and batch size

6. **Dead Letter Queue Manager** (`src/infrastructure/dlq/DeadLetterQueueManager.ts`)
   - Manages permanently failed events
   - Provides search, replay, and delete operations
   - Exports DLQ for external analysis

7. **Webhook Composition Root** (`src/infrastructure/WebhookCompositionRoot.ts`)
   - Orchestrates all components
   - Provides start/stop lifecycle
   - Health check endpoint

## Database Schema

### woocommerce_webhook_logs

Tracks all received webhooks for idempotency and audit:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| webhook_id | varchar(100) | Unique webhook ID (from WooCommerce) |
| topic | varchar(50) | Event topic (order.created, product.updated, etc.) |
| payload | jsonb | Full webhook payload |
| status | enum | pending, processing, completed, failed, dead_letter |
| retry_count | integer | Number of retry attempts |
| last_retry_at | timestamp | Last retry timestamp |
| next_retry_at | timestamp | Next scheduled retry |
| error_message | text | Last error message |
| signature_verified | boolean | Whether signature was verified |
| created_at | timestamp | When webhook was received |
| processed_at | timestamp | When processing completed |

### Orders Table Extensions

Added columns to orders table for WooCommerce integration:

| Column | Type | Description |
|--------|------|-------------|
| smartbill_id | varchar(100) | Link to SmartBill invoice |
| woo_order_id | bigint | WooCommerce order ID |
| woo_webhook_id | varchar(255) | Original webhook ID |

## Environment Variables

| Variable | Description | Default |
|-----------|-------------|----------|
| WOOCOMMERCE_URL | WooCommerce store URL | https://ledux.ro |
| WOOCOMMERCE_CONSUMER_KEY | WooCommerce API consumer key | - |
| WOOCOMMERCE_CONSUMER_SECRET | WooCommerce API consumer secret | - |
| WOOCOMMERCE_WEBHOOK_SECRET | Webhook signature secret | - |
| WOO_RETRY_ENABLED | Enable retry worker | true |
| WOO_RETRY_CRON | Retry worker cron pattern | */1 * * * * |
| WOO_RETRY_BATCH_SIZE | Retry batch size | 50 |
| WOO_RETRY_CONCURRENCY | Max concurrent retries | 10 |

## Webhook Configuration in WooCommerce

Create webhooks in WooCommerce at: `WooCommerce > Settings > Advanced > Webhooks`

| Topic | Delivery URL | Description |
|-------|---------------|-------------|
| Order created | `https://your-erp.com/api/woocommerce/webhook` | New orders |
| Order updated | `https://your-erp.com/api/woocommerce/webhook` | Order changes |
| Product created | `https://your-erp.com/api/woocommerce/webhook` | New products |
| Product updated | `https://your-erp.com/api/woocommerce/webhook` | Product changes |
| Customer created | `https://your-erp.com/api/woocommerce/webhook` | New customers |

**Important:** Set the Webhook Secret in WooCommerce and configure `WOOCOMMERCE_WEBHOOK_SECRET` environment variable.

## Event Transformation

### Order Created

```typescript
{
  event_type: 'order.created',
  event_domain: 'Order',
  source_service: 'woocommerce',
  payload: {
    woo_order_id: 123,
    order_number: 'WC-123',
    customer: { ... },
    items: [ ... ],
    smartbill_id: null // Populated if present in WooCommerce meta
  }
}
```

### Product Created/Updated

```typescript
{
  event_type: 'product.created' | 'product.updated',
  event_domain: 'Catalog',
  source_service: 'woocommerce',
  payload: {
    woo_product_id: 456,
    name: 'Product Name',
    sku: 'SKU-001',
    price: 99.99,
    stock_quantity: 50
  }
}
```

### Customer Created/Updated

```typescript
{
  event_type: 'customer.created' | 'customer.updated',
  event_domain: 'Customer',
  source_service: 'woocommerce',
  payload: {
    woo_customer_id: 789,
    email: 'customer@example.com',
    first_name: 'John',
    last_name: 'Doe'
  }
}
```

## Retry Mechanism

Failed webhooks are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |
| 4 | 8 seconds |
| 5 | 16 seconds (max, moves to DLQ) |

## Dead Letter Queue

After 5 failed attempts, webhooks are moved to the Dead Letter Queue. The DLQ provides:

- **Get entries**: `GET /api/woocommerce/webhook/dead-letter`
- **Get by topic**: `GET /api/woocommerce/webhook/dead-letter?topic=order.created`
- **Search**: `GET /api/woocommerce/webhook/dead-letter/search?q=error`
- **Replay**: `POST /api/woocommerce/webhook/dead-letter/:id/retry`
- **Batch replay**: `POST /api/woocommerce/webhook/dead-letter/batch-retry`
- **Export**: `GET /api/woocommerce/webhook/dead-letter/export`

## Outbox Integration

All transformed events are written to `shared.outbox_events` table for:

- Unified replay across all modules
- Event ordering guarantees
- Consistent state recovery
- Audit trail for all events

## API Endpoints

### Public (No Auth)
- `POST /api/woocommerce/webhook` - Main webhook endpoint
- `GET /api/woocommerce/webhook/health` - Health check

### Admin (Requires Auth)
- `GET /api/woocommerce/webhook/stats` - Webhook statistics
- `GET /api/woocommerce/webhook/dead-letter` - DLQ entries
- `POST /api/woocommerce/webhook/dead-letter/:id/retry` - Replay single
- `POST /api/woocommerce/webhook/dead-letter/batch-retry` - Batch replay

## Health Check

The module provides a comprehensive health check including:

```json
{
  "status": "healthy",
  "components": {
    "database": { "status": "up" },
    "webhookComposition": {
      "status": "up",
      "retryWorker": "running",
      "outboxPublisher": "healthy",
      "dlqEntries": 5,
      "webhookStats": {
        "pending": 2,
        "processing": 1,
        "completed": 100,
        "failed": 3,
        "deadLetter": 5
      }
    }
  }
}
```

## SmartBill Integration

When a WooCommerce order is created:

1. The webhook payload includes `smartbill_id` in meta_data (if set)
2. This is persisted in the `orders.smartbill_id` column
3. Links WooCommerce orders to SmartBill invoices

## Idempotency

All webhooks are idempotent via:

1. Unique constraint on `woocommerce_webhook_logs.webhook_id`
2. Pre-processing check for duplicates
3. Returns success without reprocessing for duplicates

## Security

- HMAC-SHA256 signature verification for all webhooks
- Webhook secret stored securely in environment
- Timing-safe comparison to prevent timing attacks
- Rate limiting on webhook endpoints (recommended)

## Testing

```bash
# Build the module
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Webhooks not being received
- Verify webhook URL is accessible from WooCommerce
- Check webhook secret matches `WOOCOMMERCE_WEBHOOK_SECRET`
- Review logs for signature verification errors

### Events stuck in failed state
- Check error messages in `woocommerce_webhook_logs`
- Verify outbox_publisher health
- Manually retry via DLQ endpoint

### High DLQ count
- Investigate common error patterns
- Fix root cause before retrying
- Consider increasing `max_attempts` for transient issues
