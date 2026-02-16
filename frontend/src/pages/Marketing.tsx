import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { TrendingUp, Target, Mail, Zap } from 'lucide-react';

const Marketing = () => {
  const campaigns = [
    { id: '#CAMP-001', name: 'Winter Sale 2024', type: 'Email', startDate: '01 Ian', endDate: '31 Ian', audience: 1250, budget: 5000, status: 'Activa' },
    { id: '#CAMP-002', name: 'LED Innovations', type: 'SMS', startDate: '08 Ian', endDate: '15 Ian', audience: 850, budget: 2000, status: 'Activa' },
    { id: '#CAMP-003', name: 'New Year Discount', type: 'Email', startDate: '01 Ian', endDate: '07 Ian', audience: 2100, budget: 8000, status: 'Finalizata' },
    { id: '#CAMP-004', name: 'Summer Clearance', type: 'Multi-channel', startDate: '01 Iun', endDate: '30 Iun', audience: 3500, budget: 15000, status: 'Pauza' },
  ];

  const discountCodes = [
    { code: 'WINTER2024', discount: '15%', usageLimit: 100, used: 45, expires: '31 Ian 2024', status: 'Activ' },
    { code: 'NEWYEAR10', discount: '10%', usageLimit: 200, used: 198, expires: '07 Ian 2024', status: 'Expirat' },
    { code: 'LED20', discount: '20%', usageLimit: 50, used: 12, expires: '28 Feb 2024', status: 'Activ' },
    { code: 'EARLYBIRD5', discount: '5%', usageLimit: 500, used: 234, expires: '15 Mar 2024', status: 'Activ' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      'Activa': 'bg-green-100 text-green-800',
      'Pauza': 'bg-yellow-100 text-yellow-800',
      'Finalizata': 'bg-gray-100 text-gray-800',
      'Activ': 'bg-green-100 text-green-800',
      'Expirat': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Marketing</h1>
          <p className="text-gray-500">Gestiunea campaniilor și promotorii</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campanii" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-4 w-full">
            <TabsTrigger value="campanii" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Campanii
            </TabsTrigger>
            <TabsTrigger value="coduri" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Coduri Discount
            </TabsTrigger>
            <TabsTrigger value="email" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Email sequences
            </TabsTrigger>
            <TabsTrigger value="analitici" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Analitici
            </TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campanii">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Campanie noua
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                          <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
                        </div>
                        <p className="text-sm text-gray-500">{campaign.id}</p>
                      </div>
                      <Button variant="outline">Detalii</Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Tip</p>
                        <p className="font-medium text-gray-900">{campaign.type}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Perioada</p>
                        <p className="font-medium text-gray-900">{campaign.startDate} - {campaign.endDate}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Audienta</p>
                        <p className="font-medium text-gray-900">{campaign.audience.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Buget</p>
                        <p className="font-medium text-gray-900">{campaign.budget} RON</p>
                      </div>
                      <div>
                        <p className="text-gray-500">ROI</p>
                        <p className="font-medium text-green-600">+12.5%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Discount Codes Tab */}
          <TabsContent value="coduri">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Cod nou
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
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Discount</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Utilizari</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Rata utilizare</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Expira</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discountCodes.map((code, idx) => {
                        const utilizationRate = ((code.used / code.usageLimit) * 100).toFixed(0);
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-semibold text-gray-900">{code.code}</td>
                            <td className="py-3 px-4 font-bold text-blue-600">{code.discount}</td>
                            <td className="py-3 px-4 text-center text-gray-600">
                              {code.used} / {code.usageLimit}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${utilizationRate}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-gray-600">{utilizationRate}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-600">{code.expires}</td>
                            <td className="py-3 px-4">
                              <Badge className={getStatusColor(code.status)}>{code.status}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Sequences Tab */}
          <TabsContent value="email">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-blue-600" />
                    Secvente email automate
                  </CardTitle>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    + Secventa noua
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Welcome Series', emails: 3, subscribers: 450, openRate: '35%', active: true },
                  { name: 'Abandoned Cart', emails: 2, subscribers: 128, openRate: '42%', active: true },
                  { name: 'Win-back Campaign', emails: 4, subscribers: 280, openRate: '18%', active: false },
                ].map((seq, idx) => (
                  <Card key={idx} className="bg-gray-50 border-0">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{seq.name}</h4>
                          <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mt-2">
                            <p>{seq.emails} email-uri</p>
                            <p>{seq.subscribers} abonati</p>
                            <p>Open rate: {seq.openRate}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={seq.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {seq.active ? 'Activa' : 'Inactiva'}
                          </Badge>
                          <Button variant="outline" size="sm">Editeaza</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analitici">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Total campanii</p>
                  <p className="text-3xl font-bold text-gray-900">4</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Campanii active</p>
                  <p className="text-3xl font-bold text-green-600">2</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">Buget total</p>
                  <p className="text-3xl font-bold text-gray-900">30.000 RON</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-gray-600 mb-2">ROI mediu</p>
                  <p className="text-3xl font-bold text-blue-600">+18.5%</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Top campanii dupa performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'Winter Sale 2024', roi: '+45%', revenue: 18500 },
                    { name: 'LED Innovations', roi: '+32%', revenue: 12400 },
                    { name: 'New Year Discount', roi: '+28%', revenue: 8900 },
                  ].map((camp, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{camp.name}</p>
                        <p className="text-sm text-gray-500 mt-1">Venit: {camp.revenue} RON</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{camp.roi}</p>
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

export default Marketing;
