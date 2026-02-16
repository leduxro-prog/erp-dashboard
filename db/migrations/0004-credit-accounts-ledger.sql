-- ================================================================
-- Migration: 0004 - Credit Accounts and Ledger
-- Author: AI 2 (Data/DB)
-- Date: 2026-02-13
-- ================================================================
-- Description: Create credit accounts and append-only credit ledger
-- Impact: Core financial tables for B2B credit management
-- Rollback: DROP TABLE IF EXISTS ... CASCADE; DROP TYPE IF EXISTS ...
-- ================================================================

-- ================================================================
-- TYPES (ENUMS)
-- ================================================================

-- Credit entry type (append-only, no updates/deletes)
CREATE TYPE b2b_credit_entry_type AS ENUM (
    'reserve',              -- Reserve credit for order (debit)
    'capture',              -- Finalize reserved amount (debit confirmed)
    'release',              -- Release reservation (credit back)
    'manual_adjustment',    -- Manual adjustment (+ or -)
    'refund',               -- Refund after payment (credit)
    'penalty',              -- Late payment penalty (debit)
    'interest',             -- Interest charge (debit)
    'payment',              -- Customer payment (credit)
    'credit_limit_increase', -- Credit limit increase (credit)
    'credit_limit_decrease'  -- Credit limit decrease (debit - administrative)
);

-- Credit account status
CREATE TYPE b2b_credit_status AS ENUM (
    'active',       -- Account is active
    'suspended',    -- Account suspended (overdue, etc.)
    'blocked',      -- Account blocked (no new transactions)
    'closed',       -- Account closed
    'pending'       -- Account pending activation
);

-- Credit reservation status
CREATE TYPE b2b_reservation_status AS ENUM (
    'pending',      -- Reservation pending
    'active',       -- Reservation active
    'captured',     -- Reservation captured (order confirmed)
    'released',     -- Reservation released
    'expired',      -- Reservation expired
    'cancelled'     -- Reservation cancelled
);

-- ================================================================
-- b2b.credit_accounts
-- Credit accounts for B2B customers
-- ================================================================
CREATE TABLE b2b.credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE,
    account_number VARCHAR(50) NOT NULL UNIQUE,

    -- Credit limits
    credit_limit NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Current balances (computed from ledger)
    current_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
    available_credit NUMERIC(18,4) NOT NULL DEFAULT 0,
    reserved_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Overdraft (if allowed)
    overdraft_limit NUMERIC(18,4) NOT NULL DEFAULT 0,
    overdraft_used NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Status
    status b2b_credit_status NOT NULL DEFAULT 'pending',

    -- Payment terms
    payment_terms VARCHAR(50) NOT NULL DEFAULT 'net30',
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    grace_period_days INTEGER NOT NULL DEFAULT 5,

    -- Risk and scoring
    credit_score INTEGER,                     -- 0-100
    risk_level VARCHAR(50),                   -- low, medium, high, critical
    last_reviewed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,

    -- Interest and fees
    interest_rate NUMERIC(5,4),               -- e.g., 0.0125 for 1.25%
    late_fee NUMERIC(18,4) NOT NULL DEFAULT 0,
    monthly_fee NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Terms
    terms_accepted_at TIMESTAMPTZ,
    terms_version VARCHAR(20),

    -- Account manager
    assigned_manager_id UUID,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_credit_accounts_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_accounts_manager FOREIGN KEY (assigned_manager_id)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT ck_credit_accounts_limit CHECK (credit_limit >= 0),
    CONSTRAINT ck_credit_accounts_overdraft CHECK (overdraft_limit >= 0),
    CONSTRAINT ck_credit_accounts_balance CHECK (
        current_balance >= 0 AND
        available_credit >= 0 AND
        reserved_amount >= 0 AND
        available_credit + reserved_amount <= credit_limit + overdraft_limit
    ),
    CONSTRAINT ck_credit_accounts_used_overdraft CHECK (overdraft_used >= 0 AND overdraft_used <= overdraft_limit),
    CONSTRAINT ck_credit_accounts_score CHECK (credit_score IS NULL OR (credit_score >= 0 AND credit_score <= 100))
);

