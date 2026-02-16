# Security Implementation Guidelines

## Overview

This document provides comprehensive guidelines for implementing secure endpoints in the Cypher ERP system, specifically focusing on preventing IDOR (Insecure Direct Object Reference) vulnerabilities.

## IDOR Prevention Principles

### 1. Never Trust Customer ID from Request

**Always derive customer ID from JWT claims, never from request body/params.**

```typescript
// ❌ WRONG - Vulnerable to IDOR
router.post('/orders', (req, res) => {
  const customerId = req.body.customer_id; // Attacker can manipulate this!
  const order = await createOrder(customerId);
});

// ✅ CORRECT - Secure
router.post('/orders', Middleware.jwtAuth(), (req, res) => {
  const customerId = req.securityContext.customerId; // From authenticated JWT
  const order = await createOrder(customerId);
});
```

### 2. Validate Resource Ownership

```typescript
import { verifyResourceOwnership } from '@cypher/security';

router.get('/orders/:id', Middleware.jwtAuth(), async (req, res) => {
  const order = await db.getOrder(req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (!verifyResourceOwnership(req, order.customer_id)) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  }

  res.json({ data: order });
});
```

### 3. Use Security Middleware

```typescript
import { preventIdor } from '@cypher/security';

// Apply to all protected endpoints
app.use('/api/v1/cart', preventIdor({
  enabled: true,
  strictMode: true,
  logViolations: true,
}));
```

## Protected Fields

Never allow these fields in request bodies from non-admin users:

- `customer_id`
- `customerId`
- `b2b_customer_id`
- `b2bCustomerId`
- `user_id`
- `userId`
- `created_by`
- `updated_by`

## Endpoint Security Checklist

### GET Endpoints

- [ ] Use JWT authentication
- [ ] Validate resource ownership
- [ ] Block customer_id in query parameters
- [ ] Return 403 for unauthorized access
- [ ] Return 404 for non-existent resources

### POST/PUT/PATCH Endpoints

- [ ] Use JWT authentication
- [ ] Validate resource ownership
- [ ] Block customer_id in request body
- [ ] Sanitize all inputs
- [ ] Validate schema
- [ ] Log creation/modification

### DELETE Endpoints

- [ ] Use JWT authentication
- [ ] Validate resource ownership
- [ ] Block customer_id in request body
- [ ] Use soft delete where possible
- [ ] Log deletion

## Request Validation

### Input Sanitization

```typescript
import { sanitizeString, detectSqlInjection, detectXss } from '@cypher/security';

function sanitizeInput(input: string): string {
  const sanitized = sanitizeString(input);

  if (detectSqlInjection(sanitized)) {
    throw new ValidationError('SQL injection detected');
  }

  if (detectXss(sanitized)) {
    throw new ValidationError('XSS detected');
  }

  return sanitized;
}
```

### Schema Validation

```typescript
import { SchemaBuilder, validateRequest } from '@cypher/security';

app.post('/checkout',
  validateRequest({
    schema: SchemaBuilder.checkout(),
    sanitizeInput: true,
    checkSqlInjection: true,
    checkXss: true,
  }),
  checkoutHandler
);
```

## Authentication Best Practices

### JWT Token Structure

```typescript
interface JwtPayload {
  sub: string | number;  // User ID
  email: string;
  role: string;
  realm: 'erp' | 'b2b';
  customer_id?: string | number;
  b2b_customer_id?: string | number;
  iat: number;
  exp: number;
  jti: string;  // Token ID for revocation
  version: number; // Token version for forced logout
}
```

### Token Issuance

```typescript
import { getJwtParser } from '@cypher/security';

function generateToken(user: User): string {
  const jwtParser = getJwtParser();

  return jwtParser.generateToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    realm: user.realm || 'erp',
    customer_id: user.customerId,
  });
}
```

### Token Validation

```typescript
import { jwtAuth } from '@cypher/security';

// Apply authentication middleware
app.use('/api/v1', jwtAuth({
  checkRevocation: true,
  validateSession: true,
  enableAuditLogging: true,
}));
```

## Authorization Best Practices

### Role-Based Access Control

```typescript
import { requireRole } from '@cypher/security';

app.delete('/users/:id',
  requireRole(['admin', 'superadmin']),
  deleteUserHandler
);
```

