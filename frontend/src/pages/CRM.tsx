import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Gift, TrendingUp, MessageSquare, Star } from 'lucide-react';

const CRM = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('toti');

  const customers = [
    { id: 1, name: 'SC Lux Events SRL', email: 'contact@lux-events.ro', phone: '+40721234567', segment: 'VIP', purchases: 45, totalValue: 125000, loyaltyPoints: 12500, status: 'Active' },
    { id: 2, name: 'Electro Pro SA', email: 'admin@electropro.ro', phone: '+40721234568', segment: 'Premium', purchases: 78, totalValue: 285000, loyaltyPoints: 28500, status: 'Active' },
    { id: 3, name: 'Design Tech Studio', email: 'info@designtech.ro', phone: '+40721234569', segment: 'Standard', purchases: 12, totalValue: 45000, loyaltyPoints: 4500, status: 'Active' },
    { id: 4, name: 'Club Night Life', email: 'booking@clubnightlife.ro', phone: '+40721234570', segment: 'Standard', purchases: 8, totalValue: 28000, loyaltyPoints: 2800, status: 'Inactive' },
  ];

  const segments = ['toti', 'VIP', 'Premium', 'Standard', 'Inactivi'];

  const loyaltyProgram = [
    { tier: 'Silver', pointsNeeded: 0, discount: '5%', benefits: 'Numar comenzi: 1-10' },
    { tier: 'Gold', pointsNeeded: 10000, discount: '10%', benefits: 'Numar comenzi: 11-50' },
    { tier: 'Platinum', pointsNeeded: 25000, discount: '15%', benefits: 'Numar comenzi: 50+' },
  ];

  const coupons = [
    { code: 'LOYAL15', description: 'Discount Platini', discount: '15%', usageLimit: 100, used: 45, expires: '31 Dec 2024' },
    { code: 'REFERRAL10', description: 'Referral bonus', discount: '10%', usageLimit: 200, used: 87, expires: '28 Feb 2024' },
    { code: 'BIRTHDAY5', description: 'Birthday voucher', discount: '5%', usageLimit: 500, used: 234, expires: '31 Mar 2024' },
  ];

  const filteredCustomers = customers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSegment = segmentFilter === 'toti' || c.segment === segmentFilter;
    return matchSearch && matchSegment;
  });

  const getTierColor = (tier) => {
    const colors = {
      'VIP': 'bg-purple-100 text-purple-800',
      'Premium': 'bg-blue-100 text-blue-800',
      'Standard': 'bg-green-100 text-green-800',
      'Silver': 'bg-slate-100 text-slate-800',
      'Gold': 'bg-yellow-100 text-yellow-800',
      'Platinum': 'bg-purple-100 text-purple-800',
    };
    return colors[tier] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">CRM</h1>
          <p className="text-gray-500">Gestiunea relatiilor cu clientii si program de loialitate</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="clienti" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-5 w-full">
            <TabsTrigger value="clienti" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Clienti
            </TabsTrigger>
            <TabsTrigger value="segmentare" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Segmentare
            </TabsTrigger>
            <TabsTrigger value="loialitate" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Loialitate
            </TabsTrigger>
            <TabsTrigger value="cupoane" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Cupoane
            </TabsTrigger>
            <TabsTrigger value="analitici" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Analitici
            </TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="clienti">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Input
                      placeholder="Cauta client..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map(seg => (
                        <SelectItem key={seg} value={seg}>
                          {seg === 'toti' ? 'Toti clientii' : seg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nume Client</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Telefon</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Segment</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Comenzi</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Valoare</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Puncte loialitate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{customer.name}</td>
                          <td className="py-3 px-4 text-gray-600">{customer.email}</td>
                          <td className="py-3 px-4 text-gray-600">{customer.phone}</td>
                          <td className="py-3 px-4">
                            <Badge className={getTierColor(customer.segment)}>{customer.segment}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center text-gray-600">{customer.purchases}</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">{customer.totalValue} RON</td>
                          <td className="py-3 px-4 text-right">
                            <Badge className="bg-blue-100 text-blue-800">{customer.loyaltyPoints}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Segmentation Tab */}
          <TabsContent value="segmentare">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">Constructie segmente</CardTitle>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    + Segment nou
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'VIP Customers', rules: 'Valoare comenzi > 100.000 RON', customers: 15 },
                  { name: 'Inactive 90 Days', rules: 'Fara comenzi in ultima 90 zile', customers: 28 },
                  { name: 'High Frequency', rules: 'Comenzi pe luna: >= 5', customers: 42 },
                  { name: 'New Customers', rules: 'Inregistrati in ultima luna', customers: 8 },
                ].map((seg, idx) => (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">{seg.name}</h4>
                        <p className="text-sm text-gray-600">{seg.rules}</p>
                        <p className="text-xs text-gray-500 mt-2">{seg.customers} clienti</p>
                      </div>
                      <Button variant="outline" size="sm">Editeaza</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loyalty Tab */}
          <TabsContent value="loialitate">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {loyaltyProgram.map((tier, idx) => (
                <Card key={idx} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-lg text-gray-900">{tier.tier}</h4>
                      <Badge className={getTierColor(tier.tier)}>{tier.tier}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-600">Puncte necesare: <span className="font-semibold text-gray-900">{tier.pointsNeeded}</span></p>
                      <p className="text-gray-600">Discount: <span className="font-semibold text-green-600">{tier.discount}</span></p>
                      <p className="text-gray-600">Beneficii: <span className="font-semibold text-gray-900">{tier.benefits}</span></p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <Gift className="w-5 h-5 mr-2 text-purple-600" />
                  Recompense disponibile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Discount 10% urmatoarea comanda', points: 5000 },
                    { name: 'Cadou: Cablu RGB 5m', points: 3000 },
                    { name: 'Freebie: Filtru LED', points: 2000 },
                    { name: 'Express shipping gratuit', points: 1500 },
                  ].map((reward, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span className="text-gray-900">{reward.name}</span>
                      <Badge className="bg-blue-100 text-blue-800">{reward.points} puncte</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="cupoane">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Cupon nou
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Cod</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Descriere</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Discount</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Utilizari</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Expira</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.map((coupon, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-gray-900">{coupon.code}</td>
                          <td className="py-3 px-4 text-gray-600">{coupon.description}</td>
                          <td className="py-3 px-4 font-bold text-blue-600">{coupon.discount}</td>
                          <td className="py-3 px-4 text-center text-gray-600">{coupon.used} / {coupon.usageLimit}</td>
                          <td className="py-3 px-4 text-gray-600">{coupon.expires}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analitici">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Total clienti</p>
                  <p className="text-3xl font-bold text-gray-900">156</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Clienti activi</p>
                  <p className="text-3xl font-bold text-green-600">142</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Valoare medie</p>
                  <p className="text-3xl font-bold text-blue-600">28.543 RON</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Rata retentie</p>
                  <p className="text-3xl font-bold text-orange-600">91%</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Top clienti dupa valoare</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customers.sort((a, b) => b.totalValue - a.totalValue).slice(0, 4).map((customer, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.purchases} comenzi</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{customer.totalValue} RON</p>
                        <Badge className={getTierColor(customer.segment)}>{customer.segment}</Badge>
                      </div>
                    </div>
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

export default CRM;
