-- ================================================================
-- Migration: 0002 - Catalog, Customers, Pricing, Stock Tables
-- Author: AI 2 (Data/DB)
-- Date: 2026-02-13
-- ================================================================
-- Description: Create core B2B tables for catalog, customers, pricing, and stock
-- Impact: Creates foundational data structures for B2B operations
-- Rollback: DROP TABLE IF EXISTS ... CASCADE; DROP TYPE IF EXISTS ...
-- ================================================================

-- ================================================================
-- TYPES (ENUMS)
-- ================================================================

-- Product status
CREATE TYPE b2b_product_status AS ENUM (
    'active',        -- Available for sale
    'inactive',      -- Temporarily unavailable
    'discontinued',  -- No longer sold
    'archived'       -- Removed from catalog
);

-- Customer tier/level
CREATE TYPE b2b_customer_tier AS ENUM (
    'bronze',        -- Basic tier
    'silver',        -- Mid tier
    'gold',          -- High tier
    'platinum',      -- Premium tier
    'vip'            -- Exclusive tier
);

-- Customer status
CREATE TYPE b2b_customer_status AS ENUM (
    'active',        -- Active customer
    'inactive',      -- Temporarily inactive
    'suspended',     -- Suspended (payment/policy)
    'pending',       -- Registration pending
    'blocked'        -- Blocked permanently
);

-- Stock level status
CREATE TYPE b2b_stock_level_status AS ENUM (
    'in_stock',      -- Available for sale
    'low_stock',     -- Below threshold
    'out_of_stock',  -- Zero quantity
    'on_order',      -- On backorder
    'discontinued'   -- No longer available
);

-- Price type
CREATE TYPE b2b_price_type AS ENUM (
    'list',          -- Standard list price
    'net',           -- Net price (after discount)
    'promotion',     -- Promotional price
    'special',       -- Special/custom price
    'cost'           -- Cost price (internal)
);

-- ================================================================
-- CATALOG TABLES
-- ================================================================

-- ================================================================
-- b2b.products
-- Master product catalog
-- ================================================================
CREATE TABLE b2b.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) NOT NULL,
    supplier_sku VARCHAR(100),
    ean_gtin VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),

    -- Category hierarchy
    category_id UUID,
    brand_id UUID,
    supplier_id UUID,

    -- Status flags
    status b2b_product_status NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Product type/attributes
    product_type VARCHAR(100),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'buc',

    -- Weight and dimensions (for shipping)
    weight_kg NUMERIC(10,3),
    length_cm NUMERIC(10,2),
    width_cm NUMERIC(10,2),
    height_cm NUMERIC(10,2),

    -- Pricing defaults (fallback)
    default_price NUMERIC(18,4) CHECK (default_price >= 0),
    default_currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Tax
    tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.2100,  -- 19% default VAT
    tax_class VARCHAR(50) NOT NULL DEFAULT 'standard',

    -- SEO
    slug VARCHAR(255),
    meta_title VARCHAR(255),
    meta_description TEXT,

    -- Media
    primary_media_id UUID,

    -- Stock settings
    manage_stock BOOLEAN NOT NULL DEFAULT true,
    backorders_allowed BOOLEAN NOT NULL DEFAULT false,
    min_stock_level INTEGER,
    max_stock_level INTEGER,

    -- Ordering and display
    display_order INTEGER DEFAULT 0,
    featured BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_products_sku UNIQUE (sku),
    CONSTRAINT uq_products_ean_gtin UNIQUE (ean_gtin),
    CONSTRAINT uq_products_slug UNIQUE (slug),
    CONSTRAINT ck_products_default_price CHECK (default_price IS NULL OR default_price >= 0),
    CONSTRAINT ck_products_weight CHECK (weight_kg IS NULL OR weight_kg >= 0)
);

