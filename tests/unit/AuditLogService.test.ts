import {
  AuditLogService,
  AuditLogEntry,
  AuditLogFilters,
} from '../../shared/services/AuditLogService';

// Mock the logger
jest.mock('../../shared/utils/logger', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockDataSource: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataSource = {
      query: jest.fn(),
    };
    service = new AuditLogService(mockDataSource);
  });

  // ── log() ─────────────────────────────────────────────────────────

  describe('log', () => {
    const baseEntry: AuditLogEntry = {
      userId: '42',
      userEmail: 'admin@test.com',
      action: 'USER_LOGIN',
      resourceType: 'user',
      resourceId: 'user-42',
      ipAddress: '192.168.1.1',
      userAgent: 'Jest/1.0',
    };

    it('inserts a record into the audit_logs table', async () => {
      mockDataSource.query.mockResolvedValue(undefined);
      await service.log(baseEntry);

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO audit_logs');
      expect(params).toContain('42'); // userId
      expect(params).toContain('admin@test.com');
      expect(params).toContain('USER_LOGIN');
      expect(params).toContain('user');
    });

    it('serializes changes and metadata as JSON strings', async () => {
      const entry: AuditLogEntry = {
        ...baseEntry,
        changes: { old: 'a', new: 'b' },
        metadata: { source: 'test' },
      };
      mockDataSource.query.mockResolvedValue(undefined);
      await service.log(entry);

      const params = mockDataSource.query.mock.calls[0][1];
      expect(params).toContain(JSON.stringify({ old: 'a', new: 'b' }));
      expect(params).toContain(JSON.stringify({ source: 'test' }));
    });

    it('passes null for optional fields when not provided', async () => {
      const minimal: AuditLogEntry = {
        action: 'SYSTEM_EVENT',
        resourceType: 'system',
      };
      mockDataSource.query.mockResolvedValue(undefined);
      await service.log(minimal);

      const params = mockDataSource.query.mock.calls[0][1];
      // userId, userEmail, resourceId, ipAddress, userAgent, changes, metadata → null
      expect(params[0]).toBeNull(); // userId
      expect(params[1]).toBeNull(); // userEmail
      expect(params[4]).toBeNull(); // resourceId → it's index 4 in the param array
    });

    it('does NOT throw when the database insert fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB connection lost'));
      await expect(service.log(baseEntry)).resolves.not.toThrow();
    });

    it('does NOT throw even on unexpected error types', async () => {
      mockDataSource.query.mockRejectedValue('string error');
      await expect(service.log(baseEntry)).resolves.not.toThrow();
    });
  });

  // ── query() ───────────────────────────────────────────────────────

  describe('query', () => {
    function setupQueryMock(total: number, rows: any[]) {
      mockDataSource.query
        .mockResolvedValueOnce([{ total }]) // COUNT query
        .mockResolvedValueOnce(rows); // SELECT query
    }

    it('returns paginated results with correct structure', async () => {
      const dbRows = [
        {
          id: 'uuid-1',
          user_id: '42',
          user_email: 'u@t.com',
          action: 'LOGIN',
          resource_type: 'user',
          resource_id: null,
          ip_address: '127.0.0.1',
          user_agent: 'test',
          changes: null,
          metadata: null,
          created_at: new Date('2025-01-01'),
        },
      ];
      setupQueryMock(1, dbRows);

      const result = await service.query({});
      expect(result.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('LOGIN');
    });

    it('applies userId filter', async () => {
      setupQueryMock(0, []);
      await service.query({ userId: 'user-1' });

      const countSql = mockDataSource.query.mock.calls[0][0];
      expect(countSql).toContain('user_id = $1');
      expect(mockDataSource.query.mock.calls[0][1]).toContain('user-1');
    });

    it('applies action filter', async () => {
      setupQueryMock(0, []);
      await service.query({ action: 'DELETE' });

      const countSql = mockDataSource.query.mock.calls[0][0];
      expect(countSql).toContain('action = $');
    });

    it('applies resourceType filter', async () => {
      setupQueryMock(0, []);
      await service.query({ resourceType: 'order' });

      const countSql = mockDataSource.query.mock.calls[0][0];
      expect(countSql).toContain('resource_type = $');
    });

    it('applies date range filters', async () => {
      setupQueryMock(0, []);
      await service.query({ startDate: '2025-01-01', endDate: '2025-12-31' });

      const countSql = mockDataSource.query.mock.calls[0][0];
      expect(countSql).toContain('created_at >=');
      expect(countSql).toContain('created_at <=');
    });

    it('applies search filter across multiple columns', async () => {
      setupQueryMock(0, []);
      await service.query({ search: 'admin' });

      const countSql = mockDataSource.query.mock.calls[0][0];
      expect(countSql).toContain('user_email ILIKE');
      expect(countSql).toContain('action ILIKE');
    });

    it('applies userEmail ILIKE filter', async () => {
      setupQueryMock(0, []);
      await service.query({ userEmail: 'john' });

      const countParams = mockDataSource.query.mock.calls[0][1];
      expect(countParams).toContain('%john%');
    });

    it('computes totalPages correctly', async () => {
      setupQueryMock(75, []);
      const result = await service.query({ limit: 25 });
      expect(result.pagination.totalPages).toBe(3);
    });

    it('clamps page to minimum 1', async () => {
      setupQueryMock(0, []);
      const result = await service.query({ page: -5 });
      expect(result.pagination.page).toBe(1);
    });

    it('clamps limit to maximum 100', async () => {
      setupQueryMock(0, []);
      const result = await service.query({ limit: 999 });
      expect(result.pagination.limit).toBe(100);
    });

    it('treats falsy limit as default (25)', async () => {
      setupQueryMock(0, []);
      const result = await service.query({ limit: 0 });
      // 0 is falsy so `filters.limit || 25` resolves to 25
      expect(result.pagination.limit).toBe(25);
    });

    it('clamps limit to minimum 1 for small positive values', async () => {
      setupQueryMock(0, []);
      const result = await service.query({ limit: 1 });
      expect(result.pagination.limit).toBe(1);
    });

    it('defaults sort to created_at DESC', async () => {
      setupQueryMock(0, []);
      await service.query({});

      const dataSql = mockDataSource.query.mock.calls[1][0];
      expect(dataSql).toContain('ORDER BY created_at DESC');
    });

    it('prevents SQL injection via sortBy by using a whitelist', async () => {
      setupQueryMock(0, []);
      await service.query({ sortBy: 'DROP TABLE users;--' as any });

      const dataSql = mockDataSource.query.mock.calls[1][0];
      // Should fall back to created_at, not the injected string
      expect(dataSql).toContain('ORDER BY created_at');
      expect(dataSql).not.toContain('DROP');
    });

    it('allows valid sort columns', async () => {
      setupQueryMock(0, []);
      await service.query({ sortBy: 'action', sortDir: 'ASC' });

      const dataSql = mockDataSource.query.mock.calls[1][0];
      expect(dataSql).toContain('ORDER BY action ASC');
    });

    it('returns totalPages = 1 when total is 0', async () => {
      setupQueryMock(0, []);
      const result = await service.query({});
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  // ── getStats() ────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns aggregated statistics in the correct shape', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ total: 150 }]) // totalEvents
        .mockResolvedValueOnce([{ date: '2025-01-15', count: 10 }]) // actionsPerDay
        .mockResolvedValueOnce([{ userEmail: 'admin@test.com', count: 50 }]) // topUsers
        .mockResolvedValueOnce([{ action: 'LOGIN', count: 80 }]) // actionBreakdown
        .mockResolvedValueOnce([{ resourceType: 'user', count: 60 }]); // resourceBreakdown

      const stats = await service.getStats();

      expect(stats.totalEvents).toBe(150);
      expect(stats.actionsPerDay).toEqual([{ date: '2025-01-15', count: 10 }]);
      expect(stats.topUsers).toEqual([{ userEmail: 'admin@test.com', count: 50 }]);
      expect(stats.actionBreakdown).toEqual([{ action: 'LOGIN', count: 80 }]);
      expect(stats.resourceBreakdown).toEqual([{ resourceType: 'user', count: 60 }]);
    });

    it('executes 5 queries for the 5 data sections', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getStats();
      expect(mockDataSource.query).toHaveBeenCalledTimes(5);
    });

    it('handles zero totalEvents gracefully', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const stats = await service.getStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.actionsPerDay).toEqual([]);
    });

    it('handles null total result', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([undefined])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const stats = await service.getStats();
      expect(stats.totalEvents).toBe(0);
    });
  });

  // ── export() ──────────────────────────────────────────────────────

  describe('export', () => {
    it('generates a CSV string with headers', async () => {
      // The export method calls this.query() internally, which makes 2 DB calls
      mockDataSource.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

      const csv = await service.export({});
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'Date,User Email,Action,Resource Type,Resource ID,IP Address,User Agent',
      );
    });

    it('includes data rows mapped from the query result', async () => {
      const row = {
        id: 'uuid-1',
        user_id: '42',
        user_email: 'test@x.com',
        action: 'CREATE',
        resource_type: 'order',
        resource_id: 'ord-1',
        ip_address: '10.0.0.1',
        user_agent: 'Chrome',
        changes: null,
        metadata: null,
        created_at: new Date('2025-06-15T10:30:00Z'),
      };
      mockDataSource.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([row]);

      const csv = await service.export({});
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2); // header + 1 data row
      expect(lines[1]).toContain('test@x.com');
      expect(lines[1]).toContain('CREATE');
      expect(lines[1]).toContain('order');
    });

    it('escapes CSV values containing commas', async () => {
      const row = {
        id: 'uuid-2',
        user_id: null,
        user_email: 'user,with,commas@test.com',
        action: 'UPDATE',
        resource_type: 'product',
        resource_id: null,
        ip_address: null,
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        changes: null,
        metadata: null,
        created_at: new Date('2025-01-01'),
      };
      mockDataSource.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([row]);

      const csv = await service.export({});
      // Values with commas should be quoted
      expect(csv).toContain('"user,with,commas@test.com"');
    });

    it('escapes CSV values containing double quotes', async () => {
      const row = {
        id: 'uuid-3',
        user_id: null,
        user_email: 'test@test.com',
        action: 'NOTE',
        resource_type: 'ticket',
        resource_id: 'said "hello"',
        ip_address: null,
        user_agent: null,
        changes: null,
        metadata: null,
        created_at: new Date('2025-01-01'),
      };
      mockDataSource.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([row]);

      const csv = await service.export({});
      // Quotes should be doubled and the field wrapped
      expect(csv).toContain('"said ""hello"""');
    });

    it('overrides page to 1 for export (offset 0)', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

      await service.export({ page: 5, limit: 10 });

      const selectParams = mockDataSource.query.mock.calls[1][1];
      // Offset should be 0 since export forces page=1
      expect(selectParams[selectParams.length - 1]).toBe(0);
    });

    it('export passes limit 10000 to query() but query() clamps it to 100', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

      await service.export({});

      const selectParams = mockDataSource.query.mock.calls[1][1];
      // query() clamps: Math.min(100, Math.max(1, 10000)) → 100
      expect(selectParams[selectParams.length - 2]).toBe(100);
    });
  });
});
