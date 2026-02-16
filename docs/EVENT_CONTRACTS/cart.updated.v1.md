# Event Contract: cart.updated

**Version:** 1.0  
**Status:** Active  
**Producer:** B2B Cart Service  
**Consumers:** Pricing Engine, Analytics, Notifications

---

## Event Envelope

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | UUID | Yes | Unique event identifier |
| `event_type` | String | Yes | Value: `cart.updated` |
| `version` | String | Yes | Value: `1.0` |
| `occurred_at` | ISO8601 DateTime | Yes | Timestamp when event occurred |
| `producer` | String | Yes | Service name: `b2b-cart-service` |
| `correlation_id` | UUID | Yes | Links to originating request |
| `tenant_id` | String | No | Multi-tenant identifier |
| `payload` | Object | Yes | Event-specific data |

---

## Payload Schema

```json
{
  "customer_id": 1001,
  "cart_id": "cart_1234567890",
  "action": "item_added|item_updated|item_removed|cart_cleared",
  "item": {
    "item_id": "item_001",
    "product_id": 5501,
    "sku": "LED-PANEL-60W-120x30",
    "name": "Panel LED 60W 120x30cm 6500K",
    "quantity": 50,
    "previous_quantity": null,
    "unit_price": 45.50,
    "previous_unit_price": null,
    "total": 2047.50
  },
  "cart_summary": {
    "items_count": 12,
    "subtotal": 5460.00,
    "tier_discount": 546.00,
    "volume_discount": 273.00,
    "tax_amount": 1037.40,
    "total": 4638.00,
    "currency": "RON"
  },
  "tier": "GOLD"
}
```

---

## Field Definitions

### customer_id
- **Type:** Integer
- **Description:** B2B customer ID

### cart_id
- **Type:** String
- **Description:** Unique cart identifier

### action
- **Type:** Enum
- **Values:** 
  - `item_added` - New item added to cart
  - `item_updated` - Item quantity or price changed
  - `item_removed` - Item removed from cart
  - `cart_cleared` - All items removed

### item (Object)
| Field | Type | Description |
|-------|------|-------------|
| `item_id` | String | Unique cart item ID |
| `product_id` | Integer | Product catalog ID |
| `sku` | String | Product SKU |
| `name` | String | Product name |
| `quantity` | Integer | Current quantity |
| `previous_quantity` | Integer | Previous quantity (for updates) |
| `unit_price` | Float | Unit price after discounts |
| `previous_unit_price` | Float | Previous unit price |
| `total` | Float | Line total (quantity × unit_price) |

### cart_summary (Object)
| Field | Type | Description |
|-------|------|-------------|
| `items_count` | Integer | Total unique items in cart |
| `subtotal` | Float | Sum before any discounts |
| `tier_discount` | Float | Discount from customer tier |
| `volume_discount` | Float | Discount from volume pricing |
| `tax_amount` | Float | VAT amount (19%) |
| `total` | Float | Final total including tax |
| `currency` | String | Currency code |

---

## Example Events

### Item Added
```json
{
  "event_id": "evt_550e8400-e29b-41d4-a716-446655440000",
  "event_type": "cart.updated",
  "version": "1.0",
  "occurred_at": "2026-02-13T14:30:00.000Z",
  "producer": "b2b-cart-service",
  "correlation_id": "corr_1234567890",
  "tenant_id": "tenant_001",
  "payload": {
    "customer_id": 1001,
    "cart_id": "cart_1234567890",
    "action": "item_added",
    "item": {
      "item_id": "item_001",
      "product_id": 5501,
      "sku": "LED-PANEL-60W-120x30",
      "name": "Panel LED 60W 120x30cm 6500K",
      "quantity": 50,
      "previous_quantity": null,
      "unit_price": 45.50,
      "previous_unit_price": null,
      "total": 2047.50
    },
    "cart_summary": {
      "items_count": 1,
      "subtotal": 2047.50,
      "tier_discount": 204.75,
      "volume_discount": 102.38,
      "tax_amount": 388.63,
      "total": 1741.25,
      "currency": "RON"
    },
    "tier": "GOLD"
  }
}
```

### Item Updated
```json
{
  "event_id": "evt_550e8400-e29b-41d4-a716-446655440001",
  "event_type": "cart.updated",
  "version": "1.0",
  "occurred_at": "2026-02-13T14:35:00.000Z",
  "producer": "b2b-cart-service",
  "correlation_id": "corr_1234567891",
  "payload": {
    "customer_id": 1001,
    "cart_id": "cart_1234567890",
    "action": "item_updated",
    "item": {
      "item_id": "item_001",
      "product_id": 5501,
      "sku": "LED-PANEL-60W-120x30",
      "name": "Panel LED 60W 120x30cm 6500K",
      "quantity": 100,
      "previous_quantity": 50,
      "unit_price": 40.95,
      "previous_unit_price": 45.50,
      "total": 4095.00
    },
    "cart_summary": {
      "items_count": 1,
      "subtotal": 4095.00,
      "tier_discount": 409.50,
      "volume_discount": 409.50,
      "tax_amount": 778.05,
      "total": 3685.05,
      "currency": "RON"
    },
    "tier": "GOLD"
  }
}
```

---

## Consumer Responsibilities

### Pricing Engine
- Update cached prices when `unit_price` changes
- Recalculate volume discounts when `quantity` changes

### Analytics
- Track cart events for funnel analysis
- Calculate conversion rates

### Notifications
- Send cart reminder after 24h inactivity (optional)

---

## Version History

| Version | Changes | Date |
|---------|---------|------|
| 1.0 | Initial version | 2026-02-13 |

---

## Backward Compatibility

This event is considered stable. Consumers should:
1. Ignore unknown fields in payload
2. Handle missing optional fields with defaults
3. Monitor for deprecation warnings in `producer` field
