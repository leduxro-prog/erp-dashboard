# B2B Portal Module

**Version:** 1.0.0
**Status:** Enterprise Production Ready

## Overview

The B2B Portal Module provides comprehensive B2B customer self-service capabilities within CYPHER ERP, handling registration, approval workflows, saved carts, bulk ordering, and credit-based payment management for 500+ business clients.

## Features

### Core Capabilities

1. **B2B Registration & Approval Workflow**
   - Multi-step registration process (PENDING → UNDER_REVIEW → APPROVED/REJECTED/SUSPENDED)
   - Romanian CUI (Cod Unic de Înregistrare) validation with Luhn check digit
   - IBAN format validation and optional ANAF (Romanian tax authority) verification
   - Document management for registration supporting materials
   - Configurable rejection reasons and suspension capability

2. **Tier-Based Pricing & Discounts**
   - Four pricing tiers: STANDARD, SILVER, GOLD, PLATINUM
   - Automatic tier calculation based on lifetime spending:
     - STANDARD: < 5,000 RON
     - SILVER: 5,000 - 20,000 RON (5% discount)
     - GOLD: 20,000 - 50,000 RON (10% discount)
     - PLATINUM: > 50,000 RON (15% discount)
   - Dynamic tier upgrade based on spending thresholds
   - Tier-specific payment terms (0, 15, 30, 45 days)

3. **Credit Limit Management**
   - Flexible credit limit assignment per customer
   - Real-time credit utilization tracking
   - Automatic credit reservation on order placement
   - Credit release on order cancellation
   - Manual credit adjustments with audit trail
   - Warning alerts when approaching credit limits
   - Complete transaction history with immutable CreditTransaction value objects

4. **Saved Carts**
   - Multiple named carts per customer
   - Default cart designation for quick access
   - Cart duplication for "clone previous order"
   - Automatic expiration detection (30 days)
   - Item-level notes and pricing caching
   - Conversion to orders with credit validation

5. **Bulk Order Processing**
   - CSV upload support with intelligent parsing
   - Manual bulk order entry
   - Comprehensive validation:
     - SKU existence verification
     - Stock availability checking
     - Quantity validation
     - Price checking
   - Detailed validation error reporting with row numbers
   - Progress tracking (DRAFT → VALIDATING → VALIDATED → PROCESSING → COMPLETED)
   - Partial completion handling for mixed-success scenarios

6. **Payment Management**
   - Configurable payment terms (0, 15, 30, 45, 60 days)
   - Payment due date calculation
   - Invoice/proforma integration
   - Payment status tracking

## Architecture

### Layers

```
┌─────────────────────────────────────────────┐
│          API Layer (REST Endpoints)         │
├─────────────────────────────────────────────┤
│      Application Layer (Use Cases)          │
│  • RegisterB2B                              │
│  • ReviewRegistration                       │
│  • ConvertCartToOrder                       │
│  • ProcessBulkOrder                         │
│  • ManageCredit                             │
├─────────────────────────────────────────────┤
│         Domain Layer (Business Logic)       │
│  Entities:                                  │
│  • B2BRegistration                          │
│  • B2BCustomer                              │
│  • SavedCart                                │
│  • BulkOrder                                │
│  • CreditTransaction                        │
│                                             │
│  Services:                                  │
│  • CuiValidationService                     │
│  • CreditService                            │
│  • TierCalculationService                   │
│                                             │
│  Repositories (Ports):                      │
│  • IRegistrationRepository                  │
│  • IB2BCustomerRepository                   │
│  • ISavedCartRepository                     │
│  • IBulkOrderRepository                     │
│  • ICreditTransactionRepository             │
├─────────────────────────────────────────────┤
│    Infrastructure Layer (Persistence)      │
│  • TypeORM Entities                         │
│  • Repository Implementations               │
│  • Database Mappers                         │
│  • Background Jobs                          │
└─────────────────────────────────────────────┘
```

### Design Patterns

- **Hexagonal Architecture**: Domain logic isolated from external dependencies
- **Value Objects**: `CreditTransaction` is immutable for audit trail integrity
- **Domain Entities**: Rich domain objects with business logic encapsulation
- **Repository Pattern**: Abstraction layer for data access
- **Use Case Pattern**: Single Responsibility principle at application layer
- **Event-Driven**: Integration via published/subscribed events
- **Composition Root**: Dependency injection configuration
- **Feature Flags**: Gradual rollout capability

