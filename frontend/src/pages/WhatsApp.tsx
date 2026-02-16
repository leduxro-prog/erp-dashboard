import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Plus, Clock, CheckCircle } from 'lucide-react';

const WhatsApp = () => {
  const [selectedChat, setSelectedChat] = useState(1);
  const [messageText, setMessageText] = useState('');

  const conversations = [
    { id: 1, name: 'SC Lux Events SRL', number: '+40721234567', lastMessage: 'Aveti LED RGB 5050 in stoc?', lastTime: '14:35', unread: 2, avatar: '🏢' },
    { id: 2, name: 'Electro Pro SA', number: '+40721234568', lastMessage: 'Multumesc pentru oferta', lastTime: '13:20', unread: 0, avatar: '⚡' },
    { id: 3, name: 'Design Tech Studio', number: '+40721234569', lastMessage: 'Cand se livreaza?', lastTime: '12:15', unread: 1, avatar: '🎨' },
    { id: 4, name: 'Club Night Life', number: '+40721234570', lastMessage: 'OK, perfect!', lastTime: '11:00', unread: 0, avatar: '🎭' },
  ];

  const messages = selectedChat === 1 ? [
    { id: 1, sender: 'client', name: 'SC Lux Events', text: 'Buna! Aveti LED RGB 5050 in stoc?', time: '14:30' },
    { id: 2, sender: 'us', name: 'CYPHER ERP', text: 'Buna! Da, avem 450 bucati disponibile.', time: '14:32' },
    { id: 3, sender: 'client', name: 'SC Lux Events', text: 'Excelent! Care este pretul?', time: '14:33' },
    { id: 4, sender: 'us', name: 'CYPHER ERP', text: 'Pret: 12.50 RON/buc. Vreti sa plasati o comanda?', time: '14:35' },
    { id: 5, sender: 'client', name: 'SC Lux Events', text: 'Aveti LED RGB 5050 in stoc?', time: '14:35' },
  ] : [
    { id: 1, sender: 'us', name: 'CYPHER ERP', text: 'Multumim pentru comanda!', time: '12:00' },
    { id: 2, sender: 'client', name: 'Electro Pro SA', text: 'Multumesc pentru oferta', time: '13:20' },
  ];

  const templates = [
    { id: 1, text: 'Buna! Cum iti pot ajuta?' },
    { id: 2, text: 'Multumim pentru comanda ta! Comanda va fi livrata in 2-3 zile.' },
    { id: 3, text: 'Poti face plata prin transfer bancar.' },
    { id: 4, text: 'Avem stoc disponibil, cand doresti livrarea?' },
  ];

  const stats = [
    { label: 'Conversatii active', value: 12, icon: MessageCircle },
    { label: 'Mesaje astazi', value: 48, icon: Send },
    { label: 'Timp mediu raspuns', value: '5m', icon: Clock },
    { label: 'Rata inchidere', value: '87%', icon: CheckCircle },
  ];

  const selectedConversation = conversations.find(c => c.id === selectedChat);

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">WhatsApp Business</h1>
          <p className="text-gray-500">Gestiunea conversatiilor cu clientii</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx} className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <Icon className="w-5 h-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Chat Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen max-h-96">
          {/* Conversations List */}
          <Card className="bg-white border-0 shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="border-b border-gray-200 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-gray-900">Conversatii</CardTitle>
                <Badge className="bg-blue-100 text-blue-800">{conversations.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedChat(conv.id)}
                  className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${selectedChat === conv.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl">{conv.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-900 truncate">{conv.name}</p>
                        <span className="text-xs text-gray-500">{conv.lastTime}</span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                      {conv.unread > 0 && (
                        <Badge className="mt-1 bg-blue-100 text-blue-800 text-xs">{conv.unread} noi</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Messages */}
            <Card className="bg-white border-0 shadow-sm flex-1 overflow-hidden flex flex-col">
              <CardHeader className="border-b border-gray-200 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedConversation?.name}</h3>
                  <p className="text-sm text-gray-600">{selectedConversation?.number}</p>
                </div>
                <Button variant="outline" size="sm">Atribuie agent</Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'us' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs p-3 rounded-lg ${msg.sender === 'us' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <p className="text-sm">{msg.text}</p>
                      <p className={`text-xs mt-1 ${msg.sender === 'us' ? 'text-blue-100' : 'text-gray-500'}`}>{msg.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Message Input */}
            <div className="space-y-3">
              {/* Templates */}
              <div className="grid grid-cols-2 gap-2">
                {templates.slice(0, 2).map(template => (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setMessageText(template.text)}
                    className="text-xs text-left justify-start h-auto py-2 px-3"
                  >
                    {template.text.substring(0, 30)}...
                  </Button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Scrie mesaj..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1"
                />
                <Button className="bg-green-600 hover:bg-green-700 text-white px-4">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsApp;
