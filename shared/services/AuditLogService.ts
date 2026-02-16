/**
 * Audit Log Service
 *
 * Database-backed audit logging service for comprehensive audit trail.
 * Provides insert, query, stats, and CSV export capabilities.
 * Uses direct DataSource queries for maximum performance.
 */

import { DataSource } from 'typeorm';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('audit-log');

/**
 * Audit log entry for database persistence
 */
export interface AuditLogEntry {
  id?: string;
  userId?: string | number;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: Date | string;
}

/**
 * Query filters for audit log retrieval
 */
export interface AuditLogFilters {
  userId?: string;
  userEmail?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

/**
 * Paginated audit log response
 */
export interface AuditLogQueryResult {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Aggregated audit statistics
 */
export interface AuditLogStats {
  totalEvents: number;
  actionsPerDay: Array<{ date: string; count: number }>;
  topUsers: Array<{ userEmail: string; count: number }>;
  actionBreakdown: Array<{ action: string; count: number }>;
  resourceBreakdown: Array<{ resourceType: string; count: number }>;
}

/**
 * AuditLogService
 *
 * Provides database-backed audit logging with query, stats, and export.
 */
export class AuditLogService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Insert a new audit log entry.
   * Never throws - audit logging must not break the main application flow.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs
           (user_id, user_email, action, resource_type, resource_id, ip_address, user_agent, changes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.userId ? String(entry.userId) : null,
          entry.userEmail || null,
          entry.action,
          entry.resourceType,
          entry.resourceId || null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.changes ? JSON.stringify(entry.changes) : null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        ],
      );
    } catch (error) {
      logger.error('Failed to write audit log entry', {
        error: error instanceof Error ? error.message : String(error),
        action: entry.action,
        resourceType: entry.resourceType,
      });
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Query audit logs with pagination, filtering, and sorting
   */
  async query(filters: AuditLogFilters): Promise<AuditLogQueryResult> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 25));
    const offset = (page - 1) * limit;

    // Whitelist sort columns to prevent SQL injection
    const allowedSortColumns = [
      'created_at',
      'action',
      'resource_type',
      'resource_id',
      'user_email',
    ];
    const safeSortBy = allowedSortColumns.includes(filters.sortBy || '')
      ? filters.sortBy!
      : 'created_at';
    const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }
    if (filters.userEmail) {
      conditions.push(`user_email ILIKE $${paramIndex++}`);
      params.push(`%${filters.userEmail}%`);
    }
    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }
    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(filters.resourceType);
    }
    if (filters.resourceId) {
      conditions.push(`resource_id = $${paramIndex++}`);
      params.push(filters.resourceId);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push(
        `(user_email ILIKE $${paramIndex} OR resource_type ILIKE $${paramIndex} OR resource_id ILIKE $${paramIndex} OR action ILIKE $${paramIndex})`,
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countParams = [...params];
    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs ${whereClause}`,
      countParams,
    );
    const total = countResult?.total || 0;

    // Get paginated results
    const dataParams = [...params, limit, offset];
    const data = await this.dataSource.query(
      `SELECT id, user_id, user_email, action, resource_type, resource_id,
              ip_address, user_agent, changes, metadata, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY ${safeSortBy} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      dataParams,
    );

    return {
      data: data.map(this.mapRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get aggregated audit statistics for the last 30 days
   */
  async getStats(): Promise<AuditLogStats> {
    const [totalResult] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs`,
    );

    const actionsPerDay = await this.dataSource.query(
      `SELECT DATE(created_at)::text AS date, COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`,
    );

    const topUsers = await this.dataSource.query(
      `SELECT COALESCE(user_email, 'system') AS "userEmail", COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY user_email
       ORDER BY count DESC
       LIMIT 10`,
    );

    const actionBreakdown = await this.dataSource.query(
      `SELECT action, COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY action
       ORDER BY count DESC`,
    );

    const resourceBreakdown = await this.dataSource.query(
      `SELECT resource_type AS "resourceType", COUNT(*)::int AS count
       FROM audit_logs
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY resource_type
       ORDER BY count DESC
       LIMIT 15`,
    );

    return {
      totalEvents: totalResult?.total || 0,
      actionsPerDay: actionsPerDay.map((r: Record<string, unknown>) => ({
        date: String(r.date),
        count: Number(r.count),
      })),
      topUsers: topUsers.map((r: Record<string, unknown>) => ({
        userEmail: String(r.userEmail),
        count: Number(r.count),
      })),
      actionBreakdown: actionBreakdown.map((r: Record<string, unknown>) => ({
        action: String(r.action),
        count: Number(r.count),
      })),
      resourceBreakdown: resourceBreakdown.map((r: Record<string, unknown>) => ({
        resourceType: String(r.resourceType),
        count: Number(r.count),
      })),
    };
  }

  /**
   * Export audit logs as CSV string (up to 10,000 rows)
   */
  async export(filters: AuditLogFilters): Promise<string> {
    const exportFilters: AuditLogFilters = { ...filters, page: 1, limit: 10000 };
    const result = await this.query(exportFilters);

    const headers = [
      'Date',
      'User Email',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'User Agent',
    ];

    const rows = result.data.map((row) => [
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
      this.escapeCsv(row.userEmail || ''),
      row.action,
      row.resourceType,
      this.escapeCsv(row.resourceId || ''),
      row.ipAddress || '',
      this.escapeCsv(row.userAgent || ''),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Map a database row to an AuditLogEntry
   */
  private mapRow(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: row.id as string,
      userId: row.user_id as string | undefined,
      userEmail: row.user_email as string | undefined,
      action: row.action as string,
      resourceType: row.resource_type as string,
      resourceId: row.resource_id as string | undefined,
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
      changes: row.changes as Record<string, unknown> | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.created_at as Date | undefined,
    };
  }

  /**
   * Escape a value for CSV output
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
