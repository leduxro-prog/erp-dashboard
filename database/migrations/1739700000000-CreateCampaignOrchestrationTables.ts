import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Campaign Orchestration tables (WS-A)
 *
 * New tables:
 *   - marketing_campaigns_ext (extended campaign orchestration data)
 *   - campaign_steps (multi-step campaign journey)
 *   - audience_segments (persistent audience definitions)
 *   - channel_deliveries (per-delivery tracking)
 *   - customer_consents (per-channel consent)
 *   - attribution_events (UTM/conversion attribution)
 *
 * Previously unmigrated tables:
 *   - email_sequences
 *   - marketing_events
 *   - customer_loyalty
 *   - loyalty_points_transactions
 *   - campaign_audit_log (audit trail)
 */
export class CreateCampaignOrchestrationTables1739700000000 implements MigrationInterface {
  name = 'CreateCampaignOrchestrationTables1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ──────────────────────────────────────────────
    // 1. marketing_campaigns_ext
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE campaign_channel_enum AS ENUM (
        'EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'SOCIAL', 'DISPLAY'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE marketing_campaigns_ext (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        channels campaign_channel_enum[] NOT NULL DEFAULT '{}',
        schedule_type VARCHAR(50) NOT NULL DEFAULT 'IMMEDIATE',
        scheduled_at TIMESTAMP WITH TIME ZONE,
        timezone VARCHAR(100) DEFAULT 'Europe/Bucharest',
        recurrence_rule JSONB,
        frequency_cap_per_contact INTEGER DEFAULT 3,
        frequency_cap_window_hours INTEGER DEFAULT 168,
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_content VARCHAR(255),
        utm_term VARCHAR(255),
        ab_test_config JSONB,
        priority INTEGER DEFAULT 5,
        tags TEXT[] DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_campaigns_ext_campaign_id UNIQUE (campaign_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_campaigns_ext_campaign_id ON marketing_campaigns_ext(campaign_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_campaigns_ext_schedule_type ON marketing_campaigns_ext(schedule_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_campaigns_ext_scheduled_at ON marketing_campaigns_ext(scheduled_at)`,
    );

    // ──────────────────────────────────────────────
    // 2. campaign_steps
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE step_type_enum AS ENUM (
        'SEND_EMAIL', 'SEND_SMS', 'SEND_WHATSAPP', 'SEND_PUSH',
        'WAIT', 'CONDITION', 'SPLIT', 'WEBHOOK'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE step_status_enum AS ENUM (
        'PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'FAILED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE campaign_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_type step_type_enum NOT NULL,
        status step_status_enum NOT NULL DEFAULT 'PENDING',
        name VARCHAR(255) NOT NULL,
        description TEXT,
        channel campaign_channel_enum,
        template_id VARCHAR(255),
        template_data JSONB DEFAULT '{}',
        delay_minutes INTEGER DEFAULT 0,
        condition_rules JSONB,
        split_config JSONB,
        webhook_url VARCHAR(512),
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_campaign_steps_campaign_id ON campaign_steps(campaign_id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_campaign_steps_status ON campaign_steps(status)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_campaign_steps_order ON campaign_steps(campaign_id, step_order)`,
    );

    // ──────────────────────────────────────────────
    // 3. audience_segments
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE audience_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filter_criteria JSONB NOT NULL DEFAULT '{}',
        estimated_size INTEGER DEFAULT 0,
        last_computed_at TIMESTAMP WITH TIME ZONE,
        is_dynamic BOOLEAN DEFAULT true,
        cached_customer_ids UUID[] DEFAULT '{}',
        created_by UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_audience_segments_name ON audience_segments(name)`);
    await queryRunner.query(
      `CREATE INDEX idx_audience_segments_created_by ON audience_segments(created_by)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audience_segments_created_at ON audience_segments(created_at)`,
    );

    // ──────────────────────────────────────────────
    // 4. channel_deliveries
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE delivery_status_enum AS ENUM (
        'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED',
        'BOUNCED', 'FAILED', 'UNSUBSCRIBED', 'RETRYING'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE channel_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,
        customer_id UUID NOT NULL,
        channel campaign_channel_enum NOT NULL,
        status delivery_status_enum NOT NULL DEFAULT 'QUEUED',
        recipient_address VARCHAR(512) NOT NULL,
        template_id VARCHAR(255),
        template_data JSONB DEFAULT '{}',
        external_message_id VARCHAR(255),
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        opened_at TIMESTAMP WITH TIME ZONE,
        clicked_at TIMESTAMP WITH TIME ZONE,
        failed_at TIMESTAMP WITH TIME ZONE,
        failure_reason TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        cost DECIMAL(10, 4) DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_channel_deliveries_campaign_id ON channel_deliveries(campaign_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_channel_deliveries_step_id ON channel_deliveries(step_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_channel_deliveries_customer_id ON channel_deliveries(customer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_channel_deliveries_status ON channel_deliveries(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_channel_deliveries_channel ON channel_deliveries(channel)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_channel_deliveries_sent_at ON channel_deliveries(sent_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_channel_deliveries_created_at ON channel_deliveries(created_at)`,
    );

    // ──────────────────────────────────────────────
    // 5. customer_consents
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE customer_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        channel campaign_channel_enum NOT NULL,
        is_opted_in BOOLEAN NOT NULL DEFAULT false,
        opted_in_at TIMESTAMP WITH TIME ZONE,
        opted_out_at TIMESTAMP WITH TIME ZONE,
        consent_source VARCHAR(255),
        ip_address VARCHAR(45),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_customer_channel_consent UNIQUE (customer_id, channel)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_customer_consents_customer_id ON customer_consents(customer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_customer_consents_channel ON customer_consents(channel)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_customer_consents_opted_in ON customer_consents(is_opted_in)`,
    );

    // ──────────────────────────────────────────────
    // 6. attribution_events
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE attribution_type_enum AS ENUM (
        'FIRST_TOUCH', 'LAST_TOUCH', 'ASSISTED', 'LINEAR', 'TIME_DECAY'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE attribution_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        customer_id UUID NOT NULL,
        channel campaign_channel_enum NOT NULL,
        attribution_type attribution_type_enum NOT NULL DEFAULT 'LAST_TOUCH',
        touchpoint_type VARCHAR(100) NOT NULL,
        touchpoint_url VARCHAR(1024),
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_content VARCHAR(255),
        utm_term VARCHAR(255),
        click_id VARCHAR(255),
        order_id UUID,
        revenue DECIMAL(12, 2) DEFAULT 0,
        cost DECIMAL(12, 2) DEFAULT 0,
        is_conversion BOOLEAN DEFAULT false,
        conversion_value DECIMAL(12, 2),
        session_id VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        touchpoint_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_attribution_events_campaign_id ON attribution_events(campaign_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_attribution_events_customer_id ON attribution_events(customer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_attribution_events_channel ON attribution_events(channel)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_attribution_events_conversion ON attribution_events(is_conversion)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_attribution_events_order_id ON attribution_events(order_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_attribution_events_touchpoint_at ON attribution_events(touchpoint_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_attribution_events_created_at ON attribution_events(created_at)`,
    );

    // ──────────────────────────────────────────────
    // 7. email_sequences (existing entity, no migration)
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE email_sequence_status_enum AS ENUM (
        'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE email_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        status email_sequence_status_enum NOT NULL DEFAULT 'DRAFT',
        step_count INTEGER NOT NULL DEFAULT 0,
        steps JSONB DEFAULT '[]',
        total_emails_sent INTEGER DEFAULT 0,
        total_opens INTEGER DEFAULT 0,
        total_clicks INTEGER DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_email_sequences_campaign_id ON email_sequences(campaign_id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_email_sequences_status ON email_sequences(status)`);
    await queryRunner.query(
      `CREATE INDEX idx_email_sequences_created_at ON email_sequences(created_at)`,
    );

    // ──────────────────────────────────────────────
    // 8. marketing_events (existing entity, no migration)
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE marketing_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID,
        event_type VARCHAR(100) NOT NULL,
        description TEXT,
        data JSONB DEFAULT '{}',
        campaign_id VARCHAR(255),
        source_channel VARCHAR(255),
        processed BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_marketing_events_customer_id ON marketing_events(customer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketing_events_event_type ON marketing_events(event_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketing_events_campaign_id ON marketing_events(campaign_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_marketing_events_created_at ON marketing_events(created_at)`,
    );

    // ──────────────────────────────────────────────
    // 9. customer_loyalty (existing entity, no migration)
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE loyalty_tier_enum AS ENUM (
        'bronze', 'silver', 'gold', 'platinum'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE customer_loyalty (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        points_balance INTEGER DEFAULT 0,
        lifetime_points_earned INTEGER DEFAULT 0,
        lifetime_points_redeemed INTEGER DEFAULT 0,
        tier loyalty_tier_enum DEFAULT 'bronze',
        tier_expiry_date TIMESTAMP,
        points_expiry_date TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_customer_loyalty_customer_id UNIQUE (customer_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_customer_loyalty_customer_id ON customer_loyalty(customer_id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_customer_loyalty_tier ON customer_loyalty(tier)`);

    // ──────────────────────────────────────────────
    // 10. loyalty_points_transactions (existing entity, no migration)
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE points_transaction_type_enum AS ENUM (
        'earned', 'redeemed', 'expired', 'adjustment', 'bonus'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE loyalty_points_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        transaction_type points_transaction_type_enum NOT NULL,
        points INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reference_type VARCHAR(255),
        reference_id VARCHAR(100),
        description TEXT,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_loyalty_txn_customer_id ON loyalty_points_transactions(customer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_loyalty_txn_created_at ON loyalty_points_transactions(created_at)`,
    );

    // ──────────────────────────────────────────────
    // 11. campaign_audit_log (audit trail for campaign lifecycle)
    // ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE campaign_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        actor_id UUID NOT NULL,
        previous_state JSONB,
        new_state JSONB,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_campaign_audit_log_campaign_id ON campaign_audit_log(campaign_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_campaign_audit_log_action ON campaign_audit_log(action)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_campaign_audit_log_actor_id ON campaign_audit_log(actor_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_campaign_audit_log_created_at ON campaign_audit_log(created_at)`,
    );

    console.log('Campaign orchestration tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS campaign_audit_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS loyalty_points_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS customer_loyalty`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketing_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS email_sequences`);
    await queryRunner.query(`DROP TABLE IF EXISTS attribution_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS customer_consents`);
    await queryRunner.query(`DROP TABLE IF EXISTS channel_deliveries`);
    await queryRunner.query(`DROP TABLE IF EXISTS campaign_steps`);
    await queryRunner.query(`DROP TABLE IF EXISTS marketing_campaigns_ext`);

    await queryRunner.query(`DROP TYPE IF EXISTS points_transaction_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS loyalty_tier_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS email_sequence_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS attribution_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS delivery_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS step_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS step_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS campaign_channel_enum`);

    console.log('Campaign orchestration tables removed successfully');
  }
}
