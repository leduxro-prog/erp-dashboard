import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { b2bApi } from '../../services/b2b-api';
import { 
  FileText, Download, Eye, Search, Filter, Loader2, 
  AlertCircle, FileQuestion, RefreshCw, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { INVOICE_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from '../../constants/b2b-portal';

interface Invoice {
  id: string;
  invoice_number: string;
  smartbill_id?: string;
  order_id: string;
  order_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  currency: string;
  status: 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  created_at: string;
}

interface InvoiceDetail extends Invoice {
  smartbill_id?: string;
  customer: {
    id: string;
    company_name: string;
    cui: string;
    address: string;
    contact_name?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    product_id: string;
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    total_price: number;
    vat_rate: number;
    vat_amount: number;
  }>;
  order: {
    id: string;
    order_number: string;
    shipping_address: string;
    billing_address: string;
    payment_method: string;
    notes?: string;
  };
}

export const B2BInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const loadInvoices = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setIsRefreshing(true);
    
    setError(null);
    try {
      const params: any = { page, limit };
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      
      const data = await b2bApi.getInvoices(params);
      setInvoices(data.invoices || []);
      setTotalPages(data.pagination?.total_pages || 1);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setError('Nu am putut încărca facturile. Vă rugăm să încercați din nou.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [page, filterStatus]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo(0, 0);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.order_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const downloadInvoice = async (invoice: Invoice) => {
    try {
      setDownloadingId(invoice.id);
      await b2bApi.downloadInvoice(invoice.id, invoice.invoice_number);
      toast.success('Factura a fost descărcată.');
    } catch (err) {
      console.error('Failed to download invoice:', err);
      toast.error('Descărcarea facturii a eșuat.');
    } finally {
      setDownloadingId(null);
    }
  };

  const previewInvoice = async (invoice: Invoice) => {
    try {
      await b2bApi.previewInvoice(invoice.id);
    } catch (err) {
      console.error('Failed to preview invoice:', err);
      toast.error('Previzualizarea facturii a eșuat.');
    }
  };

  const viewInvoiceDetail = async (invoiceId: string) => {
    try {
      setLoading(true);
      const data = await b2bApi.getInvoiceDetails(invoiceId);
      setSelectedInvoice(data);
      setShowModal(true);
    } catch (err) {
      console.error('Failed to load invoice details:', err);
      toast.error('Nu am putut încărca detaliile facturii.');
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

  if (loading && invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-xl shadow-sm border border-gray-100">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500 font-medium">Se încarcă facturile tale...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturile mele</h1>
          <p className="text-gray-500 mt-1">Gestionează documentele fiscale și plățile tale</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => loadInvoices(true)}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Reîmprospătează"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
            <p className="text-sm text-red-700">{error}</p>
            <button 
              onClick={() => loadInvoices()}
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
              placeholder="Caută după nr. factură sau comandă..."
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
              {Object.entries(INVOICE_STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <FileQuestion className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Nu am găsit facturi</h3>
            <p className="text-gray-500 mt-1 max-w-xs mx-auto">
              {searchTerm || filterStatus !== 'all' 
                ? 'Încearcă să schimbi filtrele sau termenii de căutare.' 
                : 'Nu există facturi emise pentru contul tău încă.'}
            </p>
            {(searchTerm || filterStatus !== 'all') && (
              <button 
                onClick={() => { setSearchTerm(''); setFilterStatus('all'); setPage(1); }}
                className="mt-4 text-blue-600 font-medium hover:text-blue-700"
              >
                Resetează filtrele
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Nr. Factură</th>
                    <th className="px-6 py-4 font-semibold">Dată Emisă</th>
                    <th className="px-6 py-4 font-semibold">Scadență</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Plată</th>
                    <th className="px-6 py-4 font-semibold text-right">Total</th>
                    <th className="px-6 py-4 font-semibold text-center">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((invoice) => {
                    const status = INVOICE_STATUS_CONFIG[invoice.status] || { label: invoice.status, bg: 'bg-gray-100', text: 'text-gray-800' };
                    const paymentStatus = PAYMENT_STATUS_CONFIG[invoice.payment_status] || { label: invoice.payment_status, bg: 'bg-gray-100', text: 'text-gray-800' };
                    
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{invoice.invoice_number}</span>
                            <span className="text-xs text-gray-500">Comanda #{invoice.order_number}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(invoice.issue_date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(invoice.due_date)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${paymentStatus.bg} ${paymentStatus.text}`}>
                            {paymentStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right font-black">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => viewInvoiceDetail(invoice.id)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Detalii"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => previewInvoice(invoice)}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Previzualizare"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadInvoice(invoice)}
                              disabled={downloadingId === invoice.id}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all disabled:opacity-50"
                              title="Descarcă PDF"
                            >
                              {downloadingId === invoice.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
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

      {showModal && selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setShowModal(false)}
          onDownload={() => downloadInvoice(selectedInvoice)}
          onPreview={() => previewInvoice(selectedInvoice)}
        />
      )}
    </div>
  );
};

// Simplified modal component for the sake of completeness
const InvoiceDetailModal: React.FC<{
  invoice: InvoiceDetail;
  onClose: () => void;
  onDownload: () => void;
  onPreview: () => void;
}> = ({ invoice, onClose, onDownload, onPreview }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Factura {invoice.invoice_number}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
            <AlertCircle className="w-6 h-6 text-gray-400 rotate-45" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {/* Detailed invoice view logic here */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Emitent</h3>
              <p className="font-bold text-gray-900">Ledux.ro</p>
              <p className="text-sm text-gray-600">CIF: RO35194414</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Client</h3>
              <p className="font-bold text-gray-900">{invoice.customer.company_name}</p>
              <p className="text-sm text-gray-600">CIF: {invoice.customer.cui}</p>
              <p className="text-sm text-gray-600">{invoice.customer.address}</p>
            </div>
          </div>
          
          <table className="w-full text-left mb-8">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold">
              <tr>
                <th className="px-4 py-3">Produs</th>
                <th className="px-4 py-3 text-center">Cantitate</th>
                <th className="px-4 py-3 text-right">Preț Unitar</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.sku}</p>
                  </td>
                  <td className="px-4 py-4 text-center text-sm text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-4 text-right text-sm text-gray-600">
                    {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: invoice.currency }).format(item.unit_price)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">
                    {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: invoice.currency }).format(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: invoice.currency }).format(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>TVA (19%)</span>
                <span>{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: invoice.currency }).format(invoice.vat_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-gray-900 pt-3 border-t border-gray-100">
                <span>TOTAL</span>
                <span>{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: invoice.currency }).format(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button 
            onClick={onPreview}
            className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Previzualizează
          </button>
          <button 
            onClick={onDownload}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Descarcă PDF
          </button>
        </div>
      </div>
    </div>
  );
};
