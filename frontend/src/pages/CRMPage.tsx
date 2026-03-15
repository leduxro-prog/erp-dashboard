import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import { StrategicAnalysis } from '../components/CRM/StrategicAnalysis';
import { crmService } from '@/services/crm.service';

const CRMPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('customers');

  // Real data fetching
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['crm', 'customers'],
    queryFn: () => crmService.getCustomers({ page: 1, limit: 100 }),
  });

  const { data: segments, isLoading: segmentsLoading } = useQuery({
    queryKey: ['crm', 'segments'],
    queryFn: () => crmService.getSegments(),
  });

  const { data: coupons, isLoading: couponsLoading } = useQuery({
    queryKey: ['crm', 'coupons'],
    queryFn: () => crmService.getCoupons(),
  });

  if (customersLoading || segmentsLoading || couponsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  const customers = customersData?.data || [];

  const loyaltyPrograms = [
    { id: 1, name: 'Gold Tier', benefits: '10% discount + free shipping', members: 45, active: true },
    { id: 2, name: 'Silver Tier', benefits: '5% discount', members: 120, active: true },
    { id: 3, name: 'Bronze Tier', benefits: 'Standard pricing', members: 250, active: true },
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
        <StrategicAnalysis clients={customers as any} />
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
                    <td className="font-bold text-slate-900">
                      {cust.firstName || cust.companyName} {cust.lastName || ''}
                    </td>
                    <td className="text-sm text-slate-600">{cust.email}</td>
                    <td><span className="badge-success">{cust.segments?.[0] || 'Standard'}</span></td>
                    <td className="font-bold">{(cust.totalPurchases || 0).toLocaleString()} RON</td>
                    <td className="text-sm text-slate-600">{cust.lastPurchaseDate ? new Date(cust.lastPurchaseDate).toLocaleDateString() : '-'}</td>
                    <td><span className="badge-success">Activ</span></td>
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
          {segments?.map(seg => (
            <div key={seg.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-900">{seg.name}</h3>
                <span className="badge-success">{seg.memberCount}</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">{seg.description}</p>
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-slate-600 text-sm">Target Value</span>
                <span className="font-bold text-slate-900">{(seg.criteria?.minSpent || 0).toLocaleString()} RON</span>
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
                {coupons?.map(coup => (
                  <tr key={coup.code}>
                    <td className="font-bold font-mono text-slate-900">{coup.code}</td>
                    <td className="font-bold">{coup.value}{coup.type === 'percentage' ? '%' : ' RON'}</td>
                    <td className="text-sm text-slate-600">{coup.type}</td>
                    <td className="font-bold">{coup.currentRedemptions}</td>
                    <td className="font-bold">{coup.maxRedemptions || '∞'}</td>
                    <td className="text-sm text-slate-600">{new Date(coup.expiresAt).toLocaleDateString()}</td>
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
