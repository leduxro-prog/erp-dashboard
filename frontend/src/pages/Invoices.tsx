import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Download, Eye, TrendingDown } from 'lucide-react';

const Invoices = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('toate');

  const invoices = [
    { id: '#FAC-2024001', orderId: '#2024001', customer: 'SC Lux Events SRL', date: '08 Ian 2024', dueDate: '22 Ian 2024', total: 4500, status: 'Emisa', days: 0 },
    { id: '#FAC-2024002', orderId: '#2024002', customer: 'Electro Pro SA', date: '07 Ian 2024', dueDate: '21 Ian 2024', total: 2100, status: 'Platita', days: 0 },
    { id: '#FAC-2024003', orderId: '#2024003', customer: 'Design Tech Studio', date: '06 Ian 2024', dueDate: '20 Ian 2024', total: 6800, status: 'Restanta', days: 3 },
    { id: '#FAC-2024004', orderId: '#2024004', customer: 'Club Night Life', date: '05 Ian 2024', dueDate: '19 Ian 2024', total: 1800, status: 'Platita', days: 0 },
    { id: '#FAC-2024005', orderId: '#2024005', customer: 'Instalatii LED SRL', date: '04 Ian 2024', dueDate: '18 Ian 2024', total: 5200, status: 'Emisa', days: 5 },
    { id: '#FAC-2024006', orderId: '#2024006', customer: 'Show Production', date: '03 Ian 2024', dueDate: '17 Ian 2024', total: 3400, status: 'Restanta', days: 8 },
    { id: '#FAC-2024007', orderId: '#2024007', customer: 'Tech Solutions', date: '02 Ian 2024', dueDate: '16 Ian 2024', total: 5900, status: 'Anulata', days: 0 },
    { id: '#FAC-2024008', orderId: '#2024008', customer: 'Studio Lighting', date: '01 Ian 2024', dueDate: '15 Ian 2024', total: 2200, status: 'Platita', days: 0 },
  ];

  const agingReport = [
    { range: '0-30 zile', count: 3, amount: 13900 },
    { range: '31-60 zile', count: 2, amount: 8400 },
    { range: '61-90 zile', count: 1, amount: 2500 },
    { range: '90+ zile', count: 0, amount: 0 },
  ];

  const getStatusColor = (status) => {
    const colors = {
      'Emisa': 'bg-blue-100 text-blue-800',
      'Platita': 'bg-green-100 text-green-800',
      'Restanta': 'bg-red-100 text-red-800',
      'Anulata': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = inv.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       inv.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'toate' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Facturi</h1>
          <p className="text-gray-500">Gestiunea facturilor și al plăților (SmartBill)</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="facturi" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-4 w-full">
            <TabsTrigger value="facturi" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Facturi emise
            </TabsTrigger>
            <TabsTrigger value="proforma" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Proforma
            </TabsTrigger>
            <TabsTrigger value="aging" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Aging report
            </TabsTrigger>
            <TabsTrigger value="sync" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Sincronizare
            </TabsTrigger>
          </TabsList>

          {/* Invoices Tab */}
          <TabsContent value="facturi">
            {/* Filters */}
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Cauta factura sau client..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="toate">Toate statusurile</SelectItem>
                      <SelectItem value="Emisa">Emisa</SelectItem>
                      <SelectItem value="Platita">Platita</SelectItem>
                      <SelectItem value="Restanta">Restanta</SelectItem>
                      <SelectItem value="Anulata">Anulata</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    + Factura din comanda
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Invoices Table */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Lista facturi ({filteredInvoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-4 px-6 font-medium text-gray-600">Nr. Factura</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-600">Client</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-600">Data</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-600">Scadent</th>
                        <th className="text-right py-4 px-6 font-medium text-gray-600">Total</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
                        <th className="text-center py-4 px-6 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 font-medium text-gray-900">{invoice.id}</td>
                          <td className="py-4 px-6 text-gray-700">{invoice.customer}</td>
                          <td className="py-4 px-6 text-gray-600">{invoice.date}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{invoice.dueDate}</span>
                              {invoice.days > 0 && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  +{invoice.days} zile
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-medium text-gray-900">{invoice.total} RON</td>
                          <td className="py-4 px-6">
                            <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                <Download className="w-4 h-4" />
                              </Button>
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

          {/* Proforma Tab */}
          <TabsContent value="proforma">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Facturi Proforma</CardTitle>
              </CardHeader>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nu exista facturi proforma.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aging Report Tab */}
          <TabsContent value="aging">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <TrendingDown className="w-5 h-5 mr-2 text-orange-600" />
                  Raport scadente (Aging Report)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {agingReport.map((item, idx) => (
                    <Card key={idx} className="bg-gray-50 border-0">
                      <CardContent className="p-6">
                        <p className="text-sm font-medium text-gray-600 mb-2">{item.range}</p>
                        <p className="text-3xl font-bold text-gray-900 mb-2">{item.count}</p>
                        <p className="text-sm text-gray-600">{item.amount} RON</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Perioada scadent</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Nr. Facturi</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Valoare totala</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">% Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingReport.map((item, idx) => {
                        const totalAmount = agingReport.reduce((sum, a) => sum + a.amount, 0);
                        const percent = totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : 0;
                        return (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-3 px-4 font-medium text-gray-900">{item.range}</td>
                            <td className="py-3 px-4 text-center text-gray-600">{item.count}</td>
                            <td className="py-3 px-4 text-right font-medium text-gray-900">{item.amount} RON</td>
                            <td className="py-3 px-4 text-center text-gray-600">{percent}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync Tab */}
          <TabsContent value="sync">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Status sincronizare SmartBill</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-semibold text-green-900 mb-2">✓ Sincronizare activa</p>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                    <div>
                      <p className="text-green-700 font-medium">Ultima sincronizare</p>
                      <p className="text-green-600">08 Ian 2024 14:35</p>
                    </div>
                    <div>
                      <p className="text-green-700 font-medium">Facturi sincronizate</p>
                      <p className="text-green-600">156</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    Resincronizeaza acum
                  </Button>
                  <Button variant="outline">Detalii sincronizare</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Invoices;