CREATE TRIGGER credit_accounts_updated_at
    BEFORE UPDATE ON b2b.credit_accounts
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_credit_accounts_customer_id ON b2b.credit_accounts(customer_id);
CREATE INDEX idx_credit_accounts_account_number ON b2b.credit_accounts(account_number);
CREATE INDEX idx_credit_accounts_status ON b2b.credit_accounts(status);
CREATE INDEX idx_credit_accounts_risk_level ON b2b.credit_accounts(risk_level) WHERE risk_level IS NOT NULL;
CREATE INDEX idx_credit_accounts_next_review ON b2b.credit_accounts(next_review_at) WHERE next_review_at IS NOT NULL;

COMMENT ON TABLE b2b.credit_accounts IS 'Credit accounts for B2B customers';
COMMENT ON COLUMN b2b.credit_accounts.current_balance IS 'Current outstanding balance (computed from ledger)';
COMMENT ON COLUMN b2b.credit_accounts.available_credit IS 'Available credit for new orders';

-- ================================================================
-- b2b.credit_ledger
-- Append-only ledger for all credit transactions
-- CRITICAL: No updates or deletes on historical entries
-- ================================================================
CREATE TABLE b2b.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_account_id UUID NOT NULL,

    -- Transaction info
    entry_number BIGSERIAL NOT NULL,           -- Sequential number per account
    entry_type b2b_credit_entry_type NOT NULL,

    -- Reference to source transaction
    reference_type VARCHAR(50),               -- order, quote, payment, adjustment
    reference_id UUID,
    reference_number VARCHAR(100),            -- order_number, etc.

    -- Correlation for idempotency
    correlation_id VARCHAR(255),
    external_ref VARCHAR(255),                -- External reference

    -- Amounts (positive = credit to account, negative = debit)
    amount NUMERIC(18,4) NOT NULL,            -- Transaction amount
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    balance_after NUMERIC(18,4) NOT NULL,     -- Account balance after this entry

    -- Reservation tracking
    reservation_id UUID,                      -- For reserve/capture/release
    reservation_status b2b_reservation_status,
    reservation_expires_at TIMESTAMPTZ,
    linked_entry_id UUID,                     -- Link to related entry (e.g., capture -> reserve)

    -- Fees and adjustments
    fee_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Description and notes
    description TEXT NOT NULL,
    notes TEXT,

    -- Approval
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    requires_approval BOOLEAN NOT NULL DEFAULT false,

    -- Reconciliation
    is_reconciled BOOLEAN NOT NULL DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_credit_ledger_account FOREIGN KEY (credit_account_id)
        REFERENCES b2b.credit_accounts(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_ledger_approved_by FOREIGN KEY (approved_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_ledger_linked_entry FOREIGN KEY (linked_entry_id)
        REFERENCES b2b.credit_ledger(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_ledger_reconciled_by FOREIGN KEY (reconciled_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT uq_credit_ledger_entry_number UNIQUE (credit_account_id, entry_number),
    CONSTRAINT uq_credit_ledger_correlation UNIQUE (credit_account_id, correlation_id) WHERE correlation_id IS NOT NULL,
    CONSTRAINT ck_credit_ledger_balance CHECK (balance_after >= 0),
    CONSTRAINT ck_credit_ledger_fees CHECK (fee_amount >= 0 AND tax_amount >= 0),
    CONSTRAINT ck_credit_ledger_capture_requires_reserve CHECK (
        entry_type != 'capture' OR linked_entry_id IS NOT NULL
    ),
    CONSTRAINT ck_credit_ledger_release_requires_active_reserve CHECK (
        entry_type != 'release' OR linked_entry_id IS NOT NULL
    )
);

-- Indexes
CREATE INDEX idx_credit_ledger_account_id ON b2b.credit_ledger(credit_account_id, created_at DESC);
CREATE INDEX idx_credit_ledger_entry_number ON b2b.credit_ledger(credit_account_id, entry_number DESC);
CREATE INDEX idx_credit_ledger_entry_type ON b2b.credit_ledger(entry_type, created_at DESC);
CREATE INDEX idx_credit_ledger_reference ON b2b.credit_ledger(reference_type, reference_id);
CREATE INDEX idx_credit_ledger_correlation_id ON b2b.credit_ledger(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_credit_ledger_reservation_id ON b2b.credit_ledger(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX idx_credit_ledger_reservation_status ON b2b.credit_ledger(reservation_status, created_at DESC);
CREATE INDEX idx_credit_ledger_reservation_expires_at ON b2b.credit_ledger(reservation_expires_at)
    WHERE reservation_status IN ('active', 'pending') AND reservation_expires_at IS NOT NULL;
CREATE INDEX idx_credit_ledger_external_ref ON b2b.credit_ledger(external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX idx_credit_ledger_is_reconciled ON b2b.credit_ledger(is_reconciled) WHERE is_reconciled = false;

COMMENT ON TABLE b2b.credit_ledger IS 'Append-only ledger for all credit transactions - NO UPDATES/DELETES';
COMMENT ON COLUMN b2b.credit_ledger.amount IS 'Positive = credit to account, negative = debit from account';
COMMENT ON COLUMN b2b.credit_ledger.balance_after IS 'Account balance after this entry';

-- ================================================================
-- b2b.credit_reservations
-- Active credit reservations for orders
-- ================================================================
CREATE TABLE b2b.credit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_account_id UUID NOT NULL,
    order_id UUID NOT NULL,

    -- Reservation info
    reservation_number VARCHAR(50) NOT NULL UNIQUE,

    -- Amounts
    amount NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Status
    status b2b_reservation_status NOT NULL DEFAULT 'pending',

    -- Expiration
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,

    -- Ledger reference
    reserve_entry_id UUID,
    capture_entry_id UUID,
    release_entry_id UUID,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT fk_credit_reservations_account FOREIGN KEY (credit_account_id)
        REFERENCES b2b.credit_accounts(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_reservations_order FOREIGN KEY (order_id)
        REFERENCES b2b.orders(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_reservations_reserve_entry FOREIGN KEY (reserve_entry_id)
        REFERENCES b2b.credit_ledger(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_reservations_capture_entry FOREIGN KEY (capture_entry_id)
        REFERENCES b2b.credit_ledger(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_reservations_release_entry FOREIGN KEY (release_entry_id)
        REFERENCES b2b.credit_ledger(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT ck_credit_reservations_amount CHECK (amount >= 0),
    CONSTRAINT ck_credit_reservations_expiration CHECK (expires_at > created_at),
    CONSTRAINT ck_credit_reservations_dates CHECK (
        (captured_at IS NULL OR captured_at >= created_at) AND
        (released_at IS NULL OR released_at >= created_at) AND
        (captured_at IS NULL OR released_at IS NULL) -- Can't be both captured and released
    )
);

-- Indexes
CREATE INDEX idx_credit_reservations_account_id ON b2b.credit_reservations(credit_account_id);
CREATE INDEX idx_credit_reservations_order_id ON b2b.credit_reservations(order_id);
CREATE INDEX idx_credit_reservations_status ON b2b.credit_reservations(status);
CREATE INDEX idx_credit_reservations_expires_at ON b2b.credit_reservations(expires_at)
    WHERE status IN ('pending', 'active');

COMMENT ON TABLE b2b.credit_reservations IS 'Active credit reservations for orders';

-- ================================================================
-- b2b.credit_transactions
-- Additional transaction metadata (non-ledger)
-- ================================================================
CREATE TABLE b2b.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_account_id UUID NOT NULL,

    -- Transaction type and source
    transaction_type VARCHAR(50) NOT NULL,     -- payment, refund, adjustment, etc.
    source VARCHAR(50) NOT NULL,               -- api, manual, system, etc.

    -- Amounts
    amount NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Reference
    reference_id UUID,
    reference_number VARCHAR(100),
    external_ref VARCHAR(255),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- Payment method (for payments)
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    payment_provider VARCHAR(50),

    -- Approval
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejected_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Processing
    processed_at TIMESTAMPTZ,
    processed_by UUID,
    error_code VARCHAR(50),
    error_message TEXT,

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_credit_transactions_account FOREIGN KEY (credit_account_id)
        REFERENCES b2b.credit_accounts(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_transactions_approved_by FOREIGN KEY (approved_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_transactions_rejected_by FOREIGN KEY (rejected_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_transactions_processed_by FOREIGN KEY (processed_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT ck_credit_transactions_amount CHECK (amount >= 0)
);

CREATE TRIGGER credit_transactions_updated_at
    BEFORE UPDATE ON b2b.credit_transactions
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_credit_transactions_account_id ON b2b.credit_transactions(credit_account_id, created_at DESC);
CREATE INDEX idx_credit_transactions_type ON b2b.credit_transactions(transaction_type, created_at DESC);
CREATE INDEX idx_credit_transactions_reference ON b2b.credit_transactions(reference_type, reference_id);
CREATE INDEX idx_credit_transactions_status ON b2b.credit_transactions(status);
CREATE INDEX idx_credit_transactions_external_ref ON b2b.credit_transactions(external_ref) WHERE external_ref IS NOT NULL;

COMMENT ON TABLE b2b.credit_transactions IS 'Additional transaction metadata (non-ledger)';

-- ================================================================
-- b2b.credit_invoices
-- Invoices for credit transactions
-- ================================================================
CREATE TABLE b2b.credit_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_account_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    -- Invoice info
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_type VARCHAR(50) NOT NULL,        -- statement, payment, adjustment, etc.

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Amounts
    opening_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_charges NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_credits NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'RON',

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    -- Dates
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,

    -- Delivery
    sent_at TIMESTAMPTZ,
    sent_via VARCHAR(50),                      -- email, post, etc.
    sent_to VARCHAR(255),

    -- PDF
    pdf_url VARCHAR(1024),
    pdf_generated_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_credit_invoices_account FOREIGN KEY (credit_account_id)
        REFERENCES b2b.credit_accounts(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_credit_invoices_customer FOREIGN KEY (customer_id)
        REFERENCES b2b.customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT ck_credit_invoices_period CHECK (period_end >= period_start),
    CONSTRAINT ck_credit_invoices_dates CHECK (due_date >= issue_date)
);

CREATE TRIGGER credit_invoices_updated_at
    BEFORE UPDATE ON b2b.credit_invoices
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_credit_invoices_account_id ON b2b.credit_invoices(credit_account_id);
CREATE INDEX idx_credit_invoices_customer_id ON b2b.credit_invoices(customer_id);
CREATE INDEX idx_credit_invoices_number ON b2b.credit_invoices(invoice_number);
CREATE INDEX idx_credit_invoices_status ON b2b.credit_invoices(status);
CREATE INDEX idx_credit_invoices_period ON b2b.credit_invoices(period_start, period_end);
CREATE INDEX idx_credit_invoices_due_date ON b2b.credit_invoices(due_date) WHERE status != 'paid';

COMMENT ON TABLE b2b.credit_invoices IS 'Invoices for credit transactions';

-- ================================================================
-- b2b.credit_invoice_items
-- Line items for credit invoices
-- ================================================================
CREATE TABLE b2b.credit_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,

    -- Reference
    reference_type VARCHAR(50),               -- order, payment, adjustment
    reference_id UUID,
    reference_number VARCHAR(100),

    -- Description
    description TEXT NOT NULL,

    -- Amounts
    amount NUMERIC(18,4) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'RON',
    tax_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18,4) NOT NULL,

    -- Dates
    transaction_date DATE NOT NULL,

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_credit_invoice_items_invoice FOREIGN KEY (invoice_id)
        REFERENCES b2b.credit_invoices(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT ck_credit_invoice_items_amount CHECK (amount >= 0 AND tax_amount >= 0 AND total_amount >= 0)
);

-- Indexes
CREATE INDEX idx_credit_invoice_items_invoice_id ON b2b.credit_invoice_items(invoice_id, display_order);
CREATE INDEX idx_credit_invoice_items_reference ON b2b.credit_invoice_items(reference_type, reference_id);

COMMENT ON TABLE b2b.credit_invoice_items IS 'Line items for credit invoices';

-- ================================================================
-- FUNCTIONS FOR CREDIT ACCOUNT BALANCE CALCULATION
-- ================================================================

-- Function to calculate current balance from ledger
CREATE OR REPLACE FUNCTION b2b.calculate_credit_balance(p_account_id UUID)
RETURNS NUMERIC(18,4) AS $$
DECLARE
    v_balance NUMERIC(18,4);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM b2b.credit_ledger
    WHERE credit_account_id = p_account_id;

    -- Balance should always be >= 0
    RETURN GREATEST(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate reserved amount from active reservations
CREATE OR REPLACE FUNCTION b2b.calculate_reserved_amount(p_account_id UUID)
RETURNS NUMERIC(18,4) AS $$
DECLARE
    v_reserved NUMERIC(18,4);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_reserved
    FROM b2b.credit_reservations
    WHERE credit_account_id = p_account_id
      AND status IN ('pending', 'active');

    RETURN v_reserved;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get available credit
CREATE OR REPLACE FUNCTION b2b.calculate_available_credit(p_account_id UUID)
RETURNS NUMERIC(18,4) AS $$
DECLARE
    v_limit NUMERIC(18,4);
    v_balance NUMERIC(18,4);
    v_reserved NUMERIC(18,4);
    v_overdraft NUMERIC(18,4);
BEGIN
    SELECT credit_limit, current_balance, reserved_amount, overdraft_limit
    INTO v_limit, v_balance, v_reserved, v_overdraft
    FROM b2b.credit_accounts
    WHERE id = p_account_id;

    RETURN (v_limit + v_overdraft) - v_balance - v_reserved;
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- TRIGGER TO UPDATE CREDIT ACCOUNT BALANCES
-- ================================================================

-- Function to update credit account balances after ledger insert
CREATE OR REPLACE FUNCTION b2b.update_credit_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_balance NUMERIC(18,4);
    v_reserved NUMERIC(18,4);
    v_available NUMERIC(18,4);
    v_account RECORD;
BEGIN
    -- Get account info
    SELECT * INTO v_account
    FROM b2b.credit_accounts
    WHERE id = NEW.credit_account_id;

    -- Calculate new balance
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM b2b.credit_ledger
    WHERE credit_account_id = NEW.credit_account_id;

    -- Calculate reserved amount
    SELECT COALESCE(SUM(amount), 0) INTO v_reserved
    FROM b2b.credit_reservations
    WHERE credit_account_id = NEW.credit_account_id
      AND status IN ('pending', 'active');

    -- Calculate available credit
    v_available := (v_account.credit_limit + v_account.overdraft_limit) - v_balance - v_reserved;

    -- Update account
    UPDATE b2b.credit_accounts
    SET current_balance = GREATEST(v_balance, 0),
        reserved_amount = v_reserved,
        available_credit = GREATEST(v_available, 0),
        updated_at = NOW()
    WHERE id = NEW.credit_account_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update balances after ledger insert
CREATE TRIGGER credit_ledger_balance_update
    AFTER INSERT ON b2b.credit_ledger
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_credit_account_balance();

-- ================================================================
-- CONSTRAINT FUNCTIONS FOR BUSINESS LOGIC
-- ================================================================

-- Function to check if reservation is still valid for release
CREATE OR REPLACE FUNCTION b2b.is_reservation_valid_for_release(p_reservation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_reservation RECORD;
BEGIN
    SELECT * INTO v_reservation
    FROM b2b.credit_reservations
    WHERE id = p_reservation_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Can only release pending, active, or expired reservations
    IF v_reservation.status NOT IN ('pending', 'active', 'expired') THEN
        RETURN FALSE;
    END IF;

    -- For pending/active, check if expired
    IF v_reservation.status IN ('pending', 'active') AND v_reservation.expires_at < NOW() THEN
        RETURN FALSE;
    END IF;

    -- Can't release if already captured
    IF v_reservation.captured_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- COMMENTS SUMMARY
-- ================================================================

\echo 'Migration 0004 completed successfully - Credit Accounts and Ledger created'

-- ================================================================
-- DOWN (Rollback)
-- ================================================================
-- DROP TRIGGER IF EXISTS credit_ledger_balance_update ON b2b.credit_ledger;
-- DROP FUNCTION IF EXISTS b2b.update_credit_account_balance() CASCADE;
-- DROP FUNCTION IF EXISTS b2b.is_reservation_valid_for_release(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS b2b.calculate_available_credit(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS b2b.calculate_reserved_amount(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS b2b.calculate_credit_balance(UUID) CASCADE;
--
-- DROP TABLE IF EXISTS b2b.credit_invoice_items CASCADE;
-- DROP TABLE IF EXISTS b2b.credit_invoices CASCADE;
-- DROP TABLE IF EXISTS b2b.credit_transactions CASCADE;
-- DROP TABLE IF EXISTS b2b.credit_reservations CASCADE;
-- DROP TABLE IF EXISTS b2b.credit_ledger CASCADE;
-- DROP TABLE IF EXISTS b2b.credit_accounts CASCADE;
--
-- DROP TYPE IF EXISTS b2b_credit_entry_type;
-- DROP TYPE IF EXISTS b2b_credit_status;
-- DROP TYPE IF EXISTS b2b_reservation_status;
