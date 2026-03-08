import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSeoDraftQueueTables202603080001 implements MigrationInterface {
  name = 'CreateSeoDraftQueueTables202603080001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE seo_draft_changesets (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        locale VARCHAR(5) NOT NULL,
        fingerprint VARCHAR(128) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP WITH TIME ZONE,
        superseded_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE TABLE seo_draft_items (
        id BIGSERIAL PRIMARY KEY,
        changeset_id BIGINT NOT NULL REFERENCES seo_draft_changesets(id) ON DELETE CASCADE,
        field_name VARCHAR(100) NOT NULL,
        current_value TEXT,
        proposed_value TEXT,
        ai_confidence DECIMAL(5,2),
        reason TEXT,
        is_selected BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(changeset_id, field_name)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE seo_product_state (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        locale VARCHAR(5) NOT NULL,
        last_fingerprint VARCHAR(128),
        last_changeset_id BIGINT REFERENCES seo_draft_changesets(id) ON DELETE SET NULL,
        last_generated_at TIMESTAMP WITH TIME ZONE,
        last_approved_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_id, locale)
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_seo_draft_changesets_active_fingerprint ON seo_draft_changesets(product_id, locale, fingerprint) WHERE is_active = true`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_seo_draft_changesets_status ON seo_draft_changesets(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_seo_draft_changesets_created_at ON seo_draft_changesets(created_at)`,
    );

    await queryRunner.query(`CREATE INDEX idx_seo_draft_items_changeset_id ON seo_draft_items(changeset_id)`);

    await queryRunner.query(
      `CREATE INDEX idx_seo_product_state_product_locale ON seo_product_state(product_id, locale)`,
    );

    await queryRunner.query(`
      CREATE TRIGGER trigger_seo_draft_changesets_updated_at
        BEFORE UPDATE ON seo_draft_changesets
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_seo_draft_items_updated_at
        BEFORE UPDATE ON seo_draft_items
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_seo_product_state_updated_at
        BEFORE UPDATE ON seo_product_state
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_seo_product_state_updated_at ON seo_product_state`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_seo_draft_items_updated_at ON seo_draft_items`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_seo_draft_changesets_updated_at ON seo_draft_changesets`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS seo_product_state`);
    await queryRunner.query(`DROP TABLE IF EXISTS seo_draft_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS seo_draft_changesets`);
  }
}
