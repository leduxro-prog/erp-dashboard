ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS twofa_secret TEXT,
  ADD COLUMN IF NOT EXISTS twofa_backup_codes JSONB,
  ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'two_factor_enabled'
  ) THEN
    EXECUTE '
      UPDATE users
      SET twofa_enabled = COALESCE(two_factor_enabled, FALSE)
      WHERE twofa_enabled IS DISTINCT FROM COALESCE(two_factor_enabled, FALSE)
    ';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
  ON users (google_id)
  WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_failed_login_attempts
  ON users (failed_login_attempts);

CREATE INDEX IF NOT EXISTS idx_users_locked_until
  ON users (locked_until);

CREATE INDEX IF NOT EXISTS idx_users_reset_token
  ON users (reset_token);
