import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Search, RefreshCw, Download, ExternalLink,
  FileText, AlertCircle, CheckCircle2, XCircle, Clock,
  TrendingUp, Settings, Globe, Zap, List,
  Copy, Eye, EyeOff
} from 'lucide-react';

import { seoService } from '../services/seo.service';
import {
  SEOData, ProductSEOStatus, SEOAudit,
  StructuredDataTemplate
} from '../services/seo.service';

import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

// ============================================================
// SUB-COMPONENTS
// ============================================================

const SeoScoreBar: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-green-200';
    if (s >= 60) return 'bg-yellow-200';
    return 'bg-red-200';
  };

  return (
    <div className={`w-full ${getBgColor(score)} rounded-full overflow-hidden ${sizeClasses[size]}`}>
      <div
        className={`${getColor(score)} ${sizeClasses[size]} transition-all duration-500`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
};

const IssueCard: React.FC<{
  issue: SEOAudit['issues'][0];
  onFix?: () => void;
  onMarkFixed?: () => void;
}> = ({ issue, onFix, onMarkFixed }) => {
  const severityColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className={`p-4 rounded-lg border ${issue.fixed ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className={`inline-block px-2 py-0.5 text-xs rounded ${severityColors[issue.severity]}`}>
            {issue.severity}
          </span>
          <span className="ml-2 text-sm text-gray-500 capitalize">{issue.type}</span>
        </div>
        {issue.fixed && (
          <Badge status="success" icon={<CheckCircle2 size={14} />}>Fixed</Badge>
        )}
      </div>
      <h4 className="font-medium text-gray-900 mb-1">{issue.issue}</h4>
      <p className="text-sm text-gray-600 mb-3">{issue.suggestion}</p>
      {issue.currentValue && (
        <div className="text-xs mb-2">
          <span className="text-gray-500">Current:</span>{' '}
          <span className="bg-red-50 text-red-700 px-1 rounded">{issue.currentValue}</span>
          {issue.recommendedValue && (
            <>
              {' '}<span className="text-gray-500">→</span>{' '}
              <span className="bg-green-50 text-green-700 px-1 rounded">{issue.recommendedValue}</span>
            </>
          )}
        </div>
      )}
      {!issue.fixed && (
        <div className="flex gap-2">
          <button
            onClick={onFix}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Auto Fix
          </button>
          <button
            onClick={onMarkFixed}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Mark Fixed
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// VIEWS
// ============================================================

const AuditView: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<SEOAudit | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const queryClient = useQueryClient();

  // Fetch audit list
  const { data: audits, isLoading } = useQuery({
    queryKey: ['seo', 'audits', page, search],
    queryFn: () => seoService.getAuditList({ page, pageSize: 20, search }),
    select: (res) => ({
      items: res.data,
      totalPages: res.pagination.totalPages,
    }),
  });

  // Fetch audit summary
  const { data: summary } = useQuery({
    queryKey: ['seo', 'audit-summary'],
    queryFn: () => seoService.getAuditSummary(),
  });

  // Fix issue mutation
  const fixIssueMutation = useMutation({
    mutationFn: ({ auditId, issueId, data }: { auditId: string; issueId: string; data: any }) =>
      seoService.fixIssue(auditId, issueId, data),
    onSuccess: () => {
      toast.success('Issue fixed successfully');
      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to fix issue'),
  });

  // Mark issue fixed mutation
  const markFixedMutation = useMutation({
    mutationFn: ({ auditId, issueId }: { auditId: string; issueId: string }) =>
      seoService.markIssueFixed(auditId, issueId),
    onSuccess: () => {
      toast.success('Issue marked as fixed');
      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
    },
    onError: () => toast.error('Failed to mark issue as fixed'),
  });

  const columns = [
    { key: 'productName', label: 'Product', sortable: true },
    {
      key: 'sku',
      label: 'SKU',
      render: (value: string) => <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{value}</code>,
    },
    {
      key: 'score',
      label: 'Score',
      render: (value: number) => (
        <div className="w-24">
          <div className="text-sm font-medium">{value}/100</div>
          <SeoScoreBar score={value} size="sm" />
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const statusConfig = {
          passed: { status: 'success' as const, icon: <CheckCircle2 size={14} /> },
          warning: { status: 'warning' as const, icon: <AlertCircle size={14} /> },
          failed: { status: 'error' as const, icon: <XCircle size={14} /> },
        };
        const config = statusConfig[value as keyof typeof statusConfig] || statusConfig.warning;
        return <Badge status={config.status} icon={config.icon}>{value}</Badge>;
      },
    },
    {
      key: 'issues',
      label: 'Issues',
      render: (value: SEOAudit['issues']) => (
        <div className="flex gap-1">
          {value.filter(i => !i.fixed).length > 0 ? (
            <Badge status="error">{value.filter(i => !i.fixed).length}</Badge>
          ) : (
            <Badge status="success" icon={<CheckCircle2 size={14} />}>0</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'auditedAt',
      label: 'Last Audit',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {showSummary && summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Total Audits</p>
                <p className="text-2xl font-bold">{summary.totalAudits}</p>
              </div>
              <FileText className="text-blue-500" size={20} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Passed</p>
                <p className="text-2xl font-bold text-green-600">{summary.passed}</p>
              </div>
              <CheckCircle2 className="text-green-500" size={20} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Avg Score</p>
                <p className="text-2xl font-bold">{summary.avgScore.toFixed(0)}</p>
              </div>
              <TrendingUp className="text-purple-500" size={20} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Issues</p>
                <p className="text-2xl font-bold text-orange-600">
                  {summary.issueSummary.reduce((acc, s) => acc + s.count, 0)}
                </p>
              </div>
              <AlertCircle className="text-orange-500" size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Issue Summary */}
      {summary && summary.issueSummary.length > 0 && showSummary && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium mb-3">Common Issues</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {summary.issueSummary.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-sm">{item.type}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{item.count}</span>
                  <Badge status={item.severity === 'critical' ? 'error' : item.severity === 'high' ? 'warning' : 'info'}>
                    {item.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            {showSummary ? <EyeOff size={18} /> : <Eye size={18} />}
            Summary
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] })}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Audit List */}
      <DataTable
        columns={columns}
        data={audits?.items || []}
        isLoading={isLoading}
        onRowClick={(row) => setSelectedAudit(row)}
      />

      {/* Pagination */}
      {audits && audits.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5">
            Page {page} of {audits.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(audits.totalPages, p + 1))}
            disabled={page === audits.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <Modal isOpen={!!selectedAudit} onClose={() => setSelectedAudit(null)} size="xl">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedAudit.productName}</h2>
                <p className="text-gray-500">SKU: {selectedAudit.sku}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{selectedAudit.score}</div>
                <Badge status={selectedAudit.status === 'passed' ? 'success' : selectedAudit.status === 'warning' ? 'warning' : 'error'}>
                  {selectedAudit.status}
                </Badge>
              </div>
            </div>

            {/* Score by Category */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {Object.entries(selectedAudit.categories).map(([key, value]) => (
                <div key={key} className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}</p>
                  <p className="text-lg font-bold">{value.score}</p>
                  <p className="text-xs text-red-500">{value.issues} issues</p>
                </div>
              ))}
            </div>

            {/* Issues List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedAudit.issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onFix={() => fixIssueMutation.mutate({ auditId: selectedAudit.id, issueId: issue.id, data: { autoFix: true } })}
                  onMarkFixed={() => markFixedMutation.mutate({ auditId: selectedAudit.id, issueId: issue.id })}
                />
              ))}
              {selectedAudit.issues.filter(i => !i.fixed).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 size={48} className="mx-auto mb-2 text-green-500" />
                  <p>All issues have been fixed!</p>
                </div>
              )}
            </div>

            {/* Re-audit Button */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  if (selectedAudit.productId) {
                    seoService.reaudit(selectedAudit.productId).then((result) => {
                      setSelectedAudit(result);
                      queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
                      toast.success('Re-audit completed');
                    });
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Re-run Audit
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const ProductsView: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductSEOStatus | null>(null);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const queryClient = useQueryClient();

  // Fetch product SEO statuses
  const { data: products, isLoading } = useQuery({
    queryKey: ['seo', 'products', page, search, status],
    queryFn: () => seoService.getProductSEOStatus({ page, pageSize: 20, search, status: status as any }),
    select: (res) => ({
      items: res.data,
      totalPages: res.pagination.totalPages,
    }),
  });

  // Fetch metadata for selected product
  const { data: metadata } = useQuery({
    queryKey: ['seo', 'metadata', selectedProduct?.productId],
    queryFn: () => seoService.getSeoMetadata(selectedProduct!.productId),
    enabled: !!selectedProduct && !editingMetadata,
  });

  // Generate metadata mutation
  const generateMutation = useMutation({
    mutationFn: (productId: string) => seoService.generateMetadata(productId),
    onSuccess: () => {
      toast.success('SEO metadata generated');
      queryClient.invalidateQueries({ queryKey: ['seo', 'metadata', selectedProduct?.productId] });
      queryClient.invalidateQueries({ queryKey: ['seo', 'products'] });
    },
    onError: () => toast.error('Failed to generate metadata'),
  });

  // Update metadata mutation
  const updateMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: Partial<SEOData> }) =>
      seoService.updateSeoMetadata(productId, data),
    onSuccess: () => {
      toast.success('Metadata updated');
      setEditingMetadata(false);
      queryClient.invalidateQueries({ queryKey: ['seo', 'metadata', selectedProduct?.productId] });
      queryClient.invalidateQueries({ queryKey: ['seo', 'products'] });
    },
    onError: () => toast.error('Failed to update metadata'),
  });

  // Run audit mutation
  const auditMutation = useMutation({
    mutationFn: (productId: string) => seoService.runAudit(productId),
    onSuccess: () => {
      toast.success('Audit started');
      queryClient.invalidateQueries({ queryKey: ['seo', 'products'] });
    },
    onError: () => toast.error('Failed to start audit'),
  });

  const columns = [
    { key: 'productName', label: 'Product', sortable: true },
    {
      key: 'sku',
      label: 'SKU',
      render: (value: string) => <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{value}</code>,
    },
    {
      key: 'seoScore',
      label: 'SEO Score',
      render: (value: number) => (
        <div className="w-20">
          <div className="text-sm font-medium">{value}/100</div>
          <SeoScoreBar score={value} size="sm" />
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const statusConfig = {
          excellent: { status: 'success' as const, label: 'Excellent' },
          good: { status: 'success' as const, label: 'Good' },
          needs_work: { status: 'warning' as const, label: 'Needs Work' },
          poor: { status: 'error' as const, label: 'Poor' },
        };
        const config = statusConfig[value as keyof typeof statusConfig] || statusConfig.needs_work;
        return <Badge status={config.status}>{config.label}</Badge>;
      },
    },
    {
      key: 'issues',
      label: 'Issues',
      render: (value: number) => value > 0 ? <Badge status="error">{value}</Badge> : <Badge status="success">0</Badge>,
    },
    {
      key: 'lastAuditedAt',
      label: 'Last Audit',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Never',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="needs_work">Needs Work</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['seo', 'products'] })}
          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Products Table */}
      <DataTable
        columns={columns}
        data={products?.items || []}
        isLoading={isLoading}
        onRowClick={(row) => setSelectedProduct(row as ProductSEOStatus)}
      />

      {/* Pagination */}
      {products && products.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5">Page {page} of {products.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(products.totalPages, p + 1))}
            disabled={page === products.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Modal isOpen={!!selectedProduct} onClose={() => { setSelectedProduct(null); setEditingMetadata(false); }} size="xl">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedProduct.productName}</h2>
                <p className="text-gray-500">SKU: {selectedProduct.sku}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => auditMutation.mutate(selectedProduct.productId)}
                  className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
                >
                  <Zap size={16} />
                  Run Audit
                </button>
              </div>
            </div>

            {editingMetadata ? (
              // Edit Metadata Form
              <div className="space-y-4">
                <h3 className="font-medium">Edit SEO Metadata</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      defaultValue={metadata?.title}
                      id="edit-title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="SEO Title (50-60 chars recommended)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                    <textarea
                      id="edit-description"
                      defaultValue={metadata?.metaDescription}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Meta Description (150-160 chars recommended)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                    <input
                      type="text"
                      id="edit-keywords"
                      defaultValue={metadata?.keywords?.join(', ')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="keyword1, keyword2, keyword3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">H1 Tag</label>
                    <input
                      type="text"
                      id="edit-h1"
                      defaultValue={metadata?.h1Tag}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Primary H1 heading"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => {
                      const title = (document.getElementById('edit-title') as HTMLInputElement)?.value;
                      const description = (document.getElementById('edit-description') as HTMLTextAreaElement)?.value;
                      const keywords = (document.getElementById('edit-keywords') as HTMLInputElement)?.value.split(',').map(k => k.trim()).filter(Boolean);
                      const h1 = (document.getElementById('edit-h1') as HTMLInputElement)?.value;
                      updateMutation.mutate({ productId: selectedProduct.productId, data: { title, metaDescription: description, keywords, h1Tag: h1 } });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingMetadata(false)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View Metadata
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">SEO Metadata</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateMutation.mutate(selectedProduct.productId)}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2"
                    >
                      <Zap size={16} />
                      Generate with AI
                    </button>
                    <button
                      onClick={() => setEditingMetadata(true)}
                      className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {metadata ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded">
                      <label className="text-xs text-gray-500 block mb-1">Title</label>
                      <p className="text-sm">{metadata.title || <em className="text-gray-400">Not set</em>}</p>
                      {metadata.title && (
                        <p className={`text-xs mt-1 ${metadata.title.length > 60 ? 'text-orange-500' : 'text-green-500'}`}>
                          {metadata.title.length}/60 chars
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <label className="text-xs text-gray-500 block mb-1">Meta Description</label>
                      <p className="text-sm">{metadata.metaDescription || <em className="text-gray-400">Not set</em>}</p>
                      {metadata.metaDescription && (
                        <p className={`text-xs mt-1 ${metadata.metaDescription.length > 160 ? 'text-orange-500' : 'text-green-500'}`}>
                          {metadata.metaDescription.length}/160 chars
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <label className="text-xs text-gray-500 block mb-1">Keywords</label>
                      <div className="flex flex-wrap gap-1">
                        {metadata.keywords?.length > 0 ? (
                          metadata.keywords.map((kw, i) => (
                            <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{kw}</span>
                          ))
                        ) : (
                          <em className="text-gray-400">Not set</em>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <label className="text-xs text-gray-500 block mb-1">Canonical URL</label>
                      <p className="text-sm break-all">{metadata.canonicalUrl || <em className="text-gray-400">Not set</em>}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <label className="text-xs text-gray-500 block mb-1">H1 Tag</label>
                      <p className="text-sm">{metadata.h1Tag || <em className="text-gray-400">Not set</em>}</p>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText size={48} />}
                    title="No SEO Metadata"
                    description="Generate or create SEO metadata for this product to improve search visibility."
                    actionLabel="Generate with AI"
                    onAction={() => generateMutation.mutate(selectedProduct.productId)}
                  />
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

const SitemapView: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch sitemap status
  const { data: status } = useQuery({
    queryKey: ['seo', 'sitemap-status'],
    queryFn: () => seoService.getSitemapStatus(),
  });

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: () => seoService.regenerateSitemap(),
    onSuccess: () => {
      toast.success('Sitemap regeneration started');
      queryClient.invalidateQueries({ queryKey: ['seo', 'sitemap-status'] });
    },
    onError: () => toast.error('Failed to regenerate sitemap'),
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => seoService.submitSitemap(),
    onSuccess: () => {
      toast.success('Sitemap submitted to search engines');
      queryClient.invalidateQueries({ queryKey: ['seo', 'sitemap-status'] });
    },
    onError: () => toast.error('Failed to submit sitemap'),
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (config: any) => seoService.updateSitemapConfig(config),
    onSuccess: () => {
      toast.success('Sitemap configuration updated');
      queryClient.invalidateQueries({ queryKey: ['seo', 'sitemap-status'] });
    },
    onError: () => toast.error('Failed to update configuration'),
  });

  // Download sitemap
  const handleDownload = async (type?: string) => {
    try {
      const blob = await seoService.getSitemapXML(type);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type ? `sitemap-${type}.xml` : 'sitemap.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Sitemap downloaded');
    } catch (error) {
      toast.error('Failed to download sitemap');
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Total URLs</p>
                <p className="text-2xl font-bold">{status.totalUrls}</p>
              </div>
              <Globe className="text-blue-500" size={20} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Last Generated</p>
                <p className="text-lg font-bold">
                  {status.lastGeneratedAt ? new Date(status.lastGeneratedAt).toLocaleDateString() : 'Never'}
                </p>
              </div>
              <Clock className="text-gray-500" size={20} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Submitted</p>
                <p className="text-lg font-bold">{status.submittedToSearchEngines ? 'Yes' : 'No'}</p>
              </div>
              {status.submittedToSearchEngines ? (
                <CheckCircle2 className="text-green-500" size={20} />
              ) : (
                <XCircle className="text-gray-400" size={20} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium mb-4 flex items-center gap-2">
          <Settings size={18} />
          Configuration
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-Regenerate</p>
              <p className="text-sm text-gray-500">Automatically regenerate sitemap when content changes</p>
            </div>
            <button
              onClick={() => updateConfigMutation.mutate({
                autoRegenerate: !status?.autoRegenerate,
                regenerateFrequency: 'daily'
              })}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                status?.autoRegenerate ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  status?.autoRegenerate ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Sitemap Sections */}
      {status && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium">Sitemap Sections</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">URL</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Pages</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Last Updated</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {status.sections.map((section) => (
                <tr key={section.type} className="border-t border-gray-200">
                  <td className="px-4 py-3 font-medium capitalize">{section.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">{section.url}</td>
                  <td className="px-4 py-3">{section.pages}</td>
                  <td className="px-4 py-3">
                    <Badge
                      status={section.status === 'active' ? 'success' : section.status === 'stale' ? 'warning' : 'error'}
                    >
                      {section.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(section.lastGeneratedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDownload(section.type)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Download size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {regenerateMutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          Regenerate Sitemap
        </button>
        <button
          onClick={() => handleDownload()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <Download size={18} />
          Download Sitemap
        </button>
        <button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || !status?.submittedToSearchEngines}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <ExternalLink size={18} />
          Submit to Search Engines
        </button>
      </div>
    </div>
  );
};

const StructuredDataView: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<StructuredDataTemplate | null>(null);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonContent, setJsonContent] = useState('');

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['seo', 'structured-data-templates'],
    queryFn: () => seoService.getStructuredDataTemplates(),
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: (schema: any) => seoService.validateStructuredData(schema),
    onSuccess: (result) => {
      if (result.valid) {
        toast.success('Structured data is valid');
      } else {
        toast.error(`Validation errors: ${result.errors?.map(e => e.message).join(', ')}`);
      }
    },
    onError: () => toast.error('Failed to validate structured data'),
  });

  const handleValidate = () => {
    try {
      const schema = JSON.parse(jsonContent);
      validateMutation.mutate(schema);
    } catch {
      toast.error('Invalid JSON format');
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(jsonContent);
    toast.success('Copied to clipboard');
  };

  const schemaTypes = [
    { type: 'Product', icon: '📦', description: 'Product information with price, availability' },
    { type: 'Organization', icon: '🏢', description: 'Company information, contact details' },
    { type: 'Article', icon: '📰', description: 'Blog posts, news articles' },
    { type: 'BreadcrumbList', icon: '🔗', description: 'Navigation breadcrumbs' },
    { type: 'FAQPage', icon: '❓', description: 'Frequently asked questions' },
    { type: 'LocalBusiness', icon: '📍', description: 'Local business with address' },
    { type: 'WebSite', icon: '🌐', description: 'Website search box, site links' },
  ];

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schemaTypes.map((item) => {
          const template = templates?.find((t) => t.type === item.type);
          return (
            <div
              key={item.type}
              onClick={() => setSelectedTemplate(template || null)}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedTemplate?.type === item.type
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1">
                  <h4 className="font-medium">{item.type}</h4>
                  <p className="text-sm text-gray-500">{item.description}</p>
                  {template?.isDefault && (
                    <Badge status="success" className="mt-2">Default Template</Badge>
                  )}
                </div>
                {selectedTemplate?.type === item.type && (
                  <CheckCircle2 className="text-blue-500" size={20} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Template View */}
      {selectedTemplate && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg">{selectedTemplate.name}</h3>
              <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setJsonContent(JSON.stringify(selectedTemplate.schema, null, 2));
                  setShowJsonEditor(true);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              >
                Edit JSON
              </button>
              <button
                onClick={() => {
                  setJsonContent(JSON.stringify(selectedTemplate.schema, null, 2));
                  handleValidate();
                }}
                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Validate
              </button>
            </div>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-64">
            {JSON.stringify(selectedTemplate.schema, null, 2)}
          </pre>
        </div>
      )}

      {/* JSON Editor Modal */}
      {showJsonEditor && (
        <Modal isOpen={showJsonEditor} onClose={() => setShowJsonEditor(false)} size="xl">
          <div className="p-6">
            <h3 className="font-bold text-lg mb-4">Edit Structured Data</h3>
            <textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              className="w-full h-80 font-mono text-sm bg-gray-900 text-gray-100 p-4 rounded-lg"
            />
            <div className="flex justify-between mt-4">
              <button
                onClick={handleCopyToClipboard}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy size={18} />
                Copy
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowJsonEditor(false)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleValidate();
                    if (validateMutation.isError) return;
                    setShowJsonEditor(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save & Validate
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ============================================================
// MAIN PAGE
// ============================================================

const SeoPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('audit');

  const tabs = [
    { id: 'audit', label: 'SEO Audit', icon: <Zap size={18} /> },
    { id: 'products', label: 'Products', icon: <List size={18} /> },
    { id: 'sitemap', label: 'Sitemap', icon: <Globe size={18} /> },
    { id: 'structured', label: 'Structured Data', icon: <FileText size={18} /> },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SEO & Indexing</h1>
        <p className="text-gray-600 mt-1">Manage SEO audits, metadata, sitemaps, and structured data</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'audit' && <AuditView />}
        {activeTab === 'products' && <ProductsView />}
        {activeTab === 'sitemap' && <SitemapView />}
        {activeTab === 'structured' && <StructuredDataView />}
      </div>
    </div>
  );
};

export { SeoPage };
export default SeoPage;
