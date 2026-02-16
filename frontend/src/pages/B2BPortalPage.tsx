import React, { useState } from 'react';
import { Plus, CheckCircle, AlertCircle, ShoppingCart, CreditCard } from 'lucide-react';
import { apiClient } from '../services/api';

const B2BPortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('registrations');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch registrations on load
  React.useEffect(() => {
    if (activeTab === 'registrations') {
      fetchRegistrations();
    }
  }, [activeTab]);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      // In a real app, you'd use a configured axios instance with auth headers
      // For this demo, we assume the browser session has the cookie/token or we'd need to add it
      const response = await fetch('/api/v1/b2b/registrations', {
        headers: {
          'Authorization': `Bearer ${apiClient.getToken() || ''}`, // Example token usage
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRegistrations(data);
      }
    } catch (err) {
      console.error('Failed to fetch registrations', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      let body: any = { status: action };

      if (action === 'APPROVE') {
        // Simple defaults for now. In a real app, this would be a modal form.
        body = {
          status: 'APPROVED',
          approved_credit_limit: 10000,
          tier: 'Discovery', // Default tier
          payment_terms: 30,
          notes: 'Approved via Quick Action'
        };
      } else {
        const reason = window.prompt('Please provide a rejection reason:');
        if (!reason) return; // Cancelled
        body = {
          status: 'REJECTED',
          rejection_reason: reason
        };
      }

      const response = await fetch(`/api/v1/b2b/registrations/${id}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getToken() || ''}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Refresh list
        fetchRegistrations();
        alert(`Registration ${action}D successfully`);
      } else {
        alert('Action failed');
      }
    } catch (err) {
      console.error('Action failed', err);
      alert('Error performing action');
    }
  };

  const b2bCustomers = [
    { id: 1, company: 'ABC Corp', tier: 'Gold', contact: 'John Smith', credit_limit: 50000, used_credit: 35000, status: 'Active' },
    { id: 2, company: 'XYZ Ltd', tier: 'Silver', contact: 'Jane Doe', credit_limit: 25000, used_credit: 12000, status: 'Active' },
    { id: 3, company: 'Tech Inc', tier: 'Bronze', contact: 'Bob Johnson', credit_limit: 10000, used_credit: 8500, status: 'Active' },
  ];

  const savedCarts = [
    { id: 1, customer: 'ABC Corp', cart_name: 'Monthly Stock', items: 45, total: 15450, created: '2024-01-05' },
    { id: 2, customer: 'XYZ Ltd', cart_name: 'Q1 Order', items: 120, total: 45600, created: '2024-01-03' },
  ];

  const bulkOrders = [
    { id: '#BULK-2024-001', customer: 'ABC Corp', items: 150, total: 85400, status: 'Processing', date: '2024-01-08' },
    { id: '#BULK-2024-002', customer: 'Global Trade', items: 300, total: 125000, status: 'Shipped', date: '2024-01-06' },
  ];

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">B2B Portal</h1>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Nouă Cerere B2B
        </button>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'registrations', label: 'Inregistrări în Aşteptare' },
            { id: 'customers', label: 'Clienți B2B' },
            { id: 'credit', label: 'Gestiune Credit' },
            { id: 'carts', label: 'Coșuri Salvate' },
            { id: 'bulk', label: 'Comenzi în Vrac' },
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

      {/* Registrations Tab */}
      {activeTab === 'registrations' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Companie</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Data Inregistrării</th>
                  <th>Status</th>
                  <th>Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr>}
                {!loading && registrations.length === 0 && <tr><td colSpan={6} className="text-center py-4">No registrations found</td></tr>}
                {registrations.map(reg => (
                  <tr key={reg.id}>
                    <td className="font-bold text-slate-900">{reg.companyName}</td>
                    <td>{reg.contactPerson}</td>
                    <td className="text-sm text-slate-600">{reg.email}</td>
                    <td className="text-sm text-slate-600">{new Date(reg.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`${reg.status === 'PENDING' ? 'badge-warning' : reg.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>
                        {reg.status}
                      </span>
                    </td>
                    <td>
                      {reg.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(reg.id, 'APPROVE')}
                            className="text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            Aproba
                          </button>
                          <button
                            onClick={() => handleReview(reg.id, 'REJECT')}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Respinge
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Companie</th>
                  <th>Tier</th>
                  <th>Contact</th>
                  <th>Limita Credit</th>
                  <th>Credit Folosit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {b2bCustomers.map(cust => (
                  <tr key={cust.id}>
                    <td className="font-bold text-slate-900">{cust.company}</td>
                    <td><span className="badge-success">{cust.tier}</span></td>
                    <td>{cust.contact}</td>
                    <td className="font-bold">{cust.credit_limit.toLocaleString()} RON</td>
                    <td className="font-bold text-orange-600">{cust.used_credit.toLocaleString()} RON</td>
                    <td><span className="badge-success">{cust.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Tab */}
      {activeTab === 'credit' && (
        <div className="space-y-4">
          {b2bCustomers.map(cust => (
            <div key={cust.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{cust.company}</h3>
                  <p className="text-sm text-slate-600">{cust.contact}</p>
                </div>
                <span className="badge-success">{cust.tier}</span>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Credit Folosit</span>
                  <span className="font-bold">{Math.round((cust.used_credit / cust.credit_limit) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${(cust.used_credit / cust.credit_limit) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-slate-600 mt-2">
                  <span>{cust.used_credit.toLocaleString()} RON</span>
                  <span>{cust.credit_limit.toLocaleString()} RON</span>
                </div>
              </div>

              <button className="btn-secondary w-full text-sm">Ajustare Limita Credit</button>
            </div>
          ))}
        </div>
      )}

      {/* Carts Tab */}
      {activeTab === 'carts' && (
        <div className="space-y-4">
          {savedCarts.map(cart => (
            <div key={cart.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{cart.cart_name}</h3>
                  <p className="text-sm text-slate-600">{cart.customer} • {cart.created}</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{cart.total.toLocaleString()} RON</p>
              </div>
              <div className="flex justify-between items-center text-sm mb-3">
                <span className="text-slate-600">{cart.items} articole</span>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <ShoppingCart size={16} />
                  Deschide Coş
                </button>
                <button className="btn-secondary flex-1">Editare</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Orders Tab */}
      {activeTab === 'bulk' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nr. Comanda</th>
                  <th>Client</th>
                  <th>Articole</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {bulkOrders.map(order => (
                  <tr key={order.id}>
                    <td className="font-bold text-slate-900">{order.id}</td>
                    <td>{order.customer}</td>
                    <td className="font-bold">{order.items}</td>
                    <td className="font-bold">{order.total.toLocaleString()} RON</td>
                    <td><span className={`${order.status === 'Processing' ? 'badge-warning' : 'badge-success'}`}>{order.status}</span></td>
                    <td className="text-sm text-slate-600">{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export { B2BPortalPage };
export default B2BPortalPage;
