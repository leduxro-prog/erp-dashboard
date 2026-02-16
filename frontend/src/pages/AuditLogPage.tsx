import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  User,
  Activity,
  Database,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

interface AuditLogFilters {
  action: string;
  resourceType: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  search: string;
  page: number;
  limit: number;
}

interface AuditLogResponse {
  status: string;
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AuditLogStats {
  totalEvents: number;
  actionsPerDay: Array<{ date: string; count: number }>;
  topUsers: Array<{ userEmail: string; count: number }>;
  actionBreakdown: Array<{ action: string; count: number }>;
  resourceBreakdown: Array<{ resourceType: string; count: number }>;
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'READ', label: 'Read' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'EXPORT', label: 'Export' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'User', label: 'User' },
  { value: 'Order', label: 'Order' },
  { value: 'Product', label: 'Product' },
  { value: 'Setting', label: 'Settings' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Supplier', label: 'Supplier' },
];

const ACTION_BADGE_MAP: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  CREATE: 'success',
  READ: 'info',
  UPDATE: 'warning',
  DELETE: 'error',
  LOGIN: 'info',
  LOGOUT: 'neutral',
  EXPORT: 'neutral',
};

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    action: '',
    resourceType: '',
    userEmail: '',
    startDate: '',
    endDate: '',
    search: '',
    page: 1,
    limit: 25,
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Build query string from filters
  const buildQueryParams = useCallback((f: AuditLogFilters): string => {
    const params = new URLSearchParams();
    params.set('page', String(f.page));
    params.set('limit', String(f.limit));
    params.set('sortDir', 'DESC');
    if (f.action) params.set('action', f.action);
    if (f.resourceType) params.set('resourceType', f.resourceType);
    if (f.userEmail) params.set('userEmail', f.userEmail);
    if (f.startDate) params.set('startDate', f.startDate);
    if (f.endDate) params.set('endDate', f.endDate);
    if (f.search) params.set('search', f.search);
    return params.toString();
  }, []);

  // Fetch audit logs
  const {
    data: logsData,
    isLoading,
    refetch,
  } = useQuery<AuditLogResponse>({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      apiClient.get<AuditLogResponse>(`/admin/audit-logs?${buildQueryParams(filters)}`),
    staleTime: 30000,
  });

  // Fetch stats
  const { data: statsData } = useQuery<{ status: string; data: AuditLogStats }>({
    queryKey: ['audit-logs-stats'],
    queryFn: () =>
      apiClient.get<{ status: string; data: AuditLogStats }>('/admin/audit-logs/stats'),
    staleTime: 60000,
  });

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 };
  const stats = statsData?.data;

  const handleFilterChange = (key: keyof AuditLogFilters, value: string | number) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? (value as number) : 1,
    }));
  };

  const handleExport = async () => {
    try {
      const params = buildQueryParams({ ...filters, page: 1, limit: 10000 });
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api/v1'}/admin/audit-logs/export?${params}`,
        {
          headers: {
            Authorization: `Bearer ${apiClient.getToken()}`,
          },
        },
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 rounded-lg">
            <Shield className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Audit Log</h1>
            <p className="text-sm text-gray-400">Track all system activity and user actions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Total Events"
            value={stats.totalEvents.toLocaleString()}
          />
          <StatCard
            icon={<User className="w-5 h-5" />}
            label="Active Users (30d)"
            value={String(stats.topUsers.length)}
          />
          <StatCard
            icon={<Database className="w-5 h-5" />}
            label="Resource Types"
            value={String(stats.resourceBreakdown.length)}
          />
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="Today"
            value={
              stats.actionsPerDay.length > 0 ? stats.actionsPerDay[0].count.toLocaleString() : '0'
            }
          />
        </div>
      )}

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              showFilters
                ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Resource</label>
              <select
                value={filters.resourceType}
                onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500"
              >
                {RESOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">User Email</label>
              <input
                type="text"
                placeholder="Filter by email..."
                value={filters.userEmail}
                onChange={(e) => handleFilterChange('userEmail', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Audit log table */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-200">
            <thead className="text-xs text-gray-300 uppercase bg-gray-700/50 border-b border-gray-600">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Resource ID</th>
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-700">
                    <td className="px-4 py-3" />
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-600 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <EmptyState
                      icon={<Shield className="w-12 h-12 text-gray-500" />}
                      title="No audit logs found"
                      description="No audit log entries match your current filters. Try adjusting the filters or wait for new activity."
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="border-b border-gray-700 hover:bg-gray-700/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3">
                        <button className="text-gray-400 hover:text-gray-200">
                          {expandedRow === log.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-200">{log.userEmail || 'System'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={ACTION_BADGE_MAP[log.action] || 'neutral'}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{log.resourceType}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {log.resourceId || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {log.ipAddress || '-'}
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {expandedRow === log.id && (
                      <tr className="bg-gray-800/80">
                        <td colSpan={7} className="px-6 py-4">
                          <ExpandedDetails log={log} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/30 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Showing {logs.length} of {pagination.total.toLocaleString()} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFilterChange('page', Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() =>
                handleFilterChange('page', Math.min(pagination.totalPages, pagination.page + 1))
              }
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-gray-100">{value}</p>
      </div>
    </div>
  );
}

function ExpandedDetails({ log }: { log: AuditLogEntry }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Metadata */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1">
          <Eye className="w-3 h-3" />
          Details
        </h4>
        <dl className="space-y-1 text-sm">
          <DetailItem label="Event ID" value={log.id} mono />
          <DetailItem label="User ID" value={log.userId || '-'} mono />
          <DetailItem
            label="User Agent"
            value={log.userAgent ? truncate(log.userAgent, 80) : '-'}
          />
        </dl>
      </div>

      {/* Changes / Metadata JSON */}
      <div>
        {log.changes && Object.keys(log.changes).length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Changes</h4>
            <pre className="p-3 bg-gray-900 rounded-lg text-xs text-gray-300 overflow-auto max-h-48 border border-gray-700">
              {JSON.stringify(log.changes, null, 2)}
            </pre>
          </div>
        )}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Metadata</h4>
            <pre className="p-3 bg-gray-900 rounded-lg text-xs text-gray-300 overflow-auto max-h-48 border border-gray-700">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-500 min-w-[100px]">{label}:</dt>
      <dd className={`text-gray-300 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export default AuditLogPage;
