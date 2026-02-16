import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Clock, Users, ShoppingCart, CreditCard } from 'lucide-react';

const B2BPortal = () => {
  const [activeTab, setActiveTab] = useState('inregistrari');

  const registrationRequests = [
    { id: 1, name: 'SC Smart Lighting SRL', email: 'contact@smartlighting.ro', date: '08 Ian 2024', status: 'pending' },
    { id: 2, name: 'Electro Distribution SA', email: 'admin@electrodist.ro', date: '07 Ian 2024', status: 'pending' },
    { id: 3, name: 'LED Import Export', email: 'info@ledimex.ro', date: '06 Ian 2024', status: 'approved' },
    { id: 4, name: 'Event Lighting Pro', email: 'contact@eventlighting.ro', date: '05 Ian 2024', status: 'rejected' },
  ];

  const customers = [
    { id: 1, name: 'SC Lux Events SRL', tier: 'Gold', totalOrders: 45, totalValue: 125000, status: 'Active' },
    { id: 2, name: 'Electro Pro SA', tier: 'Platinum', totalOrders: 78, totalValue: 285000, status: 'Active' },
    { id: 3, name: 'Design Tech Studio', tier: 'Silver', totalOrders: 12, totalValue: 45000, status: 'Active' },
    { id: 4, name: 'Club Night Life', tier: 'Silver', totalOrders: 8, totalValue: 28000, status: 'Active' },
    { id: 5, name: 'Instalatii LED SRL', tier: 'Gold', totalOrders: 32, totalValue: 98000, status: 'Inactive' },
  ];

  const getTierColor = (tier) => {
    const colors = {
      'Silver': 'bg-slate-100 text-slate-800',
      'Gold': 'bg-yellow-100 text-yellow-800',
      'Platinum': 'bg-purple-100 text-purple-800',
    };
    return colors[tier] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Portal B2B</h1>
          <p className="text-gray-500">Gestiunea partenerilor comerciali și al canalelor de distribuție</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="inregistrari" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-4 w-full">
            <TabsTrigger value="inregistrari" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Inregistrari
            </TabsTrigger>
            <TabsTrigger value="clienti" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Clienti
            </TabsTrigger>
            <TabsTrigger value="credit" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Credit
            </TabsTrigger>
            <TabsTrigger value="cosuri" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Cosuri salvate
            </TabsTrigger>
          </TabsList>

          {/* Registration Requests Tab */}
          <TabsContent value="inregistrari">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Cereri de inregistrare in asteptare
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nume Companie</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Data Cererii</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrationRequests.map((req) => (
                        <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{req.name}</td>
                          <td className="py-3 px-4 text-gray-600">{req.email}</td>
                          <td className="py-3 px-4 text-gray-600">{req.date}</td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(req.status)}>
                              {req.status === 'pending' ? 'In asteptare' : req.status === 'approved' ? 'Aprobata' : 'Respinsa'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {req.status === 'pending' && (
                                <>
                                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-red-600">
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
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

          {/* Customers Tab */}
          <TabsContent value="clienti">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-600" />
                  Lista clienti B2B
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nume Client</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Tier</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Comenzi</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Valoare totala</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer) => (
                        <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{customer.name}</td>
                          <td className="py-3 px-4">
                            <Badge className={getTierColor(customer.tier)}>{customer.tier}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center text-gray-600">{customer.totalOrders}</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">{customer.totalValue} RON</td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(customer.status)}>{customer.status}</Badge>
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

          {/* Credit Tab */}
          <TabsContent value="credit">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-purple-600" />
                  Gestiune credit clienti
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {customers.map((customer) => (
                  <div key={customer.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">{customer.name}</h4>
                      <Badge className={getTierColor(customer.tier)}>{customer.tier}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Limita credit</p>
                        <p className="text-lg font-bold text-gray-900">25.000 RON</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Credit utilizat</p>
                        <p className="text-lg font-bold text-orange-600">12.500 RON (50%)</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }} />
                    </div>
                    <Button variant="outline" size="sm">Modifica limita</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Saved Carts Tab */}
          <TabsContent value="cosuri">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
                  Cosuri salvate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { id: 1, client: 'SC Lux Events SRL', items: 12, total: 4500, date: '08 Ian 2024' },
                    { id: 2, client: 'Electro Pro SA', items: 8, total: 2100, date: '07 Ian 2024' },
                    { id: 3, client: 'Design Tech Studio', items: 15, total: 6800, date: '06 Ian 2024' },
                  ].map(cart => (
                    <Card key={cart.id} className="bg-gray-50 border-0">
                      <CardContent className="p-4">
                        <p className="font-semibold text-gray-900 mb-2">{cart.client}</p>
                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                          <p>Articole: {cart.items}</p>
                          <p>Total: {cart.total} RON</p>
                          <p>Salvat: {cart.date}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                            Deschide
                          </Button>
                          <Button size="sm" variant="outline">Sterge</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default B2BPortal;