## Domain Model

### Entities

#### B2BRegistration
```typescript
- id: string
- companyName: string
- cui: string                    // Romanian CUI
- regCom: string                 // Trade registry number
- legalAddress: string
- deliveryAddress: string
- contactPerson: string
- email: string
- phone: string
- bankName: string
- iban: string
- requestedTier: string
- status: B2BRegistrationStatus
- documents: RegistrationDocument[]
- creditLimit?: number
- paymentTermsDays: number
- reviewedBy?: string
- reviewedAt?: Date
- rejectionReason?: string
- createdAt: Date
- updatedAt: Date

Methods:
- approve(reviewerId, tier, creditLimit, paymentTerms)
- reject(reviewerId, reason)
- suspend(reason)
- reactivate()
- markAsUnderReview()
- isActive(): boolean
```

#### B2BCustomer
```typescript
- id: string
- registrationId: string
- companyName: string
- cui: string
- tier: B2BCustomerTier
- creditLimit: number
- usedCredit: number
- availableCredit: number (computed)
- paymentTermsDays: number
- isActive: boolean
- lastOrderAt?: Date
- totalOrders: number
- totalSpent: number
- salesRepId?: string
- createdAt: Date
- updatedAt: Date

Methods:
- hasAvailableCredit(amount): boolean
- useCredit(amount)
- releaseCredit(amount)
- recordOrder(orderAmount)
- upgradeTier(newTier)
- calculateDiscount(): number
- getPaymentDueDate(orderDate): Date
- canPlaceOrder(amount): boolean
```

#### SavedCart
```typescript
- id: string
- customerId: string
- name: string
- items: CartItemData[]
- isDefault: boolean
- notes?: string
- totalItems: number (computed)
- subtotal: number (computed)
- createdAt: Date
- lastModifiedAt: Date

Methods:
- addItem(productId, name, sku, qty, price, notes?)
- removeItem(productId)
- updateItemQuantity(productId, qty)
- clear()
- rename(newName)
- setAsDefault(isDefault)
- convertToOrder(): OrderItem[]
- duplicate(newId, newName): SavedCart
- isEmpty(): boolean
- isExpired(maxAgeDays): boolean
```

#### BulkOrder
```typescript
- id: string
- customerId: string
- name: string
- sourceType: BulkOrderSourceType
- items: BulkOrderItem[]
- status: BulkOrderStatus
- validationErrors: BulkValidationError[]
- totalItems: number (computed)
- totalAmount: number (computed)
- processedAt?: Date
- createdAt: Date
- updatedAt: Date

Methods:
- addItem(sku, quantity, price)
- startValidation()
- completeValidation()
- startProcessing()
- completeProcessing()
- markAsPartiallyCompleted()
- getInvalidItems(): BulkOrderItem[]
- getProgress()
```

#### CreditTransaction (Value Object)
```typescript
- id: string
- customerId: string
- type: CreditTransactionType (USE | RELEASE | ADJUSTMENT)
- amount: number
- orderId?: string
- description: string
- balanceBefore: number
- balanceAfter: number
- createdBy: string
- createdAt: Date

Methods:
- static createUsage(...)
- static createRelease(...)
- static createAdjustment(...)
- isCredit(): boolean
- isDebit(): boolean
- getNetChange(): number
```

### Domain Services

#### CuiValidationService
- **Purpose**: Validate Romanian CUI format and optionally verify with ANAF
- **Methods**:
  - `validate(cui): Promise<boolean>`
  - `validateFormat(cui): boolean`
  - `normalize(cui): string | undefined`
  - `getCheckDigit(cui): number | undefined`
  - `calculateCheckDigit(cuiWithoutCheckDigit): number | undefined`

#### CreditService
- **Purpose**: Manage credit limits, usage, and transaction recording
- **Methods**:
  - `validateSufficientCredit(customer, amount)`
  - `useCredit(customer, amount, orderId, userId): CreditTransaction`
  - `releaseCredit(customer, amount, orderId, userId): CreditTransaction`
  - `adjustCredit(customer, amount, reason, userId): CreditTransaction`
  - `getAvailableCreditPercentage(customer): number`
  - `isApproachingLimit(customer, threshold): boolean`

