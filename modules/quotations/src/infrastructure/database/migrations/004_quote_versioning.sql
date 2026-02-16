-- Quote Versioning System
-- Tracks all changes made to quotations

CREATE TABLE IF NOT EXISTS quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of quote data at this version
  quote_data JSONB NOT NULL,

  -- What changed
  changes JSONB, -- Array of changes: [{ field: 'total_amount', oldValue: 100, newValue: 120 }]
  change_summary TEXT,

  -- Who made the change
  changed_by_user_id UUID,
  changed_by_name VARCHAR(255),

  -- When
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Version status
  is_current BOOLEAN DEFAULT false,

  CONSTRAINT unique_quotation_version UNIQUE(quotation_id, version_number)
);

-- Indexes
CREATE INDEX idx_quotation_versions_quotation_id ON quotation_versions(quotation_id);
CREATE INDEX idx_quotation_versions_created_at ON quotation_versions(created_at);
CREATE INDEX idx_quotation_versions_is_current ON quotation_versions(is_current);

-- Quote Comparison Table
CREATE TABLE IF NOT EXISTS quotation_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quotation_ids UUID[] NOT NULL,
  comparison_data JSONB, -- Structured comparison results
  created_by_user_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  notes TEXT
);

-- Indexes for comparisons
CREATE INDEX idx_quotation_comparisons_customer_id ON quotation_comparisons(customer_id);
CREATE INDEX idx_quotation_comparisons_created_at ON quotation_comparisons(created_at);

-- Function to create version snapshot
CREATE OR REPLACE FUNCTION create_quotation_version()
RETURNS TRIGGER AS $$
DECLARE
  v_version_number INTEGER;
  v_changes JSONB;
  v_change_summary TEXT;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM quotation_versions
  WHERE quotation_id = NEW.id;

  -- For first version (INSERT), no changes to track
  IF (TG_OP = 'INSERT') THEN
    v_changes := '[]'::jsonb;
    v_change_summary := 'Initial version';
  ELSE
    -- Track changes for UPDATE
    v_changes := jsonb_build_array();
    v_change_summary := '';

    -- Check each field for changes
    IF OLD.customer_id != NEW.customer_id THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'customer_id',
        'oldValue', OLD.customer_id,
        'newValue', NEW.customer_id
      );
      v_change_summary := v_change_summary || 'Customer changed. ';
    END IF;

    IF OLD.quote_date != NEW.quote_date THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'quote_date',
        'oldValue', OLD.quote_date,
        'newValue', NEW.quote_date
      );
      v_change_summary := v_change_summary || 'Quote date changed. ';
    END IF;

    IF OLD.expiry_date != NEW.expiry_date THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'expiry_date',
        'oldValue', OLD.expiry_date,
        'newValue', NEW.expiry_date
      );
      v_change_summary := v_change_summary || 'Expiry date changed. ';
    END IF;

    IF OLD.status != NEW.status THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'status',
        'oldValue', OLD.status,
        'newValue', NEW.status
      );
      v_change_summary := v_change_summary || format('Status changed from %s to %s. ', OLD.status, NEW.status);
    END IF;

    IF OLD.subtotal != NEW.subtotal THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'subtotal',
        'oldValue', OLD.subtotal,
        'newValue', NEW.subtotal
      );
      v_change_summary := v_change_summary || 'Subtotal changed. ';
    END IF;

    IF OLD.discount_amount != NEW.discount_amount THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'discount_amount',
        'oldValue', OLD.discount_amount,
        'newValue', NEW.discount_amount
      );
      v_change_summary := v_change_summary || 'Discount changed. ';
    END IF;

    IF OLD.tax_amount != NEW.tax_amount THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'tax_amount',
        'oldValue', OLD.tax_amount,
        'newValue', NEW.tax_amount
      );
      v_change_summary := v_change_summary || 'Tax amount changed. ';
    END IF;

    IF OLD.total_amount != NEW.total_amount THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'total_amount',
        'oldValue', OLD.total_amount,
        'newValue', NEW.total_amount
      );
      v_change_summary := v_change_summary || format('Total changed from %s to %s. ', OLD.total_amount, NEW.total_amount);
    END IF;

    IF OLD.notes != NEW.notes OR (OLD.notes IS NULL) != (NEW.notes IS NULL) THEN
      v_changes := v_changes || jsonb_build_object(
        'field', 'notes',
        'oldValue', OLD.notes,
        'newValue', NEW.notes
      );
      v_change_summary := v_change_summary || 'Notes updated. ';
    END IF;

    -- If no changes detected, don't create version
    IF jsonb_array_length(v_changes) = 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Mark all previous versions as not current
  UPDATE quotation_versions
  SET is_current = false
  WHERE quotation_id = NEW.id;

  -- Create new version
  INSERT INTO quotation_versions (
    quotation_id,
    version_number,
    quote_data,
    changes,
    change_summary,
    is_current
  ) VALUES (
    NEW.id,
    v_version_number,
    row_to_json(NEW)::jsonb,
    v_changes,
    TRIM(v_change_summary),
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create versions on INSERT and UPDATE
CREATE TRIGGER trigger_create_quotation_version
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION create_quotation_version();

-- Function to restore a specific version
CREATE OR REPLACE FUNCTION restore_quotation_version(
  p_quotation_id UUID,
  p_version_number INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_version_data JSONB;
BEGIN
  -- Get the version data
  SELECT quote_data INTO v_version_data
  FROM quotation_versions
  WHERE quotation_id = p_quotation_id
    AND version_number = p_version_number;

  IF v_version_data IS NULL THEN
    RAISE EXCEPTION 'Version % not found for quotation %', p_version_number, p_quotation_id;
  END IF;

  -- Restore the data (this will trigger creation of a new version)
  UPDATE quotations
  SET
    customer_id = (v_version_data->>'customer_id')::UUID,
    quote_date = (v_version_data->>'quote_date')::TIMESTAMP,
    expiry_date = (v_version_data->>'expiry_date')::TIMESTAMP,
    status = v_version_data->>'status',
    subtotal = (v_version_data->>'subtotal')::DECIMAL,
    discount_amount = (v_version_data->>'discount_amount')::DECIMAL,
    tax_amount = (v_version_data->>'tax_amount')::DECIMAL,
    total_amount = (v_version_data->>'total_amount')::DECIMAL,
    currency_code = v_version_data->>'currency_code',
    notes = v_version_data->>'notes',
    terms_and_conditions = v_version_data->>'terms_and_conditions',
    updated_at = NOW()
  WHERE id = p_quotation_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE quotation_versions IS 'Complete version history of all quotation changes';
COMMENT ON COLUMN quotation_versions.quote_data IS 'Full snapshot of quotation data at this version';
COMMENT ON COLUMN quotation_versions.changes IS 'Array of specific field changes';
COMMENT ON COLUMN quotation_versions.is_current IS 'True for the most recent version';
COMMENT ON TABLE quotation_comparisons IS 'Saved comparisons between multiple quotes';
COMMENT ON FUNCTION create_quotation_version() IS 'Automatically creates version snapshot on quote changes';
COMMENT ON FUNCTION restore_quotation_version(UUID, INTEGER) IS 'Restores a quotation to a specific version';
