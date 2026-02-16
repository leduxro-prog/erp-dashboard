import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create SEO automation module tables
 */
export class CreateSeoTables1739710000000 implements MigrationInterface {
  name = 'CreateSeoTables1739710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE seo_locale_enum AS ENUM ('ro', 'en')
    `);

    await queryRunner.query(`
      CREATE TYPE seo_audit_status_enum AS ENUM (
        'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE seo_issue_severity_enum AS ENUM (
        'CRITICAL', 'WARNING', 'INFO'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE sitemap_type_enum AS ENUM (
        'PRODUCT', 'CATEGORY', 'PAGE'
      )
    `);

    // ── seo_metadata table ──
    await queryRunner.query(`
      CREATE TABLE seo_metadata (
        id UUID PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        locale seo_locale_enum NOT NULL,
        meta_title VARCHAR(60) NOT NULL,
        meta_description VARCHAR(160) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        canonical_url VARCHAR(512),
        og_title VARCHAR(255),
        og_description VARCHAR(255),
        og_image VARCHAR(512),
        twitter_title VARCHAR(255),
        twitter_description VARCHAR(255),
        focus_keyword VARCHAR(255),
        secondary_keywords TEXT[] DEFAULT '{}',
        seo_score INT DEFAULT 0,
        issues JSONB DEFAULT '[]',
        last_audited_at TIMESTAMP WITH TIME ZONE,
        last_published_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // ── seo_audit_results table ──
    await queryRunner.query(`
      CREATE TABLE seo_audit_results (
        id UUID PRIMARY KEY,
        metadata_id UUID NOT NULL,
        status seo_audit_status_enum NOT NULL DEFAULT 'PENDING',
        score INT,
        issues JSONB DEFAULT '[]',
        recommendations JSONB DEFAULT '{}',
        performance_score INT,
        accessibility_score INT,
        seo_score INT,
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // ── seo_issues table ──
    await queryRunner.query(`
      CREATE TABLE seo_issues (
        id UUID PRIMARY KEY,
        metadata_id UUID NOT NULL,
        issue_type VARCHAR(100) NOT NULL,
        severity seo_issue_severity_enum NOT NULL,
        message TEXT NOT NULL,
        suggestion TEXT,
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // ── sitemaps table ──
    await queryRunner.query(`
      CREATE TABLE sitemaps (
        id UUID PRIMARY KEY,
        type sitemap_type_enum NOT NULL,
        url VARCHAR(512) NOT NULL,
        url_count INT NOT NULL DEFAULT 0,
        content TEXT NOT NULL DEFAULT '',
        locale VARCHAR(50),
        is_published BOOLEAN DEFAULT false,
        published_at TIMESTAMP WITH TIME ZONE,
        last_generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // ── structured_data table ──
    await queryRunner.query(`
      CREATE TABLE structured_data (
        id UUID PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        schema_type VARCHAR(100) NOT NULL,
        schema JSONB NOT NULL DEFAULT '{}',
        locale VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        validation_score INT DEFAULT 0,
        validation_errors JSONB DEFAULT '{}',
        last_validated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // ── Indexes ──

    // seo_metadata indexes
    await queryRunner.query(
      `CREATE INDEX idx_seo_metadata_entity_type_id ON seo_metadata(entity_type, entity_id)`,
    );
    await queryRunner.query(`CREATE INDEX idx_seo_metadata_slug ON seo_metadata(slug)`);
    await queryRunner.query(`CREATE INDEX idx_seo_metadata_locale ON seo_metadata(locale)`);
    await queryRunner.query(`CREATE INDEX idx_seo_metadata_seo_score ON seo_metadata(seo_score)`);
    await queryRunner.query(`CREATE INDEX idx_seo_metadata_created_at ON seo_metadata(created_at)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_seo_metadata_entity_locale ON seo_metadata(entity_type, entity_id, locale)`,
    );

    // seo_audit_results indexes
    await queryRunner.query(
      `CREATE INDEX idx_seo_audit_results_metadata_id ON seo_audit_results(metadata_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_seo_audit_results_status ON seo_audit_results(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_seo_audit_results_created_at ON seo_audit_results(created_at)`,
    );
    await queryRunner.query(`CREATE INDEX idx_seo_audit_results_score ON seo_audit_results(score)`);

    // seo_issues indexes
    await queryRunner.query(`CREATE INDEX idx_seo_issues_metadata_id ON seo_issues(metadata_id)`);
    await queryRunner.query(`CREATE INDEX idx_seo_issues_severity ON seo_issues(severity)`);
    await queryRunner.query(`CREATE INDEX idx_seo_issues_created_at ON seo_issues(created_at)`);
    await queryRunner.query(`CREATE INDEX idx_seo_issues_issue_type ON seo_issues(issue_type)`);
    await queryRunner.query(`CREATE INDEX idx_seo_issues_resolved ON seo_issues(resolved)`);

    // sitemaps indexes
    await queryRunner.query(`CREATE INDEX idx_sitemaps_type ON sitemaps(type)`);
    await queryRunner.query(
      `CREATE INDEX idx_sitemaps_last_generated_at ON sitemaps(last_generated_at)`,
    );
    await queryRunner.query(`CREATE INDEX idx_sitemaps_created_at ON sitemaps(created_at)`);
    await queryRunner.query(`CREATE INDEX idx_sitemaps_is_published ON sitemaps(is_published)`);

    // structured_data indexes
    await queryRunner.query(
      `CREATE INDEX idx_structured_data_entity_type_id ON structured_data(entity_type, entity_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_structured_data_schema_type ON structured_data(schema_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_structured_data_created_at ON structured_data(created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_structured_data_is_active ON structured_data(is_active)`,
    );

    console.log('✅ SEO automation tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS structured_data`);
    await queryRunner.query(`DROP TABLE IF EXISTS sitemaps`);
    await queryRunner.query(`DROP TABLE IF EXISTS seo_issues`);
    await queryRunner.query(`DROP TABLE IF EXISTS seo_audit_results`);
    await queryRunner.query(`DROP TABLE IF EXISTS seo_metadata`);
    await queryRunner.query(`DROP TYPE IF EXISTS sitemap_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS seo_issue_severity_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS seo_audit_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS seo_locale_enum`);
    console.log('✅ SEO automation tables removed successfully');
  }
}
