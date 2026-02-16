# Quotations Module - Advanced Features Implementation

## ✅ Completed Features

### 1. 📝 Formular Creare Ofertă (Complete Quote Creation Form)
- **File**: `/opt/cypher-erp/frontend/src/components/quotations/CreateQuoteForm.tsx`
- **Features**:
  - 3-step wizard interface (Customer → Products → Details)
  - Customer search and selection with full details display
  - Product search with quantity, price, discount, and tax configuration
  - Real-time subtotal calculation
  - Global discount percentage
  - Expiry date configuration
  - Notes and terms & conditions fields
  - Final totals display (subtotal, discount, tax, total)

### 2. 📧 Template-uri Email Personalizate (Professional Email Templates)
- **File**: `/opt/cypher-erp/modules/quotations/src/infrastructure/templates/EmailTemplates.ts`
- **Templates**:
  - **quoteSent()** - Full HTML email with:
    - Gradient header design
    - Responsive layout
    - Items table with prices
    - Totals breakdown
    - CTA button to view quote
    - Company branding
  - **quoteReminder()** - Expiration reminder email with alert styling
  - **whatsAppMessage()** - Formatted WhatsApp message with emojis

### 3. 📱 Notificări WhatsApp Automate (WhatsApp Notifications)
- **File**: `/opt/cypher-erp/modules/quotations/src/infrastructure/notifications/WhatsAppService.ts`
- **Features**:
  - Integration with WhatsApp Business API
  - Send quote notifications with optional PDF attachment
  - Send reminder notifications for expiring quotes
  - Phone number validation and formatting
  - Support for both text and document messages
  - Development mode with console logging

### 4. 📈 Dashboard Analytics (Comprehensive Analytics)
- **Backend Service**: `/opt/cypher-erp/modules/quotations/src/application/services/QuoteAnalyticsService.ts`
- **Frontend Component**: `/opt/cypher-erp/frontend/src/components/quotations/QuoteAnalyticsDashboard.tsx`
- **Metrics**:
  - Total quotes, draft, sent, accepted, rejected, expired, converted
  - Total value and accepted value
  - Conversion rate with period comparison
  - Average quote value
  - Average time to accept (in days)
  - Period-over-period comparison (% change)
- **Analytics**:
  - Quote trends over time (daily/weekly/monthly)
  - Top customers by quote value
  - Top quoted products with conversion rates
  - Quotes expiring soon (within N days)
  - Quotes needing follow-up (no response)
- **Dashboard Features**:
  - Date range selector (7d, 30d, 90d, 1y)
  - KPI cards with trend indicators
  - Status breakdown visualization
  - Top customers list
  - Top products list
  - Expiring quotes alerts

### 5. 🔄 Workflow Automation (Automated Reminders & Follow-ups)
- **File**: `/opt/cypher-erp/modules/quotations/src/infrastructure/automation/QuoteWorkflowService.ts`
- **Features**:
  - **Automated Reminders**:
    - Configurable reminder days (default: 7, 3, 1 days before expiry)
    - Runs daily at 9:00 AM via cron
    - Multi-channel support (email + WhatsApp)
    - Prevents duplicate reminders
  - **Follow-up Notifications**:
    - Configurable follow-up delay (default: 3 days without response)
    - Runs daily at 10:00 AM
    - Targets quotes with "sent" status
  - **Auto-Expire**:
    - Automatically marks expired quotes
    - Runs daily at 1:00 AM
  - **Manual Triggers**:
    - Send manual reminder for specific quote
    - Workflow statistics tracking
  - **Configuration**:
    - Enable/disable automation
    - Configure reminder days
    - Configure follow-up delay
    - Select notification channels
    - Auto-expire on/off

### 6. 🔧 Database & Infrastructure
- **Migration**: `/opt/cypher-erp/modules/quotations/src/infrastructure/database/migrations/002_add_quotation_notifications.sql`
  - Created `quotation_notifications` table
  - Tracks all sent notifications (type, channel, metadata)
  - Added `accepted_at` column to `quotations` table
  - Indexes for performance optimization

### 7. 🛣️ API Endpoints
**File**: `/opt/cypher-erp/modules/quotations/src/api/controllers/QuotationController.ts`

