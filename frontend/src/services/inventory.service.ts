import { apiClient } from './api';
import {
  StockLevel,
  StockMovement,
  StockAlert,
  Warehouse,
  StockMovementType,
} from '../types/inventory';
import { PaginatedResponse, PaginationParams } from '../types/common';

interface ProductImageUploadResult {
  image_url: string;
}

interface ProductImageSearchCandidate {
  url: string;
  source: string;
  confidence: string;
}

interface ProductImageSearchResult {
  candidates: ProductImageSearchCandidate[];
}

interface BulkAutoSearchImagesResult {
  searched: number;
  imported: number;
  notFound: number;
  errors: string[];
}

class InventoryService {
  private unwrapData<T>(payload: T | { data?: T }): T {
    return (payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: T }).data
      : payload) as T;
  }

  async getStockLevels(
    warehouseId?: string
  ): Promise<StockLevel[]> {
    const url = warehouseId
      ? `/inventory/stock?warehouseId=${warehouseId}`
      : '/inventory/stock';
    return apiClient.get<StockLevel[]>(url);
  }

  async getStockLevel(productId: string, warehouseId: string): Promise<StockLevel> {
    return apiClient.get<StockLevel>(
      `/inventory/stock/${productId}/${warehouseId}`
    );
  }

  async updateStockLevel(
    productId: string,
    warehouseId: string,
    quantity: number
  ): Promise<StockLevel> {
    return apiClient.patch<StockLevel>(
      `/inventory/stock/${productId}/${warehouseId}`,
      { quantity }
    );
  }

  async getStockMovements(
    params?: PaginationParams
  ): Promise<PaginatedResponse<StockMovement>> {
    const queryString = new URLSearchParams();
    if (params) {
      queryString.set('page', params.page.toString());
      queryString.set('limit', params.limit.toString());
    }
    return apiClient.get<PaginatedResponse<StockMovement>>(
      `/inventory/movements?${queryString.toString()}`
    );
  }

  async createStockMovement(data: {
    productId: string;
    warehouseId: string;
    type: StockMovementType;
    quantity: number;
    reference?: string;
    notes?: string;
  }): Promise<StockMovement> {
    return apiClient.post<StockMovement>('/inventory/movements', data);
  }

  async getStockAlerts(): Promise<StockAlert[]> {
    return apiClient.get<StockAlert[]>('/inventory/alerts');
  }

  async acknowledgeAlert(alertId: string): Promise<StockAlert> {
    return apiClient.patch<StockAlert>(`/inventory/alerts/${alertId}`, {
      acknowledged: true,
    });
  }

  async getWarehouses(): Promise<Warehouse[]> {
    return apiClient.get<Warehouse[]>('/inventory/warehouses');
  }

  async getWarehouseById(id: string): Promise<Warehouse> {
    return apiClient.get<Warehouse>(`/inventory/warehouses/${id}`);
  }

  async createWarehouse(data: Omit<Warehouse, 'id'>): Promise<Warehouse> {
    return apiClient.post<Warehouse>('/inventory/warehouses', data);
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<Warehouse> {
    return apiClient.patch<Warehouse>(`/inventory/warehouses/${id}`, data);
  }

  async deleteWarehouse(id: string): Promise<void> {
    await apiClient.delete(`/inventory/warehouses/${id}`);
  }

  async transferStock(data: {
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
  }): Promise<StockMovement> {
    return apiClient.post<StockMovement>('/inventory/transfers', data);
  }

  async getLowStockItems(): Promise<StockLevel[]> {
    return apiClient.get<StockLevel[]>('/inventory/low-stock');
  }

  async uploadProductImage(
    productId: string | number,
    file: File,
    options?: { isPrimary?: boolean }
  ): Promise<ProductImageUploadResult> {
    const formData = new FormData();
    formData.append('image', file);
    if (options?.isPrimary !== undefined) {
      formData.append('is_primary', String(options.isPrimary));
    }

    const response = await apiClient.upload<ProductImageUploadResult | { data?: ProductImageUploadResult }>(
      `/inventory/products/${productId}/images/upload`,
      formData
    );
    return this.unwrapData<ProductImageUploadResult>(response);
  }

  async searchProductImage(
    productId: string | number,
    query?: string
  ): Promise<ProductImageSearchResult> {
    const response = await apiClient.post<ProductImageSearchResult | { data?: ProductImageSearchResult }>(
      `/inventory/products/${productId}/images/search`,
      query ? { query } : {}
    );
    return this.unwrapData<ProductImageSearchResult>(response);
  }

  async selectSearchedImage(
    productId: string | number,
    imageUrl: string
  ): Promise<ProductImageUploadResult> {
    const response = await apiClient.post<ProductImageUploadResult | { data?: ProductImageUploadResult }>(
      `/inventory/products/${productId}/images/select`,
      { imageUrl }
    );
    return this.unwrapData<ProductImageUploadResult>(response);
  }

  async bulkAutoSearchImages(
    productIds: Array<string | number>,
    options?: { skipExisting?: boolean }
  ): Promise<BulkAutoSearchImagesResult> {
    const response = await apiClient.post<BulkAutoSearchImagesResult | { data?: BulkAutoSearchImagesResult }>(
      '/inventory/products/images/auto-search',
      { productIds },
      { params: { skipExisting: options?.skipExisting ?? true } }
    );
    return this.unwrapData<BulkAutoSearchImagesResult>(response);
  }
}

export const inventoryService = new InventoryService();

export default inventoryService;
