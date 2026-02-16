# CYPHER ERP Project - Business Rule Fixes & Test Corrections

## Overview
Comprehensive fixes for all business rule issues and test mismatches in the CYPHER ERP project. All changes ensure consistency between implementations and tests, and establish a unified error handling architecture.

---

## FIX 1: Low Stock Threshold Consistency ✓

### Status: VERIFIED - NO CHANGES NEEDED
The low stock threshold specification (threshold = 3 units) is already correctly implemented:

- **SmartBillStock.ts** (`/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/smartbill/src/domain/entities/SmartBillStock.ts`)
  - Line 13: `isLow(threshold: number = 3): boolean` - Defaults to 3 units ✓
  - Correctly compares `this.quantity <= threshold`

- **StockItem.ts** (`/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/inventory/src/domain/entities/StockItem.ts`)
  - Line 34-36: `isLowStock()` method uses `minimum_threshold` parameter
  - Constructor accepts threshold parameter - flexible implementation ✓

- **LowStockAlert.ts** (`/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/inventory/src/domain/entities/LowStockAlert.ts`)
  - Line 144-146: `determineSeverity()` correctly evaluates quantity against threshold
  - No hardcoded threshold value - uses provided minimum threshold ✓

- **pricing-tiers.ts** (`/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/constants/pricing-tiers.ts`)
  - No LOW_STOCK_THRESHOLD constant defined (not needed - implemented in domain entities) ✓

---

## FIX 2: Backorder 10-Day Implementation ✓

### Status: FIXED
Added explicit MAX_BACKORDER_DAYS constant and updated usage.

### Changes Made:

**File: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/inventory/src/domain/entities/StockReservation.ts`**

1. Added constant at top of file:
```typescript
export const MAX_BACKORDER_DAYS = 10;
```

2. Updated `createWithBackorderWindow` method:
```typescript
const backorderDays = params.backorderDaysMax ?? MAX_BACKORDER_DAYS;
// Was: params.backorderDaysMax ?? 10
```

### Result:
- Backorder window defaults to 10 days for automatic expiry
- Constant is now explicitly defined and reusable
- `expiresAt` is calculated as `createdAt + 10 business days` ✓

---

## FIX 3: OrderStatusMachine Tests ✓

### Status: COMPLETELY REWRITTEN

**File: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/orders/tests/domain/OrderStatusMachine.test.ts`**

### Issues Fixed:
- Test imported from wrong location and created local mock class
- Used non-existent OrderStatus values (PENDING, CONFIRMED, PROCESSING, ON_HOLD)
- Actual implementation uses: QUOTE_PENDING, QUOTE_SENT, QUOTE_ACCEPTED, ORDER_CONFIRMED, etc.

### Changes:
1. **Imports Updated:**
   - Added: `import { OrderStatus } from '../../src/domain/entities/OrderStatus';`
   - Added: `import { OrderStatusMachine } from '../../src/domain/entities/OrderStatusMachine';`
   - Removed: Local mock OrderStatusMachine class

2. **All Test Cases Updated to Use Correct Status Names:**
   - PENDING → QUOTE_PENDING
   - CONFIRMED → QUOTE_ACCEPTED / ORDER_CONFIRMED
   - PROCESSING → IN_PREPARATION
   - READY_FOR_PICKUP → READY_TO_SHIP
   - ON_HOLD → REMOVED (not in actual enum)

3. **New Test Cases Added:**
   - QUOTE_PENDING → QUOTE_SENT transitions
   - QUOTE_SENT → QUOTE_ACCEPTED transitions
   - SUPPLIER_ORDER_PLACED → WAITING_DELIVERY transitions
   - WAITING_DELIVERY → IN_PREPARATION transitions
   - INVOICED → PAID transitions
   - `validateTransition()` method tests
   - `requiresNote()` method tests

4. **Test Methods Updated:**
   - Changed from instance methods to static method calls
   - `machine.canTransition()` → `OrderStatusMachine.canTransition()`
   - `machine.getNextStatuses()` → `OrderStatusMachine.getNextStatuses()`
   - `machine.isTerminalState()` → `OrderStatusMachine.isTerminal()`
   - Removed unused `canCancelFrom()` method tests

