# API Reference

**Version:** 0.1.0
**Base URL:** `http://localhost:3000/api/v1`
**Last Updated:** February 2025
**Authentication:** JWT Bearer Token (see Authentication)

## Table of Contents

1. [Authentication](#authentication)
2. [Pricing Engine](#pricing-engine)
3. [Inventory Management](#inventory-management)
4. [Orders](#orders)
5. [Quotations](#quotations)
6. [SmartBill Integration](#smartbill-integration)
7. [Suppliers](#suppliers)
8. [WooCommerce Sync](#woocommerce-sync)
9. [System Endpoints](#system-endpoints)
10. [Error Handling](#error-handling)
11. [Rate Limiting](#rate-limiting)

---

## Authentication

### Authorization Header

All endpoints (except `/health`) require JWT authentication:

```
Authorization: Bearer <JWT_TOKEN>
```

### Example Request

```bash
curl -X GET http://localhost:3000/api/v1/pricing/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### JWT Token Format

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "userId": 123,
  "email": "user@example.com",
  "role": "sales",
  "iat": 1707300000,
  "exp": 1707386400
}
```

### Valid Roles

- `admin` - Full system access
- `sales` - Create orders, quotes, view pricing
- `warehouse` - Manage inventory, packing
- `finance` - View invoices, payments
- `user` - Read-only access

---

## Pricing Engine

### 1. Get Product Pricing

**Endpoint:** `GET /pricing/:productId`

**Description:** Get current pricing for a product, including tier and volume discount recommendations.

**Authentication:** Required (all roles)

**Path Parameters:**
```
productId (integer, required): Product ID
```

**Query Parameters:**
```
customerId (integer, optional): Customer ID to calculate tier discount
quantity (integer, optional): Order quantity to calculate volume discount
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "sku": "LED-5W-COOL",
    "basePrice": 50.00,
    "cost": 20.00,
    "marginPercentage": 150,
    "tierDiscounts": [
      {
        "tier": "standard",
        "discount": 0,
        "label": "Standard - No discount"
      },
      {
        "tier": "tier_1",
        "discount": 5,
        "label": "Tier 1 - 5% discount"
      },
      {
        "tier": "tier_2",
        "discount": 10,
        "label": "Tier 2 - 10% discount"
      },
      {
        "tier": "tier_3",
        "discount": 15,
        "label": "Tier 3 - 15% discount"
      }
    ],
    "volumeDiscounts": [
      { "minQty": 10, "maxQty": 49, "discount": 2 },
      { "minQty": 50, "maxQty": 99, "discount": 5 },
      { "minQty": 100, "discount": 8 }
    ],
    "cachedAt": "2025-02-07T10:30:00Z",
    "cacheExpiresIn": 3600
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid productId
- `404 Not Found` - Product not found
- `401 Unauthorized` - Missing or invalid token

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/pricing/123?customerId=456&quantity=50" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Calculate Order Pricing

**Endpoint:** `POST /pricing/calculate`

**Description:** Calculate final price for an order with multiple items, applying tier and volume discounts.

**Authentication:** Required (sales, admin)

**Request Body:**
```json
{
  "customerId": 456,
  "items": [
    {
      "productId": 123,
      "quantity": 25,
      "basePriceOverride": null
    },
    {
      "productId": 124,
      "quantity": 100,
      "basePriceOverride": null
    }
  ],
  "applyCoupon": "SUMMER2025"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orderId": null,
    "customerId": 456,
    "customerTier": "tier_1",
    "items": [
      {
        "productId": 123,
        "sku": "LED-5W-COOL",
        "quantity": 25,
        "basePrice": 50.00,
        "tierDiscount": 5,
        "volumeDiscount": 2,
        "promotionDiscount": 0,
        "finalUnitPrice": 46.55,
        "itemTotal": 1163.75
      },
      {
        "productId": 124,
        "sku": "LED-10W-WARM",
        "quantity": 100,
        "basePrice": 85.00,
        "tierDiscount": 5,
        "volumeDiscount": 8,
        "promotionDiscount": 0,
        "finalUnitPrice": 73.95,
        "itemTotal": 7395.00
      }
    ],
    "subtotal": 8558.75,
    "discountTotal": 486.25,
    "vat": 1626.16,
    "totalPrice": 10184.91,
    "currency": "RON",
    "appliedCoupon": "SUMMER2025",
    "breakdown": {
      "totalTierDiscount": 428.94,
      "totalVolumeDiscount": 171.18,
      "totalPromotionDiscount": 0,
      "totalVATAmount": 1626.16
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid items or customerId
- `404 Not Found` - Product or customer not found
- `401 Unauthorized` - Unauthorized role

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/pricing/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "customerId": 456,
    "items": [{"productId": 123, "quantity": 25}]
  }'
```

---

### 3. Get Tier Pricing

**Endpoint:** `GET /pricing/:productId/tiers`

**Description:** Get detailed pricing for all customer tiers for a specific product.

**Authentication:** Required (all roles)

**Path Parameters:**
```
productId (integer, required): Product ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "sku": "LED-5W-COOL",
    "tiers": [
      {
        "tier": "standard",
        "label": "Standard",
        "discount": 0,
        "minMonthlySpend": null,
        "basePrice": 50.00,
        "priceAfterDiscount": 50.00,
        "savings": 0
      },
      {
        "tier": "tier_1",
        "label": "Tier 1",
        "discount": 5,
        "minMonthlySpend": 5000,
        "basePrice": 50.00,
        "priceAfterDiscount": 47.50,
        "savings": 2.50
      },
      {
        "tier": "tier_2",
        "label": "Tier 2",
        "discount": 10,
        "minMonthlySpend": 15000,
        "basePrice": 50.00,
        "priceAfterDiscount": 45.00,
        "savings": 5.00
      },
      {
        "tier": "tier_3",
        "label": "Tier 3",
        "discount": 15,
        "minMonthlySpend": 30000,
        "basePrice": 50.00,
        "priceAfterDiscount": 42.50,
        "savings": 7.50
      }
    ]
  }
}
```

**Error Responses:**
- `404 Not Found` - Product not found

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/pricing/123/tiers" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Create Promotion

**Endpoint:** `POST /pricing/promotions`

**Description:** Create a new promotional discount (admin only).

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "code": "SUMMER2025",
  "description": "Summer 2025 promotion",
  "discountType": "percentage",
  "discountValue": 10,
  "applicableProducts": [123, 124, 125],
  "startDate": "2025-06-01T00:00:00Z",
  "endDate": "2025-08-31T23:59:59Z",
  "maxUsagePerCustomer": 1,
  "maxTotalUsage": 1000
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "SUMMER2025",
    "discountType": "percentage",
    "discountValue": 10,
    "description": "Summer 2025 promotion",
    "applicableProducts": [123, 124, 125],
    "startDate": "2025-06-01T00:00:00Z",
    "endDate": "2025-08-31T23:59:59Z",
    "maxUsagePerCustomer": 1,
    "maxTotalUsage": 1000,
    "totalUsages": 0,
    "active": true,
    "createdAt": "2025-02-07T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid data
- `401 Unauthorized` - Not admin

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/pricing/promotions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "code": "SUMMER2025",
    "description": "Summer sale",
    "discountType": "percentage",
    "discountValue": 10,
    "startDate": "2025-06-01T00:00:00Z",
    "endDate": "2025-08-31T23:59:59Z"
  }'
```

---

### 5. List Promotions

**Endpoint:** `GET /pricing/promotions`

**Description:** List all active promotions with pagination.

**Authentication:** Required (all roles)

**Query Parameters:**
```
page (integer, default: 1): Page number
pageSize (integer, default: 20, max: 100): Items per page
active (boolean, optional): Filter by active status
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "id": 1,
        "code": "SUMMER2025",
        "description": "Summer sale",
        "discountType": "percentage",
        "discountValue": 10,
        "startDate": "2025-06-01T00:00:00Z",
        "endDate": "2025-08-31T23:59:59Z",
        "active": true,
        "totalUsages": 45
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 6. Deactivate Promotion

**Endpoint:** `DELETE /pricing/promotions/:id`

**Description:** Deactivate a promotion (admin only).

**Authentication:** Required (admin only)

**Path Parameters:**
```
id (integer, required): Promotion ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Promotion deactivated successfully"
}
```

**Error Responses:**
- `404 Not Found` - Promotion not found
- `401 Unauthorized` - Not admin

---

## Inventory Management

### 1. Get Stock Level

**Endpoint:** `GET /inventory/:productId`

**Description:** Get current stock level across all warehouses for a product.

**Authentication:** Required (all roles)

**Path Parameters:**
```
productId (integer, required): Product ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "sku": "LED-5W-COOL",
    "totalStock": 450,
    "totalReserved": 50,
    "availableStock": 400,
    "warehouses": [
      {
        "id": 1,
        "name": "Warehouse A",
        "stock": 250,
        "reserved": 30,
        "available": 220,
        "priority": 1
      },
      {
        "id": 2,
        "name": "Warehouse B",
        "stock": 150,
        "reserved": 15,
        "available": 135,
        "priority": 2
      },
      {
        "id": 3,
        "name": "Warehouse C",
        "stock": 50,
        "reserved": 5,
        "available": 45,
        "priority": 3
      }
    ],
    "threshold": 10,
    "status": "in_stock",
    "lastUpdated": "2025-02-07T10:30:00Z"
  }
}
```

**Error Responses:**
- `404 Not Found` - Product not found

---

### 2. Check Stock Batch

**Endpoint:** `POST /inventory/check`

**Description:** Check stock availability for multiple products at once.

**Authentication:** Required (sales, warehouse, admin)

**Request Body:**
```json
{
  "items": [
    {
      "productId": 123,
      "quantity": 50
    },
    {
      "productId": 124,
      "quantity": 100
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": 123,
        "quantity": 50,
        "availableStock": 400,
        "canFulfill": true,
        "message": "Stock available"
      },
      {
        "productId": 124,
        "quantity": 100,
        "availableStock": 2,
        "canFulfill": false,
        "message": "Insufficient stock (2 available, 100 requested)"
      }
    ],
    "allItemsAvailable": false,
    "canFulfillOrder": false
  }
}
```

---

### 3. Get Movement History

**Endpoint:** `GET /inventory/:productId/movements`

**Description:** Get stock movement history (additions, reservations, shipments) for a product.

**Authentication:** Required (warehouse, admin)

**Path Parameters:**
```
productId (integer, required): Product ID
```

**Query Parameters:**
```
page (integer, default: 1): Page number
pageSize (integer, default: 50, max: 100): Items per page
startDate (string, optional): ISO 8601 date
endDate (string, optional): ISO 8601 date
movementType (string, optional): 'addition', 'reservation', 'shipment', 'return'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "movements": [
      {
        "id": 1001,
        "type": "addition",
        "quantity": 100,
        "warehouseId": 1,
        "reference": "PO-2025-001",
        "timestamp": "2025-02-05T08:00:00Z",
        "notes": "Supplier delivery"
      },
      {
        "id": 1002,
        "type": "reservation",
        "quantity": 50,
        "warehouseId": 1,
        "reference": "ORDER-2025-123",
        "timestamp": "2025-02-06T14:30:00Z",
        "notes": "Order reserved"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 50
  }
}
```

---

### 4. Reserve Stock

**Endpoint:** `POST /inventory/reserve`

**Description:** Reserve stock for an order (prevents overselling).

**Authentication:** Required (sales, warehouse, admin)

**Request Body:**
```json
{
  "orderId": 999,
  "items": [
    {
      "productId": 123,
      "quantity": 25,
      "warehouseId": 1
    },
    {
      "productId": 124,
      "quantity": 50,
      "warehouseId": 1
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "reservationId": "RES-2025-001",
    "orderId": 999,
    "items": [
      {
        "productId": 123,
        "quantity": 25,
        "warehouseId": 1,
        "reserved": true
      },
      {
        "productId": 124,
        "quantity": 50,
        "warehouseId": 1,
        "reserved": true
      }
    ],
    "createdAt": "2025-02-07T10:30:00Z",
    "expiresAt": "2025-02-17T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Insufficient stock
- `409 Conflict` - Stock unavailable

---

### 5. Release Reservation

**Endpoint:** `DELETE /inventory/reservations/:id`

**Description:** Cancel/release a stock reservation.

**Authentication:** Required (warehouse, admin)

**Path Parameters:**
```
id (string, required): Reservation ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Reservation released"
}
```

---

### 6. Adjust Stock

**Endpoint:** `POST /inventory/adjust`

**Description:** Manually adjust stock (admin only). Used for inventory corrections, damages, etc.

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "productId": 123,
  "warehouseId": 1,
  "adjustment": -5,
  "reason": "Damaged units",
  "notes": "Found 5 units with cracked bulbs"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "warehouseId": 1,
    "adjustment": -5,
    "previousStock": 100,
    "newStock": 95,
    "reason": "Damaged units",
    "timestamp": "2025-02-07T10:30:00Z"
  }
}
```

---

### 7. Get Low Stock Alerts

**Endpoint:** `GET /inventory/alerts`

**Description:** Get list of products with low stock (below threshold).

**Authentication:** Required (warehouse, admin)

**Query Parameters:**
```
acknowledged (boolean, optional): Filter by acknowledgment status
threshold (integer, optional): Override alert threshold
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": 1,
        "productId": 123,
        "sku": "LED-5W-COOL",
        "currentStock": 5,
        "threshold": 10,
        "warehouseId": 2,
        "warehouseName": "Warehouse B",
        "acknowledged": false,
        "createdAt": "2025-02-06T08:00:00Z",
        "acknowledgmentStatus": null
      }
    ],
    "total": 1
  }
}
```

---

### 8. Acknowledge Alert

**Endpoint:** `POST /inventory/alerts/:id/acknowledge`

**Description:** Mark a low stock alert as acknowledged.

**Authentication:** Required (warehouse, admin)

**Path Parameters:**
```
id (integer, required): Alert ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Alert acknowledged"
}
```

---

### 9. Get Warehouses

**Endpoint:** `GET /inventory/warehouses`

**Description:** Get list of all warehouses with current capacity.

**Authentication:** Required (all roles)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "warehouses": [
      {
        "id": 1,
        "name": "Warehouse A",
        "location": "Bucharest",
        "capacity": 10000,
        "currentStock": 4523,
        "utilizationPercent": 45.23,
        "priority": 1,
        "status": "operational"
      },
      {
        "id": 2,
        "name": "Warehouse B",
        "location": "Cluj",
        "capacity": 5000,
        "currentStock": 2100,
        "utilizationPercent": 42.00,
        "priority": 2,
        "status": "operational"
      }
    ]
  }
}
```

---

### 10. Sync SmartBill (Manual)

**Endpoint:** `POST /inventory/sync/smartbill`

**Description:** Manually trigger inventory sync with SmartBill (admin only).

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "fullSync": false,
  "warehouseIds": [1, 2]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sync scheduled",
  "jobId": "smartbill-sync-2025-001",
  "estimatedDuration": "2-5 minutes"
}
```

---

### 11. Sync Suppliers (Manual)

**Endpoint:** `POST /inventory/sync/suppliers`

**Description:** Manually trigger supplier sync (admin only).

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "supplierIds": [1, 2, 3],
  "fullSync": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sync scheduled",
  "jobId": "supplier-sync-2025-001",
  "estimatedDuration": "5-10 minutes"
}
```

---

## Orders

### 1. Create Order

**Endpoint:** `POST /orders`

**Description:** Create a new order from scratch or from a quotation.

**Authentication:** Required (sales, admin)

**Request Body:**
```json
{
  "customerId": 456,
  "items": [
    {
      "productId": 123,
      "quantity": 25,
      "unitPrice": 47.50
    }
  ],
  "billingAddress": {
    "street": "123 Main St",
    "city": "Bucharest",
    "postalCode": "010000",
    "country": "RO"
  },
  "shippingAddress": {
    "street": "456 Commerce Blvd",
    "city": "Cluj",
    "postalCode": "400000",
    "country": "RO"
  },
  "notes": "Deliver to warehouse dock",
  "quotationId": null
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 999,
    "orderNumber": "ORD-2025-001",
    "customerId": 456,
    "status": "quote_pending",
    "items": [
      {
        "id": 1,
        "productId": 123,
        "quantity": 25,
        "unitPrice": 47.50,
        "totalPrice": 1187.50
      }
    ],
    "subtotal": 1187.50,
    "vat": 225.63,
    "totalPrice": 1413.13,
    "createdAt": "2025-02-07T10:30:00Z",
    "createdBy": 1
  }
}
```

---

### 2. List Orders

**Endpoint:** `GET /orders`

**Description:** List all orders with filtering and pagination.

**Authentication:** Required (all roles)

**Query Parameters:**
```
customerId (integer, optional): Filter by customer
status (string, optional): Filter by status
page (integer, default: 1): Page number
pageSize (integer, default: 20, max: 100): Items per page
sortBy (string, default: 'createdAt'): Sort field
sortOrder (string, default: 'DESC'): 'ASC' or 'DESC'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 999,
        "orderNumber": "ORD-2025-001",
        "customerId": 456,
        "status": "order_confirmed",
        "itemCount": 2,
        "totalPrice": 1413.13,
        "createdAt": "2025-02-07T10:30:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 3. Get Order by ID

**Endpoint:** `GET /orders/:id`

**Description:** Get detailed order information.

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Order ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 999,
    "orderNumber": "ORD-2025-001",
    "customerId": 456,
    "status": "order_confirmed",
    "items": [
      {
        "id": 1,
        "productId": 123,
        "sku": "LED-5W-COOL",
        "quantity": 25,
        "unitPrice": 47.50,
        "totalPrice": 1187.50
      }
    ],
    "billingAddress": {...},
    "shippingAddress": {...},
    "subtotal": 1187.50,
    "discounts": { "tier": 119.50, "volume": 0, "promotion": 0 },
    "vat": 225.63,
    "totalPrice": 1413.13,
    "smartbillInvoiceId": null,
    "trackingNumber": null,
    "notes": "Deliver to warehouse dock",
    "createdAt": "2025-02-07T10:30:00Z",
    "updatedAt": "2025-02-07T11:15:00Z",
    "createdBy": 1
  }
}
```

---

### 4. Get Order by Number

**Endpoint:** `GET /orders/number/:orderNumber`

**Description:** Get order by order number (e.g., ORD-2025-001).

**Authentication:** Required (all roles)

**Path Parameters:**
```
orderNumber (string, required): Order number
```

**Response (200 OK):** Same as GET /orders/:id

---

### 5. Update Order Status

**Endpoint:** `PATCH /orders/:id/status`

**Description:** Update order status with state machine validation.

**Authentication:** Required (sales, warehouse, finance, admin)

**Path Parameters:**
```
id (integer, required): Order ID
```

**Request Body:**
```json
{
  "status": "in_preparation",
  "notes": "Started picking items from warehouse A"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 999,
    "orderNumber": "ORD-2025-001",
    "previousStatus": "order_confirmed",
    "newStatus": "in_preparation",
    "timestamp": "2025-02-07T11:15:00Z",
    "changedBy": 2
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid status transition
- `404 Not Found` - Order not found

---

### 6. Record Partial Delivery

**Endpoint:** `POST /orders/:id/partial-delivery`

**Description:** Record partial shipment (for orders delivered in multiple shipments).

**Authentication:** Required (warehouse, admin)

**Path Parameters:**
```
id (integer, required): Order ID
```

**Request Body:**
```json
{
  "items": [
    {
      "productId": 123,
      "quantity": 15
    },
    {
      "productId": 124,
      "quantity": 30
    }
  ],
  "trackingNumber": "DPD-2025-001",
  "carrier": "DPD",
  "shipmentDate": "2025-02-07T14:00:00Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "shipmentId": "SHIP-2025-001",
    "orderId": 999,
    "items": [...],
    "trackingNumber": "DPD-2025-001",
    "carrier": "DPD",
    "shipmentDate": "2025-02-07T14:00:00Z",
    "remainingItems": [
      {
        "productId": 123,
        "quantity": 10
      }
    ]
  }
}
```

---

### 7. Cancel Order

**Endpoint:** `POST /orders/:id/cancel`

**Description:** Cancel an order with refund/inventory rollback.

**Authentication:** Required (sales, admin)

**Path Parameters:**
```
id (integer, required): Order ID
```

**Request Body:**
```json
{
  "reason": "Customer requested cancellation",
  "refundType": "full"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 999,
    "orderNumber": "ORD-2025-001",
    "status": "cancelled",
    "refundAmount": 1413.13,
    "inventoryRolledBack": true,
    "timestamp": "2025-02-07T11:30:00Z"
  }
}
```

---

### 8. Generate Proforma

**Endpoint:** `POST /orders/:id/proforma`

**Description:** Generate proforma invoice PDF for order.

**Authentication:** Required (sales, admin)

**Path Parameters:**
```
id (integer, required): Order ID
```

**Response (200 OK):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="proforma-ORD-2025-001.pdf"

[Binary PDF content]
```

