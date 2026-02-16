import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('30');

  const salesData = [
    { date: '1 Ian', venit: 8200, comenzi: 45 },
    { date: '5 Ian', venit: 9100, comenzi: 52 },
    { date: '10 Ian', venit: 7800, comenzi: 38 },
    { date: '15 Ian', venit: 11200, comenzi: 65 },
    { date: '20 Ian', venit: 10500, comenzi: 58 },
    { date: '25 Ian', venit: 13400, comenzi: 72 },
    { date: '30 Ian', venit: 12800, comenzi: 68 },
  ];

  const profitabilityData = [
    { product: 'LED RGB 5050', revenue: 45000, cost: 15000, profit: 30000 },
    { product: 'LED ALB 3000K', revenue: 32000, cost: 10000, profit: 22000 },
    { product: 'Controller DMX', revenue: 28000, cost: 12000, profit: 16000 },
    { product: 'Banda LED 12V', revenue: 22000, cost: 7000, profit: 15000 },
    { product: 'Transformator 12V', revenue: 18000, cost: 8000, profit: 10000 },
  ];

  const cashFlowData = [
    { month: 'Nov', inflow: 45000, outflow: 32000 },
    { month: 'Dec', inflow: 52000, outflow: 38000 },
    { month: 'Ian', inflow: 58000, outflow: 42000 },
    { month: 'Feb', inflow: 63000, outflow: 45000 },
    { month: 'Mar', inflow: 71000, outflow: 48000 },
  ];

  const inventoryMetrics = [
    { label: 'Valoare inventar', value: 245800, icon: '📦' },
    { label: 'Rata rotatie', value: '3.2x/an', icon: '🔄' },
    { label: 'Stocuri in exces', value: 2500, icon: '⚠️' },
    { label: 'Stocuri insuficiente', value: 5, icon: '🚨' },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Analitici</h1>
          <p className="text-gray-500">Dashboard analytics cu rapoarte și prognozări</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="vanzari" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-5 w-full">
            <TabsTrigger value="vanzari" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Vanzari
            </TabsTrigger>
            <TabsTrigger value="rentabilitate" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Rentabilitate
            </TabsTrigger>
            <TabsTrigger value="cash" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="inventar" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Inventar
            </TabsTrigger>
            <TabsTrigger value="rapoarte" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Rapoarte
            </TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="vanzari">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Venit total</p>
                  <p className="text-2xl font-bold text-gray-900">72.900 RON</p>
                  <p className="text-xs text-green-600 mt-2">+12.5% fata de luna trecuta</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Comenzi</p>
                  <p className="text-2xl font-bold text-gray-900">398</p>
                  <p className="text-xs text-green-600 mt-2">+8.3% fata de luna trecuta</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Valoare medie comanda</p>
                  <p className="text-2xl font-bold text-gray-900">183.17 RON</p>
                  <p className="text-xs text-green-600 mt-2">+3.1% fata de luna trecuta</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Rata conversie</p>
                  <p className="text-2xl font-bold text-gray-900">3.2%</p>
                  <p className="text-xs text-red-600 mt-2">-0.5% fata de luna trecuta</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Venituri - Ultimele 30 zile</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="venit" stroke="#3b82f6" strokeWidth={2} name="Venit (RON)" />
                    <Line type="monotone" dataKey="comenzi" stroke="#10b981" strokeWidth={2} name="Comenzi" yAxisId="right" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profitability Tab */}
          <TabsContent value="rentabilitate">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Analiza rentabilitate per produs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Produs</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Venit</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Cost</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Profit</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Marja %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitabilityData.map((item, idx) => {
                        const margin = ((item.profit / item.revenue) * 100).toFixed(1);
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 font-medium text-gray-900">{item.product}</td>
                            <td className="py-3 px-4 text-right text-gray-600">{item.revenue} RON</td>
                            <td className="py-3 px-4 text-right text-gray-600">{item.cost} RON</td>
                            <td className="py-3 px-4 text-right font-medium text-green-600">{item.profit} RON</td>
                            <td className="py-3 px-4 text-right">
                              <Badge className="bg-green-100 text-green-800">{margin}%</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={profitabilityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="product" stroke="#9ca3af" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Venit" />
                    <Bar dataKey="cost" fill="#ef4444" name="Cost" />
                    <Bar dataKey="profit" fill="#10b981" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cash">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Proiectie flux de numerar</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="inflow" fill="#10b981" name="Intrari" />
                    <Bar dataKey="outflow" fill="#ef4444" name="Iesiri" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {inventoryMetrics.map((metric, idx) => (
                <Card key={idx} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="text-2xl mb-2">{metric.icon}</div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{metric.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Distribuție categorii inventar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'LED', value: 85000 },
                          { name: 'Controlere', value: 45000 },
                          { name: 'Conectori', value: 32000 },
                          { name: 'Filtre', value: 28000 },
                          { name: 'Altele', value: 55800 },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} RON`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="rapoarte">
            <div className="space-y-4">
              {[
                { name: 'Raport vanzari zilnice', format: 'PDF/CSV/Excel' },
                { name: 'Raport profitabilitate', format: 'PDF/CSV/Excel' },
                { name: 'Raport inventar', format: 'PDF/CSV/Excel' },
                { name: 'Raport clienti top', format: 'PDF/CSV/Excel' },
              ].map((report, idx) => (
                <Card key={idx} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{report.name}</h4>
                      <p className="text-sm text-gray-500">{report.format}</p>
                    </div>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                      <Download className="w-4 h-4" />
                      Descarca
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;