-- Trigger for updated_at
CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON b2b.products
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_products_sku ON b2b.products(sku);
CREATE INDEX idx_products_supplier_sku ON b2b.products(supplier_sku);
CREATE INDEX idx_products_ean_gtin ON b2b.products(ean_gtin);
CREATE INDEX idx_products_brand ON b2b.products(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_products_category ON b2b.products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_products_status ON b2b.products(status);
CREATE INDEX idx_products_is_active ON b2b.products(is_active);
CREATE INDEX idx_products_updated_at ON b2b.products(updated_at DESC);
CREATE INDEX idx_products_name ON b2b.products USING gin(to_tsvector('romanian', name));

COMMENT ON TABLE b2b.products IS 'Master product catalog for B2B customers';
COMMENT ON COLUMN b2b.products.sku IS 'Stock Keeping Unit - unique identifier for inventory';
COMMENT ON COLUMN b2b.products.ean_gtin IS 'EAN/GTIN barcode - global trade item number';
COMMENT ON COLUMN b2b.products.tax_rate IS 'Tax rate (e.g., 0.2100 for 19% VAT)';

-- ================================================================
-- b2b.product_variants
-- Product variants (size, color, etc.)
-- ================================================================
CREATE TABLE b2b.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,

    -- Identifiers
    sku VARCHAR(50) NOT NULL,
    variant_name VARCHAR(255),
    variant_code VARCHAR(100),

    -- Variant attributes
    variant_type VARCHAR(50),  -- e.g., 'color', 'size'
    variant_value VARCHAR(100), -- e.g., 'red', 'XL'

    -- Pricing override
    price_override NUMERIC(18,4) CHECK (price_override >= 0),
    currency_override CHAR(3),

    -- Stock specific
    stock_level INTEGER NOT NULL DEFAULT 0,
    stock_status b2b_stock_level_status NOT NULL DEFAULT 'in_stock',

    -- Dimensions/weight override
    weight_override_kg NUMERIC(10,3),

    -- Images
    primary_media_id UUID,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_variants_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT uq_variants_sku UNIQUE (sku),
    CONSTRAINT ck_variants_stock CHECK (stock_level >= 0),
    CONSTRAINT ck_variants_price CHECK (price_override IS NULL OR price_override >= 0)
);

CREATE TRIGGER product_variants_updated_at
    BEFORE UPDATE ON b2b.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_product_variants_product_id ON b2b.product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON b2b.product_variants(sku);
CREATE INDEX idx_product_variants_type_value ON b2b.product_variants(variant_type, variant_value);
CREATE INDEX idx_product_variants_is_active ON b2b.product_variants(is_active);

COMMENT ON TABLE b2b.product_variants IS 'Product variants for size, color, etc.';
COMMENT ON COLUMN b2b.product_variants.variant_type IS 'Type of variant (e.g., color, size)';

-- ================================================================
-- b2b.product_media
-- Product images and media files
-- ================================================================
CREATE TABLE b2b.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    variant_id UUID,  -- NULL for product-level media

    -- Media type and URLs
    media_type VARCHAR(50) NOT NULL,  -- image, video, document
    url VARCHAR(1024) NOT NULL,
    thumbnail_url VARCHAR(1024),

    -- Image attributes
    alt_text VARCHAR(255),
    width INTEGER,
    height INTEGER,
    file_size BIGINT,
    mime_type VARCHAR(100),

    -- Display order
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_media_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_media_variant FOREIGN KEY (variant_id)
        REFERENCES b2b.product_variants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT ck_media_display_order CHECK (display_order >= 0)
);