---

### 9. Get Status History

**Endpoint:** `GET /orders/:id/status-history`

**Description:** Get complete status change history for an order.

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Order ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orderId": 999,
    "history": [
      {
        "from": null,
        "to": "quote_pending",
        "timestamp": "2025-02-07T10:30:00Z",
        "changedBy": 1,
        "notes": "Order created"
      },
      {
        "from": "quote_pending",
        "to": "order_confirmed",
        "timestamp": "2025-02-07T10:45:00Z",
        "changedBy": 1,
        "notes": "Customer approved"
      },
      {
        "from": "order_confirmed",
        "to": "in_preparation",
        "timestamp": "2025-02-07T11:15:00Z",
        "changedBy": 2,
        "notes": "Started warehouse processing"
      }
    ]
  }
}
```

---

### 10. Get Customer Orders

**Endpoint:** `GET /orders/customer/:customerId`

**Description:** Get all orders for a specific customer.

**Authentication:** Required (all roles)

**Path Parameters:**
```
customerId (integer, required): Customer ID
```

**Query Parameters:**
```
page (integer, default: 1): Page number
pageSize (integer, default: 20): Items per page
status (string, optional): Filter by status
```

**Response (200 OK):** Same format as List Orders

---

## Quotations

### 1. Create Quote

**Endpoint:** `POST /quotations/quotes`

**Description:** Create a new quotation.

**Authentication:** Required (sales, admin)

**Request Body:**
```json
{
  "customerId": 456,
  "items": [
    {
      "productId": 123,
      "quantity": 50,
      "unitPrice": 45.00
    }
  ],
  "validityDays": 15,
  "notes": "Special offer for bulk purchase"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "number": "QT-2025-001",
    "customerId": 456,
    "status": "draft",
    "items": [...],
    "subtotal": 2250.00,
    "vat": 427.50,
    "totalPrice": 2677.50,
    "validFrom": "2025-02-07T00:00:00Z",
    "validUntil": "2025-02-22T23:59:59Z",
    "createdAt": "2025-02-07T10:30:00Z"
  }
}
```

---

### 2. List Quotes

**Endpoint:** `GET /quotations/quotes`

**Description:** List all quotations with filtering.

**Authentication:** Required (all roles)

**Query Parameters:**
```
status (string, optional): Filter by status (draft, sent, accepted, rejected, expired)
customerId (integer, optional): Filter by customer
page (integer, default: 1): Page number
pageSize (integer, default: 20): Items per page
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "id": 100,
        "number": "QT-2025-001",
        "customerId": 456,
        "status": "sent",
        "itemCount": 1,
        "totalPrice": 2677.50,
        "validUntil": "2025-02-22T23:59:59Z",
        "createdAt": "2025-02-07T10:30:00Z"
      }
    ],
    "total": 1,
    "page": 1
  }
}
```

---

### 3. Get Quote

**Endpoint:** `GET /quotations/quotes/:id`

**Description:** Get detailed quotation information.

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Quotation ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "number": "QT-2025-001",
    "customerId": 456,
    "customer": {
      "id": 456,
      "name": "Acme Corp",
      "email": "sales@acme.com"
    },
    "status": "accepted",
    "items": [
      {
        "id": 1,
        "productId": 123,
        "sku": "LED-5W-COOL",
        "quantity": 50,
        "unitPrice": 45.00,
        "totalPrice": 2250.00
      }
    ],
    "subtotal": 2250.00,
    "discounts": { "tier": 112.50, "volume": 45.00, "promotion": 0 },
    "vat": 427.50,
    "totalPrice": 2677.50,
    "validFrom": "2025-02-07T00:00:00Z",
    "validUntil": "2025-02-22T23:59:59Z",
    "expiresIn": "15 days",
    "sentAt": "2025-02-07T11:00:00Z",
    "acceptedAt": "2025-02-08T09:00:00Z",
    "notes": "Special offer for bulk purchase",
    "createdAt": "2025-02-07T10:30:00Z"
  }
}
```

