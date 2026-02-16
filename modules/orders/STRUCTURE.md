# Orders Module - Complete Structure

## Project Organization

The Orders module for CYPHER ERP is organized in clean architecture with clear separation between Domain and Application layers.

### Directory Tree

```
/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/orders/
│
├── src/
│   ├── domain/                          # Domain Layer - Business Logic
│   │   ├── entities/
│   │   │   ├── Order.ts                 # Aggregate Root - Main order entity
│   │   │   ├── OrderItem.ts             # Line item with delivery tracking
│   │   │   ├── OrderStatus.ts           # Status enumeration
│   │   │   ├── OrderStatusMachine.ts    # State machine for transitions
│   │   │   ├── Address.ts               # Value Object for addresses
│   │   │   ├── StatusChange.ts          # Value Object for history
│   │   │   └── index.ts                 # Domain entities exports
│   │   │
│   │   ├── services/
│   │   │   ├── OrderCalculationService.ts  # Pure calculation logic
│   │   │   └── index.ts                    # Domain services exports
│   │   │
│   │   ├── repositories/
│   │   │   ├── IOrderRepository.ts      # Persistence abstraction
│   │   │   └── index.ts                 # Repository exports
│   │   │
│   │   └── index.ts                     # Domain layer exports
│   │
│   ├── application/                      # Application Layer - Use Cases
│   │   ├── use-cases/
│   │   │   ├── CreateOrder.ts            # Create new order with validation
│   │   │   ├── UpdateOrderStatus.ts      # Status updates with side effects
│   │   │   ├── GetOrder.ts               # Retrieve single order
│   │   │   ├── ListOrders.ts             # List with filtering/pagination
│   │   │   ├── RecordPartialDelivery.ts  # Track partial deliveries
│   │   │   ├── CancelOrder.ts            # Cancel with stock release
│   │   │   ├── GenerateProforma.ts       # Proforma invoice generation
│   │   │   └── index.ts                  # Use cases exports
│   │   │
│   │   ├── dtos/
│   │   │   ├── order.dtos.ts             # All DTOs for API communication
│   │   │   └── index.ts                  # DTOs exports
│   │   │
│   │   ├── errors/
│   │   │   ├── order.errors.ts           # Custom error classes
│   │   │   └── index.ts                  # Errors exports
│   │   │
│   │   └── index.ts                      # Application layer exports
│   │
│   ├── api/                              # API Layer (Controller/Routes)
│   │   ├── controllers/
│   │   │   └── OrderController.ts        # HTTP request handlers
│   │   ├── routes/
│   │   │   └── order.routes.ts           # Route definitions
│   │   └── validators/
│   │       └── order.validators.ts       # Request validation
│   │
│   ├── infrastructure/                   # Infrastructure Layer
│   │   ├── entities/
│   │   │   ├── OrderEntity.ts            # TypeORM entity
│   │   │   ├── OrderItemEntity.ts        # Item entity
│   │   │   └── OrderStatusHistoryEntity.ts # History entity
│   │   │
│   │   ├── mappers/
│   │   │   └── OrderMapper.ts            # Domain ↔ Database mapping
│   │   │
│   │   ├── repositories/
│   │   │   └── TypeOrmOrderRepository.ts # Repository implementation
│   │   │
│   │   └── cache/
│   │       └── OrderCache.ts             # Caching layer
│   │
│   └── index.ts                          # Module root exports
│
├── README.md                             # Module documentation
└── STRUCTURE.md                          # This file
```

## Domain Layer Architecture

### Entities

**Order** - Aggregate Root
- Manages complete order lifecycle
- Validates state transitions via OrderStatusMachine
- Tracks partial deliveries with automatic totaling
- Records status history with timestamps and notes
- Auto-generates order numbers (ORD-YYYYMMDD-XXXX)

**OrderItem** - Entity
- Represents line items in orders
- Tracks quantity (ordered, delivered, remaining)
- Supports partial delivery recording
- Auto-calculates line totals

**OrderStatus** - Value Object
- Enum of 14 order statuses
- Includes PHOTO_ADDED sub-status
- Type-safe status references

**OrderStatusMachine** - Value Object
- Static state machine implementation
- Validates allowed transitions
- Identifies terminal states
- Enforces note requirements
- Returns detailed validation errors

**Address** - Value Object
- Immutable address representation
- Used for billing and shipping
- Validates required fields
- Default country: Romania