CREATE TRIGGER product_media_updated_at
    BEFORE UPDATE ON b2b.product_media
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_product_media_product_id ON b2b.product_media(product_id);
CREATE INDEX idx_product_media_variant_id ON b2b.product_media(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_product_media_display_order ON b2b.product_media(product_id, display_order);

COMMENT ON TABLE b2b.product_media IS 'Product images and media files';

-- ================================================================
-- b2b.product_attributes
-- Custom product attributes (key-value pairs)
-- ================================================================
CREATE TABLE b2b.product_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    variant_id UUID,  -- NULL for product-level attributes

    -- Attribute definition
    attribute_name VARCHAR(100) NOT NULL,
    attribute_value TEXT NOT NULL,

    -- Attribute grouping
    attribute_group VARCHAR(100),

    -- Display
    display_order INTEGER DEFAULT 0,
    is_filterable BOOLEAN NOT NULL DEFAULT false,
    is_searchable BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_attributes_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_attributes_variant FOREIGN KEY (variant_id)
        REFERENCES b2b.product_variants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TRIGGER product_attributes_updated_at
    BEFORE UPDATE ON b2b.product_attributes
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_product_attributes_product_id ON b2b.product_attributes(product_id);
CREATE INDEX idx_product_attributes_variant_id ON b2b.product_attributes(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_product_attributes_name ON b2b.product_attributes(attribute_name);
CREATE INDEX idx_product_attributes_group ON b2b.product_attributes(attribute_group) WHERE attribute_group IS NOT NULL;

COMMENT ON TABLE b2b.product_attributes IS 'Custom product attributes';

-- ================================================================
-- b2b.price_books
-- Price books for different customer segments
-- ================================================================
CREATE TABLE b2b.price_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,

    -- Scope
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Currency
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Validity period
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,

    -- Customer tier assignment (optional)
    applicable_tier b2b_customer_tier,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_price_books_code UNIQUE (code),
    CONSTRAINT ck_price_books_dates CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_price_books_one_default CHECK (
        (is_default = false) OR
        (NOT EXISTS (
            SELECT 1 FROM b2b.price_books
            WHERE is_default = true AND id != b2b.price_books.id
        ))
    )
);

CREATE TRIGGER price_books_updated_at
    BEFORE UPDATE ON b2b.price_books
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_price_books_code ON b2b.price_books(code);
CREATE INDEX idx_price_books_is_default ON b2b.price_books(is_default) WHERE is_default = true;
CREATE INDEX idx_price_books_tier ON b2b.price_books(applicable_tier) WHERE applicable_tier IS NOT NULL;
CREATE INDEX idx_price_books_validity ON b2b.price_books(valid_from, valid_to);

COMMENT ON TABLE b2b.price_books IS 'Price books for different customer segments';

-- ================================================================
-- b2b.price_book_entries
-- Individual prices in price books
-- ================================================================
CREATE TABLE b2b.price_book_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_book_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID,  -- NULL for product-level pricing

    -- Pricing
    price NUMERIC(18,4) NOT NULL CHECK (price >= 0),
    currency CHAR(3) NOT NULL,

    -- Price type
    price_type b2b_price_type NOT NULL DEFAULT 'list',

    -- Discount
    discount_percent NUMERIC(5,2) CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_fixed NUMERIC(18,4) CHECK (discount_fixed >= 0),

    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_price_entries_book FOREIGN KEY (price_book_id)
        REFERENCES b2b.price_books(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_price_entries_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_price_entries_variant FOREIGN KEY (variant_id)
        REFERENCES b2b.product_variants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT uq_price_entries UNIQUE (price_book_id, product_id, variant_id, valid_from),
    CONSTRAINT ck_price_entries_dates CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TRIGGER price_book_entries_updated_at
    BEFORE UPDATE ON b2b.price_book_entries
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_price_entries_book_product ON b2b.price_book_entries(price_book_id, product_id);
CREATE INDEX idx_price_entries_book_variant ON b2b.price_book_entries(price_book_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_price_entries_product ON b2b.price_book_entries(product_id);
CREATE INDEX idx_price_entries_validity ON b2b.price_book_entries(valid_from, valid_to);
CREATE INDEX idx_price_entries_type ON b2b.price_book_entries(price_type);

COMMENT ON TABLE b2b.price_book_entries IS 'Individual prices in price books';

-- ================================================================
-- b2b.stock_levels
-- Current stock levels across warehouses
-- ================================================================
CREATE TABLE b2b.stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    variant_id UUID,
    warehouse_id VARCHAR(100) NOT NULL,

    -- Quantities
    quantity_available BIGINT NOT NULL DEFAULT 0,
    quantity_reserved BIGINT NOT NULL DEFAULT 0,
    quantity_on_order BIGINT NOT NULL DEFAULT 0,
    quantity_in_transit BIGINT NOT NULL DEFAULT 0,
    quantity_damaged BIGINT NOT NULL DEFAULT 0,
    quantity_returned BIGINT NOT NULL DEFAULT 0,

    -- Stock status
    status b2b_stock_level_status NOT NULL DEFAULT 'in_stock',

    -- Thresholds
    reorder_level INTEGER,
    max_stock_level INTEGER,

    -- Location within warehouse
    bin_location VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_stock_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_stock_variant FOREIGN KEY (variant_id)
        REFERENCES b2b.product_variants(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT uq_stock_location UNIQUE (product_id, variant_id, warehouse_id),
    CONSTRAINT ck_stock_quantities CHECK (
        quantity_available >= 0 AND
        quantity_reserved >= 0 AND
        quantity_on_order >= 0 AND
        quantity_in_transit >= 0 AND
        quantity_damaged >= 0 AND
        quantity_returned >= 0
    ),
    CONSTRAINT ck_stock_thresholds CHECK (
        (reorder_level IS NULL OR reorder_level >= 0) AND
        (max_stock_level IS NULL OR max_stock_level >= 0)
    )
);

CREATE TRIGGER stock_levels_updated_at
    BEFORE UPDATE ON b2b.stock_levels
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_stock_product_warehouse ON b2b.stock_levels(product_id, warehouse_id);
CREATE INDEX idx_stock_variant_warehouse ON b2b.stock_levels(variant_id, warehouse_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_stock_status ON b2b.stock_levels(status);
CREATE INDEX idx_stock_available ON b2b.stock_levels(quantity_available);
CREATE INDEX idx_stock_updated_at ON b2b.stock_levels(updated_at DESC);
CREATE INDEX idx_stock_low_stock ON b2b.stock_levels(product_id, variant_id)
    WHERE quantity_available <= COALESCE(reorder_level, 0);

COMMENT ON TABLE b2b.stock_levels IS 'Current stock levels across warehouses';

-- ================================================================
-- CUSTOMER TABLES
-- ================================================================

-- ================================================================
-- b2b.customers
-- B2B customer accounts
-- ================================================================
CREATE TABLE b2b.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(50) NOT NULL,  -- External/customer reference

    -- Company information
    company_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    company_type VARCHAR(50),  -- SRL, SA, PFA, etc.
    fiscal_code VARCHAR(50),   -- CIF, CUI
    trade_register VARCHAR(100),

    -- Contact
    contact_person VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),

    -- Addresses
    billing_address JSONB NOT NULL DEFAULT '{}',
    shipping_address JSONB NOT NULL DEFAULT '{}',

    -- Credit and payment
    customer_tier b2b_customer_tier NOT NULL DEFAULT 'bronze',
    credit_limit NUMERIC(18,4) DEFAULT 0,
    credit_currency CHAR(3) DEFAULT 'RON',
    payment_terms VARCHAR(100) DEFAULT 'net30',  -- net30, net60, cod, etc.

    -- Status
    status b2b_customer_status NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Sales info
    assigned_salesperson_id UUID,
    account_manager_id UUID,

    -- Settings
    allow_backorders BOOLEAN NOT NULL DEFAULT false,
    require_approval BOOLEAN NOT NULL DEFAULT false,
    min_order_value NUMERIC(18,4) DEFAULT 0,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_customers_code UNIQUE (customer_code),
    CONSTRAINT uq_customers_email UNIQUE (email),
    CONSTRAINT uq_customers_fiscal_code UNIQUE (fiscal_code) WHERE fiscal_code IS NOT NULL,
    CONSTRAINT ck_customers_credit_limit CHECK (credit_limit >= 0),
    CONSTRAINT ck_customers_min_order CHECK (min_order_value >= 0)
);

CREATE TRIGGER customers_updated_at
    BEFORE UPDATE ON b2b.customers
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_customers_code ON b2b.customers(customer_code);
CREATE INDEX idx_customers_email ON b2b.customers(email);
CREATE INDEX idx_customers_tier ON b2b.customers(customer_tier);
CREATE INDEX idx_customers_status ON b2b.customers(status);
CREATE INDEX idx_customers_is_active ON b2b.customers(is_active);
CREATE INDEX idx_customers_fiscal_code ON b2b.customers(fiscal_code) WHERE fiscal_code IS NOT NULL;

COMMENT ON TABLE b2b.customers IS 'B2B customer accounts';
COMMENT ON COLUMN b2b.customers.payment_terms IS 'Payment terms: net30, net60, cod, etc.';

-- ================================================================
-- b2b.customer_tiers
-- Customer tier definitions
-- ================================================================
CREATE TABLE b2b.customer_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    tier b2b_customer_tier NOT NULL UNIQUE,

    -- Tier benefits
    min_spend NUMERIC(18,4),
    discount_percent NUMERIC(5,2) CHECK (discount_percent >= 0 AND discount_percent <= 100),
    credit_limit_multiplier NUMERIC(5,2) DEFAULT 1.0,
    payment_terms_days INTEGER DEFAULT 30,

    -- Price book assignment
    default_price_book_id UUID,

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tiers_price_book FOREIGN KEY (default_price_book_id)
        REFERENCES b2b.price_books(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT ck_tiers_min_spend CHECK (min_spend IS NULL OR min_spend >= 0)
);

CREATE TRIGGER customer_tiers_updated_at
    BEFORE UPDATE ON b2b.customer_tiers
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_customer_tiers_code ON b2b.customer_tiers(code);
CREATE INDEX idx_customer_tiers_tier ON b2b.customer_tiers(tier);

COMMENT ON TABLE b2b.customer_tiers IS 'Customer tier definitions and benefits';

-- ================================================================
-- b2b.customer_contacts
-- Additional contacts for customers
-- ================================================================
CREATE TABLE b2b.customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,

    -- Contact info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),

    -- Role/department
    role VARCHAR(100),
    department VARCHAR(100),

    -- Contact type
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_billing BOOLEAN NOT NULL DEFAULT false,
    is_shipping BOOLEAN NOT NULL DEFAULT false,
    is_purchasing BOOLEAN NOT NULL DEFAULT false,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_contacts_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT uq_customer_primary_email UNIQUE (customer_id, email) WHERE is_primary = true
);

