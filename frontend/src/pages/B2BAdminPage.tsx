import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Building2,
  Mail,
  CreditCard,
  Shield,
  History,
  Star,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  FileText,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';

interface CustomerDetailsProps {
  id: number;
  onClose: () => void;
  onRefresh: () => void;
}

interface TopCustomerRow {
  id: number;
  company_name: string;
  email: string;
  tier: string;
  revenue: number;
  estimated_profit: number;
  estimated_margin_pct: number;
  unpaid_total: number;
  credit_used: number;
  orders_count: number;
  profitability_method: 'item_cost' | 'estimated_fallback_global_ratio';
}

const CustomerDetails: React.FC<CustomerDetailsProps> = ({ id, onClose, onRefresh }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'profile' | 'credit' | 'orders' | 'quotations' | 'invoices' | 'favorites' | 'recommended'
  >('profile');
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/v1/b2b-admin/customers/${id}`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustCredit = async () => {
    if (!canManage) return;
    const newLimit = prompt('New credit limit (RON):', data?.customer?.credit_limit);
    const reason = prompt('Reason for adjustment:');

    if (!newLimit || !reason) return;

    try {
      await axios.patch(`/api/v1/b2b-admin/customers/${id}/credit`, {
        credit_limit: parseFloat(newLimit),
        reason,
      });
      fetchDetails();
      onRefresh();
    } catch (error) {
      alert('Failed to adjust credit');
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-500">Loading customer profile...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Customer not found.</div>;

  const {
    customer,
    orders,
    quotations,
    creditHistory,
    favorites,
    recommendedProducts,
    unpaidInvoices,
    financialSummary,
  } = data;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold">{customer.company_name}</h2>
            <p className="text-slate-400 text-xs">
              ID: #{customer.id} • CUI: {customer.cui}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDetails} className="p-2 hover:bg-slate-800 rounded-full transition">
            <RefreshCw size={18} />
          </button>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              customer.status === 'ACTIVE'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {customer.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
        {[
          { id: 'profile', label: 'Profil Comercial', icon: Building2 },
          { id: 'credit', label: 'Credit & Plăți', icon: CreditCard },
          { id: 'orders', label: 'Comenzi', icon: History },
          { id: 'quotations', label: 'Oferte', icon: FileText },
          { id: 'invoices', label: 'Facturi Neplătite', icon: AlertTriangle },
          { id: 'favorites', label: 'Favorite', icon: Star },
          { id: 'recommended', label: 'Recomandate', icon: CheckCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'profile' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  Informații Contact
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-gray-700">
                    <Mail size={16} className="text-gray-400" />
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Building2 size={16} className="text-gray-400" />
                    <span>{customer.contact_person}</span>
                  </div>
                  <div className="ml-7 text-sm text-gray-500">{customer.phone}</div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  Reguli Comerciale
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-blue-700 font-medium">Tier Client</span>
                    <span className="font-bold text-blue-800">{customer.tier}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600 font-medium">Discount Implicit</span>
                    <span className="font-bold text-gray-900">
                      {customer.discount_percentage || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary Widget */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                Situație Financiară
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Total Neplătit
                    </span>
                    <AlertTriangle size={14} className="text-slate-400" />
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {financialSummary?.total_unpaid?.toLocaleString()} RON
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {financialSummary?.unpaid_count} facturi în așteptare
                  </p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-red-600 uppercase">
                      Din care Restant
                    </span>
                    <XCircle size={14} className="text-red-400" />
                  </div>
                  <p className="text-xl font-bold text-red-700">
                    {financialSummary?.total_overdue?.toLocaleString()} RON
                  </p>
                  <p className="text-[10px] text-red-500 mt-1">Termen de plată depășit</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-green-600 uppercase">
                      Volume Totale
                    </span>
                    <TrendingUp size={14} className="text-green-400" />
                  </div>
                  <p className="text-xl font-bold text-green-700">
                    {customer.total_spent?.toLocaleString()} RON
                  </p>
                  <p className="text-[10px] text-green-500 mt-1">
                    {customer.total_orders} comenzi finalizate
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'credit' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Limită Credit</p>
                <p className="text-2xl font-bold text-slate-900">
                  {customer.credit_limit?.toLocaleString()} RON
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Credit Utilizat</p>
                <p className="text-2xl font-bold text-orange-600">
                  {customer.credit_used?.toLocaleString()} RON
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Credit Disponibil</p>
                <p className="text-2xl font-bold text-green-600">
                  {(customer.credit_limit - customer.credit_used)?.toLocaleString()} RON
                </p>
              </div>
            </div>

            {canManage && (
              <div className="flex justify-end">
                <button
                  onClick={handleAdjustCredit}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <Shield size={16} /> Ajustează Limita de Credit
                </button>
              </div>
            )}

            <div className="mt-8">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                Istoric Modificări Credit
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Dată
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Anterior
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Nou
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Modificat de
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Motiv
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {creditHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400">
                          Nicio modificare înregistrată.
                        </td>
                      </tr>
                    ) : (
                      creditHistory.map((h: any) => (
                        <tr key={h.id} className="text-sm">
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(h.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {h.previous_limit?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-bold">{h.new_limit?.toLocaleString()}</td>
                          <td className="px-4 py-3">{h.admin_name || 'System'}</td>
                          <td className="px-4 py-3 italic text-gray-600">{h.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Nr. Comandă
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Dată
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400">
                      Nicio comandă găsită.
                    </td>
                  </tr>
                ) : (
                  orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">
                        #{order.order_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        {order.total?.toLocaleString()} {order.currency_code}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'quotations' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Nr. Ofertă
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Dată
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400">
                      Nicio ofertă găsită.
                    </td>
                  </tr>
                ) : (
                  quotations.map((q: any) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-purple-600">
                        #{q.quote_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(q.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        {q.total_amount?.toLocaleString()} RON
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {favorites.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-gray-400 italic">
                Nu există produse marcate ca favorite.
              </div>
            ) : (
              favorites.map((fav: any) => (
                <div
                  key={fav.id}
                  className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:shadow-md transition"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Star size={20} className="text-yellow-500 fill-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900">{fav.name}</h4>
                    <p className="text-xs text-gray-500">{fav.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">
                      {fav.base_price?.toLocaleString()} RON
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'recommended' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!recommendedProducts || recommendedProducts.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-gray-400 italic">
                Nu există recomandări disponibile momentan.
              </div>
            ) : (
              recommendedProducts.map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:shadow-md transition"
                >
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-gray-900">{product.name}</h4>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Achiziții client: {product.purchase_count || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-700">
                      {Number(product.base_price || 0).toLocaleString()} RON
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold">Facturi Neplătite</p>
                <p className="text-2xl font-bold text-slate-900">
                  {Number(financialSummary?.unpaid_count || 0)}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs text-orange-600 uppercase font-bold">Total Neplătit</p>
                <p className="text-2xl font-bold text-orange-700">
                  {Number(financialSummary?.total_unpaid || 0).toLocaleString()} RON
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs text-red-600 uppercase font-bold">Total Restant</p>
                <p className="text-2xl font-bold text-red-700">
                  {Number(financialSummary?.total_overdue || 0).toLocaleString()} RON
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                      Nr. Factură/Comandă
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                      Scadență
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                      Zile întârziere
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {!unpaidInvoices || unpaidInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                        Nu există facturi neplătite.
                      </td>
                    </tr>
                  ) : (
                    unpaidInvoices.map((invoice: any) => (
                      <tr key={invoice.id}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          #{invoice.order_number || invoice.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {invoice.payment_due_date
                            ? new Date(invoice.payment_due_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                            {invoice.payment_status || 'UNPAID'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {Number(invoice.days_overdue || 0) > 0
                            ? Number(invoice.days_overdue)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                          {Number(invoice.total_amount || 0).toLocaleString()}{' '}
                          {invoice.currency_code || 'RON'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const B2BAdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'registrations'>('customers');
  const [customers, setCustomers] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomerRow[]>([]);
  const [topMetric, setTopMetric] = useState<
    'revenue' | 'profit' | 'margin' | 'unpaid' | 'credit_used'
  >('revenue');
  const [topDays, setTopDays] = useState<7 | 30 | 90 | 365>(30);
  const [topLoading, setTopLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    if (activeTab === 'customers') {
      loadCustomers();
    } else {
      loadRegistrations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'customers') {
      loadTopCustomers();
    }
  }, [activeTab, topMetric, topDays]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/b2b-admin/customers', {
        params: { search },
      });
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/b2b-admin/registrations');
      setRegistrations(response.data.registrations || []);
    } catch (error) {
      console.error('Failed to load registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTopCustomers = async () => {
    setTopLoading(true);
    try {
      const response = await axios.get('/api/v1/b2b-admin/analytics/top-customers', {
        params: {
          metric: topMetric,
          days: topDays,
          limit: 5,
        },
      });
      setTopCustomers(response.data?.topCustomers || []);
    } catch (error) {
      console.error('Failed to load top customers analytics:', error);
    } finally {
      setTopLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!canManage) return;
    if (!confirm('Approve this registration?')) return;

    try {
      const response = await axios.post(`/api/v1/b2b-admin/registrations/${id}/approve`, {
        credit_limit: 50000,
        tier: 'SILVER',
      });
      alert(`Approved! Temporary password: ${response.data.temporary_password}`);
      loadRegistrations();
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Failed to approve registration');
    }
  };

  const handleReject = async (id: number) => {
    if (!canManage) return;
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    try {
      await axios.post(`/api/v1/b2b-admin/registrations/${id}/reject`, { reason });
      alert('Registration rejected');
      loadRegistrations();
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Failed to reject registration');
    }
  };

  if (selectedCustomerId) {
    return (
      <div className="p-6">
        <CustomerDetails
          id={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onRefresh={loadCustomers}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">B2B Management</h1>
          {activeTab === 'customers' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && loadCustomers()}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={loadCustomers}
                className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition"
              >
                <RefreshCw size={18} className="text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'customers'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Customers ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'registrations'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending Registrations ({registrations.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'customers' ? (
            <div>
              <div className="mb-6 rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp size={16} className="text-blue-600" />
                      Top 5 Clienți
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Clasament dinamic după metrică (cu estimare profitabilitate unde lipsesc
                      costurile reale pe produs).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={topMetric}
                      onChange={(e) => setTopMetric(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-xs font-medium bg-white"
                    >
                      <option value="revenue">După Venit</option>
                      <option value="profit">După Profit Estimat</option>
                      <option value="margin">După Marjă Estimată %</option>
                      <option value="unpaid">După Expunere Neplătită</option>
                      <option value="credit_used">După Credit Folosit</option>
                    </select>
                    <select
                      value={String(topDays)}
                      onChange={(e) => setTopDays(Number(e.target.value) as 7 | 30 | 90 | 365)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-xs font-medium bg-white"
                    >
                      <option value="7">Ultimele 7 zile</option>
                      <option value="30">Ultimele 30 zile</option>
                      <option value="90">Ultimele 90 zile</option>
                      <option value="365">Ultimele 365 zile</option>
                    </select>
                    <button
                      onClick={loadTopCustomers}
                      className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-md"
                    >
                      Refresh Top
                    </button>
                  </div>
                </div>

                {topLoading ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Se calculează topul...</p>
                ) : topCustomers.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">
                    Nu există date suficiente pentru perioada selectată.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">
                            Client
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">
                            Venit
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">
                            Profit Est.
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">
                            Marjă Est.
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">
                            Neplătit
                          </th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">
                            Credit Folosit
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {topCustomers.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-sm font-bold text-slate-700">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {row.company_name}
                              </p>
                              <p className="text-xs text-slate-500">{row.email || '-'}</p>
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">
                              {Number(row.revenue || 0).toLocaleString()} RON
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-emerald-700">
                              {Number(row.estimated_profit || 0).toLocaleString()} RON
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-indigo-700">
                              {Number(row.estimated_margin_pct || 0).toFixed(2)}%
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-orange-700">
                              {Number(row.unpaid_total || 0).toLocaleString()} RON
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-rose-700">
                              {Number(row.credit_used || 0).toLocaleString()} RON
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Customers Table */}
              {loading ? (
                <p className="text-gray-500 text-center py-8">Loading customers...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Company
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Email
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          CUI
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Tier
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Limită Credit
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Credit Folosit
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Status
                        </th>
                        <th className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {customers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 text-sm font-bold text-gray-900">
                            {customer.company_name}
                          </td>
                          <td className="py-4 text-sm text-gray-500">{customer.email}</td>
                          <td className="py-4 text-sm text-gray-500">{customer.cui}</td>
                          <td className="py-4">
                            <span className="inline-flex px-2 py-1 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
                              {customer.tier}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-gray-900 font-medium">
                            {customer.credit_limit?.toLocaleString()} RON
                          </td>
                          <td className="py-4 text-sm text-orange-700 font-medium">
                            {Number(customer.credit_used || 0).toLocaleString()} RON
                          </td>
                          <td className="py-4">
                            <span
                              className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-full ${
                                customer.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {customer.status}
                            </span>
                          </td>
                          <td className="py-4 text-sm text-right">
                            <button
                              onClick={() => setSelectedCustomerId(customer.id)}
                              className="text-blue-600 hover:text-blue-800 font-bold"
                            >
                              View 360
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Registrations Table */}
              {loading ? (
                <p className="text-gray-500 text-center py-8">Loading registrations...</p>
              ) : registrations.length === 0 ? (
                <p className="text-gray-500 text-center py-12">No pending registrations</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Company
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          CUI
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Email
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Contact
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Date
                        </th>
                        <th className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {registrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 text-sm font-bold text-gray-900">
                            {reg.company_name}
                          </td>
                          <td className="py-4 text-sm text-gray-500">{reg.cui}</td>
                          <td className="py-4 text-sm text-gray-500">{reg.email}</td>
                          <td className="py-4 text-sm text-gray-500">{reg.contact_person}</td>
                          <td className="py-4 text-sm text-gray-500">
                            {new Date(reg.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 text-sm text-right space-x-2">
                            {canManage ? (
                              <>
                                <button
                                  onClick={() => handleApprove(reg.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(reg.id)}
                                  className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-gray-400 italic text-xs">View Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
