import { apiClient } from './api';

// Types
export interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  website?: string;
  is_active: boolean;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  supplier_sku: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  stock_quantity: number;
  category?: string;
  image_url?: string;
  url?: string;
  last_synced: string;
}

export interface SupplierStatistics {
  total_products: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  avg_price: number;
  categories: { category: string; count: number }[];
}

export interface SkuMapping {
  id: string;
  supplier_id: string;
  supplier_sku: string;
  internal_product_id?: string;
  internal_sku?: string;
  product_name?: string;
  created_at: string;
}

export interface SupplierOrder {
  id: string;
  supplier_id: string;
  order_number?: string;
  status: string;
  total_amount?: number;
  created_at: string;
  updated_at: string;
}

class SuppliersService {
  private unwrapData<T>(response: any): T {
    return (response?.data ?? response) as T;
  }

  private mapSupplier(row: any): Supplier {
    return {
      id: String(row?.id ?? ''),
      name: String(row?.name ?? ''),
      contact_email: row?.contact_email ?? row?.contactEmail ?? '',
      contact_phone: row?.contact_phone ?? row?.contactPhone ?? '',
      address: row?.address ?? row?.website ?? '',
      website: row?.website ?? '',
      is_active: Boolean(row?.is_active ?? row?.isActive ?? false),
      last_sync_at: row?.last_sync_at ?? row?.lastSync ?? undefined,
      created_at: row?.created_at ?? row?.createdAt ?? new Date().toISOString(),
      updated_at: row?.updated_at ?? row?.updatedAt ?? new Date().toISOString(),
    };
  }

  private mapSupplierProduct(row: any): SupplierProduct {
    return {
      id: String(row?.id ?? ''),
      supplier_id: String(row?.supplier_id ?? row?.supplierId ?? ''),
      supplier_sku: String(row?.supplier_sku ?? row?.supplierSku ?? ''),
      name: String(row?.name ?? ''),
      description: row?.description ?? undefined,
      price: Number(row?.price ?? 0),
      currency: row?.currency ?? 'RON',
      stock_quantity: Number(row?.stock_quantity ?? row?.stockQuantity ?? 0),
      category: row?.category ?? undefined,
      image_url: row?.image_url ?? row?.imageUrl ?? undefined,
      url: row?.url ?? undefined,
      last_synced: row?.last_synced ?? row?.lastSynced ?? row?.lastScraped ?? new Date().toISOString(),
    };
  }

  private mapSupplierStats(row: any): SupplierStatistics {
    return {
      total_products: Number(row?.total_products ?? row?.totalProducts ?? 0),
      in_stock: Number(row?.in_stock ?? row?.inStock ?? 0),
      low_stock: Number(row?.low_stock ?? row?.lowStock ?? 0),
      out_of_stock: Number(row?.out_of_stock ?? row?.outOfStock ?? 0),
      avg_price: Number(row?.avg_price ?? row?.averagePrice ?? 0),
      categories: Array.isArray(row?.categories) ? row.categories : [],
    };
  }

  private mapSkuMapping(row: any): SkuMapping {
    return {
      id: String(row?.id ?? ''),
      supplier_id: String(row?.supplier_id ?? row?.supplierId ?? ''),
      supplier_sku: String(row?.supplier_sku ?? row?.supplierSku ?? ''),
      internal_product_id: row?.internal_product_id ?? row?.internalProductId ?? undefined,
      internal_sku: row?.internal_sku ?? row?.internalSku ?? undefined,
      product_name: row?.product_name ?? row?.productName ?? undefined,
      created_at: row?.created_at ?? row?.createdAt ?? new Date().toISOString(),
    };
  }

  private mapSupplierOrder(row: any): SupplierOrder {
    return {
      id: String(row?.id ?? ''),
      supplier_id: String(row?.supplier_id ?? row?.supplierId ?? ''),
      order_number: row?.order_number ?? row?.orderNumber ?? undefined,
      status: String(row?.status ?? ''),
      total_amount: Number(row?.total_amount ?? row?.totalAmount ?? 0),
      created_at: row?.created_at ?? row?.createdAt ?? new Date().toISOString(),
      updated_at: row?.updated_at ?? row?.updatedAt ?? new Date().toISOString(),
    };
  }

