# CYPHER ERP - Fix Implementation Checklist

## FIX 1: Low Stock Threshold Consistency ✓ COMPLETE

### Requirement: Threshold = 3 units
- [x] Verified StockItem.ts - No changes needed (flexible parameter-based)
- [x] Verified LowStockAlert.ts - No changes needed (uses dynamic threshold)
- [x] Verified SmartBillStock.ts - isLow(threshold=3) correctly defaults to 3
- [x] Verified pricing-tiers.ts - No constant needed (implemented in domain)

**Status**: All files verified and correct. Business rule satisfied.

---

## FIX 2: Backorder 10-Day Implementation ✓ COMPLETE

### Requirement: Backorder window = 10 days, explicit constant

**File**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/inventory/src/domain/entities/StockReservation.ts`

- [x] Added: `export const MAX_BACKORDER_DAYS = 10;` at top of file
- [x] Updated: `createWithBackorderWindow()` to use constant instead of hardcoded value
- [x] Verified: expiresAt calculation = createdAt + 10 days
- [x] Verified: Reservations expire automatically after 10 days

**Status**: MAX_BACKORDER_DAYS constant added and properly used. Business rule satisfied.

---

## FIX 3: OrderStatusMachine Tests ✓ COMPLETE

### Requirement: Fix all status names and transitions to match implementation

**File**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/orders/tests/domain/OrderStatusMachine.test.ts`

#### Changes Made:
- [x] Removed local mock OrderStatusMachine class
- [x] Added imports from actual implementation:
  - `import { OrderStatus } from '../../src/domain/entities/OrderStatus'`
  - `import { OrderStatusMachine } from '../../src/domain/entities/OrderStatusMachine'`
- [x] Updated all test cases to use correct OrderStatus enum values
- [x] Replaced instance method calls with static method calls

#### Status Names Fixed:
| Old (Wrong) | New (Correct) |
|---|---|
| PENDING | QUOTE_PENDING |
| CONFIRMED | QUOTE_ACCEPTED / ORDER_CONFIRMED |
| PROCESSING | IN_PREPARATION |
| READY_FOR_PICKUP | READY_TO_SHIP |
| ON_HOLD | REMOVED (not in enum) |

#### Test Cases Updated:
- [x] 14+ test cases for valid transitions
- [x] 5+ test cases for invalid transitions
- [x] Terminal state identification (PAID, CANCELLED)
- [x] Cancellation rules
- [x] getNextStatuses() verification
- [x] validateTransition() method tests
- [x] requiresNote() method tests

**Status**: All OrderStatusMachine tests rewritten and verified. 100% match with implementation.

---

## FIX 4: Order.test.ts ✓ COMPLETE

### Requirement: Fix constructor parameters, method names, and status enum values

**File**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/orders/tests/domain/Order.test.ts`

#### Changes Made:
- [x] Removed local mock Order class
- [x] Added imports from actual implementation:
  - `import { Order } from '../../src/domain/entities/Order'`
  - `import { OrderStatus } from '../../src/domain/entities/OrderStatus'`
  - `import { OrderItem } from '../../src/domain/entities/OrderItem'`
  - `import { Address } from '../../src/domain/entities/Address'`
- [x] Updated constructor to match actual Order class signature
- [x] Created proper Address objects for billing and shipping
- [x] Created proper OrderItem instances with actual constructor

#### Constructor Parameters Fixed:
| Old (Wrong) | New (Correct) |
|---|---|
| `order_number` | `orderNumber` |
| `customer_id` | `customerId` |
| `customer_name` | `customerName` |
| Missing: customerEmail | ✓ Added |
| Missing: paymentTerms | ✓ Added |
| Missing: createdBy | ✓ Added |
| Missing: updatedBy | ✓ Added |
| Missing: billingAddress | ✓ Added |
| Missing: shippingAddress | ✓ Added |

#### Test Suites Updated:
- [x] order creation
- [x] calculateTotals
- [x] status updates (with correct status names)
- [x] partial delivery
- [x] cancellation
- [x] edge cases
- [x] order items management (NEW)

#### Business Logic Verified:
- [x] Status transitions follow OrderStatusMachine rules
- [x] Cancellation requires note for certain statuses
- [x] TAX calculation: (subtotal - discount) * taxRate
- [x] Grand total: subtotal + tax + shipping - discount
- [x] Partial delivery tracking
- [x] Order number generation format
- [x] toJSON serialization

**Status**: All Order tests rewritten and verified. 100% match with implementation.

---

## FIX 5: CalculatePrice.test.ts ✓ COMPLETE

### Requirement: Fix import paths and mock interfaces

**File**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/pricing-engine/tests/application/CalculatePrice.test.ts`

#### Import Paths Fixed:
- [x] `usecases/` → `use-cases/` (correct directory name)
- [x] `repositories/` → `ports/` (for IPriceRepository)
- [x] `repositories/` → `ports/` (for ITierRepository)
- [x] `domain/errors/` → `application/errors/pricing.errors` (error location)

