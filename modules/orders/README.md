# CYPHER ERP - Orders Module

The Orders module is the core business logic for managing the complete order lifecycle in CYPHER ERP, featuring a sophisticated 14-status state machine, partial delivery support, invoicing, and proforma generation.

## Module Architecture

### Clean Architecture Layers

```
Orders Module
├── Domain Layer (Business Logic)
│   ├── Entities
│   │   ├── Order (Aggregate Root)
│   │   ├── OrderItem
│   │   ├── Address (Value Object)
│   │   ├── StatusChange (Value Object)
│   │   └── OrderStatusMachine (State Machine)
│   ├── Services
│   │   └── OrderCalculationService
│   └── Repositories
│       └── IOrderRepository (Interface)
│
└── Application Layer (Use Cases)
    ├── Use Cases
    │   ├── CreateOrder
    │   ├── UpdateOrderStatus
    │   ├── GetOrder
    │   ├── ListOrders
    │   ├── RecordPartialDelivery
    │   ├── CancelOrder
    │   └── GenerateProforma
    ├── DTOs
    └── Errors
```

## Order Status Machine

The order follows a 14-status workflow with strict state transitions:

```
QUOTE_PENDING → QUOTE_SENT → QUOTE_ACCEPTED → ORDER_CONFIRMED ──┐
                                                                   │
                                          ┌──────────────────────┘
                                          │
                                 SUPPLIER_ORDER_PLACED
                                          │
                                 WAITING_DELIVERY
                                          │
                              IN_PREPARATION (from ORDER_CONFIRMED)
                                          │
                                 READY_TO_SHIP
                                          │
                                    SHIPPED
                                          │
                                  DELIVERED
                                          │
                                   INVOICED
                                          │
                                    PAID (Terminal)

CANCELLED (Terminal - available from any non-terminal state)
```

### Status Descriptions

| Status | Description | Flow |
|--------|-------------|------|
| `quote_pending` | Initial state for quote requests | Quote workflow starts |
| `quote_sent` | Quote sent to customer | Awaiting customer decision |
| `quote_accepted` | Customer accepted quote | Confirm to convert to order |
| `order_confirmed` | Order officially confirmed | Ready for procurement/preparation |
| `supplier_order_placed` | Order sent to supplier | B2B orders waiting for delivery |
| `waiting_delivery` | Awaiting supplier delivery | In transit from supplier |
| `in_preparation` | Items being prepared/picked | Warehouse operations |
| `ready_to_ship` | Items ready to leave warehouse | Awaiting shipment |
| `shipped` | Order shipped to customer | Auto-generates invoice |
| `delivered` | Customer received order | Ready for invoicing |
| `invoiced` | Invoice generated | Awaiting payment |
| `paid` | Payment received (Terminal) | Complete |
| `cancelled` | Order cancelled (Terminal) | Releases stock reservations |
| `photo_added` | Sub-status for documentation | Supporting status |

## Core Entities

### Order (Aggregate Root)

The central entity managing complete order lifecycle with:
- Auto-generated order numbers (format: ORD-YYYYMMDD-XXXX)
- Full financial tracking (subtotal, discount, tax, shipping, total)
- 19% VAT calculation for Romania
- Payment terms and status tracking
- Proforma and invoice number storage
- Complete status history with timestamps and notes
- Partial delivery tracking

### OrderItem

Line items with:
- Product reference (ID, SKU, name)
- Quantity tracking (ordered vs delivered vs remaining)
- Unit pricing
- Auto-calculated line totals
- Optional warehouse source reference

### Address (Value Object)

Immutable address representation for billing and shipping with validation.

### OrderStatusMachine

Static state machine with:
- Valid transition mapping
- Terminal state detection
- Note requirement logic
- Transition validation with detailed errors

## Use Cases

### CreateOrder
- Validates customer and items
- Checks stock availability
- Fetches product details
- Calculates totals with VAT
- Generates order number
- Reserves stock
- Publishes creation event

### UpdateOrderStatus
- Validates state transitions
- Auto-generates invoices on shipment (SmartBill)
- Releases stock on cancellation
- Publishes status change events

### GetOrder
- Retrieves by ID or order number
- Returns complete order details

### ListOrders
- Filtered by customer, status, date range, search term
- Paginated and sortable
- Returns summary data

### RecordPartialDelivery
- Records item deliveries
- Auto-transitions to DELIVERED if fully delivered
- Tracks remaining quantities
- Publishes delivery events

### CancelOrder
- Validates cancellation is allowed
- Releases stock reservations
- Requires cancellation reason
- Publishes cancellation event

### GenerateProforma
- Creates proforma via SmartBill integration
- Validates order status
- Stores proforma number
- Publishes proforma event

## Service Integration Points

### IOrderRepository
Persistence abstraction for CRUD and queries

### IStockService
Stock availability checking and reservation management

### IProductService
Product information retrieval

### IInvoiceService
Invoice and proforma generation (SmartBill)

### IEventPublisher
Domain event publishing for integration

## Financial Features

- **Subtotal calculation** from line items
- **Discount support** with taxable amount adjustment
- **19% VAT** (Romania standard)
- **Shipping costs** included in total
- **Payment terms** - net_30, net_60, net_90, prepay, cash
- **Payment tracking** - pending, partial, paid

## File Structure

```
orders/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Order.ts
│   │   │   ├── OrderItem.ts
│   │   │   ├── OrderStatus.ts
│   │   │   ├── OrderStatusMachine.ts
│   │   │   ├── Address.ts
│   │   │   ├── StatusChange.ts
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── OrderCalculationService.ts
│   │   │   └── index.ts
│   │   ├── repositories/
│   │   │   ├── IOrderRepository.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── CreateOrder.ts
│   │   │   ├── UpdateOrderStatus.ts
│   │   │   ├── GetOrder.ts
│   │   │   ├── ListOrders.ts
│   │   │   ├── RecordPartialDelivery.ts
│   │   │   ├── CancelOrder.ts
│   │   │   ├── GenerateProforma.ts
│   │   │   └── index.ts
│   │   ├── dtos/
│   │   │   ├── order.dtos.ts
│   │   │   └── index.ts
│   │   ├── errors/
│   │   │   ├── order.errors.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   └── index.ts
└── README.md
```

## Error Classes

- **OrderNotFoundError** - Order doesn't exist
- **InvalidStatusTransitionError** - Invalid state transition attempt
- **InsufficientStockError** - Not enough inventory
- **OrderCancellationError** - Cancellation failed
- **InvalidDeliveryQuantityError** - Invalid delivery amount
- **OrderAlreadyExistsError** - Duplicate order number
- **InvalidOrderInputError** - Invalid input validation
- **ProformaGenerationError** - SmartBill integration error
- **InvoiceGenerationError** - Invoice generation error
- **StockReservationError** - Stock reservation failed

## Design Patterns

1. **Aggregate Pattern** - Order as aggregate root
2. **Value Objects** - Address, StatusChange immutable objects
3. **State Machine** - OrderStatusMachine for transitions
4. **Use Case Pattern** - Dedicated classes per operation
5. **Repository Pattern** - IOrderRepository abstraction
6. **Dependency Injection** - Constructor-based injection
7. **Domain Events** - Event-driven integration
8. **Service Layer** - OrderCalculationService

## Dependencies

- **uuid** - For OrderItem ID generation
- **typescript** - Type safety

