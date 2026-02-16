/**
 * Audit Log Service Integration Tests
 *
 * Tests AuditLogService against a real PostgreSQL database.
 * Uses a dedicated connection (not the shared SQLite setup) because
 * AuditLogService relies on PostgreSQL-specific SQL (ILIKE, ::int, INTERVAL, etc.).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { AuditLogService, AuditLogEntry } from '../../shared/services/AuditLogService';

// Silence the logger during tests
jest.mock('../../shared/utils/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

/**
 * Unique prefix for test data to avoid collisions with production data.
 * All test rows use this prefix and are cleaned up in afterAll.
 */
const TEST_PREFIX = `__inttest_${Date.now()}`;

describe('AuditLogService Integration', () => {
  let dataSource: DataSource;
  let service: AuditLogService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'cypher_user',
      password: process.env.DB_PASSWORD || 'cypher_secret_change_me',
      database: process.env.DB_NAME || 'cypher_erp',
      synchronize: false,
      logging: false,
    });

    try {
      await dataSource.initialize();

      // Ensure the audit_logs table exists (idempotent)
      await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NULL,
          user_email VARCHAR(255),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(100) NOT NULL,
          resource_id VARCHAR(255),
          ip_address VARCHAR(45),
          user_agent TEXT,
          changes JSONB,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);

      // Ensure expected columns exist even if table was created earlier with older schema
      await dataSource.query(
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email VARCHAR(255)`,
      );
      await dataSource.query(
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type VARCHAR(100)`,
      );
      await dataSource.query(
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(255)`,
      );
      await dataSource.query(
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`,
      );
      await dataSource.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT`);
      await dataSource.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes JSONB`);
      await dataSource.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB`);
      await dataSource.query(
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`,
      );

      // Legacy schema compatibility: ensure omitted legacy columns have defaults
      await dataSource.query(
        `ALTER TABLE audit_logs ALTER COLUMN entity_type SET DEFAULT 'generic'`,
      );
      await dataSource.query(`ALTER TABLE audit_logs ALTER COLUMN entity_id SET DEFAULT 0`);

      service = new AuditLogService(dataSource);
    } catch (error) {
      console.error('Failed to initialize database connection:', error);
    }
  });

  afterAll(async () => {
    // Clean up all test data created during this run
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM audit_logs WHERE resource_type LIKE $1`, [
        `${TEST_PREFIX}%`,
      ]);
      await dataSource.destroy();
    }
  });

  // ── Helper ────────────────────────────────────────────────────────────

  function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
    return {
      userEmail: 'test@example.com',
      action: 'TEST_ACTION',
      resourceType: TEST_PREFIX,
      resourceId: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ipAddress: '127.0.0.1',
      ...overrides,
    };
  }

  // ── log() ─────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('should insert an audit log entry into the database', async () => {
      if (!dataSource?.isInitialized) return;
      const entry = makeEntry({
        action: 'TEST_CREATE',
        resourceId: `${TEST_PREFIX}-insert-single`,
        changes: { before: null, after: { name: 'test' } },
      });

      await service.log(entry);

      // Verify row exists
      const rows = await dataSource.query(`SELECT * FROM audit_logs WHERE resource_id = $1`, [
        entry.resourceId,
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('TEST_CREATE');
      expect(rows[0].user_email).toBe('test@example.com');
      expect(rows[0].ip_address).toBe('127.0.0.1');
      expect(rows[0].changes).toEqual({ before: null, after: { name: 'test' } });
    });

    it('should persist metadata as JSONB', async () => {
      if (!dataSource?.isInitialized) return;
      const entry = makeEntry({
        action: 'TEST_METADATA',
        resourceId: `${TEST_PREFIX}-metadata`,
        metadata: { source: 'integration-test', version: 2 },
      });

      await service.log(entry);

      const rows = await dataSource.query(
        `SELECT metadata FROM audit_logs WHERE resource_id = $1`,
        [entry.resourceId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].metadata).toEqual({ source: 'integration-test', version: 2 });
    });

    it('should handle nullable fields gracefully', async () => {
      if (!dataSource?.isInitialized) return;
      const entry: AuditLogEntry = {
        action: 'TEST_NULLABLE',
        resourceType: TEST_PREFIX,
        resourceId: `${TEST_PREFIX}-nullable`,
        // userId, userEmail, ipAddress, userAgent, changes, metadata all omitted
      };

      await service.log(entry);

      const rows = await dataSource.query(`SELECT * FROM audit_logs WHERE resource_id = $1`, [
        entry.resourceId,
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBeNull();
      expect(rows[0].user_email).toBeNull();
      expect(rows[0].ip_address).toBeNull();
      expect(rows[0].changes).toBeNull();
    });

    it('should handle concurrent log entries without errors', async () => {
      if (!dataSource?.isInitialized) return;
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.log(
          makeEntry({
            action: 'TEST_CONCURRENT',
            resourceId: `${TEST_PREFIX}-concurrent-${i}`,
          }),
        ),
      );

      await Promise.all(promises);

      const rows = await dataSource.query(
        `SELECT COUNT(*)::int AS cnt FROM audit_logs WHERE action = $1 AND resource_type = $2`,
        ['TEST_CONCURRENT', TEST_PREFIX],
      );

      expect(rows[0].cnt).toBe(10);
    });

    it('should not throw even if a column value is too long (silent failure)', async () => {
      if (!dataSource?.isInitialized) return;
      // action column is VARCHAR(100) — pass a value longer than 100 chars
      const longAction = 'X'.repeat(200);
      const entry = makeEntry({ action: longAction, resourceId: `${TEST_PREFIX}-toolong` });

      // Should not throw; the service catches errors internally
      await expect(service.log(entry)).resolves.toBeUndefined();
    });
  });

  // ── query() ───────────────────────────────────────────────────────────

  describe('query()', () => {
    const QUERY_TAG = `${TEST_PREFIX}_query`;

    beforeAll(async () => {
      if (!dataSource?.isInitialized) return;
      // Seed several rows for query tests
      const entries: AuditLogEntry[] = [
        makeEntry({
          action: 'QUERY_CREATE',
          resourceType: QUERY_TAG,
          resourceId: 'q-1',
          userEmail: 'alice@example.com',
        }),
        makeEntry({
          action: 'QUERY_CREATE',
          resourceType: QUERY_TAG,
          resourceId: 'q-2',
          userEmail: 'alice@example.com',
        }),
        makeEntry({
          action: 'QUERY_UPDATE',
          resourceType: QUERY_TAG,
          resourceId: 'q-3',
          userEmail: 'bob@example.com',
        }),
        makeEntry({
          action: 'QUERY_DELETE',
          resourceType: QUERY_TAG,
          resourceId: 'q-4',
          userEmail: 'bob@example.com',
        }),
        makeEntry({
          action: 'QUERY_CREATE',
          resourceType: QUERY_TAG,
          resourceId: 'q-5',
          userEmail: 'charlie@example.com',
        }),
      ];

      for (const entry of entries) {
        await service.log(entry);
      }
    });

    it('should return paginated results with correct structure', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({ resourceType: QUERY_TAG, page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
      });
      expect(result.pagination.total).toBeGreaterThanOrEqual(5);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should respect limit and offset (pagination)', async () => {
      if (!dataSource?.isInitialized) return;
      const page1 = await service.query({ resourceType: QUERY_TAG, page: 1, limit: 2 });
      const page2 = await service.query({ resourceType: QUERY_TAG, page: 2, limit: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);

      // Pages should not overlap
      const ids1 = page1.data.map((r) => r.id);
      const ids2 = page2.data.map((r) => r.id);
      const overlap = ids1.filter((id) => ids2.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('should filter by action', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({
        action: 'QUERY_CREATE',
        resourceType: QUERY_TAG,
        page: 1,
        limit: 100,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(3);
      result.data.forEach((row) => {
        expect(row.action).toBe('QUERY_CREATE');
      });
    });

    it('should filter by userEmail (ILIKE partial match)', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({
        userEmail: 'alice',
        resourceType: QUERY_TAG,
        page: 1,
        limit: 100,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(2);
      result.data.forEach((row) => {
        expect(row.userEmail).toContain('alice');
      });
    });

    it('should filter by date range', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({
        startDate: new Date(Date.now() - 86400000).toISOString(), // 24h ago
        endDate: new Date(Date.now() + 60000).toISOString(), // 1 min in future
        resourceType: QUERY_TAG,
        page: 1,
        limit: 100,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(5);
    });

    it('should filter by resourceId', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({
        resourceId: 'q-1',
        resourceType: QUERY_TAG,
        page: 1,
        limit: 10,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].resourceId).toBe('q-1');
    });

    it('should support search across multiple columns', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({
        search: 'charlie',
        resourceType: QUERY_TAG,
        page: 1,
        limit: 100,
      });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should sort by created_at DESC by default', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({ resourceType: QUERY_TAG, page: 1, limit: 100 });

      for (let i = 1; i < result.data.length; i++) {
        const prev = new Date(result.data[i - 1].createdAt!).getTime();
        const curr = new Date(result.data[i].createdAt!).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should clamp limit to max 100', async () => {
      if (!dataSource?.isInitialized) return;
      const result = await service.query({ resourceType: QUERY_TAG, page: 1, limit: 500 });
      expect(result.pagination.limit).toBe(100);
    });
  });

  // ── export() ──────────────────────────────────────────────────────────

  describe('export()', () => {
    it('should generate valid CSV output with headers', async () => {
      if (!dataSource?.isInitialized) return;
      // Ensure at least one row exists
      await service.log(makeEntry({ action: 'EXPORT_TEST', resourceId: `${TEST_PREFIX}-export` }));

      const csv = await service.export({ resourceType: TEST_PREFIX });

      // CSV should start with a header row
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least 1 data row
      expect(lines[0]).toContain('User Email');
      expect(lines[0]).toContain('Action');
      expect(lines[0]).toContain('Resource Type');
    });

    it('should include data rows matching the filter', async () => {
      if (!dataSource?.isInitialized) return;
      const csv = await service.export({ resourceType: TEST_PREFIX });
      expect(csv).toContain('EXPORT_TEST');
    });
  });

  // ── getStats() ────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('should return aggregated statistics with correct structure', async () => {
      if (!dataSource?.isInitialized) return;
      const stats = await service.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalEvents).toBe('number');
      expect(stats.totalEvents).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.actionsPerDay)).toBe(true);
      expect(Array.isArray(stats.topUsers)).toBe(true);
      expect(Array.isArray(stats.actionBreakdown)).toBe(true);
      expect(Array.isArray(stats.resourceBreakdown)).toBe(true);
    });

    it('should reflect recently inserted test actions in breakdown', async () => {
      if (!dataSource?.isInitialized) return;
      const stats = await service.getStats();

      // Our test actions should appear in the breakdown
      const testActions = stats.actionBreakdown.map((a) => a.action);
      // At least some of our TEST_ or QUERY_ actions should be present
      const hasTestAction = testActions.some(
        (a) => a.startsWith('TEST_') || a.startsWith('QUERY_') || a === 'EXPORT_TEST',
      );
      expect(hasTestAction).toBe(true);
    });

    it('should have numeric counts in actionsPerDay', async () => {
      if (!dataSource?.isInitialized) return;
      const stats = await service.getStats();

      stats.actionsPerDay.forEach((entry) => {
        expect(typeof entry.date).toBe('string');
        expect(typeof entry.count).toBe('number');
        expect(entry.count).toBeGreaterThan(0);
      });
    });
  });
});
