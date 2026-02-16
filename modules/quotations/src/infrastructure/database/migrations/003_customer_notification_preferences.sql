-- Customer Notification Preferences
CREATE TABLE IF NOT EXISTS customer_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,

  -- Event-specific preferences
  quote_sent_email BOOLEAN DEFAULT true,
  quote_sent_sms BOOLEAN DEFAULT false,
  quote_sent_whatsapp BOOLEAN DEFAULT true,

  quote_reminder_email BOOLEAN DEFAULT true,
  quote_reminder_sms BOOLEAN DEFAULT true,
  quote_reminder_whatsapp BOOLEAN DEFAULT true,

  quote_accepted_email BOOLEAN DEFAULT true,
  quote_accepted_sms BOOLEAN DEFAULT false,
  quote_accepted_whatsapp BOOLEAN DEFAULT false,

  quote_rejected_email BOOLEAN DEFAULT true,
  quote_rejected_sms BOOLEAN DEFAULT false,
  quote_rejected_whatsapp BOOLEAN DEFAULT false,

  quote_expired_email BOOLEAN DEFAULT true,
  quote_expired_sms BOOLEAN DEFAULT false,
  quote_expired_whatsapp BOOLEAN DEFAULT false,

  -- Contact info for each channel
  email_address VARCHAR(255),
  sms_phone VARCHAR(50),
  whatsapp_phone VARCHAR(50),

  -- Quiet hours (don't send notifications during these hours)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone VARCHAR(50) DEFAULT 'Europe/Bucharest',

  -- Frequency limits
  max_emails_per_day INTEGER DEFAULT 10,
  max_sms_per_day INTEGER DEFAULT 5,
  max_whatsapp_per_day INTEGER DEFAULT 10,

  -- Language preference
  language VARCHAR(10) DEFAULT 'ro',

  -- Created/Updated timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_customer_preferences UNIQUE(customer_id)
);

-- Indexes
CREATE INDEX idx_customer_notification_prefs_customer_id ON customer_notification_preferences(customer_id);

-- Notification Log for rate limiting
CREATE TABLE IF NOT EXISTS customer_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'quote_sent', 'quote_reminder', etc.
  channel VARCHAR(20) NOT NULL, -- 'email', 'sms', 'whatsapp'
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Metadata
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  metadata JSONB
);

-- Indexes for notification log
CREATE INDEX idx_notification_log_customer_id ON customer_notification_log(customer_id);
CREATE INDEX idx_notification_log_sent_at ON customer_notification_log(sent_at);
CREATE INDEX idx_notification_log_type_channel ON customer_notification_log(notification_type, channel);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_update_notification_preferences_updated_at
  BEFORE UPDATE ON customer_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Default preferences for existing customers
INSERT INTO customer_notification_preferences (customer_id, email_address, whatsapp_phone)
SELECT
  c.id,
  c.email,
  c.phone
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM customer_notification_preferences cnp WHERE cnp.customer_id = c.id
)
ON CONFLICT (customer_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE customer_notification_preferences IS 'Stores customer preferences for notification channels and frequency';
COMMENT ON COLUMN customer_notification_preferences.quiet_hours_enabled IS 'If true, notifications will not be sent during quiet hours';
COMMENT ON COLUMN customer_notification_preferences.max_emails_per_day IS 'Maximum number of emails to send per day (0 = unlimited)';
COMMENT ON TABLE customer_notification_log IS 'Logs all notifications sent to customers for rate limiting and auditing';
