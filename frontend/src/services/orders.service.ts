import { apiClient } from './api';
import { Order, CreateOrderDTO, UpdateOrderDTO, OrderStatus } from '../types/order';
import { PaginatedResponse, PaginationParams } from '../types/common';

class OrderService {
  async getOrders(params?: PaginationParams): Promise<PaginatedResponse<Order>> {
    const queryString = new URLSearchParams();
    if (params) {
      queryString.set('page', params.page.toString());
      queryString.set('limit', params.limit.toString());
      if (params.sortBy) queryString.set('sortBy', params.sortBy);
      if (params.sortDir) queryString.set('sortDir', params.sortDir);
    }
    return apiClient.get<PaginatedResponse<Order>>(
      `/orders?${queryString.toString()}`
    );
  }

  async getOrderById(id: string): Promise<Order> {
    return apiClient.get<Order>(`/orders/${id}`);
  }

  async getOrderByNumber(orderNumber: string): Promise<Order> {
    return apiClient.get<Order>(`/orders/number/${orderNumber}`);
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return apiClient.get<Order[]>(`/orders/customer/${customerId}`);
  }

  async createOrder(data: CreateOrderDTO): Promise<Order> {
    return apiClient.post<Order>('/orders', data);
  }

  async updateOrder(data: UpdateOrderDTO): Promise<Order> {
    return apiClient.patch<Order>(`/orders/${data.id}`, data);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    return apiClient.patch<Order>(`/orders/${id}`, { status });
  }

  async deleteOrder(id: string): Promise<void> {
    await apiClient.delete(`/orders/${id}`);
  }

  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    return apiClient.get<Order[]>(`/orders/status/${status}`);
  }

  async generateInvoice(orderId: string): Promise<Blob> {
    const response = await fetch(
      `/api/v1/orders/${orderId}/invoice`,
      {
        headers: { Authorization: `Bearer ${apiClient.getToken()}` },
      }
    );
    return response.blob();
  }

  async shipOrder(
    orderId: string,
    data: { trackingNumber: string; carrier: string }
  ): Promise<Order> {
    return apiClient.post<Order>(`/orders/${orderId}/ship`, data);
  }

  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    return apiClient.post<Order>(`/orders/${orderId}/cancel`, { reason });
  }
}

export const ordersService = new OrderService();

export default ordersService;
