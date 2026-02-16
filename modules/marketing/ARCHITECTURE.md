# Marketing Module Architecture

## Overview

The Marketing Module is built using **Hexagonal Architecture** (Ports & Adapters) with **Domain-Driven Design** principles. This ensures loose coupling, testability, and maintainability.

## Directory Structure

```
modules/marketing/
├── src/
│   ├── domain/
│   │   ├── entities/           # Rich domain entities
│   │   │   ├── Campaign.ts             # Campaign aggregate root
│   │   │   ├── DiscountCode.ts         # Discount code entity
│   │   │   ├── EmailSequence.ts        # Email sequence entity
│   │   │   ├── EmailSequenceStep.ts    # Email step value object
│   │   │   └── MarketingEvent.ts       # Marketing event value object
│   │   ├── repositories/       # Repository interfaces (ports)
│   │   │   ├── ICampaignRepository.ts
│   │   │   ├── IDiscountCodeRepository.ts
│   │   │   ├── ISequenceRepository.ts
│   │   │   └── IMarketingEventRepository.ts
│   │   ├── services/           # Domain services (SRP)
│   │   │   ├── AudienceSegmentationService.ts
│   │   │   └── DiscountCalculationService.ts
│   │   └── errors/             # Domain-specific errors
│   │       └── marketing.errors.ts
│   │
│   ├── application/
│   │   ├── use-cases/          # Application use-cases
│   │   │   ├── CreateCampaign.ts
│   │   │   ├── ActivateCampaign.ts
│   │   │   ├── ValidateDiscountCode.ts
│   │   │   ├── ApplyDiscountCode.ts
│   │   │   ├── CreateDiscountCode.ts
│   │   │   ├── GenerateDiscountCodes.ts
│   │   │   └── GetCampaignAnalytics.ts
│   │   └── ports/              # Outbound ports (adapters)
│   │       ├── INotificationPort.ts    # Send emails
│   │       ├── ICustomerPort.ts        # Query customers
│   │       └── IOrderPort.ts           # Query orders
│   │
│   ├── infrastructure/
│   │   ├── composition-root.ts # DI container & factory
│   │   ├── entities/           # TypeORM entities (TODO)
│   │   ├── repositories/       # TypeORM repositories (TODO)
│   │   ├── jobs/               # Background jobs (TODO)
│   │   │   ├── SequenceProcessorJob.ts
│   │   │   ├── CampaignExpirationJob.ts
│   │   │   ├── CodeCleanupJob.ts
│   │   │   └── AnalyticsAggregationJob.ts
│   │   └── adapters/           # Port implementations (TODO)
│   │       ├── NotificationAdapter.ts
│   │       ├── CustomerAdapter.ts
│   │       └── OrderAdapter.ts
│   │
│   ├── api/
│   │   ├── controllers/        # HTTP controllers (TODO)
│   │   ├── routes/             # Express routes (TODO)
│   │   ├── dto/                # Data transfer objects (TODO)
│   │   └── middleware/         # Express middleware (TODO)
│   │
│   └── marketing-module.ts     # Module implementation (ICypherModule)
│
├── tests/
│   ├── domain/                 # Domain entity & service tests
│   │   ├── Campaign.test.ts
│   │   ├── DiscountCode.test.ts
│   │   └── EmailSequence.test.ts
│   ├── application/            # Use-case tests
│   │   ├── CreateCampaign.test.ts
│   │   ├── ValidateDiscountCode.test.ts
│   │   ├── ApplyDiscountCode.test.ts
│   │   ├── ProcessSequenceTrigger.test.ts
│   │   └── GetCampaignAnalytics.test.ts
│   └── infrastructure/         # Repository & adapter tests (TODO)
│       └── Repositories.test.ts
│
├── README.md                   # Module documentation
├── ARCHITECTURE.md             # This file
├── package.json                # NPM package configuration
└── jest.config.js              # Jest testing configuration (TODO)
```

## Layer Responsibilities

### Domain Layer

**Purpose**: Core business logic independent of technology