---

### 4. Send Quote

**Endpoint:** `POST /quotations/quotes/:id/send`

**Description:** Send quote to customer via email (creates PDF and sends).

**Authentication:** Required (sales, admin)

**Path Parameters:**
```
id (integer, required): Quotation ID
```

**Request Body:**
```json
{
  "includeMessage": "Thank you for your interest!",
  "recipientEmail": "buyer@acme.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "number": "QT-2025-001",
    "status": "sent",
    "sentAt": "2025-02-07T11:00:00Z",
    "sentTo": "buyer@acme.com",
    "validUntil": "2025-02-22T23:59:59Z"
  }
}
```

---

### 5. Accept Quote

**Endpoint:** `POST /quotations/quotes/:id/accept`

**Description:** Accept a quotation (customer approves).

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Quotation ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "number": "QT-2025-001",
    "status": "accepted",
    "acceptedAt": "2025-02-08T09:00:00Z",
    "acceptedBy": 456,
    "nextStep": "Convert to order"
  }
}
```

---

### 6. Reject Quote

**Endpoint:** `POST /quotations/quotes/:id/reject`

**Description:** Reject a quotation.

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Quotation ID
```

**Request Body:**
```json
{
  "reason": "Price too high",
  "notes": "Please provide revised pricing"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "status": "rejected",
    "rejectedAt": "2025-02-08T10:00:00Z",
    "reason": "Price too high"
  }
}
```

