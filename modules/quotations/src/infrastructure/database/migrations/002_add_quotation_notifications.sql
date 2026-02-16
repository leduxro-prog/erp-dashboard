-- Create quotation_notifications table for workflow automation
CREATE TABLE IF NOT EXISTS quotation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'reminder', 'follow-up', 'sent', etc.
  channel VARCHAR(100) NOT NULL, -- 'email', 'whatsapp', 'email,whatsapp'
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_quotation_notifications_quotation_id ON quotation_notifications(quotation_id);
CREATE INDEX idx_quotation_notifications_type ON quotation_notifications(type);
CREATE INDEX idx_quotation_notifications_sent_at ON quotation_notifications(sent_at);

-- Add accepted_at column to quotations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE quotations ADD COLUMN accepted_at TIMESTAMP;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE quotation_notifications IS 'Tracks all automated and manual notifications sent for quotations';
COMMENT ON COLUMN quotation_notifications.type IS 'Type of notification: reminder, follow-up, sent';
COMMENT ON COLUMN quotation_notifications.channel IS 'Communication channel(s) used';
COMMENT ON COLUMN quotation_notifications.metadata IS 'Additional notification metadata (days until expiry, etc.)';
