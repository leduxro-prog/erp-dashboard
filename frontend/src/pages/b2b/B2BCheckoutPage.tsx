import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import {
  ShoppingCart,
  CreditCard,
  Truck,
  CheckCircle,
  Trash2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Building,
  User,
  Phone,
  Loader2,
  Package,
  Calendar,
  Wallet,
  Info,
} from 'lucide-react';

import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';
import { useCartStore } from '../../stores/cart.store';

interface Address {
  id: number;
  label: string;
  address: string;
  address_type: string;
  is_default: boolean;
}

interface CustomerProfile {
  id: number;
  customer_id: string;
  company_name: string;
  tier: string;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
  payment_terms_days: number;
  discount_percentage: number;
  billing_address?: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface StockValidation {
  valid: boolean;
  errors: Array<{
    product_id: number;
    product_name?: string;
    requested: number;
    available: number;
  }>;
}

interface CheckoutResult {
  order_id: number;
  order_number: string;
  customer_id: number;
  status: string;
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
  payment_method: string;
  payment_due_date: string;
  payment_terms_days: number;
  credit_remaining: number;
  created_at: Date;
  items: Array<{
    product_id: number;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

type PaymentMethod = 'CREDIT' | 'TRANSFER' | 'CASH';

interface AddressForm {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface CheckoutFormData {
  shipping_address: AddressForm;
  use_different_billing: boolean;
  billing_address: AddressForm;
  contact_name: string;
  contact_phone: string;
  payment_method: PaymentMethod;
  notes: string;
  purchase_order_number: string;
  save_address: boolean;
  address_label: string;
}

const initialAddress: AddressForm = {
  street: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Romania',
};

const initialFormData: CheckoutFormData = {
  shipping_address: { ...initialAddress },
  use_different_billing: false,
  billing_address: { ...initialAddress },
  contact_name: '',
  contact_phone: '',
  payment_method: 'CREDIT',
  notes: '',
  purchase_order_number: '',
  save_address: false,
  address_label: '',
};

const TIER_PAYMENT_TERMS: Record<string, number> = {
  STANDARD: 30,
  SILVER: 30,
  GOLD: 60,
  PLATINUM: 90,
};

export const B2BCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { customer, isAuthenticated } = useB2BAuthStore();
  const {
    items: cartItems,
    updateQuantity,
    removeItem,
    clearCart,
    getSubtotal,
    getSubtotalWithDiscount,
    getTax,
    getTotal,
    tier,
    discountPercent,
    syncWithServer,
  } = useCartStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [formData, setFormData] = useState<CheckoutFormData>(initialFormData);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [stockValidation, setStockValidation] = useState<StockValidation | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [minOrderValue, setMinOrderValue] = useState(0);
  const [stockWarnings, setStockWarnings] = useState<Record<number, boolean>>({});

  const subtotal = getSubtotal();
  const subtotalAfterDiscount = getSubtotalWithDiscount();
  const discountAmount = subtotal - subtotalAfterDiscount;
  const tax = getTax();
  const total = getTotal();

  const paymentTerms = customerProfile?.payment_terms_days || TIER_PAYMENT_TERMS[tier] || 30;

  const creditRemaining = customerProfile ? customerProfile.credit_available - total : 0;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/b2b-store/login?redirect=/b2b-store/checkout');
      return;
    }
    fetchOrderSettings();
    fetchCustomerProfile();
    fetchSavedAddresses();
    syncWithServer();
  }, [isAuthenticated]);

  useEffect(() => {
    if (step === 1 && cartItems.length > 0) {
      validateStock();
    }
  }, [cartItems, step]);

  const fetchOrderSettings = async () => {
    try {
      const response = await fetch('/api/v1/settings');
      const data = await response.json();
      if (data.b2b && data.b2b.minOrderValue) {
        setMinOrderValue(parseFloat(data.b2b.minOrderValue));
      }
    } catch (err) {
      console.error('Failed to fetch order settings:', err);
    }
  };

