# Notifications API - Endpoints Reference

## Base URL

```
http://localhost:8000/api/v1/notifications
```

## Authentication

All endpoints require authentication. Include JWT token in Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Email Endpoints (Resend Integration)

### 1. Send Single Email

Send a single email to one or more recipients.

**Endpoint**: `POST /send`

**Auth**: User

**Request Body**:

```json
{
  "channel": "EMAIL",
  "recipientEmail": "customer@example.com",
  "subject": "Your Subject Here",
  "body": "<h1>HTML content</h1><p>Your message</p>",
  "templateSlug": "optional_template_name",
  "data": {
    "variable1": "value1",
    "variable2": "value2"
  }
}
```

**Response** (Success):

```json
{
  "success": true,
  "notificationId": "msg_abc123xyz",
  "channel": "EMAIL",
  "status": "SENT"
}
```

**Response** (Error):

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Example with Template**:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "channel": "EMAIL",
    "recipientEmail": "customer@example.com",
    "templateSlug": "order_confirmation",
    "data": {
      "customerName": "John Doe",
      "orderNumber": "ORD-12345",
      "totalAmount": "250.00",
      "status": "Processing"
    }
  }'
```

---

### 2. Send Bulk Emails

Send the same email to multiple recipients.

**Endpoint**: `POST /bulk`

**Auth**: Admin only

**Request Body**:

```json
{
  "channel": "EMAIL",
  "subject": "Bulk Email Subject",
  "body": "<h1>Hello {{name}}</h1>",
  "templateSlug": "optional_template",
  "recipients": [
    {
      "email": "customer1@example.com",
      "data": {
        "name": "Alice",
        "customField": "value1"
      }
    },
    {
      "email": "customer2@example.com",
      "data": {
        "name": "Bob",
        "customField": "value2"
      }
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
    {
      "success": true,
      "messageId": "msg_1"
    },
    {
      "success": true,
      "messageId": "msg_2"
    }
  ],
  "channel": "EMAIL"
}
```

**Example**:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "channel": "EMAIL",
    "subject": "Monthly Newsletter",
    "body": "<h1>Hello {{name}}</h1><p>Latest updates...</p>",
    "recipients": [
      {"email": "alice@example.com", "data": {"name": "Alice"}},
      {"email": "bob@example.com", "data": {"name": "Bob"}}
    ]
  }'
```

---

## Template Management Endpoints

### 3. List All Templates

Get all notification templates.

**Endpoint**: `GET /templates`

**Auth**: Admin only

**Response**:

```json
[
  {
    "id": "uuid-1",
    "name": "Order Confirmation",
    "slug": "order_confirmation",
    "channel": "EMAIL",
    "subject": "Order {{orderNumber}} confirmed",
    "body": "<h1>Thank you...</h1>",
    "locale": "ro",
    "isActive": true,
    "version": 1,
    "createdBy": "admin-uuid",
    "createdAt": "2026-02-12T10:00:00Z",
    "updatedAt": "2026-02-12T10:00:00Z"
  }
]
```

**Example**:

```bash
curl -X GET http://localhost:8000/api/v1/notifications/templates \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### 4. Create Template

Create a new email template.

**Endpoint**: `POST /templates`

**Auth**: Admin only

**Request Body**:

```json
{
  "name": "Payment Reminder",
  "slug": "payment_reminder",
  "channel": "EMAIL",
  "subject": "Payment Due - Invoice {{invoiceNumber}}",
  "body": "<h1>Payment Reminder</h1><p>Dear {{customerName}},</p><p>Invoice {{invoiceNumber}} is due on {{dueDate}}.</p>",
  "locale": "ro",
  "isActive": true
}
```

**Response**:

```json
{
  "success": true,
  "message": "Template created",
  "templateId": "uuid-generated",
  "template": {
    "id": "uuid-generated",
    "name": "Payment Reminder",
    "slug": "payment_reminder",
    "channel": "EMAIL",
    "subject": "Payment Due - Invoice {{invoiceNumber}}",
    "body": "<h1>Payment Reminder</h1>...",
    "locale": "ro",
    "isActive": true,
    "version": 1,
    "createdBy": "admin-uuid",
    "createdAt": "2026-02-12T12:00:00Z",
    "updatedAt": "2026-02-12T12:00:00Z"
  }
}
```

**Example**:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "Welcome Email",
    "slug": "welcome_email",
    "channel": "EMAIL",
    "subject": "Welcome to LEDUX",
    "body": "<h1>Welcome {{name}}!</h1><p>Thank you for joining us.</p>",
    "locale": "ro",
    "isActive": true
  }'
```

---

### 5. Update Template

Update an existing template.

**Endpoint**: `PUT /templates/:id`

**Auth**: Admin only

**Request Body**:

```json
{
  "name": "Updated Template Name",
  "subject": "New Subject {{variable}}",
  "body": "<h1>Updated body</h1>",
  "isActive": false
}
```

**Response**:

```json
{
  "success": true,
  "message": "Template updated",
  "templateId": "uuid",
  "template": {
    "id": "uuid",
    "name": "Updated Template Name",
    "subject": "New Subject {{variable}}",
    "body": "<h1>Updated body</h1>",
    "isActive": false,
    "updatedAt": "2026-02-12T13:00:00Z"
  }
}
```

**Example**:

```bash
curl -X PUT http://localhost:8000/api/v1/notifications/templates/uuid-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "subject": "Updated Subject",
    "isActive": true
  }'
```

---

### 6. Delete Template

Delete a template.

**Endpoint**: `DELETE /templates/:id`

**Auth**: Admin only

**Response**:

```json
{
  "message": "Template deleted",
  "deletedCount": 1
}
```

**Example**:

```bash
curl -X DELETE http://localhost:8000/api/v1/notifications/templates/uuid-123 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Other Notification Endpoints

### 7. Get Notification History

Get notification history for the authenticated user.

**Endpoint**: `GET /history`

**Auth**: User

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `cursor` (optional): Cursor for pagination

**Response**:

```json
{
  "notifications": [
    {
      "id": "notif-1",
      "channel": "EMAIL",
      "subject": "Order Confirmation",
      "status": "SENT",
      "createdAt": "2026-02-12T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}
```

**Example**:

```bash
curl -X GET "http://localhost:8000/api/v1/notifications/history?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 8. Get Notification Detail

Get details of a specific notification.

**Endpoint**: `GET /:id`

**Auth**: User

**Response**:

```json
{
  "notificationId": "uuid",
  "channel": "EMAIL",
  "subject": "Order Confirmation",
  "body": "Email content...",
  "status": "DELIVERED",
  "createdAt": "2026-02-12T10:00:00Z",
  "deliveredAt": "2026-02-12T10:01:00Z"
}
```

**Example**:

```bash
curl -X GET http://localhost:8000/api/v1/notifications/uuid-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 9. Retry Failed Notification

Retry a failed notification.

**Endpoint**: `POST /:id/retry`

**Auth**: Admin only

**Response**:

```json
{
  "notificationId": "uuid",
  "message": "Retry queued"
}
```

**Example**:

```bash
curl -X POST http://localhost:8000/api/v1/notifications/uuid-123/retry \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### 10. Get Notification Statistics

Get notification statistics for a date range.

**Endpoint**: `GET /stats`

**Auth**: Admin only

**Query Parameters**:
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)

**Response**:

```json
{
  "period": {
    "startDate": "2026-02-05T00:00:00Z",
    "endDate": "2026-02-12T23:59:59Z"
  },
  "summary": {
    "total": 1000,
    "sent": 950,
    "delivered": 920,
    "failed": 50
  }
}
```

**Example**:

```bash
curl -X GET "http://localhost:8000/api/v1/notifications/stats?startDate=2026-02-01&endDate=2026-02-12" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## User Preference Endpoints

### 11. Get My Preferences

Get notification preferences for authenticated user.

**Endpoint**: `GET /preferences`

**Auth**: User

**Response**:

```json
{
  "customerId": "user-uuid",
  "preferences": {
    "email": true,
    "sms": false,
    "whatsapp": true,
    "push": true
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  }
}
```

**Example**:

```bash
curl -X GET http://localhost:8000/api/v1/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 12. Update My Preferences

Update notification preferences.

**Endpoint**: `PUT /preferences`

**Auth**: User

**Request Body**:

```json
{
  "preferences": {
    "email": true,
    "sms": false,
    "whatsapp": true
  },
  "quietHours": {
    "enabled": true,
    "start": "23:00",
    "end": "07:00"
  }
}
```

**Response**:

```json
{
  "message": "Preferences updated"
}
```

**Example**:

```bash
curl -X PUT http://localhost:8000/api/v1/notifications/preferences \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "preferences": {
      "email": true,
      "sms": false
    }
  }'
```

---

### 13. Get Batch Status

Get status of a bulk notification batch.

**Endpoint**: `GET /batches/:id`

**Auth**: Admin only

**Response**:

```json
{
  "batchId": "batch-uuid",
  "progress": 75,
  "total": 100,
  "sent": 75,
  "failed": 5,
  "pending": 20
}
```

**Example**:

```bash
curl -X GET http://localhost:8000/api/v1/notifications/batches/batch-123 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Default Templates Available

### 1. B2B Registration Submitted

**Slug**: `b2b_registration_submitted`

**Variables**:
- `companyName`: Company name
- `registrationId`: Registration ID

**Usage**:

```json
{
  "templateSlug": "b2b_registration_submitted",
  "data": {
    "companyName": "Acme Corp",
    "registrationId": "B2B-2026-001"
  }
}
```

---

### 2. B2B Auto-Approved

**Slug**: `b2b_auto_approved`

**Variables**:
- `companyName`: Company name
- `creditLimit`: Credit limit in RON
- `email`: Account email

**Usage**:

```json
{
  "templateSlug": "b2b_auto_approved",
  "data": {
    "companyName": "Acme Corp",
    "creditLimit": "50000",
    "email": "business@acme.com"
  }
}
```

---

### 3. Order Confirmation

**Slug**: `order_confirmation`

**Variables**:
- `customerName`: Customer name
- `orderNumber`: Order number
- `totalAmount`: Total amount in RON
- `status`: Order status

**Usage**:

```json
{
  "templateSlug": "order_confirmation",
  "data": {
    "customerName": "John Doe",
    "orderNumber": "ORD-12345",
    "totalAmount": "250.00",
    "status": "Processing"
  }
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

## Rate Limits

Rate limits depend on your Resend plan. Check https://resend.com/pricing for details.

---

**Last Updated**: 2026-02-12
**Version**: 1.0.0