**StatusChange** - Value Object
- Tracks status transitions
- Stores who changed status, when, and why
- Immutable audit trail

### Services

**OrderCalculationService** - Domain Service
- Pure, stateless calculation logic
- No side effects
- Methods:
  - `calculateOrderTotals()` - Subtotal, discount, tax, total
  - `calculateLineTotal()` - Individual line item calculation
  - `calculateTaxAmount()` - Tax calculation with rate
  - `calculateDiscountPercentage()` - Discount analysis
  - `calculateDeliverySummary()` - Delivery statistics
- 19% VAT hardcoded for Romania
- Proper rounding to 2 decimal places (currency)

### Repositories

**IOrderRepository** - Interface
- Abstraction for data persistence
- Methods:
  - CRUD: `create()`, `getById()`, `update()`, `delete()`
  - Queries: `getByOrderNumber()`, `getByStatus()`, `getByCustomer()`
  - Utilities: `getNextOrderNumber()`, `exists()`
  - History: `addStatusHistory()`, `getStatusHistory()`
  - List: `list()` with complex filtering

## Application Layer Architecture

### Use Cases

All use cases follow the same pattern:
1. Validate input
2. Fetch required data
3. Perform business logic
4. Publish domain events
5. Return result

**CreateOrder**
- Creates orders with full validation
- Checks stock availability
- Fetches product details
- Calculates totals
- Generates order number
- Reserves stock
- Events: `order.created`

**UpdateOrderStatus**
- Validates status transitions
- Handles status-specific side effects
- Shipment → auto-generates invoice
- Cancellation → releases stock
- Events: `order.status_changed`, `order.shipped`, `order.delivered`, etc.

**GetOrder**
- Retrieves by ID or order number
- Returns complete order details

**ListOrders**
- Filters by customer, status, date, search
- Supports pagination (1-100 limit)
- Supports sorting by multiple fields
- Returns summary data for performance

**RecordPartialDelivery**
- Records item deliveries
- Auto-transitions to DELIVERED if fully delivered
- Tracks remaining quantities
- Events: `order.fully_delivered`, `order.partially_delivered`

**CancelOrder**
- Validates order can be cancelled
- Releases stock reservations
- Requires cancellation reason
- Events: `order.cancelled`

**GenerateProforma**
- Creates proforma via SmartBill
- Validates order status
- Stores proforma number
- Events: `order.proforma_generated`

### DTOs

Input DTOs:
- `CreateOrderInput` - New order data
- `UpdateOrderStatusInput` - Status change details
- `RecordPartialDeliveryInput` - Delivery data
- `CancelOrderInput` - Cancellation details
- `GenerateProformaInput` - Proforma request
- `ListOrdersInput` - Filter/pagination params

Output DTOs:
- `OrderResult` - Complete order details
- `OrderSummaryResult` - Lightweight summary
- `PartialDeliveryResult` - Delivery status
- `ProformaResult` - Proforma details
- `PaginatedResult<T>` - Generic pagination wrapper

Address DTOs:
- `CreateAddressInput` - Input validation
- `AddressResult` - Output format

### Error Classes

All custom errors extend Error and have name property:

- `OrderNotFoundError` - Order ID or number not found
- `InvalidStatusTransitionError` - Disallowed state transition
- `InsufficientStockError` - Not enough inventory
- `OrderCancellationError` - Cancellation failed
- `InvalidDeliveryQuantityError` - Invalid delivery amount
- `OrderAlreadyExistsError` - Duplicate order number
- `InvalidOrderInputError` - Input validation failure
- `ProformaGenerationError` - SmartBill error
- `InvoiceGenerationError` - Invoice generation error
- `StockReservationError` - Stock reservation error

## Key Features

### Order Status Machine (14 Statuses)

```
Quote Flow:
  QUOTE_PENDING → QUOTE_SENT → QUOTE_ACCEPTED → ORDER_CONFIRMED

Order Flow:
  ORDER_CONFIRMED → [SUPPLIER_ORDER_PLACED | IN_PREPARATION]
  SUPPLIER_ORDER_PLACED → WAITING_DELIVERY → IN_PREPARATION
  IN_PREPARATION → READY_TO_SHIP → SHIPPED

Fulfillment:
  SHIPPED → DELIVERED → INVOICED → PAID (Terminal)

Cancellation:
  CANCELLED (Terminal, available from any non-terminal state)
```