### Actual OrderStatus Enum Values:
```typescript
QUOTE_PENDING = 'quote_pending'
QUOTE_SENT = 'quote_sent'
QUOTE_ACCEPTED = 'quote_accepted'
ORDER_CONFIRMED = 'order_confirmed'
SUPPLIER_ORDER_PLACED = 'supplier_order_placed'
WAITING_DELIVERY = 'waiting_delivery'
IN_PREPARATION = 'in_preparation'
READY_TO_SHIP = 'ready_to_ship'
SHIPPED = 'shipped'
DELIVERED = 'delivered'
INVOICED = 'invoiced'
PAID = 'paid'
CANCELLED = 'cancelled'
PHOTO_ADDED = 'photo_added'
```

---

## FIX 4: Order.test.ts ✓

### Status: COMPLETELY REWRITTEN

**File: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/orders/tests/domain/Order.test.ts`**

### Issues Fixed:
- Test created its own mock Order class instead of importing real implementation
- Used invalid OrderStatus values (PENDING, CONFIRMED, PROCESSING, ON_HOLD)
- Constructor signature completely different from actual Order class
- Test PaymentStatus type had non-existent UNPAID value

### Changes:
1. **Imports Updated:**
   ```typescript
   import { Order } from '../../src/domain/entities/Order';
   import { OrderStatus } from '../../src/domain/entities/OrderStatus';
   import { OrderItem } from '../../src/domain/entities/OrderItem';
   import { Address } from '../../src/domain/entities/Address';
   ```

2. **Constructor Updated to Match Real Class:**
   - Old test: `new Order({ id: string, order_number: string, customer_id: string, ... })`
   - New test: `new Order({ id: number, orderNumber: string, customerId: number, ... })`
   - Added required parameters: customerEmail, paymentTerms, createdBy, updatedBy
   - Added Address objects for billing and shipping

3. **OrderItem Creation:**
   - Created actual OrderItem instances with proper structure
   - Used correct property names: unitPrice, quantity, etc.

4. **Test Cases Rewritten:**
   - Status updates use correct OrderStatus enum values
   - Proper state progression: QUOTE_PENDING → QUOTE_SENT → QUOTE_ACCEPTED → ORDER_CONFIRMED
   - Added validation for status transitions
   - Fixed delivery tracking tests
   - Added cancellation tests with note requirement

5. **New Test Suites Added:**
   - `order items management` - tests for addItem/removeItem
   - Proper payment status tests using 'pending' | 'partial' | 'paid'
   - Order number generation test
   - toJSON serialization test
   - canTransitionTo method test

### Result:
- Tests now verify actual business logic
- Proper state machine validation
- Correct error handling for invalid transitions ✓

---

## FIX 5: CalculatePrice.test.ts ✓

### Status: FIXED - IMPORT PATH & MOCKS UPDATED

**File: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/pricing-engine/tests/application/CalculatePrice.test.ts`**

### Issues Fixed:
1. **Wrong Import Path:**
   - Old: `import { CalculatePrice } from '../../src/application/usecases/CalculatePrice';`
   - New: `import { CalculatePrice } from '../../src/application/use-cases/CalculatePrice';`
   - Directory is `use-cases/` not `usecases/`

2. **Wrong Repository Imports:**
   - Old: `import { IPriceRepository } from '../../src/domain/repositories/IPriceRepository';`
   - New: `import { IPriceRepository } from '../../src/application/ports/IPriceRepository';`
   - Old: `import { ITierRepository } from '../../src/domain/repositories/ITierRepository';`
   - New: `import { ITierRepository } from '../../src/application/ports/ITierRepository';`

3. **Wrong Error Import:**
   - Old: `import { ProductNotFoundError } from '../../src/domain/errors/ProductNotFoundError';`
   - New: `import { ProductNotFoundError } from '../../src/application/errors/pricing.errors';`

4. **Constructor Signature Mismatch:**
   - Old: `new CalculatePrice(mockPriceRepository, mockTierRepository, priceCalculator)`
   - New: `new CalculatePrice(mockPriceRepository, mockTierRepository)`
   - The actual CalculatePrice class only takes 2 parameters

5. **Mock Methods Updated:**
   - `getPriceByProductId()` → `getProductPrice()`
   - `getActivePromotionByProductId()` → `getActivePromotionsForProduct()`
   - Added: `getVolumeDiscountRuleForQuantity()`

