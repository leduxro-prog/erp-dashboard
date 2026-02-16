# Marketing Module

Enterprise-grade marketing module for CYPHER ERP with campaign management, discount codes, and email sequences.

## Overview

The Marketing Module provides comprehensive marketing campaign management, discount code validation and application, and automated email sequences for customer engagement.

### Features

- **Campaign Management**: Create, activate, pause, and track marketing campaigns
- **Discount Codes**: Generate and validate discount codes with flexible constraints
- **Email Sequences**: Multi-step automated email workflows triggered by customer events
- **Analytics**: Campaign metrics, ROI calculation, and time-series analytics
- **Audience Segmentation**: Target campaigns to specific customer segments
- **Event-Driven**: Integrates with order, customer, and cart events

## Architecture

Follows hexagonal (ports & adapters) architecture pattern:

```
Domain Layer (DDD)
├── Entities: Campaign, DiscountCode, EmailSequence, MarketingEvent
├── Repositories: ICampaignRepository, IDiscountCodeRepository, etc.
├── Services: AudienceSegmentationService, DiscountCalculationService
└── Errors: Custom marketing domain errors

Application Layer
├── Use-Cases: CreateCampaign, ActivateCampaign, ApplyDiscountCode, etc.
└── Ports: INotificationPort, ICustomerPort, IOrderPort

Infrastructure Layer
├── TypeORM Repositories
├── Background Jobs: SequenceProcessor, CampaignExpiration, etc.
└── API Controllers & Routes

API Layer
└── REST endpoints for all operations
```

## Core Entities

### Campaign
Represents a marketing campaign with:
- Status lifecycle: DRAFT → SCHEDULED → ACTIVE → [PAUSED] → COMPLETED/CANCELLED
- Metrics tracking: sent, opened, clicked, converted, revenue
- Budget management with ROI calculation
- Audience targeting with filters

### DiscountCode
Represents a promotional discount code with:
- Multiple discount types: PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING, BUY_X_GET_Y
- Active/expired status and usage limits (total and per-customer)
- Applicability rules (products, categories, exclusions)
- Stacking support for combining codes

### EmailSequence
Represents an automated email workflow with:
- Trigger-based enrollment (REGISTRATION, FIRST_ORDER, CART_ABANDONED, etc.)
- Multi-step sequences with conditional logic
- Delay configuration (days + hours)
- Performance tracking (open/click rates per step)

### MarketingEvent
Represents atomic marketing events for analytics:
- Event types: SENT, OPENED, CLICKED, CONVERTED, UNSUBSCRIBED, BOUNCED
- Links to campaigns, sequences, discount codes
- Metadata for tracking and analysis

## Key Use-Cases

### Campaign Management
- `CreateCampaign`: Create new campaign with audience filters
- `ActivateCampaign`: Activate campaign and optionally its codes/sequences
- `PauseCampaign`: Pause active campaign
- `GetCampaignAnalytics`: Retrieve metrics and ROI data

### Discount Code Operations
- `CreateDiscountCode`: Create individual discount code
- `GenerateDiscountCodes`: Batch generate codes with prefix
- `ValidateDiscountCode`: Check if code is valid for an order
- `ApplyDiscountCode`: Apply code to order and track usage

### Email Sequences
- `CreateEmailSequence`: Create multi-step sequence
- `ProcessSequenceTrigger`: Enroll customer when trigger fires
- `ExecuteSequenceStep`: Send email and advance sequence

### Analytics
- `GetCampaignAnalytics`: Campaign metrics and ROI
- `GetMarketingDashboard`: Overview of all campaigns and performance
- `TrackMarketingEvent`: Record conversion/engagement events

## Domain Services

### AudienceSegmentationService
Segments customers by:
- Customer tier (BRONZE, SILVER, GOLD, PLATINUM)
- Purchase history and total spent
- Product categories purchased
- Customer tags/attributes
- Registration date

### DiscountCalculationService
Handles discount application with:
- Multiple discount type calculations
- Minimum order amount validation
- Maximum discount cap enforcement
- Stacking rule validation
- Item-level applicability checking

## API Endpoints (15 total)

### Campaigns
- `POST /api/v1/marketing/campaigns` - Create campaign
- `GET /api/v1/marketing/campaigns` - List campaigns (paginated, filtered)
- `GET /api/v1/marketing/campaigns/:id` - Get campaign detail
- `PUT /api/v1/marketing/campaigns/:id` - Update campaign
- `POST /api/v1/marketing/campaigns/:id/activate` - Activate campaign
- `POST /api/v1/marketing/campaigns/:id/pause` - Pause campaign
- `GET /api/v1/marketing/campaigns/:id/analytics` - Get campaign analytics

