-- Financial Accounting Module Schema

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CHART OF ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'CONTRA_ASSET', 'CONTRA_LIABILITY')),
    parent_account_id UUID REFERENCES chart_of_accounts(id),
    is_header BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    cost_center_code VARCHAR(50),
    tax_applicable BOOLEAN DEFAULT FALSE,
    accumulated_depreciation BOOLEAN DEFAULT FALSE,
    balance DECIMAL(15,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, code)
);

CREATE INDEX idx_coa_organization_id ON chart_of_accounts(organization_id);
CREATE INDEX idx_coa_account_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent_id ON chart_of_accounts(parent_account_id);
CREATE INDEX idx_coa_is_active ON chart_of_accounts(is_active);

-- ============================================================================
-- COST CENTERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID,
    budget DECIMAL(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, code)
);

CREATE INDEX idx_cost_centers_org ON cost_centers(organization_id);

-- ============================================================================
-- FISCAL PERIODS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fiscal_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    period_name VARCHAR(50) NOT NULL,
    fiscal_year VARCHAR(4) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_open BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    closing_date TIMESTAMP WITH TIME ZONE,
    closed_by UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, period_name, fiscal_year),
    CHECK (start_date <= end_date)
);

CREATE INDEX idx_fiscal_periods_org ON fiscal_periods(organization_id);
CREATE INDEX idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);

-- ============================================================================
-- TAX CODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL,
    tax_type VARCHAR(50) NOT NULL CHECK (tax_type IN ('VAT', 'GST', 'SALES_TAX', 'INCOME_TAX', 'WITHHOLDING')),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    UNIQUE(organization_id, code)
);

CREATE INDEX idx_tax_codes_org ON tax_codes(organization_id);

-- ============================================================================
-- JOURNAL ENTRIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    fiscal_period_id UUID NOT NULL REFERENCES fiscal_periods(id),
    entry_number VARCHAR(50) NOT NULL,
    entry_date DATE NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT NOT NULL,
    total_debit DECIMAL(15,2) DEFAULT 0,
    total_credit DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REVERSED', 'CANCELLED')),
    is_posted BOOLEAN DEFAULT FALSE,
    posted_date TIMESTAMP WITH TIME ZONE,
    posted_by UUID,
    approval_status VARCHAR(50) DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID,
    approved_date TIMESTAMP WITH TIME ZONE,
    reversal_entry_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, entry_number),
    CHECK (total_debit = total_credit OR status IN ('DRAFT', 'PENDING_APPROVAL'))
);

CREATE INDEX idx_je_organization_id ON journal_entries(organization_id);
CREATE INDEX idx_je_fiscal_period_id ON journal_entries(fiscal_period_id);
CREATE INDEX idx_je_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_je_posted ON journal_entries(is_posted);

-- ============================================================================
-- JOURNAL ENTRY LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    cost_center_id UUID REFERENCES cost_centers(id),
    tax_code_id UUID REFERENCES tax_codes(id),
    description TEXT,
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    quantity DECIMAL(15,4),
    unit_price DECIMAL(15,2),
    reference_number VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK ((debit_amount > 0 AND credit_amount = 0) OR (debit_amount = 0 AND credit_amount > 0))
);

CREATE INDEX idx_jel_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_jel_account_id ON journal_entry_lines(account_id);
CREATE INDEX idx_jel_cost_center_id ON journal_entry_lines(cost_center_id);

-- ============================================================================
-- AR - INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ar_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    order_id UUID,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'CREDIT_MEMO')),
    payment_terms VARCHAR(100),
    discount_percent DECIMAL(5,2),
    tax_code_id UUID REFERENCES tax_codes(id),
    notes TEXT,
    ar_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    revenue_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    is_posted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, invoice_number)
);

CREATE INDEX idx_ar_invoices_org ON ar_invoices(organization_id);
CREATE INDEX idx_ar_invoices_customer ON ar_invoices(customer_id);
CREATE INDEX idx_ar_invoices_status ON ar_invoices(status);
CREATE INDEX idx_ar_invoices_due_date ON ar_invoices(due_date);

