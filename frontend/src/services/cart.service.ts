import api from './api';
import { LocalCartItem } from '../stores/cart.store';

export interface CheckoutAddress {
  street: string;
  city: string;
  state?: string;
  postal_code: string;
  country?: string;
}

export interface CheckoutRequest {
  items: Array<{
    product_id: number;
    sku?: string;
    quantity: number;
    price: number;
  }>;
  shipping_address: CheckoutAddress | string;
  billing_address?: CheckoutAddress | string;
  use_different_billing?: boolean;
  contact_name: string;
  contact_phone: string;
  payment_method: 'CREDIT' | 'TRANSFER' | 'CASH';
  notes?: string;
  purchase_order_number?: string;
  save_address?: boolean;
  address_label?: string;
}

export interface CheckoutResponse {
  success: boolean;
  data: {
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
  };
  message?: string;
}

export interface CreateOrderRequest {
  items: Array<{
    product_id: number;
    quantity: number;
    price: number;
  }>;
  shipping_address: string;
  contact_name: string;
  contact_phone: string;
  payment_method: 'credit' | 'bank_transfer';
  notes?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  data: {
    order_id: number;
    order_number: string;
    total: number;
    status: string;
    created_at: string;
  };
}

export const cartService = {
  async processCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const response = await api.post('/b2b/checkout', request);
    return response.data;
  },

  async validateStock(items: Array<{ product_id: number; quantity: number }>) {
    const response = await api.post('/b2b/checkout/validate-stock', { items });
    return response.data;
  },

  async validateCredit(amount: number) {
    const response = await api.post('/b2b/checkout/validate-credit', { amount });
    return response.data;
  },

  async getCustomerProfile() {
    const response = await api.get('/b2b/checkout/profile');
    return response.data;
  },

  async getSavedAddresses() {
    const response = await api.get('/b2b/checkout/addresses');
    return response.data;
  },

  async saveAddress(
    label: string,
    address: CheckoutAddress | string,
    addressType: 'shipping' | 'billing' | 'both' = 'both',
  ) {
    const response = await api.post('/b2b/checkout/addresses', {
      label,
      address,
      address_type: addressType,
    });
    return response.data;
  },

  /**
   * Create order from cart items (legacy - use processCheckout for full checkout)
   */
  async createOrder(
    items: LocalCartItem[],
    orderData: Omit<CreateOrderRequest, 'items'>,
  ): Promise<CreateOrderResponse> {
    const request: CreateOrderRequest = {
      items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      ...orderData,
    };

    const response = await api.post('/b2b/orders', request);
    return response.data;
  },

  /**
   * Get order history
   */
  async getOrders(page = 1, limit = 20) {
    const response = await api.get('/b2b/orders', {
      params: { page, limit },
    });
    return response.data;
  },

  /**
   * Get order details
   */
  async getOrderDetails(orderId: number) {
    const response = await api.get(`/b2b/orders/${orderId}`);
    return response.data;
  },
};
