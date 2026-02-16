# Input Validation Guide - CYPHER ERP

## Overview

All CYPHER ERP modules use **Joi** for schema validation with a shared validation middleware approach for consistency across the application.

## Architecture

### 1. Validator Schemas (Module-Level)

Each module defines its own Joi schemas in `src/api/validators/{module}.validators.ts`:

```typescript
// Example: smartbill.validators.ts
import Joi from 'joi';

export const createInvoiceSchema = Joi.object({
  orderId: Joi.number().integer().positive().required(),
  customerName: Joi.string().min(2).max(255).required(),
  items: Joi.array()
    .items(Joi.object({
      productName: Joi.string().min(2).max(255).required(),
      quantity: Joi.number().positive().required(),
      unitPrice: Joi.number().positive().required(),
    }))
    .min(1)
    .required(),
});
```

### 2. Shared Validation Middleware

Located in `shared/middleware/validation.middleware.ts`, provides reusable validation middleware:

- `validateBody(schema)` - Validates request body
- `validateQuery(schema)` - Validates query parameters
- `validateParams(schema)` - Validates URL path parameters
- `validateRequest(schemas)` - Validates body, query, and params together
- `CommonSchemas` - Pre-built schemas for common patterns

### 3. Implementation Patterns

#### Pattern 1: Individual Validation (Current in modules)

```typescript
// In module routes
function validateRequest(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body || req.params);
    if (error) {
      res.status(400).json({ error: error.message });
    } else {
      req.body = value;
      next();
    }
  };
}

router.post('/invoices', validateRequest(createInvoiceSchema), handler);
```

#### Pattern 2: Using Shared Validation Middleware (Recommended)

```typescript
import { validateBody, validateParams, validateRequest } from '../../../shared/middleware';

// Single validation
router.post('/invoices', validateBody(createInvoiceSchema), handler);
router.get('/invoices/:id', validateParams(getInvoiceParamsSchema), handler);

// Combined validation
router.put('/invoices/:id', validateRequest({
  params: idParamSchema,
  body: updateInvoiceSchema
}), handler);
```

## Migration Guide

### For Existing Modules

To use the shared validation middleware, update your routes:

1. Import the shared validators:
```typescript
import { validateBody, validateQuery, validateParams, validateRequest } from '../../../shared/middleware';
```

2. Replace custom middleware:
```typescript
// Before
const validateRequest = (schema: Joi.Schema) => (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = schema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.message });
  } else {
    req.body = value;
    next();
  }
};

// After
import { validateBody } from '../../../shared/middleware';
```

3. Apply in routes:
```typescript
// Before
router.post('/invoices', validateRequest(createInvoiceSchema), controller.createInvoice);

// After
router.post('/invoices', validateBody(createInvoiceSchema), controller.createInvoice);
```

## Common Schemas

The `CommonSchemas` object provides pre-built schemas for common use cases:

```typescript
import { CommonSchemas } from '../../../shared/middleware';

// Pagination
router.get('/items', validateQuery(CommonSchemas.pagination), handler);

// Sorting
router.get('/items', validateQuery(CommonSchemas.sorting), handler);

// Filtering
router.get('/items', validateQuery(CommonSchemas.filtering), handler);

// ID Parameters
router.get('/items/:id', validateParams(CommonSchemas.idParam), handler);

// UUID Parameters
router.get('/items/:id', validateParams(CommonSchemas.uuidParam), handler);
```

### Combining Common Schemas

```typescript
import Joi from 'joi';
import { CommonSchemas } from '../../../shared/middleware';

const listItemsSchema = Joi.object({
  ...CommonSchemas.pagination.describe().keys,
  ...CommonSchemas.sorting.describe().keys,
  ...CommonSchemas.filtering.describe().keys,
});
```

## Validation Options

```typescript
import { validateBody, type ValidationOptions } from '../../../shared/middleware';

const options: ValidationOptions = {
  stripUnknown: true,      // Remove unknown fields (default: true)
  abortEarly: false,        // Return all errors (default: false)
  context: { userId: 123 }, // Pass context to validators
};

router.post('/items', validateBody(schema, options), handler);
```

## Error Responses

All validation errors return 400 status with this format:

```json
{
  "error": "Validation Error",
  "message": "Request validation failed: \"name\" is required",
  "details": [
    {
      "field": "name",
      "message": "\"name\" is required"
    },
    {
      "field": "email",
      "message": "\"email\" must be a valid email"
    }
  ],
  "statusCode": 400
}
```

## Best Practices

### 1. Schema Naming

```typescript
// Request body
export const createOrderSchema = Joi.object({ ... });
export const updateOrderSchema = Joi.object({ ... });

// Query parameters
export const listOrdersQuerySchema = Joi.object({ ... });

// Path parameters
export const getOrderParamsSchema = Joi.object({ ... });
```

