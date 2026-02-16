# WhatsApp Integration Module - Architecture

## Overview

The WhatsApp Integration Module implements hexagonal (ports and adapters) architecture to integrate the Cypher ERP system with Meta's WhatsApp Business API. This module enables automated customer notifications (order confirmations, shipments, deliveries) and customer support conversations.

## Module Structure

```
whatsapp/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── WhatsAppMessage.ts
│   │   │   ├── WhatsAppConversation.ts
│   │   │   ├── WhatsAppTemplate.ts
│   │   │   └── WhatsAppWebhookEvent.ts
│   │   ├── repositories/
│   │   │   ├── IMessageRepository.ts
│   │   │   ├── IConversationRepository.ts
│   │   │   ├── ITemplateRepository.ts
│   │   │   └── IWebhookRepository.ts
│   │   ├── ports/
│   │   │   ├── IWhatsAppBusinessApi.ts
│   │   │   ├── ICustomerPort.ts
│   │   │   └── IOrderPort.ts
│   │   ├── services/
│   │   │   ├── MessageFormatter.ts
│   │   │   └── ConversationManager.ts
│   │   └── errors/
│   │       └── whatsapp.errors.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── SendMessage.ts
│   │   │   ├── SendTemplateMessage.ts
│   │   │   ├── ProcessIncomingMessage.ts
│   │   │   ├── ProcessWebhook.ts
│   │   │   ├── GetConversations.ts
│   │   │   ├── GetConversationMessages.ts
│   │   │   ├── AssignConversation.ts
│   │   │   ├── ResolveConversation.ts
│   │   │   ├── ManageTemplates.ts
│   │   │   ├── SendOrderNotification.ts
│   │   │   ├── SendSupplierOrderMessage.ts
│   │   │   └── GetMessageStats.ts
│   │   └── dto/
│   │       ├── request.dto.ts
│   │       └── response.dto.ts
│   ├── infrastructure/
│   │   ├── entities/
│   │   │   ├── WhatsAppMessageEntity.ts
│   │   │   ├── WhatsAppConversationEntity.ts
│   │   │   ├── WhatsAppTemplateEntity.ts
│   │   │   └── WhatsAppWebhookEventEntity.ts
│   │   ├── repositories/
│   │   │   ├── TypeOrmMessageRepository.ts
│   │   │   ├── TypeOrmConversationRepository.ts
│   │   │   ├── TypeOrmTemplateRepository.ts
│   │   │   └── TypeOrmWebhookRepository.ts
│   │   ├── external/
│   │   │   └── WhatsAppBusinessApiClient.ts
│   │   ├── jobs/
│   │   │   ├── MessageProcessorJob.ts
│   │   │   ├── ConversationArchiveJob.ts
│   │   │   ├── TemplateStatusSyncJob.ts
│   │   │   └── SlaMonitorJob.ts
│   │   └── mappers/
│   │       ├── MessageMapper.ts
│   │       └── ConversationMapper.ts
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── MessageController.ts
│   │   │   ├── ConversationController.ts
│   │   │   ├── TemplateController.ts
│   │   │   ├── WebhookController.ts
│   │   │   └── StatsController.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── webhookValidation.middleware.ts
│   │   │   └── errorHandler.middleware.ts
│   │   ├── routes/
│   │   │   ├── messages.routes.ts
│   │   │   ├── conversations.routes.ts
│   │   │   ├── templates.routes.ts
│   │   │   ├── webhooks.routes.ts
│   │   │   └── stats.routes.ts
│   │   └── composition-root.ts
│   └── whatsapp-module.ts
├── tests/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── WhatsAppMessage.test.ts
│   │   │   ├── WhatsAppConversation.test.ts
│   │   │   ├── WhatsAppTemplate.test.ts
│   │   │   └── WhatsAppWebhookEvent.test.ts
│   │   ├── services/
│   │   │   ├── MessageFormatter.test.ts
│   │   │   └── ConversationManager.test.ts
│   │   └── repositories/
│   ├── application/
│   │   └── use-cases/
│   │       ├── SendMessage.test.ts
│   │       ├── SendTemplateMessage.test.ts
│   │       ├── ProcessIncomingMessage.test.ts
│   │       ├── ProcessWebhook.test.ts
│   │       └── GetConversations.test.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   ├── external/
│   │   └── jobs/
│   └── integration/
│       └── api.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.json
└── ARCHITECTURE.md
```

