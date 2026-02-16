import React, { useState } from 'react';
import { Plus, Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';

const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('history');

  const notifications = [
    { id: 1, type: 'Email', subject: 'Order confirmation', recipient: 'john@example.com', date: '2024-01-08', status: 'Sent' },
    { id: 2, type: 'SMS', subject: 'Payment received', recipient: '+40721234567', date: '2024-01-08', status: 'Sent' },
    { id: 3, type: 'Email', subject: 'Shipment tracking', recipient: 'jane@example.com', date: '2024-01-07', status: 'Failed' },
  ];

  const templates = [
    { id: 1, name: 'Order Confirmation', type: 'Email', created: '2024-01-01', usage: 245 },
    { id: 2, name: 'Shipment Alert', type: 'SMS', created: '2023-12-15', usage: 156 },
    { id: 3, name: 'Payment Reminder', type: 'Email', created: '2023-11-20', usage: 89 },
  ];

  const channelStats = [
    { channel: 'Email', sent: 4250, delivered: 4100, bounce_rate: '3.5%', open_rate: '32.1%' },
    { channel: 'SMS', sent: 1850, delivered: 1820, bounce_rate: '1.6%', open_rate: '68.4%' },
    { channel: 'Push', sent: 5200, delivered: 4980, bounce_rate: '4.2%', open_rate: '18.9%' },
  ];

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Notificari</h1>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Trimite Notificare
        </button>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'history', label: 'Istoric' },
            { id: 'templates', label: 'Sabloane' },
            { id: 'stats', label: 'Statistici' },
            { id: 'settings', label: 'Setari' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tip</th>
                  <th>Subiect</th>
                  <th>Recipient</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(notif => (
                  <tr key={notif.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {notif.type === 'Email' && <Mail size={16} className="text-blue-600" />}
                        {notif.type === 'SMS' && <MessageSquare size={16} className="text-green-600" />}
                        {notif.type === 'Push' && <Smartphone size={16} className="text-purple-600" />}
                        <span className="text-sm font-medium">{notif.type}</span>
                      </div>
                    </td>
                    <td className="font-semibold text-slate-900">{notif.subject}</td>
                    <td className="text-sm text-slate-600">{notif.recipient}</td>
                    <td className="text-sm text-slate-600">{notif.date}</td>
                    <td><span className={`${notif.status === 'Sent' ? 'badge-success' : 'badge-danger'}`}>{notif.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templates.map(tpl => (
            <div key={tpl.id} className="card">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-900">{tpl.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{tpl.type} • Creat: {tpl.created}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{tpl.usage}</p>
                  <p className="text-xs text-slate-600">utilizari</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn-secondary flex-1 text-sm">Editare</button>
                <button className="btn-secondary flex-1 text-sm">Previzualizare</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Trimise</th>
                  <th>Livrate</th>
                  <th>Rata Bounce</th>
                  <th>Open Rate</th>
                </tr>
              </thead>
              <tbody>
                {channelStats.map((stat, idx) => (
                  <tr key={idx}>
                    <td className="font-bold text-slate-900">{stat.channel}</td>
                    <td className="font-bold">{stat.sent}</td>
                    <td className="font-bold text-green-600">{stat.delivered}</td>
                    <td className="text-sm text-slate-600">{stat.bounce_rate}</td>
                    <td className="font-bold text-blue-600">{stat.open_rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3 className="section-title mb-6">Preferinte Notificari</h3>
          <div className="space-y-4">
            {[
              { name: 'Email Notifications', enabled: true },
              { name: 'SMS Alerts', enabled: true },
              { name: 'Push Notifications', enabled: false },
              { name: 'In-App Messages', enabled: true },
            ].map((pref, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded">
                <span className="font-medium text-slate-900">{pref.name}</span>
                <div className={`w-10 h-6 rounded-full cursor-pointer transition ${pref.enabled ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { NotificationsPage };
export default NotificationsPage;
