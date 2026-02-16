import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { b2bApi } from '../../services/b2b-api';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, TrendingUp, CreditCard, Clock, XCircle } from 'lucide-react';

interface Payment {
  id: string;
  date: string;
  reference: string;
  reference_type: string;
  amount: number;
  type: 'invoice' | 'adjustment' | 'credit' | 'debit';
  status: 'completed' | 'pending' | 'failed';
  description: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

interface PaymentSummary {
  credit_limit: number;
  credit_available: number;
  credit_used: number;
  payment_terms_days: number;
  pending_orders: number;
  pending_orders_value: number;
}

export const B2BPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    type: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [page, filters]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [paymentsData, creditData] = await Promise.all([
        b2bApi.getPayments({ 
          page, 
          limit: 10,
          from: filters.from || undefined,
          to: filters.to || undefined,
          type: filters.type || undefined
        }),
        b2bApi.getCredit()
      ]);
      
      setPayments(paymentsData.payments);
      setTotalPages(paymentsData.pagination.total_pages || 1);
      setSummary(creditData as unknown as PaymentSummary);
    } catch (err) {
      console.error('Failed to fetch payments data:', err);
      setError('Nu am putut încărca datele plăților. Vă rugăm să încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice': return 'Factură';
      case 'adjustment': return 'Ajustare';
      case 'credit': return 'Credit';
      case 'debit': return 'Debit';
      default: return type;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'invoice': return 'bg-blue-100 text-blue-800';
      case 'adjustment': return 'bg-yellow-100 text-yellow-800';
      case 'credit': return 'bg-green-100 text-green-800';
      case 'debit': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500">Se încarcă istoricul plăților...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Istoric Plăți și Credit</h1>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Credit Utilizat</span>
              <CreditCard className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.credit_used)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              din {formatCurrency(summary.credit_limit)} limită
            </div>
            <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((summary.credit_used / summary.credit_limit) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Credit Disponibil</span>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.credit_available)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {summary.payment_terms_days} zile scadență medie
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Comenzi în curs</span>
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.pending_orders}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Valoare: {formatCurrency(summary.pending_orders_value)}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Restanțe</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(0)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Fără plăți întârziate
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h3 className="text-lg font-bold text-gray-900">Tranzacții recente</h3>
            
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={filters.to}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toate tipurile</option>
                <option value="invoice">Factură</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
                <option value="adjustment">Ajustare</option>
              </select>
              <button
                onClick={() => {
                  setFilters({ from: '', to: '', type: '' });
                  setPage(1);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                Resetează
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
            <button onClick={fetchData} className="mt-4 text-blue-600 font-bold hover:underline">Reîncearcă</button>
          </div>
        )}

        {!error && payments.length === 0 && !loading ? (
          <div className="p-12 text-center text-gray-500 italic">Nu există tranzacții înregistrate.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Referință</th>
                    <th className="px-6 py-4">Tip</th>
                    <th className="px-6 py-4 text-right">Sumă</th>
                    <th className="px-6 py-4 text-right">Sold După</th>
                    <th className="px-6 py-4">Descriere</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                        {payment.reference}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${getTypeBadgeClass(payment.type)}`}>
                          {getTypeLabel(payment.type)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-black ${
                        payment.type === 'credit' ? 'text-green-600' : 
                        payment.type === 'debit' || payment.type === 'invoice' ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {payment.type === 'credit' ? '+' : (payment.type === 'debit' || payment.type === 'invoice' ? '-' : '')}
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                        {formatCurrency(payment.balance_after)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={payment.description}>
                        {payment.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Pagina <span className="font-medium text-gray-900">{page}</span> din <span className="font-medium text-gray-900">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default B2BPaymentsPage;
