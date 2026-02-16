import { apiClient } from './api';

interface WooProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  syncedAt?: string;
}

class WooCommerceService {
  async getProducts() {
    return apiClient.get<WooProduct[]>('/woocommerce/products');
  }

  async syncProducts() {
    return apiClient.post('/woocommerce/sync/products', {});
  }

  async syncOrders() {
    return apiClient.post('/woocommerce/sync/orders', {});
  }

  async getConnectionStatus() {
    return apiClient.get('/woocommerce/status');
  }
}

export const wooCommerceService = new WooCommerceService();
