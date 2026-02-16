# B2B Portal Integration

This document describes the B2B Portal integration functionality within the Cypher ERP system.

## Overview

The B2B Portal integration enables bidirectional synchronization of orders and invoices between the internal ERP system and an external B2B Portal API. This includes:

- Real-time order status synchronization from B2B Portal to ERP
- Real-time invoice status synchronization from B2B Portal to ERP
- Order and invoice creation in B2B Portal from ERP
- Webhook support for real-time updates from B2B Portal
- Idempotency for safe retries
- Audit trail of all sync operations

## Configuration

### B2B Portal API Configuration

To enable B2B Portal integration, configure the module with the following:

```typescript
import { B2BPortalModule } from '@cypher/b2b-portal';

const b2bModule = new B2BPortalModule();

// Configure B2B Portal integration
b2bModule.configureB2BPortal({
  b2bPortal: {
    baseUrl: 'https://b2b-portal.example.com/api/v1',
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret', // Optional, for webhook signature verification
    merchantId: 'your-merchant-id',
    timeout: 30000, // Optional, default 30000ms
    maxRetries: 3, // Optional, default 3
  },
});
```

### Environment Variables

Alternatively, use environment variables:

```bash
B2B_PORTAL_BASE_URL=https://b2b-portal.example.com/api/v1
B2B_PORTAL_API_KEY=your-api-key
B2B_PORTAL_API_SECRET=your-api-secret
B2B_PORTAL_MERCHANT_ID=your-merchant-id
B2B_PORTAL_TIMEOUT=30000
B2B_PORTAL_MAX_RETRIES=3
```

## Database Schema

### B2B Orders Table

The `b2b_orders` table includes the following B2B Portal integration columns:

| Column | Type | Description |
|--------|------|-------------|
| `b2b_order_id` | VARCHAR(255) | External B2B Portal order identifier |
| `b2b_synced_at` | TIMESTAMP | Last sync timestamp with B2B Portal |
| `b2b_sync_status` | VARCHAR(50) | Sync status: 'pending', 'synced', 'failed' |
| `b2b_last_error` | TEXT | Last error message from B2B Portal sync |

### Invoices Table

The `invoices` table includes the following B2B Portal integration columns:

| Column | Type | Description |
|--------|------|-------------|
| `b2b_invoice_id` | VARCHAR(255) | External B2B Portal invoice identifier |
| `b2b_synced_at` | TIMESTAMP | Last sync timestamp with B2B Portal |
| `b2b_sync_status` | VARCHAR(50) | Sync status: 'pending', 'synced', 'failed' |
| `b2b_last_error` | TEXT | Last error message from B2B Portal sync |

### B2B Sync Events Table

The `b2b_sync_events` table stores an audit trail of all sync operations:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique event identifier |
| `entity_type` | VARCHAR(50) | Type of entity: 'order', 'invoice', 'customer' |
| `entity_id` | VARCHAR(255) | Internal ERP entity ID |
| `b2b_entity_id` | VARCHAR(255) | External B2B Portal entity ID |
| `event_type` | VARCHAR(50) | Type of event: 'create', 'update', 'delete', 'status_change', 'query' |
| `direction` | VARCHAR(20) | Direction: 'outbound' (ERP->B2B), 'inbound' (B2B->ERP) |
| `payload` | JSONB | Event payload data |
| `status` | VARCHAR(50) | Event status: 'pending', 'success', 'failed', 'retrying' |
| `error_message` | TEXT | Error message if failed |
| `retry_count` | INT | Number of retry attempts |
| `idempotency_key` | VARCHAR(255) | Unique key for idempotent operations |
| `created_at` | TIMESTAMP | Event creation timestamp |
| `updated_at` | TIMESTAMP | Event last update timestamp |
| `processed_at` | TIMESTAMP | Event processing completion timestamp |

### B2B Webhook Events Table

The `b2b_webhook_events` table stores incoming webhook events:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique event identifier |
| `event_id` | VARCHAR(255) | Unique webhook event ID |
| `event_type` | VARCHAR(100) | Type of webhook event |
| `entity_type` | VARCHAR(50) | Type of entity: 'order', 'invoice' |
| `payload` | JSONB | Webhook payload data |
| `status` | VARCHAR(50) | Processing status: 'received', 'processed', 'failed' |
| `error_message` | TEXT | Error message if failed |
| `created_at` | TIMESTAMP | Webhook received timestamp |
| `processed_at` | TIMESTAMP | Webhook processed timestamp |

