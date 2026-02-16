-- ================================================================
-- Migration: 0005 - Outbox Events and Idempotency
-- Author: AI 2 (Data/DB)
-- Date: 2026-02-13
-- ================================================================
-- Description: Create outbox pattern tables for async events and idempotency
-- Impact: Core event streaming infrastructure for B2B/ERP integration
-- Rollback: DROP TABLE IF EXISTS ... CASCADE; DROP TYPE IF EXISTS ...
-- ================================================================

-- ================================================================
-- TYPES (ENUMS)
-- ================================================================

-- Outbox event status
CREATE TYPE shared_outbox_status AS ENUM (
    'pending',      -- Created, not yet published
    'processing',   -- Being published
    'published',    -- Successfully published to message broker
    'failed',       -- Publishing failed, will retry
    'discarded'     -- Max retries reached, discarded
);

-- Event domain/category
CREATE TYPE shared_event_domain AS ENUM (
    'catalog',      -- Product-related events
    'customer',     -- Customer-related events
    'order',        -- Order-related events
    'payment',      -- Payment-related events
    'credit',       -- Credit-related events
    'inventory',    -- Inventory-related events
    'shipping',     -- Shipping-related events
    'notification', -- Notification events
    'system'        -- System events
);

-- Event priority
CREATE TYPE shared_event_priority AS ENUM (
    'low',          -- Low priority, can be delayed
    'normal',       -- Normal priority, default
    'high',         -- High priority, process soon
    'critical'      -- Critical priority, process immediately
);

-- ================================================================
-- shared.outbox_events
-- Outbox pattern for reliable event publishing
-- CRITICAL: Events are never deleted after publishing for audit trail
-- ================================================================
CREATE TABLE shared.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE,

    -- Event identification
    event_type VARCHAR(255) NOT NULL,
    event_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    event_domain shared_event_domain NOT NULL,

    -- Source
    source_service VARCHAR(100) NOT NULL,      -- b2b, erp, etc.
    source_entity_type VARCHAR(100),            -- product, order, etc.
    source_entity_id UUID,

    -- Correlation for event chains
    correlation_id VARCHAR(255),
    causation_id UUID,                           -- ID of event that caused this
    parent_event_id UUID,                        -- Parent event in chain

    -- Event payload
    payload JSONB NOT NULL DEFAULT '{}',
    payload_size INTEGER,

    -- Event metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    content_type VARCHAR(50) NOT NULL DEFAULT 'application/json',

    -- Priority
    priority shared_event_priority NOT NULL DEFAULT 'normal',

    -- Delivery
    publish_to VARCHAR(100) NOT NULL DEFAULT 'rabbitmq', -- rabbitmq, kafka, etc.
    exchange VARCHAR(255),
    routing_key VARCHAR(255),
    topic VARCHAR(255),

    -- Status and processing
    status shared_outbox_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timing
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    -- Error info
    error_message TEXT,
    error_code VARCHAR(50),
    error_details JSONB,

    -- Version for optimistic locking
    version INTEGER NOT NULL DEFAULT 1,

    -- Timestamps
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_outbox_payload_size CHECK (payload_size IS NULL OR payload_size >= 0),
    CONSTRAINT ck_outbox_attempts CHECK (attempts >= 0 AND max_attempts > 0),
    CONSTRAINT ck_outbox_version CHECK (version > 0)
);

CREATE TRIGGER outbox_events_updated_at
    BEFORE UPDATE ON shared.outbox_events
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes for event processing
CREATE INDEX idx_outbox_status_occurred_at ON shared.outbox_events(status, occurred_at);
CREATE INDEX idx_outbox_event_type_occurred_at ON shared.outbox_events(event_type, occurred_at);
CREATE INDEX idx_outbox_domain_occurred_at ON shared.outbox_events(event_domain, occurred_at);
CREATE INDEX idx_outbox_priority_occurred_at ON shared.outbox_events(priority, occurred_at DESC);
CREATE INDEX idx_outbox_next_attempt ON shared.outbox_events(next_attempt_at)
    WHERE status IN ('pending', 'failed');
CREATE INDEX idx_outbox_correlation_id ON shared.outbox_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_outbox_causation_id ON shared.outbox_events(causation_id) WHERE causation_id IS NOT NULL;
CREATE INDEX idx_outbox_parent_event_id ON shared.outbox_events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX idx_outbox_source_entity ON shared.outbox_events(source_entity_type, source_entity_id)
    WHERE source_entity_type IS NOT NULL;
CREATE INDEX idx_outbox_event_id ON shared.outbox_events(event_id);

