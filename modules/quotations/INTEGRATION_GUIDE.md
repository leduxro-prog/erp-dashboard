# Quotations Module Integration Guide

## Quick Start

### 1. Installation

```bash
npm install
npm run build
npm test
```

### 2. Database Setup (TypeORM)

```typescript
import { DataSource } from 'typeorm';
import { QuoteEntity } from './src/infrastructure/entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [QuoteEntity],
  synchronize: false,
  migrations: ['src/migrations/*.ts'],
});
```

### 3. Dependency Injection Setup

```typescript
import { Container } from 'inversify';
import { TypeOrmQuoteRepository } from './src/infrastructure/repositories';
import { PdfGenerator } from './src/infrastructure/pdf';
import { QuoteCache } from './src/infrastructure/cache';
import {
  CreateQuote,
  SendQuote,
  AcceptQuote,
  RejectQuote,
  ConvertToOrder,
  GenerateQuotePdf,
  ListQuotes,
  GetQuote,
} from './src/application/use-cases';
import {
  QUOTE_REPOSITORY_SYMBOL,
  QUOTE_PDF_GENERATOR_SYMBOL,
} from './src/domain';

const container = new Container();

// Register repositories
container
  .bind(QUOTE_REPOSITORY_SYMBOL)
  .toConstantValue(new TypeOrmQuoteRepository(AppDataSource.getRepository(QuoteEntity)));

// Register services
container
  .bind(QUOTE_PDF_GENERATOR_SYMBOL)
  .toConstantValue(new PdfGenerator());

// Register cache
container.bind(QuoteCache).toConstantValue(new QuoteCache(redisClient));

// Register use cases
container.bind(CreateQuote).toConstantValue(
  new CreateQuote(container.get(QUOTE_REPOSITORY_SYMBOL))
);

container.bind(SendQuote).toConstantValue(
  new SendQuote(
    container.get(QUOTE_REPOSITORY_SYMBOL),
    emailService,
    whatsappService
  )
);

container.bind(GenerateQuotePdf).toConstantValue(
  new GenerateQuotePdf(
    container.get(QUOTE_REPOSITORY_SYMBOL),
    container.get(QUOTE_PDF_GENERATOR_SYMBOL),
    companyDetailsProvider
  )
);

container.bind(ConvertToOrder).toConstantValue(
  new ConvertToOrder(
    container.get(QUOTE_REPOSITORY_SYMBOL),
    orderService,
    eventPublisher
  )
);

container.bind(ListQuotes).toConstantValue(
  new ListQuotes(container.get(QUOTE_REPOSITORY_SYMBOL))
);

container.bind(GetQuote).toConstantValue(
  new GetQuote(container.get(QUOTE_REPOSITORY_SYMBOL))
);
```

### 4. Express Router Setup

```typescript
import express from 'express';
import { QuotationController } from './src/api/controllers';
import { createQuotationRoutes } from './src/api/routes';

const app = express();

const quotationController = new QuotationController(
  container.get(CreateQuote),
  container.get(SendQuote),
  container.get(AcceptQuote),
  container.get(RejectQuote),
  container.get(ConvertToOrder),
  container.get(GenerateQuotePdf),
  container.get(ListQuotes),
  container.get(GetQuote),
  container.get(QuoteCache)
);

const quotesRouter = createQuotationRoutes(quotationController);
app.use('/api/v1', quotesRouter);
```

### 5. Scheduled Jobs Setup

```typescript
import { QuoteExpirationJob } from './src/infrastructure/jobs/QuoteExpirationJob';
import { QuoteReminderJob } from './src/infrastructure/jobs/QuoteReminderJob';
import { ExpireOverdueQuotes } from './src/application/use-cases/ExpireOverdueQuotes';
import { SendReminders } from './src/application/use-cases/SendReminders';

const redisConnection = { host: 'localhost', port: 6379 };

const expireQuotesUseCase = new ExpireOverdueQuotes(
  container.get(QUOTE_REPOSITORY_SYMBOL),
  logger
);

const expirationJob = new QuoteExpirationJob(
  expireQuotesUseCase,
  logger,
  redisConnection
);

await expirationJob.schedule();

const sendRemindersUseCase = new SendReminders(
  container.get(QUOTE_REPOSITORY_SYMBOL),
  reminderService,
  logger
);

const reminderJob = new QuoteReminderJob(
  sendRemindersUseCase,
  logger,
  redisConnection
);

await reminderJob.schedule();
```

