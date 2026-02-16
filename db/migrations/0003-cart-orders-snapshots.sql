-- ================================================================
-- Migration: 0003 - Cart, Orders, and Snapshot Tables
-- Author: AI 2 (Data/DB)
-- Date: 2026-02-13
-- ================================================================
-- Description: Create tables for shopping cart, quotes, orders, and required snapshot tables
-- Impact: Core transactional tables for B2B checkout flow
-- Rollback: DROP TABLE IF EXISTS ... CASCADE; DROP TYPE IF EXISTS ...
-- ================================================================

-- ================================================================
-- TYPES (ENUMS)
-- ================================================================

-- Cart status
CREATE TYPE b2b_cart_status AS ENUM (
    'active',       -- Currently active/being modified
    'abandoned',    -- Not accessed for > X days
    'converted',    -- Converted to order
    'expired'       -- Expired by system
);

-- Quote status
CREATE TYPE b2b_quote_status AS ENUM (
    'draft',        -- Draft, not sent to customer
    'sent',         -- Sent to customer
    'accepted',     -- Accepted by customer - can become order
    'rejected',     -- Rejected by customer
    'expired',      -- Expired validity date
    'cancelled'     -- Cancelled before acceptance
);

-- Order status
CREATE TYPE b2b_order_status AS ENUM (
    'pending',              -- Awaiting processing
    'confirmed',            -- Stock reserved, order confirmed
    'processing',           -- Being picked/packed
    'ready_to_ship',        -- Ready for handover to carrier
    'shipped',              -- In transit
    'delivered',            -- Delivered to customer
    'cancelled',            -- Cancelled by customer/system
    'refunded',             -- Fully refunded
    'partially_refunded',   -- Partial refund processed
    'returned',             -- Goods returned
    'on_hold'               -- On hold (payment issue, etc.)
);

-- Payment status
CREATE TYPE b2b_payment_status AS ENUM (
    'pending',      -- Awaiting payment
    'authorized',   -- Payment authorized
    'paid',         -- Fully paid
    'partial',      -- Partially paid
    'failed',       -- Payment failed
    'refunded',     -- Fully refunded
    'partial_refund', -- Partially refunded
    'cancelled'     -- Payment cancelled
);

-- Shipping status
CREATE TYPE b2b_shipping_status AS ENUM (
    'not_shipped',  -- Not shipped yet
    'processing',   -- Preparing for shipment
    'picked',        -- Items picked
    'packed',        -- Items packed
    'ready',         -- Ready for carrier
    'shipped',      -- Handed to carrier
    'in_transit',    -- In transit to customer
    'delivered',    -- Delivered
    'returned'      -- Returned to sender
);

-- ================================================================
-- CART TABLES
-- ================================================================

