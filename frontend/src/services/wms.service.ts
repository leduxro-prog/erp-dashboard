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
  private mapStockStatus(current: number, minimum: number): 'Critic' | 'Atentionare' | 'Normal' {
    if (current <= Math.max(0, Math.floor(minimum * 0.5))) return 'Critic';
    if (current <= minimum) return 'Atentionare';
    return 'Normal';
  }

  // Stock Levels
  async getStockLevels(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ items: StockLevel[]; pagination: any }> {
    const page = Math.max(1, Number(params?.page || 1));
    const limit = Math.max(1, Number(params?.limit || 50));
    const search = String(params?.search || '').trim().toLowerCase();

    const [stockResponse, productsResponse] = await Promise.all([
      apiClient.get<any>('/inventory'),
      apiClient.get<any>('/b2b/products?page=1&limit=5000'),
    ]);

    const stockRows: any[] = Array.isArray(stockResponse?.data)
      ? stockResponse.data
      : Array.isArray(stockResponse)
        ? stockResponse
        : [];

    const productsRows: any[] = Array.isArray(productsResponse?.data?.items)
      ? productsResponse.data.items
      : Array.isArray(productsResponse?.data?.products)
        ? productsResponse.data.products
        : Array.isArray(productsResponse?.items)
          ? productsResponse.items
          : [];

    const productById = new Map<string, any>();
    for (const product of productsRows) {
      productById.set(String(product.id || product.product_id || ''), product);
    }

    const allItems: StockLevel[] = stockRows.map((row: any, index: number) => {
      const productId = String(row.product_id || row.productId || '');
      const product = productById.get(productId);
      const current = Number(row.quantity || 0);
      const reserved = Number(row.reserved_quantity || row.reserved || 0);
      const available = Number(row.available_quantity || Math.max(current - reserved, 0));
      const reorderPoint = Number(row.minimum_threshold || row.reorderPoint || 0);

      return {
        id: String(row.id || `${productId}-${row.warehouse_id || row.warehouseId || index}`),
        productId,
        sku: String(product?.sku || productId),
        name: String(product?.name || product?.product_name || `Product #${productId}`),
        price: Number(product?.price || 0),
        imageUrl: product?.image || product?.image_url || null,
        warehouseId: String(row.warehouse_id || row.warehouseId || '1'),
        warehouseName:
          row.warehouse_name || row.warehouseName || (String(row.warehouse_id || '1') === '1' ? 'Magazin' : `Warehouse ${row.warehouse_id}`),
        current,
        reserved,
        available,
        reorderPoint,
        status: this.mapStockStatus(available, reorderPoint),
        updatedAt: String(row.last_updated || row.updated_at || new Date().toISOString()),
      };
    });

    const filtered = search
      ? allItems.filter((item) =>
          item.name.toLowerCase().includes(search) || item.sku.toLowerCase().includes(search),
        )
      : allItems;

    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    };
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
    try {
      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.set('startDate', params.startDate);
      if (params?.endDate) queryParams.set('endDate', params.endDate);
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.offset) queryParams.set('offset', params.offset.toString());
      const queryString = queryParams.toString();
      const response: any = await apiClient.get(
        `/inventory/${productId}/movements${queryString ? `?${queryString}` : ''}`,
      );
      return Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
    } catch {
      return [];
    }
  }

  // Low Stock Alerts
  async getLowStockAlerts(params?: {
    acknowledged?: boolean;
    severity?: string;
  }): Promise<LowStockAlert[]> {
    const stock = await this.getStockLevels({ page: 1, limit: 5000 });
    return stock.items
      .filter((item) => item.status !== 'Normal')
      .map((item) => {
        const shortage = Math.max(item.reorderPoint - item.available, 0);
        return {
          id: `low-${item.id}`,
          productId: item.productId,
          productName: item.name,
          currentStock: item.available,
          reorderPoint: item.reorderPoint,
          shortage,
          severity: item.status === 'Critic' ? 'high' : 'medium',
          acknowledged: false,
          createdAt: item.updatedAt,
        } as LowStockAlert;
      })
      .filter((alert) => {
        if (params?.severity) return alert.severity === params.severity;
        if (params?.acknowledged !== undefined) return alert.acknowledged === params.acknowledged;
        return true;
      });
  }

  async acknowledgeAlert(alertId: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`/inventory/alerts/${alertId}/acknowledge`);
  }

  // Warehouses
  async getWarehouses(): Promise<Warehouse[]> {
    const response: any = await apiClient.get('/smartbill/warehouses');
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows.map((row: any) => ({
      id: String(row.warehouseId || row.id || ''),
      name: String(row.warehouseName || row.name || ''),
      address: row.address || undefined,
      isActive: true,
    }));
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
