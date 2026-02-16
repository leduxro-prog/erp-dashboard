-- CYPHER ERP PostgreSQL 15 Database Schema
-- Complete schema with all tables, indexes, and triggers

-- =====================================================================
-- EXTENSIONS
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================

CREATE TYPE user_role AS ENUM (
  'admin',
  'sales',
  'warehouse',
  'finance',
  'supplier_manager',
  'support',
  'b2b_user',
  'guest'
);

CREATE TYPE gender AS ENUM (
  'M',
  'F',
  'O',
  'N/A'
);

CREATE TYPE customer_type AS ENUM (
  'B2B',
  'B2C'
);

CREATE TYPE customer_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'BANNED'
);

CREATE TYPE order_status AS ENUM (
  'quote_pending',
  'quote_sent',
  'quote_accepted',
  'order_confirmed',
  'supplier_order_placed',
  'awaiting_delivery',
  'in_preparation',
  'ready_to_ship',
  'shipped',
  'delivered',
  'invoiced',
  'paid',
  'cancelled',
  'returned'
);

CREATE TYPE quote_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'expired'
);

CREATE TYPE stock_movement_type AS ENUM (
  'IN',
  'OUT',
  'ADJUSTMENT',
  'RETURN',
  'DAMAGE',
  'LOSS',
  'RETURN_SUPPLIER'
);

CREATE TYPE configurator_type AS ENUM (
  'TRACK',
  'LED_STRIP'
);

CREATE TYPE compatibility_rule_type AS ENUM (
  'INCOMPATIBLE',
  'REQUIRES',
  'OPTIONAL'
);

CREATE TYPE smartbill_sync_type AS ENUM (
  'INVOICE',
  'PROFORMA',
  'STOCK',
  'DELIVERY',
  'PAYMENT'
);

CREATE TYPE woocommerce_sync_type AS ENUM (
  'PRODUCT',
  'PRICE',
  'STOCK',
  'CATEGORY',
  'IMAGES'
);

CREATE TYPE whatsapp_direction AS ENUM (
  'SENT',
  'RECEIVED'
);

CREATE TYPE whatsapp_message_type AS ENUM (
  'CONFIRMATION',
  'STATUS',
  'ALERT',
  'NOTIFICATION',
  'QUOTE'
);

CREATE TYPE notification_type AS ENUM (
  'EMAIL',
  'WHATSAPP',
  'SMS',
  'IN_APP'
);

CREATE TYPE b2b_registration_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

