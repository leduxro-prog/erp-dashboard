# Notifications Module

Enterprise-grade multi-channel notification system for CYPHER ERP. Sends email, SMS, WhatsApp, in-app, and push notifications with advanced features like template rendering, customer preferences, and automatic retries.

## Features

- **Multi-Channel Support**: Email, SMS, WhatsApp, In-App, Push
- **Template Engine**: Handlebars-based template rendering with variable validation
- **Customer Preferences**: Channel-specific notification settings with quiet hours
- **Batch Sending**: Send notifications to multiple recipients efficiently
- **Automatic Retries**: Exponential backoff with max 3 retries
- **Event-Driven**: Subscribes to domain events for automatic notifications
- **Status Tracking**: Complete notification lifecycle tracking (PENDING → SENT → DELIVERED)
- **Pagination**: Efficient history retrieval with cursor-based pagination

## Architecture

### Domain Layer

**Entities:**
- `Notification` - Core notification entity with status lifecycle and retry logic
- `NotificationTemplate` - Reusable templates with Handlebars rendering
- `NotificationPreference` - Customer settings per channel (enabled, quiet hours, frequency)
- `NotificationBatch` - Batch tracking with progress monitoring

**Services:**
- `NotificationDispatcher` - Routes notifications to appropriate channel providers
- `TemplateEngine` - Renders Handlebars templates and validates variables

**Repositories (Interfaces):**
- `INotificationRepository` - Notification persistence
- `ITemplateRepository` - Template management
- `IPreferenceRepository` - Customer preference storage

### Application Layer

**Use Cases:**
- `SendNotification` - Send single notification with preference checks
- `SendBulkNotification` - Bulk send to multiple recipients
- `ProcessNotificationQueue` - Pick pending notifications and dispatch
- `GetNotificationHistory` - Paginated customer history

**DTOs:**
- Request/response contracts for all endpoints
- Strongly-typed data transfer

**Ports:**
- `IEmailProvider` - Email sending interface
- `ISmsProvider` - SMS interface
- `IWhatsAppProvider` - WhatsApp API interface
- `IPushProvider` - Web/mobile push interface

### Infrastructure Layer

**Repositories:**
- `TypeOrmNotificationRepository` - Database access with caching
- `TypeOrmTemplateRepository` - Template persistence
- `TypeOrmPreferenceRepository` - Preference storage

**Providers:**
- `NodemailerEmailProvider` - SMTP email via Nodemailer
- `TwilioSmsProvider` - SMS via Twilio (stub ready for implementation)
- `WhatsAppBusinessProvider` - WhatsApp Business API
- `WebPushProvider` - Browser push notifications

**Other:**
- `NotificationsCompositionRoot` - Dependency injection setup
- TypeORM entities for database mapping

### API Layer

**Endpoints:**
- `POST /api/v1/notifications/send` - Send notification
- `POST /api/v1/notifications/bulk` - Bulk send
- `GET /api/v1/notifications/history` - Get history
- `GET /api/v1/notifications/:id` - Get detail
- `POST /api/v1/notifications/:id/retry` - Retry failed
- `GET /api/v1/notifications/stats` - Statistics
- `GET/POST/PUT/DELETE /api/v1/notifications/templates` - Template CRUD
- `GET/PUT /api/v1/notifications/preferences` - Manage preferences
- `GET /api/v1/notifications/batches/:id` - Batch status

## Database Schema