-- ================================================================
-- b2b.cart
-- Shopping cart header
-- ================================================================
CREATE TABLE b2b.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,

    -- Cart identification
    cart_code VARCHAR(50) UNIQUE,

    -- Status
    status b2b_cart_status NOT NULL DEFAULT 'active',

    -- Default cart indicator (only one per customer)
    is_default BOOLEAN NOT NULL DEFAULT true,

    -- User (for logged-in users)
    user_id UUID,

    -- Session (for guest/in-progress)
    session_id VARCHAR(255),

    -- Cart totals (computed from items)
    items_count INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Applied discounts/coupons
    coupon_code VARCHAR(50),
    applied_discounts JSONB NOT NULL DEFAULT '[]',

    -- Price book used for pricing
    price_book_id UUID,

    -- Shipping info (pre-calculation)
    shipping_address_id UUID,

    -- Cart expiration
    expires_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_carts_price_book FOREIGN KEY (price_book_id)
        REFERENCES b2b.price_books(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT uq_carts_default_customer UNIQUE (customer_id) WHERE is_default = true,
    CONSTRAINT ck_carts_totals CHECK (
        items_count >= 0 AND
        subtotal >= 0 AND
        discount_amount >= 0 AND
        tax_amount >= 0 AND
        total_amount >= 0
    ),
    CONSTRAINT ck_carts_expiration CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE TRIGGER carts_updated_at
    BEFORE UPDATE ON b2b.carts
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_carts_customer_id ON b2b.carts(customer_id);
CREATE INDEX idx_carts_customer_updated ON b2b.carts(customer_id, updated_at DESC);
CREATE INDEX idx_carts_status ON b2b.carts(status);
CREATE INDEX idx_carts_user_id ON b2b.carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_carts_session_id ON b2b.carts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_carts_expires_at ON b2b.carts(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE b2b.carts IS 'Shopping cart header';

-- ================================================================
-- b2b.cart_items
-- Shopping cart line items
-- ================================================================
CREATE TABLE b2b.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    -- Product reference
    product_id UUID NOT NULL,
    variant_id UUID,

    -- Product snapshot (at add time)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    variant_name VARCHAR(255),
    variant_sku VARCHAR(50),

    -- Pricing (current at add time)
    unit_price NUMERIC(18,4) NOT NULL CHECK (unit_price >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    tax_rate NUMERIC(5,4) NOT NULL,
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Discount
    discount_percent NUMERIC(5,2) CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_fixed NUMERIC(18,4) CHECK (discount_fixed >= 0),
    discount_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Quantity
    quantity BIGINT NOT NULL CHECK (quantity > 0),

    -- Line totals
    subtotal NUMERIC(18,4) NOT NULL CHECK (subtotal >= 0),
    line_total NUMERIC(18,4) NOT NULL CHECK (line_total >= 0),

    -- Stock check
    stock_available BIGINT,
    stock_status b2b_stock_level_status,

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id)
        REFERENCES b2b.carts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_cart_items_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id)
        REFERENCES b2b.product_variants(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT ck_cart_items_line_total CHECK (line_total = subtotal + tax_amount - discount_amount)
);

CREATE TRIGGER cart_items_updated_at
    BEFORE UPDATE ON b2b.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_cart_items_cart_id ON b2b.cart_items(cart_id, display_order);
CREATE INDEX idx_cart_items_customer_id ON b2b.cart_items(customer_id);
CREATE INDEX idx_cart_items_product_id ON b2b.cart_items(product_id);

COMMENT ON TABLE b2b.cart_items IS 'Shopping cart line items';

-- ================================================================
-- QUOTE TABLES
-- ================================================================

-- ================================================================
-- b2b.quotes
-- Quotes/Devis for customers
-- ================================================================
CREATE TABLE b2b.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,

    -- Status
    status b2b_quote_status NOT NULL DEFAULT 'draft',

    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ NOT NULL,

    -- Totals
    items_count INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Applied discounts
    applied_discounts JSONB NOT NULL DEFAULT '[]',
    discount_notes TEXT,

    -- Price book used
    price_book_id UUID,

    -- Approval info
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Shipping
    shipping_address_id UUID,
    shipping_notes TEXT,

    -- Notes
    internal_notes TEXT,
    customer_notes TEXT,

    -- Conversion to order
    converted_to_order_id UUID,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_quotes_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_quotes_price_book FOREIGN KEY (price_book_id)
        REFERENCES b2b.price_books(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_quotes_order FOREIGN KEY (converted_to_order_id)
        REFERENCES b2b.orders(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_quotes_approved_by FOREIGN KEY (approved_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_quotes_shipping_address FOREIGN KEY (shipping_address_id)
        REFERENCES b2b.customer_shipping_addresses(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT ck_quotes_validity CHECK (valid_to > valid_from),
    CONSTRAINT ck_quotes_totals CHECK (
        items_count >= 0 AND
        subtotal >= 0 AND
        discount_amount >= 0 AND
        tax_amount >= 0 AND
        total_amount >= 0
    )
);

CREATE TRIGGER quotes_updated_at
    BEFORE UPDATE ON b2b.quotes
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_quotes_number ON b2b.quotes(quote_number);
CREATE INDEX idx_quotes_customer_id ON b2b.quotes(customer_id);
CREATE INDEX idx_quotes_customer_created ON b2b.quotes(customer_id, created_at DESC);
CREATE INDEX idx_quotes_status ON b2b.quotes(status);
CREATE INDEX idx_quotes_validity ON b2b.quotes(valid_to) WHERE status IN ('sent', 'draft');

COMMENT ON TABLE b2b.quotes IS 'Quotes/Devis for customers';

-- ================================================================
-- b2b.quote_items
-- Quote line items (editable)
-- ================================================================
CREATE TABLE b2b.quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    -- Product reference
    product_id UUID NOT NULL,
    variant_id UUID,

    -- Current product info (can change, snapshot is separate)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    variant_name VARCHAR(255),
    variant_sku VARCHAR(50),

    -- Current pricing
    unit_price NUMERIC(18,4) NOT NULL CHECK (unit_price >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    tax_rate NUMERIC(5,4) NOT NULL,
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Discount
    discount_percent NUMERIC(5,2) CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_fixed NUMERIC(18,4) CHECK (discount_fixed >= 0),
    discount_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Quantity
    quantity BIGINT NOT NULL CHECK (quantity > 0),

    -- Line totals
    subtotal NUMERIC(18,4) NOT NULL CHECK (subtotal >= 0),
    line_total NUMERIC(18,4) NOT NULL CHECK (line_total >= 0),

    -- Stock check
    stock_available BIGINT,
    stock_status b2b_stock_level_status,

    -- Notes
    line_notes TEXT,

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_quote_items_quote FOREIGN KEY (quote_id)
        REFERENCES b2b.quotes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_quote_items_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_quote_items_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_quote_items_variant FOREIGN KEY (variant_id)
        REFERENCES b2b.product_variants(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT ck_quote_items_line_total CHECK (line_total = subtotal + tax_amount - discount_amount)
);

CREATE TRIGGER quote_items_updated_at
    BEFORE UPDATE ON b2b.quote_items
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_quote_items_quote_id ON b2b.quote_items(quote_id, display_order);
CREATE INDEX idx_quote_items_customer_id ON b2b.quote_items(customer_id);

COMMENT ON TABLE b2b.quote_items IS 'Quote line items (editable)';

-- ================================================================
-- b2b.quote_items_snapshot
-- Immutable snapshot of quote items for financial integrity
-- ================================================================
CREATE TABLE b2b.quote_items_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL,
    quote_item_id UUID NOT NULL,

    -- Product reference (fixed at snapshot time)
    product_id UUID NOT NULL,
    variant_id UUID,

    -- Product snapshot
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    variant_name VARCHAR(255),
    variant_sku VARCHAR(50),

    -- Pricing snapshot (immutable)
    unit_price NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL,
    tax_rate NUMERIC(5,4) NOT NULL,
    tax_amount NUMERIC(18,4) NOT NULL,

    -- Discount snapshot (immutable)
    discount_percent NUMERIC(5,2),
    discount_fixed NUMERIC(18,4),
    discount_amount NUMERIC(18,4) NOT NULL,

    -- Quantity (fixed at snapshot time)
    quantity BIGINT NOT NULL,

    -- Stock snapshot (at confirmation time)
    stock_available BIGINT,
    stock_reserved BIGINT,
    stock_status b2b_stock_level_status,

    -- Price book used
    price_book_id UUID,
    price_book_name VARCHAR(255),

    -- Line totals (fixed)
    subtotal NUMERIC(18,4) NOT NULL,
    line_total NUMERIC(18,4) NOT NULL,

    -- Notes
    line_notes TEXT,

    -- Snapshot metadata
    snapshot_reason VARCHAR(50) NOT NULL DEFAULT 'quote_created', -- quote_created, quote_sent, quote_accepted
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_quote_snapshot_quote FOREIGN KEY (quote_id)
        REFERENCES b2b.quotes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_quote_snapshot_item FOREIGN KEY (quote_item_id)
        REFERENCES b2b.quote_items(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_quote_snapshot_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX idx_quote_snapshot_quote_id ON b2b.quote_items_snapshot(quote_id);
CREATE INDEX idx_quote_snapshot_item_id ON b2b.quote_items_snapshot(quote_item_id);
CREATE INDEX idx_quote_snapshot_product_id ON b2b.quote_items_snapshot(product_id);

COMMENT ON TABLE b2b.quote_items_snapshot IS 'Immutable snapshot of quote items for financial integrity';

-- ================================================================
-- ORDER TABLES
-- ================================================================

-- ================================================================
-- b2b.orders
-- Orders (converted from cart/quote)
-- ================================================================
CREATE TABLE b2b.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,

    -- Source
    source_type VARCHAR(50) NOT NULL, -- cart, quote, manual, api
    source_id UUID,                   -- cart_id or quote_id if converted

    -- Correlation for idempotency
    correlation_id VARCHAR(255) UNIQUE,

    -- Status
    status b2b_order_status NOT NULL DEFAULT 'pending',
    payment_status b2b_payment_status NOT NULL DEFAULT 'pending',
    shipping_status b2b_shipping_status NOT NULL DEFAULT 'not_shipped',

    -- External references
    external_ref VARCHAR(100),        -- External order reference
    erp_order_id VARCHAR(100),         -- Link to ERP order if exists

    -- Validity period
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,

    -- Totals
    items_count INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(18,4) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    shipping_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Applied discounts
    applied_discounts JSONB NOT NULL DEFAULT '[]',
    coupon_code VARCHAR(50),

    -- Price book used
    price_book_id UUID,
    price_book_name VARCHAR(255),

    -- Customer info snapshot
    customer_name VARCHAR(255) NOT NULL,
    customer_code VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_tier b2b_customer_tier NOT NULL,

    -- Addresses
    billing_address JSONB NOT NULL DEFAULT '{}',
    shipping_address JSONB NOT NULL DEFAULT '{}',
    shipping_address_id UUID,

    -- Payment info
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    payment_terms VARCHAR(100),

    -- Credit info
    credit_account_id UUID,
    credit_amount_reserved NUMERIC(18,4) NOT NULL DEFAULT 0,
    credit_amount_captured NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Shipping
    shipping_carrier VARCHAR(100),
    shipping_method VARCHAR(100),
    shipping_tracking_number VARCHAR(100),
    shipping_estimated_delivery DATE,
    shipping_actual_delivery DATE,
    shipping_notes TEXT,

    -- Approval
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Notes
    internal_notes TEXT,
    customer_notes TEXT,
    seller_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_orders_price_book FOREIGN KEY (price_book_id)
        REFERENCES b2b.price_books(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_orders_credit_account FOREIGN KEY (credit_account_id)
        REFERENCES b2b.credit_accounts(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_orders_approved_by FOREIGN KEY (approved_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_orders_shipping_address FOREIGN KEY (shipping_address_id)
        REFERENCES b2b.customer_shipping_addresses(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT ck_orders_totals CHECK (
        items_count >= 0 AND
        subtotal >= 0 AND
        discount_amount >= 0 AND
        tax_amount >= 0 AND
        shipping_amount >= 0 AND
        total_amount >= 0
    ),
    CONSTRAINT ck_orders_credit CHECK (
        credit_amount_reserved >= 0 AND
        credit_amount_captured >= 0 AND
        credit_amount_captured <= credit_amount_reserved
    ),
    CONSTRAINT ck_order_dates CHECK (
        (cancelled_at IS NULL OR cancelled_at >= created_at) AND
        (confirmed_at IS NULL OR confirmed_at >= created_at) AND
        (completed_at IS NULL OR completed_at >= created_at)
    )
);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON b2b.orders
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_orders_number ON b2b.orders(order_number);
CREATE INDEX idx_orders_customer_id ON b2b.orders(customer_id);
CREATE INDEX idx_orders_customer_created ON b2b.orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_status ON b2b.orders(status);
CREATE INDEX idx_orders_payment_status ON b2b.orders(payment_status);
CREATE INDEX idx_orders_shipping_status ON b2b.orders(shipping_status);
CREATE INDEX idx_orders_external_ref ON b2b.orders(external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX idx_orders_correlation_id ON b2b.orders(correlation_id);
CREATE INDEX idx_orders_created_at ON b2b.orders(created_at DESC);
CREATE INDEX idx_orders_confirmed_at ON b2b.orders(confirmed_at DESC);
CREATE INDEX idx_orders_source ON b2b.orders(source_type, source_id);

COMMENT ON TABLE b2b.orders IS 'Orders (converted from cart/quote)';

-- ================================================================
-- b2b.order_items
-- Order line items (current state)
-- ================================================================
CREATE TABLE b2b.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    -- Product reference
    product_id UUID NOT NULL,
    variant_id UUID,

    -- Current product info (can change, snapshot is separate)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    variant_name VARCHAR(255),
    variant_sku VARCHAR(50),

    -- Current pricing
    unit_price NUMERIC(18,4) NOT NULL CHECK (unit_price >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    tax_rate NUMERIC(5,4) NOT NULL,
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Discount
    discount_percent NUMERIC(5,2) CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_fixed NUMERIC(18,4) CHECK (discount_fixed >= 0),
    discount_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Quantity
    quantity_ordered BIGINT NOT NULL CHECK (quantity_ordered > 0),
    quantity_shipped BIGINT NOT NULL DEFAULT 0,
    quantity_returned BIGINT NOT NULL DEFAULT 0,
    quantity_cancelled BIGINT NOT NULL DEFAULT 0,

    -- Line totals (can change with returns/cancellations)
    subtotal NUMERIC(18,4) NOT NULL CHECK (subtotal >= 0),
    line_total NUMERIC(18,4) NOT NULL CHECK (line_total >= 0),

    -- Shipping
    warehouse_id VARCHAR(100),
    bin_location VARCHAR(100),

    -- Status
    item_status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- Notes
    line_notes TEXT,
    internal_notes TEXT,

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
        REFERENCES b2b.orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id)
        REFERENCES b2b.product_variants(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT ck_order_items_quantities CHECK (
        quantity_shipped >= 0 AND
        quantity_returned >= 0 AND
        quantity_cancelled >= 0 AND
        quantity_shipped + quantity_returned + quantity_cancelled <= quantity_ordered
    )
);

CREATE TRIGGER order_items_updated_at
    BEFORE UPDATE ON b2b.order_items
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_order_items_order_id ON b2b.order_items(order_id, display_order);
CREATE INDEX idx_order_items_customer_id ON b2b.order_items(customer_id);
CREATE INDEX idx_order_items_product_id ON b2b.order_items(product_id);
CREATE INDEX idx_order_items_status ON b2b.order_items(item_status);

COMMENT ON TABLE b2b.order_items IS 'Order line items (current state)';

-- ================================================================
-- b2b.order_items_snapshot
-- Immutable snapshot of order items for financial integrity
-- ================================================================
CREATE TABLE b2b.order_items_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL,

    -- Product reference (fixed at order confirmation)
    product_id UUID NOT NULL,
    variant_id UUID,

    -- Product snapshot
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    variant_name VARCHAR(255),
    variant_sku VARCHAR(50),

    -- Pricing snapshot (immutable)
    unit_price NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL,
    tax_rate NUMERIC(5,4) NOT NULL,
    tax_amount NUMERIC(18,4) NOT NULL,

    -- Discount snapshot (immutable)
    discount_percent NUMERIC(5,2),
    discount_fixed NUMERIC(18,4),
    discount_amount NUMERIC(18,4) NOT NULL,

    -- Quantity (fixed at order confirmation)
    quantity BIGINT NOT NULL,

    -- Stock snapshot (at order confirmation)
    stock_available BIGINT,
    stock_reserved BIGINT,
    stock_status b2b_stock_level_status,
    warehouse_id VARCHAR(100),
    bin_location VARCHAR(100),

    -- Price book used
    price_book_id UUID,
    price_book_name VARCHAR(255),

    -- Line totals (fixed at confirmation)
    subtotal NUMERIC(18,4) NOT NULL,
    line_total NUMERIC(18,4) NOT NULL,

    -- Notes
    line_notes TEXT,

    -- Snapshot metadata
    snapshot_reason VARCHAR(50) NOT NULL DEFAULT 'order_confirmed',
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order_snapshot_order FOREIGN KEY (order_id)
        REFERENCES b2b.orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_snapshot_item FOREIGN KEY (order_item_id)
        REFERENCES b2b.order_items(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_snapshot_product FOREIGN KEY (product_id)
        REFERENCES b2b.products(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX idx_order_snapshot_order_id ON b2b.order_items_snapshot(order_id);
CREATE INDEX idx_order_snapshot_item_id ON b2b.order_items_snapshot(order_item_id);
CREATE INDEX idx_order_snapshot_product_id ON b2b.order_items_snapshot(product_id);
CREATE INDEX idx_order_snapshot_snapshot_at ON b2b.order_items_snapshot(snapshot_at);

COMMENT ON TABLE b2b.order_items_snapshot IS 'Immutable snapshot of order items for financial integrity';

-- ================================================================
-- SHIPPING TABLES
-- ================================================================

-- ================================================================
-- b2b.order_shipments
-- Order shipments tracking
-- ================================================================
CREATE TABLE b2b.order_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    shipment_number VARCHAR(50) NOT NULL UNIQUE,

    -- Carrier info
    carrier_name VARCHAR(100) NOT NULL,
    carrier_service VARCHAR(100),
    tracking_number VARCHAR(100),

    -- Addresses
    shipping_address JSONB NOT NULL DEFAULT '{}',

    -- Status
    status b2b_shipping_status NOT NULL DEFAULT 'processing',

    -- Dates
    shipped_at TIMESTAMPTZ,
    estimated_delivery DATE,
    actual_delivery TIMESTAMPTZ,

    -- Shipping cost
    shipping_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Notes
    shipping_notes TEXT,
    delivery_notes TEXT,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_shipments_order FOREIGN KEY (order_id)
        REFERENCES b2b.orders(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TRIGGER order_shipments_updated_at
    BEFORE UPDATE ON b2b.order_shipments
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_order_shipments_order_id ON b2b.order_shipments(order_id);
CREATE INDEX idx_order_shipments_tracking ON b2b.order_shipments(tracking_number) WHERE tracking_number IS NOT NULL;

COMMENT ON TABLE b2b.order_shipments IS 'Order shipments tracking';

-- ================================================================
-- COMMENTS SUMMARY
-- ================================================================

\echo 'Migration 0003 completed successfully - Cart, Orders, and Snapshot tables created'

-- ================================================================
-- DOWN (Rollback)
-- ================================================================
-- DROP TABLE IF EXISTS b2b.order_shipments CASCADE;
-- DROP TABLE IF EXISTS b2b.order_items_snapshot CASCADE;
-- DROP TABLE IF EXISTS b2b.order_items CASCADE;
-- DROP TABLE IF EXISTS b2b.orders CASCADE;
-- DROP TABLE IF EXISTS b2b.quote_items_snapshot CASCADE;
-- DROP TABLE IF EXISTS b2b.quote_items CASCADE;
-- DROP TABLE IF EXISTS b2b.quotes CASCADE;
-- DROP TABLE IF EXISTS b2b.cart_items CASCADE;
-- DROP TABLE IF EXISTS b2b.carts CASCADE;
--
-- DROP TYPE IF EXISTS b2b_cart_status;
-- DROP TYPE IF EXISTS b2b_quote_status;
-- DROP TYPE IF EXISTS b2b_order_status;
-- DROP TYPE IF EXISTS b2b_payment_status;
-- DROP TYPE IF EXISTS b2b_shipping_status;