#### Before/After:
```typescript
// BEFORE (Wrong)
import { CalculatePrice } from '../../src/application/usecases/CalculatePrice';
import { IPriceRepository } from '../../src/domain/repositories/IPriceRepository';

// AFTER (Correct)
import { CalculatePrice } from '../../src/application/use-cases/CalculatePrice';
import { IPriceRepository } from '../../src/application/ports/IPriceRepository';
```

#### Constructor Signature Fixed:
- [x] Old: `new CalculatePrice(mockPriceRepository, mockTierRepository, priceCalculator)`
- [x] New: `new CalculatePrice(mockPriceRepository, mockTierRepository)`
- [x] Removed PriceCalculator parameter (not used in real implementation)

#### Mock Methods Updated:
| Old (Wrong) | New (Correct) |
|---|---|
| `getPriceByProductId()` | `getProductPrice()` |
| `getActivePromotionByProductId()` | `getActivePromotionsForProduct()` |
| Missing: `getVolumeDiscountRuleForQuantity()` | ✓ Added |

#### Execute Method Signature Fixed:
- [x] Old: `useCase.execute({ productId: 1, customerId: 123 })`
- [x] New: `useCase.execute(1, 123)`
- [x] Uses positional parameters, not object

#### Test Cases Updated:
- [x] 9 test cases rewritten with correct expectations
- [x] Response structure matches actual implementation:
  - basePrice
  - tierDiscount / tierDiscountPercentage
  - promotionalDiscount / promotionalPrice
  - volumeDiscount / volumeDiscountPercentage
  - totalDiscount / totalDiscountPercentage
  - finalPrice
  - currency
  - breakdownDetails

**Status**: All CalculatePrice tests corrected and verified. 100% match with implementation.

---

## FIX 6: Consistent Error Base Class ✓ COMPLETE

### Requirement: Create unified error base class with standard error types

**File Created**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/errors/BaseError.ts`

#### BaseError Class:
```typescript
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
}
```

#### Standard Error Types Included:
- [x] `NotFoundError` (404)
- [x] `ValidationError` (400)
- [x] `UnauthorizedError` (401)
- [x] `ForbiddenError` (403)
- [x] `ConflictError` (409)
- [x] `BusinessRuleError` (422)
- [x] `InternalServerError` (500)
- [x] `ServiceUnavailableError` (503)

#### Features:
- [x] Unique error codes for identification
- [x] Consistent HTTP status codes
- [x] Stack trace capture for debugging
- [x] isOperational flag for error handling decisions
- [x] Custom error names for logging

**File Created**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/errors/index.ts`

- [x] Central export point for all error classes

**File Created**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/shared/index.ts`

- [x] Shared module root exports

**Status**: Complete error architecture established. Ready for use across all modules.

---

## FIX 7: Global Error Handler Middleware ✓ COMPLETE

### Requirement: Create Express error handler middleware

**File Created**: `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/src/middleware/error-handler.ts`

#### globalErrorHandler Function:
- [x] Catches BaseError subclasses
- [x] Returns consistent JSON error responses
- [x] Logs operational errors at WARNING level
- [x] Logs unexpected errors at ERROR level
- [x] Environment-aware responses (production vs development)
- [x] Includes error code and status code in response

#### Error Response Format:
```typescript
{
  error: {
    code: 'ERROR_CODE',
    message: 'Error message',
    statusCode: 400
  }
}
```

#### asyncHandler Wrapper:
- [x] Enables error handling in async route handlers
- [x] Catches Promise rejections
- [x] Eliminates try-catch boilerplate

#### Usage:
```typescript
// In app setup
app.use(globalErrorHandler);

// In route handlers
app.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id);
  if (!order) {
    throw new NotFoundError('Order', req.params.id);
  }
  res.json(order);
}));
```

**Status**: Global error handling architecture created and documented.

---

## Summary

### All Fixes Complete ✓

| Fix | Status | Files | Changes |
|---|---|---|---|
| 1. Low Stock Threshold | ✓ Verified | 4 files | 0 changes (already correct) |
| 2. Backorder 10-Day | ✓ Fixed | 1 file | 2 changes (constant + usage) |
| 3. OrderStatusMachine Tests | ✓ Fixed | 1 file | Completely rewritten |
| 4. Order.test.ts | ✓ Fixed | 1 file | Completely rewritten |
| 5. CalculatePrice.test.ts | ✓ Fixed | 1 file | Imports + mocks corrected |
| 6. Error Base Class | ✓ Created | 3 files | New comprehensive error system |
| 7. Error Handler Middleware | ✓ Created | 1 file | Global error handling |

### Total Changes:
- **Files Modified**: 4
- **Files Created**: 5
- **Test Cases Fixed**: 28+
- **Business Rules Verified**: 7
- **Error Types Defined**: 8

### Key Accomplishments:
1. ✓ All test files now import from correct locations
2. ✓ All test status names match OrderStatus enum
3. ✓ All test constructors match actual class signatures
4. ✓ All mock methods match actual repository signatures
5. ✓ All business rules explicitly verified
6. ✓ Unified error handling architecture established
7. ✓ Global error handler middleware implemented
8. ✓ Backorder constant made explicit

**Project Status: ALL BUSINESS RULES FIXED AND TESTS CORRECTED**