-- ============================================================================
-- AR - INVOICE LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ar_invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ar_invoice_id UUID NOT NULL REFERENCES ar_invoices(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    revenue_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    tax_code_id UUID REFERENCES tax_codes(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ar_invoice_lines_invoice ON ar_invoice_lines(ar_invoice_id);

-- ============================================================================
-- AR - PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ar_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    payment_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    amount DECIMAL(15,2) NOT NULL,
    reference_number VARCHAR(100),
    bank_account_id UUID REFERENCES bank_accounts(id),
    ar_payment_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    notes TEXT,
    is_posted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, payment_number)
);

CREATE INDEX idx_ar_payments_org ON ar_payments(organization_id);
CREATE INDEX idx_ar_payments_customer ON ar_payments(customer_id);
CREATE INDEX idx_ar_payments_date ON ar_payments(payment_date);

-- ============================================================================
-- AR - PAYMENT ALLOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ar_payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES ar_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES ar_invoices(id),
    allocated_amount DECIMAL(15,2) NOT NULL,
    allocation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ar_payment_alloc_payment ON ar_payment_allocations(payment_id);
CREATE INDEX idx_ar_payment_alloc_invoice ON ar_payment_allocations(invoice_id);

-- ============================================================================
-- AR - AGING SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ar_aging_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    customer_id UUID NOT NULL,
    current_amount DECIMAL(15,2) DEFAULT 0,
    days_30_amount DECIMAL(15,2) DEFAULT 0,
    days_60_amount DECIMAL(15,2) DEFAULT 0,
    days_90_amount DECIMAL(15,2) DEFAULT 0,
    days_120_plus_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    currency_code VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, snapshot_date, customer_id)
);

CREATE INDEX idx_ar_aging_org_date ON ar_aging_snapshots(organization_id, snapshot_date);

-- ============================================================================
-- AR - DUNNING HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS ar_dunning_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES ar_invoices(id),
    dunning_level INT DEFAULT 1,
    dunning_date DATE NOT NULL,
    sent_date TIMESTAMP WITH TIME ZONE,
    communication_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'ACKNOWLEDGED')),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL
);

CREATE INDEX idx_ar_dunning_org ON ar_dunning_history(organization_id);
CREATE INDEX idx_ar_dunning_invoice ON ar_dunning_history(invoice_id);

-- ============================================================================
-- AR - CREDIT MEMOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ar_credit_memos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    memo_number VARCHAR(50) NOT NULL,
    invoice_id UUID NOT NULL REFERENCES ar_invoices(id),
    customer_id UUID NOT NULL,
    memo_date DATE NOT NULL,
    reason VARCHAR(255) NOT NULL,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'APPLIED')),
    journal_entry_id UUID REFERENCES journal_entries(id),
    is_posted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, memo_number)
);

CREATE INDEX idx_ar_credit_memo_org ON ar_credit_memos(organization_id);
CREATE INDEX idx_ar_credit_memo_invoice ON ar_credit_memos(invoice_id);

-- ============================================================================
-- AP - INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ap_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    po_number VARCHAR(50),
    grn_number VARCHAR(50),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RECEIVED', 'MATCHED', 'UNMATCHED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')),
    payment_terms VARCHAR(100),
    discount_percent DECIMAL(5,2),
    tax_code_id UUID REFERENCES tax_codes(id),
    notes TEXT,
    ap_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    expense_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    three_way_match_status VARCHAR(50) DEFAULT 'PENDING' CHECK (three_way_match_status IN ('PENDING', 'COMPLETE', 'VARIANCE')),
    match_variance_percent DECIMAL(5,2),
    is_posted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, vendor_id, invoice_number)
);

CREATE INDEX idx_ap_invoices_org ON ap_invoices(organization_id);
CREATE INDEX idx_ap_invoices_vendor ON ap_invoices(vendor_id);
CREATE INDEX idx_ap_invoices_status ON ap_invoices(status);
CREATE INDEX idx_ap_invoices_due_date ON ap_invoices(due_date);

