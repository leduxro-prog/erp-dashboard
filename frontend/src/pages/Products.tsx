import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Grid, List, Search, Edit2, AlertTriangle } from 'lucide-react';

const Products = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('toate');

  const products = [
    { sku: 'LED-RGB-5050', name: 'LED RGB 5050 SMD', price: 12.50, stock: 450, category: 'LED', image: '📦' },
    { sku: 'LED-ALB-3000K', name: 'LED Alb 3000K WW', price: 8.75, stock: 320, category: 'LED', image: '💡' },
    { sku: 'CTRL-DMX512', name: 'Controller DMX 512', price: 85.00, stock: 45, category: 'Controlere', image: '🎛️' },
    { sku: 'BAND-LED-12V', name: 'Banda LED RGB 12V', price: 25.00, stock: 120, category: 'Benzi LED', image: '📍' },
    { sku: 'TRANSF-12V50W', name: 'Transformator 12V 50W', price: 45.00, stock: 85, category: 'Alimentare', image: '⚡' },
    { sku: 'CONN-XLR-M', name: 'Conector XLR M 3 Pini', price: 5.50, stock: 200, category: 'Conectori', image: '🔌' },
    { sku: 'FILT-LED-CW', name: 'Filtru LED Alb Rece', price: 3.20, stock: 580, category: 'Filtre', image: '🔵' },
    { sku: 'RELEU-DMR', name: 'Releu Dimmer DMX', price: 120.00, stock: 22, category: 'Controlere', image: '🔄' },
    { sku: 'SURSA-24V100W', name: 'Sursa Alimentare 24V 100W', price: 155.00, stock: 30, category: 'Alimentare', image: '🔋' },
    { sku: 'CABL-RGB-5M', name: 'Cablu RGB 5 Metri', price: 18.00, stock: 95, category: 'Cabluri', image: '🧵' },
    { sku: 'PROFIL-ALU-2M', name: 'Profil Aluminiu 2m LED', price: 35.00, stock: 160, category: 'Accesorii', image: '📐' },
    { sku: 'LENTILA-COB', name: 'Lentila COB LED 60°', price: 7.50, stock: 410, category: 'Accesorii', image: '🔍' },
  ];

  const categories = ['toate', 'LED', 'Controlere', 'Benzi LED', 'Alimentare', 'Conectori', 'Filtre', 'Cabluri', 'Accesorii'];

  const getStockColor = (stock) => {
    if (stock < 30) return 'text-red-600 bg-red-50';
    if (stock < 100) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getStockBadgeClass = (stock) => {
    if (stock < 30) return 'bg-red-100 text-red-800';
    if (stock < 100) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const filteredProducts = products.filter(product => {
    const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = categoryFilter === 'toate' || product.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Produse</h1>
          <p className="text-gray-500">Gestiunea catalogului de produse</p>
        </div>

        {/* Filters & Controls */}
        <Card className="bg-white border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Cauta dupa nume sau SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Categorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat === 'toate' ? 'Toate categoriile' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="px-3"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="px-3"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                + Produs nou
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.sku} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="text-5xl mb-4 text-center">{product.image}</div>
                  <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{product.sku}</p>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <p className="text-2xl font-bold text-gray-900">{product.price.toFixed(2)} RON</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Stoc</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${getStockColor(product.stock)}`}>
                          {product.stock} buc.
                        </span>
                        <Badge className={getStockBadgeClass(product.stock)}>
                          {product.stock < 30 ? 'Critic' : product.stock < 100 ? 'Scazut' : 'Normal'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Categorie: {product.category}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="flex-1" size="sm">
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editeaza
                    </Button>
                    <Button variant="ghost" size="sm" className="px-3">
                      •••
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <Card className="bg-white border-0 shadow-sm">
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-6 font-medium text-gray-600">Imagine</th>
                      <th className="text-left py-4 px-6 font-medium text-gray-600">SKU</th>
                      <th className="text-left py-4 px-6 font-medium text-gray-600">Nume Produs</th>
                      <th className="text-left py-4 px-6 font-medium text-gray-600">Categorie</th>
                      <th className="text-right py-4 px-6 font-medium text-gray-600">Pret</th>
                      <th className="text-right py-4 px-6 font-medium text-gray-600">Stoc</th>
                      <th className="text-center py-4 px-6 font-medium text-gray-600">Actiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.sku} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6 text-2xl">{product.image}</td>
                        <td className="py-4 px-6 font-medium text-gray-700">{product.sku}</td>
                        <td className="py-4 px-6 text-gray-900">{product.name}</td>
                        <td className="py-4 px-6 text-gray-600">{product.category}</td>
                        <td className="py-4 px-6 text-right font-semibold text-gray-900">
                          {product.price.toFixed(2)} RON
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Badge className={getStockBadgeClass(product.stock)}>
                            {product.stock} buc.
                          </Badge>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                              •••
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
        )}

        {filteredProducts.length === 0 && (
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Nu au fost gasite produse cu acesti parametri.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Products;