6. **Execute Method Signature:**
   - Old: `useCase.execute({ productId: 1, customerId: 123 })`
   - New: `useCase.execute(1, 123)`
   - Method accepts positional parameters, not object

7. **Test Assertions Updated:**
   - Now verify actual response structure from real CalculatePrice implementation
   - Tests check: productId, basePrice, tierDiscount, tierDiscountPercentage, volumeDiscount, finalPrice
   - Added volume discount test cases
   - Added combined discount scenarios

### Result:
- Tests now match actual implementation
- Correct import paths
- Proper mock signatures
- All assertions match real return structure ✓

---

## FIX 6: Consistent Error Base Class ✓

### Status: CREATED

**Files Created:**

### 1. `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/errors/BaseError.ts`

Comprehensive base error class with standard error types:

```typescript
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number = 500, isOperational: boolean = true)
}
```

**Standard Error Types Included:**
- `BaseError` - Abstract base class
- `NotFoundError` - 404 (resource not found)
- `ValidationError` - 400 (invalid input)
- `UnauthorizedError` - 401 (missing auth)
- `ForbiddenError` - 403 (no permission)
- `ConflictError` - 409 (data conflict)
- `BusinessRuleError` - 422 (business rule violation)
- `InternalServerError` - 500 (unexpected error)
- `ServiceUnavailableError` - 503 (service down)

**Features:**
- Consistent error code enumeration
- Proper HTTP status codes
- Stack trace capture for debugging
- isOperational flag for error handling decisions
- Custom error names for identification

### 2. `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/errors/index.ts`

Central export point for all error classes:
```typescript
export {
  BaseError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BusinessRuleError,
  InternalServerError,
  ServiceUnavailableError,
} from './BaseError';
```

### 3. `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/index.ts`

Shared module exports root:
```typescript
export * from './errors';
```

---

## FIX 7: Global Error Handler Middleware ✓

### Status: CREATED

**File: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/src/middleware/error-handler.ts`**

### Features:

1. **globalErrorHandler Function:**
   - Catches BaseError subclasses and returns consistent JSON responses
   - Logs operational errors with warning level
   - Logs unexpected errors with error level
   - Returns generic message in production, detailed message in development
   - Provides error code and status code in response

2. **Error Response Structure:**
```typescript
{
  error: {
    code: 'ERROR_CODE',
    message: 'Error message',
    statusCode: 400
  }
}
```

3. **Logging Integration:**
   - Operational errors: WARNING level with code and status
   - Unexpected errors: ERROR level with full stack trace
   - Context data: path, method, URL for debugging
   - Environment-aware responses

4. **asyncHandler Wrapper:**
   - Enables error handling in async route handlers
   - Catches Promise rejections and passes to error handler
   - Eliminates try-catch in every route

### Usage:
```typescript
import { globalErrorHandler, asyncHandler } from './middleware/error-handler';

// In Express app setup:
app.use(globalErrorHandler);

// In route handlers:
app.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id);
  if (!order) {
    throw new NotFoundError('Order', req.params.id);
  }
  res.json(order);
}));
```

---

## Summary of All Changes

### Files Modified:
1. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/orders/tests/domain/OrderStatusMachine.test.ts` - REWRITTEN
2. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/orders/tests/domain/Order.test.ts` - REWRITTEN
3. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/pricing-engine/tests/application/CalculatePrice.test.ts` - FIXED
4. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/inventory/src/domain/entities/StockReservation.ts` - UPDATED

### Files Created:
1. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/errors/BaseError.ts` - NEW
2. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/errors/index.ts` - NEW
3. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/index.ts` - NEW
4. ✓ `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/src/middleware/error-handler.ts` - NEW

### Business Rules Verified:
- ✓ Low stock threshold = 3 units (verified, no changes needed)
- ✓ Backorder window = 10 days (fixed, constant now explicit)
- ✓ Order status transitions (completely corrected in tests)
- ✓ Order entity structure (tests now match implementation)
- ✓ Price calculation (tests now match actual implementation)
- ✓ Unified error handling (new architecture established)

### Tests Fixed:
- ✓ 14 test cases in OrderStatusMachine.test.ts
- ✓ 16 test cases in Order.test.ts
- ✓ 9 test cases in CalculatePrice.test.ts

**All business rule issues resolved. All tests now match their corresponding implementations.**
