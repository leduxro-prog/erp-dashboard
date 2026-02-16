-- B2B Platform Extension Schema for Lighting & Electrical
-- Extends the existing cypher_erp schema

-- =====================================================================
-- PRODUCT SPECIFICATIONS FOR LIGHTING/ELECTRICAL
-- =====================================================================

-- Extended product specs table for lighting-specific attributes
CREATE TABLE IF NOT EXISTS product_specifications (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Lighting specs
  wattage DECIMAL(8,2),
  lumens INTEGER,
  color_temperature INTEGER, -- in Kelvin (3000, 4000, 5000, 6500)
  cri INTEGER CHECK (cri IS NULL OR (cri >= 0 AND cri <= 100)), -- Color Rendering Index
  beam_angle INTEGER,
  ip_rating VARCHAR(10), -- IP20, IP44, IP65, IP66, IP67, IP68
  efficacy DECIMAL(8,2), -- lumens per watt
  dimmable BOOLEAN DEFAULT false,
  dimming_type VARCHAR(50), -- DALI, 0-10V, TRIAC, Zigbee, WiFi
  -- Electrical specs
  voltage_input VARCHAR(50), -- 220-240V, 100-277V, 12V, 24V, 48V
  voltage_output VARCHAR(50),
  power_factor DECIMAL(4,2),
  frequency VARCHAR(20), -- 50Hz, 60Hz, 50/60Hz
  -- Physical
  mounting_type VARCHAR(100), -- Surface, Recessed, Pendant, Track, Wall
  material VARCHAR(100), -- Aluminium, Steel, Plastic, Glass
  color VARCHAR(50), -- White, Black, Silver, Custom
  lifespan_hours INTEGER, -- L70/L80 rated hours
  warranty_years INTEGER,
  -- Certifications
  certification_ce BOOLEAN DEFAULT false,
  certification_rohs BOOLEAN DEFAULT false,
  certification_ul BOOLEAN DEFAULT false,
  certification_etl BOOLEAN DEFAULT false,
  certification_enec BOOLEAN DEFAULT false,
  energy_class VARCHAR(10), -- A++, A+, A, B, C, D, E
  -- Documents
  datasheet_url VARCHAR(500),
  ies_file_url VARCHAR(500),
  installation_guide_url VARCHAR(500),
  -- Extra
  brand VARCHAR(100),
  manufacturer VARCHAR(100),
  country_of_origin VARCHAR(50),
  ean_code VARCHAR(20),
  custom_specs JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_specs_wattage ON product_specifications(wattage);
CREATE INDEX IF NOT EXISTS idx_product_specs_color_temp ON product_specifications(color_temperature);
CREATE INDEX IF NOT EXISTS idx_product_specs_ip_rating ON product_specifications(ip_rating);
CREATE INDEX IF NOT EXISTS idx_product_specs_brand ON product_specifications(brand);
CREATE INDEX IF NOT EXISTS idx_product_specs_dimmable ON product_specifications(dimmable);
CREATE INDEX IF NOT EXISTS idx_product_specs_mounting ON product_specifications(mounting_type);

-- =====================================================================
-- SUPPLIER STOCK SYNC (for real-time supplier inventory)
-- =====================================================================

CREATE TABLE IF NOT EXISTS supplier_stock_feeds (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  feed_type VARCHAR(20) NOT NULL DEFAULT 'CSV', -- CSV, API, XML, EXCEL
  feed_url VARCHAR(500), -- URL for API/file download
  feed_config JSONB DEFAULT '{}', -- API auth, column mapping, etc.
  sync_interval_minutes INTEGER DEFAULT 60,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status VARCHAR(20) DEFAULT 'NEVER', -- NEVER, SUCCESS, FAILED, IN_PROGRESS
  last_sync_error TEXT,
  products_synced INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supplier stock cache (updated from feeds)
CREATE TABLE IF NOT EXISTS supplier_stock_cache (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  supplier_sku VARCHAR(100) NOT NULL,
  supplier_product_name VARCHAR(500),
  quantity_available INTEGER DEFAULT 0,
  supplier_price DECIMAL(12,2),
  currency_code VARCHAR(3) DEFAULT 'RON',
  lead_time_days INTEGER DEFAULT 3,
  min_order_qty INTEGER DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_available BOOLEAN DEFAULT true,
  raw_data JSONB DEFAULT '{}',
  UNIQUE(supplier_id, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_supplier_stock_product ON supplier_stock_cache(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_sku ON supplier_stock_cache(supplier_sku);
CREATE INDEX IF NOT EXISTS idx_supplier_stock_available ON supplier_stock_cache(is_available);

-- =====================================================================
-- B2B CUSTOMERS (extended from existing b2b_registrations)
-- =====================================================================

CREATE TABLE IF NOT EXISTS b2b_customers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  registration_id BIGINT REFERENCES b2b_registrations(id) ON DELETE SET NULL,
  company_name VARCHAR(255) NOT NULL,
  cui VARCHAR(20), -- CUI/CIF
  reg_com VARCHAR(30), -- J xx/xxxx/xxxx
  legal_address TEXT,
  delivery_address TEXT,
  contact_person VARCHAR(200),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  bank_name VARCHAR(200),
  iban VARCHAR(50),
  tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD', -- STANDARD, SILVER, GOLD, PLATINUM
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  credit_limit DECIMAL(12,2) DEFAULT 0,
  credit_used DECIMAL(12,2) DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 0, -- 0 = cash, 15, 30, 45, 60
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, BLOCKED
  notes TEXT,
  last_order_at TIMESTAMP WITH TIME ZONE,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(14,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_customers_user ON b2b_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_customers_email ON b2b_customers(email);
CREATE INDEX IF NOT EXISTS idx_b2b_customers_tier ON b2b_customers(tier);
CREATE INDEX IF NOT EXISTS idx_b2b_customers_status ON b2b_customers(status);
CREATE INDEX IF NOT EXISTS idx_b2b_customers_cui ON b2b_customers(cui);

-- =====================================================================
-- B2B ORDERS
-- =====================================================================

CREATE TABLE IF NOT EXISTS b2b_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(30) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES b2b_customers(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
  order_type VARCHAR(20) DEFAULT 'STANDARD', -- STANDARD, BULK, REORDER, QUICK
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  vat_amount DECIMAL(14,2) DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(3) DEFAULT 'RON',
  payment_method VARCHAR(30), -- CREDIT, TRANSFER, CASH, CARD
  payment_status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PARTIAL, PAID, OVERDUE
  payment_due_date DATE,
  shipping_address TEXT,
  billing_address TEXT,
  notes TEXT,
  internal_notes TEXT,
  source VARCHAR(20) DEFAULT 'B2B_PORTAL', -- B2B_PORTAL, PHONE, EMAIL, IMPORT
  created_by BIGINT REFERENCES users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS b2b_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sku VARCHAR(100),
  product_name VARCHAR(255),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  total_price DECIMAL(14,2) NOT NULL,
  stock_source VARCHAR(20) DEFAULT 'LOCAL', -- LOCAL, SUPPLIER
  supplier_id BIGINT REFERENCES suppliers(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_orders_customer ON b2b_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_status ON b2b_orders(status);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_created ON b2b_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_b2b_order_items_order ON b2b_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_b2b_order_items_product ON b2b_order_items(product_id);

-- =====================================================================
-- B2B SHOPPING CART
-- =====================================================================

CREATE TABLE IF NOT EXISTS b2b_cart (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES b2b_customers(id) ON DELETE CASCADE,
  name VARCHAR(200) DEFAULT 'Default Cart',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS b2b_cart_items (
  id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT NOT NULL REFERENCES b2b_cart(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cart_id, product_id)
);

-- =====================================================================
-- B2B FAVORITES / WISHLIST
-- =====================================================================

CREATE TABLE IF NOT EXISTS b2b_favorites (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES b2b_customers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, product_id)
);

-- =====================================================================
-- SMARTBILL STOCK MAPPING
-- =====================================================================

CREATE TABLE IF NOT EXISTS smartbill_product_mapping (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  smartbill_product_name VARCHAR(500),
  smartbill_product_code VARCHAR(100),
  warehouse_name VARCHAR(200),
  last_synced_quantity INTEGER,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, smartbill_product_code)
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER trigger_product_specs_updated_at BEFORE UPDATE ON product_specifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trigger_b2b_customers_updated_at BEFORE UPDATE ON b2b_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trigger_b2b_orders_updated_at BEFORE UPDATE ON b2b_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trigger_b2b_cart_updated_at BEFORE UPDATE ON b2b_cart FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trigger_supplier_stock_feeds_updated_at BEFORE UPDATE ON supplier_stock_feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

