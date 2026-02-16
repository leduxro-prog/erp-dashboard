# Security Module - Anti-IDOR Protection

Enterprise-level security module for Cypher ERP providing comprehensive protection against Insecure Direct Object Reference (IDOR) attacks.

## Overview

This module implements defense-in-depth security for checkout, cart, orders, and credit endpoints to prevent unauthorized access to customer resources.

## Features

### 1. JWT Authentication (`JwtAuth`)

- **Secure token parsing** with realm validation
- **Session validation** with expiry checking
- **Token revocation** support (Redis/DB integration)
- **Role-based access control** (RBAC)
- **Permission-based access control** (PBAC)
- **Audit logging** for all auth events
- **Admin bypass** support for authorized users

### 2. IDOR Prevention (`IdorPrevention`)

- **Block customer_id injection** in request body, params, and query
- **Resource ownership validation** for all protected resources
- **Pattern detection** for common IDOR attack vectors
- **Security incident logging** for all IDOR attempts
- **Request sanitization** to remove unauthorized fields
- **Strict mode** to block all suspicious requests

### 3. Request Validation (`RequestValidator`)

- **Input sanitization** against XSS and SQL injection
- **Schema validation** using Joi
- **Field blocking** for protected fields
- **Type coercion** and validation
- **Size limits** and constraints

## Installation

```bash
cd /opt/cypher-erp/modules/security
npm install
npm run build
```

## Usage

### Basic Setup

```typescript
import express from 'express';
import { getSecurityModule } from '@cypher/security';

const app = express();
const security = getSecurityModule({
  jwtSecret: process.env.JWT_SECRET,
  jwtSecretB2B: process.env.JWT_SECRET_B2B,
  enableIdorPrevention: true,
  strictIdorMode: true,
});

// Initialize security module
security.initialize();

// Apply security middleware globally
security.applyToApp(app, {
  global: true,
  skipPaths: [/^\/health$/, /^\/metrics$/],
  b2bPaths: [/^\/api\/v1\/b2b/],
});
```

### Individual Middleware

```typescript
import { Middleware } from '@cypher/security';

// JWT Authentication
app.use('/api/v1', Middleware.jwtAuth({
  requiredRealm: 'erp',
  checkRevocation: true,
}));

// IDOR Prevention
app.use('/api/v1', Middleware.preventIdor({
  enabled: true,
  strictMode: true,
  logViolations: true,
}));

// Request Validation
app.use('/api/v1', Middleware.validateRequest({
  sanitizeInput: true,
  checkSqlInjection: true,
  checkXss: true,
}));

// Role-based Access Control
app.delete('/admin/users',
  Middleware.requireRole(['admin', 'superadmin']),
  deleteUserHandler
);

// Permission-based Access Control
app.post('/orders',
  Middleware.requirePermissions(['orders.create']),
  createOrderHandler
);
```

### Custom Ownership Validator

```typescript
app.use('/api/v1/orders', Middleware.preventIdor({
  customOwnershipValidator: async (resourceType, resourceId, customerId, req) => {
    // Custom logic to verify ownership
    const order = await db.findOrder(resourceId);
    return order.customer_id === customerId;
  },
}));
```

### Schema Validation

```typescript
import { validateRequest, SchemaBuilder } from '@cypher/security';

app.post('/checkout',
  validateRequest({
    schema: SchemaBuilder.checkout(),
  }),
  checkoutHandler
);
```

## Protected Endpoints

### Cart Endpoints

- `GET /api/v1/cart` - Get own cart
- `GET /api/v1/cart/:id` - Get specific cart (ownership check)
- `POST /api/v1/cart/items` - Add item to cart (customer_id blocked)
- `PUT /api/v1/cart/items/:itemId` - Update item (customer_id blocked)
- `DELETE /api/v1/cart/items/:itemId` - Remove item (ownership check)
- `POST /api/v1/cart/checkout` - Checkout (customer_id blocked)

### Order Endpoints

- `GET /api/v1/orders` - List own orders
- `GET /api/v1/orders/:id` - Get specific order (ownership check)
- `GET /api/v1/orders/:id/items` - Get order items (ownership check)
- `POST /api/v1/orders` - Create order (customer_id blocked)
- `PATCH /api/v1/orders/:id` - Update order (ownership check, customer_id blocked)
- `DELETE /api/v1/orders/:id` - Cancel order (ownership check)
- `POST /api/v1/orders/:id/cancel` - Cancel order via POST (ownership check)

