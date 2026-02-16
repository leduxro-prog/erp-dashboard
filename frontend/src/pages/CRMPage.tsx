import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { StrategicAnalysis } from '../components/CRM/StrategicAnalysis';

const CRMPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('customers');

  const customers = [
    { id: 1, name: 'John Smith', email: 'john@example.com', segment: 'VIP', ltv: 45000, last_order: '2024-01-08', status: 'Active' },
    { id: 2, name: 'Jane Doe', email: 'jane@example.com', segment: 'Premium', ltv: 28500, last_order: '2024-01-05', status: 'Active' },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', segment: 'Standard', ltv: 12400, last_order: '2023-12-20', status: 'Inactive' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', segment: 'VIP', ltv: 52000, last_order: '2024-01-07', status: 'Active' },
  ];

  const segments = [
    { id: 1, name: 'VIP Customers', rules: 'LTV > 40000', members: 12, avg_value: 48500 },
    { id: 2, name: 'Premium', rules: 'LTV 20000-40000', members: 28, avg_value: 31200 },
    { id: 3, name: 'Standard', rules: 'LTV 5000-20000', members: 95, avg_value: 12800 },
    { id: 4, name: 'At Risk', rules: 'No purchase > 6 months', members: 34, avg_value: 8500 },
  ];

  const loyaltyPrograms = [
    { id: 1, name: 'Gold Tier', benefits: '10% discount + free shipping', members: 45, active: true },
    { id: 2, name: 'Silver Tier', benefits: '5% discount', members: 120, active: true },
    { id: 3, name: 'Bronze Tier', benefits: 'Standard pricing', members: 250, active: true },
  ];

  const coupons = [
    { code: 'SALE20', discount: '20%', type: 'Percentage', usage: 125, limit: 500, valid_until: '2024-02-28' },
    { code: 'FREE50', discount: '50 RON', type: 'Fixed', usage: 45, limit: 100, valid_until: '2024-01-31' },
    { code: 'WELCOME10', discount: '10%', type: 'Percentage', usage: 234, limit: 1000, valid_until: '2024-12-31' },
  ];

  const communications = [
    { id: 1, type: 'Email', campaign: 'New Year Sale', sent: '2024-01-08', recipients: 2500, open_rate: '28.5%' },
    { id: 2, type: 'SMS', campaign: 'Flash Deal', sent: '2024-01-07', recipients: 1200, open_rate: '45.2%' },
    { id: 3, type: 'Email', campaign: 'Birthday Offers', sent: '2024-01-05', recipients: 350, open_rate: '52.1%' },
  ];

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">CRM & Fidelizare</h1>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Campanie Noua
        </button>
        <StrategicAnalysis clients={customers} />
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'customers', label: 'Clienți' },
            { id: 'segments', label: 'Segmente' },
            { id: 'loyalty', label: 'Fidelizare' },
            { id: 'coupons', label: 'Cupoane' },
            { id: 'communications', label: 'Comunicări' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nume</th>
                  <th>Email</th>
                  <th>Segment</th>
                  <th>Lifetime Value</th>
                  <th>Ultima Comanda</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(cust => (
                  <tr key={cust.id}>
                    <td className="font-bold text-slate-900">{cust.name}</td>
                    <td className="text-sm text-slate-600">{cust.email}</td>
                    <td><span className="badge-success">{cust.segment}</span></td>
                    <td className="font-bold">{cust.ltv.toLocaleString()} RON</td>
                    <td className="text-sm text-slate-600">{cust.last_order}</td>
                    <td><span className={`${cust.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>{cust.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Segments Tab */}
      {activeTab === 'segments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {segments.map(seg => (
            <div key={seg.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-900">{seg.name}</h3>
                <span className="badge-success">{seg.members}</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">{seg.rules}</p>
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-slate-600 text-sm">Avg Value</span>
                <span className="font-bold text-slate-900">{seg.avg_value.toLocaleString()} RON</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loyalty Tab */}
      {activeTab === 'loyalty' && (
        <div className="space-y-4">
          {loyaltyPrograms.map(prog => (
            <div key={prog.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{prog.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{prog.benefits}</p>
                </div>
                <span className={`${prog.active ? 'badge-success' : 'badge-danger'}`}>
                  {prog.active ? 'Activ' : 'Inactiv'}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900">{prog.members} membri</div>
            </div>
          ))}
        </div>
      )}

      {/* Coupons Tab */}
      {activeTab === 'coupons' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cod</th>
                  <th>Discount</th>
                  <th>Tip</th>
                  <th>Utilizari</th>
                  <th>Limita</th>
                  <th>Valid Pana</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(coup => (
                  <tr key={coup.code}>
                    <td className="font-bold font-mono text-slate-900">{coup.code}</td>
                    <td className="font-bold">{coup.discount}</td>
                    <td className="text-sm text-slate-600">{coup.type}</td>
                    <td className="font-bold">{coup.usage}</td>
                    <td className="font-bold">{coup.limit}</td>
                    <td className="text-sm text-slate-600">{coup.valid_until}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Communications Tab */}
      {activeTab === 'communications' && (
        <div className="space-y-4">
          {communications.map(comm => (
            <div key={comm.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{comm.campaign}</h3>
                  <p className="text-sm text-slate-600 mt-1">{comm.type} • {comm.sent}</p>
                </div>
                <span className="badge-success">{comm.open_rate}</span>
              </div>
              <div className="text-sm font-bold text-slate-900">{comm.recipients} recipienți</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { CRMPage };
export default CRMPage;