## Interface Implementations

### Email Service

```typescript
import { IEmailService } from './src/application/use-cases/SendQuote';

export class EmailService implements IEmailService {
  async sendQuoteEmail(
    to: string,
    customerName: string,
    quoteNumber: string,
    validUntil: Date
  ): Promise<void> {
    // Send email via SendGrid, AWS SES, etc.
    await sendEmail({
      to,
      subject: `Quotation ${quoteNumber}`,
      template: 'quote-email',
      data: {
        customerName,
        quoteNumber,
        validUntil: validUntil.toLocaleDateString('ro-RO'),
        downloadLink: `https://yourapp.com/quotes/${quoteNumber}/pdf`,
      },
    });
  }
}
```

### WhatsApp Service

```typescript
import { IWhatsAppService } from './src/application/use-cases/SendQuote';

export class WhatsAppService implements IWhatsAppService {
  async sendQuoteMessage(
    phoneNumber: string,
    customerName: string,
    quoteNumber: string
  ): Promise<void> {
    // Send WhatsApp message via Twilio, MessageBird, etc.
    await sendWhatsAppMessage({
      to: phoneNumber,
      message: `Hi ${customerName}, your quotation ${quoteNumber} is ready. Download it here: https://yourapp.com/quotes/${quoteNumber}/pdf`,
    });
  }
}
```

### Order Service

```typescript
import { IOrderService } from './src/application/use-cases/ConvertToOrder';

export class OrderService implements IOrderService {
  async createOrder(orderData: any): Promise<any> {
    // Create order in your order module
    const order = new Order();
    order.quoteId = orderData.quoteId;
    order.customerId = orderData.customerId;
    order.items = orderData.items;
    order.grandTotal = orderData.grandTotal;
    order.status = 'pending';

    return await orderRepository.save(order);
  }
}
```

### Event Publisher

```typescript
import { IEventPublisher } from './src/application/use-cases/ConvertToOrder';

export class EventPublisher implements IEventPublisher {
  async publish(eventType: string, data: any): Promise<void> {
    // Publish to message broker (RabbitMQ, Kafka, etc.)
    await messageBroker.publish('quotations', {
      type: eventType,
      data,
      timestamp: new Date(),
    });
  }
}
```

### Company Details Provider

```typescript
import { ICompanyDetailsProvider } from './src/application/use-cases/GenerateQuotePdf';

export class CompanyDetailsProvider implements ICompanyDetailsProvider {
  async getCompanyDetails(): Promise<any> {
    // Fetch from settings/config
    return {
      name: 'Your Company Name',
      address: 'Str. Address 123, Bucharest, Romania',
      phone: '+40 123 456 789',
      email: 'info@company.com',
      taxId: 'RO123456789',
      logoUrl: 'https://cdn.example.com/logo.png',
    };
  }
}
```

### Reminder Service

```typescript
import { IReminderService } from './src/application/use-cases/SendReminders';

export class ReminderService implements IReminderService {
  async sendExpirationReminder(
    email: string,
    customerName: string,
    quoteNumber: string,
    daysLeft: number
  ): Promise<void> {
    await emailService.send({
      to: email,
      subject: `Reminder: Your quotation ${quoteNumber} expires in ${daysLeft} days`,
      template: 'quote-reminder',
      data: {
        customerName,
        quoteNumber,
        daysLeft,
      },
    });
  }
}
```

### Logger

```typescript
import { ILogger } from './src/application/use-cases/ExpireOverdueQuotes';

export class Logger implements ILogger {
  info(message: string, data?: any): void {
    console.log(`[INFO] ${message}`, data);
    // Or use Winston, Bunyan, etc.
  }

  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error);
  }
}
```

## API Usage Examples

### Create Quote

```bash
curl -X POST http://localhost:3000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-123",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "items": [
      {
        "productId": "prod-1",
        "sku": "SKU-001",
        "productName": "Product 1",
        "imageUrl": "https://cdn.example.com/prod1.jpg",
        "quantity": 2,
        "unitPrice": 100
      }
    ],
    "billingAddress": {
      "street": "Str. Test 1",
      "city": "Bucharest",
      "postcode": "010101",
      "country": "Romania"
    },
    "shippingAddress": {
      "street": "Str. Test 2",
      "city": "Bucharest",
      "postcode": "010102",
      "country": "Romania"
    },
    "paymentTerms": "Net 30",
    "deliveryEstimate": "5 business days",
    "discountPercentage": 10,
    "validityDays": 15,
    "notes": "Special pricing for bulk order",
    "createdBy": "user-1"
  }'