### Credit Endpoints

- `GET /api/v1/credit` - Get own credit account
- `GET /api/v1/credit/:customerId` - Get specific credit account (ownership check)
- `GET /api/v1/credit/transactions` - Get own transactions
- `GET /api/v1/credit/:customerId/transactions` - Get transactions (ownership check)
- `POST /api/v1/credit/reserve` - Reserve credit (customer_id blocked)
- `POST /api/v1/credit/:customerId/reserve` - Reserve credit (ownership check)
- `POST /api/v1/credit/payment` - Make payment (customer_id blocked)
- `PATCH /api/v1/credit/:customerId` - Update credit (admin only)

### Checkout Endpoints

- `POST /api/v1/checkout` - Process checkout (customer_id blocked)
- `POST /api/v1/checkout/validate` - Validate checkout data (customer_id blocked)
- `POST /api/v1/checkout/reserve-credit` - Reserve credit (customer_id blocked)
- `GET /api/v1/checkout/addresses` - Get own addresses
- `GET /api/v1/checkout/addresses/:addressId` - Get specific address (ownership check)
- `GET /api/v1/checkout/payment-methods` - Get own payment methods
- `GET /api/v1/checkout/payment-methods/:methodId` - Get specific method (ownership check)

## Testing

Run the comprehensive IDOR security tests:

```bash
cd /opt/cypher-erp/tests/security
npm install
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- CartIdorTests
npm test -- OrderIdorTests
npm test -- CreditIdorTests
npm test -- CheckoutIdorTests
```

## Test Coverage

The test suite includes:

### CartIdorTests
- Access other customer cart by ID
- Access cart via customer_id parameter
- Add item with customer_id injection
- Modify cart item with customer_id injection
- Delete cart item with customer_id injection
- Checkout with customer_id injection
- Authentication edge cases
- Admin bypass scenarios
- Batch IDOR tests

### OrderIdorTests
- Access other customer order by ID
- Access orders via customer_id parameter
- View order items of other customers
- Modify other customer orders
- Cancel other customer orders
- Create order with customer_id injection
- Cross-customer order enumeration

### CreditIdorTests
- View other customer credit
- View other customer transaction ledger
- Reserve credit for other customers
- Make payment for other customers
- Modify credit accounts (admin only)
- View all credit summaries (admin only)

### CheckoutIdorTests
- Checkout with different customer ID
- Reserve credit for different customer
- View other customer addresses
- Use other customer address
- View other customer payment methods
- Use other customer payment method

## Security Guidelines

### For Developers

1. **Never use customer_id from request body**
   - Always use the authenticated customer ID from `req.securityContext`

2. **Validate resource ownership**
   - Use `verifyResourceOwnership()` or `verifyOwnership()` helpers

3. **Use security middleware**
   - Apply `preventIdor()` to all customer-specific endpoints

4. **Log security incidents**
   - All IDOR attempts are automatically logged

### For Security Auditors

Review the following:

1. **Audit logs** for IDOR violations
2. **Access patterns** for suspicious behavior
3. **Failed auth attempts** for brute force attacks
4. **Rate limiting** for abuse prevention

## Configuration

### Environment Variables

```bash
# JWT Secrets (required)
JWT_SECRET=your-erp-jwt-secret
JWT_SECRET_B2B=your-b2b-jwt-secret

# Security Module Options
ENABLE_IDOR_PREVENTION=true
STRICT_IDOR_MODE=true
ENABLE_AUDIT_LOGGING=true

# Rate Limiting
RATE_LIMIT_AUTH_ATTEMPTS=5
RATE_LIMIT_WINDOW=300
```

## API Responses

### Success

```json
{
  "success": true,
  "data": { ... }
}
```

### IDOR Violation

```json
{
  "success": false,
  "error": {
    "code": "IDOR_VIOLATION",
    "message": "Access to this resource is not authorized",
    "details": {
      "resourceType": "cart",
      "resourceId": "12345"
    }
  }
}
```

### Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Token Expired

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token has expired",
    "expiredAt": "2025-01-01T00:00:00.000Z"
  }
}
```

## License

MIT

## Security Contact

For security concerns, contact: security@cypher.ro