#### TierCalculationService
- **Purpose**: Calculate customer tiers based on spending and other factors
- **Methods**:
  - `calculateTierBySpending(totalSpent): B2BCustomerTier`
  - `calculateTierAdvanced(spent, orderCount, avgValue): B2BCustomerTier`
  - `getMinimumSpendingForTier(tier): number`
  - `getSpendingToNextTier(currentTier, spent): number`
  - `getDiscountForTier(tier): number`
  - `getPaymentTermsForTier(tier): number`
  - `checkForTierUpgrade(currentTier, spent): B2BCustomerTier`

## Use Cases

### 1. RegisterB2B
**Purpose**: Submit a new B2B registration
**Input**: Registration form data
**Process**:
1. Validate CUI uniqueness
2. Validate CUI and IBAN format
3. Create PENDING registration entity
4. Publish `b2b.registration_submitted` event
5. Notify admin

**Output**: Registration ID and status

### 2. ReviewRegistration
**Purpose**: Approve or reject a registration (admin)
**Input**: Registration ID, action (APPROVE/REJECT), tier, credit limit, payment terms
**Process**:
1. Validate registration exists and is in correct state
2. If APPROVE:
   - Update registration status to APPROVED
   - Create B2BCustomer entity
   - Save customer with tier, credit limit, payment terms
   - Publish `b2b.registration_approved` event
3. If REJECT:
   - Update registration status to REJECTED
   - Record rejection reason
   - Publish `b2b.registration_rejected` event
4. Notify customer

**Output**: Updated registration and optional customer ID

### 3. ConvertCartToOrder
**Purpose**: Convert saved cart to actual order
**Input**: Cart ID, customer ID
**Process**:
1. Load cart and validate ownership
2. Validate cart is not empty
3. Load customer
4. Validate customer has sufficient credit
5. Create order via IOrderPort
6. Use credit and create CreditTransaction
7. Record order in customer (update stats)
8. Clear cart items
9. Publish `b2b.order_from_cart` event

**Output**: Order ID and credit used

### 4. ProcessBulkOrder
**Purpose**: Process bulk order with validation
**Input**: Bulk order with items
**Process**:
1. Start validation (DRAFT → VALIDATING)
2. For each item:
   - Verify SKU exists (IInventoryPort)
   - Check stock availability
   - Validate quantity
   - Record any errors
3. Complete validation (VALIDATING → VALIDATED or FAILED)
4. If no errors, start processing
5. Create individual orders via IOrderPort
6. Use credit for each order
7. Track completion status
8. Publish `b2b.bulk_order` event

**Output**: Bulk order status with success/failure counts

### 5. ManageSavedCart
**Purpose**: CRUD operations on saved carts
**Input**: Cart ID, customer ID, operations
**Process**:
1. Create: New SavedCart entity, set as default if specified
2. Update: Modify cart name, items, notes
3. Delete: Remove cart from repository
4. Duplicate: Create copy with new name

**Output**: Updated cart state

### 6. GetCreditHistory
**Purpose**: Retrieve customer credit transaction history
**Input**: Customer ID, pagination
**Process**:
1. Load customer
2. Query ICreditTransactionRepository
3. Return paginated transactions sorted by date (newest first)

**Output**: Paginated transaction list with balance tracking

### 7. AdjustCredit
**Purpose**: Manually adjust customer credit (admin)
**Input**: Customer ID, amount (+ or -), reason
**Process**:
1. Load customer
2. Calculate new credit limit
3. Create CreditTransaction.createAdjustment()
4. Update customer credit limit
5. Save transaction in repository
6. Publish `b2b.credit_adjusted` event

**Output**: Updated customer with transaction record

### 8. RecalculateTiers
**Purpose**: Background job to recalculate all tiers based on spending
**Trigger**: Weekly (Sunday 02:00)
**Process**:
1. Query customers due for recalculation
2. For each customer:
   - Calculate recommended tier from TierCalculationService
   - If higher than current, upgrade
   - Update payment terms accordingly
