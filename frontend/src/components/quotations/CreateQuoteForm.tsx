import { useState, useEffect } from 'react';
import { X, Trash2, Search, Building2, Globe, Database } from 'lucide-react';
import { apiClient } from '@/services/api';

type CustomerSource = 'erp' | 'b2b' | 'smartbill';

interface UnifiedCustomer {
  id: string;
  display_name: string;
  company_name?: string;
  cui?: string;
  email?: string;
  phone?: string;
  source: CustomerSource;
  credit_limit?: number;
  credit_used?: number;
  discount_percentage?: number;
  tier?: string;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  basePrice: number;
  currencyCode: string;
}

interface QuoteItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

interface CreateQuoteFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateQuoteForm({ onClose, onSuccess }: CreateQuoteFormProps) {
  const [step, setStep] = useState(1); // 1: Customer, 2: Items, 3: Details
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customer selection
  const [customers, setCustomers] = useState<UnifiedCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<UnifiedCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSources, setCustomerSources] = useState<CustomerSource[]>(['b2b', 'erp']);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
  });

  // Product selection
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);

  // Quote details
  const [expiryDays, setExpiryDays] = useState(30);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    'Prețurile nu includ TVA.\nOferta este valabilă pentru perioada specificată.\nPlata se face în avans sau conform contractului.',
  );

  // Unified Customer Search
  useEffect(() => {
    if (isNewCustomer) return;

    const fetchUnifiedCustomers = async () => {
      try {
        if (customerSearch.trim().length >= 1) {
          const sources = customerSources.join(',');
          const response: any = await apiClient.get(
            `/customers/search?q=${encodeURIComponent(customerSearch)}&sources=${sources}&limit=50`,
          );
          const data = response?.data || response;
          const rawList = data.data || data || [];
          const mapped = rawList.map((c: any) => ({
            id: c.id || `erp_${c.id}`,
            source: c.source || 'erp',
            display_name: c.displayName || c.display_name || c.company_name || c.firstName || '',
            company_name: c.companyName || c.company_name || c.company || null,
            cui: c.cui || c.tax_identification_number || null,
            email: c.email || '',
            phone: c.phone || c.phone_number || null,
            credit_limit: c.creditLimit || c.credit_limit || null,
            credit_used: c.creditUsed || c.credit_used || null,
            discount_percentage: c.discount || c.discount_percentage || null,
            tier: c.tier || null,
          }));
          setCustomers(mapped);
        } else {
          // No search query - load recent ERP customers
          const response: any = await apiClient.get('/customers?limit=100');
          const data = response?.data || response;
          const rawList = data.data || data || [];
          // Map legacy format to unified format
          const mapped = rawList.map((c: any) => ({
            id: c.id || `erp_${c.id}`,
            source: c.source || 'erp',
            display_name: c.displayName || c.display_name || c.company_name || c.firstName || '',
            company_name: c.companyName || c.company_name || c.company || null,
            cui: c.cui || c.tax_identification_number || null,
            email: c.email || '',
            phone: c.phone || c.phone_number || null,
            credit_limit: c.creditLimit || c.credit_limit || null,
            credit_used: c.creditUsed || c.credit_used || null,
            discount_percentage: c.discount || c.discount_percentage || null,
            tier: c.tier || null,
          }));
          setCustomers(mapped);
        }
      } catch (err) {
        console.error('Error fetching unified customers:', err);
      }
    };

    const debounce = setTimeout(fetchUnifiedCustomers, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch, customerSources, isNewCustomer]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (productSearch) params.set('search', productSearch);

        const response = await apiClient.get(`/inventory/products?${params.toString()}`);
        const data = (response as any)?.data || response;
        setProducts(data.data || data || []);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };

    const debounce = setTimeout(fetchProducts, 300);
    return () => clearTimeout(debounce);
  }, [productSearch]);

  const addItem = (product: Product) => {
    const existingItem = items.find((i) => i.productId === product.id);
    if (existingItem) {
      setItems(
        items.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)),
      );
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: product.basePrice,
          discount: 0,
          taxRate: 21,
        },
      ]);
    }
    setProductSearch('');
  };

  const removeItem = (productId: number) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const updateItem = (productId: number, field: keyof QuoteItem, value: number) => {
    setItems(items.map((i) => (i.productId === productId ? { ...i, [field]: value } : i)));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice - item.discount;
      return sum + itemTotal;
    }, 0);
  };

  const calculateDiscount = () => {
    return calculateSubtotal() * (discountPercentage / 100);
  };

  const calculateTax = () => {
    return items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice - item.discount;
      const taxableAmount = itemSubtotal * (1 - discountPercentage / 100);
      const itemTax = (taxableAmount * item.taxRate) / 100;
      return sum + itemTax;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateTax();
  };

  const handleSubmit = async () => {
    if (!isNewCustomer && !selectedCustomer) {
      setError('Selectează un client');
      return;
    }

    if (isNewCustomer && (!newCustomerData.firstName || !newCustomerData.email)) {
      setError('Completează numele și email-ul clientului');
      return;
    }

    if (items.length === 0) {
      setError('Adaugă cel puțin un produs');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        customerId: isNewCustomer ? null : selectedCustomer?.id,
        customerSource: isNewCustomer ? 'new' : selectedCustomer?.source,
        customerName: isNewCustomer
          ? `${newCustomerData.firstName} ${newCustomerData.lastName}`
          : selectedCustomer?.display_name,
        customerEmail: isNewCustomer ? newCustomerData.email : selectedCustomer?.email,
        customerPhone: isNewCustomer ? newCustomerData.phone : selectedCustomer?.phone,
        customerCompany: isNewCustomer ? newCustomerData.company : selectedCustomer?.company_name,
        customerCui: isNewCustomer ? '' : selectedCustomer?.cui,
        expiryDays,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
        })),
        discountPercentage,
        notes,
        termsAndConditions,
      };

      await apiClient.post('/quotations', payload);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Eroare la crearea ofertei');
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (source: CustomerSource) => {
    setCustomerSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
          <div>
            <h2 className="text-2xl font-semibold text-white">Ofertă Nouă</h2>
            <p className="text-sm text-gray-400 mt-1">
              Pasul {step} din 3: {step === 1 ? 'Client' : step === 2 ? 'Produse' : 'Detalii'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`flex-1 h-2 rounded ${s <= step ? 'bg-blue-600' : 'bg-gray-700'}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Customer Selection */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            {/* Toggle between existing and new customer */}
            <div className="flex gap-2 p-1 bg-gray-700 rounded-lg">
              <button
                onClick={() => setIsNewCustomer(false)}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  !isNewCustomer ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Client Existent
              </button>
              <button
                onClick={() => setIsNewCustomer(true)}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  isNewCustomer ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Client Nou
              </button>
            </div>

            {/* Existing Customer Search */}
            {!isNewCustomer && (
              <>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Caută Client
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Nume, email sau companie..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Source Filters */}
                  <div className="flex gap-2">
                    {[
                      { id: 'b2b', label: 'Portal B2B', icon: Globe },
                      { id: 'erp', label: 'Local ERP', icon: Database },
                      { id: 'smartbill', label: 'SmartBill', icon: Building2 },
                    ].map((src) => (
                      <button
                        key={src.id}
                        onClick={() => toggleSource(src.id as CustomerSource)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                          customerSources.includes(src.id as CustomerSource)
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                            : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                        }`}
                      >
                        <src.icon size={12} />
                        {src.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 mt-4">
                  {customers.map((customer) => (
                    <button
                      key={`${customer.source}-${customer.id}`}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`w-full p-4 rounded-lg border text-left transition-colors ${
                        selectedCustomer?.id === customer.id &&
                        selectedCustomer?.source === customer.source
                          ? 'border-blue-500 bg-blue-600/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-700/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-white">
                          {customer.display_name}
                          {customer.cui && (
                            <span className="text-gray-400 text-xs ml-2 font-mono">
                              ({customer.cui})
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            customer.source === 'b2b'
                              ? 'bg-purple-900/40 text-purple-400'
                              : customer.source === 'smartbill'
                                ? 'bg-blue-900/40 text-blue-400'
                                : 'bg-gray-600 text-gray-200'
                          }`}
                        >
                          {customer.source}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {customer.email} • {customer.phone}
                      </div>
                      {customer.source === 'b2b' && (
                        <div className="mt-2 flex gap-4 text-[10px] font-bold uppercase text-gray-500">
                          <span>Limită: {customer.credit_limit?.toLocaleString()} RON</span>
                          <span>Discount: {customer.discount_percentage}%</span>
                        </div>
                      )}
                    </button>
                  ))}

                  {customers.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Search size={40} className="mx-auto mb-2 opacity-20" />
                      Nu s-au găsit clienți pentru criteriile selectate
                    </div>
                  )}
                </div>
              </>
            )}

            {/* New Customer Form */}
            {isNewCustomer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Prenume <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Prenume client..."
                      className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={newCustomerData.firstName}
                      onChange={(e) =>
                        setNewCustomerData({ ...newCustomerData, firstName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nume</label>
                    <input
                      type="text"
                      placeholder="Nume client..."
                      className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={newCustomerData.lastName}
                      onChange={(e) =>
                        setNewCustomerData({ ...newCustomerData, lastName: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={newCustomerData.email}
                    onChange={(e) =>
                      setNewCustomerData({ ...newCustomerData, email: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Telefon</label>
                  <input
                    type="tel"
                    placeholder="+40 XXX XXX XXX"
                    className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={newCustomerData.phone}
                    onChange={(e) =>
                      setNewCustomerData({ ...newCustomerData, phone: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Companie</label>
                  <input
                    type="text"
                    placeholder="Nume companie..."
                    className="w-full px-4 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={newCustomerData.company}
                    onChange={(e) =>
                      setNewCustomerData({ ...newCustomerData, company: e.target.value })
                    }
                  />
                </div>

                <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    ℹ️ Datele clientului vor fi salvate odată cu oferta
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Products */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Adaugă Produse</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Caută produs după nume sau SKU..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {productSearch && products.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-700 rounded-lg bg-gray-700">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addItem(product)}
                      className="w-full p-3 text-left hover:bg-gray-600 transition-colors border-b border-gray-700 last:border-b-0"
                    >
                      <div className="font-medium text-white">{product.name}</div>
                      <div className="text-sm text-gray-400">
                        SKU: {product.sku} • {product.basePrice.toFixed(2)} {product.currencyCode}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items List */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3 font-bold uppercase tracking-wider">
                Produse Adăugate ({items.length})
              </h3>

              {items.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-700 rounded-xl">
                  Adaugă produse pentru a începe oferta
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="p-4 border border-gray-700 rounded-lg bg-gray-700/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-white">{item.productName}</div>
                          <div className="text-xs text-gray-400 font-mono">SKU: {item.sku}</div>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Cantitate
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(
                                item.productId,
                                'quantity',
                                parseFloat(e.target.value) || 1,
                              )
                            }
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Preț Unitar
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(
                                item.productId,
                                'unitPrice',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            Discount
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) =>
                              updateItem(
                                item.productId,
                                'discount',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                            TVA %
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.taxRate}
                            onChange={(e) =>
                              updateItem(item.productId, 'taxRate', parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-2 text-right text-xs">
                        <span className="text-gray-400 uppercase font-bold">Total Articol:</span>{' '}
                        <span className="font-bold text-blue-400 ml-1">
                          {(item.quantity * item.unitPrice - item.discount).toFixed(2)} RON
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">
                  Valabilitate (zile)
                </label>
                <input
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value) || 30)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">
                  Discount General (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">
                Notițe Interne
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informații adiționale pentru echipa internă..."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">
                Termeni și Condiții
              </label>
              <textarea
                rows={4}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Final Summary */}
            <div className="bg-gray-900/50 rounded-xl p-6 space-y-3 border border-gray-700">
              <div className="flex justify-between text-sm text-gray-400">
                <span className="uppercase font-bold tracking-tight">Subtotal Brut:</span>
                <span className="font-mono">{calculateSubtotal().toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span className="uppercase font-bold tracking-tight">
                  Discount General ({discountPercentage}%):
                </span>
                <span className="font-mono text-green-500">
                  -{calculateDiscount().toFixed(2)} RON
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span className="uppercase font-bold tracking-tight">Total TVA (21%):</span>
                <span className="font-mono">{calculateTax().toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between text-xl font-black text-white pt-4 border-t border-gray-700">
                <span className="uppercase tracking-tighter">Total Ofertă:</span>
                <span className="text-blue-400">{calculateTotal().toFixed(2)} RON</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-between gap-3 sticky bottom-0 bg-gray-800">
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="flex-1 py-3 px-4 rounded-lg bg-gray-700 text-white font-bold hover:bg-gray-600 transition disabled:opacity-50"
            disabled={loading}
          >
            {step === 1 ? 'Anulează' : 'Înapoi'}
          </button>

          <button
            onClick={step === 3 ? handleSubmit : () => setStep(step + 1)}
            className="flex-[2] py-3 px-4 rounded-lg bg-blue-600 text-white font-black uppercase tracking-wider hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-900/20"
            disabled={
              loading ||
              (step === 1 && !isNewCustomer && !selectedCustomer) ||
              (step === 1 &&
                isNewCustomer &&
                (!newCustomerData.firstName || !newCustomerData.email)) ||
              (step === 2 && items.length === 0)
            }
          >
            {loading ? 'Se procesează...' : step === 3 ? 'Creează Oferta' : 'Următorul Pas'}
          </button>
        </div>
      </div>
    </div>
  );
}
