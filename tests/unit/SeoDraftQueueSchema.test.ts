import fs from 'fs';
import path from 'path';
import type { QueryRunner } from 'typeorm';

import { CreateSeoDraftQueueTables202603080001 } from '../../database/migrations/202603080001-CreateSeoDraftQueueTables';

const rootDir = path.resolve(__dirname, '..', '..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('SEO draft queue schema', () => {
  it('executes migration up SQL in the expected sequence', async () => {
    const migration = new CreateSeoDraftQueueTables202603080001();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    const calls = (queryRunner.query as jest.Mock).mock.calls.map(([sql]) =>
      normalizeSql(sql as string),
    );

    expect(calls).toHaveLength(11);
    expect(calls[0]).toContain('CREATE TABLE seo_draft_changesets');
    expect(calls[0]).toContain("CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'))");
    expect(calls[1]).toContain('CREATE TABLE seo_draft_items');
    expect(calls[2]).toContain('CREATE TABLE seo_product_state');
    expect(calls[3]).toContain('CREATE UNIQUE INDEX idx_seo_draft_changesets_active_fingerprint');
    expect(calls[4]).toContain('CREATE INDEX idx_seo_draft_changesets_status');
    expect(calls[5]).toContain('CREATE INDEX idx_seo_draft_changesets_created_at');
    expect(calls[6]).toContain('CREATE INDEX idx_seo_draft_items_changeset_id');
    expect(calls[7]).toContain('CREATE INDEX idx_seo_product_state_product_locale');
    expect(calls[8]).toContain('CREATE TRIGGER trigger_seo_draft_changesets_updated_at');
    expect(calls[9]).toContain('CREATE TRIGGER trigger_seo_draft_items_updated_at');
    expect(calls[10]).toContain('CREATE TRIGGER trigger_seo_product_state_updated_at');
  });

  it('executes migration down SQL in reverse teardown sequence', async () => {
    const migration = new CreateSeoDraftQueueTables202603080001();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    const calls = (queryRunner.query as jest.Mock).mock.calls.map(([sql]) =>
      normalizeSql(sql as string),
    );

    expect(calls).toEqual([
      'DROP TRIGGER IF EXISTS trigger_seo_product_state_updated_at ON seo_product_state',
      'DROP TRIGGER IF EXISTS trigger_seo_draft_items_updated_at ON seo_draft_items',
      'DROP TRIGGER IF EXISTS trigger_seo_draft_changesets_updated_at ON seo_draft_changesets',
      'DROP TABLE IF EXISTS seo_product_state',
      'DROP TABLE IF EXISTS seo_draft_items',
      'DROP TABLE IF EXISTS seo_draft_changesets',
    ]);
  });

  it('defines draft queue tables, status constraint, indexes, and triggers in migration source', () => {
    const migrationSql = readFile(
      'database/migrations/202603080001-CreateSeoDraftQueueTables.ts',
    );

    const normalizedMigrationSql = normalizeSql(migrationSql);

    expect(normalizedMigrationSql).toContain('CREATE TABLE seo_draft_changesets');
    expect(normalizedMigrationSql).toContain('CREATE TABLE seo_draft_items');
    expect(normalizedMigrationSql).toContain('CREATE TABLE seo_product_state');
    expect(normalizedMigrationSql).toContain(
      "CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'))",
    );
    expect(normalizedMigrationSql).toContain(
      'CREATE UNIQUE INDEX idx_seo_draft_changesets_active_fingerprint ON seo_draft_changesets(product_id, locale, fingerprint) WHERE is_active = true',
    );
    expect(normalizedMigrationSql).toContain(
      'CREATE INDEX idx_seo_draft_changesets_status ON seo_draft_changesets(status)',
    );
    expect(normalizedMigrationSql).toContain(
      'CREATE INDEX idx_seo_draft_changesets_created_at ON seo_draft_changesets(created_at)',
    );
    expect(normalizedMigrationSql).toContain(
      'CREATE INDEX idx_seo_draft_items_changeset_id ON seo_draft_items(changeset_id)',
    );
    expect(normalizedMigrationSql).toContain(
      'CREATE INDEX idx_seo_product_state_product_locale ON seo_product_state(product_id, locale)',
    );
    expect(normalizedMigrationSql).toContain('CREATE TRIGGER trigger_seo_draft_changesets_updated_at');
    expect(normalizedMigrationSql).toContain('CREATE TRIGGER trigger_seo_draft_items_updated_at');
    expect(normalizedMigrationSql).toContain('CREATE TRIGGER trigger_seo_product_state_updated_at');
  });

  it('keeps base SQL schemas aligned with SEO draft queue constraints, indexes, and triggers', () => {
    const schemaSql = readFile('database/schema.sql');
    const initSchemaSql = readFile('database/init-scripts/001-schema.sql');

    for (const sql of [schemaSql, initSchemaSql]) {
      const normalizedSql = normalizeSql(sql);

      expect(normalizedSql).toContain('CREATE TABLE seo_draft_changesets');
      expect(normalizedSql).toContain('CREATE TABLE seo_draft_items');
      expect(normalizedSql).toContain('CREATE TABLE seo_product_state');
      expect(normalizedSql).toContain(
        "CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'))",
      );
      expect(normalizedSql).toContain(
        'CREATE UNIQUE INDEX idx_seo_draft_changesets_active_fingerprint ON seo_draft_changesets(product_id, locale, fingerprint) WHERE is_active = true',
      );
      expect(normalizedSql).toContain(
        'CREATE INDEX idx_seo_draft_changesets_status ON seo_draft_changesets(status)',
      );
      expect(normalizedSql).toContain(
        'CREATE INDEX idx_seo_draft_changesets_created_at ON seo_draft_changesets(created_at)',
      );
      expect(normalizedSql).toContain(
        'CREATE INDEX idx_seo_draft_items_changeset_id ON seo_draft_items(changeset_id)',
      );
      expect(normalizedSql).toContain(
        'CREATE INDEX idx_seo_product_state_product_locale ON seo_product_state(product_id, locale)',
      );
      expect(normalizedSql).toContain('CREATE TRIGGER trigger_seo_draft_changesets_updated_at');
      expect(normalizedSql).toContain('CREATE TRIGGER trigger_seo_draft_items_updated_at');
      expect(normalizedSql).toContain('CREATE TRIGGER trigger_seo_product_state_updated_at');
    }
  });
});