-- Partial index for failed events needing retry
CREATE INDEX idx_outbox_failed_retry ON shared.outbox_events(id, next_attempt_at)
    WHERE status = 'failed' AND attempts < max_attempts;

COMMENT ON TABLE shared.outbox_events IS 'Outbox pattern for reliable event publishing - events never deleted';
COMMENT ON COLUMN shared.outbox_events.event_id IS 'Unique identifier for this event instance';
COMMENT ON COLUMN shared.outbox_events.correlation_id IS 'Links events in a business transaction chain';
COMMENT ON COLUMN shared.outbox_events.causation_id IS 'Links to event that directly caused this event';

-- ================================================================
-- shared.processed_events
-- Idempotency tracking for event consumers
-- Ensures each event is processed exactly once per consumer
-- ================================================================
CREATE TABLE shared.processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event reference
    event_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,

    -- Consumer identification
    consumer_name VARCHAR(255) NOT NULL,      -- e.g., b2b_order_handler
    consumer_group VARCHAR(255),              -- Consumer group for load balancing

    -- Processing status
    status VARCHAR(50) NOT NULL DEFAULT 'completed', -- completed, failed, in_progress

    -- Processing info
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_duration_ms INTEGER,            -- Processing time in milliseconds
    processing_attempts INTEGER NOT NULL DEFAULT 1,

    -- Result
    result VARCHAR(50),                        -- success, partial, failed
    output JSONB,                              -- Output from processing

    -- Error info
    error_message TEXT,
    error_code VARCHAR(50),
    error_details JSONB,
    stack_trace TEXT,

    -- Retry info
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    max_retries INTEGER NOT NULL DEFAULT 3,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_processed_events UNIQUE (consumer_name, event_id),
    CONSTRAINT uq_processed_events_consumer_group UNIQUE (consumer_group, event_id) WHERE consumer_group IS NOT NULL,
    CONSTRAINT ck_processed_events_duration CHECK (processing_duration_ms IS NULL OR processing_duration_ms >= 0),
    CONSTRAINT ck_processed_events_attempts CHECK (processing_attempts > 0)
);

CREATE TRIGGER processed_events_updated_at
    BEFORE UPDATE ON shared.processed_events
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes for idempotency checks
CREATE INDEX idx_processed_events_consumer ON shared.processed_events(consumer_name);
CREATE INDEX idx_processed_events_event_id ON shared.processed_events(event_id);
CREATE INDEX idx_processed_events_event_type ON shared.processed_events(event_type);
CREATE INDEX idx_processed_events_status ON shared.processed_events(status);
CREATE INDEX idx_processed_events_processed_at ON shared.processed_events(processed_at DESC);
CREATE INDEX idx_processed_events_retry ON shared.processed_events(next_retry_at)
    WHERE status = 'failed' AND retry_count < max_retries;

COMMENT ON TABLE shared.processed_events IS 'Idempotency tracking for event consumers - ensures each event processed once per consumer';
COMMENT ON COLUMN shared.processed_events.consumer_name IS 'Unique consumer identifier (e.g., b2b_order_handler)';

-- ================================================================
-- shared.event_subscriptions
-- Event subscriptions (which consumers subscribe to which events)
-- ================================================================
CREATE TABLE shared.event_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Consumer info
    consumer_name VARCHAR(255) NOT NULL,
    consumer_group VARCHAR(255),
    consumer_description TEXT,

    -- Subscription filter
    event_type VARCHAR(255),                    -- NULL = all events
    event_domain shared_event_domain,
    event_filter JSONB,                        -- Additional filter criteria

    -- Subscription settings
    is_active BOOLEAN NOT NULL DEFAULT true,
    delivery_mode VARCHAR(50) NOT NULL DEFAULT 'auto', -- auto, manual, batch
    batch_size INTEGER,
    batch_window_ms INTEGER,
    max_concurrent INTEGER,

    -- Retry settings
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_backoff_ms INTEGER NOT NULL DEFAULT 1000,
    max_retry_backoff_ms INTEGER NOT NULL DEFAULT 60000,

    -- Dead letter queue
    dlq_enabled BOOLEAN NOT NULL DEFAULT true,
    dlq_max_items INTEGER,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,

    CONSTRAINT uq_event_subscriptions UNIQUE (consumer_name, event_type, event_domain),
    CONSTRAINT ck_event_subscriptions_batch CHECK (
        (batch_size IS NULL OR batch_size > 0) AND
        (batch_window_ms IS NULL OR batch_window_ms > 0)
    ),
    CONSTRAINT ck_event_subscriptions_retry CHECK (
        max_retries >= 0 AND
        retry_backoff_ms > 0 AND
        max_retry_backoff_ms >= retry_backoff_ms
    ),
    CONSTRAINT ck_event_subscriptions_max_concurrent CHECK (max_concurrent IS NULL OR max_concurrent > 0)
);