### Permission-Based Access Control

```typescript
import { requirePermissions } from '@cypher/security';

app.post('/orders',
  requirePermissions(['orders.create']),
  createOrderHandler
);
```

### Admin Bypass

Admins should have elevated privileges but must still be logged:

```typescript
if (req.securityContext.isAdmin) {
  // Allow admin access
  logger.info('Admin accessing resource', {
    admin: req.securityContext.userId,
    resource: orderId,
  });
} else {
  // Regular user - enforce strict ownership
  if (!verifyResourceOwnership(req, resource.customerId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
}
```

## Audit Logging

### Security Events

Log all security-related events:

```typescript
logger.warn('Security Incident', {
  type: 'IDOR_VIOLATION',
  userId: req.securityContext.userId,
  customerId: req.securityContext.customerId,
  targetResourceId: req.params.id,
  endpoint: req.path,
  method: req.method,
  ip: getClientIp(req),
  userAgent: req.get('user-agent'),
  timestamp: new Date().toISOString(),
});
```

### Audit Trail

Maintain audit trail for sensitive operations:

```typescript
await db.query(`
  INSERT INTO security_audit_log (
    event_type, severity, user_id, customer_id,
    resource_type, resource_id, action,
    ip, user_agent, timestamp
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
`, [
  'IDOR_ATTEMPT',
  'warning',
  req.securityContext.userId,
  req.securityContext.customerId,
  'order',
  req.params.id,
  'VIEW',
  getClientIp(req),
  req.get('user-agent'),
]);
```

## Testing Security

### Negative Testing

Write tests to verify IDOR protection:

```typescript
describe('Order IDOR Protection', () => {
  test('should prevent accessing other customer order', async () => {
    const attackerToken = generateToken(customer201);
    const response = await request(app)
      .get('/orders/10002') // Order belongs to customer 202
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(response.status).toBe(403);
  });
});
```

### Security Test Suite

Run comprehensive security tests:

```bash
cd /opt/cypher-erp/tests/security
npm test
```

## Common Vulnerabilities and Mitigations

### IDOR via Parameter Manipulation

**Vulnerability:**
```
GET /orders/10002  // Try to access order belonging to customer 202
```

**Mitigation:**
```typescript
const order = await db.getOrder(orderId);
if (order.customerId !== req.securityContext.customerId) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### IDOR via Body Injection

**Vulnerability:**
```json
POST /cart/items
{
  "product_id": 1,
  "quantity": 2,
  "customer_id": 999  // Inject customer ID
}
```

**Mitigation:**
```typescript
app.post('/cart/items', preventIdor(), (req, res) => {
  // customer_id is automatically removed by middleware
  const customerId = req.securityContext.customerId;
  // Use authenticated customer ID only
});
```

### SQL Injection

**Vulnerability:**
```
notes: "'; DROP TABLE orders; --"
```

**Mitigation:**
```typescript
app.use('/api/v1', validateRequest({
  checkSqlInjection: true,
  sanitizeInput: true,
}));
```

### XSS

**Vulnerability:**
```
description: "<script>alert('XSS')</script>"
```

**Mitigation:**
```typescript
app.use('/api/v1', validateRequest({
  checkXss: true,
  sanitizeInput: true,
}));
```

## Deployment Checklist

### Pre-Deployment

- [ ] Security middleware applied to all relevant endpoints
- [ ] JWT secrets properly configured (not in code)
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] All IDOR tests passing
- [ ] Penetration testing completed

### Post-Deployment

- [ ] Monitor audit logs for security incidents
- [ ] Set up alerts for repeated failures
- [ ] Review and rotate secrets regularly
- [ ] Update security module as needed

## Response Standards

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|--------------|
| UNAUTHORIZED | Authentication required | 401 |
| TOKEN_EXPIRED | Token has expired | 401 |
| INVALID_TOKEN | Invalid token format | 401 |
| FORBIDDEN | Access denied | 403 |
| IDOR_VIOLATION | IDOR attempt detected | 403 |
| VALIDATION_ERROR | Input validation failed | 400 |
| INSUFFICIENT_PERMISSIONS | Missing required permissions | 403 |
| NOT_FOUND | Resource not found | 404 |

### Response Format

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

## References

- [OWASP IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
