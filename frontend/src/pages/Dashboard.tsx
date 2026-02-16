import React, { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, AlertTriangle, Package, ShoppingCart, Users, DollarSign, Clock } from 'lucide-react';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);

  const kpiData = [
    { label: 'Venituri', value: '254.850', currency: 'RON', trend: '+12.5%', icon: DollarSign },
    { label: 'Comenzi', value: '1.247', trend: '+8.3%', icon: ShoppingCart },
    { label: 'Valoare medie comanda', value: '204.2', currency: 'RON', trend: '+3.1%', icon: DollarSign },
    { label: 'Stoc total', value: '15.432', trend: '+2.1%', icon: Package },
    { label: 'Facturi neplatite', value: '8.900', currency: 'RON', trend: '-5.2%', icon: Clock },
    { label: 'Clienti noi', value: '42', trend: '+18.7%', icon: Users },
  ];

  const revenueData = [
    { date: '1 Ian', value: 8200 },
    { date: '5 Ian', value: 9100 },
    { date: '10 Ian', value: 7800 },
    { date: '15 Ian', value: 11200 },
    { date: '20 Ian', value: 10500 },
    { date: '25 Ian', value: 13400 },
    { date: '30 Ian', value: 12800 },
  ];

  const topProducts = [
    { name: 'LED RGB 5050', sales: 4200 },
    { name: 'LED Alb 3000K', sales: 3800 },
    { name: 'Controller DMX', sales: 3200 },
    { name: 'Banda LED', sales: 2900 },
    { name: 'Transformator 12V', sales: 2500 },
    { name: 'Conectori XLR', sales: 2100 },
    { name: 'Filtre LED', sales: 1800 },
    { name: 'Releu dimmer', sales: 1600 },
    { name: 'Sursa alimentare', sales: 1400 },
    { name: 'Cablu RGB', sales: 1200 },
  ];

  const recentOrders = [
    { id: '#2024001', customer: 'SC Lux Events SRL', date: '08 Ian', items: 5, total: 4500, status: 'Livrata' },
    { id: '#2024002', customer: 'Electro Pro SA', date: '07 Ian', items: 3, total: 2100, status: 'In procesare' },
    { id: '#2024003', customer: 'Design Tech Studio', date: '06 Ian', items: 8, total: 6800, status: 'Noua' },
    { id: '#2024004', customer: 'Club Night Life', date: '05 Ian', items: 2, total: 1800, status: 'Livrata' },
    { id: '#2024005', customer: 'Instalatii LED SRL', date: '04 Ian', items: 6, total: 5200, status: 'Livrata' },
    { id: '#2024006', customer: 'Show Production', date: '03 Ian', items: 4, total: 3400, status: 'In procesare' },
    { id: '#2024007', customer: 'Tech Solutions', date: '02 Ian', items: 7, total: 5900, status: 'Livrata' },
    { id: '#2024008', customer: 'Studio Lighting', date: '01 Ian', items: 3, total: 2200, status: 'Livrata' },
    { id: '#2024009', customer: 'Professional Events', date: '31 Dec', items: 5, total: 4100, status: 'Livrata' },
    { id: '#2024010', customer: 'Scenography Works', date: '30 Dec', items: 2, total: 1500, status: 'Livrata' },
  ];

  const lowStockAlerts = [
    { sku: 'LED-RGB-5050', name: 'LED RGB 5050', current: 12, limit: 50, status: 'Critic' },
    { sku: 'CTRL-DMX512', name: 'Controller DMX', current: 5, limit: 20, status: 'Critic' },
    { sku: 'BAND-LED-12V', name: 'Banda LED 12V', current: 25, limit: 40, status: 'Atentionare' },
    { sku: 'CONN-XLR-M', name: 'Conector XLR M', current: 8, limit: 30, status: 'Critic' },
  ];

  const syncStatus = {
    lastSync: '08 Ian 14:35',
    itemsSynced: 1247,
    failures: 3,
    status: 'success',
  };

  const getStatusColor = (status) => {
    const colors = {
      'Noua': 'bg-blue-100 text-blue-800',
      'In procesare': 'bg-yellow-100 text-yellow-800',
      'Livrata': 'bg-green-100 text-green-800',
      'Anulata': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getAlertColor = (status) => {
    return status === 'Critic' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Tablou de bord</h1>
          <p className="text-gray-500">Bine ati venit! Iata statisticile dvs.</p>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {kpiData.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <Card key={idx} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">{kpi.label}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {kpi.value}{kpi.currency && ' ' + kpi.currency}
                      </p>
                    </div>
                    <Icon className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex items-center text-green-600 text-sm font-medium">
                    <ArrowUp className="w-4 h-4 mr-1" />
                    {kpi.trend}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Venituri - Ultimele 30 zile</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Products Chart */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Top 10 produse vandute</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#9ca3af" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Bar dataKey="sales" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Orders */}
          <Card className="lg:col-span-2 bg-white border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Comenzi recente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Nr. Comanda</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Data</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-900">{order.id}</td>
                        <td className="py-3 px-4 text-gray-700">{order.customer}</td>
                        <td className="py-3 px-4 text-gray-500">{order.date}</td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">{order.total} RON</td>
                        <td className="py-3 px-4">
                          <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Low Stock Alerts */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                  Alerte stoc scazut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowStockAlerts.map((alert, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${getAlertColor(alert.status)}`}>
                      <p className="font-medium text-gray-900 text-sm">{alert.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{alert.current} / {alert.limit}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* WooCommerce Sync Status */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Sincronizare WooCommerce</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Ultima sincronizare</p>
                  <p className="font-medium text-gray-900">{syncStatus.lastSync}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Produse sincronizate</p>
                    <p className="text-2xl font-bold text-green-600">{syncStatus.itemsSynced}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Erori</p>
                    <p className="text-2xl font-bold text-red-600">{syncStatus.failures}</p>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Sincronizare manuala
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div className="bg-white rounded-lg shadow-sm p-6 flex gap-4">
          <h3 className="text-sm font-semibold text-gray-600 mr-4">Actiuni rapide:</h3>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">+ Comanda noua</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white">+ Factura</Button>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">+ Receptie</Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