## Layered Architecture

### 1. Domain Layer (`src/domain/`)

Pure business logic with zero external dependencies.

#### Entities
- **WhatsAppMessage**: Core message entity with lifecycle management
  - Status tracking: PENDING → SENT → DELIVERED → READ
  - Retry logic for failed messages (max 3 retries, 24-hour expiration)
  - Immutable properties for historical record
  - Methods: `markSent()`, `markDelivered()`, `markRead()`, `markFailed()`, `canRetry()`, `isExpired()`, `getDisplayContent()`

- **WhatsAppConversation**: Conversation thread with agent assignment
  - Status tracking: OPEN → ASSIGNED → RESOLVED → ARCHIVED
  - Message counter and unread tracking
  - Support for prioritization and tagging
  - SLA monitoring via `ConversationManager`
  - Methods: `assign()`, `resolve()`, `reopen()`, `archive()`, `addMessage()`, `markRead()`, `addTag()`, `removeTag()`, `setPriority()`, `setCustomerId()`, `isActive()`

- **WhatsAppTemplate**: Pre-approved message templates
  - Status: PENDING → APPROVED/REJECTED
  - Template rendering with {{1}}, {{2}} placeholders
  - Validation of template structure
  - Parameter extraction and validation
  - Methods: `render()`, `validate()`, `isApproved()`, `markSubmitted()`, `markApproved()`, `markRejected()`, `getRequiredParams()`

