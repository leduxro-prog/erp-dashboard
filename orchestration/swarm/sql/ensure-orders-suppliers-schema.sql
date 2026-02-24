ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS default_markup_percentage DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  ADD COLUMN IF NOT EXISTS markup_type VARCHAR(20) NOT NULL DEFAULT 'percentage';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS quantity_delivered DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_warehouse_id BIGINT,
  ADD COLUMN IF NOT EXISTS cost_price_snapshot DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS cost_source VARCHAR(50);

ALTER TABLE order_status_history
  ADD COLUMN IF NOT EXISTS from_status order_status,
  ADD COLUMN IF NOT EXISTS to_status order_status,
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_status_history'
      AND column_name = 'old_status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_status_history'
      AND column_name = 'new_status'
  ) THEN
    EXECUTE '
      UPDATE order_status_history
      SET
        from_status = COALESCE(from_status, old_status),
        to_status = COALESCE(to_status, new_status),
        changed_at = COALESCE(created_at, changed_at)
    ';
  END IF;
END $$;
