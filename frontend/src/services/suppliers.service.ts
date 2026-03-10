import { apiClient } from './api';
import {
  SupplierPricingRule,
  UpsertSupplierPricingRuleInput,
} from '../types/supplier-pricing-rule';

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
  private unwrapData<T>(response: { data?: T } | T): T {
    if (response && typeof response === 'object' && 'data' in (response as object)) {
      const envelope = response as { data?: T };
      return (envelope.data ?? (response as T)) as T;
    }

    return response as T;
  }

  // Suppliers
  async getSuppliers(activeOnly = false): Promise<Supplier[]> {
    const params = new URLSearchParams();
    if (activeOnly) params.set('activeOnly', 'true');
    const queryString = params.toString();
    return apiClient.get<Supplier[]>(`/suppliers${queryString ? `?${queryString}` : ''}`);
  }

  async getSupplier(id: string | number): Promise<Supplier> {
    return apiClient.get<Supplier>(`/suppliers/${id}`);
  }

  async getSupplierStatistics(id: string | number): Promise<SupplierStatistics> {
    return apiClient.get<SupplierStatistics>(`/suppliers/${id}/statistics`);
  }

  // Supplier Pricing Rules (Task 6 API)
  async getSupplierPricingRules(supplierCode: string): Promise<SupplierPricingRule[]> {
    const response = await apiClient.get<{ data?: SupplierPricingRule[] } | SupplierPricingRule[]>(
      `/pricing-rules/${encodeURIComponent(supplierCode)}`,
    );
    const data = this.unwrapData<SupplierPricingRule[]>(response);
    return Array.isArray(data) ? data : [];
  }

  async createSupplierPricingRule(input: UpsertSupplierPricingRuleInput): Promise<SupplierPricingRule> {
    const response = await apiClient.post<{ data?: SupplierPricingRule } | SupplierPricingRule>('/pricing-rules', input);
    return this.unwrapData<SupplierPricingRule>(response);
  }

  async upsertSupplierPricingRuleByKey(
    supplierCode: string,
    categoryKey: string,
    input: Pick<UpsertSupplierPricingRuleInput, 'markupPercent' | 'active'>,
  ): Promise<SupplierPricingRule> {
    const response = await apiClient.put<{ data?: SupplierPricingRule } | SupplierPricingRule>(
      `/pricing-rules/${encodeURIComponent(supplierCode)}/${encodeURIComponent(categoryKey)}`,
      input,
    );
    return this.unwrapData<SupplierPricingRule>(response);
  }

  async setSupplierPricingRuleActive(
    supplierCode: string,
    categoryKey: string,
    active: boolean,
  ): Promise<SupplierPricingRule> {
    const response = await apiClient.patch<{ data?: SupplierPricingRule } | SupplierPricingRule>(
      `/pricing-rules/${encodeURIComponent(supplierCode)}/${encodeURIComponent(categoryKey)}/active`,
      { active },
    );
    return this.unwrapData<SupplierPricingRule>(response);
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
    return apiClient.get<SupplierProduct[]>(`/suppliers/${id}/products${queryString ? `?${queryString}` : ''}`);
  }

  // Sync
  async triggerSync(id: string | number): Promise<{ jobId?: string; status?: string }> {
    return apiClient.post<{ jobId?: string; status?: string }>(`/suppliers/${id}/sync`);
  }

  async triggerSyncAll(): Promise<{ jobId: string }> {
    return apiClient.post<{ jobId: string }>('/suppliers/sync-all');
  }

  // SKU Mappings
  async getSkuMappings(id: string | number): Promise<SkuMapping[]> {
    return apiClient.get<SkuMapping[]>(`/suppliers/${id}/sku-mappings`);
  }

  async getUnmappedProducts(id: string | number): Promise<SupplierProduct[]> {
    return apiClient.get<SupplierProduct[]>(`/suppliers/${id}/unmapped-products`);
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
    return apiClient.get<SupplierOrder[]>(`/suppliers/${supplierId}/orders${queryString ? `?${queryString}` : ''}`);
  }
}

export const suppliersService = new SuppliersService();
export default suppliersService;