3. Log results

**Output**: Updated tier records

## API Endpoints

### Authentication
All endpoints require:
- `Authorization: Bearer <token>` header
- Roles: `admin`, `b2b_user`, or `sales`

### Registration Endpoints

**POST /api/v1/b2b/register**
Public registration submission
```json
{
  "companyName": "Acme Corp",
  "cui": "14399700",
  "regCom": "J40/123/2024",
  "legalAddress": "Str. Example 123, Bucharest",
  "deliveryAddress": "Str. Delivery 456, Bucharest",
  "contactPerson": "John Doe",
  "email": "john@acme.com",
  "phone": "0123456789",
  "bankName": "Bank ABC",
  "iban": "RO89ABCD0000000512345678",
  "requestedTier": "SILVER",
  "paymentTermsDays": 30
}
```

**GET /api/v1/b2b/registrations** (admin only)
List all registrations with filters
```
?status=PENDING&page=1&limit=20&search=acme
```

**GET /api/v1/b2b/registrations/:id** (admin only)
Get registration detail

**POST /api/v1/b2b/registrations/:id/review** (admin only)
Approve or reject registration
```json
{
  "action": "APPROVE",
  "tier": "SILVER",
  "creditLimit": 50000,
  "paymentTermsDays": 30
}
```

### Customer Endpoints

**GET /api/v1/b2b/customers** (admin only)
List B2B customers
```
?tier=SILVER&isActive=true&page=1&limit=20
```

**GET /api/v1/b2b/customers/:id** (admin or self)
Get customer profile with credit info

**PUT /api/v1/b2b/customers/:id** (admin only)
Update customer tier, credit, payment terms

**POST /api/v1/b2b/customers/:id/credit/adjust** (admin only)
Adjust credit limit
```json
{
  "amount": 5000,
  "reason": "Loyalty adjustment for VIP customer"
}
```

**GET /api/v1/b2b/customers/:id/credit/history** (admin or self)
Get credit transaction history
```
?type=USE&page=1&limit=50
```

**GET /api/v1/b2b/dashboard** (b2b_user)
Customer dashboard: recent orders, credit info, tier progress, saved carts

### Cart Endpoints

**GET /api/v1/b2b/carts** (b2b_user)
List my saved carts
```
?page=1&limit=10
```

**POST /api/v1/b2b/carts** (b2b_user)
Create new saved cart
```json
{
  "name": "Q4 2024 Project",
  "isDefault": false,
  "notes": "Materials for Q4 expansion"
}
```

**PUT /api/v1/b2b/carts/:id** (b2b_user)
Update cart (name, items, default status)

**DELETE /api/v1/b2b/carts/:id** (b2b_user)
Delete saved cart

**POST /api/v1/b2b/carts/:id/convert** (b2b_user)
Convert cart to order
```json
{
  "notes": "Rush delivery requested"
}
```

### Bulk Order Endpoints

**POST /api/v1/b2b/bulk-order** (b2b_user)
Submit bulk order (CSV or manual)
```
Content-Type: multipart/form-data
- file: CSV file with SKU, Quantity columns
OR
- items: [{ sku: "SKU001", quantity: 10 }, ...]
```

**GET /api/v1/b2b/bulk-order/:id** (b2b_user)
Get bulk order status with validation errors

### Reorder Endpoint

**POST /api/v1/b2b/reorder/:orderId** (b2b_user)
Create new cart from previous order
```json
{
  "cartName": "Reorder from Order #12345"
}
```

## Events

### Published Events

| Event | Triggered By | Payload |
|-------|-----------|---------|
| `b2b.registration_submitted` | RegisterB2B | registrationId, companyName, email, tier |
| `b2b.registration_approved` | ReviewRegistration | registrationId, customerId, creditLimit, tier |
| `b2b.registration_rejected` | ReviewRegistration | registrationId, reason |
| `b2b.order_from_cart` | ConvertCartToOrder | orderId, customerId, totalAmount |
| `b2b.bulk_order` | ProcessBulkOrder | bulkOrderId, itemCount, successCount |
| `b2b.credit_adjusted` | AdjustCredit | customerId, amount, reason |

