import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Bell, Mail, MessageSquare, Smartphone, Send } from 'lucide-react';

const Notifications = () => {
  const [activeTab, setActiveTab] = useState('centru');

  const notifications = [
    { id: 1, type: 'email', title: 'Comanda #2024001 confirmata', message: 'SC Lux Events a confirmat comanda', date: '08 Ian 14:35', read: false },
    { id: 2, type: 'sms', title: 'Stoc scazut', message: 'LED RGB 5050 stoc < limita minima', date: '08 Ian 13:20', read: true },
    { id: 3, type: 'whatsapp', title: 'Raspuns client', message: 'Electro Pro raspunde la oferta', date: '08 Ian 12:15', read: true },
    { id: 4, type: 'push', title: 'Sincronizare WooCommerce', message: '3 noi comenzi importate', date: '08 Ian 11:00', read: true },
    { id: 5, type: 'email', title: 'Factura #FAC-2024005 platita', message: 'Instalatii LED - plata confirma', date: '07 Ian 16:45', read: true },
  ];

  const channelStats = [
    { channel: 'Email', count: 2458, deliveryRate: '98.5%', icon: Mail },
    { channel: 'SMS', count: 1247, deliveryRate: '99.2%', icon: MessageSquare },
    { channel: 'WhatsApp', count: 845, deliveryRate: '97.8%', icon: MessageSquare },
    { channel: 'Push', count: 1652, deliveryRate: '96.3%', icon: Smartphone },
  ];

  const templates = [
    { id: 1, name: 'Confirmare Comanda', channel: 'Email', status: 'Activ' },
    { id: 2, name: 'Alerta Stoc Scazut', channel: 'SMS', status: 'Activ' },
    { id: 3, name: 'Promotiе Noua', channel: 'Email', status: 'Draft' },
    { id: 4, name: 'Raspuns Urgent', channel: 'WhatsApp', status: 'Activ' },
  ];

  const getChannelIcon = (type) => {
    const icons = {
      'email': Mail,
      'sms': MessageSquare,
      'whatsapp': MessageSquare,
      'push': Smartphone,
    };
    return icons[type] || Bell;
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Notificari</h1>
          <p className="text-gray-500">Centrul de notificari si gestiunea comunicarii</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="centru" className="w-full">
          <TabsList className="bg-white border-b border-gray-200 rounded-none mb-6 grid grid-cols-4 w-full">
            <TabsTrigger value="centru" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Centru notificari
            </TabsTrigger>
            <TabsTrigger value="canale" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Statistici canale
            </TabsTrigger>
            <TabsTrigger value="template" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Template-uri
            </TabsTrigger>
            <TabsTrigger value="trimite" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600">
              Trimite notificare
            </TabsTrigger>
          </TabsList>

          {/* Notification Center Tab */}
          <TabsContent value="centru">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">Notificari recente</CardTitle>
                  <Button variant="outline" size="sm">Marcheaza toate ca citite</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {notifications.map((notif) => {
                    const Icon = getChannelIcon(notif.type);
                    return (
                      <div key={notif.id} className={`p-4 rounded-lg border flex items-start gap-4 ${notif.read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                        <Icon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                            {!notif.read && <Badge className="bg-blue-100 text-blue-800">Noua</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                          <p className="text-xs text-gray-500">{notif.date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Channel Stats Tab */}
          <TabsContent value="canale">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {channelStats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <Card key={idx} className="bg-white border-0 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-5 h-5 text-gray-600" />
                            <h4 className="font-semibold text-gray-900">{stat.channel}</h4>
                          </div>
                          <p className="text-3xl font-bold text-gray-900">{stat.count.toLocaleString()}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">{stat.deliveryRate}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">Rata livrare: {stat.deliveryRate}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="template">
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  + Template nou
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Template-uri disponibile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Nume</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Canal</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((template) => (
                        <tr key={template.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900">{template.name}</td>
                          <td className="py-3 px-4 text-gray-600">{template.channel}</td>
                          <td className="py-3 px-4">
                            <Badge className={template.status === 'Activ' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {template.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="outline" size="sm">Editeaza</Button>
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

          {/* Send Notification Tab */}
          <TabsContent value="trimite">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Trimite notificare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecteaza canal</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['Email', 'SMS', 'WhatsApp', 'Push'].map(channel => (
                      <Button key={channel} variant="outline" className="justify-start">
                        {channel}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option>Selecteaza template...</option>
                    <option>Confirmare Comanda</option>
                    <option>Alerta Stoc Scazut</option>
                    <option>Raspuns Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destinatari</label>
                  <Input placeholder="Selecteaza segment de clienti sau email individual" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subiect/Titlu</label>
                  <Input placeholder="Subiectul mesajului" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Continut</label>
                  <textarea rows="6" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Continutul notificarii..."></textarea>
                </div>

                <div className="flex gap-3">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <Send className="w-4 h-4" />
                    Trimite
                  </Button>
                  <Button variant="outline">Previeweaza</Button>
                  <Button variant="outline">Salveaza ca draft</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Notifications;