#### Analytics Endpoints:
- `GET /api/v1/quotes/analytics/metrics` - Get metrics for date range
- `GET /api/v1/quotes/analytics/trends` - Get trends over time
- `GET /api/v1/quotes/analytics/top-customers` - Top customers by value
- `GET /api/v1/quotes/analytics/top-products` - Top quoted products
- `GET /api/v1/quotes/analytics/expiring` - Quotes expiring soon

#### Workflow Endpoints:
- `POST /api/v1/quotes/:id/remind` - Send manual reminder
- `GET /api/v1/quotes/workflow/stats` - Workflow statistics

### 8. 🎨 UI Fixes
- **Sidebar Navigation**: Fixed "Ofertare" link visibility
  - Changed label from "Citate" to "Ofertare"
  - Updated icon to FileText for better recognition
  - Located in VANZARI section

## 📋 Configuration

### Environment Variables
Add to your `.env` file:

```bash
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_API_KEY=your_api_key_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Company Details (for email templates)
COMPANY_NAME=LEDUX.RO
COMPANY_EMAIL=contact@ledux.ro
COMPANY_PHONE=+40 XXX XXX XXX
APP_URL=https://erp.ledux.ro
```

### Workflow Configuration
The workflow service can be configured programmatically:

```typescript
const workflowService = new QuoteWorkflowService(dataSource, {
  enableAutomation: true,
  reminderDays: [7, 3, 1], // Send reminders 7, 3, and 1 day before expiry
  followUpDays: 3, // Follow up after 3 days without response
  autoExpireEnabled: true,
  notificationChannels: ['email', 'whatsapp'],
});

// Start the automation
workflowService.start();
```

## 🚀 Usage Examples

### Create Quote with Form
1. Navigate to Ofertare → Creare Ofertă Nouă
2. Step 1: Search and select customer
3. Step 2: Add products with quantities and prices
4. Step 3: Set expiry date, discount, notes
5. Submit to create quote

### Send Quote with Notifications
```typescript
// Send via email only
POST /api/v1/quotes/:id/send
{ "sendWhatsApp": false }

// Send via email + WhatsApp
POST /api/v1/quotes/:id/send
{ "sendWhatsApp": true }
```

### View Analytics Dashboard
- Navigate to Ofertare → Analytics tab
- Select date range (7d, 30d, 90d, 1y)
- View KPIs, trends, top customers/products
- Check expiring quotes alerts

### Manual Reminder
```typescript
POST /api/v1/quotes/:id/remind
```

## 📊 Database Schema

### quotation_notifications
```sql
CREATE TABLE quotation_notifications (
  id UUID PRIMARY KEY,
  quotation_id UUID REFERENCES quotations(id),
  type VARCHAR(50), -- 'reminder', 'follow-up', 'sent'
  channel VARCHAR(100), -- 'email', 'whatsapp', 'email,whatsapp'
  sent_at TIMESTAMP,
  metadata JSONB, -- Additional data (daysUntilExpiry, etc.)
  created_at TIMESTAMP
);
```

## 🔐 Security & Permissions
- All endpoints require authentication
- Admin role required for quote conversion
- Rate limiting recommended for WhatsApp API
- API keys stored in environment variables

## 📈 Next Steps (Optional Enhancements)
1. Integrate email service (SendGrid, AWS SES, etc.)
2. Add WhatsApp Business API credentials
3. Create email/WhatsApp templates in admin panel
4. Add notification preferences per customer
5. Implement A/B testing for email templates
6. Add SMS notifications as alternative channel
7. Create scheduled reports (daily/weekly summaries)
8. Add quote comparison feature
9. Implement quote versioning
10. Add bulk operations (bulk send, bulk expire)

## ✅ Testing Checklist
- [ ] Create quote with form (all 3 steps)
- [ ] Send quote via API
- [ ] View analytics dashboard
- [ ] Test manual reminder
- [ ] Verify cron jobs run (wait for scheduled time)
- [ ] Check notification logs in database
- [ ] Test date range filters
- [ ] Verify WhatsApp message formatting
- [ ] Test email template rendering
- [ ] Verify auto-expire functionality

## 📝 Notes
- WhatsApp service works in development mode (console logging) until API credentials are configured
- Email service integration needs to be completed (use EmailTemplates with your email provider)
- Cron jobs start automatically when the module is initialized
- All monetary values are in EUR by default
- Romanian language used throughout UI and notifications
