import { apiClient } from './api';
import {
  Product,
  ProductCategory,
  CreateProductDTO,
  UpdateProductDTO,
} from '../types/product';
import { PaginatedResponse, PaginationParams } from '../types/common';

class ProductService {
  async getProducts(
    params?: PaginationParams
  ): Promise<PaginatedResponse<Product>> {
    const queryString = new URLSearchParams();
    if (params) {
      queryString.set('page', params.page.toString());
      queryString.set('limit', params.limit.toString());
      if (params.sortBy) queryString.set('sortBy', params.sortBy);
      if (params.sortDir) queryString.set('sortDir', params.sortDir);
    }
    return apiClient.get<PaginatedResponse<Product>>(
      `/products?${queryString.toString()}`
    );
  }

  async getProductById(id: string): Promise<Product> {
    return apiClient.get<Product>(`/products/${id}`);
  }

  async searchProducts(query: string): Promise<Product[]> {
    return apiClient.get<Product[]>(`/products/search?q=${encodeURIComponent(query)}`);
  }

  async createProduct(data: CreateProductDTO): Promise<Product> {
    return apiClient.post<Product>('/products', data);
  }

  async updateProduct(data: UpdateProductDTO): Promise<Product> {
    return apiClient.patch<Product>(`/products/${data.id}`, data);
  }

  async deleteProduct(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  }

  async getCategories(): Promise<ProductCategory[]> {
    return apiClient.get<ProductCategory[]>('/products/categories');
  }

  async getCategoryById(id: string): Promise<ProductCategory> {
    return apiClient.get<ProductCategory>(`/products/categories/${id}`);
  }

  async createCategory(data: Omit<ProductCategory, 'id'>): Promise<ProductCategory> {
    return apiClient.post<ProductCategory>('/products/categories', data);
  }

  async updateCategory(id: string, data: Partial<ProductCategory>): Promise<ProductCategory> {
    return apiClient.patch<ProductCategory>(`/products/categories/${id}`, data);
  }

  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/products/categories/${id}`);
  }

  async bulkImport(file: File): Promise<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/products/bulk-import', formData);
  }
}

export const productsService = new ProductService();

export default productsService;