-- =====================================================================
-- USER DOMAIN TABLES
-- =====================================================================

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  role user_role NOT NULL DEFAULT 'guest',
  gender gender DEFAULT 'N/A',
  date_of_birth DATE,
  profile_image_url VARCHAR(500),
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified_at TIMESTAMP WITH TIME ZONE,
  requires_password_change BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_method VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE user_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  device_identifier VARCHAR(255) NOT NULL UNIQUE,
  browser_info VARCHAR(255),
  ip_address VARCHAR(45),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_2fa (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(50) NOT NULL,
  secret_key VARCHAR(255) NOT NULL,
  backup_codes TEXT[],
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- CUSTOMER DOMAIN TABLES
-- =====================================================================

CREATE TABLE customer_tiers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  discount_percentage DECIMAL(5,2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  min_order_value DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
  max_order_value DECIMAL(12,2),
  payment_terms_days INT DEFAULT 30 CHECK (payment_terms_days > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  registration_number VARCHAR(100),
  tax_identification_number VARCHAR(100),
  customer_type customer_type NOT NULL,
  status customer_status NOT NULL DEFAULT 'ACTIVE',
  email VARCHAR(255) NOT NULL UNIQUE CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  phone_number VARCHAR(20),
  website VARCHAR(255),
  contact_person_name VARCHAR(255),
  contact_person_email VARCHAR(255),
  contact_person_phone VARCHAR(20),
  billing_address TEXT NOT NULL,
  billing_city VARCHAR(100),
  billing_state VARCHAR(100),
  billing_postal_code VARCHAR(20),
  billing_country VARCHAR(100),
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_postal_code VARCHAR(20),
  shipping_country VARCHAR(100),
  customer_tier_id BIGINT REFERENCES customer_tiers(id) ON DELETE SET NULL,
  currency_code VARCHAR(3) DEFAULT 'EUR',
  language_code VARCHAR(5) DEFAULT 'en',
  payment_method VARCHAR(50),
  credit_limit DECIMAL(12,2),
  used_credit DECIMAL(12,2) DEFAULT 0 CHECK (used_credit >= 0),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE credit_limits (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  limit_amount DECIMAL(12,2) NOT NULL CHECK (limit_amount > 0),
  used_amount DECIMAL(12,2) DEFAULT 0 CHECK (used_amount >= 0),
  available_amount DECIMAL(12,2) NOT NULL CHECK (available_amount >= 0),
  review_date DATE,
  last_adjustment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- CATEGORY DOMAIN TABLES
-- =====================================================================

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  image_url VARCHAR(500),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE category_translations (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  language_code VARCHAR(5) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category_id, language_code)
);

-- =====================================================================
-- PRODUCT DOMAIN TABLES
-- =====================================================================

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  base_price DECIMAL(12,2) NOT NULL CHECK (base_price >= 0),
  currency_code VARCHAR(3) DEFAULT 'EUR',
  unit_of_measure VARCHAR(50),
  weight DECIMAL(10,3),
  dimensions_length DECIMAL(10,2),
  dimensions_width DECIMAL(10,2),
  dimensions_height DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_configurable BOOLEAN NOT NULL DEFAULT false,
  configurator_type configurator_type,
  track_length INT,
  track_profile VARCHAR(100),
  led_type VARCHAR(100),
  led_voltage INT,
  led_color VARCHAR(100),
  supplier_id BIGINT,
  supplier_sku VARCHAR(100),
  min_order_quantity INT DEFAULT 1 CHECK (min_order_quantity > 0),
  lead_time_days INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE product_translations (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  language_code VARCHAR(5) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, language_code)
);

CREATE TABLE product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255),
  sort_order INT DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- SUPPLIER DOMAIN TABLES
-- =====================================================================

CREATE TABLE suppliers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(100) NOT NULL UNIQUE,
  contact_person VARCHAR(255),
  email VARCHAR(255) UNIQUE CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  phone_number VARCHAR(20),
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  website VARCHAR(255),
  payment_terms_days INT DEFAULT 30 CHECK (payment_terms_days > 0),
  lead_time_days INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency_code VARCHAR(3) DEFAULT 'EUR',
  api_key VARCHAR(255),
  api_endpoint VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE supplier_products (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_sku VARCHAR(100) NOT NULL,
  supplier_price DECIMAL(12,2) NOT NULL CHECK (supplier_price >= 0),
  min_order_quantity INT DEFAULT 1 CHECK (min_order_quantity > 0),
  lead_time_days INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(supplier_id, product_id)
);

CREATE TABLE supplier_sku_mappings (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  erp_sku VARCHAR(100) NOT NULL,
  supplier_sku VARCHAR(100) NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(supplier_id, erp_sku)
);

-- =====================================================================
-- WAREHOUSE/STOCK DOMAIN TABLES
-- =====================================================================

CREATE TABLE warehouses (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(100) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  warehouse_manager VARCHAR(255),
  email VARCHAR(255) CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  phone_number VARCHAR(20),
  capacity_units INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_levels (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved INT DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_available INT DEFAULT 0 CHECK (quantity_available >= 0),
  reorder_point INT DEFAULT 10 CHECK (reorder_point >= 0),
  reorder_quantity INT DEFAULT 50 CHECK (reorder_quantity > 0),
  last_counted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, warehouse_id)
);

CREATE TABLE stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  movement_type stock_movement_type NOT NULL,
  quantity INT NOT NULL CHECK (quantity != 0),
  reference_type VARCHAR(50),
  reference_id BIGINT,
  notes TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  previous_quantity INT,
  new_quantity INT,
  sync_source VARCHAR(100),
  sync_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- PRICING DOMAIN TABLES
-- =====================================================================

CREATE TABLE price_rules (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_type VARCHAR(50) NOT NULL,
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  start_date DATE NOT NULL,
  end_date DATE,
  priority INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE volume_discounts (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_tier_id BIGINT REFERENCES customer_tiers(id) ON DELETE CASCADE,
  min_quantity INT NOT NULL CHECK (min_quantity > 0),
  max_quantity INT,
  discount_percentage DECIMAL(5,2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  discount_amount DECIMAL(12,2),
  currency_code VARCHAR(3) DEFAULT 'EUR',
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promotional_prices (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  promotional_price DECIMAL(12,2) NOT NULL CHECK (promotional_price >= 0),
  original_price DECIMAL(12,2) NOT NULL CHECK (original_price > 0),
  discount_percentage DECIMAL(5,2) GENERATED ALWAYS AS (((original_price - promotional_price) / original_price) * 100) STORED,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_prices (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price DECIMAL(12,2) NOT NULL CHECK (custom_price >= 0),
  currency_code VARCHAR(3) DEFAULT 'EUR',
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, product_id)
);

-- =====================================================================
-- QUOTE DOMAIN TABLES
-- =====================================================================

CREATE TABLE quote_templates (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  header_text TEXT,
  footer_text TEXT,
  terms_and_conditions TEXT,
  logo_url VARCHAR(500),
  currency_code VARCHAR(3) DEFAULT 'EUR',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quotes (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quote_number VARCHAR(100) NOT NULL UNIQUE,
  status quote_status NOT NULL DEFAULT 'draft',
  quote_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  currency_code VARCHAR(3) DEFAULT 'EUR',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount DECIMAL(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes TEXT,
  terms_and_conditions TEXT,
  template_id BIGINT REFERENCES quote_templates(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  declined_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quote_items (
  id BIGSERIAL PRIMARY KEY,
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(12,2) NOT NULL CHECK (line_total >= 0),
  discount_amount DECIMAL(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- ORDER DOMAIN TABLES
-- =====================================================================

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_number VARCHAR(100) NOT NULL UNIQUE,
  quote_id BIGINT REFERENCES quotes(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'quote_pending',
  order_date DATE NOT NULL,
  delivery_date DATE,
  currency_code VARCHAR(3) DEFAULT 'EUR',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount DECIMAL(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_cost DECIMAL(12,2) DEFAULT 0 CHECK (shipping_cost >= 0),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount DECIMAL(12,2) DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount DECIMAL(12,2) DEFAULT 0 CHECK (remaining_amount >= 0),
  billing_address TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  internal_notes TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(12,2) NOT NULL CHECK (line_total >= 0),
  discount_amount DECIMAL(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_status_history (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status order_status,
  new_status order_status NOT NULL,
  notes TEXT,
  changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proforma_invoices (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency_code VARCHAR(3) DEFAULT 'EUR',
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  payment_terms TEXT,
  payment_instructions TEXT,
  notes TEXT,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- CONFIGURATOR DOMAIN TABLES
-- =====================================================================

CREATE TABLE configurator_sessions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  configurator_type configurator_type NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  configuration_data JSONB DEFAULT '{}',
  estimated_total DECIMAL(12,2),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE track_configurations (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES configurator_sessions(id) ON DELETE CASCADE,
  profile_type VARCHAR(100) NOT NULL,
  total_length INT NOT NULL CHECK (total_length > 0),
  profile_color VARCHAR(100),
  mounting_type VARCHAR(100),
  cable_entry_type VARCHAR(100),
  end_cap_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE track_config_items (
  id BIGSERIAL PRIMARY KEY,
  track_config_id BIGINT NOT NULL REFERENCES track_configurations(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  sequence_order INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE led_strip_configurations (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES configurator_sessions(id) ON DELETE CASCADE,
  led_type VARCHAR(100) NOT NULL,
  led_color VARCHAR(100) NOT NULL,
  voltage INT NOT NULL,
  total_length INT NOT NULL CHECK (total_length > 0),
  cct_temperature INT,
  brightness_level INT CHECK (brightness_level >= 0 AND brightness_level <= 100),
  ip_rating VARCHAR(20),
  warranty_years INT DEFAULT 1 CHECK (warranty_years > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE led_config_items (
  id BIGSERIAL PRIMARY KEY,
  led_config_id BIGINT NOT NULL REFERENCES led_strip_configurations(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  sequence_order INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE compatibility_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_type compatibility_rule_type NOT NULL,
  product_a_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_b_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (product_a_id != product_b_id)
);

-- =====================================================================
-- INTEGRATION DOMAIN TABLES
-- =====================================================================

CREATE TABLE smartbill_sync (
  id BIGSERIAL PRIMARY KEY,
  sync_type smartbill_sync_type NOT NULL,
  external_id VARCHAR(255),
  resource_type VARCHAR(50) NOT NULL,
  resource_id BIGINT NOT NULL,
  sync_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  response_data JSONB,
  error_message TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE woocommerce_sync (
  id BIGSERIAL PRIMARY KEY,
  sync_type woocommerce_sync_type NOT NULL,
  external_id VARCHAR(255),
  resource_type VARCHAR(50) NOT NULL,
  resource_id BIGINT NOT NULL,
  sync_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  response_data JSONB,
  error_message TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,
  sync_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  records_processed INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- COMMUNICATION DOMAIN TABLES
-- =====================================================================

CREATE TABLE whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  direction whatsapp_direction NOT NULL,
  message_type whatsapp_message_type NOT NULL,
  message_text TEXT NOT NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  quote_id BIGINT REFERENCES quotes(id) ON DELETE SET NULL,
  external_message_id VARCHAR(255),
  delivery_status VARCHAR(50),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  related_entity_type VARCHAR(50),
  related_entity_id BIGINT,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- B2B DOMAIN TABLES
-- =====================================================================

CREATE TABLE b2b_registrations (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  company_name VARCHAR(255) NOT NULL,
  contact_person_name VARCHAR(255) NOT NULL,
  contact_person_phone VARCHAR(20),
  registration_number VARCHAR(100),
  tax_identification_number VARCHAR(100),
  status b2b_registration_status NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_carts (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cart_name VARCHAR(255) NOT NULL,
  notes TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0 CHECK (total_amount >= 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_cart_items (
  id BIGSERIAL PRIMARY KEY,
  saved_cart_id BIGINT NOT NULL REFERENCES saved_carts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(12,2) NOT NULL CHECK (line_total >= 0),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_lists (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  project_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  total_estimated_value DECIMAL(12,2) DEFAULT 0 CHECK (total_estimated_value >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_list_items (
  id BIGSERIAL PRIMARY KEY,
  project_list_id BIGINT NOT NULL REFERENCES project_lists(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  estimated_unit_price DECIMAL(12,2) CHECK (estimated_unit_price IS NULL OR estimated_unit_price >= 0),
  estimated_line_value DECIMAL(12,2) CHECK (estimated_line_value IS NULL OR estimated_line_value >= 0),
  notes TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- SYSTEM DOMAIN TABLES
-- =====================================================================

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  id BIGSERIAL PRIMARY KEY,
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  data_type VARCHAR(50),
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE migrations (
  id BIGSERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  batch INT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- INDEXES
-- =====================================================================

-- User domain indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_device_identifier ON user_devices(device_identifier);

CREATE INDEX idx_user_2fa_user_id ON user_2fa(user_id);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Customer domain indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_customer_type ON customers(customer_type);
CREATE INDEX idx_customers_tier_id ON customers(customer_tier_id);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_deleted_at ON customers(deleted_at);

CREATE INDEX idx_credit_limits_customer_id ON credit_limits(customer_id);

-- Category domain indexes
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_is_active ON categories(is_active);

CREATE INDEX idx_category_translations_category_id ON category_translations(category_id);
CREATE INDEX idx_category_translations_language ON category_translations(language_code);

-- Product domain indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
CREATE INDEX idx_products_is_configurable ON products(is_configurable);

CREATE INDEX idx_product_translations_product_id ON product_translations(product_id);
CREATE INDEX idx_product_translations_language ON product_translations(language_code);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- Supplier domain indexes
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_email ON suppliers(email);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX idx_suppliers_deleted_at ON suppliers(deleted_at);

CREATE INDEX idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_product_id ON supplier_products(product_id);

CREATE INDEX idx_supplier_sku_mappings_supplier_id ON supplier_sku_mappings(supplier_id);
CREATE INDEX idx_supplier_sku_mappings_erp_sku ON supplier_sku_mappings(erp_sku);

-- Warehouse/Stock domain indexes
CREATE INDEX idx_stock_levels_product_id ON stock_levels(product_id);
CREATE INDEX idx_stock_levels_warehouse_id ON stock_levels(warehouse_id);

CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_movement_type ON stock_movements(movement_type);

CREATE INDEX idx_stock_sync_logs_product_id ON stock_sync_logs(product_id);
CREATE INDEX idx_stock_sync_logs_warehouse_id ON stock_sync_logs(warehouse_id);

-- Pricing domain indexes
CREATE INDEX idx_price_rules_product_id ON price_rules(product_id);
CREATE INDEX idx_price_rules_is_active ON price_rules(is_active);

CREATE INDEX idx_volume_discounts_product_id ON volume_discounts(product_id);
CREATE INDEX idx_volume_discounts_tier_id ON volume_discounts(customer_tier_id);

CREATE INDEX idx_promotional_prices_product_id ON promotional_prices(product_id);
CREATE INDEX idx_promotional_prices_active_range ON promotional_prices(start_date, end_date) WHERE is_active = true;

CREATE INDEX idx_customer_prices_customer_id ON customer_prices(customer_id);
CREATE INDEX idx_customer_prices_product_id ON customer_prices(product_id);

-- Quote domain indexes
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created_at ON quotes(created_at);
CREATE INDEX idx_quotes_quote_date ON quotes(quote_date);

CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_quote_items_product_id ON quote_items(product_id);

-- Order domain indexes
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at);
CREATE INDEX idx_orders_assigned_to ON orders(assigned_to);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);

CREATE INDEX idx_proforma_invoices_order_id ON proforma_invoices(order_id);
CREATE INDEX idx_proforma_invoices_issue_date ON proforma_invoices(issue_date);

-- Configurator domain indexes
CREATE INDEX idx_configurator_sessions_customer_id ON configurator_sessions(customer_id);
CREATE INDEX idx_configurator_sessions_user_id ON configurator_sessions(user_id);
CREATE INDEX idx_configurator_sessions_session_token ON configurator_sessions(session_token);
CREATE INDEX idx_configurator_sessions_expires_at ON configurator_sessions(expires_at);

CREATE INDEX idx_track_configurations_session_id ON track_configurations(session_id);

CREATE INDEX idx_track_config_items_track_config_id ON track_config_items(track_config_id);
CREATE INDEX idx_track_config_items_product_id ON track_config_items(product_id);

CREATE INDEX idx_led_strip_configurations_session_id ON led_strip_configurations(session_id);

CREATE INDEX idx_led_config_items_led_config_id ON led_config_items(led_config_id);
CREATE INDEX idx_led_config_items_product_id ON led_config_items(product_id);

CREATE INDEX idx_compatibility_rules_product_a_id ON compatibility_rules(product_a_id);
CREATE INDEX idx_compatibility_rules_product_b_id ON compatibility_rules(product_b_id);

-- Integration domain indexes
CREATE INDEX idx_smartbill_sync_resource ON smartbill_sync(resource_type, resource_id);
CREATE INDEX idx_smartbill_sync_status ON smartbill_sync(sync_status);

CREATE INDEX idx_woocommerce_sync_resource ON woocommerce_sync(resource_type, resource_id);
CREATE INDEX idx_woocommerce_sync_status ON woocommerce_sync(sync_status);

CREATE INDEX idx_supplier_sync_logs_supplier_id ON supplier_sync_logs(supplier_id);
CREATE INDEX idx_supplier_sync_logs_created_at ON supplier_sync_logs(created_at);

-- Communication domain indexes
CREATE INDEX idx_whatsapp_messages_customer_id ON whatsapp_messages(customer_id);
CREATE INDEX idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_phone_number ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- B2B domain indexes
CREATE INDEX idx_b2b_registrations_email ON b2b_registrations(email);
CREATE INDEX idx_b2b_registrations_status ON b2b_registrations(status);

CREATE INDEX idx_saved_carts_customer_id ON saved_carts(customer_id);

CREATE INDEX idx_saved_cart_items_saved_cart_id ON saved_cart_items(saved_cart_id);

CREATE INDEX idx_project_lists_customer_id ON project_lists(customer_id);

CREATE INDEX idx_project_list_items_project_list_id ON project_list_items(project_list_id);

-- System domain indexes
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_settings_key ON settings(setting_key);

-- =====================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_items_product_warehouse ON stock_levels (product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_date ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_status ON quotes (customer_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_status_valid ON quotes (status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_sku ON supplier_products (supplier_id, supplier_sku);
CREATE INDEX IF NOT EXISTS idx_sku_mappings_supplier_sku ON supplier_sku_mappings (supplier_id, erp_sku);
CREATE INDEX IF NOT EXISTS idx_invoices_order_status ON proforma_invoices (order_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_woocommerce_sync_items_status_type ON woocommerce_sync (sync_status, sync_type);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products (category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku_unique ON products (sku) WHERE is_active = true;

-- =====================================================================
-- TRIGGER FUNCTIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- APPLY TRIGGERS TO ALL TABLES WITH updated_at
-- =====================================================================

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_devices_updated_at
  BEFORE UPDATE ON user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_2fa_updated_at
  BEFORE UPDATE ON user_2fa
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customer_tiers_updated_at
  BEFORE UPDATE ON customer_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_credit_limits_updated_at
  BEFORE UPDATE ON credit_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_category_translations_updated_at
  BEFORE UPDATE ON category_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_product_translations_updated_at
  BEFORE UPDATE ON product_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_supplier_products_updated_at
  BEFORE UPDATE ON supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_supplier_sku_mappings_updated_at
  BEFORE UPDATE ON supplier_sku_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_stock_levels_updated_at
  BEFORE UPDATE ON stock_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_price_rules_updated_at
  BEFORE UPDATE ON price_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_volume_discounts_updated_at
  BEFORE UPDATE ON volume_discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_promotional_prices_updated_at
  BEFORE UPDATE ON promotional_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_customer_prices_updated_at
  BEFORE UPDATE ON customer_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_quote_templates_updated_at
  BEFORE UPDATE ON quote_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_quote_items_updated_at
  BEFORE UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_proforma_invoices_updated_at
  BEFORE UPDATE ON proforma_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_configurator_sessions_updated_at
  BEFORE UPDATE ON configurator_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_track_configurations_updated_at
  BEFORE UPDATE ON track_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_led_strip_configurations_updated_at
  BEFORE UPDATE ON led_strip_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_compatibility_rules_updated_at
  BEFORE UPDATE ON compatibility_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_smartbill_sync_updated_at
  BEFORE UPDATE ON smartbill_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_woocommerce_sync_updated_at
  BEFORE UPDATE ON woocommerce_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_supplier_sync_logs_updated_at
  BEFORE UPDATE ON supplier_sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_b2b_registrations_updated_at
  BEFORE UPDATE ON b2b_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_saved_carts_updated_at
  BEFORE UPDATE ON saved_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_project_lists_updated_at
  BEFORE UPDATE ON project_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_project_list_items_updated_at
  BEFORE UPDATE ON project_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
