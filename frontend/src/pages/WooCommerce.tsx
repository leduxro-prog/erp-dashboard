import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

const WooCommerce = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const syncStatus = {
    lastSync: '08 Ian 2024 14:35',
    itemsSynced: 1247,
    newOrders: 8,
    failedItems: 3,
    status: 'success',
  };

  const productSync = [
    { sku: 'LED-RGB-5050', name: 'LED RGB 5050 SMD', wcStatus: 'Sincronizat', wooProd: '#45821', lastSync: '08 Ian 10:30' },
    { sku: 'LED-ALB-3000K', name: 'LED Alb 3000K WW', wcStatus: 'Sincronizat', wooProd: '#45822', lastSync: '08 Ian 10:30' },
    { sku: 'CTRL-DMX512', name: 'Controller DMX 512', wcStatus: 'Sincronizat', wooProd: '#45823', lastSync: '08 Ian 10:30' },
    { sku: 'BAND-LED-12V', name: 'Banda LED RGB 12V', wcStatus: 'Eroare', wooProd: '-', lastSync: '07 Ian 16:45' },
    { sku: 'TRANSF-12V50W', name: 'Transformator 12V 50W', wcStatus: 'Sincronizat', wooProd: '#45825', lastSync: '08 Ian 10:30' },
    { sku: 'CONN-XLR-M', name: 'Conector XLR M 3 Pini', wcStatus: 'In asteptare', wooProd: '-', lastSync: '-' },
  ];

  const importLog = [
    { id: '#WC-2024-01001', customer: 'John Doe', date: '08 Ian 14:20', items: 5, total: 450, status: 'Importata' },
    { id: '#WC-2024-01002', customer: 'Jane Smith', date: '08 Ian 13:15', items: 3, total: 280, status: 'Importata' },
    { id: '#WC-2024-01003', customer: 'Bob Johnson', date: '08 Ian 12:00', items: 2, total: 120, status: 'Eroare' },
    { id: '#WC-2024-01004', customer: 'Alice Williams', date: '08 Ian 11:30', items: 4, total: 350, status: 'Importata' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      'Sincronizat': 'bg-green-100 text-green-800',
      'In asteptare': 'bg-blue-100 text-blue-800',
      'Eroare': 'bg-red-100 text-red-800',
      'Importata': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">WooCommerce</h1>
          <p className="text-gray-500">Sincronizare produse și comenzi cu WooCommerce</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-4 w-full">
            <TabsTrigger value="dashboard" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="produse" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Sincronizare produse
            </TabsTrigger>
            <TabsTrigger value="comenzi" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Import comenzi
            </TabsTrigger>
            <TabsTrigger value="configurare" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Configurare
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Ultima sincronizare</p>
                  <p className="text-lg font-bold text-gray-900">{syncStatus.lastSync}</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Produse sincronizate</p>
                  <p className="text-lg font-bold text-green-600">{syncStatus.itemsSynced}</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Comenzi noi</p>
                  <p className="text-lg font-bold text-blue-600">{syncStatus.newOrders}</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Erori</p>
                  <p className="text-lg font-bold text-red-600">{syncStatus.failedItems}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">Status sincronizare</CardTitle>
                  <Badge className="bg-green-100 text-green-800">Activa</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900">Sincronizare OK</p>
                      <p className="text-sm text-green-700 mt-1">
                        Sistemul sincronizeaza automat produsele și comenzile cu WooCommerce.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Sincronizeaza manual
                  </Button>
                  <Button variant="outline">Detalii sincronizare</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Product Sync Tab */}
          <TabsContent value="produse">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Status sincronizare produse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">SKU</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nume Produs</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Produs WC</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Ultima sincronizare</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSync.map((product) => (
                        <tr key={product.sku} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{product.sku}</td>
                          <td className="py-3 px-4 text-gray-700">{product.name}</td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(product.wcStatus)}>{product.wcStatus}</Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{product.wooProd}</td>
                          <td className="py-3 px-4 text-gray-600">{product.lastSync}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {product.wcStatus === 'Eroare' && (
                                <Button variant="ghost" size="sm" className="text-red-600">
                                  Resincronizeaza
                                </Button>
                              )}
                              {product.wcStatus === 'Sincronizat' && (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Import Tab */}
          <TabsContent value="comenzi">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">Jurnal import comenzi</CardTitle>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Import manual
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">ID WC</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Client</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Data</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Articole</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importLog.map((order) => (
                        <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{order.id}</td>
                          <td className="py-3 px-4 text-gray-700">{order.customer}</td>
                          <td className="py-3 px-4 text-gray-600">{order.date}</td>
                          <td className="py-3 px-4 text-center text-gray-600">{order.items}</td>
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
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configurare">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Configurare WooCommerce</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">URL magasin WooCommerce</h4>
                  <p className="text-sm text-gray-600 mb-3">https://shop.cypherled.com</p>
                  <Button variant="outline">Modifica</Button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">API Key WooCommerce</h4>
                  <p className="text-sm text-gray-600 mb-3">●●●●●●●●●●●●●●●●●●●●●●●●●●●●</p>
                  <Button variant="outline">Regenereaza</Button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-4">Setari sincronizare</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="text-sm text-gray-700">Sincronizeaza automat produse</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="text-sm text-gray-700">Importa automat comenzi</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="text-sm text-gray-700">Actualizeaza stoc automat</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WooCommerce;