---

### 7. Convert to Order

**Endpoint:** `POST /quotations/quotes/:id/convert`

**Description:** Convert an accepted quotation to an order.

**Authentication:** Required (sales, admin)

**Path Parameters:**
```
id (integer, required): Quotation ID
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "quotationId": 100,
    "orderId": 999,
    "orderNumber": "ORD-2025-001",
    "status": "order_confirmed",
    "message": "Quotation converted to order successfully"
  }
}
```

---

### 8. Generate PDF

**Endpoint:** `GET /quotations/quotes/:id/pdf`

**Description:** Download quotation as PDF.

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Quotation ID
```

**Response (200 OK):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="quotation-QT-2025-001.pdf"

[Binary PDF content]
```

---

## SmartBill Integration

### 1. Create Invoice

**Endpoint:** `POST /smartbill/invoices`

**Description:** Create invoice in SmartBill (Romanian tax system).

**Authentication:** Required (finance, admin)

**Request Body:**
```json
{
  "orderId": 999,
  "invoiceType": "invoice",
  "series": "FL",
  "invoiceNumber": 1,
  "issueDate": "2025-02-07",
  "dueDate": "2025-03-07",
  "company": {
    "name": "Ledux.ro",
    "vatId": "RO12345678"
  },
  "customer": {
    "name": "Acme Corp",
    "vatId": "RO87654321",
    "address": "123 Business St, Bucharest"
  },
  "items": [
    {
      "description": "LED 5W Cool White",
      "quantity": 50,
      "unitPrice": 45.00,
      "vatRate": 0.19
    }
  ],
  "paymentType": "card"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "smartbillId": "FL-1-2025",
    "orderId": 999,
    "invoiceNumber": "FL-1-2025",
    "issueDate": "2025-02-07",
    "dueDate": "2025-03-07",
    "total": 2677.50,
    "vat": 427.50,
    "status": "issued",
    "downloadUrl": "https://ws.smartbill.ro/SMBWS/api/invoice/pdf/FL-1-2025",
    "createdAt": "2025-02-07T11:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid order or data
- `409 Conflict` - Invoice already created for order

---

### 2. Create Proforma

**Endpoint:** `POST /smartbill/proformas`

**Description:** Create proforma invoice in SmartBill.

**Authentication:** Required (sales, admin)

**Request Body:** Similar to Create Invoice

**Response (201 Created):** Similar to Create Invoice (status: "proforma")

---

### 3. Get Invoice

**Endpoint:** `GET /smartbill/invoices/:id`

**Description:** Get invoice details from SmartBill.

**Authentication:** Required (finance, admin)

**Path Parameters:**
```
id (string, required): SmartBill invoice ID (e.g., FL-1-2025)
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "smartbillId": "FL-1-2025",
    "invoiceNumber": "FL-1-2025",
    "issueDate": "2025-02-07",
    "dueDate": "2025-03-07",
    "status": "issued",
    "total": 2677.50,
    "vat": 427.50,
    "items": [
      {
        "description": "LED 5W Cool White",
        "quantity": 50,
        "unitPrice": 45.00,
        "vat": 427.50
      }
    ]
  }
}
```

---

### 4. Get Invoice Status

**Endpoint:** `GET /smartbill/invoices/:invoiceId/status`

**Description:** Get payment status of invoice.

**Authentication:** Required (finance, admin)

**Path Parameters:**
```
invoiceId (string, required): SmartBill invoice ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "invoiceId": "FL-1-2025",
    "status": "paid",
    "paidAmount": 2677.50,
    "remainingAmount": 0,
    "paidDate": "2025-02-10T08:30:00Z",
    "paymentMethod": "bank_transfer"
  }
}
```

---

### 5. Mark Invoice Paid

**Endpoint:** `POST /smartbill/invoices/:invoiceId/paid`

**Description:** Mark invoice as paid manually.

**Authentication:** Required (finance, admin)

**Path Parameters:**
```
invoiceId (string, required): SmartBill invoice ID
```

**Request Body:**
```json
{
  "paidAmount": 2677.50,
  "paymentDate": "2025-02-10",
  "paymentMethod": "bank_transfer",
  "notes": "Payment received from customer"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "invoiceId": "FL-1-2025",
    "status": "paid",
    "paidAmount": 2677.50,
    "paidDate": "2025-02-10T08:30:00Z"
  }
}
```

---

### 6. Sync Stock

**Endpoint:** `POST /smartbill/sync-stock`

**Description:** Sync inventory to SmartBill.

**Authentication:** Required (warehouse, admin)

**Request Body:**
```json
{
  "warehouseIds": [1, 2],
  "fullSync": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Stock sync scheduled",
  "jobId": "smartbill-sync-2025-001"
}
```

---

### 7. Get Warehouses

**Endpoint:** `GET /smartbill/warehouses`

**Description:** Get SmartBill warehouse mappings.

**Authentication:** Required (admin)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "warehouses": [
      {
        "cypherWarehouseId": 1,
        "cypherWarehouseName": "Warehouse A",
        "smartbillStorageId": "A1",
        "smartbillStorageName": "Storage A1",
        "mappedAt": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

## Suppliers

### 1. List Suppliers

**Endpoint:** `GET /suppliers/suppliers`

**Description:** List all suppliers.

**Authentication:** Required (all roles)

**Query Parameters:**
```
page (integer, default: 1): Page number
pageSize (integer, default: 20): Items per page
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "suppliers": [
      {
        "id": 1,
        "name": "LED Wholesale A",
        "website": "https://supplier1.com",
        "lastSyncAt": "2025-02-07T06:00:00Z",
        "productCount": 500,
        "status": "active"
      }
    ],
    "total": 5
  }
}
```

---

### 2. Get Supplier

**Endpoint:** `GET /suppliers/suppliers/:id`

**Description:** Get supplier details.

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Supplier ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "LED Wholesale A",
    "website": "https://supplier1.com",
    "category": "LED Manufacturers",
    "contactEmail": "sales@supplier1.com",
    "status": "active",
    "productCount": 500,
    "lastSyncAt": "2025-02-07T06:00:00Z",
    "nextScheduledSync": "2025-02-07T10:00:00Z",
    "syncInterval": "4 hours"
  }
}
```

