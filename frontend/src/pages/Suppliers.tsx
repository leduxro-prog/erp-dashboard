import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Truck, Link as LinkIcon, ShoppingCart } from 'lucide-react';

const Suppliers = () => {
  const [activeTab, setActiveTab] = useState('furnizori');

  const suppliers = [
    { id: 1, name: 'LED Global Trade', country: 'China', status: 'Sincronizat', lastSync: '08 Ian 10:30', products: 245 },
    { id: 2, name: 'Electro Tech Supply', country: 'Polonia', status: 'Sincronizat', lastSync: '08 Ian 09:15', products: 178 },
    { id: 3, name: 'Smart Components Ltd', country: 'UK', status: 'In sincronizare', lastSync: '08 Ian 08:00', products: 156 },
    { id: 4, name: 'Premium Lighting EU', country: 'Germania', status: 'Eroare', lastSync: '07 Ian 16:45', products: 98 },
  ];

  const skuMappings = [
    { supplierSKU: 'LED-RGB-SMD-5050', ourSKU: 'LED-RGB-5050', supplierName: 'LED Global Trade', price: 2.50, leadTime: '7 zile' },
    { supplierSKU: 'WW-LED-3K-SMD', ourSKU: 'LED-ALB-3000K', supplierName: 'LED Global Trade', price: 1.75, leadTime: '7 zile' },
    { supplierSKU: 'DMX512-CONT-PRO', ourSKU: 'CTRL-DMX512', supplierName: 'Electro Tech Supply', price: 28.00, leadTime: '14 zile' },
    { supplierSKU: 'RGB-STRIP-12V-5M', ourSKU: 'BAND-LED-12V', supplierName: 'Smart Components Ltd', price: 8.50, leadTime: '10 zile' },
    { supplierSKU: 'XLR-CONN-M-3PIN', ourSKU: 'CONN-XLR-M', supplierName: 'Electro Tech Supply', price: 1.20, leadTime: '14 zile' },
  ];

  const priceComparison = [
    { sku: 'LED-RGB-5050', suppliers: [{ name: 'LED Global Trade', price: 2.50 }, { name: 'Electro Tech Supply', price: 2.75 }, { name: 'Smart Components Ltd', price: 2.60 }] },
    { sku: 'CTRL-DMX512', suppliers: [{ name: 'Electro Tech Supply', price: 28.00 }, { name: 'Smart Components Ltd', price: 29.50 }] },
    { sku: 'BAND-LED-12V', suppliers: [{ name: 'Smart Components Ltd', price: 8.50 }, { name: 'LED Global Trade', price: 8.75 }] },
  ];

  const getStatusColor = (status) => {
    const colors = {
      'Sincronizat': 'bg-green-100 text-green-800',
      'In sincronizare': 'bg-blue-100 text-blue-800',
      'Eroare': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Furnizori</h1>
          <p className="text-gray-500">Gestiunea furnizorilor și al mapării SKU</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="furnizori" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-4 w-full">
            <TabsTrigger value="furnizori" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Furnizori
            </TabsTrigger>
            <TabsTrigger value="mapare" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Mapare SKU
            </TabsTrigger>
            <TabsTrigger value="comparatie" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Comparatie pret
            </TabsTrigger>
            <TabsTrigger value="comenzi" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Comenzi achizitie
            </TabsTrigger>
          </TabsList>

          {/* Suppliers Tab */}
          <TabsContent value="furnizori">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <Truck className="w-5 h-5 mr-2 text-blue-600" />
                  Lista furnizori
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nume Furnizor</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Tara</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Produse</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status Sincronizare</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Ultima sincronizare</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((supplier) => (
                        <tr key={supplier.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{supplier.name}</td>
                          <td className="py-3 px-4 text-gray-600">{supplier.country}</td>
                          <td className="py-3 px-4 text-center text-gray-600">{supplier.products}</td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(supplier.status)}>{supplier.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{supplier.lastSync}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="sm" className="text-blue-600">
                                Resincronizeaza
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

          {/* SKU Mapping Tab */}
          <TabsContent value="mapare">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <LinkIcon className="w-5 h-5 mr-2 text-purple-600" />
                  Mapare SKU furnizor - SKU intern
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">SKU Furnizor</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">SKU Intern</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Furnizor</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Pret</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Timp livrare</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skuMappings.map((mapping, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-mono text-gray-900">{mapping.supplierSKU}</td>
                          <td className="py-3 px-4 font-mono text-gray-900">{mapping.ourSKU}</td>
                          <td className="py-3 px-4 text-gray-600">{mapping.supplierName}</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">{mapping.price.toFixed(2)} RON</td>
                          <td className="py-3 px-4 text-gray-600">{mapping.leadTime}</td>
                          <td className="py-3 px-4">
                            <Button variant="outline" size="sm">Editeaza</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Price Comparison Tab */}
          <TabsContent value="comparatie">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Comparatie pret între furnizori</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {priceComparison.map((item, idx) => (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">{item.sku}</h4>
                    <div className="space-y-2">
                      {item.suppliers.map((supplier, sidx) => {
                        const minPrice = Math.min(...item.suppliers.map(s => s.price));
                        const isBest = supplier.price === minPrice;
                        return (
                          <div key={sidx} className={`p-3 rounded-lg flex justify-between items-center ${isBest ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                            <span className="font-medium text-gray-900">{supplier.name}</span>
                            <div className="flex items-center gap-3">
                              <span className={`text-lg font-bold ${isBest ? 'text-green-600' : 'text-gray-900'}`}>
                                {supplier.price.toFixed(2)} RON
                              </span>
                              {isBest && <Badge className="bg-green-100 text-green-800">Cel mai bun pret</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Orders Tab */}
          <TabsContent value="comenzi">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                    <ShoppingCart className="w-5 h-5 mr-2 text-green-600" />
                    Comenzi achizitie
                  </CardTitle>
                  <Button className="bg-green-600 hover:bg-green-700 text-white">
                    + Noua comanda achizitie
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nu exista comenzi de achizitie. Creeaza una noua pentru a comandate de la furnizori.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Suppliers;
