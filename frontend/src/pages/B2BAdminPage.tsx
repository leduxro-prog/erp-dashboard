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
  Eye,
  FileCheck2,
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

interface B2BOrderRow {
  id: number;
  order_number: string;
  status: string;
  created_at: string;
  confirmed_at?: string | null;
  payment_method?: string;
  payment_status?: string;
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
  currency_code: string;
  smartbill_id?: string | null;
  customer: {
    id: number;
    company_name: string;
    cui?: string;
    email?: string;
    tier?: string;
    discount_percentage: number;
  };
  items_count: number;
  total_quantity: number;
  verified: boolean;
}

interface B2BOrderDetails extends B2BOrderRow {
  payment_due_date?: string;
  payment_terms_days: number;
  customer_type: string;
  notes?: string;
  internal_notes?: string;
  model: {
    seller: {
      company_name: string;
      cui: string;
      reg_com: string;
      address: string;
      email: string;
      phone: string;
      logo_url: string;
    };
    client: {
      company_name: string;
      cui?: string;
      reg_com?: string;
      address?: string;
      contact_person?: string;
      email?: string;
      phone?: string;
      tier?: string;
      customer_type: string;
    };
    payment: {
      method?: string;
      status?: string;
      due_date?: string;
      terms_days: number;
    };
    pricing: {
      subtotal: number;
      discount_amount: number;
      discount_percentage: number;
      vat_amount: number;
      total: number;
      currency_code: string;
    };
    items: Array<{
      id: number;
      product_id: number;
      product_name: string;
      sku: string;
      quantity_ordered: number;
      stock_local: number;
      stock_supplier: number;
      unit_price: number;
      total_price: number;
      discount_percent: number;
      stock_source: string;
    }>;
  };
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
      <div className="bg-slate-900 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-white">
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
        <div className="flex gap-2 self-end sm:self-auto">
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
      <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto whitespace-nowrap">
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
      <div className="p-4 sm:p-6">
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
  const [activeTab, setActiveTab] = useState<'customers' | 'registrations' | 'orders'>('customers');
  const [customers, setCustomers] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [orders, setOrders] = useState<B2BOrderRow[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<B2BOrderDetails | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [verifyLoadingId, setVerifyLoadingId] = useState<number | null>(null);
  const [proformaLoadingId, setProformaLoadingId] = useState<number | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);
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
    } else if (activeTab === 'orders') {
      loadOrders();
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

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/b2b-admin/orders', {
        params: { search },
      });
      setOrders(response.data?.data?.orders || []);
      if (selectedOrder) {
        const fresh = (response.data?.data?.orders || []).find(
          (order: B2BOrderRow) => order.id === selectedOrder.id,
        );
        if (!fresh) {
          setSelectedOrder(null);
        }
      }
    } catch (error) {
      console.error('Failed to load B2B orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetails = async (orderId: number) => {
    setOrderLoading(true);
    try {
      const response = await axios.get(`/api/v1/b2b-admin/orders/${orderId}`);
      setSelectedOrder(response.data?.data || null);
    } catch (error) {
      console.error('Failed to load B2B order details:', error);
      alert('Nu s-au putut încărca detaliile comenzii B2B');
    } finally {
      setOrderLoading(false);
    }
  };

  const handleVerifyOrder = async (orderId: number) => {
    const note = prompt('Notă verificare manuală (opțional):', 'Comandă verificată manual în ERP');
    if (note === null) return;

    setVerifyLoadingId(orderId);
    try {
      await axios.post(`/api/v1/b2b-admin/orders/${orderId}/verify`, {
        note,
      });
      await loadOrders();
      await loadOrderDetails(orderId);
      alert('Comanda a fost marcată ca verificată manual.');
    } catch (error: any) {
      console.error('Failed to verify order:', error);
      alert(error?.response?.data?.error || 'Nu s-a putut verifica comanda.');
    } finally {
      setVerifyLoadingId(null);
    }
  };

  const handleCreateProformaFromOrder = async (orderId: number) => {
    setProformaLoadingId(orderId);
    try {
      const response = await axios.post(`/api/v1/smartbill/proformas/from-b2b-order/${orderId}`, {
        dueInDays: 30,
      });

      const payload = response.data?.data || response.data;
      await loadOrders();
      await loadOrderDetails(orderId);
      alert(`Proforma SmartBill creată: ${payload?.proformaNumber || payload?.number || '-'}`);
    } catch (error: any) {
      console.error('Failed to create proforma from B2B order:', error);
      alert(
        error?.response?.data?.error?.message ||
          error?.response?.data?.error ||
          'Nu s-a putut genera proforma SmartBill.',
      );
    } finally {
      setProformaLoadingId(null);
    }
  };

  const handleDownloadOrderModelPdf = async (orderId: number, orderNumber: string) => {
    setPdfLoadingId(orderId);
    try {
      const response = await axios.get(`/api/v1/b2b-admin/orders/${orderId}/model-pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model_comanda_b2b_${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download B2B order model PDF:', error);
      alert('Nu s-a putut descărca PDF-ul modelului de comandă.');
    } finally {
      setPdfLoadingId(null);
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

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('ro-RO');
  };

  const formatMoney = (value: number, currency = 'RON') => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value || 0);
  };

  if (selectedCustomerId) {
    return (
      <div className="p-3 sm:p-6">
        <CustomerDetails
          id={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onRefresh={loadCustomers}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">B2B Management</h1>
          {(activeTab === 'customers' || activeTab === 'orders') && (
            <div className="flex w-full lg:w-auto gap-2">
              <input
                type="text"
                placeholder={
                  activeTab === 'orders' ? 'Caută comenzi B2B...' : 'Search customers...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) =>
                  e.key === 'Enter' && (activeTab === 'orders' ? loadOrders() : loadCustomers())
                }
                className="w-full lg:w-72 px-4 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={activeTab === 'orders' ? loadOrders : loadCustomers}
                className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition"
              >
                <RefreshCw size={18} className="text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto whitespace-nowrap">
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
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'orders'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Comenzi B2B ({orders.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
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
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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
          ) : activeTab === 'orders' ? (
            <div className="space-y-6">
              {loading ? (
                <p className="text-gray-500 text-center py-8">Se încarcă comenzile B2B...</p>
              ) : orders.length === 0 ? (
                <p className="text-gray-500 text-center py-12">Nu există comenzi B2B.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Comandă
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Client
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Plată
                        </th>
                        <th className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Total
                        </th>
                        <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Status
                        </th>
                        <th className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-3">
                          Acțiuni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-gray-900">{order.order_number}</p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(order.created_at)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">
                              {order.customer.company_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {order.customer.cui || '-'} • Tier {order.customer.tier || '-'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <p>{order.payment_method || '-'}</p>
                            <p className="text-xs text-gray-500">{order.payment_status || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            {formatMoney(order.total, order.currency_code)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex px-2 py-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 w-fit">
                                {order.status}
                              </span>
                              <span
                                className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-full w-fit ${
                                  order.verified
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {order.verified ? 'Verificată' : 'Neverificată'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => loadOrderDetails(order.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700"
                              >
                                <Eye size={14} /> Vezi Model
                              </button>
                              <button
                                onClick={() =>
                                  handleDownloadOrderModelPdf(order.id, order.order_number)
                                }
                                disabled={pdfLoadingId === order.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-700 rounded-md text-xs font-bold hover:bg-blue-50 disabled:opacity-50"
                              >
                                {pdfLoadingId === order.id ? 'PDF...' : 'PDF'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedOrder && (
                <div className="border border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Model Comandă B2B - {selectedOrder.order_number}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Creată: {formatDateTime(selectedOrder.created_at)} • Tip client:{' '}
                        {selectedOrder.customer_type}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold hover:bg-gray-100"
                      >
                        Printează Model
                      </button>
                      <button
                        onClick={() =>
                          handleDownloadOrderModelPdf(selectedOrder.id, selectedOrder.order_number)
                        }
                        disabled={pdfLoadingId === selectedOrder.id}
                        className="px-3 py-2 border border-blue-200 text-blue-700 rounded-md text-xs font-semibold hover:bg-blue-50 disabled:opacity-50"
                      >
                        {pdfLoadingId === selectedOrder.id
                          ? 'Generez PDF...'
                          : 'Descarcă PDF model'}
                      </button>
                      <button
                        onClick={() => handleVerifyOrder(selectedOrder.id)}
                        disabled={verifyLoadingId === selectedOrder.id || selectedOrder.verified}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {verifyLoadingId === selectedOrder.id
                          ? 'Se verifică...'
                          : selectedOrder.verified
                            ? 'Verificată manual'
                            : 'Marchează verificată'}
                      </button>
                      <button
                        onClick={() => handleCreateProformaFromOrder(selectedOrder.id)}
                        disabled={proformaLoadingId === selectedOrder.id || !selectedOrder.verified}
                        className="px-3 py-2 bg-orange-600 text-white rounded-md text-xs font-bold hover:bg-orange-700 disabled:opacity-50"
                      >
                        {proformaLoadingId === selectedOrder.id
                          ? 'Generez proforma...'
                          : 'Transformă în Proforma SmartBill'}
                      </button>
                    </div>
                  </div>

                  {orderLoading ? (
                    <p className="text-sm text-gray-500 p-6">Se încarcă modelul comenzii...</p>
                  ) : (
                    <div className="p-4 sm:p-6 space-y-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 border-b border-gray-200 pb-6">
                        <div className="flex items-center gap-4">
                          <img
                            src={selectedOrder.model.seller.logo_url}
                            alt="Ledux logo"
                            className="h-12 w-auto"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {selectedOrder.model.seller.company_name}
                            </p>
                            <p className="text-xs text-slate-600">
                              CUI: {selectedOrder.model.seller.cui} • RC:{' '}
                              {selectedOrder.model.seller.reg_com}
                            </p>
                            <p className="text-xs text-slate-600">
                              {selectedOrder.model.seller.address}
                            </p>
                            <p className="text-xs text-slate-600">
                              {selectedOrder.model.seller.email} •{' '}
                              {selectedOrder.model.seller.phone}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-slate-700 space-y-1">
                          <p>
                            <span className="font-semibold">Client:</span>{' '}
                            {selectedOrder.model.client.company_name}
                          </p>
                          <p>
                            <span className="font-semibold">CUI:</span>{' '}
                            {selectedOrder.model.client.cui || '-'}
                          </p>
                          <p>
                            <span className="font-semibold">Persoană contact:</span>{' '}
                            {selectedOrder.model.client.contact_person || '-'}
                          </p>
                          <p>
                            <span className="font-semibold">Email:</span>{' '}
                            {selectedOrder.model.client.email || '-'}
                          </p>
                          <p>
                            <span className="font-semibold">Tip client:</span>{' '}
                            {selectedOrder.customer_type}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-xs uppercase text-slate-500 font-bold">
                            Plată selectată
                          </p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {selectedOrder.model.payment.method || '-'}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-xs uppercase text-slate-500 font-bold">Scadență</p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {formatDateTime(selectedOrder.model.payment.due_date)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-xs uppercase text-slate-500 font-bold">
                            Discount client
                          </p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {selectedOrder.model.pricing.discount_percentage.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-500">
                                Produs
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-gray-500">
                                Cod produs
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">
                                Cant. comandată
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">
                                Stoc local
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">
                                Stoc furnizor
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">
                                Preț unitar
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-gray-500">
                                Preț total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {selectedOrder.model.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-3 py-2 text-sm text-slate-900 font-medium">
                                  {item.product_name}
                                </td>
                                <td className="px-3 py-2 text-sm text-slate-700">{item.sku}</td>
                                <td className="px-3 py-2 text-sm text-right">
                                  {item.quantity_ordered}
                                </td>
                                <td className="px-3 py-2 text-sm text-right">{item.stock_local}</td>
                                <td className="px-3 py-2 text-sm text-right">
                                  {item.stock_supplier}
                                </td>
                                <td className="px-3 py-2 text-sm text-right">
                                  {formatMoney(
                                    item.unit_price,
                                    selectedOrder.model.pricing.currency_code,
                                  )}
                                </td>
                                <td className="px-3 py-2 text-sm text-right font-semibold">
                                  {formatMoney(
                                    item.total_price,
                                    selectedOrder.model.pricing.currency_code,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="max-w-sm ml-auto space-y-2 text-sm w-full">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Subtotal</span>
                          <span className="font-semibold">
                            {formatMoney(
                              selectedOrder.model.pricing.subtotal,
                              selectedOrder.model.pricing.currency_code,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Discount final</span>
                          <span className="font-semibold text-emerald-700">
                            -
                            {formatMoney(
                              selectedOrder.model.pricing.discount_amount,
                              selectedOrder.model.pricing.currency_code,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">TVA</span>
                          <span className="font-semibold">
                            {formatMoney(
                              selectedOrder.model.pricing.vat_amount,
                              selectedOrder.model.pricing.currency_code,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2">
                          <span className="font-bold text-slate-900">Total</span>
                          <span className="font-black text-blue-700">
                            {formatMoney(
                              selectedOrder.model.pricing.total,
                              selectedOrder.model.pricing.currency_code,
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 border-t border-slate-200 pt-3 flex items-center gap-2">
                        <FileCheck2 size={14} />
                        Comanda trebuie verificată manual înainte de transformare în proforma
                        SmartBill.
                      </div>
                    </div>
                  )}
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
