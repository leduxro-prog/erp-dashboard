import { apiClient } from './api';

// Types
export interface StockLevel {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  imageUrl: string | null;
  warehouseId: string;
  warehouseName: string;
  current: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  status: 'Critic' | 'Atentionare' | 'Normal';
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVATION' | 'RELEASE';
  quantity: number;
  quantityAfter: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  isActive: boolean;
}

export interface LowStockAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  reorderPoint: number;
  shortage: number;
  severity: 'low' | 'medium' | 'high';
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt: string;
}

class WMSService {
  // Stock Levels
  async getStockLevels(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ items: StockLevel[]; pagination: any }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.search) queryParams.set('search', params.search);

    const queryString = queryParams.toString();
    return apiClient.get<{ items: StockLevel[]; pagination: any }>(
      `/inventory/products${queryString ? `?${queryString}` : ''}`
    );
  }

  async getStockLevel(productId: string): Promise<StockLevel> {
    return apiClient.get<StockLevel>(`/inventory/${productId}`);
  }

  // Stock Check
  async checkStockBatch(productIds: string[]): Promise<Record<string, any>> {
    return apiClient.post<Record<string, any>>('/inventory/check', { productIds });
  }

  // Stock Adjustment
  async adjustStock(data: {
    productId: string;
    warehouseId?: string;
    quantity: number;
    reason: string;
  }): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/inventory/adjust', data);
  }

  // Stock Reservations
  async reserveStock(data: {
    orderId: string;
    items: Array<{ productId: string; quantity: number }>;
    expiresAt?: string;
  }): Promise<any> {
    return apiClient.post<any>('/inventory/reserve', data);
  }

  async releaseReservation(reservationId: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/inventory/reservations/${reservationId}`);
  }

  // Movement History
  async getMovementHistory(productId: string, params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<StockMovement[]> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const queryString = queryParams.toString();
    return apiClient.get<StockMovement[]>(
      `/inventory/${productId}/movements${queryString ? `?${queryString}` : ''}`
    );
  }

  // Low Stock Alerts
  async getLowStockAlerts(params?: {
    acknowledged?: boolean;
    severity?: string;
  }): Promise<LowStockAlert[]> {
    const queryParams = new URLSearchParams();
    if (params?.acknowledged !== undefined) {
      queryParams.set('acknowledged', params.acknowledged.toString());
    }
    if (params?.severity) queryParams.set('severity', params.severity);

    const queryString = queryParams.toString();
    return apiClient.get<LowStockAlert[]>(
      `/inventory/alerts${queryString ? `?${queryString}` : ''}`
    );
  }

  async acknowledgeAlert(alertId: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`/inventory/alerts/${alertId}/acknowledge`);
  }

  // Warehouses
  async getWarehouses(): Promise<Warehouse[]> {
    return apiClient.get<Warehouse[]>('/inventory/warehouses');
  }

  // Sync
  async syncSmartBill(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/inventory/sync/smartbill');
  }

  async syncSuppliers(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/inventory/sync/suppliers');
  }

  // Product Images
  async addProductImage(productId: string, data: {
    imageUrl: string;
    altText?: string;
    isPrimary?: boolean;
  }): Promise<any> {
    return apiClient.post<any>(`/inventory/products/${productId}/images`, data);
  }

  async deleteProductImage(productId: string, imageId: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/inventory/products/${productId}/images/${imageId}`);
  }

  async bulkImportImages(images: Array<{
    sku: string;
    imageUrl: string;
    altText?: string;
    isPrimary?: boolean;
  }>): Promise<any> {
    return apiClient.post<any>('/inventory/products/images/bulk-import', { images });
  }

  async autoSearchProductImages(params?: {
    limit?: number;
    skipExisting?: boolean;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.skipExisting !== undefined) {
      queryParams.set('skipExisting', params.skipExisting.toString());
    }

    const queryString = queryParams.toString();
    return apiClient.post<any>(
      `/inventory/products/images/auto-search${queryString ? `?${queryString}` : ''}`
    );
  }
}

export const wmsService = new WMSService();
export default wmsService;
