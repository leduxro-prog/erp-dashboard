# Cypher ERP - API Documentation

**Base URL:** `http://localhost:3000`
**API Prefix:** `/api/v1`
**Last Updated:** February 2026

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [User Management](#2-user-management)
3. [Two-Factor Authentication](#3-two-factor-authentication)
4. [Orders](#4-orders)
5. [Pricing Engine](#5-pricing-engine)
6. [Inventory Management](#6-inventory-management)
7. [Quotations](#7-quotations)
8. [Suppliers](#8-suppliers)
9. [SmartBill Integration](#9-smartbill-integration)
10. [WooCommerce Sync](#10-woocommerce-sync)
11. [B2B Portal](#11-b2b-portal)
12. [Audit Logs](#12-audit-logs)
13. [Admin DLQ (Dead Letter Queue)](#13-admin-dlq-dead-letter-queue)
14. [System & Monitoring](#14-system--monitoring)
15. [Rate Limiting](#15-rate-limiting)
16. [Error Handling](#16-error-handling)

---

## Authentication Overview

All endpoints (except those marked **public**) require authentication via one of:

1. **HttpOnly cookie** (preferred) -- `access_token` cookie set after login
2. **Authorization header** (fallback) -- `Authorization: Bearer <token>`

If the access token expires and a valid `refresh_token` cookie exists, the auth middleware auto-refreshes tokens transparently.

---

## 1. Authentication & Authorization

### POST `/api/v1/users/login`

Login with email and password. Returns JWT tokens and sets HttpOnly cookies.

| Property   | Value                          |
| ---------- | ------------------------------ |
| Auth       | Public                         |
| Rate Limit | **5 requests / 15 min** per IP |

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response (without 2FA):**

```json
{
  "success": true,
  "token": "<access_token>",
  "refreshToken": "<refresh_token>",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "admin",
    "is_active": true
  }
}
```

**Response (2FA enabled):**

```json
{
  "success": true,
  "requires2FA": true,
  "preAuthToken": "<pre_auth_token>"
}
```

**Error (account locked):**

```json
{
  "error": "Account temporarily locked",
  "message": "Too many failed login attempts. Please try again in 14 minutes.",
  "lockedUntil": "2026-02-15T12:30:00.000Z"
}
```

```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ledux.ro","password":"secret"}' \
  -c cookies.txt
```

---

### POST `/api/v1/auth/refresh`

Refresh an expired access token. Reads refresh token from HttpOnly cookie or request body.

| Property   | Value                          |
| ---------- | ------------------------------ |
| Auth       | Refresh token (cookie or body) |
| Rate Limit | Global                         |

**Request Body (optional, for backwards compat):**

```json
{
  "refreshToken": "<refresh_token>"
}
```

**Response:**

```json
{
  "message": "Tokens refreshed successfully",
  "token": "<new_access_token>",
  "refreshToken": "<new_refresh_token>"
}
```

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -b cookies.txt -c cookies.txt
```

---

### POST `/api/v1/auth/logout`

Clear all auth cookies and end the session.

| Property | Value                   |
| -------- | ----------------------- |
| Auth     | Public (clears cookies) |

**Response:**

```json
{
  "message": "Logged out successfully"
}
```

---

## 2. User Management

All user management routes are mounted at `/api/v1/users`.

### GET `/api/v1/users/`

List all users (sensitive fields like `password_hash` are stripped).

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Response:** Array of user objects.

---

### POST `/api/v1/users/`

Create a new user.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Request Body:**

```json
{
  "email": "new@example.com",
  "password": "secure-password",
  "first_name": "Jane",
  "last_name": "Doe",
  "role": "user"
}
```

**Response:** `201 Created` with user object (no `password_hash`).

---

### DELETE `/api/v1/users/:id`

Delete a user by ID.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Response:** `204 No Content`

---

## 3. Two-Factor Authentication

2FA routes are mounted at `/api/v1/users/2fa`. Rate limited to **10 requests / 15 min** per IP.

### POST `/api/v1/users/2fa/setup`

Generate a TOTP secret and QR code for 2FA setup.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Response:**

```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "otpauthUrl": "otpauth://totp/Cypher%20ERP:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Cypher%20ERP",
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

---

### POST `/api/v1/users/2fa/verify-setup`

Verify a TOTP token against the secret and enable 2FA. Returns one-time backup codes.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Request Body:**

```json
{
  "token": "123456",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

**Response:**

```json
{
  "success": true,
  "message": "2FA enabled successfully",
  "backupCodes": ["8A2B3C4D", "1E2F3A4B", "..."]
}
```

---

### POST `/api/v1/users/2fa/disable`

Disable 2FA. Requires a valid current TOTP token for confirmation.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Request Body:**

```json
{
  "token": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "2FA disabled successfully"
}
```

---

### POST `/api/v1/users/2fa/verify`

Complete login for users with 2FA enabled. Uses the `preAuthToken` from the login response.

| Property | Value                       |
| -------- | --------------------------- |
| Auth     | Pre-auth token (from login) |

**Request Body:**

```json
{
  "token": "123456",
  "preAuthToken": "<pre_auth_token>",
  "isBackupCode": false
}
```

**Response (on success):**

```json
{
  "success": true,
  "token": "<access_token>",
  "refreshToken": "<refresh_token>",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "admin",
    "is_active": true
  }
}
```

---

## 4. Orders

All order routes require authentication. Mounted at `/api/v1/orders`.
Write operations are rate limited to **30/min**.

### POST `/api/v1/orders/`

Create a new order.

| Property   | Value         |
| ---------- | ------------- |
| Auth       | Authenticated |
| Rate Limit | 30 writes/min |

---

### GET `/api/v1/orders/`

List orders with pagination and filters.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Query Parameters:** `page`, `limit`, `status`, `search`, `date_from`, `date_to`

---

### GET `/api/v1/orders/:id`

Get a specific order by ID.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### GET `/api/v1/orders/number/:orderNumber`

Get an order by its order number.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### PATCH `/api/v1/orders/:id/status`

Update order status. Validates valid status transitions.

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

**Request Body:**

```json
{
  "status": "SHIPPED"
}
```

---

### POST `/api/v1/orders/:id/partial-delivery`

Record a partial delivery for an order.

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

---

### POST `/api/v1/orders/:id/cancel`

Cancel an order (rolls back inventory reservations).

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

---

### POST `/api/v1/orders/:id/proforma`

Generate a proforma invoice for the order.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### GET `/api/v1/orders/:id/status-history`

Get the full status transition history of an order.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### GET `/api/v1/orders/customer/:customerId`

Get all orders for a specific customer.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

## 5. Pricing Engine

Mounted at `/api/v1/pricing-engine`. All routes require authentication.

### GET `/api/v1/pricing-engine/:productId`

Get pricing for a product including tier and volume discounts.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Query Parameters:** `customerId`, `quantity`

---

### POST `/api/v1/pricing-engine/calculate`

Calculate pricing for an order with multiple items.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Request Body:**

```json
{
  "customerId": 1,
  "items": [{ "productId": 100, "quantity": 50 }]
}
```

---

### GET `/api/v1/pricing-engine/:productId/tiers`

Get tier pricing breakdown for a product.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### POST `/api/v1/pricing-engine/promotions`

Create a new promotion.

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

---

### GET `/api/v1/pricing-engine/promotions`

List all promotions.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### DELETE `/api/v1/pricing-engine/promotions/:id`

Deactivate a promotion.

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

---

## 6. Inventory Management

Mounted at `/api/v1/inventory`. All routes require authentication.

### GET `/api/v1/inventory/stock-levels`

List stock levels across all warehouses. Alias: `GET /api/v1/inventory/products`

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### GET `/api/v1/inventory/:productId`

Get stock levels for a specific product across warehouses.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### POST `/api/v1/inventory/check`

Batch check stock availability for multiple products.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Request Body:**

```json
{
  "items": [
    { "productId": 100, "quantity": 5 },
    { "productId": 101, "quantity": 10 }
  ]
}
```

---

### GET `/api/v1/inventory/:productId/movements`

Get stock movement history for a product.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

**Query Parameters:** `page`, `limit`, `type`

---

### POST `/api/v1/inventory/reserve`

Reserve stock for an order.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### DELETE `/api/v1/inventory/reservations/:id`

Release a stock reservation.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### POST `/api/v1/inventory/adjust`

Manually adjust stock quantities.

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

---

### GET `/api/v1/inventory/alerts`

Get low-stock alerts.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### POST `/api/v1/inventory/alerts/:id/acknowledge`

Acknowledge a low-stock alert.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### POST `/api/v1/inventory/sync/smartbill`

Trigger inventory sync with SmartBill.

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

---

### POST `/api/v1/inventory/sync/suppliers`

Trigger inventory sync with suppliers.

| Property | Value      |
| -------- | ---------- |
| Auth     | Admin only |

---

### GET `/api/v1/inventory/warehouses`

List all warehouses.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### Product Image Endpoints (Admin only)

| Method | Path                                                    | Description                |
| ------ | ------------------------------------------------------- | -------------------------- |
| POST   | `/api/v1/inventory/products/:productId/images`          | Add product image          |
| DELETE | `/api/v1/inventory/products/:productId/images/:imageId` | Delete product image       |
| POST   | `/api/v1/inventory/products/images/bulk-import`         | Bulk import images         |
| POST   | `/api/v1/inventory/products/images/auto-search`         | Auto-search product images |

---

## 7. Quotations

Mounted at `/api/v1/quotations`. All routes require authentication.

### Core CRUD

| Method | Path       | Auth          | Description                           |
| ------ | ---------- | ------------- | ------------------------------------- |
| POST   | `/`        | Authenticated | Create a new quote                    |
| GET    | `/`        | Authenticated | List quotes (with filters/pagination) |
| GET    | `/:id`     | Authenticated | Get quote by ID                       |
| GET    | `/:id/pdf` | Authenticated | Download quote as PDF                 |

### Workflow Actions

| Method | Path           | Auth          | Description                     |
| ------ | -------------- | ------------- | ------------------------------- |
| POST   | `/:id/send`    | Authenticated | Send quote to customer          |
| POST   | `/:id/accept`  | Authenticated | Accept a quote                  |
| POST   | `/:id/reject`  | Authenticated | Reject a quote (with reason)    |
| POST   | `/:id/convert` | Admin only    | Convert accepted quote to order |
| POST   | `/:id/remind`  | Authenticated | Send manual reminder            |

### Analytics

| Method | Path                       | Description                    |
| ------ | -------------------------- | ------------------------------ |
| GET    | `/analytics/metrics`       | Quote metrics for date range   |
| GET    | `/analytics/trends`        | Quote trends over time         |
| GET    | `/analytics/top-customers` | Top customers by quote value   |
| GET    | `/analytics/top-products`  | Top quoted products            |
| GET    | `/analytics/expiring`      | Quotes expiring soon           |
| GET    | `/workflow/stats`          | Workflow automation statistics |

---

## 8. Suppliers

Mounted at `/api/v1/suppliers`. All routes require authentication.

### Supplier Management

| Method | Path                        | Auth          | Description                   |
| ------ | --------------------------- | ------------- | ----------------------------- |
| GET    | `/suppliers`                | Authenticated | List all suppliers            |
| GET    | `/suppliers/:id`            | Authenticated | Get supplier details          |
| GET    | `/suppliers/:id/products`   | Authenticated | Get supplier's products       |
| GET    | `/suppliers/:id/statistics` | Authenticated | Get product statistics        |
| POST   | `/suppliers/:id/sync`       | Admin only    | Trigger sync for one supplier |
| POST   | `/suppliers/sync-all`       | Admin only    | Sync all suppliers            |

### SKU Mappings

| Method | Path                                 | Auth          | Description           |
| ------ | ------------------------------------ | ------------- | --------------------- |
| GET    | `/suppliers/:id/sku-mappings`        | Authenticated | List SKU mappings     |
| GET    | `/suppliers/:id/unmapped-products`   | Authenticated | Get unmapped products |
| POST   | `/suppliers/:id/sku-mappings`        | Authenticated | Create SKU mapping    |
| DELETE | `/suppliers/sku-mappings/:mappingId` | Admin only    | Delete SKU mapping    |

### Supplier Orders

| Method | Path                    | Auth          | Description          |
| ------ | ----------------------- | ------------- | -------------------- |
| POST   | `/suppliers/:id/orders` | Authenticated | Place supplier order |
| GET    | `/suppliers/:id/orders` | Authenticated | List supplier orders |

---

## 9. SmartBill Integration

Mounted at `/api/v1/smartbill`. All routes require authentication.

### Invoices & Proformas

| Method | Path                          | Auth          | Description                |
| ------ | ----------------------------- | ------------- | -------------------------- |
| POST   | `/invoices`                   | Authenticated | Create SmartBill invoice   |
| GET    | `/invoices/:id`               | Authenticated | Get invoice details        |
| GET    | `/invoices/:invoiceId/status` | Authenticated | Get invoice payment status |
| POST   | `/invoices/:invoiceId/paid`   | Admin only    | Mark invoice as paid       |
| POST   | `/proformas`                  | Authenticated | Create proforma invoice    |
| GET    | `/proformas/:id`              | Authenticated | Get proforma details       |

### Sync & Import

| Method | Path              | Auth          | Description                      |
| ------ | ----------------- | ------------- | -------------------------------- |
| POST   | `/sync-stock`     | Admin only    | Sync stock with SmartBill        |
| GET    | `/warehouses`     | Authenticated | List SmartBill warehouses        |
| POST   | `/sync-prices`    | Admin only    | Sync prices from invoices        |
| GET    | `/preview-prices` | Admin only    | Preview price sync               |
| POST   | `/import-prices`  | Admin only    | Import prices from Excel (.xlsx) |
| GET    | `/template`       | Admin only    | Download Excel import template   |

---

## 10. WooCommerce Sync

Mounted at `/api/v1/woocommerce-sync`.

### Webhook (Public)

| Method | Path       | Auth                   | Description                  |
| ------ | ---------- | ---------------------- | ---------------------------- |
| POST   | `/webhook` | Public (HMAC verified) | Receive WooCommerce webhooks |

### Sync Operations

| Method | Path                       | Auth          | Description                     |
| ------ | -------------------------- | ------------- | ------------------------------- |
| GET    | `/test-connection`         | Authenticated | Test WooCommerce API connection |
| POST   | `/sync/product/:productId` | Authenticated | Sync single product             |
| POST   | `/sync/all`                | Admin only    | Sync all products               |
| POST   | `/sync/stock/:productId`   | Authenticated | Sync stock for product          |
| POST   | `/sync/price/:productId`   | Authenticated | Sync price for product          |
| POST   | `/sync/categories`         | Admin only    | Sync categories                 |
| POST   | `/pull/orders`             | Authenticated | Pull orders from WooCommerce    |

### Diagnostics

| Method | Path                   | Auth          | Description             |
| ------ | ---------------------- | ------------- | ----------------------- |
| GET    | `/sync/status`         | Authenticated | Get overall sync status |
| GET    | `/sync/failed`         | Admin only    | List failed sync items  |
| POST   | `/sync/retry`          | Admin only    | Retry failed syncs      |
| GET    | `/mappings/:productId` | Authenticated | Get product mapping     |

---

## 11. B2B Portal

Mounted at `/api/v1/b2b-portal`. Uses B2B-specific authentication (`authenticateB2B`) for customer-facing endpoints.

### Public Endpoints

| Method | Path                   | Description                   |
| ------ | ---------------------- | ----------------------------- |
| POST   | `/register`            | Register new B2B customer     |
| POST   | `/verify-cui`          | Verify CUI with ANAF API      |
| GET    | `/verify-cui/:cui`     | Verify CUI via GET            |
| GET    | `/products`            | List B2B catalog products     |
| GET    | `/products/filters`    | Get available product filters |
| GET    | `/products/categories` | Get product category tree     |
| GET    | `/products/:id`        | Get product details           |

### Admin Endpoints (JWT auth + admin role)

| Method | Path                        | Description                 |
| ------ | --------------------------- | --------------------------- |
| GET    | `/registrations`            | List B2B registrations      |
| GET    | `/registrations/:id`        | Get registration details    |
| PUT    | `/registrations/:id/review` | Approve/reject registration |
| GET    | `/customers`                | List B2B customers          |
| GET    | `/customers/:id`            | Get customer details        |
| PUT    | `/customers/:id/credit`     | Adjust credit limit         |

### B2B Customer Endpoints (B2B auth)

| Method | Path                     | Description             |
| ------ | ------------------------ | ----------------------- |
| GET    | `/profile`               | Get customer profile    |
| PUT    | `/profile`               | Update customer profile |
| GET    | `/addresses`             | List addresses          |
| POST   | `/addresses`             | Add new address         |
| PUT    | `/addresses/:id`         | Update address          |
| DELETE | `/addresses/:id`         | Delete address          |
| PUT    | `/addresses/:id/default` | Set default address     |

### Cart

| Method | Path                   | Description               |
| ------ | ---------------------- | ------------------------- |
| GET    | `/cart`                | Get active cart           |
| POST   | `/cart/item`           | Add item to cart          |
| PUT    | `/cart/item/:item_id`  | Update cart item quantity |
| DELETE | `/cart/item/:item_id`  | Remove item from cart     |
| DELETE | `/cart/clear`          | Clear cart                |
| GET    | `/cart/validate-stock` | Validate cart stock       |

### Checkout

| Method | Path                        | Description                      |
| ------ | --------------------------- | -------------------------------- |
| GET    | `/checkout/profile`         | Get checkout profile with credit |
| POST   | `/checkout/validate-stock`  | Validate stock for checkout      |
| POST   | `/checkout/validate-credit` | Validate credit for order        |
| GET    | `/checkout/addresses`       | Get saved addresses              |
| POST   | `/checkout/addresses`       | Save new address                 |
| POST   | `/checkout`                 | Process checkout (create order)  |

### Orders

| Method | Path                  | Description           |
| ------ | --------------------- | --------------------- |
| POST   | `/orders`             | Create B2B order      |
| GET    | `/orders`             | Order history         |
| GET    | `/orders/:id`         | Order details         |
| POST   | `/orders/reorder/:id` | Reorder from previous |
| DELETE | `/orders/:id`         | Cancel order          |
| POST   | `/orders/import-csv`  | Import CSV for order  |
| GET    | `/credit`             | Get credit info       |

### Bulk Orders, Saved Carts, Invoices, Payments, Favorites

| Method | Path                                 | Description               |
| ------ | ------------------------------------ | ------------------------- |
| POST   | `/bulk-orders`                       | Create bulk order         |
| GET    | `/bulk-orders`                       | List bulk orders          |
| POST   | `/carts`                             | Create saved cart         |
| GET    | `/carts`                             | List saved carts          |
| POST   | `/carts/:id/convert`                 | Convert cart to order     |
| GET    | `/invoices`                          | List invoices             |
| GET    | `/invoices/:id`                      | Invoice details           |
| GET    | `/invoices/:orderId/download`        | Download invoice PDF      |
| GET    | `/invoices/:orderId/preview`         | Preview invoice           |
| GET    | `/payments`                          | List payments             |
| GET    | `/payments/summary`                  | Payment summary           |
| GET    | `/favorites`                         | List favorites            |
| POST   | `/favorites`                         | Add favorite              |
| DELETE | `/favorites/:productId`              | Remove favorite           |
| GET    | `/favorites/check/:productId`        | Check if favorited        |
| POST   | `/favorites/add-all-to-cart`         | Add all favorites to cart |
| POST   | `/favorites/:productId/notify-stock` | Notify when back in stock |

---

## 12. Audit Logs

Admin-only endpoints for reviewing the audit trail.

### GET `/api/v1/admin/audit-logs`

Query audit logs with filters and pagination.

| Property | Value                             |
| -------- | --------------------------------- |
| Auth     | Authenticated (admin recommended) |

**Query Parameters:**

| Parameter      | Type   | Description                                                        |
| -------------- | ------ | ------------------------------------------------------------------ |
| `userId`       | string | Filter by user ID                                                  |
| `userEmail`    | string | Filter by email (partial match)                                    |
| `action`       | string | Filter by action (CREATE, UPDATE, DELETE)                          |
| `resourceType` | string | Filter by resource type                                            |
| `resourceId`   | string | Filter by resource ID                                              |
| `startDate`    | string | Start date (ISO 8601)                                              |
| `endDate`      | string | End date (ISO 8601)                                                |
| `search`       | string | Free-text search across fields                                     |
| `page`         | number | Page number (default: 1)                                           |
| `limit`        | number | Items per page (default: 25, max: 100)                             |
| `sortBy`       | string | Sort column: `created_at`, `action`, `resource_type`, `user_email` |
| `sortDir`      | string | `ASC` or `DESC` (default: DESC)                                    |

**Response:**

```json
{
  "status": "ok",
  "data": [
    {
      "id": "uuid",
      "userId": "1",
      "userEmail": "admin@ledux.ro",
      "action": "CREATE",
      "resourceType": "Order",
      "resourceId": "42",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "changes": { "after": { "status": "confirmed" } },
      "metadata": { "requestId": "uuid", "statusCode": 201, "duration": 45 },
      "createdAt": "2026-02-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1500,
    "totalPages": 60
  }
}
```

```bash
curl "http://localhost:3000/api/v1/admin/audit-logs?action=CREATE&limit=10" \
  -H "Authorization: Bearer <token>"
```

---

### GET `/api/v1/admin/audit-logs/stats`

Get aggregated audit statistics for the last 30 days.

**Response:**

```json
{
  "status": "ok",
  "data": {
    "totalEvents": 15000,
    "actionsPerDay": [{ "date": "2026-02-15", "count": 120 }],
    "topUsers": [{ "userEmail": "admin@ledux.ro", "count": 500 }],
    "actionBreakdown": [{ "action": "CREATE", "count": 6000 }],
    "resourceBreakdown": [{ "resourceType": "Order", "count": 3000 }]
  }
}
```

---

### GET `/api/v1/admin/audit-logs/export`

Export audit logs as CSV file. Accepts the same filter parameters as the query endpoint (excluding pagination). Limited to 10,000 rows.

**Response:** `text/csv` file download (`audit-logs.csv`).

```bash
curl "http://localhost:3000/api/v1/admin/audit-logs/export?action=DELETE" \
  -H "Authorization: Bearer <token>" -o audit-logs.csv
```

---

## 13. Admin DLQ (Dead Letter Queue)

Unified dead letter queue management for failed webhooks, outbox events, and SmartBill operations.

### GET `/api/v1/admin/dlq/stats`

Get DLQ statistics across all sources.

| Property | Value         |
| -------- | ------------- |
| Auth     | Authenticated |

---

### GET `/api/v1/admin/dlq/entries`

List DLQ entries.

**Query Parameters:** `source` (woocommerce | smartbill | outbox), `limit` (default: 50), `offset` (default: 0)

---

### POST `/api/v1/admin/dlq/replay/:source/:id`

Replay a single DLQ entry. Source must be `woocommerce` or `outbox`.

---

### POST `/api/v1/admin/dlq/replay-all/:source`

Bulk replay all retryable entries for a source.

---

## 14. System & Monitoring

### GET `/health`

Basic health check. Also available at `/api/v1/health`.

| Property | Value  |
| -------- | ------ |
| Auth     | Public |

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "environment": "production"
}
```

---

### GET `/api/v1/system/modules`

List all loaded modules with health status.

| Property | Value  |
| -------- | ------ |
| Auth     | Public |

---

### GET `/api/v1/system/metrics`

System metrics in JSON format.

| Property | Value  |
| -------- | ------ |
| Auth     | Public |

---

### GET `/metrics`

Prometheus-compatible metrics in text format.

| Property     | Value                       |
| ------------ | --------------------------- |
| Auth         | Public                      |
| Content-Type | `text/plain; version=0.0.4` |

---

### GET `/api/v1/system/metrics/detailed`

Detailed route-level request metrics.

| Property | Value  |
| -------- | ------ |
| Auth     | Public |

---

## 15. Rate Limiting

All rate limiters use `express-rate-limit` with standard headers enabled.

| Scope            | Limit        | Window     | Applied To                                                             |
| ---------------- | ------------ | ---------- | ---------------------------------------------------------------------- |
| Global API       | 100 requests | 15 minutes | All `/api/*` endpoints                                                 |
| Login            | 5 attempts   | 15 minutes | `POST /api/v1/users/login`                                             |
| Auth (2FA)       | 10 attempts  | 15 minutes | `/api/v1/users/2fa/*`                                                  |
| Write Operations | 30 requests  | 1 minute   | `POST/PUT/PATCH/DELETE` on `/api/v1/orders/*` and `/api/v1/settings/*` |

**Response Headers:**

| Header                | Description                          |
| --------------------- | ------------------------------------ |
| `RateLimit-Limit`     | Maximum requests in current window   |
| `RateLimit-Remaining` | Remaining requests in current window |
| `RateLimit-Reset`     | Unix timestamp when window resets    |

**Rate Limit Exceeded (429):**

```json
{
  "status": 429,
  "message": "Too many requests, please try again later."
}
```

Health check endpoints (`/health`, `/api/v1/health`) are exempt from rate limiting.

---

## 16. Error Handling

### Standard Error Response

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```

### HTTP Status Codes

| Code  | Meaning                                                     |
| ----- | ----------------------------------------------------------- |
| `200` | Success                                                     |
| `201` | Created                                                     |
| `204` | No Content (successful delete)                              |
| `400` | Bad Request (validation error)                              |
| `401` | Unauthorized (missing/invalid token)                        |
| `403` | Forbidden (insufficient role, CSRF failure, account locked) |
| `404` | Not Found                                                   |
| `409` | Conflict (duplicate resource)                               |
| `429` | Too Many Requests (rate limited)                            |
| `500` | Internal Server Error                                       |

### Validation Error Response

```json
{
  "success": false,
  "message": "Validation error",
  "details": ["\"email\" is required", "\"password\" must be at least 8 characters"]
}
```
