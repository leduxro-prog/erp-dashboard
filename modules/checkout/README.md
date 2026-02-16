# Checkout Transaction Module

Enterprise-grade transaction management for checkout flow with PostgreSQL ACID compliance.

## Overview

The Checkout module provides comprehensive transaction management for financial operations in the checkout process, including:

- **Credit Reservation**: Temporarily reserve credit for orders
- **Order Creation**: Create orders from carts with proper transaction handling
- **Credit Capture**: Capture previously reserved credit
- **Rollback Handling**: Automatic compensation transactions on failure
- **ACID Compliance**: All operations maintain Atomicity, Consistency, Isolation, Durability

## Architecture

### Components

1. **TransactionManager**
   - BEGIN/COMMIT/ROLLBACK handling
   - Transaction isolation levels (READ COMMITTED default)
   - Savepoint support for nested transactions
   - Distributed transaction coordination
   - Deadlock detection and retry logic
   - Audit logging for all transactions

2. **FinancialTransactionService**
   - `reserveCredit(orderId, amount)` - Reserve credit for order
   - `createOrder(cartId, customerId)` - Create order from cart
   - `captureCredit(orderId)` - Capture reserved credit
   - `rollbackOrder(orderId)` - Rollback on failure
   - `releaseCredit(orderId)` - Release credit reservation

3. **TransactionOrchestrator**
   - `executeCheckoutFlow(cartId)` - Complete checkout with transactions
   - Handle failures at each step
   - Implement compensation transactions
   - Retry logic for transient failures

4. **TransactionLogger**
   - Comprehensive transaction logging
   - Request tracking and correlation
   - Operation timing and performance metrics
   - Audit trail compliance

## Installation

The module is automatically loaded by the module system. Ensure the following modules are available:

- `users` - For user/customer information
- `orders` - For order entity and management
- `b2b-portal` - For B2B customer and credit transaction entities

## Usage

### Basic Credit Reservation

```typescript
import { FinancialTransactionService } from '@modules/checkout/src';
import { TransactionManager } from '@modules/checkout/src';

const transactionManager = new TransactionManager({
  dataSource,
  defaultIsolationLevel: 'READ COMMITTED',
  defaultMaxRetries: 3,
});

const financialService = new FinancialTransactionService({
  transactionManager,
});

// Reserve credit for an order
const result = await financialService.reserveCredit({
  customerId: 'customer-123',
  orderId: 'order-456',
  amount: 500.00,
  userId: 'user-789',
});

if (result.success) {
  console.log('Credit reserved:', result.data?.reservationId);
} else {
  console.error('Failed to reserve credit:', result.error);
}
```

### Complete Checkout Flow

```typescript
import { TransactionOrchestrator } from '@modules/checkout/src';

const orchestrator = new TransactionOrchestrator({
  financialTransactionService,
  enableCompensation: true,
  enableRetry: true,
  maxRetries: 3,
});

// Execute complete checkout
const result = await orchestrator.executeCheckoutFlow(
  'cart-123',
  'customer-456',
  {
    reserveCredit: true,
    reserveStock: false,
  }
);

if (result.success) {
  console.log('Checkout completed:', result.orderId);
} else {
  console.error('Checkout failed:', result.error);
  console.log('Compensations executed:', result.steps);
}
```

### Transaction with Options

```typescript
const result = await transactionManager.executeInTransaction(
  async (entityManager) => {
    // Execute your business logic
    await entityManager.save(someEntity);
    return { data: 'success' };
  },
  {
    isolationLevel: 'SERIALIZABLE',
    maxRetries: 5,
    timeoutMs: 60000,
    metadata: {
      operation: 'criticalUpdate',
      userId: 'user-123',
      requestId: 'req-456',
    },
  }
);
```

## Transaction Flow

### Happy Path

