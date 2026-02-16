# Event Schemas Documentation

This directory contains JSON Schema definitions for all events in the Cypher ERP event-driven architecture.

## Overview

Event schemas define the structure and validation rules for event payloads. All events conform to a standard envelope structure with domain-specific payloads defined by individual schemas.

## Directory Structure

```
schemas/
├── README.md              # This file
├── registry.json          # Schema registry metadata
├── common/                # Common schema definitions
│   └── envelope-v1.json   # Event envelope schema
├── cart/                  # Cart-related events
│   └── cart-updated-v1.json
├── credit/                # Credit-related events
│   └── credit-changed-v1.json
├── order/                 # Order-related events
│   ├── order-created-v1.json
│   └── order-cancelled-v1.json
├── price/                 # Price-related events
│   └── price-changed-v1.json
├── product/               # Product-related events
│   └── product-updated-v1.json
├── quote/                 # Quote-related events
│   └── quote-created-v1.json
└── stock/                 # Stock-related events
    └── stock-changed-v1.json
```

## P0 Events

The following P0 (critical) events are currently defined:

| Event Type | Description | Schema File |
|------------|-------------|-------------|
| `cart.updated` | Shopping cart modifications | `cart/cart-updated-v1.json` |
| `quote.created` | New quote creation | `quote/quote-created-v1.json` |
| `order.created` | New order creation | `order/order-created-v1.json` |
| `order.cancelled` | Order cancellation | `order/order-cancelled-v1.json` |
| `credit.changed` | Customer credit changes | `credit/credit-changed-v1.json` |
| `product.updated` | Product details update | `product/product-updated-v1.json` |
| `stock.changed` | Inventory level changes | `stock/stock-changed-v1.json` |
| `price.changed` | Product price changes | `price/price-changed-v1.json` |

## Schema Structure

All schemas follow JSON Schema Draft 7 specification and include:

### Required Properties

- `$schema` - Reference to JSON Schema specification
- `$id` - Unique identifier for the schema
- `title` - Human-readable schema title
- `description` - Detailed description of the event
- `type` - Type definition (usually `object`)
- `required` - Array of required field names
- `properties` - Field definitions

### Optional Properties

- `definitions` - Reusable schema components
- `examples` - Example payloads
- `additionalProperties` - Control of additional fields (default: false)

## Event Envelope

All events are wrapped in a standard envelope defined in `common/envelope-v1.json`:

```typescript
interface EventEnvelope<TPayload> {
  event_id: string;              // UUID v4
  event_type: string;            // e.g., "order.created"
  event_version: string;         // e.g., "v1"
  occurred_at: string;           // ISO 8601 timestamp
  producer: string;              // Service name
  producer_version?: string;      // Service version
  producer_instance?: string;    // Instance identifier
  correlation_id: string;        // UUID v4 for transaction grouping
  causation_id?: string;         // UUID v4 for causation chain
  parent_event_id?: string;       // UUID v4 for hierarchical events
  trace_id?: string;             // Distributed trace ID
  routing_key?: string;          // Message routing key
  priority: EventPriority;       // low, normal, high, critical
  payload: TPayload;             // Event payload
  metadata?: EventMetadata;      // Additional context
}
```

## Schema Naming Conventions

### File Names
- Format: `{event}-v{version}.json`
- Example: `order-created-v1.json`

### Schema IDs
- Format: `https://schemas.cypher.ro/events/{domain}/{event}-v{version}.json`
- Example: `https://schemas.cypher.ro/events/order/order-created-v1.json`

### Event Types
- Format: `{domain}.{action}`
- Example: `order.created`, `product.updated`

## Versioning

### Schema Versioning Strategy

1. **Additive Changes (Non-Breaking)**
   - Adding optional fields: Increment patch version (v1.1, v1.2)
   - No schema file change needed if field is truly optional

2. **Breaking Changes**
   - Adding required fields: Increment major version (v1 → v2)
   - Removing or renaming fields: Increment major version (v1 → v2)
   - Changing field types: Increment major version (v1 → v2)
   - Create new schema file

### Version Compatibility

- Multiple schema versions can coexist
- New events should use the latest version
- Existing events maintain their version
- Consumers can handle multiple versions

## Adding New Schemas

### 1. Create the Schema File

Create a new JSON file in the appropriate domain directory:

```bash
# Example: new order event
touch schemas/order/order-shipped-v1.json
```

### 2. Define the Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://schemas.cypher.ro/events/order/order-shipped-v1.json",
  "title": "Order Shipped Event v1",
  "description": "Emitted when an order is shipped.",
  "type": "object",
  "required": [
    "order_id",
    "order_number",
    "shipped_at",
    "tracking_number"
  ],
  "properties": {
    "order_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for the order"
    },
    "order_number": {
      "type": "string",
      "description": "Human-readable order number"
    },
    "shipped_at": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp when the order was shipped"
    },
    "tracking_number": {
      "type": "string",
      "description": "Shipment tracking number"
    }
  }
}
```

### 3. Register the Schema

The schema will be automatically registered by the `SchemaRegistry` when it scans the schemas directory.

### 4. Update Documentation

Update this README with the new event information.

## Schema Registry

The `SchemaRegistry` class (in `/opt/cypher-erp/events/registry/index.ts`) manages all event schemas.

### Usage Examples

```typescript
import { SchemaRegistry, EventEnvelopeFactory } from '@cypher/events';

