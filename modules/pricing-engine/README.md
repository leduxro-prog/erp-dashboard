# Pricing Engine Module

## Overview

The Pricing Engine module provides dynamic pricing capabilities for the CYPHER ERP system, supporting multiple pricing tiers, volume-based discounts, and promotional pricing strategies.

**Owner:** Agent A

## Module Architecture

Hexagonal architecture with the following layers:

```
pricing-engine/
├── domain/              # Core business logic
├── application/         # Use cases and orchestration
├── infrastructure/      # External service integrations
└── api/                 # HTTP endpoint definitions
```

## Key Entities

- **Price**: Base product pricing information
- **PricingTier**: Four-tier pricing structure (Standard, Silver, Gold, Platinum)
- **VolumeDiscount**: Quantity-based discount rules
- **Promotion**: Time-limited promotional pricing campaigns

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/pricing/:productId` | Get current pricing for a product |
| POST | `/api/v1/pricing/calculate` | Calculate final price with discounts and promotions |
| GET | `/api/v1/pricing/promotions` | List active promotions |
| POST | `/api/v1/pricing/promotions` | Create or update a promotion |

## Events Published

- `pricing.price_updated`: Triggered when product pricing changes
- `pricing.promotion_started`: When a new promotion becomes active
- `pricing.promotion_ended`: When a promotion expires

## Dependencies

- **Internal**: None (standalone module)
- **External**: None

## Environment Variables

```
PRICING_DEFAULT_TIER=standard
PRICING_DISCOUNT_THRESHOLD=100
PRICING_CACHE_TTL=3600
```

## Notes

- Pricing calculations are cached to minimize computational overhead
- Volume discounts are automatically applied based on order quantity
- Promotions support percentage and fixed-amount discounts
- All pricing is stored in the database with versioning for historical tracking
