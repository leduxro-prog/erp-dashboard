import axios, { AxiosInstance } from 'axios';
import { useB2BAuthStore } from '../stores/b2b/b2b-auth.store';

export interface CartItem {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  base_price: number;
  discount_percent: number;
  discounted_price: number;
  subtotal: number;
  stock_available: number;
  stock_warning: boolean;
  image_url?: string;
}

export interface CartData {
  cart_id: string;
  customer_id: string;
  tier: string;
  discount_percent: number;
  items: CartItem[];
  item_count: number;
  total_items: number;
  subtotal: number;
  discount_amount: number;
  subtotal_with_discount: number;
  tax_amount: number;
  total_with_tax: number;
  currency: string;
}

class B2BApiClient {
  private client: AxiosInstance;

  private unwrapData(payload: any) {
    return payload?.data ?? payload;
  }

  private normalizeOrder(order: any) {
    return {
      ...order,
      id: order?.id ?? order?.order_id ?? order?.order_number,
      orderNumber: order?.orderNumber ?? order?.order_number,
      createdAt: order?.createdAt ?? order?.created_at,
      totalAmount: order?.totalAmount ?? order?.total_amount ?? order?.total,
    };
  }

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const { token } = useB2BAuthStore.getState();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const { refreshToken, logout } = useB2BAuthStore.getState();
          if (refreshToken) {
            try {
              const response = await this.refreshToken(refreshToken);
              useB2BAuthStore
                .getState()
                .login(
                  response.token,
                  response.refresh_token,
                  useB2BAuthStore.getState().customer!,
                );
              error.config.headers.Authorization = `Bearer ${response.token}`;
              return this.client(error.config);
            } catch (refreshError) {
              logout();
              window.location.href = '/b2b-store/login';
            }
          } else {
            logout();
            window.location.href = '/b2b-store/login';
          }
        }
        return Promise.reject(error);
      },
    );
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/b2b-auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string; emailRegistered?: boolean }> {
    const response = await this.client.post('/b2b-auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/b2b-auth/reset-password', { token, password });
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/b2b-auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  }

  async logout() {
    await this.client.post('/b2b-auth/logout');
  }

  async getCustomerProfile() {
    const customerId = useB2BAuthStore.getState().customer?.customer_id;
    if (!customerId) {
      throw new Error('Missing B2B customer context');
    }
    const response = await this.client.get(`/b2b/customers/${customerId}`);
    return this.unwrapData(response.data);
  }

  async getOrders(params?: { page?: number; limit?: number }) {
    const response = await this.client.get('/b2b/orders', { params });
    const data = this.unwrapData(response.data);
    const orders = Array.isArray(data?.orders)
      ? data.orders.map((order: any) => this.normalizeOrder(order))
      : [];
    return {
      ...data,
      orders,
      total: data?.pagination?.total ?? data?.total ?? orders.length,
    };
  }

  async getOrderDetails(orderId: string) {
    const response = await this.client.get(`/b2b/orders/${orderId}`);
    const data = this.unwrapData(response.data);
    return this.normalizeOrder(data);
  }

  async createOrder(orderData: any) {
    const response = await this.client.post('/b2b/orders', orderData);
    const data = this.unwrapData(response.data);
    return this.normalizeOrder(data);
  }

  async getCart(): Promise<CartData> {
    const response = await this.client.get('/b2b/cart');
    return this.unwrapData(response.data);
  }

  async addToCart(
    productId: string,
    quantity: number = 1,
  ): Promise<{ cart_id: string; item_added: any }> {
    const response = await this.client.post('/b2b/cart/item', {
      product_id: productId,
      quantity,
    });
    return this.unwrapData(response.data);
  }

  async updateCartItem(
    itemId: string,
    quantity: number,
  ): Promise<{ cart_id: string; item_id: string; new_quantity: number; removed: boolean }> {
    const response = await this.client.put(`/b2b/cart/item/${itemId}`, { quantity });
    return this.unwrapData(response.data);
  }

  async removeCartItem(
    itemId: string,
  ): Promise<{ cart_id: string; removed_item: string; remaining_items: number }> {
    const response = await this.client.delete(`/b2b/cart/item/${itemId}`);
    return this.unwrapData(response.data);
  }

  async clearCart(): Promise<{ cart_id: string; cleared: boolean }> {
    const response = await this.client.delete('/b2b/cart/clear');
    return this.unwrapData(response.data);
  }

  async validateStock(): Promise<{ valid: boolean; issues: any[] }> {
    const response = await this.client.get('/b2b/cart/validate-stock');
    return this.unwrapData(response.data);
  }

  async getSavedCarts() {
    const response = await this.client.get('/b2b/carts');
    const data = this.unwrapData(response.data);
    return data;
  }

  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    kelvin?: string[];
    ip?: string[];
    min_price?: number;
    max_price?: number;
    sort?: string;
  }) {
    const response = await this.client.get('/b2b/products', { params });
    const data = this.unwrapData(response.data);
    return {
      ...data,
      products: Array.isArray(data?.products) ? data.products : [],
    };
  }

  async getFilters() {
    const response = await this.client.get('/b2b/products/filters');
    return this.unwrapData(response.data);
  }

  async getCategories() {
    const response = await this.client.get('/b2b/products/categories');
    return this.unwrapData(response.data);
  }

  async getInvoices(params?: {
    page?: number;
    limit?: number;
    status?: string;
    payment_status?: string;
  }) {
    const response = await this.client.get('/b2b/invoices', { params });
    const data = this.unwrapData(response.data);
    return {
      invoices: Array.isArray(data?.invoices) ? data.invoices : [],
      pagination: data?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 },
    };
  }

  async getInvoiceDetails(invoiceId: string) {
    const response = await this.client.get(`/b2b/invoices/${invoiceId}`);
    return this.unwrapData(response.data);
  }

  async downloadInvoice(invoiceId: string, invoiceNumber: string): Promise<void> {
    const response = await this.client.get(`/b2b/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Factura_${invoiceNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async previewInvoice(invoiceId: string): Promise<void> {
    const response = await this.client.get(`/b2b/invoices/${invoiceId}/preview`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  }

  async getCredit(): Promise<{
    credit_limit: number;
    credit_used: number;
    credit_available: number;
    pending_orders: number;
    pending_orders_value: number;
    payment_terms_days: number;
    tier: string;
    tier_discount_percentage: number;
    total_discount_percentage: number;
  }> {
    const response = await this.client.get('/b2b/credit');
    return this.unwrapData(response.data);
  }

  async getAddresses(): Promise<{ addresses: any[] }> {
    const response = await this.client.get('/b2b/addresses');
    const data = this.unwrapData(response.data);
    return {
      addresses: Array.isArray(data?.addresses) ? data.addresses : [],
    };
  }

  async createAddress(addressData: any): Promise<any> {
    const response = await this.client.post('/b2b/addresses', addressData);
    return this.unwrapData(response.data);
  }

  async updateAddress(addressId: string, addressData: any): Promise<any> {
    const response = await this.client.put(`/b2b/addresses/${addressId}`, addressData);
    return this.unwrapData(response.data);
  }

  async deleteAddress(addressId: string): Promise<void> {
    await this.client.delete(`/b2b/addresses/${addressId}`);
  }

  async setDefaultAddress(addressId: string, type: 'shipping' | 'billing'): Promise<any> {
    const response = await this.client.put(`/b2b/addresses/${addressId}/default`, { type });
    return this.unwrapData(response.data);
  }

  async importCSV(file: File): Promise<CSVImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post('/b2b/orders/import-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return this.unwrapData(response.data);
  }

  async importCSVAddToCart(
    items: Array<{ product_id: string | number; quantity: number; notes?: string }>,
  ): Promise<{
    cart_id: number;
    added_count: number;
    updated_count: number;
    total_processed: number;
    items: Array<{
      product_id: number;
      sku: string;
      product_name: string;
      quantity: number;
      action: 'added' | 'updated';
    }>;
    message: string;
  }> {
    const response = await this.client.post('/b2b/orders/import-csv/add-to-cart', { items });
    return this.unwrapData(response.data);
  }

  async getDashboardStats() {
    const response = await this.client.get('/b2b/dashboard/stats');
    return this.unwrapData(response.data);
  }

  async getNotifications() {
    const response = await this.client.get('/b2b/notifications');
    return this.unwrapData(response.data);
  }

  async getFavoriteProducts() {
    const response = await this.client.get('/b2b/products/favorites');
    return this.unwrapData(response.data);
  }

  async getNewProducts() {
    const response = await this.client.get('/b2b/products/new');
    return this.unwrapData(response.data);
  }

  async getPromoProducts() {
    const response = await this.client.get('/b2b/products/promo');
    return this.unwrapData(response.data);
  }

  async getPayments(params?: {
    from?: string;
    to?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/b2b/payments', { params });
    const data = this.unwrapData(response.data);
    return {
      payments: Array.isArray(data?.payments) ? data.payments : [],
      pagination: data?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 },
      summary: data?.summary || { total_paid: 0, total_pending: 0, total_overdue: 0 },
    };
  }
}

export interface CSVImportResult {
  valid_items: Array<{
    product_id: string | number;
    sku: string;
    product_name: string;
    quantity: number;
    base_price: number;
    unit_price: number;
    stock_available: number;
    notes?: string;
  }>;
  invalid_items: Array<{
    sku: string;
    quantity: number;
    reason: string;
    notes?: string;
  }>;
  parse_errors: Array<{
    line: number;
    error: string;
  }>;
  total_items: number;
  valid_count: number;
  invalid_count: number;
  parse_error_count: number;
  tier_discount_percent: number;
  customer_discount_percent: number;
  total_discount_percent: number;
  subtotal: number;
  subtotal_with_discount: number;
}

export const b2bApi = new B2BApiClient();