### Subscribed Events

| Event | Handler | Action |
|-------|---------|--------|
| `order.completed` | onOrderCompleted | Confirm credit usage, update stats |
| `order.cancelled` | onOrderCancelled | Release held credit |
| `pricing.tier_updated` | onTierUpdated | Recalculate customer pricing |

## Database Schema

### Tables
- `b2b_registrations` - Registration requests
- `customers` (extended for B2B) - B2B customer data
- `credit_limits` - Credit limit tracking
- `saved_carts` - Saved shopping carts
- `saved_cart_items` - Items in saved carts
- `bulk_orders` - Bulk order submissions
- `credit_transactions` - Immutable credit audit trail

See `/database/schema.sql` for complete DDL

## Error Handling

### Custom Errors (with HTTP status codes)

| Error | Status | Cause |
|-------|--------|-------|
| `RegistrationExistsError` | 409 | CUI or email already registered |
| `InvalidCuiError` | 400 | CUI format invalid |
| `InvalidIbanError` | 400 | IBAN format invalid |
| `InsufficientCreditError` | 422 | Order exceeds available credit |
| `CartNotFoundError` | 404 | Cart doesn't exist |
| `BulkValidationError` | 422 | Bulk order validation failed |
| `CustomerSuspendedError` | 422 | Customer account suspended |
| `EmptyCartError` | 422 | Cannot convert empty cart |
| `ProductNotFoundError` | 400 | SKU not found in inventory |
| `InsufficientStockError` | 422 | Insufficient stock for order |

## Testing

### Test Structure
```
tests/
  ├── domain/
  │   ├── B2BRegistration.test.ts
  │   ├── B2BCustomer.test.ts
  │   ├── SavedCart.test.ts
  │   ├── BulkOrder.test.ts
  │   └── CreditService.test.ts
  └── application/
      ├── RegisterB2B.test.ts
      ├── ReviewRegistration.test.ts
      ├── ConvertCartToOrder.test.ts
      └── ProcessBulkOrder.test.ts
```

### Running Tests
```bash
npm test                 # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Generate coverage report
```

### Coverage Requirements
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Configuration

### Environment Variables
```
B2B_ENABLE_CUI_VERIFICATION=false    # Enable ANAF CUI verification
B2B_ANAF_API_URL=https://...        # ANAF API endpoint
B2B_ANAF_API_KEY=xxx                # ANAF API key
B2B_CREDIT_WARNING_THRESHOLD=80     # Credit usage warning %
B2B_DEFAULT_TIER=STANDARD           # Initial tier for new customers
B2B_DEFAULT_CREDIT_LIMIT=10000      # Default credit limit in RON
```

### Feature Flags
- `enable_b2b_portal` - Enable/disable entire module
- `b2b_bulk_order_processing` - Enable bulk order processing
- `b2b_credit_management` - Enable credit limit features

## Dependencies

### Internal Modules
- `inventory` - Stock validation
- `pricing-engine` - Tier and discount calculations
- `orders` - Order creation
- `notifications` - Email/SMS notifications

### External Libraries
- `express` - Web framework
- `typeorm` - ORM for database
- `winston` - Logging

## Performance Considerations

### Caching
- Customer tier info (5 min TTL)
- Credit limits (10 min TTL)
- Cart subtotals (session-based)

### Database Queries
- Indexed on: `cui`, `email`, `customerId`, `registrationId`, `status`
- Bulk operations use batch inserts
- Pagination: max 100 items per page

### Limitations
- Bulk orders: max 10,000 items per submission
- Cart items: max 1,000 items per cart
- File upload: max 10MB per document

## Roadmap

### v1.1
- Customer tier auto-upgrade on order completion
- Email notifications for pending registrations
- Admin dashboard with analytics

### v1.2
- WhatsApp order status notifications
- Reorder templates for frequent purchases
- Supplier integration for direct ordering

### v2.0
- Credit scoring engine
- Dynamic payment terms based on history
- Multi-currency support (EUR, GBP, USD)

## Support

For issues, questions, or contributions:
1. Check existing documentation
2. Review test examples
3. Consult domain entity JSDoc
4. Contact CYPHER ERP Team

## License

MIT License - See LICENSE file
