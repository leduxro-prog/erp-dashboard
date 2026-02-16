---
name: TikTok Marketing Integration
description: Best practices for TikTok Marketing API integration including Events API for conversions and content scheduling
---

# TikTok Marketing Integration Skill

## Overview
This skill covers enterprise-grade TikTok marketing integration:
- TikTok Events API (Conversion Tracking)
- Content scheduling with optimal times
- Campaign performance monitoring
- Viral script templates for Cypher products

## Key Components

### 1. TikTok Marketing Client
Located at: `modules/tiktok-marketing/src/infrastructure/api-clients/TikTokMarketingClient.ts`

**Features:**
- OAuth 2.0 authentication
- Events API for server-side conversion tracking
- PII hashing (SHA-256) for privacy compliance
- Campaign performance queries

### 2. Content Scheduling Service
Located at: `modules/tiktok-marketing/src/application/services/ContentSchedulingService.ts`

**Optimal Posting Times (Romania):**
| Time | Reason |
|------|--------|
| 19:30 | Prime evening engagement window |
| 20:00 | Peak evening activity |
| 20:30 | High engagement period |
| 21:00 | Secondary evening peak |
| 12:00 | Lunch break engagement |

**Recommended Hashtags:**
```
#CypherLighting #MagneticTrackLight #DesignInterior2026
#EfficientHome #SmartHomeRomania #LEDLighting
```

### 3. Conversion Tracking Service
Located at: `modules/tiktok-marketing/src/application/services/ConversionTrackingService.ts`

**Supported Events:**
- `ViewContent` - Page views
- `AddToCart` - Add to cart
- `InitiateCheckout` - Checkout start
- `CompletePayment` - Purchase complete
- `CompleteRegistration` - Sign up

## Events API (CAPI) Integration

### Why Server-Side Tracking?
- Bypasses ad blockers
- Not affected by iOS privacy changes
- More reliable than pixel-only tracking
- Better attribution accuracy

### Usage Example:
```typescript
const client = new TikTokMarketingClient({
  appId: 'YOUR_APP_ID',
  appSecret: 'YOUR_APP_SECRET',
  accessToken: 'YOUR_ACCESS_TOKEN',
  pixelCode: 'YOUR_PIXEL_CODE'
});

// Track purchase
await client.trackPurchase(
  orderId,
  299.99,
  'EUR',
  { email: 'customer@example.com' },
  [{ id: 'SKU-001', name: 'Track Light', quantity: 1 }]
);
```

## Viral Script Template

For Cypher lighting products:

```
🧲 Uită de fire. Viitorul este magnetic.

✨ [Product Name]

🔧 Configurare instantanee - schimbă modulele în secunde
💡 Lumină premium cu tehnologie LED Clasa A++
💰 Reduce factura cu 70%, nu stilul

[Key Benefit]

🔗 Descoperă Cypher. Link în Bio.
```

**Best Practices:**
- Hook in first 3 seconds (visual satisfaction + ASMR)
- Use macro close-ups of magnetic mechanism
- Speed ramps for module changes
- Minimalist Deep House / Future Garage music
- Duration: 15-20 seconds optimal

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tiktok/content/schedule` | Schedule content |
| GET | `/api/v1/tiktok/content/optimal-time` | Get next optimal time |
| GET | `/api/v1/tiktok/hashtags/recommended` | Get hashtags |
| POST | `/api/v1/tiktok/conversions/track` | Track event |
| GET | `/api/v1/tiktok/conversions/summary` | Get summary |
| POST | `/api/v1/tiktok/scripts/generate` | Generate script |

## Security Best Practices

1. **Hash all PII** - Email, phone with SHA-256 before sending
2. **Use event deduplication** - Unique event IDs prevent double counting
3. **Store credentials securely** - Environment variables only
4. **Implement retry logic** - Max 3 retries for failed events
5. **Log for audit** - Track all API interactions

## Configuration

```env
# TikTok API
TIKTOK_APP_ID=your_app_id
TIKTOK_APP_SECRET=your_app_secret
TIKTOK_ACCESS_TOKEN=your_access_token
TIKTOK_PIXEL_CODE=your_pixel_code
TIKTOK_ADVERTISER_ID=your_advertiser_id
```

## Deduplication

The Events API handles deduplication using `event_id`. Generate unique IDs:

```typescript
const eventId = `purchase_${orderId}_${Date.now()}`;
```

This ensures the same event is not counted twice if sent from both pixel and server.