**Components**:
- **Entities** (Aggregates): Campaign, DiscountCode, EmailSequence
  - Encapsulate business logic
  - Handle invariants and rules
  - Rich methods for domain operations
  - No database/framework dependencies

- **Value Objects**: EmailSequenceStep, MarketingEvent
  - Immutable data holders
  - Identity by value, not reference

- **Repositories** (Ports): ICampaignRepository, IDiscountCodeRepository, etc.
  - Define contracts for data persistence
  - Implementation-agnostic
  - Located in domain (outbound ports)

- **Domain Services**: AudienceSegmentationService, DiscountCalculationService
  - Encapsulate complex business logic
  - Operate on entities/value objects
  - Implement SRP (single responsibility)

- **Errors**: Custom exceptions for business rule violations
  - Domain-specific error types
  - Extend BaseError
  - Immutable error information

**Key Principle**: Domain layer has ZERO dependencies on external frameworks

### Application Layer

**Purpose**: Use-case orchestration and application-specific logic

**Components**:
- **Use-Cases**: CreateCampaign, ActivateCampaign, ApplyDiscountCode, etc.
  - One use-case per file (SRP)
  - Orchestrate domain entities and services
  - Handle cross-cutting concerns (validation, events)
  - Return rich DTOs with metadata

- **Ports** (Outbound): INotificationPort, ICustomerPort, IOrderPort
  - Define contracts for external integrations
  - Implemented by external modules or adapters
  - Used for dependency injection

**Key Principle**: Application knows about domain but not infrastructure

### Infrastructure Layer

**Purpose**: Technical implementation details

**Components**:
- **Composition Root**: Dependency injection setup
  - Creates all service instances
  - Wires dependencies
  - Factory methods for use-cases

- **TypeORM Repositories**: Repository implementations
  - Implement domain repository interfaces
  - Handle database queries
  - Map entities to/from database

- **Background Jobs**: Async task processors
  - SequenceProcessorJob: Process email sequences hourly
  - CampaignExpirationJob: Auto-complete expired campaigns daily
  - CodeCleanupJob: Deactivate expired codes daily
  - AnalyticsAggregationJob: Aggregate metrics every 6 hours

- **Adapters**: Inbound/outbound port implementations
  - Implement external port contracts
  - Adapt external API to internal interfaces

**Key Principle**: Infrastructure implements domain/application interfaces

### API Layer

**Purpose**: HTTP REST interface

**Components**:
- **Controllers**: Handle HTTP requests/responses
- **Routes**: Express routing definitions
- **DTOs**: Data transfer objects for API requests/responses
- **Middleware**: Cross-cutting HTTP concerns (auth, logging, etc.)

**Key Principle**: Controllers delegate to use-cases

## Data Flow Examples

### Apply Discount Code Flow

```
HTTP Request
  ↓
ApplyDiscountCodeController
  ↓ (creates ApplyDiscountCodeInput)
ApplyDiscountCode Use-Case
  ├─ Finds code via IDiscountCodeRepository
  ├─ Calls DiscountCalculationService.applyCode()
  ├─ Updates code usage via repository
  ├─ Creates MarketingEvent
  └─ Returns ApplyDiscountCodeOutput
  ↓
Controller maps to DTO
  ↓
HTTP Response
```

### Campaign Activation Flow

```
HTTP Request
  ↓
ActivateCampaignController
  ↓ (creates ActivateCampaignInput)
ActivateCampaign Use-Case
  ├─ Finds campaign via ICampaignRepository
  ├─ Calls campaign.activate() (domain logic)
  ├─ Optionally activates discount codes
  ├─ Optionally activates email sequences
  ├─ Publishes marketing.campaign_activated event
  └─ Returns ActivateCampaignOutput
  ↓
HTTP Response
```

### Audience Segmentation Flow

```
Customer Event (order.completed)
  ↓
Event Handler in marketing-module.ts
  ↓
Retrieves customers via ICustomerPort
  ↓
Calls AudienceSegmentationService.segment(customers, filter)
  ├─ Filters by tier
  ├─ Filters by purchase history
  ├─ Filters by tags
  └─ Returns matching customer IDs
  ↓
Returns segmented audience
```

