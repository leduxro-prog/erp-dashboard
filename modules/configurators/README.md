# Configurators Module

Product configurators for Ledux.ro supporting two systems:

1. **Magnetic Track System** — customers build custom magnetic track lighting setups
2. **LED Strip System** — customers configure custom LED strip installations

## Architecture

### Domain Layer (`src/domain/`)

**Entities:**
- `ConfiguratorSession` — User's configuration session (24-hour TTL, ACTIVE/COMPLETED/EXPIRED/ABANDONED)
- `ConfigurationItem` — Single component in configuration (product, quantity, price, position)
- `CompatibilityRule` — Business rule constraining component combinations
- `ComponentCatalog` — Available components with pricing and specifications

**Services:**
- `CompatibilityEngine` — Evaluates all rules against configuration
  - REQUIRES: Component A requires Component B
  - EXCLUDES: Components cannot coexist
  - MAX_QUANTITY: Maximum items allowed per configuration
  - MIN_QUANTITY: Minimum items required
  - DISTANCE: Ratio constraints (e.g., 1 controller per 10m of strip)

- `PriceCalculationService` — Calculates totals with volume and tier discounts

**Repositories (Ports):**
- `ISessionRepository` — Session persistence
- `IRuleRepository` — Compatibility rule persistence
- `ICatalogRepository` — Component catalog access

**Errors:**
- `SessionExpiredError` (HTTP 410)
- `IncompatibleComponentError` (HTTP 422)
- `MaxQuantityExceededError` (HTTP 422)
- `InvalidConfigurationError` (HTTP 422)
- `ComponentNotFoundError` (HTTP 404)
- `RuleViolationError` (HTTP 422)
- `SessionNotFoundError` (HTTP 404)
- `InvalidSessionStatusError` (HTTP 422)
- `EmptyConfigurationError` (HTTP 422)

### Application Layer (`src/application/`)

**Use-Cases:**

1. **CreateSession** — Create new 24-hour configuration session
   ```typescript
   Input: { type: 'MAGNETIC_TRACK' | 'LED_STRIP', customerId? }
   Output: { sessionId, sessionToken, expiresAt }
   ```

2. **AddComponent** — Add component to session
   ```typescript
   Input: { sessionToken, componentType, quantity, properties? }
   Validates: Compatibility rules, component exists, max quantity
   ```

3. **RemoveComponent** — Remove component from session
   ```typescript
   Input: { sessionToken, itemId }
   ```

4. **UpdateComponent** — Update item quantity/properties
   ```typescript
   Input: { sessionToken, itemId, quantity?, properties? }
   Validates: Compatibility after update
   ```

5. **ValidateConfiguration** — Run full compatibility check
   ```typescript
   Output: { isValid, violations[], suggestions[], errorCount, warningCount }
   ```

6. **CalculateConfigurationPrice** — Calculate with discounts
   ```typescript
   Output: { subtotal, volumeDiscount, tierDiscount, total, breakdown[] }
   Uses: Pricing module for tier discounts
   ```

7. **CompleteConfiguration** — Mark as complete
   ```typescript
   Validates: Must pass all checks
   Publishes: 'configuration.completed' event
   ```

8. **ConvertToQuote** — Convert to quotation
   ```typescript
   Publishes: 'configuration.convert_to_quote' event for quotations module
   ```

9. **GetSession** — Retrieve session by token
10. **ListSessions** — Paginated customer sessions
11. **GetCatalog** — Available components with stock status

**Ports (External Dependencies):**
- `IPricingPort` — Get customer tier discount from pricing module
- `IInventoryPort` — Check stock availability

### Infrastructure Layer (`src/infrastructure/`)

**Repositories (TypeORM implementations):**
- `TypeOrmSessionRepository`
- `TypeOrmRuleRepository`
- `TypeOrmCatalogRepository`

**Mappers:**
- `SessionMapper` — Domain ↔ ORM entity
- `ItemMapper` — Domain ↔ ORM entity

**Jobs (BullMQ):**
- `SessionCleanupJob` — Hourly cleanup of expired sessions
- `CatalogSyncJob` — 4-hourly sync of component prices from pricing module

