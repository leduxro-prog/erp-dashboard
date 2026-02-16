import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Send,
  Check,
  X,
  Download,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Edit,
  ShoppingCart,
} from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/ui/KPICard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient } from '@/services/api';
import { CreateQuoteForm } from '@/components/quotations/CreateQuoteForm';

type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'converted';

interface QuoteItem {
  id: number;
  quoteId: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  totalPrice: number;
}

interface Quote {
  id: number;
  quoteNumber: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  status: QuoteStatus;
  quoteDate: string;
  expiryDate: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currencyCode: string;
  notes?: string;
  items: QuoteItem[];
  viewedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  declinedReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface QuotesResponse {
  success: boolean;
  data: Quote[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const statusMap: Record<
  QuoteStatus,
  { label: string; badge: 'pending' | 'processing' | 'completed' | 'error' }
> = {
  draft: { label: 'Ciornă', badge: 'pending' },
  sent: { label: 'Trimisă', badge: 'processing' },
  viewed: { label: 'Vizualizată', badge: 'processing' },
  accepted: { label: 'Acceptată', badge: 'completed' },
  declined: { label: 'Refuzată', badge: 'error' },
  expired: { label: 'Expirată', badge: 'error' },
  converted: { label: 'Convertită', badge: 'completed' },
};

export function QuotationsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await apiClient.get<QuotesResponse>(`/quotations?${params.toString()}`);

      const data = (response as any)?.data || response;
      setQuotes(data.data || data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Eroare la încărcarea ofertelor');
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleSendQuote = async (quoteId: number) => {
    try {
      await apiClient.post(`/quotations/${quoteId}/send`, {});
      fetchQuotes();
    } catch (err: any) {
      alert(err.message || 'Eroare la trimiterea ofertei');
    }
  };

  const handleAcceptQuote = async (quoteId: number) => {
    try {
      await apiClient.post(`/quotations/${quoteId}/accept`, {});
      fetchQuotes();
    } catch (err: any) {
      alert(err.message || 'Eroare la acceptarea ofertei');
    }
  };

  const handleRejectQuote = async (quoteId: number) => {
    const reason = prompt('Motiv refuz:');
    if (!reason) return;

    try {
      await apiClient.post(`/quotations/${quoteId}/reject`, { reason });
      fetchQuotes();
    } catch (err: any) {
      alert(err.message || 'Eroare la refuzarea ofertei');
    }
  };

  const handleConvertToOrder = async (quoteId: number) => {
    if (!confirm('Converti această ofertă în comandă?')) return;

    try {
      await apiClient.post(`/quotations/${quoteId}/convert`, {});
      fetchQuotes();
      alert('Oferta a fost convertită în comandă cu succes!');
    } catch (err: any) {
      alert(err.message || 'Eroare la convertirea ofertei');
    }
  };

  const handleDownloadPdf = async (quoteId: number, quoteNumber: string) => {
    try {
      const response = await fetch(`${apiClient.baseURL}/quotations/${quoteId}/pdf`, {
        headers: {
          Authorization: `Bearer ${apiClient.getToken()}`,
        },
      });

      if (!response.ok) throw new Error('Eroare la descărcarea PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oferta_${quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Eroare la descărcarea PDF');
    }
  };

  const draftCount = quotes.filter((q) => q.status === 'draft').length;
  const sentCount = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').length;
  const acceptedCount = quotes.filter((q) => q.status === 'accepted').length;
  const convertedCount = quotes.filter((q) => q.status === 'converted').length;

  const columns: Column<Quote>[] = [
    {
      key: 'quoteNumber',
      label: 'Nr. Ofertă',
      sortable: true,
      render: (value) => (
        <span className="font-mono font-medium text-blue-400">{value as string}</span>
      ),
    },
    {
      key: 'customerName',
      label: 'Client',
      sortable: true,
    },
    {
      key: 'quoteDate',
      label: 'Data',
      sortable: true,
      render: (value) => new Date(value as string).toLocaleDateString('ro-RO'),
    },
    {
      key: 'expiryDate',
      label: 'Expirare',
      sortable: true,
      render: (value) => {
        const date = new Date(value as string);
        const isExpired = date < new Date();
        return (
          <span className={isExpired ? 'text-red-400' : 'text-gray-300'}>
            {date.toLocaleDateString('ro-RO')}
          </span>
        );
      },
    },
    {
      key: 'totalAmount',
      label: 'Total',
      sortable: true,
      render: (value, row) => (
        <span className="font-medium text-green-400">
          {(value as number).toLocaleString('ro-RO', { minimumFractionDigits: 2 })}{' '}
          {row.currencyCode}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const status = value as QuoteStatus;
        const config = statusMap[status];
        return <StatusBadge status={config.badge} label={config.label} />;
      },
    },
    {
      key: 'id',
      label: 'Acțiuni',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedQuote(row)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400"
            title="Vizualizare"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => handleDownloadPdf(row.id, row.quoteNumber)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400"
            title="Descarcă PDF"
          >
            <Download size={16} />
          </button>
          {row.status === 'draft' && (
            <button
              onClick={() => handleSendQuote(row.id)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400"
              title="Trimite"
            >
              <Send size={16} />
            </button>
          )}
          {(row.status === 'sent' || row.status === 'viewed') && (
            <>
              <button
                onClick={() => handleAcceptQuote(row.id)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400"
                title="Acceptă"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => handleRejectQuote(row.id)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                title="Refuză"
              >
                <X size={16} />
              </button>
            </>
          )}
          {row.status === 'accepted' && (
            <button
              onClick={() => handleConvertToOrder(row.id)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-purple-400"
              title="Converteste in comanda"
            >
              <ShoppingCart size={16} />
            </button>
          )}
          {['draft', 'sent', 'viewed', 'accepted'].includes(row.status) && (
            <button
              onClick={() => setSelectedQuote(row)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-orange-400"
              title="Genereaza Proforma SmartBill"
            >
              <FileText size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Oferte</h1>
          <p className="text-gray-300 mt-1">
            Gestionează ofertele pentru clienți — {total.toLocaleString()} oferte
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={fetchQuotes}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizează
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
            Ofertă Nouă
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          icon={<FileText size={20} />}
          title="Ciorne"
          value={draftCount.toString()}
          color="default"
        />
        <KPICard
          icon={<Send size={20} />}
          title="Trimise"
          value={sentCount.toString()}
          color="warning"
        />
        <KPICard
          icon={<Check size={20} />}
          title="Acceptate"
          value={acceptedCount.toString()}
          color="success"
        />
        <KPICard
          icon={<ShoppingCart size={20} />}
          title="Convertite"
          value={convertedCount.toString()}
          color="success"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută după nr. ofertă sau client..."
            className="w-full pl-10 pr-4 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Toate statusurile</option>
          <option value="draft">Ciornă</option>
          <option value="sent">Trimise</option>
          <option value="viewed">Vizualizate</option>
          <option value="accepted">Acceptate</option>
          <option value="declined">Refuzate</option>
          <option value="expired">Expirate</option>
          <option value="converted">Convertite</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<FileText size={48} />}
          title={search || statusFilter !== 'all' ? 'Nu s-au găsit oferte' : 'Nu există oferte'}
          description={
            search || statusFilter !== 'all'
              ? 'Încearcă să modifici filtrele de căutare'
              : 'Creează prima ofertă pentru clienții tăi'
          }
          variant="compact"
        />
      ) : (
        <>
          <DataTable columns={columns} data={quotes} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-300">
                Pagina {page} din {totalPages} ({total.toLocaleString()} oferte)
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Următorul
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quote Details Modal */}
      {selectedQuote && (
        <QuoteDetailsModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onRefresh={fetchQuotes}
        />
      )}

      {/* Create Quote Modal */}
      {showCreateModal && (
        <CreateQuoteForm
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchQuotes();
          }}
        />
      )}
    </div>
  );
}

// Quote Details Modal Component
function QuoteDetailsModal({
  quote,
  onClose,
  onRefresh,
}: {
  quote: Quote;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [proformaLoading, setProformaLoading] = useState(false);
  const [proformaResult, setProformaResult] = useState<{
    success: boolean;
    message: string;
    proformaNumber?: string;
  } | null>(null);

  const handleGenerateProforma = async () => {
    if (!confirm('Generezi proforma SmartBill pentru această ofertă?')) return;

    setProformaLoading(true);
    setProformaResult(null);
    try {
      const response = await apiClient.post<any>(`/smartbill/proformas/from-quote/${quote.id}`, {
        series: 'PF',
        dueInDays: 30,
      });
      const data = (response as any)?.data || response;
      setProformaResult({
        success: true,
        message: `Proforma ${data.proformaNumber || data.data?.proformaNumber || ''} creată cu succes!`,
        proformaNumber: data.proformaNumber || data.data?.proformaNumber,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message || err?.message || 'Eroare la generarea proformei';
      setProformaResult({ success: false, message: msg });
    } finally {
      setProformaLoading(false);
    }
  };

  // Proforma can be generated for non-expired, non-rejected quotes
  const canGenerateProforma = ['draft', 'sent', 'viewed', 'accepted', 'converted'].includes(
    quote.status,
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
          <h2 className="text-2xl font-semibold text-white">Detalii Ofertă {quote.quoteNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Client</label>
              <p className="text-white font-medium">{quote.customerName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Email</label>
              <p className="text-white">{quote.customerEmail}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Data Ofertă</label>
              <p className="text-white">{new Date(quote.quoteDate).toLocaleDateString('ro-RO')}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Data Expirare</label>
              <p className="text-white">{new Date(quote.expiryDate).toLocaleDateString('ro-RO')}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Produse</h3>
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50 text-gray-300 text-sm">
                  <tr>
                    <th className="px-4 py-3 text-left">Produs</th>
                    <th className="px-4 py-3 text-right">Cantitate</th>
                    <th className="px-4 py-3 text-right">Preț Unitar</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {quote.items?.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-700">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-gray-400">SKU: {item.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        {item.unitPrice.toFixed(2)} {quote.currencyCode}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.discount.toFixed(2)} {quote.currencyCode}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.totalPrice.toFixed(2)} {quote.currencyCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-700/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Subtotal:</span>
              <span>
                {quote.subtotal.toFixed(2)} {quote.currencyCode}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Discount:</span>
              <span>
                -{quote.discountAmount.toFixed(2)} {quote.currencyCode}
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>TVA:</span>
              <span>
                {quote.taxAmount.toFixed(2)} {quote.currencyCode}
              </span>
            </div>
            <div className="flex justify-between text-xl font-semibold text-white pt-2 border-t border-gray-600">
              <span>Total:</span>
              <span>
                {quote.totalAmount.toFixed(2)} {quote.currencyCode}
              </span>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div>
              <label className="text-sm text-gray-400">Notite</label>
              <p className="text-white mt-1">{quote.notes}</p>
            </div>
          )}

          {/* SmartBill Proforma */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">SmartBill Proforma</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Genereaza proforma in SmartBill direct din aceasta oferta
                </p>
              </div>
              {canGenerateProforma && (
                <button
                  onClick={handleGenerateProforma}
                  disabled={proformaLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {proformaLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  {proformaLoading ? 'Se genereaza...' : 'Genereaza Proforma SmartBill'}
                </button>
              )}
              {!canGenerateProforma && (
                <span className="text-sm text-gray-500 italic">
                  Nu se poate genera proforma (status: {quote.status})
                </span>
              )}
            </div>
            {proformaResult && (
              <div
                className={`mt-3 p-3 rounded-lg text-sm ${
                  proformaResult.success
                    ? 'bg-green-900/30 border border-green-700 text-green-400'
                    : 'bg-red-900/30 border border-red-700 text-red-400'
                }`}
              >
                {proformaResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
