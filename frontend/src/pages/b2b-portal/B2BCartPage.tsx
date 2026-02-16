import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Package,
  CreditCard,
  ArrowLeft,
  Zap,
  Droplets,
  Shield,
  Sun,
  Clock,
  Truck,
  Info,
  Upload,
  Download,
  X,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { useCartStore, LocalCartItem } from '../../stores/cart.store';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';
import { b2bApi, CartItem, CSVImportResult } from '../../services/b2b-api';
import { CreditWidgetMini } from '../../components/b2b/CreditWidget';

interface B2BCustomerProfile {
  id: number;
  customer_id: number;
  company_name: string;
  tier: string;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
  payment_terms_days: number;
  discount_percentage: number;
}

interface StockValidation {
  valid: boolean;
  issues: Array<{
    product_id: string;
    product_name: string;
    sku: string;
    requested: number;
    available: number;
    shortage: number;
  }>;
}

interface ProductSpec {
  wattage?: string;
  ip_rating?: string;
  color_temp?: string;
  lumens?: string;
  beam_angle?: string;
  cri?: string;
  lifespan?: string;
  min_order_qty?: number;
  lead_time_days?: number;
}

interface EnhancedCartItem extends LocalCartItem {
  specs?: ProductSpec;
  base_price?: number;
  discount_percent?: number;
  lead_time_days?: number;
  min_order_qty?: number;
}

const TIER_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  STANDARD: { label: 'Standard', color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300' },
  SILVER: { label: 'Silver', color: 'text-gray-600', bg: 'bg-gradient-to-r from-gray-100 to-gray-200', border: 'border-gray-400' },
  GOLD: { label: 'Gold', color: 'text-yellow-800', bg: 'bg-gradient-to-r from-yellow-100 to-amber-100', border: 'border-yellow-400' },
  PLATINUM: { label: 'Platinum', color: 'text-indigo-800', bg: 'bg-gradient-to-r from-indigo-100 to-purple-100', border: 'border-indigo-400' },
};

const TIER_DISCOUNTS: Record<string, number> = {
  STANDARD: 0,
  SILVER: 5,
  GOLD: 10,
  PLATINUM: 15,
};

const TIER_TERMS: Record<string, number> = {
  STANDARD: 15,
  SILVER: 30,
  GOLD: 45,
  PLATINUM: 60,
};

const DEFAULT_LEAD_TIMES: Record<string, number> = {
  'in-stock': 2,
  'low-stock': 3,
  'made-to-order': 14,
  'discontinued': 0,
};

const formatPrice = (amount: number, currency: string = 'RON') => {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const ProductSpecBadge: React.FC<{ icon: React.ReactNode; label: string; value?: string }> = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded" title={label}>
      {icon}
      <span>{value}</span>
    </span>
  );
};

