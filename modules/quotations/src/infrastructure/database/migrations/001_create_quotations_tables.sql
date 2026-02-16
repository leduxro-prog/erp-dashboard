-- Create Quotations Tables
-- Base schema for quotations module

-- Main quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,

  -- Dates
  quote_date TIMESTAMP NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- Possible values: 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'

  -- Financial
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 19,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'EUR',

  -- Additional info
  notes TEXT,
  terms_and_conditions TEXT,
  rejection_reason TEXT,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Converted order reference
  converted_to_order_id UUID
);

-- Quotation items table
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Pricing
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 19,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,

  -- Display order
  sort_order INTEGER DEFAULT 0,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_quote_date ON quotations(quote_date);
CREATE INDEX idx_quotations_expiry_date ON quotations(expiry_date);
CREATE INDEX idx_quotations_deleted_at ON quotations(deleted_at);
CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX idx_quotation_items_product_id ON quotation_items(product_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_quotations_updated_at();

-- Function to generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  year_str VARCHAR(4);
BEGIN
  year_str := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 'Q-' || year_str || '-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM quotations
  WHERE quote_number LIKE 'Q-' || year_str || '-%';

  RETURN 'Q-' || year_str || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE quotations IS 'Customer quotations with full pricing and status tracking';
COMMENT ON TABLE quotation_items IS 'Line items for each quotation';
COMMENT ON COLUMN quotations.status IS 'Quote lifecycle status: draft, sent, viewed, accepted, rejected, expired, converted';
COMMENT ON COLUMN quotations.deleted_at IS 'Soft delete timestamp - NULL means active';
COMMENT ON FUNCTION generate_quote_number() IS 'Generates sequential quote numbers in format Q-YYYY-NNNNNN';
