# Event Contract Tests

Enterprise-level contract testing suite for producer/consumer schema compatibility in the Cypher ERP event-driven architecture.

## Overview

This test suite ensures that event producers and consumers maintain their contracts, providing confidence in schema compatibility, version evolution, and error handling throughout the distributed system.

## Structure

```
tests/events/contract/
├── producer/
│   ├── EventPublisherContract.test.ts  # Producer-side contract tests
│   ├── SchemaValidation.test.ts         # Schema validation tests
│   └── EventStructure.test.ts          # Event structure validation
├── consumer/
│   ├── EventConsumerContract.test.ts    # Consumer-side contract tests
│   ├── Idempotency.test.ts             # Idempotency validation
│   ├── ErrorHandling.test.ts           # Error handling tests
│   └── VersionCompatibility.test.ts     # Version compatibility tests
├── helpers/
│   ├── EventBuilder.ts                 # Event builder for tests
│   └── SchemaValidator.ts              # Schema validator helper
├── fixtures/
│   ├── OrderEventFixtures.ts           # Order event fixtures
│   ├── ProductEventFixtures.ts         # Product event fixtures
│   ├── StockEventFixtures.ts           # Stock event fixtures
│   └── PriceEventFixtures.ts           # Price event fixtures
├── setup.js                           # Test setup configuration
└── README.md                          # This file
```

## Running Tests

### Run all contract tests

```bash
npm test -- tests/events/contract/
```

### Run producer tests only

```bash
npm test -- tests/events/contract/producer/
```

### Run consumer tests only

```bash
npm test -- tests/events/contract/consumer/
```

### Run with coverage

```bash
npm test -- tests/events/contract/ --coverage
```

### Run specific test file

```bash
npm test -- tests/events/contract/producer/EventPublisherContract.test.ts
```

### Run tests matching a pattern

```bash
npm test -- --testNamePattern="should validate.*order"
```

## Producer Contract Tests

### EventPublisherContract.test.ts

Validates that producers generate events that conform to their schemas:

- Validates all event types (order, product, stock, price, cart, quote, credit)
- Checks required fields are present
- Validates UUID formats
- Validates enum values
- Tests priority levels
- Verifies envelope structure

### SchemaValidation.test.ts

Comprehensive schema validation tests:

- Required field validation
- Type validation (string, number, boolean, array, object)
- Format validation (email, date-time, UUID, currency)
- Enum value validation
- Numeric constraints (minimum, maximum)
- Nested object validation
- Array validation
- Edge cases and error reporting

### EventStructure.test.ts

Event envelope structure validation:

- Envelope factory methods
- Event builder patterns
- Serialization/deserialization
- Event type parsing
- Event envelope utilities
- Retry envelope creation
- Dead letter envelope creation
- Type guards

## Consumer Contract Tests

### EventConsumerContract.test.ts

Consumer-side contract validation:

- Event validation before processing
- Required field extraction
- Forward compatibility (unknown fields)
- Optional field handling
- Schema version handling
- Metadata access
- Priority handling
- Batch event processing

### Idempotency.test.ts

Idempotency guarantees:

- Duplicate event detection
- State consistency across reprocessing
- Idempotency store operations
- Error handling with idempotency
- Performance under high duplicate rates
- Edge cases

### ErrorHandling.test.ts

Consumer error handling:

- Envelope validation errors
- Schema validation errors
- Processing errors
- Error categorization
- Retryable error detection
- Dead letter queue handling
- Error message quality
- Error recovery

### VersionCompatibility.test.ts

Schema version compatibility:

- Schema version detection
- Backward compatibility
- Forward compatibility
- Schema evolution detection
- Version migration
- Multi-version event processing
- Version deprecation
- Contract compatibility matrix

## Test Fixtures

Pre-built event fixtures for testing:

### OrderEventFixtures

- `validOrderCreatedEvent` - Complete valid event
- `minimalOrderCreatedEvent` - Minimal valid event
- `b2bOrderCreatedEvent` - B2B order
- `b2cOrderCreatedEvent` - B2C order
- `guestOrderCreatedEvent` - Guest order
- `multiItemOrderCreatedEvent` - Order with multiple items
- `orderCreatedStatuses` - All order statuses
- `orderCreatedPaymentStatuses` - All payment statuses
- `invalidOrderCreatedEvents` - Invalid events for testing

### ProductEventFixtures

- `validProductUpdatedEvent` - Complete valid event
- Events for all change types (name, description, category, etc.)
- All product statuses
- All visibility settings
- All product types
- Bulk update events
- Invalid events for testing

### StockEventFixtures

- `validStockChangedEvent` - Complete valid event
- Stock addition/removal/adjustment/transfer events
- Reservation and release events
- High and critical priority events
- Invalid events for testing

### PriceEventFixtures