## API Endpoints

### Webhook Endpoints

#### POST /api/v1/b2b/webhooks/b2b/order
Handle order status updates from B2B Portal.

**Headers:**
- `X-B2B-Signature`: HMAC signature for payload verification (if API secret is configured)

**Request Body:**
```json
{
  "event": "order.status.updated",
  "id": "evt_123456789",
  "timestamp": "2026-02-15T10:30:00Z",
  "entity_type": "order",
  "data": {
    "id": "b2b_order_123",
    "order_number": "PO-12345",
    "status": "SHIPPED",
    "previous_status": "PROCESSING",
    "erp_order_id": "erp_order_456",
    "customer_ref_id": "cust_789",
    "tracking_numbers": ["TRK123456"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "erp_order_id": "erp_order_456",
    "b2b_order_id": "b2b_order_123",
    "status": "SHIPPED",
    "message": "Order status updated successfully"
  }
}
```

#### POST /api/v1/b2b/webhooks/b2b/invoice
Handle invoice status updates from B2B Portal.

**Request Body:**
```json
{
  "event": "invoice.status.updated",
  "id": "evt_987654321",
  "timestamp": "2026-02-15T10:30:00Z",
  "entity_type": "invoice",
  "data": {
    "id": "b2b_invoice_123",
    "invoice_number": "INV-2026-001",
    "order_id": "b2b_order_123",
    "status": "PAID",
    "previous_status": "SENT",
    "erp_invoice_id": "erp_invoice_456",
    "paid_date": "2026-02-15T10:30:00Z",
    "paid_amount": 1500.00
  }
}
```

#### POST /api/v1/b2b/webhooks/b2b
Handle generic webhooks from B2B Portal.

#### GET /api/v1/b2b/webhooks/b2b/verify
Verify B2B Portal webhook endpoint is accessible.

### Sync Status Endpoints (Admin Only)

#### GET /api/v1/b2b/sync/orders/:id
Get sync status for a specific order.

#### GET /api/v1/b2b/sync/invoices/:id
Get sync status for a specific invoice.

**Response:**
```json
{
  "success": true,
  "data": {
    "erpInvoiceId": "invoice_123",
    "b2bInvoiceId": "b2b_invoice_456",
    "syncStatus": "synced",
    "syncedAt": "2026-02-15T10:30:00Z",
    "lastError": null,
    "syncEvents": [...]
  }
}
```

#### GET /api/v1/b2b/sync/pending
Get all pending sync events.

**Query Parameters:**
- `entityType`: Filter by entity type (optional)
- `limit`: Maximum number of events to return (default: 50)