---

### 3. Get Supplier Products

**Endpoint:** `GET /suppliers/suppliers/:id/products`

**Description:** Get all products from a supplier.

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Supplier ID
```

**Query Parameters:**
```
page (integer, default: 1): Page number
pageSize (integer, default: 50): Items per page
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "supplierId": 1,
    "products": [
      {
        "id": 1,
        "supplierSku": "SUP-123",
        "name": "LED 5W Cool",
        "price": 20.00,
        "availability": "In Stock",
        "quantity": 1000,
        "lastPrice": 20.50,
        "priceChangePercent": -2.44
      }
    ],
    "total": 500,
    "page": 1
  }
}
```

---

### 4. Trigger Sync

**Endpoint:** `POST /suppliers/suppliers/:id/sync`

**Description:** Manually trigger sync for a specific supplier.

**Authentication:** Required (admin only)

**Path Parameters:**
```
id (integer, required): Supplier ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sync scheduled",
  "jobId": "supplier-sync-2025-001"
}
```

---

### 5. Trigger Sync All

**Endpoint:** `POST /suppliers/suppliers/sync-all`

**Description:** Manually trigger sync for all suppliers.

**Authentication:** Required (admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sync scheduled for 5 suppliers",
  "jobId": "supplier-sync-all-2025-001"
}
```

