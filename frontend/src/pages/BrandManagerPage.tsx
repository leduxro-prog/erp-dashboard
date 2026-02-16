import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  BarChart3,
  PieChart,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  Megaphone,
  Mail,
  MessageSquare,
  ShoppingBag,
  Percent,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { marketingService, type Campaign } from '@/services/marketing.service';

type ViewMode = 'dashboard' | 'campaigns' | 'analytics' | 'attribution';
type TimePeriod = '7d' | '30d' | '90d' | 'custom';
type Channel = 'all' | 'email' | 'sms' | 'push' | 'social' | 'display' | 'whatsapp';

interface DashboardStats {
  totalRevenue: number;
  totalConversions: number;
  avgOrderValue: number;
  totalVisitors: number;
  conversionRate: number;
  bounceRate: number;
}

interface ChannelMetric {
  channel: Channel;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversionRate: number;
  cost: number;
  roas: number;
  roi: number;
}

interface AttributionEvent {
  id: string;
  eventType: 'view' | 'click' | 'add_to_cart' | 'purchase' | 'lead';
  touchpoint: string;
  channel: string;
  campaignId?: string;
  customerId?: string;
  value?: number;
  timestamp: string;
}

interface FunnelStage {
  stage: string;
  count: number;
  conversionRate: number;
  dropOff: number;
}

