import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Truck, Clock, TrendingUp } from 'lucide-react';

const WMS = () => {
  const kpiData = [
    { label: 'Acuratete receptie', value: '98.5%', icon: CheckCircle, color: 'text-green-600' },
    { label: 'Timp procesare mediu', value: '2.3h', icon: Clock, color: 'text-blue-600' },
    { label: 'Articole procesate azi', value: '1.247', icon: TrendingUp, color: 'text-purple-600' },
    { label: 'Articole expirand', value: '18', icon: AlertTriangle, color: 'text-orange-600' },
  ];

  const receptions = [
    { id: '#REC-2024001', supplier: 'LED Global Trade', date: '08 Ian 14:30', items: 500, status: 'Confirmata', accuracy: '99%' },
    { id: '#REC-2024002', supplier: 'Electro Tech Supply', date: '07 Ian 10:15', items: 350, status: 'In procesare', accuracy: '-' },
    { id: '#REC-2024003', supplier: 'Smart Components Ltd', date: '06 Ian 16:45', items: 280, status: 'Confirmata', accuracy: '98%' },
    { id: '#REC-2024004', supplier: 'Premium Lighting EU', date: '05 Ian 11:30', items: 420, status: 'Confirmata', accuracy: '97%' },
  ];

  const pickLists = [
    { id: '#PICK-2024001', order: '#2024001', items: 8, assignedTo: 'Andrei Popescu', status: 'In procesare', progress: 75 },
    { id: '#PICK-2024002', order: '#2024002', items: 5, assignedTo: 'Maria Ionescu', status: 'Completata', progress: 100 },
    { id: '#PICK-2024003', order: '#2024003', items: 12, assignedTo: 'Rares Dinca', status: 'In asteptare', progress: 0 },
    { id: '#PICK-2024004', order: '#2024004', items: 3, assignedTo: 'Andrei Popescu', status: 'Completata', progress: 100 },
  ];

  const expiringItems = [
    { sku: 'LED-RGB-5050', product: 'LED RGB 5050', batchNo: 'BATCH-2024-001', expiryDate: '28 Feb 2024', daysLeft: 21, stock: 120 },
    { sku: 'FILT-LED-CW', product: 'Filtru LED Alb Rece', batchNo: 'BATCH-2024-005', expiryDate: '15 Mar 2024', daysLeft: 35, stock: 85 },
    { sku: 'BAND-LED-12V', product: 'Banda LED 12V', batchNo: 'BATCH-2024-008', expiryDate: '22 Mar 2024', daysLeft: 42, stock: 60 },
  ];

  const logisticsKPIs = [
    { metric: 'Acuratete procesare', value: '98.5%', target: '99%', status: 'On-track' },
    { metric: 'Timp mediu expediere', value: '4.2h', target: '3h', status: 'Below-target' },
    { metric: 'Rata retururi', value: '0.8%', target: '1%', status: 'On-track' },
    { metric: 'Capacitate utilizata', value: '85%', target: '80%', status: 'Above-target' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      'Confirmata': 'bg-green-100 text-green-800',
      'In procesare': 'bg-blue-100 text-blue-800',
      'In asteptare': 'bg-yellow-100 text-yellow-800',
      'Completata': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">WMS (Warehouse Management)</h1>
          <p className="text-gray-500">Gestiunea depozitului si al operatiunilor logistice</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpiData.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <Card key={idx} className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">{kpi.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                    </div>
                    <Icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="receptii" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-5 w-full">
            <TabsTrigger value="receptii" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Receptii
            </TabsTrigger>
            <TabsTrigger value="pick" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Pick Lists
            </TabsTrigger>
            <TabsTrigger value="batch" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Batch/Serial
            </TabsTrigger>
            <TabsTrigger value="expirare" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Expirare
            </TabsTrigger>
            <TabsTrigger value="kpi" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              KPI Logistica
            </TabsTrigger>
          </TabsList>

          {/* Receptions Tab */}
          <TabsContent value="receptii">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Receptie noua
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Receptiile curente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nr. Receptie</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Furnizor</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Data</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Articole</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Acuratete</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receptions.map((reception) => (
                        <tr key={reception.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{reception.id}</td>
                          <td className="py-3 px-4 text-gray-700">{reception.supplier}</td>
                          <td className="py-3 px-4 text-gray-600">{reception.date}</td>
                          <td className="py-3 px-4 text-center text-gray-600">{reception.items}</td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(reception.status)}>{reception.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {reception.accuracy && <span className="font-semibold text-green-600">{reception.accuracy}</span>}
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="outline" size="sm">Detalii</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pick Lists Tab */}
          <TabsContent value="pick">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Lista de preluare comenzi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pickLists.map((pick) => (
                  <div key={pick.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{pick.id}</h4>
                        <p className="text-sm text-gray-600">Comanda: {pick.order} • {pick.items} articole</p>
                      </div>
                      <Badge className={getStatusColor(pick.status)}>{pick.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600">Asignat: {pick.assignedTo}</p>
                      <span className="text-sm font-semibold text-gray-900">{pick.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${pick.progress}%` }}
                      />
                    </div>
                    {pick.status === 'In asteptare' && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">Atribuie mie</Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch/Serial Tab */}
          <TabsContent value="batch">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Urmarire Batch/Serial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center">
                  <p className="text-gray-500">Functionalitate de urmarire lot si serie in dezvoltare.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expiring Items Tab */}
          <TabsContent value="expirare">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                  Articole cu termen apropiat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expiringItems.map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${item.daysLeft < 30 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{item.product}</h4>
                          <p className="text-sm text-gray-600">SKU: {item.sku} • Lot: {item.batchNo}</p>
                        </div>
                        <Badge className={item.daysLeft < 30 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                          {item.daysLeft} zile
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <p className="text-gray-600">Expira: <span className="font-semibold">{item.expiryDate}</span></p>
                        <p className="text-gray-600">Stoc: <span className="font-semibold">{item.stock} buc.</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logistics KPI Tab */}
          <TabsContent value="kpi">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {logisticsKPIs.map((kpi, idx) => (
                <Card key={idx} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">{kpi.metric}</p>
                        <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                      </div>
                      <Badge className={
                        kpi.status === 'On-track' ? 'bg-green-100 text-green-800' :
                        kpi.status === 'Below-target' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {kpi.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">Target: {kpi.target}</p>
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

export default WMS;
