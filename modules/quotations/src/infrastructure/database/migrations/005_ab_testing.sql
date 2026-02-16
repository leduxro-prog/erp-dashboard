-- A/B Testing for Email Templates

CREATE TABLE IF NOT EXISTS email_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  variants JSONB NOT NULL, -- Array of EmailVariant objects
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'running', 'completed', 'paused'
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  target_sample_size INTEGER,
  success_metric VARCHAR(50) NOT NULL, -- 'open-rate', 'click-rate', 'conversion-rate'
  winner_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Customer assignments to variants
CREATE TABLE IF NOT EXISTS email_ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES email_ab_tests(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  variant_id VARCHAR(100) NOT NULL,
  variant_data JSONB NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_test_customer UNIQUE(test_id, customer_id)
);

-- Event tracking for A/B tests
CREATE TABLE IF NOT EXISTS email_ab_test_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES email_ab_tests(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'sent', 'opened', 'clicked', 'converted'
  event_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ab_tests_status ON email_ab_tests(status);
CREATE INDEX idx_ab_tests_dates ON email_ab_tests(start_date, end_date);
CREATE INDEX idx_ab_test_assignments_test_id ON email_ab_test_assignments(test_id);
CREATE INDEX idx_ab_test_assignments_customer_id ON email_ab_test_assignments(customer_id);
CREATE INDEX idx_ab_test_events_test_id ON email_ab_test_events(test_id);
CREATE INDEX idx_ab_test_events_customer_id ON email_ab_test_events(customer_id);
CREATE INDEX idx_ab_test_events_type ON email_ab_test_events(event_type);
CREATE INDEX idx_ab_test_events_created_at ON email_ab_test_events(created_at);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_ab_tests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ab_tests_updated_at
  BEFORE UPDATE ON email_ab_tests
  FOR EACH ROW
  EXECUTE FUNCTION update_ab_tests_updated_at();

-- Comments
COMMENT ON TABLE email_ab_tests IS 'A/B tests for email template optimization';
COMMENT ON TABLE email_ab_test_assignments IS 'Maps customers to specific test variants';
COMMENT ON TABLE email_ab_test_events IS 'Tracks email events for A/B test analysis';
COMMENT ON COLUMN email_ab_tests.success_metric IS 'Metric to optimize: open-rate, click-rate, or conversion-rate';
COMMENT ON COLUMN email_ab_tests.winner_id IS 'ID of winning variant once test is completed';