- `validPriceChangedEvent` - Complete valid event
- All price types (regular, special, tier, bulk, b2b)
- All currency codes
- Price direction (increase/decrease)
- Tier and bulk pricing
- Special pricing (sale, clearance, flash, seasonal)
- Invalid events for testing

## Helper Classes

### EventBuilder

Fluent API for building test events:

```typescript
import { EventBuilderFactory } from './helpers/EventBuilder';

// Build a simple event
const event = EventBuilderFactory.order('ORD-0001')
  .withOrder({
    customer_id: 'CUST-001',
    customer_type: 'b2b',
    items: [],
    totals: { subtotal: 0, tax_amount: 0, total: 0, currency: 'EUR' },
  })
  .build();

// Build with metadata
const event = new EventBuilder('order.created', 'order-service')
  .withVersion('v1')
  .withPriority(EventPriority.HIGH)
  .withUser('user-123')
  .withOrder({ /* ... */ })
  .build();
```

### SchemaValidator

Schema validation and compatibility checking:

```typescript
import { SchemaValidator } from './helpers/SchemaValidator';

const validator = new SchemaValidator();
await validator.loadAllSchemas();

// Validate an event
const result = await validator.validateEvent(event);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Check compatibility
const compatibility = validator.checkCompatibility(oldSchema, newSchema);
if (!compatibility.compatible) {
  console.error('Breaking changes:', compatibility.issues);
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Contract Tests

on:
  pull_request:
    paths:
      - 'events/**'
      - 'tests/events/contract/**'
  push:
    branches:
      - main

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- tests/events/contract/
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: coverage/
```

### GitLab CI

```yaml
contract_tests:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm test -- tests/events/contract/
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    when: always
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  only:
    - merge_requests
    - main
```

## Contract Testing Best Practices

### 1. Test Both Sides

Always test both producer and consumer contracts:

- Producer tests ensure events are generated correctly
- Consumer tests ensure events can be processed correctly
- Both sides must agree on the contract

### 2. Use Fixtures

Use pre-built fixtures to ensure consistency:

```typescript
import { validOrderCreatedEvent } from './fixtures/OrderEventFixtures';

test('should process valid order', async () => {
  const result = await consumer.process(validOrderCreatedEvent);
  expect(result.success).toBe(true);
});
```

### 3. Test Edge Cases

Include edge cases in your tests:

- Missing required fields
- Invalid formats
- Boundary values
- Empty arrays
- Maximum sizes

### 4. Test Error Scenarios

Ensure errors are handled gracefully:

- Validation errors should be non-retryable
- Processing errors should be retryable
- Error messages should be descriptive
- Errors should be logged appropriately

### 5. Maintain Backward Compatibility

New versions must be backward compatible:

- Never remove required fields
- Never change field types
- Never remove enum values
- Always add optional fields

### 6. Document Breaking Changes

When making breaking changes:

1. Update schema version (v1 -> v2)
2. Update all related tests
3. Update documentation
4. Communicate with all consumers
5. Provide migration guide

## Schema Evolution Guidelines

### Non-Breaking Changes

These changes are backward compatible:

- Adding optional fields
- Adding enum values
- Adding nested properties
- Relaxing constraints (e.g., minimum to 0 from 1)

### Breaking Changes

These changes require a version bump:

- Adding required fields
- Removing fields
- Changing field types
- Removing enum values
- Tightening constraints

### Example Evolution

```typescript
// v1
{
  "type": "object",
  "required": ["id", "name"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" }
  }
}

// v2 (non-breaking)
{
  "type": "object",
  "required": ["id", "name"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "description": { "type": "string" }  // New optional field
  }
}

// v3 (breaking)
{
  "type": "object",
  "required": ["id", "name", "version"],  // New required field
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "version": { "type": "number" }
  }
}
```

## Troubleshooting

### Schema Not Found

If you see "No schema found for event type":

1. Check the event type format (should be `domain.action`)
2. Check the event version (should be `v1`, `v2`, etc.)
3. Verify the schema file exists in `events/schemas/`
4. Run `npm run events:registry` to rebuild the registry

### Validation Failures

If validation fails unexpectedly:

1. Check the validation error details
2. Verify the schema definition
3. Check for format mismatches (e.g., email, UUID)
4. Review enum values

### Test Timeouts

If tests are timing out:

1. Check for infinite loops
2. Review async/await patterns
3. Increase timeout with `jest.setTimeout()`
4. Check for network calls in tests

## Contributing

When adding new event types:

1. Create the schema file in `events/schemas/`
2. Update the registry
3. Add fixtures in `fixtures/`
4. Add producer tests
5. Add consumer tests
6. Update this README

## Resources

- [Event Documentation](../../README.md)
- [Schema Documentation](../../schemas/README.md)
- [Event Governance](../../../docs/events/governance.md)
- [Consumer SDK](../../../modules/consumer-sdk/)