## Dependency Injection

The composition root (`MarketingCompositionRoot`) handles all dependency wiring:

```typescript
// Composition root creates and wires dependencies
const root = new MarketingCompositionRoot(config);

// Access use-cases through root
const createCampaignUC = root.getCreateCampaignUseCase();
const applyCodeUC = root.getApplyDiscountCodeUseCase();

// Use-cases are fully wired and ready
await createCampaignUC.execute(input);
```

**No ServiceLocator pattern**: Dependencies passed explicitly to constructors.

## Testing Strategy

### Domain Tests (Unit)
- Test entity methods in isolation
- Test domain service logic
- Test error conditions
- No database, no external services

### Application Tests (Unit)
- Test use-case logic
- Mock repositories
- Test error handling
- Test orchestration logic

### Infrastructure Tests (Integration)
- Test repository implementations
- Test database queries
- Test external service adapters
- Test job processors

## Error Handling

Custom error hierarchy with domain-specific errors:

```typescript
BaseError (abstract)
├── NotFoundError (404)
│   ├── CampaignNotFoundError
│   └── DiscountCodeNotFoundError
├── ValidationError (400)
│   └── InvalidDiscountCodeError
├── ConflictError (409)
│   └── DuplicateCodeError
├── BusinessRuleError (422)
│   ├── DiscountCodeExpiredError
│   ├── CampaignAlreadyActiveError
│   ├── MinimumOrderNotMetError
│   └── BudgetExceededError
└── InternalServerError (500)
```

**Key Benefits**:
- Domain errors represent business rule violations
- HTTP status codes derived from error types
- Proper error messages for users
- Error codes for programmatic handling

## Event-Driven Architecture

### Published Events
- `marketing.discount_applied`: Code applied to order
- `marketing.campaign_activated`: Campaign started
- `marketing.email_sent`: Sequence step sent

### Subscribed Events
- `order.completed`: Track conversions
- `customer.registered`: Enroll in sequences
- `cart.abandoned`: Send recovery emails

**Implementation**: Events published via IEventBus in use-cases and background jobs.

## Performance Considerations

### Caching
- Discount codes cached by code string
- Campaign IDs cached for active campaigns
- Customer segment results cached (short TTL)

### Async Operations
- Email sending via message queue (BullMQ)
- Analytics aggregation as background job
- Code generation batched

### Database Queries
- Indexed on code, campaign_id, status
- Paginated listing queries
- Event aggregation using group-by

## Scalability

### Horizontal Scaling
- Stateless use-cases and services
- Background jobs can run on multiple workers
- Database handles concurrent access

### Vertical Scaling
- In-memory caching reduces DB queries
- Lazy loading of sequences/metrics
- Batch operations for bulk tasks

## Security Considerations

- Discount code validation includes:
  - Minimum order amount checks
  - Usage limit enforcement
  - Per-customer limit checks
  - Expiration validation

- Campaign data:
  - Audience filters validated
  - Budget constraints enforced
  - Audit trail via created_by fields

- API layer (TODO):
  - Authentication/authorization middleware
  - Input validation and sanitization
  - Rate limiting on sensitive endpoints
  - CORS configuration

## Future Enhancements

1. **Persistence Layer**: Implement TypeORM repositories
2. **API Layer**: Express controllers and routes
3. **Background Jobs**: BullMQ job implementations
4. **Adapters**: Notification, customer, order adapters
5. **Advanced Features**:
   - A/B testing for campaigns
   - ML-based audience segmentation
   - Predictive analytics
   - Multi-language email templates
   - SMS and WhatsApp support

## Code Quality

**Standards**:
- Full TypeScript (no `any` types)
- Comprehensive JSDoc comments
- Unit test coverage > 80%
- Integration tests for critical flows
- ESLint & Prettier for code style

**Patterns**:
- Rich domain entities
- Single Responsibility Principle
- Dependency Injection
- Factory pattern (composition root)
- Value Objects (immutable)
- Repository pattern
- Use-case pattern