CREATE TRIGGER event_subscriptions_updated_at
    BEFORE UPDATE ON shared.event_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_event_subscriptions_consumer ON shared.event_subscriptions(consumer_name);
CREATE INDEX idx_event_subscriptions_domain ON shared.event_subscriptions(event_domain);
CREATE INDEX idx_event_subscriptions_type ON shared.event_subscriptions(event_type);
CREATE INDEX idx_event_subscriptions_active ON shared.event_subscriptions(is_active);

COMMENT ON TABLE shared.event_subscriptions IS 'Event subscriptions - which consumers subscribe to which events';

-- ================================================================
-- shared.dead_letter_queue
-- Dead letter queue for failed events
-- ================================================================
CREATE TABLE shared.dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Original event reference
    original_event_id UUID NOT NULL,
    original_event_type VARCHAR(255) NOT NULL,

    -- Consumer that failed to process
    consumer_name VARCHAR(255) NOT NULL,

    -- Original data
    original_payload JSONB NOT NULL,
    original_metadata JSONB NOT NULL DEFAULT '{}',

    -- Error info
    error_message TEXT NOT NULL,
    error_code VARCHAR(50),
    error_details JSONB,
    stack_trace TEXT,

    -- Failure count
    failure_count INTEGER NOT NULL DEFAULT 1,

    -- Resolution
    resolution_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, resolved, ignored
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Retry option
    can_retry BOOLEAN NOT NULL DEFAULT true,
    retry_after TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dlq_resolved_by FOREIGN KEY (resolved_by)
        REFERENCES erp.users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT ck_dlq_failure_count CHECK (failure_count > 0),
    CONSTRAINT ck_dlq_retry_count CHECK (retry_count >= 0)
);

CREATE TRIGGER dead_letter_queue_updated_at
    BEFORE UPDATE ON shared.dead_letter_queue
    FOR EACH ROW
    EXECUTE FUNCTION b2b.update_updated_at();

-- Indexes
CREATE INDEX idx_dlq_event_id ON shared.dead_letter_queue(original_event_id);
CREATE INDEX idx_dlq_consumer ON shared.dead_letter_queue(consumer_name);
CREATE INDEX idx_dlq_status ON shared.dead_letter_queue(resolution_status);
CREATE INDEX idx_dlq_can_retry ON shared.dead_letter_queue(can_retry, retry_after) WHERE can_retry = true AND retry_after IS NOT NULL;
CREATE INDEX idx_dlq_created_at ON shared.dead_letter_queue(created_at DESC);

COMMENT ON TABLE shared.dead_letter_queue IS 'Dead letter queue for failed events';

-- ================================================================
-- shared.event_replay
-- Event replay tracking for debugging/fixing issues
-- ================================================================
CREATE TABLE shared.event_replay (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Replay session
    replay_id VARCHAR(255) NOT NULL,
    replay_session_id UUID NOT NULL,

    -- Event to replay
    event_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,

    -- Target consumer
    consumer_name VARCHAR(255) NOT NULL,

    -- Replay settings
    replay_mode VARCHAR(50) NOT NULL DEFAULT 'replay', -- replay, skip, modify
    modified_payload JSONB,

    -- Execution
    replay_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Result
    result VARCHAR(50),
    output JSONB,
    error_message TEXT,

    -- Who requested
    requested_by UUID NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_event_replay_requested_by FOREIGN KEY (requested_by)
        REFERENCES erp.users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT uq_event_replay_session UNIQUE (replay_session_id, event_id, consumer_name)
);

-- Indexes
CREATE INDEX idx_event_replay_session ON shared.event_replay(replay_session_id);
CREATE INDEX idx_event_replay_status ON shared.event_replay(replay_status);
CREATE INDEX idx_event_replay_event_id ON shared.event_replay(event_id);

COMMENT ON TABLE shared.event_replay IS 'Event replay tracking for debugging/fixing issues';

-- ================================================================
-- FUNCTIONS FOR EVENT PROCESSING
-- ================================================================

-- Function to check if event has been processed by consumer
CREATE OR REPLACE FUNCTION shared.is_event_processed(p_event_id UUID, p_consumer_name VARCHAR)
RETURNS BOOLEAN AS $$
    v_processed BOOLEAN;
