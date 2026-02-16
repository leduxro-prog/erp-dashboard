import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, RefreshCw, Eye, Target, TrendingUp } from 'lucide-react';

const SEO = () => {
  const products = [
    { sku: 'LED-RGB-5050', name: 'LED RGB 5050 SMD', seoScore: 85, keywords: 'LED RGB SMD 5050', title: 'LED RGB 5050 SMD de vânzare - CYPHER', description: 'Lămpi LED RGB 5050...' },
    { sku: 'LED-ALB-3000K', name: 'LED Alb 3000K WW', seoScore: 78, keywords: 'LED alb 3000K', title: 'LED Alb 3000K - Culoare Cald', description: 'LED alb cu temperatura de culoare...' },
    { sku: 'CTRL-DMX512', name: 'Controller DMX 512', seoScore: 92, keywords: 'Controller DMX', title: 'Controller DMX 512 profesional', description: 'Controller DMX profesional...' },
    { sku: 'BAND-LED-12V', name: 'Banda LED RGB 12V', seoScore: 88, keywords: 'Banda LED RGB 12V', title: 'Bandă LED RGB 12V - CYPHER', description: 'Bandă LED RGB profesională...' },
    { sku: 'TRANSF-12V50W', name: 'Transformator 12V 50W', seoScore: 65, keywords: 'Transformator LED', title: 'Transformator LED 12V 50W', description: 'Transformator pentru LED...' },
  ];

  const seoScoreData = [
    { range: '90-100', count: 2, color: '#10b981' },
    { range: '80-89', count: 2, color: '#3b82f6' },
    { range: '70-79', count: 1, color: '#f59e0b' },
    { range: '<70', count: 0, color: '#ef4444' },
  ];

  const getSeoScoreColor = (score) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 80) return 'bg-blue-100 text-blue-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getSeoScoreBgColor = (score) => {
    if (score >= 90) return 'bg-green-50 border-green-200';
    if (score >= 80) return 'bg-blue-50 border-blue-200';
    if (score >= 70) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SEO</h1>
          <p className="text-gray-500">Optimizare SEO pentru produse și conținut</p>
        </div>

        {/* SEO Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Scor SEO mediu</p>
              <p className="text-3xl font-bold text-gray-900">81.6</p>
              <p className="text-xs text-green-600 mt-2">+2.1% de luna trecuta</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Produse optimizate</p>
              <p className="text-3xl font-bold text-green-600">4/5</p>
              <p className="text-xs text-gray-500 mt-2">80% din catalog</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Sitemap</p>
              <Badge className="bg-green-100 text-green-800">Generat</Badge>
              <p className="text-xs text-gray-500 mt-2">1.247 URL-uri</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Robots.txt</p>
              <Badge className="bg-green-100 text-green-800">Configurat</Badge>
              <p className="text-xs text-gray-500 mt-2">OK</p>
            </CardContent>
          </Card>
        </div>

        {/* SEO Score Distribution Chart */}
        <Card className="bg-white border-0 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Distributie scor SEO</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={seoScoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* SEO Audit List */}
        <Card className="bg-white border-0 shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">Audit SEO produse</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <RefreshCw className="w-4 h-4" />
                Regeneaza toate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">SKU</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Produs</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Scor SEO</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Cuvinte cheie</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.sku} className={`border-b border-gray-100 ${getSeoScoreBgColor(product.seoScore)}`}>
                      <td className="py-3 px-4 font-medium text-gray-900">{product.sku}</td>
                      <td className="py-3 px-4 text-gray-700">{product.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center">
                          <Badge className={getSeoScoreColor(product.seoScore)}>
                            {product.seoScore}/100
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-600 text-xs">{product.keywords}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <RefreshCw className="w-4 h-4" />
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

        {/* Meta Tag Preview */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Previzualizare meta etichete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {products.map((product) => (
              <div key={product.sku} className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm font-semibold text-gray-600 mb-2">SKU: {product.sku}</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-500">Title:</p>
                    <p className="text-blue-600 font-mono">{product.title}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Description:</p>
                    <p className="text-gray-700 font-mono text-xs">{product.description}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Keywords:</p>
                    <p className="text-gray-700 font-mono">{product.keywords}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SEO;