---

### 6. Get Product Statistics

**Endpoint:** `GET /suppliers/suppliers/:id/statistics`

**Description:** Get supplier product statistics.

**Authentication:** Required (admin)

**Path Parameters:**
```
id (integer, required): Supplier ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "supplierId": 1,
    "totalProducts": 500,
    "priceChangeCount": 23,
    "averagePriceChange": 3.2,
    "inStockProducts": 480,
    "outOfStockProducts": 20,
    "lastSyncAt": "2025-02-07T06:00:00Z"
  }
}
```

---

### 7. List SKU Mappings

**Endpoint:** `GET /suppliers/suppliers/:id/sku-mappings`

**Description:** Get SKU mappings for supplier (Supplier SKU ↔ Internal SKU).

**Authentication:** Required (all roles)

**Path Parameters:**
```
id (integer, required): Supplier ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "mappings": [
      {
        "id": 1,
        "supplierSku": "SUP-123",
        "internalSku": "LED-5W-COOL",
        "internalProductId": 123,
        "mappedAt": "2025-02-01T00:00:00Z"
      }
    ],
    "total": 350
  }
}
```

---

### 8. Create SKU Mapping

**Endpoint:** `POST /suppliers/suppliers/:id/sku-mappings`

**Description:** Create a new SKU mapping.