BEGIN
    SELECT processed_at IS NOT NULL INTO v_processed
    FROM shared.processed_events
    WHERE event_id = p_event_id
      AND consumer_name = p_consumer_name
      AND status IN ('completed', 'in_progress')
    LIMIT 1;

    RETURN COALESCE(v_processed, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to record event processing
CREATE OR REPLACE FUNCTION shared.record_event_processing(
    p_event_id UUID,
    p_event_type VARCHAR,
    p_consumer_name VARCHAR,
    p_status VARCHAR DEFAULT 'completed',
    p_result VARCHAR DEFAULT 'success',
    p_output JSONB DEFAULT NULL,
    p_error_message VARCHAR DEFAULT NULL,
    p_error_code VARCHAR DEFAULT NULL,
    p_error_details JSONB DEFAULT NULL,
    p_processing_duration_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO shared.processed_events (
        event_id,
        event_type,
        consumer_name,
        status,
        result,
        output,
        error_message,
        error_code,
        error_details,
        processing_duration_ms
    ) VALUES (
        p_event_id,
        p_event_type,
        p_consumer_name,
        p_status,
        p_result,
        p_output,
        p_error_message,
        p_error_code,
        p_error_details,
        p_processing_duration_ms
    ) ON CONFLICT (consumer_name, event_id) DO UPDATE SET
        status = EXCLUDED.status,
        result = EXCLUDED.result,
        output = EXCLUDED.output,
        error_message = EXCLUDED.error_message,
        error_code = EXCLUDED.error_code,
        error_details = EXCLUDED.error_details,
        processing_attempts = processed_events.processing_attempts + 1,
        processing_duration_ms = EXCLUDED.processing_duration_ms,
        updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get next batch of events for processing
CREATE OR REPLACE FUNCTION shared.get_next_events(
    p_consumer_name VARCHAR,
    p_batch_size INTEGER DEFAULT 10,
    p_max_attempts INTEGER DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    event_id UUID,
    event_type VARCHAR,
    payload JSONB,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT oe.id, oe.event_id, oe.event_type, oe.payload, oe.metadata
    FROM shared.outbox_events oe
    WHERE oe.status = 'pending'
      AND oe.next_attempt_at <= NOW()
      AND oe.attempts < p_max_attempts
      AND NOT EXISTS (
          SELECT 1 FROM shared.processed_events pe
          WHERE pe.event_id = oe.event_id
            AND pe.consumer_name = p_consumer_name
            AND pe.status = 'completed'
      )
    ORDER BY oe.priority DESC, oe.occurred_at ASC
    LIMIT p_batch_size
    FOR UPDATE OF oe SKIP LOCKED;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to mark events as being processed
CREATE OR REPLACE FUNCTION shared.mark_events_processing(p_event_ids UUID[])
RETURNS INTEGER AS $$
    v_count INTEGER;
BEGIN
    UPDATE shared.outbox_events
    SET status = 'processing',
        attempts = attempts + 1,
        updated_at = NOW()
    WHERE id = ANY(p_event_ids)
      AND status = 'pending';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to mark events as published successfully
CREATE OR REPLACE FUNCTION shared.mark_events_published(p_event_ids UUID[])
RETURNS INTEGER AS $$
    v_count INTEGER;
BEGIN
    UPDATE shared.outbox_events
    SET status = 'published',
        published_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(p_event_ids)
      AND status = 'processing';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to mark events as failed
CREATE OR REPLACE FUNCTION shared.mark_events_failed(
    p_event_ids UUID[],
    p_error_message TEXT,
    p_error_code VARCHAR DEFAULT NULL,
    p_retry_after_ms INTEGER DEFAULT 60000
)
RETURNS INTEGER AS $$
    v_count INTEGER;
    v_should_discard BOOLEAN;
BEGIN
    -- Check if should discard (max attempts reached)
    SELECT COUNT(*) = array_length(p_event_ids, 1) INTO v_should_discard
    FROM shared.outbox_events
    WHERE id = ANY(p_event_ids)
      AND attempts >= max_attempts;

    IF v_should_discard THEN
        UPDATE shared.outbox_events
        SET status = 'discarded',
            error_message = p_error_message,
            error_code = p_error_code,
            failed_at = NOW(),
            updated_at = NOW()
        WHERE id = ANY(p_event_ids);
    ELSE
        UPDATE shared.outbox_events
        SET status = 'failed',
            attempts = attempts + 1,
            error_message = p_error_message,
            error_code = p_error_code,
            failed_at = NOW(),
            next_attempt_at = NOW() + (p_retry_after_ms || 'ms')::INTERVAL,
            updated_at = NOW()
        WHERE id = ANY(p_event_ids);
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- VIEWS FOR MONITORING
-- ================================================================

-- View: Outbox events summary
CREATE OR REPLACE VIEW shared.outbox_events_summary AS
SELECT
    status,
    event_domain,
    COUNT(*) AS event_count,
    MIN(occurred_at) AS oldest_event,
    MAX(occurred_at) AS newest_event,
    AVG(occurred_at::timestamp) AS avg_occurred_at,
    SUM(payload_size) AS total_payload_size
FROM shared.outbox_events
GROUP BY status, event_domain
ORDER BY status, event_domain;

COMMENT ON VIEW shared.outbox_events_summary IS 'Summary of outbox events by status and domain';

-- View: Failed events requiring attention
CREATE OR REPLACE VIEW shared.failed_events_alert AS
SELECT
    oe.id,
    oe.event_id,
    oe.event_type,
    oe.event_domain,
    oe.status,
    oe.attempts,
    oe.max_attempts,
    oe.error_message,
    oe.failed_at,
    oe.next_attempt_at,
    CASE
        WHEN oe.attempts >= oe.max_attempts THEN 'critical'
        WHEN oe.attempts >= oe.max_attempts / 2 THEN 'warning'
        ELSE 'normal'
    END AS alert_level
FROM shared.outbox_events oe
WHERE oe.status = 'failed'
ORDER BY oe.failed_at DESC;

COMMENT ON VIEW shared.failed_events_alert IS 'Failed events requiring attention';

-- View: Consumer processing stats
CREATE OR REPLACE VIEW shared.consumer_processing_stats AS
SELECT
    consumer_name,
    COUNT(*) AS total_processed,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
    MIN(processed_at) AS first_processed,
    MAX(processed_at) AS last_processed,
    AVG(processing_duration_ms) AS avg_duration_ms,
    MAX(processing_duration_ms) AS max_duration_ms,
    SUM(processing_attempts) AS total_attempts
FROM shared.processed_events
GROUP BY consumer_name
ORDER BY total_processed DESC;

COMMENT ON VIEW shared.consumer_processing_stats IS 'Consumer processing statistics';

-- ================================================================
-- CLEANUP JOBS (Manual execution required)
-- ================================================================

-- Function to archive old published events (not delete!)
CREATE OR REPLACE FUNCTION shared.archive_published_events(p_days_older_than INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
    v_count INTEGER;
BEGIN
    -- This would move to archive table in production
    -- For now, we just count what would be archived
    SELECT COUNT(*) INTO v_count
    FROM shared.outbox_events
    WHERE status = 'published'
      AND published_at < NOW() - (p_days_older_than || ' days')::INTERVAL;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to delete old discarded events
CREATE OR REPLACE FUNCTION shared.delete_discarded_events(p_days_older_than INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
    v_count INTEGER;
BEGIN
    DELETE FROM shared.outbox_events
    WHERE status = 'discarded'
      AND failed_at < NOW() - (p_days_older_than || ' days')::INTERVAL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- COMMENTS SUMMARY
-- ================================================================

\echo 'Migration 0005 completed successfully - Outbox Events and Idempotency tables created'

-- ================================================================
-- DOWN (Rollback)
-- ================================================================
-- DROP FUNCTION IF EXISTS shared.delete_discarded_events(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS shared.archive_published_events(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS shared.mark_events_failed(UUID[], VARCHAR, VARCHAR, INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS shared.mark_events_published(UUID[]) CASCADE;
-- DROP FUNCTION IF EXISTS shared.mark_events_processing(UUID[]) CASCADE;
-- DROP FUNCTION IF EXISTS shared.get_next_events(VARCHAR, INTEGER, INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS shared.record_event_processing(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, JSONB, VARCHAR, VARCHAR, JSONB, INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS shared.is_event_processed(UUID, VARCHAR) CASCADE;
--
-- DROP VIEW IF EXISTS shared.consumer_processing_stats;
-- DROP VIEW IF EXISTS shared.failed_events_alert;
-- DROP VIEW IF EXISTS shared.outbox_events_summary;
--
-- DROP TABLE IF EXISTS shared.event_replay CASCADE;
-- DROP TABLE IF EXISTS shared.dead_letter_queue CASCADE;
-- DROP TABLE IF EXISTS shared.event_subscriptions CASCADE;
-- DROP TABLE IF EXISTS shared.processed_events CASCADE;
-- DROP TABLE IF EXISTS shared.outbox_events CASCADE;
--
-- DROP TYPE IF EXISTS shared_event_priority;
-- DROP TYPE IF EXISTS shared_event_domain;
-- DROP TYPE IF EXISTS shared_outbox_status;