```

### Send Quote

```bash
curl -X POST http://localhost:3000/api/v1/quotes/{quoteId}/send \
  -H "Content-Type: application/json" \
  -d '{"sendWhatsApp": true}'
```

### Accept Quote

```bash
curl -X POST http://localhost:3000/api/v1/quotes/{quoteId}/accept
```

### Reject Quote

```bash
curl -X POST http://localhost:3000/api/v1/quotes/{quoteId}/reject \
  -H "Content-Type: application/json" \
  -d '{"reason": "Price too high"}'
```

### Convert to Order

```bash
curl -X POST http://localhost:3000/api/v1/quotes/{quoteId}/convert
```

### Download PDF

```bash
curl -X GET http://localhost:3000/api/v1/quotes/{quoteId}/pdf \
  -o quote.pdf
```

### List Quotes

```bash
curl "http://localhost:3000/api/v1/quotes?customerId=cust-123&status=sent&page=1&limit=10"
```

## Database Migration Example

```typescript
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateQuotesTable1704067200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'quotes',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'quoteNumber', type: 'varchar', isUnique: true },
          { name: 'customerId', type: 'uuid' },
          { name: 'customerName', type: 'varchar' },
          { name: 'customerEmail', type: 'varchar' },
          { name: 'status', type: 'enum', enum: ['pending', 'sent', 'accepted', 'expired', 'rejected'] },
          { name: 'items', type: 'jsonb' },
          { name: 'billingAddress', type: 'jsonb' },
          { name: 'shippingAddress', type: 'jsonb' },
          { name: 'subtotal', type: 'numeric' },
          { name: 'discountAmount', type: 'numeric' },
          { name: 'discountPercentage', type: 'numeric' },
          { name: 'taxRate', type: 'numeric' },
          { name: 'taxAmount', type: 'numeric' },
          { name: 'grandTotal', type: 'numeric' },
          { name: 'currency', type: 'varchar' },
          { name: 'paymentTerms', type: 'varchar' },
          { name: 'deliveryEstimate', type: 'varchar' },
          { name: 'validityDays', type: 'int' },
          { name: 'validUntil', type: 'timestamp' },
          { name: 'sentAt', type: 'timestamp', isNullable: true },
          { name: 'acceptedAt', type: 'timestamp', isNullable: true },
          { name: 'rejectedAt', type: 'timestamp', isNullable: true },
          { name: 'rejectionReason', type: 'varchar', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'createdBy', type: 'uuid' },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          { columnNames: ['customerId'] },
          { columnNames: ['status'] },
          { columnNames: ['validUntil'] },
        ],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('quotes');
  }
}
```

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=cypher_erp

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email Service
EMAIL_FROM=quotes@company.com
SENDGRID_API_KEY=

# Company Details
COMPANY_NAME=Your Company
COMPANY_ADDRESS=123 Main St
COMPANY_PHONE=+40 123 456 789
COMPANY_EMAIL=info@company.com
COMPANY_TAX_ID=RO123456789
COMPANY_LOGO_URL=https://cdn.example.com/logo.png

# WhatsApp (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Node
NODE_ENV=production
LOG_LEVEL=info
```

## Performance Tuning

### Indexes
The QuoteEntity has indexes on:
- `customerId` - For customer-specific queries
- `status` - For status-based filtering
- `validUntil` - For expiration queries
- `quoteNumber` - Unique constraint for quick lookup

### Caching Strategy
- Quote cache TTL: 1 hour
- Invalidate on updates
- Bulk invalidate for customer quotes

### Query Optimization
- Pagination by default (limit 10)
- Lazy loading of relations
- Indexed column filtering

## Monitoring & Observability

### Key Metrics
- Quotes created per day
- Average quote acceptance rate
- Quote expiration rate
- PDF generation time
- Job execution time (expiration, reminders)

### Alert Conditions
- Expiration job fails
- Reminder job fails
- PDF generation errors > 5% of requests
- Email delivery failures

### Logs to Monitor
- `[INFO] Quote {quoteNumber} expired`
- `[INFO] Reminder sent for quote {quoteNumber}`
- `[ERROR] Failed to send reminder`
- `[ERROR] Failed to generate PDF`