### Discount Codes
- `POST /api/v1/marketing/discount-codes` - Create discount code
- `POST /api/v1/marketing/discount-codes/generate` - Batch generate codes
- `POST /api/v1/marketing/discount-codes/validate` - Validate code for order
- `GET /api/v1/marketing/discount-codes` - List codes (paginated)

### Email Sequences
- `POST /api/v1/marketing/sequences` - Create email sequence
- `GET /api/v1/marketing/sequences` - List sequences

### Analytics & Tracking
- `GET /api/v1/marketing/dashboard` - Marketing dashboard overview
- `POST /api/v1/marketing/track/:type` - Track event (open/click pixel)

## Domain Errors

Custom error types for specific business rule violations:
- `CampaignNotFoundError` - Campaign doesn't exist
- `InvalidDiscountCodeError` - Code invalid or format error
- `DiscountCodeExpiredError` - Code past expiration date
- `DiscountCodeUsedUpError` - Usage limit exceeded
- `DuplicateCodeError` - Code already exists
- `InvalidAudienceFilterError` - Invalid filter criteria
- `CampaignAlreadyActiveError` - Campaign already active
- `MinimumOrderNotMetError` - Order below minimum amount
- `CodeUsagePerCustomerExceededError` - Customer usage limit exceeded
- `BudgetExceededError` - Campaign budget exhausted

## Event-Driven Integration

### Published Events
- `marketing.discount_applied` - Discount code applied to order
- `marketing.campaign_activated` - Campaign activated
- `marketing.campaign_paused` - Campaign paused
- `marketing.campaign_completed` - Campaign completed
- `marketing.email_sent` - Email sequence step sent
- `marketing.customer_enrolled` - Customer enrolled in sequence

### Subscribed Events
- `order.completed` - Track conversions and revenue
- `customer.registered` - Enroll in welcome sequence
- `b2b.registration_approved` - Send B2B welcome sequence
- `cart.abandoned` - Send cart recovery emails

## Background Jobs

### SequenceProcessorJob
- **Frequency**: Every hour
- **Function**: Process pending email sequence steps, send emails, handle conditions

### CampaignExpirationJob
- **Frequency**: Daily at 01:00 UTC
- **Function**: Auto-complete expired campaigns, mark as finished

### CodeCleanupJob
- **Frequency**: Daily at 02:00 UTC
- **Function**: Deactivate expired discount codes

### AnalyticsAggregationJob
- **Frequency**: Every 6 hours
- **Function**: Aggregate marketing events into campaign metrics

## Testing

Comprehensive test coverage:

```
tests/
├── domain/
│   ├── Campaign.test.ts - Campaign entity lifecycle and metrics
│   ├── DiscountCode.test.ts - Code validation and calculations
│   └── EmailSequence.test.ts - Sequence management
├── application/
│   ├── CreateCampaign.test.ts - Campaign creation
│   ├── ValidateDiscountCode.test.ts - Code validation
│   ├── ApplyDiscountCode.test.ts - Code application
│   ├── ProcessSequenceTrigger.test.ts - Email enrollment
│   └── GetCampaignAnalytics.test.ts - Analytics calculation
└── infrastructure/
    └── Repositories.test.ts - Repository implementations
```

Run tests:
```bash
npm test -- marketing
npm test -- marketing --coverage
```

## Configuration

Module-specific environment variables:

```env
# Email sequence processing
MARKETING_SEQUENCE_BATCH_SIZE=50
MARKETING_SEQUENCE_DELAY_MS=100

# Campaign processing
MARKETING_CAMPAIGN_BATCH_SIZE=100
MARKETING_ANALYTICS_AGGREGATION_INTERVAL=21600000  # 6 hours

# Code generation
MARKETING_MAX_CODE_GENERATION=10000
```

## Module Metadata

- **Name**: `marketing`
- **Version**: `1.0.0`
- **Dependencies**: `['notifications']`
- **Stability**: Production Ready
- **Owner**: Marketing Team

## Integration Points

### Dependencies
- **notifications**: Email sending and multi-channel notifications

### External Ports
- `INotificationPort` - Send emails (implemented by notifications module)
- `ICustomerPort` - Query customer data (from customer module)
- `IOrderPort` - Query order data (from orders module)

## Performance Characteristics

- Campaign activation: O(n) where n = related discount codes + sequences
- Discount code validation: O(1) with caching
- Audience segmentation: O(n) where n = total customers
- Analytics aggregation: Batched async job, non-blocking

## Future Enhancements

- SMS and WhatsApp notification support
- Advanced ML-based audience segmentation
- A/B testing for campaigns
- Multi-currency discount support
- Referral program management
- Loyalty point integration
- Advanced fraud detection for codes

## License

Proprietary - CYPHER ERP