CREATE TRIGGER customer_contacts_updated_at
    BEFORE UPDATE ON b2b.customer_contacts
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_customer_contacts_customer_id ON b2b.customer_contacts(customer_id);
CREATE INDEX idx_customer_contacts_email ON b2b.customer_contacts(email);

COMMENT ON TABLE b2b.customer_contacts IS 'Additional contacts for customers';

-- ================================================================
-- b2b.customer_shipping_addresses
-- Multiple shipping addresses per customer
-- ================================================================
CREATE TABLE b2b.customer_shipping_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,

    -- Address details
    label VARCHAR(100),  -- e.g., "Main warehouse", "Branch office"
    company_name VARCHAR(255),
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'RO',

    -- Shipping preferences
    is_default BOOLEAN NOT NULL DEFAULT false,
    shipping_instructions TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_shipping_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT uq_customer_default_shipping UNIQUE (customer_id) WHERE is_default = true
);

CREATE TRIGGER customer_shipping_addresses_updated_at
    BEFORE UPDATE ON b2b.customer_shipping_addresses
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_customer_shipping_customer_id ON b2b.customer_shipping_addresses(customer_id);
CREATE INDEX idx_customer_shipping_default ON b2b.customer_shipping_addresses(customer_id) WHERE is_default = true;

COMMENT ON TABLE b2b.customer_shipping_addresses IS 'Multiple shipping addresses per customer';

