import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { b2bApi } from '../../services/b2b-api';
import { 
  Package, Search, Filter, Loader2, AlertCircle, 
  ShoppingBag, ArrowUpRight, ChevronRight, ChevronLeft
} from 'lucide-react';
import { ORDER_STATUS_CONFIG } from '../../constants/b2b-portal';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  currency: string;
}

export const B2BOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    loadOrders();
  }, [page, filterStatus]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit };
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      
      const data = await b2bApi.getOrders(params);
      setOrders(data.orders || []);
      setTotalPages(data.total_pages || Math.ceil((data.total || 0) / limit) || 1);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Nu am putut încărca comenzile. Vă rugăm să încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'RON') => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo(0, 0);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-xl shadow-sm border border-gray-100">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500 font-medium">Se încarcă comenzile tale...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comenzile mele</h1>
          <p className="text-gray-500 mt-1">Istoricul și statusul achizițiilor tale</p>
        </div>
        <button
          onClick={() => navigate('/b2b-portal/catalog')}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <ShoppingBag className="w-4 h-4 mr-2" />
          Comandă Nouă
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <p className="text-sm text-red-700">{error}</p>
            <button 
              onClick={loadOrders}
              className="ml-auto text-sm font-medium text-red-700 hover:text-red-800 underline"
            >
              Reîncearcă
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Caută după nr. comandă..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Toate statusurile</option>
              {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Nu am găsit comenzi</h3>
            <p className="text-gray-500 mt-1 max-w-xs mx-auto">
              {searchTerm || filterStatus !== 'all' 
                ? 'Încearcă să schimbi filtrele sau termenii de căutare.' 
                : 'Nu ai plasat nicio comandă încă. Explorează catalogul nostru pentru a începe.'}
            </p>
            {searchTerm || filterStatus !== 'all' ? (
              <button 
                onClick={() => { setSearchTerm(''); setFilterStatus('all'); setPage(1); }}
                className="mt-4 text-blue-600 font-medium hover:text-blue-700"
              >
                Resetează filtrele
              </button>
            ) : (
              <button 
                onClick={() => navigate('/b2b-portal/catalog')}
                className="mt-4 text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 mx-auto"
              >
                Mergi la catalog <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Nr. Comandă</th>
                    <th className="px-6 py-4 font-semibold">Dată plasare</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Valoare Totală</th>
                    <th className="px-6 py-4 font-semibold text-center">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const status = ORDER_STATUS_CONFIG[order.status.toLowerCase()] || ORDER_STATUS_CONFIG.pending;
                    const StatusIcon = status.icon;
                    
                    return (
                      <tr 
                        key={order.id} 
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/b2b-portal/orders/${order.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                              <Package className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
                            </div>
                            <span className="text-sm font-bold text-gray-900">#{order.orderNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right font-black">
                          {formatCurrency(order.totalAmount, order.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <button
                              className="p-2 text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-all"
                              title="Vezi detalii"
                            >
                              <ArrowUpRight className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Pagina <span className="font-medium text-gray-900">{page}</span> din <span className="font-medium text-gray-900">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1 || loading}
                    className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
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
