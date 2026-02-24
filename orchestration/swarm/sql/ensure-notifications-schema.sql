DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notifications_type_enum') THEN
    CREATE TYPE notifications_type_enum AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notifications_channel_enum') THEN
    CREATE TYPE notifications_channel_enum AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notifications_status_enum') THEN
    CREATE TYPE notifications_status_enum AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notifications_priority_enum') THEN
    CREATE TYPE notifications_priority_enum AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_templates_channel_enum') THEN
    CREATE TYPE notification_templates_channel_enum AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_preferences_channel_enum') THEN
    CREATE TYPE notification_preferences_channel_enum AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_preferences_frequency_enum') THEN
    CREATE TYPE notification_preferences_frequency_enum AS ENUM ('IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_batches_status_enum') THEN
    CREATE TYPE notification_batches_status_enum AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  type notifications_type_enum NOT NULL,
  channel notifications_channel_enum NOT NULL,
  "recipientId" VARCHAR(255) NOT NULL,
  "recipientEmail" VARCHAR(255),
  "recipientPhone" VARCHAR(20),
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  "templateId" UUID,
  "templateData" JSONB DEFAULT '{}',
  status notifications_status_enum NOT NULL,
  priority notifications_priority_enum NOT NULL,
  "scheduledAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "failedAt" TIMESTAMPTZ,
  "failureReason" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  channel notification_templates_channel_enum NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  locale VARCHAR(5) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  "createdBy" UUID NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY,
  "customerId" VARCHAR(255) NOT NULL,
  channel notification_preferences_channel_enum NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "quietHoursStart" VARCHAR(5),
  "quietHoursEnd" VARCHAR(5),
  frequency notification_preferences_frequency_enum NOT NULL DEFAULT 'IMMEDIATE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_batches (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  notifications UUID[] NOT NULL DEFAULT '{}',
  status notification_batches_status_enum NOT NULL DEFAULT 'PENDING',
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications ("recipientId");
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications ("createdAt");
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications (channel);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications ("scheduledAt");
CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled ON notifications (status, "scheduledAt");

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_templates_slug ON notification_templates (slug, locale);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates (channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active ON notification_templates ("isActive");
CREATE INDEX IF NOT EXISTS idx_notification_templates_created_at ON notification_templates ("createdAt");

CREATE INDEX IF NOT EXISTS idx_notification_preferences_customer_id ON notification_preferences ("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_customer_channel ON notification_preferences ("customerId", channel);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_channel ON notification_preferences (channel);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_is_enabled ON notification_preferences ("isEnabled");

CREATE INDEX IF NOT EXISTS idx_notification_batches_status ON notification_batches (status);
CREATE INDEX IF NOT EXISTS idx_notification_batches_created_at ON notification_batches ("createdAt");