- **WhatsAppWebhookEvent**: Incoming webhook event handling
  - Idempotent processing via idempotency key (Meta's message_id)
  - Status tracking: pending → processed/failed
  - Payload parsing with dot-notation access
  - Methods: `isProcessed()`, `markProcessed()`, `markFailed()`, `getStatus()`, `getPayloadValue()`

#### Repository Interfaces (Ports)
- **IMessageRepository**: Message persistence operations
- **IConversationRepository**: Conversation persistence operations
- **ITemplateRepository**: Template persistence operations
- **IWebhookRepository**: Webhook event persistence with deduplication

#### Port Interfaces (External Dependencies)
- **IWhatsAppBusinessApi**: Meta WhatsApp Business API integration
  - Methods: `sendTextMessage()`, `sendTemplateMessage()`, `sendMediaMessage()`, `getTemplateStatus()`, `markMessageRead()`, `uploadMedia()`, `healthCheck()`
  - Rate limiting: 80 messages/second
  - Retry handling and circuit breaker

- **ICustomerPort**: Customer lookup (inter-module dependency)
  - Methods: `findByPhone()`, `findById()`, `findByEmail()`

- **IOrderPort**: Order lookup (inter-module dependency)
  - Methods: `findById()`, `findByCustomerId()`, `findByStatus()`

#### Domain Services
- **MessageFormatter**: Formats messages with Romanian localization
  - Methods: `formatOrderConfirmation()`, `formatOrderShipped()`, `formatOrderDelivered()`, `formatSupplierOrderConfirmation()`, `formatNotification()`

- **ConversationManager**: SLA management and agent assignment
  - SLA tracking: 2-hour response time, 24-hour idle threshold
  - Methods: `checkSLAStatus()`, `getMinutesUntilBreach()`, `shouldAutoClose()`, `calculateEscalationPriority()`, `suggestAgent()`

#### Custom Errors
All extend `BaseError` for consistent handling:
- `MessageNotDeliverableError`: Business rule violation
- `TemplateNotApprovedError`: Template not ready for use
- `ConversationClosedError`: Conversation not open
- `InvalidPhoneError`: Phone format validation
- `WebhookValidationError`: HMAC signature validation
- `RateLimitExceededError`: API rate limit
- `MediaTooLargeError`: File size validation
- `TemplateValidationError`: Template structure validation
- `MessageSendError`: API send failure
- `WebhookProcessingError`: Webhook handling failure

### 2. Application Layer (`src/application/`)

Use-cases orchestrating domain entities and repositories.

#### Use-Cases

**Message Operations**
- `SendMessage`: Send text message, create/update conversation
- `SendTemplateMessage`: Send approved template with parameter validation
- `SendOrderNotification`: Triggered by order events (confirmed/shipped/delivered)
- `SendSupplierOrderMessage`: Generate and send supplier order messages

**Conversation Management**
- `GetConversations`: Paginated list with filtering and search
- `GetConversationMessages`: Cursor-paginated message history
- `AssignConversation`: Assign to support agent with validation
- `ResolveConversation`: Mark resolved, auto-archive after 7 days

**Template Management**
- `ManageTemplates`: CRUD operations
- `SubmitTemplateForApproval`: Submit to Meta for approval
- `SyncTemplateStatus`: Check approval status from Meta

**Webhook Processing**
- `ProcessWebhook`: Idempotent incoming webhook handler
- `ProcessIncomingMessage`: Handle incoming messages from customer

**Analytics**
- `GetMessageStats`: Message counts, delivery rates, response times

Each use-case:
- Validates input DTOs
- Enforces business rules
- Logs operations
- Publishes domain events
- Has comprehensive error handling
- Returns response DTOs

### 3. Infrastructure Layer (`src/infrastructure/`)

Implementation of repositories and external services.

#### Repositories (TypeORM)
- `TypeOrmMessageRepository`: Implements `IMessageRepository`
- `TypeOrmConversationRepository`: Implements `IConversationRepository`
- `TypeOrmTemplateRepository`: Implements `ITemplateRepository`
- `TypeOrmWebhookRepository`: Implements `IWebhookRepository` with deduplication

#### External API Client
- `WhatsAppBusinessApiClient`: Implements `IWhatsAppBusinessApi`
  - Handles token authentication
  - Implements rate limiting (80 msg/sec, circuit breaker)
  - HMAC SHA256 webhook signature validation
  - Media upload/download support
  - Retry logic with exponential backoff
  - Comprehensive error handling

#### Background Jobs (BullMQ)
- `MessageProcessorJob`:
  - Processes outgoing queue
  - Concurrency: 10 workers
  - Respects API rate limits
  - Auto-retries with exponential backoff

- `ConversationArchiveJob`:
  - Scheduled daily at 01:00
  - Archives resolved conversations older than 7 days

- `TemplateStatusSyncJob`:
  - Scheduled every 6 hours
  - Syncs template approval status from Meta

- `SlaMonitorJob`:
  - Scheduled every 15 minutes
  - Monitors SLA breaches
  - Escalates conversations with responses overdue

#### Entity Mappers
- `MessageMapper`: Domain ↔ Infrastructure entity
- `ConversationMapper`: Domain ↔ Infrastructure entity

### 4. API Layer (`src/api/`)

HTTP REST endpoints and request/response handling.

#### Controllers
- `MessageController`: POST /messages/send, /messages/template
- `ConversationController`: GET conversations, POST assign, POST resolve
- `TemplateController`: CRUD operations
- `WebhookController`: POST /webhook (incoming), GET /webhook (verify)
- `StatsController`: GET /stats

#### Middleware
- `auth.middleware`: JWT validation (user, admin roles)
- `webhookValidation.middleware`: HMAC signature verification
- `errorHandler.middleware`: Consistent error responses

#### Routes
All routes prefix with `/api/v1/whatsapp/`

#### Composition Root
Dependency injection configuration:
- Instantiate repositories
- Configure external services
- Wire use-cases
- Mount routes

## Event Flow

### Outgoing Messages
1. User calls POST /messages/send
2. `SendMessage` use-case validates and queues message
3. BullMQ job processes queue
4. `WhatsAppBusinessApiClient` sends via Meta API
5. Update message status on callback
6. Publish `whatsapp.message_sent` event

### Incoming Messages
1. Webhook callback from Meta with signature validation
2. Deduplication via idempotency key
3. `ProcessIncomingMessage` creates/updates conversation
4. Auto-reply if configured
5. Publish `whatsapp.message_received` event

### Order Notifications
1. Order domain publishes `order.confirmed`, `order.shipped`, `order.delivered`
2. Module subscribes and executes `SendOrderNotification`
3. `MessageFormatter` generates localized template message
4. Message queued and sent via background job

## Idempotency & Deduplication

### Webhook Idempotency
- Every webhook has `idempotencyKey` from Meta (message_id)
- Database checks before processing
- Returns success even if already processed
- Prevents duplicate message handling

### Message Retry
- Failed messages stored with retry count
- Max 3 retries over 24 hours
- Exponential backoff with circuit breaker
- Automatic status updates

## Rate Limiting

**WhatsApp API**: 80 messages/second
- BullMQ job respects this limit
- Circuit breaker on 429 responses
- `RateLimitExceededError` thrown with retry-after

## Database Schema Integration

Uses existing `whatsapp_messages` table from schema.sql:
```sql
CREATE TABLE whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id),
  user_id BIGINT REFERENCES users(id),
  phone_number VARCHAR(20) NOT NULL,
  direction whatsapp_direction NOT NULL,    -- SENT | RECEIVED
  message_type whatsapp_message_type NOT NULL,
  message_text TEXT NOT NULL,
  order_id BIGINT REFERENCES orders(id),
  quote_id BIGINT REFERENCES quotes(id),
  external_message_id VARCHAR(255),
  delivery_status VARCHAR(50),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Additional tables created:
- `whatsapp_conversations`: Conversation threads
- `whatsapp_templates`: Pre-approved templates
- `whatsapp_webhook_events`: Webhook audit trail

## Feature Flags

Module controlled by feature flag: `enable_whatsapp_module`
- If disabled, module skipped during initialization
- Useful for gradual rollouts and A/B testing

## Dependencies

### Cypher ERP
- `notifications` module (required)
- `customers` module (via port)
- `orders` module (via port)

### External
- Meta WhatsApp Business API (v18.0+)
- PostgreSQL 15+ (database)
- Redis (caching, job queue)

## Error Handling

All errors inherit from `BaseError` with:
- Machine-readable `code`
- HTTP `statusCode`
- `isOperational` flag
- Consistent logging

Examples:
- `InvalidPhoneError` (400)
- `ConversationClosedError` (422)
- `TemplateNotApprovedError` (422)
- `RateLimitExceededError` (429)
- `MessageSendError` (5xx)

## Testing Strategy

### Domain Layer (70%+ coverage)
- Entity state transitions
- Business rule validation
- Error conditions
- Edge cases

### Application Layer (70%+ coverage)
- Use-case happy paths
- Input validation
- Repository interactions
- Event publishing
- Error propagation

### Infrastructure Layer (70%+ coverage)
- Repository CRUD operations
- External API client
- Job processing
- Error handling

### Integration Tests
- Full request/response cycles
- Middleware chain
- Dependency wiring
- Database integration

## Performance Considerations

- **Message Queue**: BullMQ with 10 concurrent workers
- **Rate Limiting**: Respects 80 msg/sec API limit
- **Caching**: Redis for conversation and template caching
- **Pagination**: Cursor-based for large result sets
- **Webhook**: Asynchronous processing with idempotency
- **Database Indexes**: Optimized for common queries

## Security

- HMAC SHA256 webhook signature validation
- JWT authentication for all endpoints (except webhook verify)
- Input validation on all user-provided data
- Phone number format validation
- Media size validation
- SQL injection prevention via TypeORM
- CSRF protection via framework middleware

## Logging & Observability

- Structured logging with Winston
- Log levels: debug, info, warn, error
- Operation tracing with request IDs
- Metrics collection (request count, error count, response times)
- Health checks on database and API connectivity
- Event metrics (published, received)

## Future Enhancements

1. **Message encryption** for sensitive data
2. **Message scheduling** for optimal delivery times
3. **A/B testing** for message variations
4. **Analytics dashboard** with real-time metrics
5. **Multi-language** template management
6. **Interactive buttons** in messages (quick replies)
7. **Document sharing** with WhatsApp-compatible formats
8. **Two-way conversations** with full conversation search
9. **Broadcast lists** for bulk messaging
10. **Integration** with AI for automated responses
