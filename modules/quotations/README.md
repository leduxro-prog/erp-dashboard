# Quotations Module

## Overview

The Quotations module manages customer quotations with 15-day validity periods, PDF generation, and automated reminder notifications. Supports conversion to orders.

**Owner:** Agent A

## Module Architecture

Hexagonal architecture with the following layers:

```
quotations/
├── domain/              # Quote state management and validity rules
├── application/         # Quote processing and PDF generation
├── infrastructure/      # Document generation and notification adapters
└── api/                 # HTTP endpoint definitions
```

## Key Entities

- **Quotation**: Quote aggregate with line items and validity tracking
- **QuotationLineItem**: Products and pricing within a quote
- **QuotationStatus**: Draft, Sent, Expired, Converted, Rejected
- **QuotationValidity**: 15-day expiration rules

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/quotes` | List all quotations with filters |
| POST | `/api/v1/quotes` | Create a new quotation |
| GET | `/api/v1/quotes/:id` | Get quotation details |
| PUT | `/api/v1/quotes/:id` | Update quotation |
| DELETE | `/api/v1/quotes/:id` | Delete quotation |
| POST | `/api/v1/quotes/:id/send` | Send quotation to customer |
| POST | `/api/v1/quotes/:id/convert` | Convert quotation to order |

## Events Published

- `quote.created`: When a new quotation is created
- `quote.sent`: When a quotation is sent to customer
- `quote.expired`: When a quotation validity period expires
- `quote.converted`: When a quotation is converted to an order

## Dependencies

- **IPricingService**: For line item pricing and discount calculations (via interface)
- **IInventoryService**: For stock availability verification (via interface)

## Environment Variables

```
QUOTE_VALIDITY_DAYS=15
QUOTE_REMINDER_DAYS=3
PDF_GENERATION_TIMEOUT=30000
QUOTE_CURRENCY=RON
```

## Features

- **PDF Generation**: Automatic creation of professional quotation PDFs
- **Automated Reminders**: Notifications sent 3 days before expiration
- **Validity Tracking**: Automatic expiration after 15 days
- **Conversion**: Direct conversion from quotation to order preserves pricing
- **Customer History**: Track all quotes per customer relationship

## Notes

- Quotations preserve pricing snapshot at creation time
- Expired quotations can be renewed manually
- Automatic reminder emails are sent via notification service
- PDF documents are cached for efficient delivery