```sql
-- Main notification table
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  type ENUM (EMAIL|SMS|WHATSAPP|IN_APP|PUSH),
  channel ENUM (EMAIL|SMS|WHATSAPP|IN_APP|PUSH),
  recipient_id VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  subject VARCHAR(255),
  body TEXT,
  template_id UUID,
  template_data JSONB,
  status ENUM (PENDING|QUEUED|SENDING|SENT|DELIVERED|FAILED|BOUNCED),
  priority ENUM (LOW|NORMAL|HIGH|URGENT),
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,
  retry_count INT DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  channel ENUM (EMAIL|SMS|WHATSAPP|IN_APP|PUSH),
  subject TEXT,
  body TEXT,
  locale VARCHAR(5),
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_by UUID,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(slug, locale)
);

-- Preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
  customer_id VARCHAR(255),
  channel ENUM (EMAIL|SMS|WHATSAPP|IN_APP|PUSH),
  is_enabled BOOLEAN DEFAULT true,
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  frequency ENUM (IMMEDIATE|DAILY_DIGEST|WEEKLY_DIGEST),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, channel)
);

-- Batches
CREATE TABLE notification_batches (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  notifications UUID[],
  status ENUM (PENDING|PROCESSING|COMPLETED|FAILED|CANCELLED),
  total_count INT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration

Set environment variables for channel providers:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@cyphererp.com
SMTP_FROM_NAME=CYPHER ERP

# Twilio SMS
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890

# WhatsApp Business API
WHATSAPP_PHONE_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-access-token

# Web Push (VAPID keys)
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

## Event Subscriptions

The module subscribes to domain events and sends notifications:

- `order.created` → Order confirmation email
- `order.shipped` → Shipment notification (SMS + Email)
- `order.delivered` → Delivery confirmation
- `quote.sent` → Quote notification with link
- `quote.expiring` → Expiration reminder
- `inventory.low_stock` → Low stock alert (admin)
- `b2b.registration` → B2B registration confirmation

## Published Events

- `notification.created` - New notification created
- `notification.queued` - Notification queued for sending
- `notification.sent` - Successfully sent
- `notification.delivered` - Delivered to recipient
- `notification.failed` - Delivery failed
- `notification.expired` - Notification expired (24+ hours)

## Example Usage

### Send Single Notification

```typescript
const useCase = compositionRoot.getSendNotificationUseCase();
const result = await useCase.execute({
  recipientId: 'customer-123',
  recipientEmail: 'customer@example.com',
  channel: 'EMAIL',
  templateSlug: 'order-confirmation',
  templateData: {
    orderNumber: '12345',
    totalAmount: '$99.99',
    customerName: 'John Doe',
  },
  priority: 'HIGH',
});
```

### Send Bulk Notification

```typescript
const useCase = compositionRoot.getSendBulkNotificationUseCase();
const result = await useCase.execute({
  recipientIds: ['cust-1', 'cust-2', 'cust-3'],
  channel: 'EMAIL',
  templateSlug: 'promotional-offer',
  templateData: {
    discount: '20%',
    validUntil: '2024-12-31',
  },
  batchName: 'Holiday Promotion',
});
```

### Process Queue

```typescript
const useCase = compositionRoot.getProcessQueueUseCase();
const stats = await useCase.execute(100); // Process 100 notifications
console.log(`Sent: ${stats.sent}, Failed: ${stats.failed}`);
```

## Testing

### Unit Tests

```bash
npm test -- tests/domain/Notification.test.ts
npm test -- tests/domain/NotificationTemplate.test.ts
npm test -- tests/application/SendNotification.test.ts
```

### Integration Tests

```bash
npm test -- tests/integration --runInBand
```

## Production Considerations

1. **Queue Processing**: Use BullMQ for background job processing
2. **Scalability**: Implement provider connection pooling
3. **Monitoring**: Track metrics per channel and error rates
4. **Rate Limiting**: Implement per-customer rate limits
5. **Delivery Webhooks**: Handle provider delivery confirmations
6. **Cleanup**: Daily job to delete notifications older than 90 days

## Dependencies

- `typeorm` - ORM for database access
- `handlebars` - Template rendering
- `winston` - Structured logging
- `nodemailer` - Email sending
- `web-push` - Browser push notifications
- `twilio` - SMS provider (optional)
- `express` - API framework

## License

Proprietary - CYPHER ERP
