# Resend Integration - Installation Guide

## Quick Start

Follow these steps to get Resend email integration working in CYPHER ERP.

### Step 1: Install Dependencies

```bash
cd /opt/cypher-erp
npm install
```

This will install:
- `resend@^4.0.0` - Resend SDK for Node.js
- `handlebars@^4.7.8` - Template engine
- `@types/handlebars@^4.1.0` - TypeScript types

### Step 2: Configure API Key

1. Get your Resend API key from https://resend.com/api-keys

2. Update `.env` file:

```env
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=noreply@ledux.ro
```

**Important**: Replace `re_placeholder_key` with your actual API key.

### Step 3: Verify Domain in Resend

Before sending emails, verify your domain in Resend:

1. Go to https://resend.com/domains
2. Add your domain (`ledux.ro`)
3. Add DNS records as instructed
4. Wait for verification (usually takes a few minutes)

### Step 4: Restart Application

```bash
# If using Docker:
docker compose restart cypher-erp

# If running locally:
npm run dev
```

### Step 5: Verify Integration

Check application logs for:

```
[notifications] info: Resend email adapter initialized successfully {"defaultFrom":"noreply@ledux.ro"}
[notifications] info: Resend email adapter is ready for use
```

If you see warnings about missing API key, check Step 2.

### Step 6: Test Email Sending

#### Option A: Using cURL

```bash
curl -X POST http://localhost:8000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "channel": "EMAIL",
    "recipientEmail": "test@resend.dev",
    "subject": "Test Email from CYPHER ERP",
    "body": "<h1>Hello!</h1><p>This is a test email.</p>"
  }'
```

#### Option B: Using Postman

1. Create new POST request to: `http://localhost:8000/api/v1/notifications/send`
2. Add Authorization header with valid JWT token
3. Set body to:
```json
{
  "channel": "EMAIL",
  "recipientEmail": "your-email@example.com",
  "subject": "Test Email",
  "body": "<h1>Hello from CYPHER ERP!</h1>"
}
```

#### Option C: Test with Template

```bash
curl -X POST http://localhost:8000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "channel": "EMAIL",
    "recipientEmail": "test@resend.dev",
    "templateSlug": "order_confirmation",
    "data": {
      "customerName": "Test User",
      "orderNumber": "TEST-001",
      "totalAmount": "100.00",
      "status": "Processing"
    }
  }'
```

### Step 7: Monitor Logs

Watch for email sending logs:

```bash
# Docker logs
docker compose logs -f cypher-erp | grep -i "email\|resend"

# Local logs
tail -f logs/cypher-erp.log | grep -i "email\|resend"
```

## Troubleshooting

### Issue: "Resend adapter not available"

**Cause**: API key is not configured or invalid.

**Solution**:
1. Check `.env` has `RESEND_API_KEY` set
2. Verify it's not the placeholder value `re_placeholder_key`
3. Restart application

### Issue: "Email not delivered"

**Cause**: Domain not verified in Resend.

**Solution**:
1. Go to https://resend.com/domains
2. Verify DNS records are correctly configured
3. Wait for domain verification to complete
4. Check Resend dashboard for delivery status

### Issue: "Invalid API key"

**Cause**: Wrong API key or expired key.

**Solution**:
1. Generate a new API key at https://resend.com/api-keys
2. Update `.env` file
3. Restart application

### Issue: Template rendering errors

**Cause**: Missing template variables or invalid Handlebars syntax.

**Solution**:
1. Check all required variables are provided in `templateData`
2. Verify template syntax in Resend dashboard or database
3. Review logs for specific error message

## Configuration Options

### Environment Variables

```env
# Required
RESEND_API_KEY=re_your_api_key

# Optional (defaults shown)
EMAIL_FROM=noreply@ledux.ro
EMAIL_FROM_NAME=LEDUX
```

### Default Templates

The system includes 3 pre-configured templates:

1. **b2b_registration_submitted**
   - Variables: `companyName`, `registrationId`
   - Use: B2B registration confirmations

2. **b2b_auto_approved**
   - Variables: `companyName`, `creditLimit`, `email`
   - Use: B2B auto-approval notifications

3. **order_confirmation**
   - Variables: `customerName`, `orderNumber`, `totalAmount`, `status`
   - Use: Order confirmations

### Adding Custom Templates

Via API:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "Custom Template",
    "slug": "custom_template",
    "channel": "EMAIL",
    "subject": "Custom Subject",
    "body": "<h1>Hello {{name}}</h1><p>{{message}}</p>",
    "locale": "ro",
    "isActive": true
  }'
```

## Database Schema

The notification templates are stored in the `notification_templates` table:

```sql
-- No migration needed - table already exists from module initialization
SELECT * FROM notification_templates;
```

## API Endpoints

### Send Email
- **POST** `/api/v1/notifications/send`
- Auth: Required
- Body: `{ channel, recipientEmail, subject, body, template, data }`

### Send Bulk
- **POST** `/api/v1/notifications/bulk`
- Auth: Admin only
- Body: `{ channel, subject, body, recipients }`

### Manage Templates
- **GET** `/api/v1/notifications/templates` - List all
- **POST** `/api/v1/notifications/templates` - Create new
- **PUT** `/api/v1/notifications/templates/:id` - Update
- **DELETE** `/api/v1/notifications/templates/:id` - Delete

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure API key
3. ✅ Verify domain
4. ✅ Test email sending
5. 📝 Create custom templates for your use cases
6. 📝 Integrate with business events (orders, B2B registrations, etc.)
7. 📝 Monitor delivery rates in Resend dashboard

## Support Resources

- **Resend Documentation**: https://resend.com/docs
- **Resend Node SDK**: https://github.com/resendlabs/resend-node
- **CYPHER ERP Docs**: See `RESEND_INTEGRATION.md` for detailed usage
- **Example Code**: See `examples/resend-usage-examples.ts`

## Production Checklist

Before going to production:

- [ ] Domain verified in Resend
- [ ] API key is production key (not test key)
- [ ] `.env` file is secure and not committed to git
- [ ] Email templates tested with real data
- [ ] Error handling and logging configured
- [ ] Monitoring/alerting set up for failed emails
- [ ] Rate limits understood and configured
- [ ] Backup email provider configured (optional)

---

**Installation Date**: 2026-02-12
**Version**: 1.0.0
**Installed By**: CYPHER ERP Development Team