-- ================================================================
-- COMMENTS SUMMARY
-- ================================================================

\echo 'Migration 0002 completed successfully - Catalog, Customers, Pricing, Stock tables created'

-- ================================================================
-- DOWN (Rollback)
-- ================================================================
-- DROP TABLE IF EXISTS b2b.customer_shipping_addresses CASCADE;
-- DROP TABLE IF EXISTS b2b.customer_contacts CASCADE;
-- DROP TABLE IF EXISTS b2b.customer_tiers CASCADE;
-- DROP TABLE IF EXISTS b2b.customers CASCADE;
-- DROP TABLE IF EXISTS b2b.stock_levels CASCADE;
-- DROP TABLE IF EXISTS b2b.price_book_entries CASCADE;
-- DROP TABLE IF EXISTS b2b.price_books CASCADE;
-- DROP TABLE IF EXISTS b2b.product_attributes CASCADE;
-- DROP TABLE IF EXISTS b2b.product_media CASCADE;
-- DROP TABLE IF EXISTS b2b.product_variants CASCADE;
-- DROP TABLE IF EXISTS b2b.products CASCADE;
--
-- DROP TYPE IF EXISTS b2b_product_status;
-- DROP TYPE IF EXISTS b2b_customer_tier;
-- DROP TYPE IF EXISTS b2b_customer_status;
-- DROP TYPE IF EXISTS b2b_stock_level_status;
-- DROP TYPE IF EXISTS b2b_price_type;