### Partial Delivery Support

- Each OrderItem tracks quantity (ordered vs delivered vs remaining)
- `recordPartialDelivery()` updates individual item quantities
- `isFullyDelivered()` checks if all items delivered
- `isPartiallyDelivered()` checks if some items delivered
- Auto-transitions to DELIVERED status when fully delivered
- Returns delivery summary with percentages

### Financial Calculations

- Subtotal = Sum of (quantity × unitPrice)
- Taxable Amount = Subtotal - Discount
- Tax Amount = Taxable Amount × 0.19 (19% VAT)
- Grand Total = Subtotal - Discount + Shipping + Tax
- All amounts rounded to 2 decimal places

### Payment Terms

B2B payment options tracked per order:
- `net_30` - Payment due in 30 days
- `net_60` - Payment due in 60 days
- `net_90` - Payment due in 90 days
- `prepay` - Payment before shipment
- `cash` - Cash on delivery

Payment status tracking:
- `pending` - No payment received
- `partial` - Partial payment received
- `paid` - Full payment received

### Proforma & Invoice Management

- Proforma generated via SmartBill API integration
- Proforma number stored in order
- Auto-generated invoice on shipment
- Invoice number stored in order
- Support for SmartBill integration hooks

## Service Dependencies

### IOrderRepository
Database persistence abstraction for all CRUD and query operations

### IStockService
- `checkAvailability(productId, quantity)` - Verify stock exists
- `reserveStock(orderId, items)` - Reserve for order
- `releaseReservation(orderId)` - Release on cancellation

### IProductService
- `getProduct(id)` - Single product
- `getProducts(ids)` - Multiple products

### IInvoiceService
- `createInvoice(orderId, date)` - Generate invoice
- `createProforma(orderId)` - Generate proforma

### IProformaService
- `generateProforma(...)` - SmartBill proforma creation

### IEventPublisher
- `publish(event)` - Publish domain events

## Domain Events

| Event | Trigger | Data |
|-------|---------|------|
| `order.created` | CreateOrder | Order details, items, total |
| `order.status_changed` | UpdateOrderStatus | Status change details |
| `order.shipped` | Status → SHIPPED | Invoice number, total |
| `order.delivered` | Status → DELIVERED | Order and customer info |
| `order.cancelled` | Status → CANCELLED | Reason and who cancelled |
| `order.fully_delivered` | All items delivered | Order info |
| `order.partially_delivered` | Some items delivered | Delivered items list |
| `order.proforma_generated` | GenerateProforma | Proforma details |

## Design Patterns

1. **Clean Architecture** - Separate domain, application, api, infrastructure
2. **Aggregate Pattern** - Order is aggregate root
3. **Value Objects** - Address, StatusChange are immutable
4. **State Machine** - Strict transition validation
5. **Use Case Pattern** - Each operation is dedicated class
6. **Repository Pattern** - Data access abstraction
7. **Dependency Injection** - Constructor-based
8. **Domain Events** - Event-driven integration
9. **Service Layer** - Pure business logic
10. **DTO Pattern** - Input/output separation

## Validation

- **Entity Level** - Order and Address validate themselves
- **Use Case Level** - All inputs validated before processing
- **State Machine Level** - Status transitions validated
- **Service Level** - Calculation service validates ranges

## Error Handling

- Custom exceptions for specific errors
- Validation errors in use cases
- State machine validation with detailed messages
- Try-catch around external service calls (stock, invoice)
- Graceful degradation (e.g., invoice generation failure)

## Type Safety

- Full TypeScript throughout
- Strict interfaces for all services
- Enum for status (type-safe)
- Type-safe payment terms enum
- Generics for pagination

## Testing Considerations

Each layer can be tested independently:
- **Domain Tests** - Entity behavior, state machine
- **Service Tests** - Calculations with various inputs
- **Use Case Tests** - Mock repositories and services
- **Integration Tests** - Full workflows with real services

## Performance Considerations

- OrderCalculationService is pure and cacheable
- Summary queries return reduced data
- Pagination limits queries to max 100
- Status machine uses Map for O(1) lookups
- Event publishing is async

## Future Enhancements

- Credit limit enforcement per customer
- Multi-currency support beyond RON
- Advanced delivery scheduling
- Order versioning and rollback
- Customer-specific pricing rules
- Return/RMA management
- Order templates for repeat customers
- Batch operations for bulk actions
- Workflow customization per business rules

