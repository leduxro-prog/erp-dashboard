import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Plus, BarChart3, TrendingUp, Loader2, Download } from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';
import { StatusBadge } from '@/components/ui/StatusBadge';

const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboards');

  // Real data fetching
  const { data: dashboards, isLoading: dashboardsLoading } = useQuery({
    queryKey: ['analytics', 'dashboards'],
    queryFn: () => analyticsService.getDashboards(),
  });

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['analytics', 'reports'],
    queryFn: () => analyticsService.getReports(),
  });

  const { data: salesAnalytics, isLoading: salesLoading } = useQuery({
    queryKey: ['analytics', 'sales', 'summary'],
    queryFn: () => {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return analyticsService.getSalesAnalytics({ startDate, endDate, groupBy: 'month' });
    },
  });

  if (dashboardsLoading || reportsLoading || salesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // Map backend data to recharts format
  const revenueData = salesAnalytics?.dailyRevenue?.map((d: any, i: number) => ({
    month: d.date,
    revenue: d.total,
    profit: d.total * 0.3, // Approximated for UI
    cost: d.total * 0.7
  })) || [];

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Analytics & BI</h1>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Dashboard Nou
        </button>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'dashboards', label: 'Dashboarduri' },
            { id: 'reports', label: 'Rapoarte' },
            { id: 'profitability', label: 'Profitabilitate' },
            { id: 'cashflow', label: 'Cash-Flow' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboards Tab */}
      {activeTab === 'dashboards' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dashboards?.map(dash => (
            <div key={dash.id} className="card">
              <h3 className="font-bold text-slate-900 mb-2">{dash.name}</h3>
              <p className="text-sm text-slate-600 mb-4">{dash.widgets.length} widgets</p>
              <p className="text-xs text-slate-500 mb-4">Modificat: {new Date(dash.updatedAt).toLocaleDateString()}</p>
              <button className="btn-secondary w-full text-sm">Deschide</button>
            </div>
          ))}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Raport</th>
                  <th>Tip</th>
                  <th>Generat</th>
                  <th>Format</th>
                  <th>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {reports?.map(rep => (
                  <tr key={rep.id}>
                    <td className="font-bold text-slate-900">{rep.name}</td>
                    <td><span className="badge-success">{rep.type}</span></td>
                    <td className="text-sm text-slate-600">{rep.lastGenerated ? new Date(rep.lastGenerated).toLocaleString() : 'Never'}</td>
                    <td className="font-bold uppercase text-xs">{rep.format}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Deschide</button>
                        <button className="text-slate-600 hover:text-slate-700 text-sm font-medium flex items-center gap-1">
                          <Download size={14} /> Descarca
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profitability Tab */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="section-title mb-4">Evoluție Venituri și Profit</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Venit" />
                <Bar dataKey="profit" fill="#10b981" name="Profit Estimat" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="card">
          <h3 className="section-title mb-4">Analiză Cash-Flow (Inflows vs Outflows)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Intrări (Vânzări)" />
              <Area type="monotone" dataKey="cost" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Ieșiri (Costuri)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export { AnalyticsPage };
export default AnalyticsPage;
