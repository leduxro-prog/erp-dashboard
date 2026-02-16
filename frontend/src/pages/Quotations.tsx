import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, FileText, Eye, Edit2, ArrowRight } from 'lucide-react';

const Quotations = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('toate');

  const quotations = [
    { id: '#COT-2024001', customer: 'SC Lux Events SRL', date: '08 Ian 2024', validityDate: '08 Feb 2024', total: 4500, status: 'Trimisa' },
    { id: '#COT-2024002', customer: 'Electro Pro SA', date: '07 Ian 2024', validityDate: '07 Feb 2024', total: 2100, status: 'Draft' },
    { id: '#COT-2024003', customer: 'Design Tech Studio', date: '06 Ian 2024', validityDate: '06 Dec 2023', total: 6800, status: 'Expirata' },
    { id: '#COT-2024004', customer: 'Club Night Life', date: '05 Ian 2024', validityDate: '05 Feb 2024', total: 1800, status: 'Acceptata' },
    { id: '#COT-2024005', customer: 'Instalatii LED SRL', date: '04 Ian 2024', validityDate: '04 Feb 2024', total: 5200, status: 'Acceptata' },
    { id: '#COT-2024006', customer: 'Show Production', date: '03 Ian 2024', validityDate: '03 Jan 2024', total: 3400, status: 'Expirata' },
    { id: '#COT-2024007', customer: 'Tech Solutions', date: '02 Ian 2024', validityDate: '02 Feb 2024', total: 5900, status: 'Trimisa' },
    { id: '#COT-2024008', customer: 'Studio Lighting', date: '01 Ian 2024', validityDate: '01 Jan 2024', total: 2200, status: 'Respinsa' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Trimisa': 'bg-blue-100 text-blue-800',
      'Acceptata': 'bg-green-100 text-green-800',
      'Expirata': 'bg-orange-100 text-orange-800',
      'Respinsa': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredQuotations = quotations.filter(q => {
    const matchSearch = q.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       q.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'toate' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cotații</h1>
          <p className="text-gray-500">Gestiunea ofertelor și cotațiilor comerciale</p>
        </div>

        {/* Filters Bar */}
        <Card className="bg-white border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Cauta cotatie sau client..."
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
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Trimisa">Trimisa</SelectItem>
                  <SelectItem value="Acceptata">Acceptata</SelectItem>
                  <SelectItem value="Expirata">Expirata</SelectItem>
                  <SelectItem value="Respinsa">Respinsa</SelectItem>
                </SelectContent>
              </Select>

              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileText className="w-4 h-4 mr-2" />
                + Cotatie noua
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quotations Table */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Lista cotații ({filteredQuotations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Nr. Cotatie</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Client</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Data</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Valabilitate</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-600">Total</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
                    <th className="text-center py-4 px-6 font-medium text-gray-600">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((quotation) => (
                    <tr key={quotation.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-900">{quotation.id}</td>
                      <td className="py-4 px-6 text-gray-700">{quotation.customer}</td>
                      <td className="py-4 px-6 text-gray-600 text-sm">{quotation.date}</td>
                      <td className="py-4 px-6 text-gray-600 text-sm">{quotation.validityDate}</td>
                      <td className="py-4 px-6 text-right font-medium text-gray-900">{quotation.total} RON</td>
                      <td className="py-4 px-6">
                        <Badge className={getStatusColor(quotation.status)}>{quotation.status}</Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0" title="Vizualizare">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0" title="Editeaza">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0" title="Descarca PDF">
                            <Download className="w-4 h-4" />
                          </Button>
                          {quotation.status === 'Acceptata' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-8 h-8 p-0 text-green-600"
                              title="Converteste in comanda"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredQuotations.length === 0 && (
              <div className="py-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nu au fost gasite cotații cu acesti parametri.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quotations;
