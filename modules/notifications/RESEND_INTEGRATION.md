# Resend Email Integration

## Overview

This document describes the integration of Resend email service with the CYPHER ERP notification system.

## Features

- **Email Sending**: Send single and bulk emails via Resend API
- **Template Management**: Handlebars-based email templates with variable interpolation
- **Error Handling**: Comprehensive error handling and logging
- **Default Templates**: Pre-configured templates for common use cases

## Setup

### 1. Environment Configuration

Add your Resend API key to `.env`:

```env
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=noreply@ledux.ro
```

### 2. Installation

The required packages are already added to `package.json`:

```json
{
  "dependencies": {
    "resend": "^4.0.0",
    "handlebars": "^4.7.8"
  },
  "devDependencies": {
    "@types/handlebars": "^4.1.0"
  }
}
```

Run `npm install` to install dependencies.

### 3. Verify Integration

The system will automatically initialize the Resend adapter if the API key is configured:

```typescript
// Check logs for:
// "Resend email adapter initialized successfully"
```

## Usage

### Send Single Email

**Endpoint**: `POST /api/v1/notifications/send`

```json
{
  "channel": "EMAIL",
  "recipientEmail": "customer@example.com",
  "subject": "Order Confirmation",
  "body": "<h1>Thank you for your order!</h1>",
  "templateSlug": "order_confirmation",
  "data": {
    "customerName": "John Doe",
    "orderNumber": "ORD-12345",
    "totalAmount": "150.00",
    "status": "Processing"
  }
}
```

**Response**:

```json
{
  "success": true,
  "notificationId": "msg_abc123xyz",
  "channel": "EMAIL",
  "status": "SENT"
}
```

### Send Bulk Emails

**Endpoint**: `POST /api/v1/notifications/bulk`

```json
{
  "channel": "EMAIL",
  "subject": "Monthly Newsletter",
  "body": "<h1>Hello {{name}}</h1>",
  "recipients": [
    {
      "email": "customer1@example.com",
      "data": { "name": "Alice" }
    },
    {
      "email": "customer2@example.com",
      "data": { "name": "Bob" }
    }
  ]
}
```

**Response**:

```json
{
  "success": true,
  "totalSent": 2,
  "results": [
    { "success": true, "messageId": "msg_1" },
    { "success": true, "messageId": "msg_2" }
  ],
  "channel": "EMAIL"
}
```

### Template Management

#### Create Template

**Endpoint**: `POST /api/v1/notifications/templates`

```json
{
  "name": "Order Shipped",
  "slug": "order_shipped",
  "channel": "EMAIL",
  "subject": "Your order {{orderNumber}} has shipped!",
  "body": "<h1>Order Shipped</h1><p>Hello {{customerName}},</p><p>Your order <strong>{{orderNumber}}</strong> has been shipped.</p><p>Tracking: {{trackingNumber}}</p>",
  "locale": "ro",
  "isActive": true
}
```

#### Update Template

**Endpoint**: `PUT /api/v1/notifications/templates/:id`

```json
{
  "subject": "Updated subject",
  "body": "<h1>Updated body</h1>",
  "isActive": true
}
```

#### List Templates

**Endpoint**: `GET /api/v1/notifications/templates`

#### Delete Template

**Endpoint**: `DELETE /api/v1/notifications/templates/:id`

## Default Templates

### 1. B2B Registration Submitted

**Slug**: `b2b_registration_submitted`

**Variables**: `companyName`, `registrationId`

### 2. B2B Auto-Approved

**Slug**: `b2b_auto_approved`

**Variables**: `companyName`, `creditLimit`, `email`

### 3. Order Confirmation

**Slug**: `order_confirmation`

**Variables**: `customerName`, `orderNumber`, `totalAmount`, `status`

## Architecture

### ResendEmailAdapter

Located at: `/opt/cypher-erp/modules/notifications/src/infrastructure/adapters/ResendEmailAdapter.ts`

**Key Methods**:

- `sendEmail(message: EmailMessage)`: Send a single email
- `sendBulk(messages: EmailMessage[])`: Send multiple emails
- `registerTemplate(name: string, templateString: string)`: Register a new Handlebars template

### Integration Flow

```
Controller → ResendEmailAdapter → Resend API → Email Delivery
     ↓
  Database (optional logging)
```

### Error Handling

All email operations return structured responses:

```typescript
{
  success: boolean;
  messageId?: string;  // Resend message ID
  error?: string;      // Error message if failed
}
```

## Testing

### Test Email Sending

```bash
curl -X POST http://localhost:8000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "channel": "EMAIL",
    "recipientEmail": "test@example.com",
    "subject": "Test Email",
    "body": "<h1>Hello from Resend!</h1>"
  }'
```

### Test Template

```bash
curl -X POST http://localhost:8000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "channel": "EMAIL",
    "recipientEmail": "test@example.com",
    "templateSlug": "order_confirmation",
    "data": {
      "customerName": "Test User",
      "orderNumber": "TEST-001",
      "totalAmount": "100.00",
      "status": "Pending"
    }
  }'
```

## Monitoring & Logging

All operations are logged with appropriate log levels:

- **Info**: Successful initialization, email sent
- **Warn**: Missing API key, degraded functionality
- **Error**: Failed to send email, invalid template

Example logs:

```
[notifications] info: Resend email adapter initialized successfully {"defaultFrom":"noreply@ledux.ro"}
[notifications] info: Email sent successfully {"messageId":"msg_abc123","to":"customer@example.com"}
[notifications] error: Failed to send email {"error":"Invalid API key","to":"customer@example.com"}
```

## Troubleshooting

### Issue: Emails not sending

**Check**:
1. Verify `RESEND_API_KEY` is set in `.env`
2. Check API key is valid (not `re_placeholder_key`)
3. Review logs for initialization errors
4. Verify domain is verified in Resend dashboard

### Issue: Template rendering errors

**Check**:
1. Verify Handlebars syntax is correct
2. Ensure all required variables are provided
3. Check template compilation logs

### Issue: "Resend adapter not available"

**Solution**: Ensure `RESEND_API_KEY` is set to a valid API key (not the placeholder value)

## API Reference

### Resend Official Docs

- Website: https://resend.com
- API Docs: https://resend.com/docs
- Node.js SDK: https://github.com/resendlabs/resend-node

### Rate Limits

Check your Resend plan for rate limits. Default limits vary by plan tier.

## Future Enhancements

- [ ] Add email analytics tracking
- [ ] Implement webhook handling for delivery status
- [ ] Add support for email attachments
- [ ] Implement email scheduling
- [ ] Add A/B testing for email templates
- [ ] Integration with customer preferences for unsubscribe

## Support

For issues with the integration:
1. Check this documentation
2. Review application logs
3. Verify Resend dashboard for delivery status
4. Contact development team

---

**Last Updated**: 2026-02-12
**Version**: 1.0.0