export function BrandManagerPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
  const [selectedChannel, setSelectedChannel] = useState<Channel>('all');

  useEffect(() => {
    loadDashboardData();
  }, [timePeriod, selectedChannel]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with real API calls
      const mockStats: DashboardStats = {
        totalRevenue: 125430,
        totalConversions: 1843,
        avgOrderValue: 68.04,
        totalVisitors: 45234,
        conversionRate: 4.07,
        bounceRate: 38.5,
      };
      setStats(mockStats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Brand Manager</h1>
          <p className="text-text-secondary mt-1">Campaigns, analytics, and attribution dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
            className="px-4 py-2 bg-surface-primary border border-border-primary rounded-lg"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          <button onClick={loadDashboardData} className="btn-secondary">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-border-primary">
        <button
          onClick={() => setViewMode('dashboard')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'dashboard'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setViewMode('campaigns')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'campaigns'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Campaigns
        </button>
        <button
          onClick={() => setViewMode('analytics')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'analytics'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Analytics
        </button>
        <button
          onClick={() => setViewMode('attribution')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'attribution'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Attribution
        </button>
      </div>

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <DashboardView
          stats={stats}
          timePeriod={timePeriod}
          onRefresh={loadDashboardData}
        />
      )}

      {/* Campaigns View */}
      {viewMode === 'campaigns' && (
        <CampaignsView />
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <AnalyticsView />
      )}

      {/* Attribution View */}
      {viewMode === 'attribution' && (
        <AttributionView />
      )}
    </div>
  );
}

// Dashboard View Component
function DashboardView({
  stats,
  timePeriod,
  onRefresh,
}: {
  stats: DashboardStats | null;
  timePeriod: TimePeriod;
  onRefresh: () => void;
}) {
  const [channelMetrics, setChannelMetrics] = useState<ChannelMetric[]>([]);
  const [trend, setTrend] = useState<{ revenue: number; conversions: number } | null>(null);

  useEffect(() => {
    loadChannelMetrics();
  }, [timePeriod]);

  const loadChannelMetrics = async () => {
    // TODO: Replace with real API
    const mockMetrics: ChannelMetric[] = [
      {
        channel: 'email',
        revenue: 45230,
        conversions: 712,
        impressions: 24500,
        clicks: 3420,
        ctr: 13.96,
        conversionRate: 20.8,
        cost: 2150,
        roas: 21.0,
        roi: 9.5,
      },
      {
        channel: 'social',
        revenue: 38920,
        conversions: 523,
        impressions: 125000,
        clicks: 8750,
        ctr: 7.0,
        conversionRate: 6.0,
        cost: 5200,
        roas: 7.5,
        roi: 6.5,
      },
      {
        channel: 'whatsapp',
        revenue: 28450,
        conversions: 445,
        impressions: 0,
        clicks: 890,
        ctr: 0,
        conversionRate: 50.0,
        cost: 850,
        roas: 33.5,
        roi: 32.5,
      },
      {
        channel: 'display',
        revenue: 12830,
        conversions: 163,
        impressions: 45000,
        clicks: 2250,
        ctr: 5.0,
        conversionRate: 7.2,
        cost: 3200,
        roas: 4.0,
        roi: 3.0,
      },
    ];
    setChannelMetrics(mockMetrics);
    setTrend({ revenue: 12.5, conversions: 8.3 });
  };

  const getChannelIcon = (channel: Channel) => {
    switch (channel) {
      case 'email':
        return <Mail size={20} className="text-blue-500" />;
      case 'whatsapp':
        return <MessageSquare size={20} className="text-green-500" />;
      case 'social':
        return <Megaphone size={20} className="text-purple-500" />;
      case 'display':
        return <BarChart3 size={20} className="text-orange-500" />;
      default:
        return <ShoppingBag size={20} className="text-gray-500" />;
    }
  };

  const getChannelName = (channel: Channel) => {
    const names: Record<Channel, string> = {
      email: 'Email',
      sms: 'SMS',
      push: 'Push',
      social: 'Social Media',
      display: 'Display Ads',
      whatsapp: 'WhatsApp',
      all: 'All Channels',
    };
    return names[channel] || channel;
  };

  return (
    <div className="space-y-6">
      {loading && !stats ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-tertiary">Total Revenue</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {stats?.totalRevenue.toLocaleString('ro-RO')} RON
                  </p>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp size={16} />
                  <span className="text-sm font-medium">{trend?.revenue}%</span>
                </div>
              </div>
            </div>

            {/* Conversions */}
            <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-tertiary">Conversions</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {stats?.totalConversions.toLocaleString('ro-RO')}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp size={16} />
                  <span className="text-sm font-medium">{trend?.conversions}%</span>
                </div>
              </div>
            </div>

            {/* AOV */}
            <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-tertiary">Avg Order Value</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {stats?.avgOrderValue.toFixed(2)} RON
                  </p>
                </div>
                <DollarSign size={20} className="text-primary-500" />
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-tertiary">Conversion Rate</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {stats?.conversionRate.toFixed(2)}%
                  </p>
                </div>
                <Percent size={20} className="text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Revenue by Channel */}
          <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Revenue by Channel</h3>
            <div className="space-y-4">
              {channelMetrics.map((metric) => {
                const maxValue = Math.max(...channelMetrics.map(m => m.revenue));
                const percentage = (metric.revenue / maxValue) * 100;

                return (
                  <div key={metric.channel}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center">
                          {getChannelIcon(metric.channel)}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">
                            {getChannelName(metric.channel)}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {metric.conversions} conversions • {metric.conversionRate.toFixed(1)}% CR
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-text-primary">
                          {metric.revenue.toLocaleString('ro-RO')} RON
                        </p>
                        <p className={`text-sm ${metric.roas >= 5 ? 'text-green-600' : metric.roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                          ROAS {metric.roas.toFixed(1)}x
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-surface-secondary rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROI/ROAS Trend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">ROAS by Channel</h3>
              <div className="space-y-3">
                {channelMetrics.slice(0, 3).map((metric) => (
                  <div key={metric.channel} className="flex items-center justify-between">
                    <span className="text-text-secondary">{getChannelName(metric.channel)}</span>
                    <span className={`font-bold ${metric.roas >= 5 ? 'text-green-600' : metric.roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {metric.roas.toFixed(1)}x
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">ROI by Channel</h3>
              <div className="space-y-3">
                {channelMetrics.slice(0, 3).map((metric) => (
                  <div key={metric.channel} className="flex items-center justify-between">
                    <span className="text-text-secondary">{getChannelName(metric.channel)}</span>
                    <span className={`font-bold ${metric.roi >= 10 ? 'text-green-600' : metric.roi >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {metric.roi.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 mb-4 flex items-center gap-2">
              <AlertTriangle size={20} />
              Performance Alerts
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-white dark:bg-surface-primary rounded-lg">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Display Ads Underperforming</p>
                  <p className="text-sm text-text-secondary">
                    ROAS dropped to 4.0x (below 5.0x threshold). Consider adjusting bid strategy.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white dark:bg-surface-primary rounded-lg">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Social Media Conversion Drop</p>
                  <p className="text-sm text-text-secondary">
                    Conversion rate decreased by 15% compared to previous period.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Campaigns View Component
function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await marketingService.getCampaigns();
      setCampaigns(response.data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', color: 'gray' };
      case 'scheduled':
        return { label: 'Scheduled', color: 'blue' };
      case 'active':
        return { label: 'Active', color: 'green' };
      case 'paused':
        return { label: 'Paused', color: 'yellow' };
      case 'completed':
        return { label: 'Completed', color: 'purple' };
      default:
        return { label: status, color: 'gray' };
    }
  };

  const columns: Column<Campaign>[] = [
    {
      key: 'name',
      label: 'Campaign',
      render: (value, row) => (
        <div>
          <p className="font-medium text-text-primary">{value}</p>
          {row.description && (
            <p className="text-xs text-text-tertiary">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (value) => <span className="capitalize text-sm">{value}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const config = getStatusConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (value) => new Date(value).toLocaleDateString('ro-RO'),
    },
    {
      key: 'budget',
      label: 'Budget / Spent',
      render: (value, row) => (
        <div>
          <p className="font-mono">{value?.toLocaleString('ro-RO')} RON</p>
          <p className="text-xs text-text-tertiary">
            / {row.spent?.toLocaleString('ro-RO')} RON spent
          </p>
        </div>
      ),
    },
    {
      key: 'metrics',
      label: 'Performance',
      render: (value) => (
        <div className="flex gap-2 text-xs">
          <span className="bg-surface-secondary px-2 py-1 rounded">
            {value.conversions} conv
          </span>
          <span className="bg-green-500/10 text-green-700 px-2 py-1 rounded">
            {value.conversions > 0 ? ((value.clicked / value.conversions) * 100).toFixed(1) : 0}% CTR
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">All Types</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="social">Social</option>
            <option value="display">Display</option>
          </select>
        </div>
      </div>

      {/* Campaigns Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={48} className="text-text-tertiary" />}
          title="No Campaigns Found"
          description={searchTerm ? 'Try adjusting your search.' : 'Create your first marketing campaign.'}
          variant="compact"
        />
      ) : (
        <DataTable columns={columns} data={filteredCampaigns} />
      )}
    </div>
  );
}

// Analytics View Component
function AnalyticsView() {
  const [view, setView] = useState<'overview' | 'conversions' | 'revenue'>('overview');
  const [loading, setLoading] = useState(true);

  // TODO: Replace with real API calls
  const conversionFunnel: FunnelStage[] = [
    { stage: 'Impressions', count: 245680, conversionRate: 100, dropOff: 0 },
    { stage: 'Clicks', count: 18234, conversionRate: 7.42, dropOff: 92.58 },
    { stage: 'Page Views', count: 12530, conversionRate: 68.7, dropOff: 31.3 },
    { stage: 'Add to Cart', count: 4230, conversionRate: 33.8, dropOff: 66.2 },
    { stage: 'Checkout', count: 2845, conversionRate: 67.2, dropOff: 32.8 },
    { stage: 'Purchase', count: 1843, conversionRate: 64.8, dropOff: 35.2 },
  ];

  const segmentConversions = [
    { segment: 'New Customers', conversions: 842, revenue: 48230, avgValue: 57.3 },
    { segment: 'Returning Customers', conversions: 1001, revenue: 77200, avgValue: 77.1 },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-view tabs */}
      <div className="flex items-center gap-2 bg-surface-secondary p-1 rounded-lg w-fit">
        <button
          onClick={() => setView('overview')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            view === 'overview' ? 'bg-surface-primary shadow-sm text-primary-600' : 'text-text-secondary'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setView('conversions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            view === 'conversions' ? 'bg-surface-primary shadow-sm text-primary-600' : 'text-text-secondary'
          }`}
        >
          Conversions
        </button>
        <button
          onClick={() => setView('revenue')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            view === 'revenue' ? 'bg-surface-primary shadow-sm text-primary-600' : 'text-text-secondary'
          }`}
        >
          Revenue
        </button>
      </div>

      {view === 'overview' && (
        <>
          {/* Conversion Funnel */}
          <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Conversion Funnel</h3>
            <div className="space-y-2">
              {conversionFunnel.map((stage, idx) => {
                const maxValue = conversionFunnel[0].count;
                const width = (stage.count / maxValue) * 100;

                return (
                  <div key={stage.stage}>
                    <div className="flex items-center gap-4 mb-1">
                      <span className="w-32 text-sm font-medium text-text-secondary">
                        {stage.stage}
                      </span>
                      <span className="flex-1 text-sm text-text-primary font-medium">
                        {stage.count.toLocaleString('ro-RO')}
                      </span>
                      <span className="text-sm text-text-tertiary">
                        {stage.conversionRate.toFixed(1)}%
                      </span>
                      <span className={`text-sm ${stage.dropOff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stage.dropOff > 0 ? `-${stage.dropOff.toFixed(1)}%` : '0%'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-32"></span>
                      <div className="flex-1 bg-surface-secondary rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${idx === 0 ? 'bg-gray-400' : idx < 2 ? 'bg-blue-500' : idx < 4 ? 'bg-green-500' : 'bg-primary-600'}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Segment Conversions */}
          <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Conversions by Segment</h3>
            <div className="space-y-3">
              {segmentConversions.map((segment) => (
                <div key={segment.segment} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                  <div>
                    <p className="font-medium text-text-primary">{segment.segment}</p>
                    <p className="text-sm text-text-tertiary">
                      {segment.conversions.toLocaleString('ro-RO')} conversions • Avg: {segment.avgValue.toFixed(2)} RON
                    </p>
                  </div>
                  <p className="font-bold text-text-primary">
                    {segment.revenue.toLocaleString('ro-RO')} RON
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'conversions' && (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-6 text-center">
          <Target size={48} className="mx-auto text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Conversions Analytics</h3>
          <p className="text-text-secondary">
            Detailed conversion analytics view coming soon.
          </p>
        </div>
      )}

      {view === 'revenue' && (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-6 text-center">
          <DollarSign size={48} className="mx-auto text-text-tertiary mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">Revenue Analytics</h3>
          <p className="text-text-secondary">
            Detailed revenue analytics view coming soon.
          </p>
        </div>
      )}
    </div>
  );
}

// Attribution View Component
function AttributionView() {
  const [events, setEvents] = useState<AttributionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  useEffect(() => {
    loadAttributionEvents();
  }, []);

  const loadAttributionEvents = async () => {
    try {
      setLoading(true);
      // TODO: Replace with real API call
      const mockEvents: AttributionEvent[] = [
        {
          id: '1',
          eventType: 'purchase',
          touchpoint: 'email_campaign',
          channel: 'email',
          campaignId: 'camp-001',
          customerId: 'cust-123',
          value: 142.5,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          eventType: 'purchase',
          touchpoint: 'social_ad',
          channel: 'social',
          campaignId: 'camp-002',
          customerId: 'cust-456',
          value: 89.0,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
      ];
      setEvents(mockEvents);
    } catch (error) {
      console.error('Error loading attribution events:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(e => {
    const matchesType = eventTypeFilter === 'all' || e.eventType === eventTypeFilter;
    const matchesChannel = channelFilter === 'all' || e.channel === channelFilter;
    return matchesType && matchesChannel;
  });

  const getEventTypeConfig = (type: string) => {
    switch (type) {
      case 'view':
        return { label: 'View', color: 'blue' };
      case 'click':
        return { label: 'Click', color: 'purple' };
      case 'add_to_cart':
        return { label: 'Add to Cart', color: 'yellow' };
      case 'purchase':
        return { label: 'Purchase', color: 'green' };
      case 'lead':
        return { label: 'Lead', color: 'cyan' };
      default:
        return { label: type, color: 'gray' };
    }
  };

  const getChannelName = (channel: string) => {
    const names: Record<string, string> = {
      email: 'Email',
      sms: 'SMS',
      push: 'Push',
      social: 'Social',
      display: 'Display',
      whatsapp: 'WhatsApp',
    };
    return names[channel] || channel;
  };

  const columns: Column<AttributionEvent>[] = [
    {
      key: 'eventType',
      label: 'Event Type',
      render: (value) => {
        const config = getEventTypeConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'touchpoint',
      label: 'Touchpoint',
      render: (value) => <span className="font-mono text-sm">{value}</span>,
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (value) => getChannelName(value),
    },
    {
      key: 'campaignId',
      label: 'Campaign',
      render: (value) => value ? <span className="font-mono text-xs">{value}</span> : '-',
    },
    {
      key: 'value',
      label: 'Value',
      render: (value) => value ? `${value.toFixed(2)} RON` : '-',
    },
    {
      key: 'timestamp',
      label: 'Time',
      render: (value) => new Date(value).toLocaleString('ro-RO'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-4">
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">All Events</option>
            <option value="view">Views</option>
            <option value="click">Clicks</option>
            <option value="add_to_cart">Add to Cart</option>
            <option value="purchase">Purchases</option>
            <option value="lead">Leads</option>
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="social">Social</option>
            <option value="display">Display</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button onClick={() => {/* TODO: export */}} className="btn-secondary">
            <Download size={18} className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Attribution Events Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<PieChart size={48} className="text-text-tertiary" />}
          title="No Attribution Events"
          description="No attribution events recorded yet."
          variant="compact"
        />
      ) : (
        <DataTable columns={columns} data={filteredEvents} />
      )}

      {/* Attribution Model Info */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Target size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-400 mb-1">Attribution Model</p>
            <p className="text-sm text-blue-700 dark:text-blue-500">
              Using last-touch attribution model. Credits the last marketing touchpoint before conversion.
              Attribution events are tracked across all channels and stored for analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
