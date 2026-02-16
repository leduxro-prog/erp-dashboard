CREATE TABLE IF NOT EXISTS b2b_credit_history (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES b2b_customers(id) ON DELETE CASCADE,
    previous_limit DECIMAL(12,2),
    new_limit DECIMAL(12,2) NOT NULL,
    change_amount DECIMAL(12,2),
    reason TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_b2b_credit_history_customer ON b2b_credit_history(customer_id);
