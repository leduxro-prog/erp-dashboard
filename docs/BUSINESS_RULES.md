# Business Rules Documentation

**Version:** 0.1.0
**Target Audience:** Business analysts, sales team, product managers, developers
**Last Updated:** February 2025
**Source:** Ledux.ro business requirements & questionnaire

## Table of Contents

1. [Pricing Rules](#pricing-rules)
2. [Customer Tiers](#customer-tiers)
3. [Order Lifecycle](#order-lifecycle)
4. [Quotation Rules](#quotation-rules)
5. [Inventory Rules](#inventory-rules)
6. [SmartBill Integration](#smartbill-integration)
7. [Supplier Sourcing](#supplier-sourcing)
8. [WooCommerce Synchronization](#woocommerce-synchronization)

---

## Pricing Rules

### Price Calculation Formula

The final price for a product is calculated using this formula:

```
FinalPrice = Cost × (1 + Margin%) × (1 - TierDiscount%) × (1 - VolumeDiscount%)
```

**Example:**
```
Cost: 20 RON
Margin: 150% (standard margin)
Tier Discount: 10% (Tier 2 customer)
Volume Discount: 5% (50 units ordered)

Step 1: 20 × (1 + 1.50) = 20 × 2.50 = 50 RON (after margin)
Step 2: 50 × (1 - 0.10) = 50 × 0.90 = 45 RON (after tier discount)
Step 3: 45 × (1 - 0.05) = 45 × 0.95 = 42.75 RON (after volume discount)
Final: 42.75 RON (before VAT)
With VAT: 42.75 × 1.19 = 50.87 RON
```

### Margin Requirements

**Minimum Margin:** 30%
- All products must have at least 30% profit margin
- System enforces this validation when setting prices
- Violation blocks product pricing operations

**Standard Margin:** 60%
- Default margin for most LED products

**Premium Margin:** 100%
- Used for specialty or hard-to-source items
- Requires approval

### VAT Rules

**Romania VAT Rate:** 19%
- Applied to all orders
- Calculated: `Total × 1.19`
- Removed for EU exports (reverse charge)
- Stored in SmartBill for tax compliance

**Example:**
```
Subtotal (before VAT): 100 RON
VAT (19%): 19 RON
Total (with VAT): 119 RON
```

### Promotional Discounts

**Promotion Rules:**
- Type: Percentage or fixed amount
- Scope: All products, specific categories, or individual SKUs
- Valid period: Start date to end date
- Max usage per customer: Configurable (default: unlimited)
- Max total usage: Configurable (default: unlimited)
- Applies AFTER tier and volume discounts

**Example:**
```
Regular price: 50 RON
Tier discount (10%): -5 RON → 45 RON
Volume discount (5%): -2.25 RON → 42.75 RON
Promotion "SUMMER2025" (10%): -4.28 RON → 38.47 RON
```

---

## Customer Tiers

### Tier Structure

CYPHER supports 4 customer pricing tiers based on monthly spending:

| Tier | Discount | Min Monthly Spend | Description |
|------|----------|-------------------|-------------|
| **Standard** | 0% | None | New customers, no special pricing |
| **Tier 1** | 5% | 5,000 RON | Regular business customers |
| **Tier 2** | 10% | 15,000 RON | Medium-volume customers |
| **Tier 3** | 15% | 30,000 RON | Large wholesale customers |

### Tier Qualification

**Automatic Tier Assignment:**
1. System calculates customer's total spending in last 30 days
2. Customer is assigned the HIGHEST tier they qualify for
3. Tier automatically downgraded if spending drops below threshold
4. Changes applied immediately on next order

**Example:**
```
Customer A spending last 30 days: 18,000 RON
- Qualifies for Tier 1? (> 5,000) ✅ Yes
- Qualifies for Tier 2? (> 15,000) ✅ Yes
- Qualifies for Tier 3? (> 30,000) ❌ No

→ Assigned: Tier 2 (10% discount)
```

### Manual Tier Override

Sales team can manually set tier for specific customers:
- Promotional tier adjustment (e.g., "new customer tier 2 for first 3 months")
- Loyalty tier (recognizing long-term customers)
- Strategic account management

**Override Rules:**
- Can only upgrade to next tier (not bypass multiple tiers)
- Duration can be set (e.g., "until 2025-12-31")
- Overrides must be logged for audit trail

---

## Order Lifecycle

### 14 Order Statuses

CYPHER tracks orders through 14 distinct statuses:

```
QUOTE_PENDING
    ↓
QUOTE_SENT
    ↓
QUOTE_ACCEPTED
    ↓
ORDER_CONFIRMED
    ├→ SUPPLIER_ORDER_PLACED (optional path)
    │   ↓
    │   AWAITING_DELIVERY
    │
    └→ IN_PREPARATION (direct path)
        ↓
    READY_TO_SHIP
        ↓
    SHIPPED
        ↓
    DELIVERED
        ├→ RETURNED
        │
        └→ INVOICED
            ↓
        PAID

Terminal States: CANCELLED, RETURNED, PAID
```

### Valid State Transitions

| From Status | To Status | Notes |
|-------------|-----------|-------|
| QUOTE_PENDING | QUOTE_SENT | Sales sends quote |
| QUOTE_PENDING | CANCELLED | Quote rejected |
| QUOTE_SENT | QUOTE_ACCEPTED | Customer approves |
| QUOTE_SENT | CANCELLED | Quote rejected |
| QUOTE_ACCEPTED | ORDER_CONFIRMED | Sales confirms |
| QUOTE_ACCEPTED | CANCELLED | Customer cancels |
| ORDER_CONFIRMED | SUPPLIER_ORDER_PLACED | If sourcing from suppliers |
| ORDER_CONFIRMED | IN_PREPARATION | If stock available |
| ORDER_CONFIRMED | CANCELLED | Before preparation |
| SUPPLIER_ORDER_PLACED | AWAITING_DELIVERY | Waiting for supplier |
| AWAITING_DELIVERY | IN_PREPARATION | Supplier delivered |
| IN_PREPARATION | READY_TO_SHIP | Picking/packing complete |
| READY_TO_SHIP | SHIPPED | Handed to carrier |
| SHIPPED | DELIVERED | Customer received |
| DELIVERED | INVOICED | Invoice created |
| DELIVERED | RETURNED | Return initiated |
| INVOICED | PAID | Payment received |
| PAID | RETURNED | Post-payment return |

### Side Effects per Status Change

When order status changes, automatic actions trigger:

| Status Change | Side Effects |
|---------------|--------------|
| → ORDER_CONFIRMED | Reserve inventory; notify customer confirmation sent |
| → IN_PREPARATION | Start warehouse packing; notify customer shipment in progress |
| → SHIPPED | Create tracking entry; notify customer with tracking number |
| → DELIVERED | Release inventory reservation; prompt for payment if unpaid |
| → INVOICED | Create SmartBill invoice; send invoice PDF to customer |
| → PAID | Update financial records; send thank you email; fulfill loyalty points |
| → CANCELLED | Rollback inventory reservation; refund (if paid); notify customer |
| → RETURNED | Process return; refund; update inventory |

### Order Modification Rules

**Can Modify Before:**
- QUOTE_SENT (draft quotes)
- QUOTE_ACCEPTED (approved quotes)
- ORDER_CONFIRMED (confirmed but not started)

**Cannot Modify After:**
- IN_PREPARATION (already picking)
- READY_TO_SHIP (already packed)
- SHIPPED (already in transit)

**Example:**
```
Order ORD-2025-001:
Status: ORDER_CONFIRMED
- Can change items: ✅ Yes (before warehousing)
- Can change customer: ❌ No (already confirmed)
- Can change delivery address: ✅ Yes
- Can cancel: ✅ Yes

Once status → IN_PREPARATION:
- Can change items: ❌ No
- Can cancel: Partial only (for not-yet-picked items)
```

---

## Quotation Rules

### Quote Generation

**Validity:** 15 calendar days
- Quote created: Today
- Quote expires: Today + 15 days at 23:59:59 UTC
- After expiry: Quote automatically changes to EXPIRED status

**Quote Statuses:**
1. DRAFT - Not yet sent
2. SENT - Sent to customer (timestamp recorded)
3. ACCEPTED - Customer approved
4. REJECTED - Customer declined (reason recorded)
5. EXPIRED - 15 days passed without action

### Reminders

System sends automated emails:

| Day | Subject | Content |
|-----|---------|---------|
| Day 0 | Quote for {customer.name} | Quote created, waiting for action |
| Day 7 | Reminder: {quote.number} expires in 8 days | Gentle reminder |
| Day 14 | Final reminder: {quote.number} expires tomorrow | Final chance |
| Day 15 | Quote {quote.number} has expired | Auto-expired notification |

### Auto-Expiry

**Automatic Behavior:**
- At 23:59:59 on day 15, status automatically changes to EXPIRED
- No customer action needed
- System sends expiry notification email
- Old quote can be re-sent if customer requests (creates new expiry date)

**Example:**
```
Quote QT-2025-001 created: 2025-02-07
Valid from: 2025-02-07 00:00:00
Valid until: 2025-02-22 23:59:59

Reminders sent:
- Day 7 (2025-02-14): Reminder email
- Day 14 (2025-02-21): Final reminder email

Auto-expiry:
- 2025-02-22 23:59:59 → Status changes to EXPIRED
- Expiry notification sent to customer
```

### Quote to Order Conversion

**Rules:**
- Only ACCEPTED quotes can be converted to orders
- Conversion creates new order with same items and prices
- Quote remains as reference/history (not deleted)
- Order gets its own order number (ORD-YYYY-001, not QT number)

**Example:**
```
Quote QT-2025-001 (ACCEPTED)
  ↓ Convert to Order
Order ORD-2025-001 (ORDER_CONFIRMED)
  ├ References quotation: QT-2025-001
  ├ Same items and prices
  └ New timeline starts
```

---

## Inventory Rules

### Warehouse Structure

3 warehouses with priority-based allocation:

| Warehouse | Priority | Location | Purpose |
|-----------|----------|----------|---------|
| Warehouse A | 1 (Primary) | Bucharest | Main fulfillment |
| Warehouse B | 2 (Secondary) | Cluj | Regional distribution |
| Warehouse C | 3 (Tertiary) | Constanta | Overflow/seasonal |

### Stock Allocation Algorithm

When fulfilling an order, system allocates from highest-priority available warehouse:

```
Algorithm:
  remaining_qty = order_qty

  for warehouse in [A, B, C]:
    available = warehouse.stock[product] - warehouse.reserved[product]
    allocate = min(remaining_qty, available)

    if allocate > 0:
      warehouse.reserved[product] += allocate
      remaining_qty -= allocate

    if remaining_qty == 0:
      break

  if remaining_qty > 0:
    // Insufficient stock
    return ERROR "Insufficient inventory"
```

**Example:**
```
Product LED-5W-COOL order: 100 units

Warehouse A: 60 in stock, 20 reserved → 40 available
  Allocate: min(100, 40) = 40
  Remaining: 60

Warehouse B: 30 in stock, 5 reserved → 25 available
  Allocate: min(60, 25) = 25
  Remaining: 35

Warehouse C: 20 in stock, 0 reserved → 20 available
  Allocate: min(35, 20) = 20
  Remaining: 15

Result: Only 85 units allocated, 15 units short
→ ERROR: Insufficient inventory (need 100, have 85)
```

### Low Stock Alerts

**Threshold:** 3 units per product per warehouse
- Alert triggered when stock < 3
- Sales team notified
- Sales team acknowledges alert

**Example:**
```
Warehouse A LED-5W-COOL: 2 units
→ Alert: "Low stock alert: LED-5W-COOL (2/3 threshold)"
→ Notify sales team
→ Require acknowledgment
```

### Backorder Policy

**Default Backorder Duration:** 10 days
- If stock unavailable, order put on backorder
- Customer notified of expected delivery (now + 10 days)
- System attempts to fulfill from supplier within 10 days
- If not fulfilled after 10 days: escalation/customer outreach

**Example:**
```
Order placed: 2025-02-07
Status: AWAITING_DELIVERY (backorder)
Backorder expiry: 2025-02-17
Expected delivery: 2025-02-17

Day 15 (after expiry):
- If still not fulfilled: Alert fulfillment team
- Reach out to customer
- Offer: full refund, different product, or extended timeline
```

### Stock Movements Tracking

Every stock change is logged with:
- Product ID
- Warehouse ID
- Movement type: addition, reservation, shipment, return, adjustment, damage
- Quantity
- Reference: Order#, PO#, Supplier, or notes
- Timestamp
- User who made change

---

## SmartBill Integration

### Automatic Invoice Creation

**When:** When order status changes to INVOICED (after delivery)

**Requirements:**
- Order must be DELIVERED status
- All items must be fulfilled
- Customer must have valid address
- Payment status recorded (PAID or INVOICE PENDING)

**Automatic Fields:**
```
Company: Ledux.ro SRL
  VAT ID: RO[configured]
  Address: [configured]

Customer: [from order]
  VAT ID: [if provided]
  Address: [from billing address]

Items: [from order items]
  Description: Product name
  Quantity: Order quantity
  Unit Price: Final price (with tier/volume discounts applied)
  VAT Rate: 19%

Invoice Number: [SmartBill assigns next in series]
Invoice Series: FL (Factura Lunara / Monthly Invoice)
Issue Date: Today
Due Date: Today + 30 days (payment terms)
```

### SmartBill Sync Schedule

**Frequency:** Every 15 minutes automatically
- 00:15, 00:30, 00:45, etc. UTC
- Checks for orders ready to invoice
- Creates invoices in SmartBill
- Updates order with SmartBill reference ID

**Manual Sync:** Available endpoint `POST /smartbill/sync` for immediate sync

### Invoice Tracking

**SmartBill Invoice Number:** Stored in order
```
Example: Order ORD-2025-001
  SmartBill Invoice ID: FL-1-2025
  Created: 2025-02-07
  Status: ISSUED
  Download URL: https://smartbill.ro/invoice/FL-1-2025
```

### VAT Compliance

- 19% VAT applied to all orders
- Stored in SmartBill monthly tax report
- EU exports: VAT reverse charge (0%)
- Validated against customer VAT ID

---

## Supplier Sourcing

### Supplier Network

**Active Suppliers:** 5 (configurable)
- Supplier 1-5: LED manufacturers/distributors
- Each has product catalog with SKU, price, availability

### Price Scraping Schedule

**Frequency:** Every 4 hours
**Active Window:** 06:00 - 22:00 UTC (9 AM - 1 AM CEST)
- Outside window: Skipped
- On weekends: Same schedule applies
- Never runs: During maintenance windows

**Example Schedule:**
```
Daily:
- 06:00 UTC: Scrape all 5 suppliers
- 10:00 UTC: Scrape all 5 suppliers
- 14:00 UTC: Scrape all 5 suppliers
- 18:00 UTC: Scrape all 5 suppliers
- 22:00 UTC: Last scrape of day
- 02:00 UTC: Skipped (outside window)
```

### Price Change Detection

**Alert Trigger:** Price change > 10%

**Example:**
```
Product LED-5W from Supplier A:
- Previous price: 15 RON
- Current price: 16.80 RON
- Change: +1.80 RON = +12%

→ Alert created: "Price +12% on LED-5W from Supplier A"
→ Sales team notified
→ Can adjust CYPHER pricing if needed
```

### SKU Mapping

**Purpose:** Link supplier SKU to internal product SKU

**Example:**
```
Supplier A SKU: "SUP-LED-5W-COOL"
CYPHER SKU: "LED-5W-COOL"
CYPHER Product ID: 123

When supplier price changes:
  Supplier A: "SUP-LED-5W-COOL" → 15 RON
  Mapped to: Product 123 (LED-5W-COOL)
  Update cost: 15 RON
```

### Supplier Order Placement

**When:** Order status requires external sourcing
- If item not in CYPHER inventory
- Backorder mode activated
- System creates supplier order PO

**Tracking:**
- Supplier order number
- Expected delivery date
- Actual delivery date
- Cost from supplier

---

## WooCommerce Synchronization

### Sync Direction

**One-way:** CYPHER → WooCommerce only
- Products, pricing, stock: CYPHER is source of truth
- Changes in WooCommerce are NOT synced back
- Customers place orders on WooCommerce

### Sync Schedule

**Full Sync:** Daily at 03:00 UTC
- All products
- All pricing
- All inventory levels
- All categories

**Incremental Sync:** Real-time on changes
- Price updated in CYPHER → sync immediately
- Inventory updated → sync within 1 minute
- New product created → sync immediately

### Product Attributes Synced

| Attribute | Synced | Notes |
|-----------|--------|-------|
| SKU | ✅ Yes | Internal SKU → WC SKU |
| Name | ✅ Yes | Product name |
| Description | ✅ Yes | Long description |
| Price | ✅ Yes | Final price (after discounts) |
| Stock Quantity | ✅ Yes | Available inventory |
| Images | ✅ Yes | Product images |
| Categories | ✅ Yes | Product categories |
| Attributes (color, watts) | ✅ Yes | Variant attributes |
| Status | ✅ Yes | Published if active, Draft if inactive |

### Stock Sync Specifics

**Visible on WooCommerce:**
```
WC Stock = CYPHER Available Stock
= CYPHER Total - Reserved - Damaged

Example:
  CYPHER Warehouse A: 100 units
  Reserved for orders: 30 units
  Damaged/unusable: 5 units

  WooCommerce displays: 100 - 30 - 5 = 65 units in stock
```

**Stock-out Behavior:**
- Stock = 0 → WooCommerce shows "Out of Stock"
- Out of stock products NOT removed (stay listed, just unavailable)
- Backorder can be enabled per product

### Pricing on WooCommerce

**Pricing Rules:**
- Regular price: Final CYPHER price (already includes margin, VAT)
- Sale price: NOT USED (no dynamic pricing per customer on WC)
- Wholesale pricing: NOT SUPPORTED on WC (only customer tier pricing in CYPHER)

**Example:**
```
CYPHER Product (to customer):
  Base cost: 20 RON
  Margin: 150% → 50 RON
  Tier discount: 10% → 45 RON
  Final price shown to customer in CYPHER: 45 RON

WooCommerce Product (to website visitors):
  Regular price: 50 RON (before tier discount)
  Actual checkout: Goes through CYPHER API, applies discounts
```

### Order Pulling (From WC to CYPHER)

**Manual Trigger:** `POST /woocommerce/pull/orders`

**What Pulls:**
- Customer name, email, phone
- Billing address
- Shipping address
- Products purchased
- Order total
- Payment status
- Order date

**Creates in CYPHER:**
- New customer (if not exists)
- New order (ORD-2025-XXX number assigned)
- Order items
- Marked as "sync'd from WooCommerce"

**Manual Processing Only:**
- Not automatic (requires admin trigger)
- Allows batching and review before creation
- Log entry for each pull

---

## Exception Handling

### When Rules Conflict

**Example: Insufficient Inventory**

```
Scenario:
  Order placed: 100 units LED-5W-COOL
  Available: 85 units

Decision:
  ❌ Do NOT auto-backorder
  ✅ Return error to customer: "Insufficient inventory"
  ✅ Offer alternatives:
     - Order available 85 units (partial)
     - Wait for restock (10-day backorder)
     - Choose different product
```

**Example: Order Modification After Shipment**

```
Scenario:
  Order ORD-2025-001 in SHIPPED status
  Customer requests to add items

Decision:
  ❌ Cannot modify shipped order
  ✅ Create NEW order ORD-2025-002 for additional items
  ✅ Link both orders in customer history
```

### Escalation Procedures

| Situation | Action | Owner |
|-----------|--------|-------|
| Stock unavailable after 10-day backorder | Reach out to customer; offer refund/alternative | Sales |
| Price discrepancy (system vs customer claim) | Verify quote date; honor quoted price if valid | Finance |
| SmartBill sync failed | Retry after 30 min; alert if still failing | Tech support |
| Supplier price spike > 20% | Review market; decide to adjust CYPHER price or skip supplier | Procurement |
| Order stuck in AWAITING_DELIVERY > 14 days | Contact supplier; escalate to manager | Warehouse |

---

**Document Version:** 0.1.0
**Last Updated:** February 2025
**Maintained By:** Business Analysis Team
**Review Cycle:** Quarterly or as business rules change

