-- Customer Addresses Table for B2B Checkout
-- Stores saved shipping/billing addresses for B2B customers

CREATE TABLE IF NOT EXISTS customer_addresses (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES b2b_customers(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  address_type VARCHAR(20) DEFAULT 'both', -- shipping, billing, both
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_default ON customer_addresses(is_default);

-- Trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER trigger_customer_addresses_updated_at 
  BEFORE UPDATE ON customer_addresses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure b2b_orders table has all required columns
DO $$ BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_orders' AND column_name = 'billing_address') THEN
    ALTER TABLE b2b_orders ADD COLUMN billing_address TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_orders' AND column_name = 'order_type') THEN
    ALTER TABLE b2b_orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'STANDARD';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_orders' AND column_name = 'discount_amount') THEN
    ALTER TABLE b2b_orders ADD COLUMN discount_amount DECIMAL(14,2) DEFAULT 0;
  END IF;
END $$;

-- Ensure b2b_order_items table has all required columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_order_items' AND column_name = 'discount_percent') THEN
    ALTER TABLE b2b_order_items ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'b2b_order_items' AND column_name = 'product_name') THEN
    ALTER TABLE b2b_order_items ADD COLUMN product_name VARCHAR(255);
  END IF;
END $$;

-- Seed test customer addresses for development
INSERT INTO customer_addresses (customer_id, label, address, address_type, is_default)
SELECT 
  bc.id,
  'Sediu Principal',
  'Str. Exemplu nr. 123, București, Sector 1, 010101, Romania',
  'both',
  true
FROM b2b_customers bc
WHERE NOT EXISTS (
  SELECT 1 FROM customer_addresses ca WHERE ca.customer_id = bc.id
)
LIMIT 5;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_addresses TO cypher_user;
GRANT USAGE, SELECT ON SEQUENCE customer_addresses_id_seq TO cypher_user;