**Authentication:** Required (admin only)

**Path Parameters:**
```
id (integer, required): Supplier ID
```

**Request Body:**
```json
{
  "supplierSku": "SUP-456",
  "internalProductId": 124
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 351,
    "supplierSku": "SUP-456",
    "internalSku": "LED-10W-WARM",
    "internalProductId": 124,
    "mappedAt": "2025-02-07T11:30:00Z"
  }
}
```

---

### 9. Delete SKU Mapping

**Endpoint:** `DELETE /suppliers/sku-mappings/:mappingId`

**Description:** Remove a SKU mapping.

**Authentication:** Required (admin only)

**Path Parameters:**
```
mappingId (integer, required): Mapping ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "SKU mapping deleted"
}
```

---

### 10. Get Unmapped Products

**Endpoint:** `GET /suppliers/suppliers/:id/unmapped-products`

**Description:** Get supplier products that don't have internal SKU mappings.

**Authentication:** Required (admin only)

**Path Parameters:**
```
id (integer, required): Supplier ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "unmappedProducts": [
      {
        "id": 1,
        "supplierSku": "SUP-789",
        "name": "LED 20W Daylight",
        "price": 40.00,
        "suggestion": "Could map to internal product 125 (LED-20W-DAY)"
      }
    ],
    "total": 150
  }
}
```

---

## WooCommerce Sync

### 1. Sync Single Product

**Endpoint:** `POST /woocommerce/api/v1/woocommerce/sync/product/:productId`

**Description:** Sync a single product to WooCommerce.

**Authentication:** Required (admin only)

**Path Parameters:**
```
productId (integer, required): Internal product ID
```

**Request Body:**
```json
{
  "includeRelated": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "woocommerceId": 5001,
    "name": "LED 5W Cool White",
    "syncedAt": "2025-02-07T11:30:00Z",
    "status": "published",
    "syncedFields": [
      "name",
      "description",
      "price",
      "stock_quantity",
      "categories",
      "attributes"
    ]
  }
}
```

---

### 2. Sync All Products

**Endpoint:** `POST /woocommerce/api/v1/woocommerce/sync/all`

**Description:** Full product sync to WooCommerce (daily at 03:00 UTC).

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "skipFailed": true,
  "includeImages": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Full sync scheduled",
  "jobId": "woocommerce-full-sync-2025-001",
  "estimatedDuration": "10-30 minutes",
  "productCount": 1250
}
```

---

### 3. Sync Stock

**Endpoint:** `POST /woocommerce/api/v1/woocommerce/sync/stock/:productId`

**Description:** Sync only stock levels to WooCommerce.

**Authentication:** Required (admin only)

**Path Parameters:**
```
productId (integer, required): Internal product ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "woocommerceId": 5001,
    "newStock": 450,
    "syncedAt": "2025-02-07T11:30:00Z"
  }
}
```

---

### 4. Sync Price

**Endpoint:** `POST /woocommerce/api/v1/woocommerce/sync/price/:productId`

**Description:** Sync only pricing to WooCommerce.

**Authentication:** Required (admin only)

**Path Parameters:**
```
productId (integer, required): Internal product ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": 123,
    "woocommerceId": 5001,
    "newPrice": 50.00,
    "regularPrice": 50.00,
    "salePrice": null,
    "syncedAt": "2025-02-07T11:30:00Z"
  }
}
```

---

### 5. Sync Categories

**Endpoint:** `POST /woocommerce/api/v1/woocommerce/sync/categories`

**Description:** Sync product categories to WooCommerce.

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "categoryIds": null
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Category sync scheduled",
  "jobId": "woocommerce-cat-sync-2025-001",
  "categoriesCount": 45
}
```

---

### 6. Pull Orders

**Endpoint:** `POST /woocommerce/api/v1/woocommerce/pull/orders`

