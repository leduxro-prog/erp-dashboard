---
name: Google Shopping Integration
description: Best practices for integrating with Google Shopping (Merchant Center + Ads API) for product advertising and position monitoring
---

# Google Shopping Integration Skill

## Overview
This skill covers enterprise-grade integration with Google Shopping, including:
- Google Merchant Center API (Content API for Shopping)
- Google Ads API for position tracking
- High-margin product segmentation
- Budget monitoring and alerts

## Key Components

### 1. Google Merchant Center Client
Located at: `modules/google-shopping/src/infrastructure/api-clients/GoogleMerchantClient.ts`

**Features:**
- OAuth 2.0 service account authentication
- Rate limiting (10 req/sec to comply with API limits)
- Batch operations for product sync
- Product CRUD operations

**Usage:**
```typescript
const client = new GoogleMerchantClient({
  merchantId: 'YOUR_MERCHANT_ID',
  credentials: {
    client_email: 'service-account@project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\n...'
  }
});

await client.initialize();
await client.upsertProduct({
  offerId: 'SKU-001',
  title: 'Cypher Magnetic Track Light',
  price: { value: '299.99', currency: 'EUR' },
  availability: 'in stock',
  // ...
});
```

### 2. Google Ads Client (Position Tracking)
Located at: `modules/google-shopping/src/infrastructure/api-clients/GoogleAdsClient.ts`

**Key Metrics:**
- `search_absolute_top_is` - % of impressions in position 1
- `search_top_is` - % of impressions above organic results
- Budget consumption per campaign

**GAQL Query Example:**
```sql
SELECT
  campaign.id,
  metrics.search_absolute_top_impression_share,
  metrics.cost_micros
FROM shopping_performance_view
WHERE campaign.advertising_channel_type = 'SHOPPING'
```

### 3. High-Margin Segmentation
Located at: `modules/google-shopping/src/application/services/HighMarginSegmentationService.ts`

**Configuration:**
- Default threshold: 30% margin
- Priority scoring: margin (50%) + sales volume (30%) + conversion rate (20%)
- Recommended bid multipliers based on margin tier

### 4. Budget Alert Service
Located at: `modules/google-shopping/src/domain/services/BudgetAlertService.ts`

**Alert Levels:**
| Threshold | Severity | Action |
|-----------|----------|--------|
| 70% | WARNING | Review performance |
| 90% | CRITICAL | Pause low-margin products |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/shopping/products/high-margin` | Products with margin >30% |
| GET | `/api/v1/shopping/metrics/positions` | Search Absolute Top IS |
| GET | `/api/v1/shopping/budget/status` | Budget status + alerts |
| POST | `/api/v1/shopping/alerts/configure` | Configure thresholds |
| GET | `/api/v1/shopping/dashboard` | Summary dashboard |

## Security Best Practices

1. **Never hardcode credentials** - Use environment variables
2. **Use service accounts** for server-to-server auth
3. **Log all API operations** for audit trail
4. **Implement rate limiting** to avoid API bans
5. **Hash PII data** before logging

## Configuration Example

```env
# Google Merchant Center
GOOGLE_MERCHANT_ID=12345678
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/path/to/service-account.json

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxx
GOOGLE_ADS_CUSTOMER_ID=123-456-7890
GOOGLE_ADS_REFRESH_TOKEN=xxxxx
GOOGLE_ADS_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=xxxxx

# Budget Alerts
SHOPPING_DAILY_BUDGET_LIMIT=40
SHOPPING_ALERT_WARNING_THRESHOLD=70
SHOPPING_ALERT_CRITICAL_THRESHOLD=90
SHOPPING_ALERT_WEBHOOK_URL=https://your-webhook.com/alerts
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid credentials | Check service account permissions |
| `429 Too Many Requests` | Rate limit exceeded | Reduce request frequency |
| `PRODUCT_DISAPPROVED` | Data quality issue | Check product data specifications |