// Get registry instance
const registry = SchemaRegistry.getInstance();
await registry.initialize();

// Register a schema
await registry.register(schema);

// Validate an event
const envelope = EventEnvelopeFactory.create({
  event_type: 'order.created',
  producer: 'order-service',
  payload: { order_id: '123', total: 100 }
});

const result = await registry.validateEvent(envelope);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// List all schemas
const schemas = registry.listSchemas({ active: true });

// Get schema by type and version
const schema = registry.getSchemaByType('order.created', 'v1');
```

## Validation

### Schema Validation

All events should be validated against their schemas before publishing:

```typescript
const isValid = await registry.validateEvent(envelope);
if (!isValid.valid) {
  // Handle validation errors
  isValid.errors.forEach(error => {
    console.error(`${error.path}: ${error.message}`);
  });
}
```

### Common Validation Errors

1. **Missing Required Fields** - Ensure all required fields are present
2. **Invalid UUID Format** - UUID fields must be valid UUID v4 strings
3. **Invalid Date Format** - Dates must be ISO 8601 strings
4. **Type Mismatch** - Ensure values match the defined types
5. **Enum Values** - Enum fields must use valid enum values

## Testing Schemas

Schemas should be tested with valid and invalid examples:

```typescript
import Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(schema);

// Valid example
const valid = {
  order_id: '550e8400-e29b-41d4-a716-446655440000',
  order_number: 'ORD-00012345',
  // ... other fields
};
console.log(validate(valid)); // Should be true

// Invalid example
const invalid = {
  order_id: 'not-a-uuid',
  // ... other fields
};
console.log(validate(invalid)); // Should be false with errors
```

## Schema Examples

### Order Created Event

```json
{
  "order_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "order_number": "ORD-00012345",
  "customer_id": "CUST-00123",
  "customer_type": "b2b",
  "customer_name": "Acme Corporation",
  "created_at": "2026-02-13T10:00:00.000Z",
  "status": "pending",
  "items": [
    {
      "item_id": "f1e2d3c4-b5a6-9876-fedc-987654321098",
      "product_id": "PRD-001",
      "quantity": 10,
      "unit_price": 150.00,
      "line_total": 1500.00
    }
  ],
  "totals": {
    "subtotal": 1500.00,
    "tax_amount": 285.00,
    "total": 1785.00,
    "currency": "EUR"
  }
}
```

### Stock Changed Event

```json
{
  "product_id": "PRD-00123",
  "sku": "PRD-00123",
  "changed_at": "2026-02-13T10:00:00.000Z",
  "change_type": "order_reserved",
  "quantity_change": -10,
  "previous_quantity": 50,
  "new_quantity": 40,
  "stock_status": "in_stock",
  "location": {
    "warehouse_id": "WH-001",
    "warehouse_name": "Main Warehouse"
  }
}
```

## Best Practices

### Schema Design

1. **Keep schemas focused** - Each schema should represent a single event type
2. **Use descriptive field names** - Clear, self-documenting field names
3. **Provide examples** - Include realistic examples for documentation
4. **Document units** - Always specify units for numeric fields (currency, weight, etc.)
5. **Use appropriate types** - Choose the most specific type (e.g., `enum` vs `string`)

### Event Payload Design

1. **Include context** - Provide enough information for consumers to act
2. **Avoid redundancy** - Reference resources by IDs when possible
3. **Include timestamps** - Always include `occurred_at` for events
4. **Version fields** - Use separate fields for versioned data
5. **Enum stability** - Once published, enum values should not be removed

### Consumer Compatibility

1. **Handle unknown fields** - Consumers should ignore unknown fields
2. **Default values** - Specify defaults for optional fields in the schema
3. **Nullable handling** - Explicitly mark nullable fields in the schema
4. **Backward compatibility** - Design schemas to allow graceful degradation

## Troubleshooting

### Schema Not Found

If a schema is not found:
1. Verify the schema file exists in the correct directory
2. Check the `$id` matches the expected format
3. Ensure the registry has been initialized: `await registry.initialize()`

### Validation Failures

If validation fails:
1. Check the validation errors for specific field issues
2. Verify field types match the schema definitions
3. Ensure all required fields are present
4. Check enum values are valid

### Version Conflicts

If version conflicts occur:
1. Verify the schema file name matches the `$id` version
2. Check that multiple versions are not pointing to the same file
3. Ensure the registry JSON is up to date

## Further Reading

- [JSON Schema Specification](https://json-schema.org/specification.html)
- [AJV Documentation](https://ajv.js.org/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)

## Support

For questions or issues related to event schemas:
- Contact the Architecture Team
- Create an issue in the project repository
- Check the documentation in `/opt/cypher-erp/docs/events/`