### 2. Schema Organization

Keep validators in dedicated files per module:
```
module-name/src/api/
├── controllers/
├── routes/
│   └── module.routes.ts
└── validators/
    └── module.validators.ts
```

### 3. Joi Schema Best Practices

```typescript
// Good: Clear, specific validation
export const createUserSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Must be a valid email address',
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*[0-9])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase and numbers',
    }),
  age: Joi.number()
    .integer()
    .min(18)
    .max(120)
    .optional(),
});

// Bad: Vague validation
export const createUserSchema = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
  age: Joi.any(),
});
```

### 4. Conditional Validation

```typescript
export const updateOrderSchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED')
    .required(),
  tracking_number: Joi.string()
    .when('status', {
      is: 'SHIPPED',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
});
```

### 5. Custom Validation Messages

```typescript
export const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
    }),
});
```

## Complete Example

### Module: Orders

**File: modules/orders/src/api/validators/order.validators.ts**
```typescript
import Joi from 'joi';
import { CommonSchemas } from '../../../shared/middleware';

export const createOrderSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().positive().required(),
        unit_price: Joi.number().positive().required(),
      })
    )
    .min(1)
    .required(),
  shipping_address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    zip: Joi.string().required(),
  }).required(),
  notes: Joi.string().max(1000).optional(),
});

export const updateOrderSchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED')
    .optional(),
  notes: Joi.string().max(1000).optional(),
});

export const listOrdersQuerySchema = Joi.object({
  ...CommonSchemas.pagination.describe().keys,
  ...CommonSchemas.filtering.describe().keys,
  status: Joi.string().valid('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED').optional(),
});

export const getOrderParamsSchema = CommonSchemas.idParam;
```

**File: modules/orders/src/api/routes/order.routes.ts**
```typescript
import { Router } from 'express';
import { validateBody, validateParams, validateQuery, validateRequest } from '../../../shared/middleware';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import {
  createOrderSchema,
  updateOrderSchema,
  listOrdersQuerySchema,
  getOrderParamsSchema,
} from '../validators/order.validators';
import { OrderController } from '../controllers/OrderController';

export function createOrderRoutes(controller: OrderController): Router {
  const router = Router();
  router.use(authenticate);

  // List orders with validation
  router.get(
    '/',
    validateQuery(listOrdersQuerySchema),
    (req, res) => controller.listOrders(req, res)
  );

  // Create order with validation
  router.post(
    '/',
    validateBody(createOrderSchema),
    (req, res) => controller.createOrder(req, res)
  );

  // Get specific order
  router.get(
    '/:id',
    validateParams(getOrderParamsSchema),
    (req, res) => controller.getOrder(req, res)
  );

  // Update order with combined validation
  router.put(
    '/:id',
    validateRequest({
      params: getOrderParamsSchema,
      body: updateOrderSchema,
    }),
    (req, res) => controller.updateOrder(req, res)
  );

  return router;
}
```

## Validation Coverage Status

### Modules with Full Validation
- ✅ smartbill
- ✅ analytics
- ✅ configurators
- ✅ inventory
- ✅ marketing
- ✅ notifications
- ✅ orders
- ✅ pricing-engine
- ✅ quotations
- ✅ seo-automation
- ✅ suppliers
- ✅ whatsapp
- ✅ woocommerce-sync
- ✅ b2b-portal

All modules have Joi schemas defined in their validators directory and can optionally be updated to use the shared validation middleware for consistency.

## Testing

### Unit Testing Validators

```typescript
import { createOrderSchema } from './order.validators';

describe('Order Validators', () => {
  it('should validate a valid order', () => {
    const validOrder = {
      customer_id: 1,
      items: [{ product_id: 1, quantity: 5, unit_price: 99.99 }],
      shipping_address: { street: 'Main St', city: 'NYC', zip: '10001' },
    };

    const { error } = createOrderSchema.validate(validOrder);
    expect(error).toBeUndefined();
  });

  it('should reject invalid order', () => {
    const invalidOrder = {
      customer_id: -1, // Invalid: must be positive
      items: [],       // Invalid: must have at least 1 item
    };

    const { error } = createOrderSchema.validate(invalidOrder);
    expect(error).toBeDefined();
    expect(error?.details).toHaveLength(2);
  });
});
```

### Integration Testing with Routes

```typescript
import request from 'supertest';
import app from './app';

describe('Order Routes', () => {
  it('should return 400 on invalid order creation', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .send({ invalid: 'data' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Error');
  });
});
```

## References

- [Joi Documentation](https://joi.dev/)
- [Express Middleware Guide](https://expressjs.com/en/guide/using-middleware.html)
- [CYPHER ERP Module System](/shared/module-system/README.md)