#### GET /api/v1/b2b/sync/statistics
Get sync statistics for the last 30 days.

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": {
      "pending": 5,
      "success": 150,
      "failed": 2,
      "retrying": 3,
      "total": 160
    },
    "invoices": {
      "pending": 3,
      "success": 145,
      "failed": 1,
      "retrying": 2,
      "total": 151
    }
  }
}
```

#### POST /api/v1/b2b/sync/orders/:id/sync
Trigger manual sync for an order.

**Request Body:**
```json
{
  "force": false
}
```

#### POST /api/v1/b2b/sync/invoices/:id/sync
Trigger manual sync for an invoice.

## Status Mapping

### Order Status Mapping

| B2B Portal Status | ERP Status |
|------------------|------------|
| PENDING | PENDING |
| CONFIRMED | CONFIRMED |
| PROCESSING | PROCESSING |
| SHIPPED | SHIPPED |
| DELIVERED | DELIVERED |
| CANCELLED | CANCELLED |
| RETURNED | RETURNED |
| REFUNDED | REFUNDED |
| ON_HOLD | ON_HOLD |
| PAYMENT_FAILED | ON_HOLD |
| PAYMENT_PENDING | PENDING |

### Invoice Status Mapping

| B2B Portal Status | ERP Status |
|------------------|------------|
| DRAFT | DRAFT |
| ISSUED | ISSUED |
| SENT | SENT |
| VIEWED | SENT |
| PAID | PAID |
| PARTIALLY_PAID | PARTIALLY_PAID |
| OVERDUE | OVERDUE |
| CANCELLED | CANCELLED |
| REFUNDED | REFUNDED |
| VOID | VOID |

## Events

### Published Events

The B2B Portal module publishes the following events:

- `b2b.order_synced`: Order synced to B2B Portal
  ```json
  {
    "erpOrderId": "order_123",
    "b2bOrderId": "b2b_order_456",
    "b2bOrderNumber": "PO-12345",
    "action": "created",
    "timestamp": "2026-02-15T10:30:00Z"
  }
  ```

- `b2b.order_status_changed`: Order status updated from B2B Portal
  ```json
  {
    "erpOrderId": "order_123",
    "b2bOrderId": "b2b_order_456",
    "previousStatus": "PROCESSING",
    "newStatus": "SHIPPED",
    "b2bStatus": "SHIPPED",
    "timestamp": "2026-02-15T10:30:00Z"
  }
  ```

- `b2b.invoice_synced`: Invoice synced to B2B Portal

- `b2b.invoice_status_changed`: Invoice status updated from B2B Portal

## Idempotency

All sync operations support idempotency through the use of idempotency keys:

1. Generate a unique idempotency key before creating/updating an entity in B2B Portal
2. Include the key in the API request
3. The system checks if the key has been processed before
4. If processed, returns the cached result
5. If not processed, processes the request and stores the result

```typescript
const idempotencyKey = b2bApiClient.generateIdempotencyKey('order');
await syncOrderToB2BPortal.execute({
  erpOrderId: 'order_123',
  orderData: {...},
  status: 'PENDING',
  idempotencyKey: idempotencyKey.key,
});
```

## Webhook Signature Verification

For secure webhooks, configure an API secret. The B2B Portal will sign each webhook payload using HMAC-SHA256.

The verification process:
1. Extract the `X-B2B-Signature` header
2. Compute HMAC-SHA256 of the raw payload using your API secret
3. Compare with the received signature using timing-safe comparison

## Error Handling

### Retry Logic

The API client implements exponential backoff retry logic for:
- 429 (Too Many Requests)
- 500, 502, 503, 504 (Server errors)

Default retry configuration:
- Max retries: 3
- Initial delay: 1000ms
- Backoff factor: 2 (exponential)

### Sync Failure Handling

When a sync operation fails:
1. The sync event is marked as `failed`
2. Error details are stored in `b2b_last_error`
3. Retry count is incremented
4. Can be retried later via manual trigger or background job

## Monitoring

### Health Checks

The module health check includes B2B Portal API connectivity:

```typescript
const health = await b2bModule.getHealth();
// Returns status and details including B2B Portal connection
```

### Metrics

The module tracks:
- Number of sync requests (successful/failed)
- Average response time
- Number of webhook events processed
- Number of active/retrying sync events

## Background Jobs

Recommended background jobs:

1. **Retry Failed Syncs**: Every 5 minutes, retry failed sync events with retry_count < max_retries
2. **Sync Status Check**: Every 15 minutes, query pending orders/invoices from B2B Portal
3. **Cleanup Old Events**: Daily, delete sync events older than 90 days
4. **Cleanup Old Webhooks**: Daily, delete webhook events older than 30 days

## Security Considerations

1. **API Key Security**: Store API keys securely using environment variables or secrets manager
2. **Webhook Verification**: Always verify webhook signatures when API secret is configured
3. **Rate Limiting**: The API client enforces rate limiting (10 requests/second by default)
4. **HTTPS**: Always use HTTPS for B2B Portal API communication
5. **Idempotency**: Use idempotency keys to prevent duplicate operations

## Troubleshooting

### Orders not syncing

1. Check `b2b_sync_status` column in `b2b_orders` table
2. Check `b2b_last_error` for error details
3. Verify B2B Portal API credentials are correct
4. Check B2B Portal API is accessible

### Webhooks not processing

1. Verify webhook URL is accessible from B2B Portal
2. Check `X-B2B-Signature` verification if using API secret
3. Check `b2b_webhook_events` table for incoming events
4. Verify webhook event format matches expected schema

### Status mapping issues

1. Review status mapping configuration
2. Check if custom status mappings are needed
3. Enable strict mode to catch unmapped statuses

## Migration

Run the provided database migrations to add B2B Portal integration columns:

```bash
# Add B2B reference IDs and sync columns
npm run migration:run -- AddB2BReferenceIds

# Create webhook events table
npm run migration:run -- CreateWebhookEventsTable
```