  // Suppliers
  async getSuppliers(activeOnly = false): Promise<Supplier[]> {
    const params = new URLSearchParams();
    if (activeOnly) params.set('activeOnly', 'true');
    const queryString = params.toString();
    const response: any = await apiClient.get(`/suppliers${queryString ? `?${queryString}` : ''}`);
    const rows = this.unwrapData<any[]>(response);
    return Array.isArray(rows) ? rows.map((row) => this.mapSupplier(row)) : [];
  }

  async getSupplier(id: string | number): Promise<Supplier> {
    const response: any = await apiClient.get(`/suppliers/${id}`);
    return this.mapSupplier(this.unwrapData<any>(response));
  }

  async getSupplierStatistics(id: string | number): Promise<SupplierStatistics> {
    const response: any = await apiClient.get(`/suppliers/${id}/statistics`);
    return this.mapSupplierStats(this.unwrapData<any>(response));
  }

  // Products
  async getSupplierProducts(id: string | number, params?: {
    search?: string;
    minStock?: number;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }): Promise<SupplierProduct[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.minStock) queryParams.set('minStock', params.minStock.toString());
    if (params?.minPrice) queryParams.set('minPrice', params.minPrice.toString());
    if (params?.maxPrice) queryParams.set('maxPrice', params.maxPrice.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const response: any = await apiClient.get(`/suppliers/${id}/products${queryString ? `?${queryString}` : ''}`);
    const rows = this.unwrapData<any[]>(response);
    return Array.isArray(rows) ? rows.map((row) => this.mapSupplierProduct(row)) : [];
  }

  // Sync
  async triggerSync(id: string | number): Promise<any> {
    return apiClient.post<any>(`/suppliers/${id}/sync`);
  }

  async triggerSyncAll(): Promise<{ jobId: string }> {
    return apiClient.post<{ jobId: string }>('/suppliers/sync-all');
  }

  // SKU Mappings
  async getSkuMappings(id: string | number): Promise<SkuMapping[]> {
    const response: any = await apiClient.get(`/suppliers/${id}/sku-mappings`);
    const rows = this.unwrapData<any[]>(response);
    return Array.isArray(rows) ? rows.map((row) => this.mapSkuMapping(row)) : [];
  }

  async getUnmappedProducts(id: string | number): Promise<SupplierProduct[]> {
    const response: any = await apiClient.get(`/suppliers/${id}/unmapped-products`);
    const rows = this.unwrapData<any[]>(response);
    return Array.isArray(rows) ? rows.map((row) => this.mapSupplierProduct(row)) : [];
  }

  async createSkuMapping(supplierId: string | number, data: {
    supplierSku: string;
    internalProductId?: string;
    internalSku?: string;
  }): Promise<SkuMapping> {
    return apiClient.post<SkuMapping>(`/suppliers/${supplierId}/sku-mappings`, data);
  }

  async deleteSkuMapping(mappingId: string | number): Promise<void> {
    return apiClient.delete<void>(`/suppliers/sku-mappings/${mappingId}`);
  }

  // Orders
  async placeSupplierOrder(supplierId: string | number, data: {
    items: Array<{ supplierSku: string; quantity: number }>;
    orderId?: string;
  }): Promise<SupplierOrder> {
    return apiClient.post<SupplierOrder>(`/suppliers/${supplierId}/orders`, data);
  }

  async getSupplierOrders(supplierId: string | number, params?: {
    limit?: number;
    offset?: number;
  }): Promise<SupplierOrder[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const response: any = await apiClient.get(`/suppliers/${supplierId}/orders${queryString ? `?${queryString}` : ''}`);
    const rows = this.unwrapData<any[]>(response);
    return Array.isArray(rows) ? rows.map((row) => this.mapSupplierOrder(row)) : [];
  }
}

export const suppliersService = new SuppliersService();
export default suppliersService;
