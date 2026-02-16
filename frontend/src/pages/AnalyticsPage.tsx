import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, BarChart3, TrendingUp } from 'lucide-react';

const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboards');

  const revenueData = [
    { month: 'Ian', revenue: 45000, cost: 15000, profit: 30000 },
    { month: 'Feb', revenue: 52000, cost: 16500, profit: 35500 },
    { month: 'Mar', revenue: 58000, cost: 17800, profit: 40200 },
    { month: 'Apr', revenue: 62000, cost: 18200, profit: 43800 },
  ];

  const profitByProduct = [
    { product: 'LAPTOP-001', profit: 45000, margin: 28 },
    { product: 'MON-027-4K', profit: 28000, margin: 32 },
    { product: 'HEAD-PRO-01', profit: 22000, margin: 38 },
    { product: 'KEY-MECH-01', profit: 18500, margin: 35 },
    { product: 'MOUSE-GAM-01', profit: 15200, margin: 42 },
  ];

  const forecastData = [
    { month: 'Ian', actual: 45000, forecast: 45000 },
    { month: 'Feb', actual: 52000, forecast: 50500 },
    { month: 'Mar', actual: 58000, forecast: 57200 },
    { month: 'Apr', actual: 62000, forecast: 63100 },
    { month: 'May', actual: null, forecast: 68500 },
    { month: 'Jun', actual: null, forecast: 72800 },
  ];

  const cashFlowData = [
    { period: 'Week 1', inflow: 12500, outflow: 8200 },
    { period: 'Week 2', inflow: 15600, outflow: 9100 },
    { period: 'Week 3', inflow: 18200, outflow: 10500 },
    { period: 'Week 4', inflow: 16900, outflow: 9800 },
  ];

  const dashboards = [
    { id: 1, name: 'Executive Summary', widgets: 8, last_modified: '2024-01-07' },
    { id: 2, name: 'Sales Dashboard', widgets: 12, last_modified: '2024-01-06' },
    { id: 3, name: 'Inventory Dashboard', widgets: 6, last_modified: '2024-01-05' },
  ];

  const reports = [
    { id: 1, name: 'Monthly Sales Report', type: 'Sales', generated: '2024-01-08', rows: 1250 },
    { id: 2, name: 'Inventory Valuation', type: 'Inventory', generated: '2024-01-07', rows: 450 },
    { id: 3, name: 'Financial Summary', type: 'Financial', generated: '2024-01-05', rows: 85 },
  ];

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
            { id: 'forecast', label: 'Forecast' },
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
          {dashboards.map(dash => (
            <div key={dash.id} className="card">
              <h3 className="font-bold text-slate-900 mb-2">{dash.name}</h3>
              <p className="text-sm text-slate-600 mb-4">{dash.widgets} widgets</p>
              <p className="text-xs text-slate-500 mb-4">Modificat: {dash.last_modified}</p>
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
                  <th>Randuri</th>
                  <th>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(rep => (
                  <tr key={rep.id}>
                    <td className="font-bold text-slate-900">{rep.name}</td>
                    <td><span className="badge-success">{rep.type}</span></td>
                    <td className="text-sm text-slate-600">{rep.generated}</td>
                    <td className="font-bold">{rep.rows}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Deschide</button>
                        <button className="text-slate-600 hover:text-slate-700 text-sm font-medium">Descarca</button>
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
            <h3 className="section-title mb-4">Profit pe Produs</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitByProduct}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="product" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="profit" fill="#8b5cf6" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {profitByProduct.map((prod, idx) => (
              <div key={idx} className="kpi-card">
                <p className="text-slate-600 text-sm font-medium">{prod.product}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{prod.profit.toLocaleString()} RON</p>
                <span className="text-xs text-green-600 font-semibold mt-1">Marjă: {prod.margin}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === 'forecast' && (
        <div className="card">
          <h3 className="section-title mb-4">Forecast Venituri (30 zile)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} name="Actual" />
              <Line type="monotone" dataKey="forecast" stroke="#94a3b8" strokeDasharray="5 5" name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="card">
          <h3 className="section-title mb-4">Cash-Flow Projection</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} />
              <Legend />
              <Area type="monotone" dataKey="inflow" stackId="1" fill="#10b981" name="Intrari" />
              <Area type="monotone" dataKey="outflow" stackId="1" fill="#ef4444" name="Iesiri" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export { AnalyticsPage };
export default AnalyticsPage;
