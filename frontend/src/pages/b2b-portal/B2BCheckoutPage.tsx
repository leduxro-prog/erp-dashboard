import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cart.store';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';
import { b2bApi } from '../../services/b2b-api';

interface CustomerProfile {
  id: number;
  company_name: string;
  tier: string;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
  payment_terms_days: number;
  discount_percentage: number;
}

interface Address {
  id: number;
  label: string;
  address: string;
  address_type: string;
  is_default: boolean;
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
  created_at: string;
  items: Array<{
    product_id: number;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

const formatPrice = (amount: number) => {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const B2BCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, tier, getSubtotalWithDiscount, getTax, getTotal, clearCart } = useCartStore();
  const { customer, isAuthenticated } = useB2BAuthStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [stockValidation, setStockValidation] = useState<StockValidation | null>(null);
  const [creditValid, setCreditValid] = useState<boolean | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    shipping_address: { street: '', city: '', state: '', postal_code: '', country: 'Romania' },
    use_different_billing: false,
    billing_address: { street: '', city: '', state: '', postal_code: '', country: 'Romania' },
    contact_name: '',
    contact_phone: '',
    payment_method: 'CREDIT' as 'CREDIT' | 'TRANSFER' | 'CASH',
    notes: '',
    purchase_order_number: '',
    save_address: false,
    address_label: '',
  });

  const subtotal = getSubtotalWithDiscount();
  const taxAmount = getTax();
  const total = getTotal();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/b2b-store/login?redirect=/b2b-portal/checkout');
      return;
    }
    fetchProfile();
    fetchAddresses();
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (items.length > 0 && step === 1) {
      validateStock();
    }
  }, [items, step]);

  const fetchProfile = async () => {
    try {
      const profile = await b2bApi.getCustomerProfile();
      setCustomerProfile(profile as CustomerProfile);
      if (profile) {
        setFormData((prev) => ({
          ...prev,
          contact_name: customer?.company_name || '',
        }));
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const fetchAddresses = async () => {
    try {
      const response = await fetch('/api/v1/b2b/checkout/addresses', {
        headers: {
          Authorization: `Bearer ${useB2BAuthStore.getState().token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSavedAddresses(data.data);
        const defaultAddr = data.data.find((a: Address) => a.is_default);
        if (defaultAddr) {
          const parts = defaultAddr.address.split(', ');
          setFormData((prev) => ({
            ...prev,
            shipping_address: {
              street: parts[0] || '',
              city: parts[1] || '',
              state: parts[2] || '',
              postal_code: parts[3] || '',
              country: parts[4] || 'Romania',
            },
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
    }
  };

  const validateStock = async () => {
    try {
      const response = await fetch('/api/v1/b2b/checkout/validate-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useB2BAuthStore.getState().token}`,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await response.json();
      setStockValidation(data.data || data);
    } catch (err) {
      console.error('Stock validation failed:', err);
      setStockValidation({ valid: false, errors: [] });
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
      if (data.data?.valid) {
        setCreditValid(true);
        return true;
      } else {
        setErrors({ credit: data.data?.error || data.data?.reason || 'Insufficient credit' });
        setCreditValid(false);
        return false;
      }
    } catch (err: any) {
      setErrors({ credit: err.message || 'Credit validation failed' });
      return false;
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (items.length === 0) newErrors.cart = 'Cart is empty';
    if (stockValidation && !stockValidation.valid) {
      newErrors.stock = `${stockValidation.errors.length} items have insufficient stock`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    const sa = formData.shipping_address;
    if (!sa.street.trim()) newErrors.shipping_street = 'Street is required';
    if (!sa.city.trim()) newErrors.shipping_city = 'City is required';
    if (!sa.postal_code.trim()) newErrors.shipping_postal = 'Postal code is required';
    if (!formData.contact_name.trim()) newErrors.contact_name = 'Contact name is required';
    if (!formData.contact_phone.trim()) newErrors.contact_phone = 'Phone is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = async () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      const creditOk = await validateCredit();
      if (creditOk) setStep(3);
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
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
          items: items.map((item) => ({
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

      if (data.success) {
        setCheckoutResult(data.data);
        clearCart();
        setStep(4);
      } else {
        setErrors({ checkout: data.error?.message || data.message || 'Checkout failed' });
      }
    } catch (err: any) {
      setErrors({ checkout: err.message || 'Checkout failed' });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CREDIT':
        return `Pay on Terms (${customerProfile?.payment_terms_days || 30} days)`;
      case 'TRANSFER':
        return 'Bank Transfer';
      case 'CASH':
        return 'Cash on Delivery';
      default:
        return method;
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step > s ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              s
            )}
          </div>
          {s < 3 && <div className={`w-16 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  if (step === 4 && checkoutResult) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Order Placed Successfully!</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 inline-block">
          <p className="text-sm text-gray-600 mb-2">Order Number</p>
          <p className="text-3xl font-bold text-blue-600">{checkoutResult.order_number}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-lg font-semibold">{formatPrice(checkoutResult.total)}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Payment Due</p>
            <p className="text-lg font-semibold">{formatDate(checkoutResult.payment_due_date)}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Payment Method</p>
            <p className="text-lg font-semibold">
              {getPaymentMethodLabel(checkoutResult.payment_method)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-lg font-semibold text-yellow-600 capitalize">
              {checkoutResult.status}
            </p>
          </div>
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/b2b-portal/orders')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Orders
          </button>
          <button
            onClick={() => navigate('/b2b-portal/catalog')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">B2B Checkout</h1>

      {renderStepIndicator()}

      {Object.values(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          {Object.values(errors).map((err, idx) => (
            <p key={idx} className="text-red-700 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {err}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {step === 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <svg
                  className="w-6 h-6 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                1. Cart Review & Stock Validation
              </h2>

              {stockValidation && !stockValidation.valid && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="font-medium text-yellow-800 mb-2">
                    Some items have insufficient stock:
                  </p>
                  <ul className="text-sm text-yellow-700">
                    {stockValidation.errors.map((err, idx) => (
                      <li key={idx}>
                        {err.product_name || `Product ${err.product_id}`}: requested {err.requested}
                        , available {err.available}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleNextStep}
                disabled={Boolean(stockValidation && !stockValidation.valid)}
                className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
              >
                Continue to Delivery
                <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <svg
                  className="w-6 h-6 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                </svg>
                2. Delivery & Billing Address
              </h2>

              {savedAddresses.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Saved Addresses
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        onClick={() => {
                          const parts = addr.address.split(', ');
                          setFormData((prev) => ({
                            ...prev,
                            shipping_address: {
                              street: parts[0] || '',
                              city: parts[1] || '',
                              state: parts[2] || '',
                              postal_code: parts[3] || '',
                              country: parts[4] || 'Romania',
                            },
                          }));
                        }}
                        className="text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300"
                      >
                        <p className="font-medium text-sm">{addr.label}</p>
                        <p className="text-xs text-gray-500 truncate">{addr.address}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg p-2 ${errors.shipping_street ? 'border-red-500' : ''}`}
                    value={formData.shipping_address.street}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shipping_address: { ...prev.shipping_address, street: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      className={`w-full border rounded-lg p-2 ${errors.shipping_city ? 'border-red-500' : ''}`}
                      value={formData.shipping_address.city}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          shipping_address: { ...prev.shipping_address, city: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      className={`w-full border rounded-lg p-2 ${errors.shipping_postal ? 'border-red-500' : ''}`}
                      value={formData.shipping_address.postal_code}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          shipping_address: {
                            ...prev.shipping_address,
                            postal_code: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      className={`w-full border rounded-lg p-2 ${errors.contact_name ? 'border-red-500' : ''}`}
                      value={formData.contact_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, contact_name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input
                      type="text"
                      className={`w-full border rounded-lg p-2 ${errors.contact_phone ? 'border-red-500' : ''}`}
                      value={formData.contact_phone}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, contact_phone: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Order Number (Optional)
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2"
                    value={formData.purchase_order_number}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, purchase_order_number: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full border rounded-lg p-2"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleNextStep}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Continue to Confirmation
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <svg
                  className="w-6 h-6 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                3. Confirm & Place Order
              </h2>

              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">VAT (19%)</span>
                      <span>{formatPrice(taxAmount)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  {(['CREDIT', 'TRANSFER', 'CASH'] as const).map((method) => (
                    <label
                      key={method}
                      className={`flex items-center p-3 border rounded-lg mb-2 cursor-pointer ${formData.payment_method === method ? 'border-blue-500 bg-blue-50' : ''}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={formData.payment_method === method}
                        onChange={() =>
                          setFormData((prev) => ({ ...prev, payment_method: method }))
                        }
                        className="mr-3"
                      />
                      <span>{getPaymentMethodLabel(method)}</span>
                    </label>
                  ))}
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Delivery Address</h3>
                  <p className="text-sm text-gray-600">
                    {formData.shipping_address.street}, {formData.shipping_address.city},{' '}
                    {formData.shipping_address.postal_code}
                  </p>
                  <p className="text-sm text-gray-600">
                    Contact: {formData.contact_name}, {formData.contact_phone}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Place Order
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>

            {customerProfile && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Tier:</span>
                  <span className="font-semibold text-blue-700">{customerProfile.tier}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Available Credit:</span>
                  <span className="font-semibold text-green-600">
                    {formatPrice(customerProfile.credit_available)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Terms:</span>
                  <span className="font-semibold">
                    Net {customerProfile.payment_terms_days} days
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT (19%)</span>
                <span>{formatPrice(taxAmount)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {customerProfile && total > customerProfile.credit_available && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <p className="font-medium">Insufficient Credit</p>
                <p>
                  Order exceeds available credit by{' '}
                  {formatPrice(total - customerProfile.credit_available)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default B2BCheckoutPage;
