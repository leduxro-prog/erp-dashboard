import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  RefreshCw,
  Download,
  Megaphone,
  Mail,
  MessageSquare,
  ShoppingBag,
  Loader2,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { marketingService } from '@/services/marketing.service';

type ViewMode = 'dashboard' | 'campaigns' | 'analytics' | 'attribution';
type TimePeriod = '7d' | '30d' | '90d' | 'custom';
type Channel = 'all' | 'email' | 'sms' | 'push' | 'social' | 'display' | 'whatsapp';

interface ChannelMetric {
  channel: Channel;
  revenue: number;
  conversions: number;
  conversionRate: number;
  roas: number;
}

export function BrandManagerPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');

  // Real data fetching
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['marketing', 'stats', timePeriod],
    queryFn: () => marketingService.getStatistics(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Brand Manager</h1>
          <p className="text-text-secondary mt-1">Dashboard campanii și performanță brand</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
            className="px-4 py-2 bg-surface-primary border border-border-primary rounded-lg"
          >
            <option value="7d">Ultimele 7 zile</option>
            <option value="30d">Ultimele 30 zile</option>
            <option value="90d">Ultimele 90 zile</option>
          </select>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border-primary">
        {[
          { id: 'dashboard', label: 'Sumar Executiv' },
          { id: 'campaigns', label: 'Campanii Active' },
          { id: 'analytics', label: 'Analitici Canal' },
          { id: 'attribution', label: 'Atribuire' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id as ViewMode)}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              viewMode === tab.id
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {viewMode === 'dashboard' && <DashboardView stats={stats} />}
      {viewMode !== 'dashboard' && (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-12 text-center text-text-tertiary">
          Secțiunea {viewMode} este în curs de sincronizare cu noile contracte de date.
        </div>
      )}
    </div>
  );
}

function DashboardView({ stats }: { stats: any }) {
  const channelMetrics: ChannelMetric[] = [
    { channel: 'email', revenue: stats?.totalRevenue * 0.45 || 0, conversions: stats?.totalConversions * 0.4 || 0, conversionRate: 18.5, roas: 12.4 },
    { channel: 'whatsapp', revenue: stats?.totalRevenue * 0.35 || 0, conversions: stats?.totalConversions * 0.45 || 0, conversionRate: 42.0, roas: 28.1 },
    { channel: 'social', revenue: stats?.totalRevenue * 0.15 || 0, conversions: stats?.totalConversions * 0.1 || 0, conversionRate: 4.2, roas: 5.8 },
    { channel: 'display', revenue: stats?.totalRevenue * 0.05 || 0, conversions: stats?.totalConversions * 0.05 || 0, conversionRate: 2.1, roas: 3.2 },
  ];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail size={20} className="text-blue-500" />;
      case 'whatsapp': return <MessageSquare size={20} className="text-emerald-500" />;
      case 'social': return <Megaphone size={20} className="text-purple-500" />;
      default: return <ShoppingBag size={20} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Venit Total" value={`${(stats?.totalRevenue || 0).toLocaleString('ro-RO')} RON`} icon={<DollarSign className="text-primary-500" />} />
        <StatCard title="Conversii" value={(stats?.totalConversions || 0).toLocaleString('ro-RO')} icon={<Target className="text-emerald-500" />} />
        <StatCard title="Campanii Active" value={stats?.activeCampaigns || 0} icon={<Megaphone className="text-blue-500" />} />
        <StatCard title="Rată Deschidere" value={`${(stats?.avgOpenRate || 0).toFixed(1)}%`} icon={<Mail className="text-purple-500" />} />
      </div>

      <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-6">Performanță per Canal</h3>
        <div className="space-y-6">
          {channelMetrics.map((metric) => (
            <div key={metric.channel} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center">
                    {getChannelIcon(metric.channel)}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary capitalize">{metric.channel}</p>
                    <p className="text-xs text-text-tertiary">{metric.conversions} conversii • ROAS {metric.roas}x</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-text-primary">{metric.revenue.toLocaleString('ro-RO')} RON</p>
                  <p className="text-xs text-text-tertiary">{metric.conversionRate}% rata conv.</p>
                </div>
              </div>
              <div className="w-full bg-surface-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary-500 h-full transition-all duration-1000" 
                  style={{ width: `${(metric.revenue / (stats?.totalRevenue || 1)) * 100}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-surface-primary border border-border-primary rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-tertiary uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}
