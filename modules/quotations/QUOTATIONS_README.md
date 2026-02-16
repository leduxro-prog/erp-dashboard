# CYPHER ERP - Quotations Module

Complete quotations management module for CYPHER ERP with professional PDF generation, automatic expiration tracking, and conversion to orders.

## Features

- **Quote Management**: Create, send, accept, reject, and expire quotations
- **Status Machine**: Enforced state transitions (PENDING → SENT → ACCEPTED/REJECTED/EXPIRED)
- **Auto-Expiration**: 15-day validity with automatic expiration job (daily at 00:30 UTC)
- **Reminders**: Automated email reminders at 5, 10, and 14 days before expiration (daily job at 09:00 UTC)
- **PDF Generation**: Professional branded PDF with company logo, client details, product images, pricing, and terms
- **Order Conversion**: Convert accepted quotes directly to orders with event publishing
- **Multi-Channel**: Support for email and WhatsApp quote delivery
- **Caching**: Redis-based quote caching for performance
- **Pagination**: Support for paginated quote listing

## Architecture

### Domain Layer (Clean Architecture)
- **Entities**: `Quote`, `QuoteStatusMachine`
- **Services**: `IQuotePdfGenerator` (interface)
- **Repositories**: `IQuoteRepository` (interface)

### Application Layer
- **Use Cases**: 10 comprehensive use cases covering all operations
- **DTOs**: Data transfer objects for API contracts
- **Error Handling**: Custom error classes for specific scenarios

### Infrastructure Layer
- **TypeORM**: Database persistence with `QuoteEntity`
- **PDF**: `PdfGenerator` using pdfkit for professional PDF rendering
- **Jobs**: BullMQ-based scheduled jobs for expiration and reminders
- **Cache**: Redis-based quote caching

### API Layer
- **Routes**: RESTful endpoints for all quote operations
- **Controllers**: Request handling and validation
- **Validators**: Comprehensive input validation

## Quote Status Flow

```
PENDING
  ↓
SENT ──→ ACCEPTED (terminal)
  ├──→ REJECTED (terminal)
  └──→ EXPIRED (terminal)
```

## API Endpoints

- `POST /api/v1/quotes` - Create quote
- `GET /api/v1/quotes` - List quotes with filters
- `GET /api/v1/quotes/:id` - Get single quote
- `POST /api/v1/quotes/:id/send` - Send quote
- `POST /api/v1/quotes/:id/accept` - Accept quote
- `POST /api/v1/quotes/:id/reject` - Reject quote with reason
- `POST /api/v1/quotes/:id/convert` - Convert to order
- `GET /api/v1/quotes/:id/pdf` - Download PDF

## Quote Properties

- **id**: UUID identifier
- **quoteNumber**: QTE-YYYYMMDD-XXXX format
- **customerId/Name/Email**: Customer identification
- **status**: PENDING | SENT | ACCEPTED | EXPIRED | REJECTED
- **items**: Array of quote items with product details and images
- **billingAddress/shippingAddress**: Customer addresses
- **subtotal/discount/tax (19%)/grandTotal**: Pricing calculations in RON
- **paymentTerms**: e.g., "Net 30"
- **deliveryEstimate**: e.g., "5 business days"
- **validityDays**: Default 15 days
- **validUntil**: Auto-calculated expiration date

## Pricing Formula

- Subtotal = sum of (quantity × unitPrice)
- Discount = subtotal × (discountPercentage / 100)
- Taxable Amount = subtotal - discount
- Tax = taxable amount × 0.19 (19% VAT)
- Grand Total = taxable amount + tax

## Scheduled Jobs

### Expiration Job
- **Schedule**: Daily at 00:30 UTC via BullMQ
- **Action**: Marks PENDING/SENT quotes as EXPIRED when past validUntil
- **Result**: Prevents accepting expired quotes

### Reminder Job
- **Schedule**: Daily at 09:00 UTC via BullMQ
- **Action**: Sends email reminders at days 14, 10, 5 before expiration
- **Target**: PENDING and SENT quotes only

## PDF Template

Professional layout includes:
1. Company header with logo, name, contact, tax ID
2. Quote number and validity period
3. Customer billing and shipping addresses
4. Items table with product images, quantities, unit prices
5. Totals section (subtotal, discount %, VAT 19%, total)
6. Footer with payment terms, delivery, T&C, notes
7. Romanian date format (dd.MM.yyyy), RON currency

## Tests Included

- **6+ QuoteStatusMachine tests**: Status transitions, terminal states, valid transitions
- **8+ Quote entity tests**: Calculations, status changes, expiry logic, reminders, conversions
- **5+ CreateQuote tests**: Validation, defaults, uniqueness, error handling
- **4+ ConvertToOrder tests**: State validation, order creation, event publishing

## Error Classes

- `QuoteNotFoundError`
- `QuoteInvalidStatusTransitionError`
- `QuoteExpiredError`
- `QuoteAlreadyProcessedError`
- `InvalidQuoteItemsError`
- `QuotePdfGenerationError`

## Installation & Setup

```bash
npm install
npm run build
npm test
```

## Files Summary

Total: **26 implementation files** across domain, application, infrastructure, and API layers:

**Domain**: 3 files (Quote, StatusMachine, interfaces)
**Application**: 11 files (10 use cases + DTOs/errors)
**Infrastructure**: 9 files (TypeORM, PDF, jobs, cache)
**API**: 3 files (routes, controller, validators)