const LeadTimeIndicator: React.FC<{ days?: number; stockStatus: string }> = ({ days, stockStatus }) => {
  const leadDays = days || DEFAULT_LEAD_TIMES[stockStatus] || 5;
  const isUrgent = leadDays <= 2;
  const isNormal = leadDays <= 7;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${
      isUrgent ? 'text-green-600' : isNormal ? 'text-blue-600' : 'text-amber-600'
    }`}>
      <Clock size={12} />
      <span>
        {leadDays === 0 ? 'Indisponibil' : `${leadDays} zile livrare`}
      </span>
    </div>
  );
};

export const B2BCartPage: React.FC = () => {
  const navigate = useNavigate();
  const { customer, isAuthenticated } = useB2BAuthStore();
  const {
    items,
    serverCart,
    isLoading,
    error,
    tier,
    discountPercent,
    updateQuantity,
    removeItem,
    clearCart,
    syncWithServer,
    getSubtotal,
    getDiscount,
    getTax,
    getTotal,
  } = useCartStore();

  const [customerProfile, setCustomerProfile] = useState<B2BCustomerProfile | null>(null);
  const [stockValidation, setStockValidation] = useState<StockValidation | null>(null);
  const [validatingStock, setValidatingStock] = useState(false);
  const [, setLoadingProfile] = useState(true);
  const [clearingCart, setClearingCart] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [enhancedItems, setEnhancedItems] = useState<EnhancedCartItem[]>([]);
  const [quantityErrors, setQuantityErrors] = useState<Record<number, string>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  const subtotal = getSubtotal();
  const discount = getDiscount();
  const tax = getTax();
  const total = getTotal();
  const tierDiscountPercent = TIER_DISCOUNTS[tier] || 0;

  useEffect(() => {
    if (isAuthenticated) {
      syncWithServer();
      fetchCustomerProfile();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (items.length > 0) {
      validateStock();
      enhanceItemsWithSpecs();
    } else {
      setStockValidation(null);
      setEnhancedItems([]);
    }
  }, [items, serverCart]);

  const enhanceItemsWithSpecs = useCallback(() => {
    if (!serverCart?.items) {
      setEnhancedItems(items.map(item => ({ ...item })));
      return;
    }

    const enhanced = items.map(item => {
      const serverItem = serverCart.items.find(
        (si: CartItem) => String(si.product_id) === String(item.productId) || si.id === item.id
      );

      const specs: ProductSpec = {
        wattage: (serverItem as any)?.wattage || (serverItem as any)?.specs?.wattage,
        ip_rating: (serverItem as any)?.ip_rating || (serverItem as any)?.specs?.ip_rating,
        color_temp: (serverItem as any)?.color_temp || (serverItem as any)?.specs?.color_temp,
        lumens: (serverItem as any)?.lumens || (serverItem as any)?.specs?.lumens,
        beam_angle: (serverItem as any)?.beam_angle || (serverItem as any)?.specs?.beam_angle,
        min_order_qty: (serverItem as any)?.min_order_qty || (serverItem as any)?.specs?.min_order_qty || 1,
        lead_time_days: (serverItem as any)?.lead_time_days || (serverItem as any)?.specs?.lead_time_days || 5,
      };

      return {
        ...item,
        specs,
        base_price: serverItem?.base_price,
        discount_percent: serverItem?.discount_percent,
        lead_time_days: specs.lead_time_days,
        min_order_qty: specs.min_order_qty,
      };
    });

    setEnhancedItems(enhanced);
  }, [items, serverCart]);

  const fetchCustomerProfile = async () => {
    try {
      const profile = await b2bApi.getCustomerProfile();
      setCustomerProfile({
        id: profile.id,
        customer_id: profile.customer_id,
        company_name: profile.company_name || customer?.company_name || '',
        tier: profile.tier || customer?.tier || 'STANDARD',
        credit_limit: profile.credit_limit || 0,
        credit_used: profile.credit_used || 0,
        credit_available: profile.credit_available || (profile.credit_limit || 0) - (profile.credit_used || 0),
        payment_terms_days: profile.payment_terms_days || TIER_TERMS[profile.tier || 'STANDARD'] || 30,
        discount_percentage: profile.discount_percentage || 0,
      });
    } catch (err) {
      console.error('Failed to fetch customer profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const validateStock = async () => {
    if (items.length === 0) return;

    setValidatingStock(true);
    try {
      const result = await b2bApi.validateStock();
      setStockValidation(result);
    } catch (err) {
      console.error('Stock validation failed:', err);
      setStockValidation({ valid: true, issues: [] });
    } finally {
      setValidatingStock(false);
    }
  };

  const validateQuantity = (item: EnhancedCartItem, quantity: number): string | null => {
    const minQty = item.min_order_qty || 1;
    if (quantity < minQty) {
      return `Cantitatea minimă este ${minQty} bucăți`;
    }
    if (item.stock_available !== undefined && quantity > item.stock_available) {
      return `Stoc insuficient (disponibil: ${item.stock_available})`;
    }
    return null;
  };

  const handleUpdateQuantity = async (productId: number, newQuantity: number) => {
    const item = enhancedItems.find(i => i.productId === productId);
    
    if (item) {
      const validationError = validateQuantity(item, newQuantity);
      if (validationError && newQuantity > 0) {
        setQuantityErrors(prev => ({ ...prev, [productId]: validationError }));
        return;
      }
    }

    setQuantityErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[productId];
      return newErrors;
    });

    if (newQuantity < 1) {
      handleRemoveItem(productId);
      return;
    }
    await updateQuantity(productId, newQuantity);
  };

  const handleRemoveItem = async (productId: number) => {
    setQuantityErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[productId];
      return newErrors;
    });
    await removeItem(productId);
  };

  const handleClearCart = async () => {
    setClearingCart(true);
    try {
      await clearCart();
      setQuantityErrors({});
      setShowClearConfirm(false);
    } finally {
      setClearingCart(false);
    }
  };

  const handleProceedToCheckout = () => {
    const hasErrors = Object.keys(quantityErrors).length > 0;
    if (hasErrors) {
      return;
    }
    if (stockValidation && !stockValidation.valid) {
      return;
    }
    navigate('/b2b-portal/checkout');
  };

  const getStockStatus = (item: LocalCartItem) => {
    const stockIssue = stockValidation?.issues.find(
      (issue) => issue.product_id === String(item.productId) || issue.product_id === item.id
    );
    if (stockIssue) {
      return { status: 'insufficient', issue: stockIssue };
    }
    if (item.stock_available !== undefined && item.quantity > item.stock_available) {
      return { status: 'warning', available: item.stock_available };
    }
    if (item.stock_available !== undefined && item.stock_available <= 5) {
      return { status: 'low', available: item.stock_available };
    }
    return { status: 'ok' };
  };

  const getMaxLeadTime = (): number => {
    if (enhancedItems.length === 0) return 0;
    return Math.max(...enhancedItems.map(item => item.lead_time_days || 5));
  };

  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.STANDARD;
  const creditUsedPercent = customerProfile
    ? Math.min((customerProfile.credit_used / customerProfile.credit_limit) * 100, 100)
    : 0;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const maxLeadTime = getMaxLeadTime();

  const hasValidationErrors = Object.keys(quantityErrors).length > 0 || (stockValidation !== null && !stockValidation.valid);
  const canProceedToCheckout = !hasValidationErrors && !isLoading && !validatingStock;

  const downloadCSVTemplate = () => {
    const csvContent = `sku,quantity,notes
LED-PANEL-60X60,10,Example note
LED-TUBE-120,25,
LED-BULB-A60,50,Urgent delivery`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'b2b_order_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        setImportError('Te rog selectează un fișier CSV valid');
        return;
      }
      if (file.size > 1024 * 1024) {
        setImportError('Fișierul trebuie să fie mai mic de 1MB');
        return;
      }
      setImportFile(file);
      setImportError(null);
      setImportResult(null);
    }
  };

  const handleImportCSV = async () => {
    if (!importFile) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const result = await b2bApi.importCSV(importFile);
      setImportResult(result);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || err.message || 'Eroare la import';
      setImportError(errorMsg);
    } finally {
      setImporting(false);
    }
  };

  const handleAddImportToCart = async () => {
    if (!importResult || importResult.valid_items.length === 0) return;

    setAddingToCart(true);
    try {
      await b2bApi.importCSVAddToCart(
        importResult.valid_items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes,
        }))
      );
      await syncWithServer();
      setShowImportModal(false);
      setImportFile(null);
      setImportResult(null);
    } catch (err: any) {
      setImportError(err.response?.data?.error?.message || 'Eroare la adăugarea în coș');
    } finally {
      setAddingToCart(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Coș de Cumpărături</h1>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-16 text-center">
              <div className="w-28 h-28 mx-auto mb-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                <ShoppingCart size={48} className="text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Coșul este gol</h2>
              <p className="text-gray-500 mb-10 max-w-lg mx-auto text-lg">
                Adăugați produse din catalogul nostru de echipamente de iluminat profesionale pentru a începe o comandă B2B.
              </p>
              <Link
                to="/b2b-portal/catalog"
                className="inline-flex items-center px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <Package size={22} className="mr-3" />
                Navighează Catalogul
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coș de Cumpărături</h1>
            <p className="text-gray-500 mt-1">
              {enhancedItems.length} {enhancedItems.length === 1 ? 'produs' : 'produse'} • {totalItems} {totalItems === 1 ? 'bucată' : 'bucăți'} totale
            </p>
          </div>
           <div className="flex items-center gap-4">
            {isAuthenticated && (
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${tierInfo.bg} ${tierInfo.color} border ${tierInfo.border}`}>
                <Shield size={16} />
                {tierInfo.label} Partner
              </span>
            )}
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center px-5 py-2.5 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors font-medium"
            >
              <Upload size={18} className="mr-2" />
              Importă din CSV
            </button>
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={isLoading}
                className="inline-flex items-center px-5 py-2.5 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 font-medium"
              >
                <Trash2 size={18} className="mr-2" />
                Golește Coșul
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 px-4 py-2.5 rounded-xl border border-red-200">
                <span className="text-red-700 text-sm font-medium">Sigur ștergeți tot?</span>
                <button
                  onClick={handleClearCart}
                  disabled={clearingCart}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {clearingCart ? <Loader2 size={14} className="animate-spin" /> : 'Da'}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 font-medium"
                >
                  Nu
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center text-red-700 mb-6">
            <AlertTriangle size={22} className="mr-4 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {stockValidation && !stockValidation.valid && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div className="ml-5 flex-1">
                <h3 className="font-bold text-amber-900 text-lg">Probleme de stoc detectate</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Următoarele produse au stoc insuficient pentru cantitatea solicitată:
                </p>
                <div className="mt-4 space-y-2">
                  {stockValidation.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/70 rounded-xl px-4 py-3">
                      <div>
                        <span className="font-semibold text-gray-900">{issue.product_name}</span>
                        <span className="text-gray-500 ml-2 font-mono text-sm">({issue.sku})</span>
                      </div>
                      <div className="text-red-600 font-semibold text-sm">
                        Necesită: {issue.requested} • Disponibil: {issue.available} • Lipsă: {issue.shortage}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200 text-sm font-semibold text-gray-600">
                <div className="col-span-5">Produs</div>
                <div className="col-span-2 text-center">Cantitate</div>
                <div className="col-span-2 text-right">Preț Unitar</div>
                <div className="col-span-2 text-right">Discount</div>
                <div className="col-span-1 text-right">Total</div>
              </div>

              <div className="divide-y divide-gray-100">
                {enhancedItems.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const itemTotal = item.price * item.quantity;
                  const basePrice = item.base_price || (discountPercent > 0 ? item.price / (1 - discountPercent) : item.price);
                  const itemDiscount = item.discount_percent || discountPercent;
                  const discountAmount = (basePrice - item.price) * item.quantity;
                  const specs = item.specs;
                  const qtyError = quantityErrors[item.productId];

                  return (
                    <div
                      key={item.id}
                      className={`p-6 transition-all ${
                        stockStatus.status === 'insufficient'
                          ? 'bg-red-50/50'
                          : qtyError
                          ? 'bg-amber-50/50'
                          : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-center">
                        <div className="lg:col-span-5 flex gap-5 mb-5 lg:mb-0">
                          <div className="flex-shrink-0 w-28 h-28 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden border border-gray-200">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Zap size={36} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 line-clamp-2">
                                  {item.name}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1 font-mono">SKU: {item.sku}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveItem(item.productId)}
                                disabled={isLoading}
                                className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl lg:hidden"
                                title="Elimină produs"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {specs?.wattage && (
                                <ProductSpecBadge icon={<Zap size={12} />} label="Putere" value={`${specs.wattage}W`} />
                              )}
                              {specs?.ip_rating && (
                                <ProductSpecBadge icon={<Droplets size={12} />} label="Protecție" value={`IP${specs.ip_rating}`} />
                              )}
                              {specs?.lumens && (
                                <ProductSpecBadge icon={<Sun size={12} />} label="Flux luminos" value={`${specs.lumens}lm`} />
                              )}
                              {specs?.color_temp && (
                                <ProductSpecBadge icon={<Sun size={12} />} label="Temperatură" value={specs.color_temp} />
                              )}
                              {specs?.beam_angle && (
                                <ProductSpecBadge icon={<Info size={12} />} label="Unghi fascicul" value={`${specs.beam_angle}°`} />
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-3">
                              {item.stock_available !== undefined && (
                                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                                  stockStatus.status === 'ok'
                                    ? 'bg-green-100 text-green-700'
                                    : stockStatus.status === 'low'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  <Package size={12} />
                                  Stoc: {item.stock_available} buc
                                </span>
                              )}
                              <LeadTimeIndicator days={item.lead_time_days} stockStatus={stockStatus.status} />
                            </div>

                            {item.min_order_qty && item.min_order_qty > 1 && (
                              <p className="text-xs text-gray-500 mt-2">
                                <Info size={12} className="inline mr-1" />
                                Min. {item.min_order_qty} buc/comandă
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="lg:col-span-2 flex items-center justify-center">
                          <div className="flex items-center border border-gray-200 rounded-xl bg-white shadow-sm">
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                              disabled={isLoading}
                              className="p-3 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 rounded-l-xl"
                            >
                              <Minus size={18} />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  handleUpdateQuantity(item.productId, val || 1);
                                }
                              }}
                              className="w-20 text-center border-x border-gray-200 py-3 focus:outline-none focus:bg-blue-50 font-bold text-lg"
                              min={item.min_order_qty || 1}
                            />
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                              disabled={isLoading}
                              className="p-3 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 rounded-r-xl"
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="lg:col-span-2 text-right mt-4 lg:mt-0">
                          <p className="font-semibold text-gray-900 text-lg">{formatPrice(item.price)}</p>
                          {itemDiscount > 0 && (
                            <p className="text-sm text-gray-400 line-through">{formatPrice(basePrice)}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">per bucată</p>
                        </div>

                        <div className="lg:col-span-2 text-right mt-4 lg:mt-0">
                          {itemDiscount > 0 && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                              <CheckCircle size={14} />
                              -{itemDiscount}%
                            </div>
                          )}
                          {discountAmount > 0 && (
                            <p className="text-sm text-green-600 font-medium mt-1">
                              -{formatPrice(discountAmount)}
                            </p>
                          )}
                        </div>

                        <div className="lg:col-span-1 flex items-center justify-between lg:justify-end gap-3 mt-4 lg:mt-0">
                          <div className="text-right">
                            <p className="text-xl font-bold text-gray-900">{formatPrice(itemTotal)}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.productId)}
                            disabled={isLoading}
                            className="hidden lg:block text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl"
                            title="Elimină produs"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      {(stockStatus.status === 'insufficient' || qtyError) && (
                        <div className={`mt-5 p-4 rounded-xl flex items-start gap-3 ${
                          qtyError ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'
                        }`}>
                          <AlertTriangle size={20} className={`flex-shrink-0 mt-0.5 ${qtyError ? 'text-amber-500' : 'text-red-500'}`} />
                          <div className="text-sm">
                            {qtyError ? (
                              <span className="font-medium text-amber-800">{qtyError}</span>
                            ) : stockStatus.issue && (
                              <>
                                <span className="font-semibold text-red-800">Stoc insuficient: </span>
                                <span className="text-red-700">
                                  Disponibil doar {stockStatus.issue.available} din {stockStatus.issue.requested} buc.
                                </span>
                                <span className="text-red-600 font-bold ml-1">
                                  (−{stockStatus.issue.shortage} buc)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {stockStatus.status === 'low' && !qtyError && (
                        <div className="mt-5 p-3 bg-blue-50 rounded-xl flex items-center gap-3 border border-blue-100">
                          <Info size={18} className="text-blue-500 flex-shrink-0" />
                          <span className="text-sm text-blue-800">
                            Stoc redus disponibil ({stockStatus.available} buc)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-6">
              <Link
                to="/b2b-portal/catalog"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold transition-colors group text-lg"
              >
                <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                Continuă cumpărăturile
              </Link>
              {validatingStock && (
                <div className="flex items-center text-gray-500">
                  <Loader2 size={18} className="animate-spin mr-2" />
                  Se verifică stocul...
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 sticky top-6 overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600">
                <h2 className="text-xl font-bold text-white">Sumar Comandă</h2>
              </div>

              <div className="p-6 space-y-6">
                {customerProfile && (
                  <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600 font-medium">Cont B2B</span>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${tierInfo.bg} ${tierInfo.color} border ${tierInfo.border}`}>
                        {tierInfo.label}
                      </span>
                    </div>
                    <p className="font-bold text-gray-900 text-lg mb-4">{customerProfile.company_name}</p>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Limită Credit</span>
                        <span className="font-bold text-gray-900">
                          {formatPrice(customerProfile.credit_limit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Credit Utilizat</span>
                        <span className="font-medium text-gray-700">
                          {formatPrice(customerProfile.credit_used)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Credit Disponibil</span>
                        <span className={`font-bold ${
                          customerProfile.credit_available >= total ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPrice(customerProfile.credit_available)}
                        </span>
                      </div>

                      <div className="pt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                          <span>Utilizare credit</span>
                          <span className="font-semibold">{creditUsedPercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              creditUsedPercent > 90
                                ? 'bg-gradient-to-r from-red-500 to-red-600'
                                : creditUsedPercent > 70
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                : 'bg-gradient-to-r from-green-500 to-emerald-500'
                            }`}
                            style={{ width: `${Math.min(creditUsedPercent, 100)}%` }}
                          />
                        </div>
                      </div>

                      {customerProfile.credit_available < total && (
                        <div className="mt-4 p-3 bg-red-100 rounded-xl flex items-center gap-2 text-red-700 text-sm font-medium">
                          <AlertTriangle size={18} className="flex-shrink-0" />
                          <span>Totalul depășește creditul disponibil</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tierDiscountPercent > 0 && (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3 text-green-700">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle size={20} />
                      </div>
                      <div>
                        <p className="font-bold">Discount {tierInfo.label}</p>
                        <p className="text-sm">{tierDiscountPercent}% aplicat tuturor produselor</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal ({totalItems} buc)</span>
                    <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
                  </div>

                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-2 font-medium">
                        <CheckCircle size={16} />
                        Discount ({tierDiscountPercent}%)
                      </span>
                      <span className="font-bold">−{formatPrice(discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-600">TVA (19%)</span>
                    <span className="font-semibold text-gray-900">{formatPrice(tax)}</span>
                  </div>

                  {customerProfile && (
                    <div className="pt-2 border-t border-gray-100">
                      <CreditWidgetMini 
                        creditLimit={customerProfile.credit_limit} 
                        usedCredit={customerProfile.credit_used + total}
                        className="text-xs"
                      />
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xl font-bold text-gray-900">Total</span>
                      <span className="text-3xl font-bold text-gray-900">{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleProceedToCheckout}
                    disabled={!canProceedToCheckout}
                    className="w-full inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transform hover:-translate-y-0.5 disabled:transform-none text-lg"
                  >
                    <CreditCard size={22} className="mr-3" />
                    Procedează la Checkout
                  </button>

                  <Link
                    to="/b2b-portal/catalog"
                    className="w-full inline-flex items-center justify-center px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    <Package size={20} className="mr-2" />
                    Continuă Cumpărăturile
                  </Link>
                </div>

                <div className="pt-5 border-t border-gray-200 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Truck size={16} className="text-green-600" />
                    </div>
                    <span>Livrare gratuită pentru comenzi peste 500 RON</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-blue-600" />
                    </div>
                    <span>Termen plată: Net {customerProfile?.payment_terms_days || TIER_TERMS[tier] || 30} zile</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Shield size={16} className="text-indigo-600" />
                    </div>
                    <span>Garanție 2-5 ani pentru produse LED</span>
                  </div>
                  {maxLeadTime > 0 && (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Package size={16} className="text-amber-600" />
                      </div>
                      <span>Estimare livrare: {maxLeadTime} zile lucrătoare</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2 text-lg">
                <Shield size={20} className="text-indigo-500" />
                Niveluri Parteneriat
              </h3>
              <div className="space-y-3">
                {Object.entries(TIER_LABELS).map(([key, info]) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                      tier === key ? 'bg-indigo-50 border-2 border-indigo-300 shadow-sm' : 'bg-white border border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${tier === key ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {info.label}
                      </span>
                      {tier === key && (
                        <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold">
                          Activ
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-lg ${tier === key ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {TIER_DISCOUNTS[key]}%
                      </span>
                      <span className="text-gray-400 text-sm ml-1">
                        / Net {TIER_TERMS[key]} zile
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileSpreadsheet size={24} />
                Importă Comandă din CSV
              </h2>
              <button onClick={closeImportModal} className="text-white/80 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {!importResult ? (
                <>
                  <div className="mb-6">
                    <p className="text-gray-600 mb-4">
                      Încarcă un fișier CSV cu produsele pe care dorești să le comanzi. 
                      Formatul acceptat: <code className="bg-gray-100 px-2 py-1 rounded">sku, quantity, notes</code>
                    </p>
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={downloadCSVTemplate}
                        className="inline-flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Download size={16} className="mr-2" />
                        Descarcă Template CSV
                      </button>
                      <span className="text-xs text-gray-500">
                        Maxim 100 produse, fișier până la 1MB
                      </span>
                    </div>
                  </div>

                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                      importFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="csv-file-input"
                    />
                    <label htmlFor="csv-file-input" className="cursor-pointer">
                      {importFile ? (
                        <div className="flex items-center justify-center gap-3 text-green-700">
                          <CheckCircle size={24} />
                          <span className="font-medium">{importFile.name}</span>
                          <span className="text-sm text-gray-500">
                            ({(importFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      ) : (
                        <>
                          <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                          <p className="text-gray-600 font-medium">
                            Click pentru a selecta un fișier CSV
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            sau trage și plasează fișierul aici
                          </p>
                        </>
                      )}
                    </label>
                  </div>

                  {importError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Eroare la import</p>
                        <p className="text-sm text-red-600">{importError}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={closeImportModal}
                      className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                      Anulează
                    </button>
                    <button
                      onClick={handleImportCSV}
                      disabled={!importFile || importing}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Se procesează...
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          Procesează CSV
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-xl font-medium ${
                          importResult.valid_count > 0 && importResult.invalid_count === 0
                            ? 'bg-green-100 text-green-700'
                            : importResult.valid_count > 0
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {importResult.valid_count} produse valide
                        </div>
                        {importResult.invalid_count > 0 && (
                          <div className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-medium">
                            {importResult.invalid_count} produse cu erori
                          </div>
                        )}
                        {importResult.parse_error_count > 0 && (
                          <div className="px-4 py-2 rounded-xl bg-amber-100 text-amber-700 font-medium">
                            {importResult.parse_error_count} erori de parsare
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setImportResult(null);
                          setImportFile(null);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Încarcă alt fișier
                      </button>
                    </div>

                    {importResult.valid_count > 0 && (
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Subtotal cu discount</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatPrice(importResult.subtotal_with_discount)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Discount aplicat</p>
                            <p className="text-lg font-bold text-green-600">
                              {importResult.total_discount_percent.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {importResult.valid_items.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle size={18} className="text-green-500" />
                        Produse Valide ({importResult.valid_items.length})
                      </h3>
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600">SKU</th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-600">Produs</th>
                                <th className="text-right px-4 py-2 font-semibold text-gray-600">Cant.</th>
                                <th className="text-right px-4 py-2 font-semibold text-gray-600">Preț</th>
                                <th className="text-right px-4 py-2 font-semibold text-gray-600">Stoc</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {importResult.valid_items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 font-mono text-gray-600">{item.sku}</td>
                                  <td className="px-4 py-2 text-gray-900">{item.product_name}</td>
                                  <td className="px-4 py-2 text-right font-medium">{item.quantity}</td>
                                  <td className="px-4 py-2 text-right">{formatPrice(item.unit_price)}</td>
                                  <td className="px-4 py-2 text-right">
                                    <span className={item.stock_available >= item.quantity ? 'text-green-600' : 'text-amber-600'}>
                                      {item.stock_available}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {importResult.invalid_items.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-500" />
                        Produse cu Erori ({importResult.invalid_items.length})
                      </h3>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="max-h-32 overflow-y-auto space-y-2">
                          {importResult.invalid_items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-mono text-gray-700">{item.sku}</span>
                                <span className="text-gray-500 ml-2">× {item.quantity}</span>
                              </div>
                              <span className="text-red-600">{item.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {importResult.parse_errors.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertCircle size={18} className="text-amber-500" />
                        Erori de Parsare ({importResult.parse_errors.length})
                      </h3>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="max-h-24 overflow-y-auto space-y-1 text-sm">
                          {importResult.parse_errors.map((err, idx) => (
                            <div key={idx} className="text-amber-700">
                              Linia {err.line}: {err.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {importError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700">{importError}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={closeImportModal}
                      className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                      Anulează
                    </button>
                    {importResult.valid_count > 0 && (
                      <button
                        onClick={handleAddImportToCart}
                        disabled={addingToCart}
                        className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                      >
                        {addingToCart ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Se adaugă...
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={18} />
                            Adaugă {importResult.valid_count} produse în coș
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2BCartPage;
