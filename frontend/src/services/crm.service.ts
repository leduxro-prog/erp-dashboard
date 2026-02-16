import { apiClient } from './api';
import {
  Customer,
  Segment,
  LoyaltyProgram,
  LoyaltyTransaction,
  Coupon,
} from '../types/crm';
import { PaginatedResponse, PaginationParams } from '../types/common';

class CRMService {
  async getCustomers(params?: PaginationParams): Promise<PaginatedResponse<Customer>> {
    const queryString = new URLSearchParams();
    if (params) {
      queryString.set('page', params.page.toString());
      queryString.set('limit', params.limit.toString());
    }
    return apiClient.get<PaginatedResponse<Customer>>(
      `/crm/customers?${queryString.toString()}`
    );
  }

  async getCustomerById(id: string): Promise<Customer> {
    return apiClient.get<Customer>(`/crm/customers/${id}`);
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    return apiClient.get<Customer[]>(`/crm/customers/search?q=${encodeURIComponent(query)}`);
  }

  async createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    return apiClient.post<Customer>('/crm/customers', data);
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    return apiClient.patch<Customer>(`/crm/customers/${id}`, data);
  }

  async deleteCustomer(id: string): Promise<void> {
    await apiClient.delete(`/crm/customers/${id}`);
  }

  async getSegments(): Promise<Segment[]> {
    return apiClient.get<Segment[]>('/crm/segments');
  }

  async getSegmentById(id: string): Promise<Segment> {
    return apiClient.get<Segment>(`/crm/segments/${id}`);
  }

  async createSegment(data: Omit<Segment, 'id' | 'memberCount'>): Promise<Segment> {
    return apiClient.post<Segment>('/crm/segments', data);
  }

  async updateSegment(id: string, data: Partial<Segment>): Promise<Segment> {
    return apiClient.patch<Segment>(`/crm/segments/${id}`, data);
  }

  async deleteSegment(id: string): Promise<void> {
    await apiClient.delete(`/crm/segments/${id}`);
  }

  async getLoyaltyProgram(): Promise<LoyaltyProgram> {
    return apiClient.get<LoyaltyProgram>('/crm/loyalty');
  }

  async getLoyaltyBalance(customerId: string): Promise<{ points: number }> {
    return apiClient.get<{ points: number }>(`/crm/loyalty/${customerId}/balance`);
  }

  async earnLoyaltyPoints(
    customerId: string,
    data: { saleId: string; points: number }
  ): Promise<LoyaltyTransaction> {
    return apiClient.post<LoyaltyTransaction>(
      `/crm/loyalty/${customerId}/earn`,
      data
    );
  }

  async redeemLoyaltyPoints(
    customerId: string,
    data: { points: number; description?: string }
  ): Promise<LoyaltyTransaction> {
    return apiClient.post<LoyaltyTransaction>(
      `/crm/loyalty/${customerId}/redeem`,
      data
    );
  }

  async getLoyaltyHistory(customerId: string): Promise<LoyaltyTransaction[]> {
    return apiClient.get<LoyaltyTransaction[]>(`/crm/loyalty/${customerId}/history`);
  }

  async getCoupons(): Promise<Coupon[]> {
    return apiClient.get<Coupon[]>('/crm/coupons');
  }

  async getCouponByCode(code: string): Promise<Coupon> {
    return apiClient.get<Coupon>(`/crm/coupons/code/${code}`);
  }

  async createCoupon(data: Omit<Coupon, 'id' | 'currentRedemptions' | 'createdAt'>): Promise<Coupon> {
    return apiClient.post<Coupon>('/crm/coupons', data);
  }

  async updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon> {
    return apiClient.patch<Coupon>(`/crm/coupons/${id}`, data);
  }

  async deleteCoupon(id: string): Promise<void> {
    await apiClient.delete(`/crm/coupons/${id}`);
  }

  async redeemCoupon(code: string, saleId: string): Promise<Coupon> {
    return apiClient.post<Coupon>(`/crm/coupons/${code}/redeem`, { saleId });
  }
}

export const crmService = new CRMService();

export default crmService;