### API Layer (`src/api/`)

**Endpoints:**

```
POST   /api/v1/configurators/sessions
GET    /api/v1/configurators/sessions/:token
POST   /api/v1/configurators/sessions/:token/items
PUT    /api/v1/configurators/sessions/:token/items/:itemId
DELETE /api/v1/configurators/sessions/:token/items/:itemId
POST   /api/v1/configurators/sessions/:token/validate
POST   /api/v1/configurators/sessions/:token/price
POST   /api/v1/configurators/sessions/:token/complete
POST   /api/v1/configurators/sessions/:token/convert-to-quote
GET    /api/v1/configurators/catalog/:type
GET    /api/v1/configurators/my-sessions
GET    /api/v1/configurators/rules (admin)
POST   /api/v1/configurators/rules (admin)
PUT    /api/v1/configurators/rules/:id (admin)
```

## Compatibility Rules

### Magnetic Track System Rules

1. **TRACK_2M requires POWER_SUPPLY**
   - Every track needs a power supply

2. **SPOT_LED max 8 per track**
   - Maximum 8 light spots per 2m track

3. **CONNECTOR_* matching constraints**
   - L/T/X connectors must match track type

### LED Strip System Rules

1. **LED_STRIP_* requires CONTROLLER**
   - Every 10m of strip needs 1 controller

2. **POWER_ADAPTER wattage constraint**
   - Total power draw cannot exceed adapter capacity

3. **PROFILE and DIFFUSER compatibility**
   - Certain profiles require specific diffusers

## Module Dependencies

```
configurators
├── pricing-engine (for tier discounts)
└── inventory (for stock availability)
```

## Published Events

- `configuration.completed` — Session completed, ready for quote conversion
- `configuration.convert_to_quote` — Quote created from configuration

## Subscribed Events

- `pricing.updated` — Invalidate component price cache
- `inventory.stock_changed` — Update component availability

## Testing

### Domain Tests

- `ConfiguratorSession.test.ts` — Session lifecycle, item management, validation
- `CompatibilityRule.test.ts` — Rule evaluation for all rule types
- `CompatibilityEngine.test.ts` — Multi-rule validation with magnetic track and LED strip rules

### Application Tests

- `CreateSession.test.ts` — Session creation with/without customer
- `AddComponent.test.ts` — Success, incompatible components, max quantity exceeded
- `ValidateConfiguration.test.ts` — Valid configs, violations, suggestions
- `CalculateConfigurationPrice.test.ts` — Component prices, volume discount, tier discount
- `CompleteConfiguration.test.ts` — Success, invalid config rejected
- `ConvertToQuote.test.ts` — Quote creation, event publishing

## Key Features

### Single Responsibility

Each use-case handles exactly one business operation:
- Session lifecycle is separate from pricing
- Validation is separate from completion
- Quote conversion is separate from configuration

### Rich Domain Entities

- `ConfiguratorSession` encapsulates configuration rules
- `CompatibilityRule` knows how to evaluate itself
- `ComponentCatalog` manages pricing logic
- `PriceCalculationService` handles discounts

### Hexagonal Architecture

- Domain layer has no external dependencies
- Application uses repositories (ports) not concrete implementations
- Infrastructure provides adapters for external services

### Feature Flags

Module can be disabled via `enable_configurators` flag

### Event-Driven

- Configuration completion triggers event for downstream systems
- Price updates invalidate cache via events
- Stock changes update component availability

## Performance Considerations

- Sessions expire after 24 hours (automatic cleanup)
- Compatibility rules evaluated in-memory
- Component pricing cached and updated via events
- Price calculations with volume discounts
- Paginated session list for large customer histories

## Error Handling

All errors extend `BaseError` with:
- Machine-readable error codes
- HTTP status codes
- Operational flag for logging
- Localized messages (English/Romanian)

## Configuration

Via environment variables:
- `CONFIGURATOR_SESSION_TTL` — Session lifetime in hours (default: 24)
- `CONFIGURATOR_MAX_ITEMS` — Max items per session (default: 100)
- `CONFIGURATOR_PRICE_CACHE_TTL` — Price cache lifetime in seconds (default: 3600)
