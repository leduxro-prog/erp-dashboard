import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, Users, Lock, Zap, Save, Copy, Eye, EyeOff, Trash2, Plus } from 'lucide-react';

const Settings = () => {
  const [showApiKey, setShowApiKey] = useState(false);

  const users = [
    { id: 1, name: 'Andrei Popescu', email: 'andrei@cypher.ro', role: 'Admin', status: 'Activ', lastLogin: '08 Ian 14:35' },
    { id: 2, name: 'Maria Ionescu', email: 'maria@cypher.ro', role: 'Manager', status: 'Activ', lastLogin: '08 Ian 13:20' },
    { id: 3, name: 'Rares Dinca', email: 'rares@cypher.ro', role: 'Operator', status: 'Activ', lastLogin: '08 Ian 12:15' },
    { id: 4, name: 'Elena Popescu', email: 'elena@cypher.ro', role: 'Viewer', status: 'Inactiv', lastLogin: '07 Ian 16:45' },
  ];

  const roles = [
    { name: 'Admin', permissions: ['Toate'] },
    { name: 'Manager', permissions: ['Comenzi', 'Produse', 'Clienti', 'Rapoarte'] },
    { name: 'Operator', permissions: ['Comenzi', 'Inventar', 'POS'] },
    { name: 'Viewer', permissions: ['Vizualizare doar'] },
  ];

  const apiKeys = [
    { id: 1, name: 'Integration API', key: '●●●●●●●●●●●●●●●●●●●●●●●●●●●●', created: '01 Ian 2024', lastUsed: '08 Ian 14:35' },
    { id: 2, name: 'Mobile App', key: '●●●●●●●●●●●●●●●●●●●●●●●●●●●●', created: '15 Dec 2023', lastUsed: '08 Ian 10:20' },
    { id: 3, name: 'Test Environment', key: '●●●●●●●●●●●●●●●●●●●●●●●●●●●●', created: '01 Dec 2023', lastUsed: '05 Ian 09:15' },
  ];

  const systemHealth = [
    { check: 'Database', status: 'OK', lastChecked: '08 Ian 14:35' },
    { check: 'API Server', status: 'OK', lastChecked: '08 Ian 14:35' },
    { check: 'Storage', status: 'OK (85% utilizat)', lastChecked: '08 Ian 14:35' },
    { check: 'Backups', status: 'OK (Ultima: 08 Ian 00:15)', lastChecked: '08 Ian 14:35' },
  ];

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Setari</h1>
          <p className="text-gray-500">Configurarea sistemului și administrare</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-5 w-full">
            <TabsTrigger value="general" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              General
            </TabsTrigger>
            <TabsTrigger value="utilizatori" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Utilizatori
            </TabsTrigger>
            <TabsTrigger value="roluri" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Roluri
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              API Keys
            </TabsTrigger>
            <TabsTrigger value="sanatate" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Sanatatea sistemului
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Setari generale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nume companie</label>
                  <Input defaultValue="CYPHER LED Systems" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email contact</label>
                  <Input type="email" defaultValue="contact@cypher.ro" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                  <Input type="tel" defaultValue="+40721234567" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valuta implicita</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option>RON (Lei romani)</option>
                    <option>EUR (Euro)</option>
                    <option>USD (Dolar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fus orar</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option>Europe/Bucharest (UTC+2)</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox defaultChecked />
                    <span className="text-sm text-gray-700">Modul intretinere</span>
                  </label>
                </div>

                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <Save className="w-4 h-4" />
                  Salveaza modificari
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="utilizatori">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <Plus className="w-4 h-4" />
                  Utilizator nou
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Lista utilizatori</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nume</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Rol</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Ultima autentificare</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{user.name}</td>
                          <td className="py-3 px-4 text-gray-600">{user.email}</td>
                          <td className="py-3 px-4">
                            <Badge className="bg-purple-100 text-purple-800">{user.role}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={user.status === 'Activ' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {user.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{user.lastLogin}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                <Settings className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-red-600">
                                <Trash2 className="w-4 h-4" />
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

          {/* Roles Tab */}
          <TabsContent value="roluri">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Roluri și permisiuni</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {roles.map((role, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">{role.name}</h4>
                      <div className="space-y-2">
                        {role.permissions.map((perm, pidx) => (
                          <label key={pidx} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox defaultChecked={true} />
                            <span className="text-sm text-gray-700">{perm}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <Plus className="w-4 h-4" />
                  API Key nou
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">API Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {apiKeys.map((api) => (
                    <div key={api.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">{api.name}</h4>
                          <p className="text-sm text-gray-600">Creat: {api.created}</p>
                        </div>
                        <Button variant="outline" size="sm" className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg mb-3 flex items-center justify-between">
                        <code className="text-sm font-mono text-gray-600">{api.key}</code>
                        <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Ultima utilizare: {api.lastUsed}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Health Tab */}
          <TabsContent value="sanatate">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {systemHealth.map((check, idx) => (
                <Card key={idx} className="bg-white border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">{check.check}</h4>
                      <Badge className={check.status.includes('OK') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        OK
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{check.status}</p>
                    <p className="text-xs text-gray-500">Verificat: {check.lastChecked}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-white border-0 shadow-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">Ultima salvare: 08 Ian 2024 00:15</p>
                <div className="flex gap-3">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">Creeaza backup acum</Button>
                  <Button variant="outline">Descarca backup</Button>
                  <Button variant="outline">Restaureaza din backup</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
