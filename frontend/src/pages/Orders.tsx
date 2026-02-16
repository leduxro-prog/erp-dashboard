import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Download, Edit2, Eye, Trash2, ChevronDown } from 'lucide-react';

const Orders = () => {
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('toate');
  const [dateRange, setDateRange] = useState('30');

  const orders = [
    { id: '#2024001', customer: 'SC Lux Events SRL', date: '08 Ian 2024', products: 5, total: 4500, status: 'Livrata' },
    { id: '#2024002', customer: 'Electro Pro SA', date: '07 Ian 2024', products: 3, total: 2100, status: 'In procesare' },
    { id: '#2024003', customer: 'Design Tech Studio', date: '06 Ian 2024', products: 8, total: 6800, status: 'Noua' },
    { id: '#2024004', customer: 'Club Night Life', date: '05 Ian 2024', products: 2, total: 1800, status: 'Livrata' },
    { id: '#2024005', customer: 'Instalatii LED SRL', date: '04 Ian 2024', products: 6, total: 5200, status: 'Livrata' },
    { id: '#2024006', customer: 'Show Production', date: '03 Ian 2024', products: 4, total: 3400, status: 'In procesare' },
    { id: '#2024007', customer: 'Tech Solutions', date: '02 Ian 2024', products: 7, total: 5900, status: 'Livrata' },
    { id: '#2024008', customer: 'Studio Lighting', date: '01 Ian 2024', products: 3, total: 2200, status: 'Livrata' },
    { id: '#2024009', customer: 'Professional Events', date: '31 Dec 2023', products: 5, total: 4100, status: 'Anulata' },
    { id: '#2024010', customer: 'Scenography Works', date: '30 Dec 2023', products: 2, total: 1500, status: 'Livrata' },
    { id: '#2024011', customer: 'Creative Lighting', date: '29 Dec 2023', products: 4, total: 3200, status: 'In procesare' },
    { id: '#2024012', customer: 'Event Management Inc', date: '28 Dec 2023', products: 6, total: 5100, status: 'Noua' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      'Noua': 'bg-blue-100 text-blue-800',
      'In procesare': 'bg-yellow-100 text-yellow-800',
      'Livrata': 'bg-green-100 text-green-800',
      'Anulata': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredOrders = orders.filter(order => {
    const matchSearch = order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'toate' || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleOrderSelection = (id) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Comenzi</h1>
          <p className="text-gray-500">Gestiunea comenzilor din sistem</p>
        </div>

        {/* Filters Bar */}
        <Card className="bg-white border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Cauta comanda sau client..."
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
                  <SelectItem value="Noua">Noua</SelectItem>
                  <SelectItem value="In procesare">In procesare</SelectItem>
                  <SelectItem value="Livrata">Livrata</SelectItem>
                  <SelectItem value="Anulata">Anulata</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Perioada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Ultimele 7 zile</SelectItem>
                  <SelectItem value="30">Ultimele 30 zile</SelectItem>
                  <SelectItem value="90">Ultimele 90 zile</SelectItem>
                  <SelectItem value="365">Ultimul an</SelectItem>
                </SelectContent>
              </Select>

              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedOrders.length > 0 && (
          <Card className="bg-blue-50 border border-blue-200 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {selectedOrders.length} comanda{selectedOrders.length !== 1 ? 'e' : ''} selectata{selectedOrders.length !== 1 ? 'e' : ''}
                </p>
                <div className="space-x-3">
                  <Button variant="outline" size="sm">Marcheaza ca Livrata</Button>
                  <Button variant="outline" size="sm">Marcheaza ca Anulata</Button>
                  <Button variant="outline" size="sm" className="text-red-600">Sterge</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders Table */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Lista comenzi ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-6 font-medium text-gray-600">
                      <Checkbox
                        checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                        onChange={toggleAllSelection}
                      />
                    </th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Nr. Comanda</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Client</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Data</th>
                    <th className="text-center py-4 px-6 font-medium text-gray-600">Produse</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-600">Total</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
                    <th className="text-center py-4 px-6 font-medium text-gray-600">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                        />
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-900">{order.id}</td>
                      <td className="py-4 px-6 text-gray-700">{order.customer}</td>
                      <td className="py-4 px-6 text-gray-600 text-sm">{order.date}</td>
                      <td className="py-4 px-6 text-center text-gray-600">{order.products}</td>
                      <td className="py-4 px-6 text-right font-medium text-gray-900">{order.total} RON</td>
                      <td className="py-4 px-6">
                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredOrders.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-gray-500">Nu au fost gasite comenzi cu acesti parametri.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
