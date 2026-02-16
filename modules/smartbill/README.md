# SmartBill Module

Complete TypeScript implementation of SmartBill integration for Cypher ERP system.

## Project Structure

```
src/
├── domain/                 # Domain layer - business logic
│   ├── entities/          # Domain entities
│   │   ├── SmartBillInvoice.ts
│   │   ├── SmartBillProforma.ts
│   │   └── SmartBillStock.ts
│   └── repositories/      # Repository interfaces
│       └── ISmartBillRepository.ts
├── application/           # Application layer - use cases
│   ├── use-cases/
│   │   ├── CreateInvoice.ts
│   │   ├── CreateProforma.ts
│   │   ├── SyncStock.ts
│   │   └── GetWarehouses.ts
│   ├── dtos/             # Data transfer objects
│   ├── errors/           # Custom error classes
│   └── index.ts
├── infrastructure/        # Infrastructure layer
│   ├── api-client/       # SmartBill API client
│   ├── repositories/     # TypeORM repository implementations
│   ├── entities/         # TypeORM entities
│   ├── mappers/          # Domain to entity mappers
│   ├── jobs/             # BullMQ background jobs
│   └── index.ts
├── api/                  # API layer
│   ├── controllers/      # Express controllers
│   ├── routes/           # Express routes
│   ├── validators/       # Joi validation schemas
│   └── index.ts
└── index.ts              # Module factory and exports

tests/
└── application/          # Application layer tests
    ├── CreateInvoice.test.ts
    └── SyncStock.test.ts
```

## Key Features

### 1. Invoice Management
- Create invoices with multiple items
- Automatic VAT calculation
- SmartBill API integration
- Invoice status tracking (draft, issued, sent, paid, cancelled)
- Event publishing on invoice creation

### 2. Proforma Management
- Create proformas with multiple items
- Convert proformas to invoices
- Automatic VAT calculation
- Status tracking (draft, issued, sent, converted, cancelled)

### 3. Stock Synchronization
- Automatic stock sync from SmartBill warehouses
- Stock change detection
- Low stock and out-of-stock alerts
- BullMQ scheduled jobs (every 15 minutes)
- Sync history tracking

### 4. API Features
- Rate limiting (10 requests/minute)
- Automatic retry with exponential backoff
- Error handling and graceful degradation
- Warehouse management

## Domain Entities

### SmartBillInvoice
```typescript
new SmartBillInvoice(
  id: number | undefined,
  orderId: number,
  smartBillId: string | undefined,
  invoiceNumber: string | undefined,
  series: string = 'FL',
  customerName: string,
  customerVat: string,
  items: InvoiceItem[],
  totalWithoutVat: number,
  vatAmount: number,
  totalWithVat: number,
  currency: string = 'RON',
  status: InvoiceStatus = 'draft',
  issueDate: Date = new Date(),
  dueDate: Date,
  createdAt: Date = new Date()
)
```

Methods:
- `markIssued(smartBillId, invoiceNumber)` - Mark invoice as issued
- `markSent()` - Mark invoice as sent
- `markPaid()` - Mark invoice as paid
- `markCancelled()` - Mark invoice as cancelled
- `static calculateVat(amount, vatRate)` - Calculate VAT amount
- `static createFromOrder()` - Factory method to create from order

### SmartBillProforma
Similar structure to SmartBillInvoice with:
- Status: draft | issued | sent | converted | cancelled
- `markConverted()` - Mark proforma as converted

### SmartBillStock
```typescript
new SmartBillStock(
  productSku: string,
  warehouseName: string,
  quantity: number,
  lastSynced: Date = new Date()
)
```

Methods:
- `hasChanged(previousQty)` - Check if quantity changed
- `isLow(threshold)` - Check if stock is below threshold
- `isOutOfStock()` - Check if stock is at or below zero

## Use Cases

### CreateInvoiceUseCase
Creates an invoice from an order:
1. Validates order exists
2. Builds invoice items with VAT
3. Creates SmartBillInvoice entity
4. Calls SmartBill API
5. Saves to database
6. Publishes 'invoice.created' event

### CreateProformaUseCase
Similar to CreateInvoiceUseCase but for proformas.

### SyncStockUseCase
Syncs inventory from SmartBill:
1. Fetches all warehouses
2. Gets stock for each warehouse
3. Compares with database
4. Updates inventory
5. Publishes 'stock.synced' event
6. Returns sync metrics

### GetWarehousesUseCase
Retrieves list of available warehouses from SmartBill.

## API Endpoints

### POST /api/smartbill/invoices
Create a new invoice
```json
{
  "orderId": 1,
  "customerName": "Company Name",
  "customerVat": "RO12345678",
  "items": [
    {
      "productName": "Product Name",
      "sku": "SKU001",
      "quantity": 2,
      "unitPrice": 100,
      "vatRate": 0.19
    }
  ],
  "dueDate": "2025-12-31T00:00:00Z",
  "series": "FL",
  "currency": "RON"
}
```

### POST /api/smartbill/proformas
Create a new proforma (same schema as invoice)

### GET /api/smartbill/invoices/:id
Get invoice details

### GET /api/smartbill/proformas/:id
Get proforma details

### POST /api/smartbill/sync-stock
Trigger manual stock synchronization

### GET /api/smartbill/warehouses
Get list of available warehouses

### GET /api/smartbill/invoices/:invoiceId/status
Get invoice payment status

### POST /api/smartbill/invoices/:invoiceId/paid
Mark invoice as paid

## Configuration

### SmartBillApiClientConfig
```typescript
{
  baseUrl: "https://api.smartbill.ro/v1",
  username: "your_username",
  password: "your_password",
  maxRetries: 3,
  retryDelayMs: 5000,
  rateLimitPerMinute: 10
}
```

### StockSyncJobConfig
```typescript
{
  queueName: "smartbill-stock-sync",
  schedulePattern: "*/15 * * * *"  // Every 15 minutes
}
```

## Module Factory

Initialize the module:
```typescript
const config = {
  apiConfig: {
    baseUrl: "https://api.smartbill.ro/v1",
    username: process.env.SMARTBILL_USERNAME,
    password: process.env.SMARTBILL_PASSWORD,
  },
  eventBus: myEventBus,
  orderService: myOrderService,
  redisConnection: redisClient,
};

const smartBillModule = createSmartBillModule(
  invoiceRepository,
  proformaRepository,
  stockSyncRepository,
  config
);

// Use the module
app.use('/api/smartbill', smartBillModule.routes);
await smartBillModule.stockSyncJob.start();
```

## Error Handling

The module includes custom error classes:
- `SmartBillError` - Base error class
- `SmartBillApiError` - API communication errors
- `InvoiceCreationError` - Invoice creation failures
- `ProformaCreationError` - Proforma creation failures
- `StockSyncError` - Stock synchronization failures
- `RepositoryError` - Database operation failures

## Testing

Run tests:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

## Build

```bash
npm run build
```

Compiled output goes to `dist/` directory.

## Database Entities

The module uses TypeORM with these entities:
- `smartbill_invoices` - Invoice records
- `smartbill_proformas` - Proforma records
- `smartbill_stock_syncs` - Stock synchronization history

Create migrations before using the module.

## Implementation Notes

- All monetary values use decimal precision (10,2)
- Dates are stored as datetime
- VAT calculations are rounded to 2 decimal places
- Rate limiting is enforced per minute across all requests
- Retry logic uses exponential backoff
- Stock sync runs every 15 minutes via BullMQ
