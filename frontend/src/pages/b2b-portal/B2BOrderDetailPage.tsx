import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { b2bApi } from '../../services/b2b-api';
import { 
  Package, ChevronLeft, Clock, CheckCircle2, Truck, 
  AlertCircle, CreditCard, Building2, MapPin, Phone, 
  Mail, ArrowRight, Download, Printer, Loader2, FileText
} from 'lucide-react';

interface OrderItem {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  shipping_address?: string;
  billing_address?: string;
  payment_method?: string;
  notes?: string;
  customer_name?: string;
  customer_email?: string;
  smartbill_id?: string;
  invoice_number?: string;
  payment_status?: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'În așteptare', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock },
  processing: { label: 'În procesare', color: 'text-blue-700', bg: 'bg-blue-100', icon: Loader2 },
  shipped: { label: 'Expediată', color: 'text-purple-700', bg: 'bg-purple-100', icon: Truck },
  delivered: { label: 'Livrată', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  cancelled: { label: 'Anulată', color: 'text-red-700', bg: 'bg-red-100', icon: AlertCircle },
};

const paymentStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  unpaid: { label: 'Neplătită', color: 'text-red-700', bg: 'bg-red-100' },
  partial: { label: 'Plată Parțială', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  paid: { label: 'Plătită', color: 'text-green-700', bg: 'bg-green-100' },
};

export const B2BOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrderDetails(id);
    }
  }, [id]);

  const loadOrderDetails = async (orderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await b2bApi.getOrderDetails(orderId);
      setOrder(data);
    } catch (err) {
      console.error('Failed to load order details:', err);
      setError('Nu am putut încărca detaliile comenzii. Vă rugăm să încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setDownloading(true);
    try {
      await b2bApi.downloadInvoice(order.id, order.orderNumber);
    } catch (err) {
      console.error('Failed to download invoice:', err);
      alert('Nu s-a putut descărca factura');
    } finally {
      setDownloading(false);
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
    return new Date(dateStr).toLocaleString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500">Se încarcă detaliile comenzii...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Eroare la încărcare</h2>
        <p className="text-gray-500 mb-6">{error || 'Comanda nu a fost găsită.'}</p>
        <button
          onClick={() => navigate('/b2b-portal/orders')}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Înapoi la comenzi
        </button>
      </div>
    );
  }

  const status = statusConfig[order.status.toLowerCase()] || statusConfig.pending;
  const StatusIcon = status.icon;

  const steps = ['pending', 'processing', 'shipped', 'delivered'];
  const isCancelled = order.status.toLowerCase() === 'cancelled';
  const currentStatusLower = order.status.toLowerCase();
  const currentIdx = steps.indexOf(currentStatusLower);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/b2b-portal/orders')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              Comanda #{order.orderNumber}
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${status.bg} ${status.color} flex items-center gap-1.5`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {status.label}
              </span>
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
              <p className="text-gray-500 text-sm">Plasată pe {formatDate(order.createdAt)}</p>
              {order.smartbill_id ? (
                <>
                  <span className="hidden sm:inline text-gray-300">•</span>
                  <div className="flex items-center gap-2">
                    <p className="text-blue-600 text-sm font-medium flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      SmartBill: {order.invoice_number || order.smartbill_id}
                    </p>
                    {order.payment_status && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter ${paymentStatusConfig[order.payment_status.toLowerCase()]?.bg || 'bg-gray-100'} ${paymentStatusConfig[order.payment_status.toLowerCase()]?.color || 'text-gray-600'}`}>
                        {paymentStatusConfig[order.payment_status.toLowerCase()]?.label || order.payment_status}
                      </span>
                    )}
                  </div>
                </>
              ) : !isCancelled ? (
                <>
                  <span className="hidden sm:inline text-gray-300">•</span>
                  <p className="text-amber-600 text-sm font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Factura se generează...
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Printează
          </button>
          {!isCancelled && (
            <button 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:bg-gray-400"
              onClick={handleDownloadInvoice}
              disabled={downloading || !order.smartbill_id}
              title={!order.smartbill_id ? "Factura nu a fost încă generată în SmartBill" : ""}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {order.smartbill_id ? "Descarcă Factura" : "Factură în curs de generare"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-400" />
                Produse Comandate
              </h2>
              <span className="text-sm text-gray-500 font-medium">
                {order.items?.length || 0} produse
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {order.items?.map((item) => (
                <div key={item.id} className="p-6 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-100">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-contain" />
                    ) : (
                      <Package className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{item.product_name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(item.unit_price)} x {item.quantity}</p>
                    <p className="text-sm font-black text-blue-600 mt-1">{formatCurrency(item.total_price)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50/50 p-6 border-t border-gray-100">
              <div className="w-full max-w-xs ml-auto space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900 font-bold">{formatCurrency(order.totalAmount / 1.19)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA (19%)</span>
                  <span className="text-gray-900 font-bold">{formatCurrency(order.totalAmount - (order.totalAmount / 1.19))}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 flex justify-between">
                  <span className="text-base font-bold text-gray-900">Total Comandă</span>
                  <span className="text-xl font-black text-blue-600">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline / Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-6">Status Comandă</h2>
            {isCancelled ? (
              <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-900">Comanda a fost anulată</p>
                  <p className="text-xs text-red-700">Această comandă nu mai este în procesare.</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {steps.map((step, idx) => {
                  const isCompleted = idx < currentIdx || currentStatusLower === 'delivered';
                  const isCurrent = idx === currentIdx && currentStatusLower !== 'delivered';
                  const isLast = idx === steps.length - 1;
                  
                  return (
                    <div key={step} className="flex gap-4 relative">
                      {!isLast && (
                        <div className={`absolute left-4 top-8 w-0.5 h-12 ${isCompleted && (idx < currentIdx || currentStatusLower === 'delivered') ? 'bg-blue-600' : 'bg-gray-200'}`} />
                      )}
                      <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted ? 'bg-blue-600 text-white' : 
                        isCurrent ? 'bg-blue-100 text-blue-600 ring-4 ring-blue-50' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                      </div>
                      <div className="pb-8">
                        <p className={`text-sm font-bold ${isCurrent ? 'text-blue-600' : 'text-gray-900'}`}>
                          {statusConfig[step]?.label || step}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {isCompleted ? 'Finalizat' : isCurrent ? 'În desfășurare' : 'Urmează'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400" />
              Informații Client
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Companie</p>
                <p className="text-sm font-bold text-gray-900">{order.customer_name || 'N/A'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-900">{order.customer_email || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Adresă Livrare
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {order.shipping_address || 'Nu a fost specificată o adresă de livrare.'}
            </p>
          </div>

          {/* Billing & Payment */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              Plată & Facturare
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Metodă Plată</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{order.payment_method?.replace('_', ' ') || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Adresă Facturare</p>
                <p className="text-sm text-gray-600">
                  {order.billing_address || order.shipping_address || 'Aceeași cu livrarea'}
                </p>
              </div>
            </div>
          </div>

          {/* Order Notes */}
          {order.notes && (
            <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-6">
              <h2 className="font-bold text-yellow-800 mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" />
                Note Comandă
              </h2>
              <p className="text-sm text-yellow-700 italic">"{order.notes}"</p>
            </div>
          )}

          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
            <h3 className="font-bold mb-2">Aveți întrebări?</h3>
            <p className="text-blue-100 text-sm mb-4">Echipa noastră de suport vă stă la dispoziție pentru orice detaliu legat de această comandă.</p>
            <Link to="/b2b-portal/contact" className="inline-flex items-center text-sm font-bold hover:gap-2 transition-all">
              Contactează-ne <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