```
1. Validate Cart
   └─> Check cart exists and has items
2. Reserve Credit
   └─> Lock customer record
   └─> Check credit limit
   └─> Create reservation
   └─> Update used credit
3. Create Order
   └─> Lock cart
   └─> Create order record
   └─> Create order items
   └─> Update cart status
4. Capture Payment
   └─> Find reservation
   └─> Create credit transaction
   └─> Update reservation status
   └─> Update order payment status
5. Finalize
   └─> Send notifications
   └─> Trigger events
```

### Failure Handling

```
If any step fails:
  1. Mark step as FAILED
  2. Execute compensations in reverse order:
     - Release credit (if reserved)
     - Cancel order (if created)
     - Release stock (if reserved)
  3. Log all actions
  4. Return detailed error information
```

## Database Schema

### Credit Reservations

```sql
CREATE TABLE credit_reservations (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  order_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  reserved_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  captured_at TIMESTAMP,
  released_at TIMESTAMP,
  notes TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_credit_reservations_customer ON credit_reservations(customer_id);
CREATE INDEX idx_credit_reservations_order ON credit_reservations(order_id);
CREATE INDEX idx_credit_reservations_status ON credit_reservations(status);
CREATE INDEX idx_credit_reservations_expires ON credit_reservations(expires_at);
```

### Checkout Carts

```sql
CREATE TABLE checkout_carts (
  id UUID PRIMARY KEY,
  customer_id UUID,
  session_id UUID,
  status VARCHAR(20) NOT NULL,
  items JSONB NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount_rate DECIMAL(5,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) NOT NULL,
  shipping_cost DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  notes TEXT,
  order_id UUID,
  expires_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## Testing

### Running Tests

```bash
# Run all financial integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- CheckoutFlowTransaction

# Run with coverage
npm run test:coverage
```

### Test Coverage

The test suite includes:

1. **Checkout Flow Transaction Tests**
   - Happy path scenarios
   - Credit reserve failure handling
   - Order creation failure handling
   - Credit capture failure handling
   - Concurrent checkout attempts
   - Database connection failure

2. **Credit Reservation Tests**
   - Reserve credit for order
   - Double reservation prevention
   - Reservation expiry handling
   - Capture after reserve
   - Release after reserve
   - Concurrent reservation attempts

3. **Order Creation Tests**
   - Create order from cart
   - Order with credit reservation
   - Order with stock reservation
   - Orphan order prevention
   - Duplicate order prevention

4. **Fault Injection Tests**
   - Fail after credit reserve
   - Fail after order create
   - Fail after credit capture
   - Network failure simulation
   - Database deadlock scenarios

## Configuration

### Environment Variables

```bash
# Transaction Manager
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=cypher_erp
DB_POOL_MAX=25
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=30000

# Transaction Options
DEFAULT_ISOLATION_LEVEL=READ_COMMITTED
DEFAULT_MAX_RETRIES=3
DEFAULT_RETRY_DELAY_MS=100
DEFAULT_TIMEOUT_MS=30000
```

## Metrics

The Transaction Manager provides metrics for monitoring:

```typescript
const metrics = transactionManager.getMetrics();
console.log(metrics);
// {
//   totalTransactions: 100,
//   committedTransactions: 95,
//   rolledBackTransactions: 4,
//   failedTransactions: 1,
//   retriedTransactions: 3,
//   deadlockCount: 0,
//   activeTransactions: 0
// }
```

## API Endpoints

### Health Check

```
GET /api/v1/checkout/health
```

Response:
```json
{
  "status": "healthy",
  "details": {
    "metrics": { ... },
    "orchestratorReady": true,
    "serviceReady": true
  }
}
```

### Metrics

```
GET /api/v1/checkout/metrics
```

Response:
```json
{
  "totalTransactions": 100,
  "committedTransactions": 95,
  "rolledBackTransactions": 4,
  "failedTransactions": 1,
  "retriedTransactions": 3,
  "deadlockCount": 0,
  "activeTransactions": 0
}
```

## License

Copyright 2026 Cypher ERP