**Description:** Pull new orders from WooCommerce into CYPHER.

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "startDate": "2025-02-06T00:00:00Z",
  "endDate": "2025-02-07T23:59:59Z",
  "status": "completed"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order pull scheduled",
  "jobId": "woocommerce-pull-orders-2025-001",
  "estimatedOrders": 42
}
```

---

### 7. Get Sync Status

**Endpoint:** `GET /woocommerce/api/v1/woocommerce/sync/status`

**Description:** Get current sync status and statistics.

**Authentication:** Required (admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "lastFullSync": {
      "startedAt": "2025-02-07T03:00:00Z",
      "completedAt": "2025-02-07T03:22:00Z",
      "productsSynced": 1250,
      "productsFailed": 3,
      "status": "completed"
    },
    "lastStockSync": {
      "startedAt": "2025-02-07T11:00:00Z",
      "completedAt": "2025-02-07T11:15:00Z",
      "productsSynced": 1250,
      "status": "completed"
    },
    "syncHealth": {
      "totalProducts": 1250,
      "syncedProducts": 1247,
      "failedProducts": 3,
      "syncRate": 99.76
    },
    "nextScheduledSync": "2025-02-08T03:00:00Z"
  }
}
```

---

### 8. Get Failed Items

**Endpoint:** `GET /woocommerce/api/v1/woocommerce/sync/failed`

**Description:** Get products that failed to sync.

**Authentication:** Required (admin only)

**Query Parameters:**
```
page (integer, default: 1): Page number
pageSize (integer, default: 20): Items per page
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "failedItems": [
      {
        "productId": 999,
        "sku": "LED-ERROR",
        "name": "Faulty LED Product",
        "errorMessage": "Missing required field: price",
        "lastAttempt": "2025-02-07T03:15:00Z",
        "retryCount": 2
      }
    ],
    "total": 3
  }
}
```

---

### 9. Retry Failed Sync

**Endpoint:** `POST /woocommerce/api/v1/woocommerce/sync/retry`

**Description:** Retry syncing failed products.

**Authentication:** Required (admin only)

**Request Body:**
```json
{
  "productIds": [999]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Retry scheduled",
  "jobId": "woocommerce-retry-2025-001",
  "productCount": 1
}
```

---

### 10. Get Product Mapping

**Endpoint:** `GET /woocommerce/api/v1/woocommerce/mappings/:productId`

**Description:** Get WooCommerce mapping for a product.

**Authentication:** Required (admin only)

**Path Parameters:**
```
productId (integer, required): Internal product ID
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "internalProductId": 123,
    "woocommerceProductId": 5001,
    "internalSku": "LED-5W-COOL",
    "woocommerceSku": "LED-5W-COOL",
    "status": "synced",
    "lastSyncAt": "2025-02-07T11:30:00Z",
    "nextSyncAt": "2025-02-08T03:00:00Z"
  }
}
```

---

## System Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** System health check (no authentication required).

**Authentication:** Not required

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2025-02-07T11:30:00Z",
  "environment": "production"
}
```

---

### 2. Get Metrics

**Endpoint:** `GET /metrics`

**Description:** Prometheus metrics for monitoring.

**Authentication:** Not required (optional, can restrict in production)

**Response (200 OK):**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/v1/pricing",status="200"} 1234

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",path="/api/v1/pricing"} 850
...
```

---

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error type/message",
  "details": {
    "field": "Specific error details"
  },
  "requestId": "req-12345-67890",
  "timestamp": "2025-02-07T11:30:00Z"
}
```

### Standard HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing or invalid JWT |
| 403 | Forbidden | Insufficient role/permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | State conflict (e.g., invalid transition) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error, check logs |

### Common Errors

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "customerId": "Customer ID must be a positive integer",
    "items.0.quantity": "Quantity must be greater than 0"
  }
}
```

#### 401 Unauthorized - Missing Token

```json
{
  "success": false,
  "error": "Unauthorized",
  "details": {
    "message": "Missing Authorization header"
  }
}
```

#### 403 Forbidden - Insufficient Permissions

```json
{
  "success": false,
  "error": "Forbidden",
  "details": {
    "message": "This operation requires 'admin' role. Your role: 'user'"
  }
}
```

#### 409 Conflict - Invalid Transition

```json
{
  "success": false,
  "error": "Conflict",
  "details": {
    "message": "Cannot transition from 'delivered' to 'in_preparation'. Valid transitions: ['invoiced', 'returned']"
  }
}
```

---

## Rate Limiting

### Rate Limits

- **General API:** 1000 requests per hour per IP
- **Authentication:** 100 requests per hour per IP
- **Window Size:** 1 hour (sliding window)

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1707386400
```

### Example: Rate Limit Exceeded

```
HTTP/1.1 429 Too Many Requests

{
  "success": false,
  "error": "Rate limit exceeded",
  "details": {
    "limit": 1000,
    "remaining": 0,
    "resetAt": "2025-02-07T12:00:00Z"
  }
}
```

---

## Pagination

### Cursor Pagination (Recommended)

Large result sets use cursor-based pagination for performance:

```
GET /api/v1/orders?cursor=eyJpZCI6IDk5OSwgImNyZWF0ZWRBdCI6ICIyMDI1LTAyLTA3In0=&pageSize=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "pageSize": 20,
      "hasMore": true,
      "nextCursor": "eyJpZCI6IDk3OSwgImNyZWF0ZWRBdCI6ICIyMDI1LTAyLTA2In0="
    }
  }
}
```

### Offset Pagination (Legacy)

Some endpoints use traditional offset/limit:

```
GET /api/v1/suppliers?page=2&pageSize=20
```

---

**Document Version:** 0.1.0
**Last Updated:** February 2025
**Questions?** Contact development@ledux.ro