-- ============================================================================
-- AP - INVOICE LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ap_invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ap_invoice_id UUID NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    expense_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    tax_code_id UUID REFERENCES tax_codes(id),
    cost_center_id UUID REFERENCES cost_centers(id),
    po_line_id UUID,
    grn_line_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ap_invoice_lines_invoice ON ap_invoice_lines(ap_invoice_id);

-- ============================================================================
-- AP - PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ap_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    payment_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    amount DECIMAL(15,2) NOT NULL,
    reference_number VARCHAR(100),
    bank_account_id UUID REFERENCES bank_accounts(id),
    ap_payment_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    discount_taken DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    is_posted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    UNIQUE(organization_id, payment_number)
);

CREATE INDEX idx_ap_payments_org ON ap_payments(organization_id);
CREATE INDEX idx_ap_payments_vendor ON ap_payments(vendor_id);
CREATE INDEX idx_ap_payments_date ON ap_payments(payment_date);

-- ============================================================================
-- AP - PAYMENT SCHEDULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ap_payment_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES ap_invoices(id),
    schedule_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(15,2) DEFAULT 0,
    payment_id UUID REFERENCES ap_payments(id),
    is_paid BOOLEAN DEFAULT FALSE,
    paid_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ap_payment_sched_invoice ON ap_payment_schedules(invoice_id);
CREATE INDEX idx_ap_payment_sched_due_date ON ap_payment_schedules(due_date);

-- ============================================================================
-- AP - THREE WAY MATCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS ap_three_way_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES ap_invoices(id),
    po_id UUID,
    grn_id UUID,
    match_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    po_amount DECIMAL(15,2),
    grn_amount DECIMAL(15,2),
    invoice_amount DECIMAL(15,2),
    variance_percent DECIMAL(5,2),
    match_status VARCHAR(50) DEFAULT 'PENDING' CHECK (match_status IN ('PENDING', 'MATCHED', 'VARIANCE_FOUND')),
    variance_reason TEXT,
    approved_by UUID,
    approved_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL
);

CREATE INDEX idx_ap_3way_invoice ON ap_three_way_matches(invoice_id);

-- ============================================================================
-- BANK ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    bank_code VARCHAR(50),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    account_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    gl_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    UNIQUE(organization_id, account_number)
);

CREATE INDEX idx_bank_accounts_org ON bank_accounts(organization_id);

-- ============================================================================
-- BANK TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
    transaction_date DATE NOT NULL,
    reference_number VARCHAR(100),
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('DEBIT', 'CREDIT')),
    balance_after DECIMAL(15,2),
    journal_entry_id UUID REFERENCES journal_entries(id),
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciliation_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bank_trans_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_trans_date ON bank_transactions(transaction_date);

-- ============================================================================
-- CURRENCY EXCHANGE RATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS currency_exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    rate_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    source VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, from_currency, to_currency, rate_date)
);

CREATE INDEX idx_currency_exchange_org ON currency_exchange_rates(organization_id);

-- ============================================================================
-- FINANCIAL REPORT CONFIGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_report_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('TRIAL_BALANCE', 'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW')),
    report_name VARCHAR(255) NOT NULL,
    description TEXT,
    columns JSONB NOT NULL,
    account_groups JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    UNIQUE(organization_id, report_type, report_name)
);

CREATE INDEX idx_fin_report_org ON financial_report_configs(organization_id);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timestamp_coa BEFORE UPDATE ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_fiscal_periods BEFORE UPDATE ON fiscal_periods FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_journal_entries BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_ar_invoices BEFORE UPDATE ON ar_invoices FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_ar_payments BEFORE UPDATE ON ar_payments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_ap_invoices BEFORE UPDATE ON ap_invoices FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_ap_payments BEFORE UPDATE ON ap_payments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_bank_accounts BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_bank_transactions BEFORE UPDATE ON bank_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_currency_rates BEFORE UPDATE ON currency_exchange_rates FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trigger_update_timestamp_fin_reports BEFORE UPDATE ON financial_report_configs FOR EACH ROW EXECUTE FUNCTION update_timestamp();
