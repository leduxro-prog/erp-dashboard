ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resource_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resource_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS changes JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'entity_type'
  ) THEN
    EXECUTE '
      UPDATE audit_logs
      SET resource_type = COALESCE(resource_type, entity_type)
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'entity_id'
  ) THEN
    EXECUTE '
      UPDATE audit_logs
      SET resource_id = COALESCE(resource_id, entity_id::text)
    ';
  END IF;
END $$;

ALTER TABLE audit_logs
  ALTER COLUMN entity_type DROP NOT NULL,
  ALTER COLUMN entity_id DROP NOT NULL,
  ALTER COLUMN resource_type SET NOT NULL,
  ALTER COLUMN resource_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email
  ON audit_logs (user_email);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type
  ON audit_logs (resource_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id
  ON audit_logs (resource_id);