  const fetchCustomerProfile = async () => {
    try {
      const response = await fetch('/api/v1/b2b/checkout/profile', {
        headers: {
          Authorization: `Bearer ${useB2BAuthStore.getState().token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setCustomerProfile(data.data);
        const profile = data.data;
        if (profile.billing_address) {
          setFormData((prev) => ({
            ...prev,
            billing_address: {
              street: profile.billing_address.street || '',
              city: profile.billing_address.city || '',
              state: profile.billing_address.state || '',
              postal_code: profile.billing_address.postal_code || '',
              country: profile.billing_address.country || 'Romania',
            },
          }));
        }
        if (customer?.company_name) {
          setFormData((prev) => ({
            ...prev,
            contact_name: customer.company_name,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch customer profile:', err);
    }
  };

  const fetchSavedAddresses = async () => {
    try {
      const response = await fetch('/api/v1/b2b/checkout/addresses', {
        headers: {
          Authorization: `Bearer ${useB2BAuthStore.getState().token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSavedAddresses(data.data);
        const defaultAddr = data.data.find(
          (a: Address) =>
            a.is_default && (a.address_type === 'shipping' || a.address_type === 'both'),
        );
        if (defaultAddr) {
          const parsed = parseAddress(defaultAddr.address);
          setFormData((prev) => ({
            ...prev,
            shipping_address: parsed,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    }
  };

  const parseAddress = (addressStr: string): AddressForm => {
    const parts = addressStr.split(', ');
    return {
      street: parts[0] || '',
      city: parts[1] || '',
      state: parts[2] || '',
      postal_code: parts[3] || '',
      country: parts[4] || 'Romania',
    };
  };

  const formatAddress = (addr: AddressForm): string => {
    return [addr.street, addr.city, addr.state, addr.postal_code, addr.country]
      .filter(Boolean)
      .join(', ');
  };

  const validateStock = async () => {
    if (cartItems.length === 0) return;

    setValidating(true);
    try {
      const response = await fetch('/api/v1/b2b/checkout/validate-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useB2BAuthStore.getState().token}`,
        },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await response.json();
      setStockValidation(data.data || data);

      const warnings: Record<number, boolean> = {};
      cartItems.forEach((item) => {
        if (item.stock_available !== undefined && item.quantity > item.stock_available) {
          warnings[item.productId] = true;
        }
      });
      setStockWarnings(warnings);
    } catch (err) {
      console.error('Stock validation failed:', err);
      setStockValidation({ valid: false, errors: [] });
    } finally {
      setValidating(false);
    }
  };

  const validateCredit = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/v1/b2b/checkout/validate-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useB2BAuthStore.getState().token}`,
        },
        body: JSON.stringify({ amount: total }),
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error || data.message || 'Credit insuficient';
        setErrors({ credit: errorMsg });
        return false;
      }
      return data.data?.valid || false;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Validarea creditului a eșuat';
      setErrors({ credit: errorMsg });
      return false;
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (cartItems.length === 0) {
      newErrors.cart = 'Coșul este gol';
    }

    if (minOrderValue > 0 && total < minOrderValue) {
      newErrors.minOrder = `Valoarea minimă este ${minOrderValue.toFixed(2)} RON`;
    }

    if (stockValidation && !stockValidation.valid) {
      newErrors.stock = `${stockValidation.errors.length} produse nu au stoc suficient`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    const sa = formData.shipping_address;

    if (!sa.street.trim()) newErrors.shipping_street = 'Strada este obligatorie';
    if (!sa.city.trim()) newErrors.shipping_city = 'Orașul este obligatoriu';
    if (!sa.postal_code.trim()) newErrors.shipping_postal = 'Codul poștal este obligatoriu';
    if (!formData.contact_name.trim()) newErrors.contact_name = 'Numele contact este obligatoriu';
    if (!formData.contact_phone.trim()) newErrors.contact_phone = 'Telefonul este obligatoriu';

    if (formData.use_different_billing) {
      const ba = formData.billing_address;
      if (!ba.street.trim()) newErrors.billing_street = 'Strada este obligatorie';
      if (!ba.city.trim()) newErrors.billing_city = 'Orașul este obligatoriu';
      if (!ba.postal_code.trim()) newErrors.billing_postal = 'Codul poștal este obligatoriu';
    }

    if (formData.save_address && !formData.address_label.trim()) {
      newErrors.address_label = 'Eticheta adresei este obligatorie';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = async () => {
    setErrors({});
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      const creditOk = await validateCredit();
      if (creditOk) {
        setStep(3);
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      setErrors({ cart: 'Coșul este gol' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/v1/b2b/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useB2BAuthStore.getState().token}`,
        },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            product_id: item.productId,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price,
          })),
          shipping_address: formData.shipping_address,
          billing_address: formData.use_different_billing ? formData.billing_address : undefined,
          use_different_billing: formData.use_different_billing,
          contact_name: formData.contact_name,
          contact_phone: formData.contact_phone,
          payment_method: formData.payment_method,
          notes: formData.notes,
          purchase_order_number: formData.purchase_order_number,
          save_address: formData.save_address,
          address_label: formData.address_label,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCheckoutResult({
          ...data.data,
          credit_remaining: customerProfile
            ? customerProfile.credit_available - data.data.total
            : 0,
        });
        clearCart();
        setStep(4);
      } else {
        const errorMsg = data.error || data.message || 'Eroare la plasarea comenzii';
        setErrors({ checkout: errorMsg });
      }
    } catch (error: any) {
      console.error('Checkout failed:', error);
      const errorMsg = error.message || 'Eroare la plasarea comenzii';
      setErrors({ checkout: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSavedAddress = (address: Address) => {
    const parsed = parseAddress(address.address);
    setFormData((prev) => ({
      ...prev,
      shipping_address: parsed,
    }));
  };

  const handleQuantityChange = async (productId: number, newQuantity: number) => {
    await updateQuantity(productId, newQuantity);
  };

  const handleRemoveItem = async (productId: number) => {
    await removeItem(productId);
  };

  const getPaymentMethodLabel = (method: PaymentMethod): string => {
    switch (method) {
      case 'CREDIT':
        return `Plată la Termen (Net ${paymentTerms} zile)`;
      case 'TRANSFER':
        return 'Transfer Bancar (OP)';
      case 'CASH':
        return 'Plată la Livrare';
      default:
        return method;
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[
        { num: 1, label: 'Rezumat' },
        { num: 2, label: 'Adrese' },
        { num: 3, label: 'Confirmare' },
      ].map((s, idx) => (
        <React.Fragment key={s.num}>
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-full font-semibold text-lg transition-all ${
                step >= s.num ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s.num ? <CheckCircle size={24} /> : s.num}
            </div>
            <span
              className={`text-xs mt-1 font-medium ${step >= s.num ? 'text-blue-600' : 'text-gray-400'}`}
            >
              {s.label}
            </span>
          </div>
          {idx < 2 && (
            <div
              className={`w-20 h-1 mx-4 rounded transition-all ${
                step > s.num ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderConfirmation = () => (
    <div className="text-center py-8">
      <div className="mb-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={48} className="text-green-500" />
        </div>
      </div>
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Comandă Plasată cu Succes!</h2>
      <p className="text-gray-500 mb-6">Vă mulțumim pentru comandă</p>

      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6 mb-6 inline-block shadow-lg">
        <p className="text-sm opacity-90 mb-1">Număr Comandă</p>
        <p className="text-4xl font-bold tracking-wide">{checkoutResult?.order_number}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Total Comandă</p>
          <p className="text-xl font-bold text-gray-800">{checkoutResult?.total.toFixed(2)} RON</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Scadență</p>
          <p className="text-xl font-bold text-gray-800">
            {checkoutResult?.payment_due_date
              ? new Date(checkoutResult.payment_due_date).toLocaleDateString('ro-RO')
              : '-'}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Termen Plată</p>
          <p className="text-xl font-bold text-gray-800">
            Net {checkoutResult?.payment_terms_days || paymentTerms} zile
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Credit Rămas</p>
          <p
            className={`text-xl font-bold ${(checkoutResult?.credit_remaining ?? creditRemaining) >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {(checkoutResult?.credit_remaining ?? creditRemaining).toFixed(2)} RON
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto mb-6">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 text-left">
            Un email de confirmare a fost trimis către adresa dvs. de email. Veți primi factura
            proforma în curând.
          </p>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => navigate('/b2b-portal/orders')}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors"
        >
          Vezi Comenzile
        </button>
        <button
          onClick={() => navigate('/b2b-store/catalog')}
          className="px-8 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          Continuă Cumpărăturile
        </button>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <div className="flex items-center text-white">
          <div className="bg-white/20 p-2 rounded-lg mr-3">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Pasul 1: Rezumat Comandă</h2>
            <p className="text-sm opacity-90">Verifică produsele și validează stocul</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <Package size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4 text-lg">Coșul este gol</p>
            <Link
              to="/b2b-store/catalog"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Continuă cumpărăturile
              <ChevronRight size={20} className="ml-2" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {validating && (
              <div className="flex items-center justify-center py-4 text-blue-600">
                <Loader2 className="animate-spin mr-2" size={20} />
                <span>Se validează stocul...</span>
              </div>
            )}

            {stockValidation && !stockValidation.valid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center text-red-700 mb-2">
                  <AlertCircle size={20} className="mr-2" />
                  <span className="font-semibold">Produse cu stoc insuficient</span>
                </div>
                <ul className="text-sm text-red-600 space-y-1 ml-7">
                  {stockValidation.errors.map((err, idx) => (
                    <li key={idx}>
                      {err.product_name || `Produs ${err.product_id}`}: solicitat {err.requested},
                      disponibil {err.available}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {cartItems.map((item) => (
                <div key={item.id} className="py-4 flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={32} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-800">{item.name}</h3>
                        <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                        {stockWarnings[item.productId] && (
                          <p className="text-xs text-orange-600 flex items-center mt-1">
                            <AlertCircle size={12} className="mr-1" />
                            Stoc limitat
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}
                          className="w-8 h-8 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center font-medium"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(item.productId, parseInt(e.target.value) || 0)
                          }
                          className="w-16 h-8 border border-gray-300 rounded-lg text-center font-medium"
                          min="1"
                        />
                        <button
                          onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}
                          className="w-8 h-8 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center font-medium"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-800">
                          {(item.price * item.quantity).toFixed(2)} RON
                        </p>
                        <p className="text-sm text-gray-500">{item.price.toFixed(2)} RON / buc</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {errors.minOrder && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center text-yellow-700">
                  <AlertCircle size={20} className="mr-2" />
                  <span>{errors.minOrder}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleNextStep}
              disabled={validating || (stockValidation !== null && !stockValidation.valid)}
              className="w-full mt-4 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center font-medium text-lg transition-colors"
            >
              Continuă la Adrese
              <ChevronRight size={24} className="ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <div className="flex items-center text-white">
          <div className="bg-white/20 p-2 rounded-lg mr-3">
            <Truck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Pasul 2: Adrese</h2>
            <p className="text-sm opacity-90">Adresa de livrare și facturare</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {savedAddresses.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adrese Salvate</label>
            <div className="grid grid-cols-2 gap-2">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className="text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <p className="font-medium text-sm text-gray-800">{addr.label}</p>
                  <p className="text-xs text-gray-500 truncate">{addr.address}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin size={16} className="inline mr-1" />
            Adresa de Livrare <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Stradă, Număr *"
                className={`w-full border p-3 rounded-lg ${errors.shipping_street ? 'border-red-500' : 'border-gray-300'}`}
                value={formData.shipping_address.street}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shipping_address: { ...formData.shipping_address, street: e.target.value },
                  })
                }
              />
              {errors.shipping_street && (
                <p className="text-red-500 text-xs mt-1">{errors.shipping_street}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                placeholder="Oraș *"
                className={`w-full border p-3 rounded-lg ${errors.shipping_city ? 'border-red-500' : 'border-gray-300'}`}
                value={formData.shipping_address.city}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shipping_address: { ...formData.shipping_address, city: e.target.value },
                  })
                }
              />
              {errors.shipping_city && (
                <p className="text-red-500 text-xs mt-1">{errors.shipping_city}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                placeholder="Județ"
                className="w-full border p-3 rounded-lg border-gray-300"
                value={formData.shipping_address.state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shipping_address: { ...formData.shipping_address, state: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Cod Poștal *"
                className={`w-full border p-3 rounded-lg ${errors.shipping_postal ? 'border-red-500' : 'border-gray-300'}`}
                value={formData.shipping_address.postal_code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shipping_address: { ...formData.shipping_address, postal_code: e.target.value },
                  })
                }
              />
              {errors.shipping_postal && (
                <p className="text-red-500 text-xs mt-1">{errors.shipping_postal}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                placeholder="Țară"
                className="w-full border p-3 rounded-lg border-gray-300"
                value={formData.shipping_address.country}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shipping_address: { ...formData.shipping_address, country: e.target.value },
                  })
                }
              />
            </div>
          </div>
        </div>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.use_different_billing}
            onChange={(e) => setFormData({ ...formData, use_different_billing: e.target.checked })}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Folosește adresă de facturare diferită</span>
        </label>

        {formData.use_different_billing && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building size={16} className="inline mr-1" />
              Adresa de Facturare <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Stradă, Număr *"
                  className={`w-full border p-3 rounded-lg ${errors.billing_street ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.billing_address.street}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billing_address: { ...formData.billing_address, street: e.target.value },
                    })
                  }
                />
                {errors.billing_street && (
                  <p className="text-red-500 text-xs mt-1">{errors.billing_street}</p>
                )}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Oraș *"
                  className={`w-full border p-3 rounded-lg ${errors.billing_city ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.billing_address.city}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billing_address: { ...formData.billing_address, city: e.target.value },
                    })
                  }
                />
                {errors.billing_city && (
                  <p className="text-red-500 text-xs mt-1">{errors.billing_city}</p>
                )}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Cod Poștal *"
                  className={`w-full border p-3 rounded-lg ${errors.billing_postal ? 'border-red-500' : 'border-gray-300'}`}
                  value={formData.billing_address.postal_code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      billing_address: { ...formData.billing_address, postal_code: e.target.value },
                    })
                  }
                />
                {errors.billing_postal && (
                  <p className="text-red-500 text-xs mt-1">{errors.billing_postal}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User size={16} className="inline mr-1" />
              Persoana Contact <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`w-full border p-3 rounded-lg ${errors.contact_name ? 'border-red-500' : 'border-gray-300'}`}
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            />
            {errors.contact_name && (
              <p className="text-red-500 text-xs mt-1">{errors.contact_name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone size={16} className="inline mr-1" />
              Telefon <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`w-full border p-3 rounded-lg ${errors.contact_phone ? 'border-red-500' : 'border-gray-300'}`}
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            />
            {errors.contact_phone && (
              <p className="text-red-500 text-xs mt-1">{errors.contact_phone}</p>
            )}
          </div>
        </div>

        <div>
          <input
            type="text"
            placeholder="Număr Comandă Achiziție (PO) - opțional"
            className="w-full border p-3 rounded-lg border-gray-300"
            value={formData.purchase_order_number}
            onChange={(e) => setFormData({ ...formData, purchase_order_number: e.target.value })}
          />
        </div>

        <div>
          <textarea
            placeholder="Observații pentru comandă (opțional)"
            className="w-full border p-3 rounded-lg border-gray-300"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
          />
        </div>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.save_address}
            onChange={(e) => setFormData({ ...formData, save_address: e.target.checked })}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Salvează adresa pentru comenzi viitoare</span>
        </label>

        {formData.save_address && (
          <div>
            <input
              type="text"
              placeholder="Etichetă adresă (ex: Sediu, Depozit) *"
              className={`w-full border p-3 rounded-lg ${errors.address_label ? 'border-red-500' : 'border-gray-300'}`}
              value={formData.address_label}
              onChange={(e) => setFormData({ ...formData, address_label: e.target.value })}
            />
            {errors.address_label && (
              <p className="text-red-500 text-xs mt-1">{errors.address_label}</p>
            )}
          </div>
        )}

        {errors.credit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center text-red-700">
              <AlertCircle size={20} className="mr-2" />
              <span>{errors.credit}</span>
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            onClick={() => setStep(1)}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center font-medium transition-colors"
          >
            <ChevronLeft size={20} className="mr-1" />
            Înapoi
          </button>
          <button
            onClick={handleNextStep}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium transition-colors"
          >
            Continuă la Confirmare
            <ChevronRight size={20} className="ml-2" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <div className="flex items-center text-white">
          <div className="bg-white/20 p-2 rounded-lg mr-3">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Pasul 3: Confirmare Comandă</h2>
            <p className="text-sm opacity-90">Verifică și plasează comanda</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
            <Package size={18} className="mr-2" />
            Produse Comandate ({cartItems.length})
          </h3>
          <div className="space-y-2 text-sm">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="flex justify-between py-2 border-b border-gray-200 last:border-0"
              >
                <div>
                  <span className="font-medium text-gray-800">{item.name}</span>
                  <span className="text-gray-500 ml-2">x{item.quantity}</span>
                </div>
                <span className="font-medium">{(item.price * item.quantity).toFixed(2)} RON</span>
              </div>
            ))}
            <div className="flex justify-between pt-2">
              <span className="text-gray-500">Subtotal</span>
              <span>{subtotal.toFixed(2)} RON</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({discountPercent}%)</span>
                <span>-{discountAmount.toFixed(2)} RON</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">TVA (19%)</span>
              <span>{tax.toFixed(2)} RON</span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-blue-600">{total.toFixed(2)} RON</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
            <MapPin size={18} className="mr-2" />
            Adrese
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Livrare</p>
              <p className="text-sm text-gray-800">{formatAddress(formData.shipping_address)}</p>
            </div>
            {formData.use_different_billing && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">Facturare</p>
                <p className="text-sm text-gray-800">{formatAddress(formData.billing_address)}</p>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Contact</p>
              <p className="text-sm font-medium">{formData.contact_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Telefon</p>
              <p className="text-sm font-medium">{formData.contact_phone}</p>
            </div>
          </div>
          {formData.purchase_order_number && (
            <div className="mt-2">
              <p className="text-xs text-gray-500">PO Number</p>
              <p className="text-sm font-medium">{formData.purchase_order_number}</p>
            </div>
          )}
          {formData.notes && (
            <div className="mt-2">
              <p className="text-xs text-gray-500">Observații</p>
              <p className="text-sm">{formData.notes}</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Metodă de Plată</label>
          <div className="space-y-2">
            {(['CREDIT', 'TRANSFER', 'CASH'] as PaymentMethod[]).map((method) => (
              <label
                key={method}
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                  formData.payment_method === method
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={formData.payment_method === method}
                  onChange={() => setFormData({ ...formData, payment_method: method })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-3 font-medium">{getPaymentMethodLabel(method)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-blue-700">
              <Calendar size={18} className="mr-2" />
              <span className="font-medium">Termen de Plată</span>
            </div>
            <span className="font-bold text-blue-700">Net {paymentTerms} zile</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center text-blue-700">
              <Wallet size={18} className="mr-2" />
              <span className="font-medium">Credit Rămas după Comandă</span>
            </div>
            <span
              className={`font-bold ${creditRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {creditRemaining.toFixed(2)} RON
            </span>
          </div>
        </div>

        {errors.checkout && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center text-red-700">
              <AlertCircle size={20} className="mr-2" />
              <span>{errors.checkout}</span>
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            onClick={() => setStep(2)}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center font-medium transition-colors"
          >
            <ChevronLeft size={20} className="mr-1" />
            Înapoi
          </button>
          <button
            onClick={handlePlaceOrder}
            disabled={loading || cartItems.length === 0}
            className="flex-1 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center font-semibold text-lg transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={24} />
                Se procesează...
              </>
            ) : (
              <>
                <CheckCircle size={24} className="mr-2" />
                Plasează Comanda
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <div className="bg-white rounded-xl shadow-md p-6 sticky top-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Sumar Comandă</h3>

      {customerProfile && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm opacity-90">Tier</span>
            <span className="font-bold">{customerProfile.tier}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm opacity-90">Credit Disponibil</span>
            <span className="font-bold">{customerProfile.credit_available.toFixed(2)} RON</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm opacity-90">Termen Plată</span>
            <span className="font-bold">Net {customerProfile.payment_terms_days} zile</span>
          </div>
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)} RON</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount ({discountPercent}%)</span>
            <span>-{discountAmount.toFixed(2)} RON</span>
          </div>
        )}
        <div className="flex justify-between text-gray-600">
          <span>TVA (19%)</span>
          <span>{tax.toFixed(2)} RON</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-xl">
          <span>Total</span>
          <span className="text-blue-600">{total.toFixed(2)} RON</span>
        </div>
      </div>

      {minOrderValue > 0 && (
        <div
          className={`p-3 rounded-lg text-sm ${
            total >= minOrderValue
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
          }`}
        >
          {total >= minOrderValue ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={16} />
              <span>Comandă validă (min. {minOrderValue.toFixed(2)} RON)</span>
            </div>
          ) : (
            <div>
              <div className="font-semibold mb-1">⚠️ Valoare minimă</div>
              <div>Necesită: {minOrderValue.toFixed(2)} RON</div>
              <div>Lipsă: {(minOrderValue - total).toFixed(2)} RON</div>
            </div>
          )}
        </div>
      )}

      {step === 3 && creditRemaining < 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-700">
            <AlertCircle size={16} className="mr-2" />
            <span className="font-medium">Credit insuficient</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Finalizare Comandă B2B</h1>
        <p className="text-gray-500 mt-1">Completează cei 3 pași pentru a plasa comanda</p>
      </div>

      {step < 4 && renderStepIndicator()}

      {step === 4 && checkoutResult ? (
        renderConfirmation()
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          <div className="lg:col-span-1">{renderSidebar()}</div>
        </div>
      )}
    </div>
  );
};
