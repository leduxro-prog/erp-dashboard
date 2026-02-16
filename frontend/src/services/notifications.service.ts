/**
 * Notifications Service
 */

import { apiClient } from './api';
import { ApiResponse, PaginatedResponse } from '../types/common';
import { WS_URL } from '../config';


interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  isRead: boolean;
  actions?: Array<{
    label: string;
    url: string;
    method?: 'get' | 'post' | 'put' | 'delete';
  }>;
  createdAt: string;
  readAt?: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  variables: string[];
}

interface NotificationStats {
  unreadCount: number;
  readCount: number;
  totalCount: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

class NotificationsService {
  /**
   * Get notification history
   */
  async getHistory(params: { page?: number; pageSize?: number; isRead?: boolean; category?: string } = {}): Promise<PaginatedResponse<Notification>> {
    const response = await apiClient.get<PaginatedResponse<Notification>>(
      '/notifications',
      { params },
    );
    return response;
  }

  /**
   * Get single notification
   */
  async getNotification(id: string): Promise<Notification> {
    const response = await apiClient.get<ApiResponse<Notification>>(
      `/notifications/${id}`,
    );
    return response.data;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const response = await apiClient.patch<ApiResponse<Notification>>(
      `/notifications/${id}/read`,
    );
    return response.data;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.post(
      '/notifications/mark-all-read',
    );
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    await apiClient.post(
      '/notifications/clear-all',
    );
  }

  /**
   * Get notification statistics
   */
  async getStats(): Promise<NotificationStats> {
    const response = await apiClient.get<ApiResponse<NotificationStats>>(
      '/notifications/stats',
    );
    return response.data;
  }

  /**
   * Send notification
   */
  async send(data: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    category?: string;
    userId?: string;
    userIds?: string[];
    relatedEntityId?: string;
    relatedEntityType?: string;
  }): Promise<Notification> {
    const response = await apiClient.post<ApiResponse<Notification>>(
      '/notifications/send',
      data,
    );
    return response.data;
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(userIds: string[], data: Partial<Notification>): Promise<{ sent: number; failed: number }> {
    const response = await apiClient.post<ApiResponse<{ sent: number; failed: number }>>(
      '/notifications/bulk',
      {
        recipientIds: userIds,
        recipients: userIds,
        channel: 'IN_APP',
        body: data.message,
        ...data,
      },
    );
    return {
      sent: (response.data as any)?.totalSent ?? 0,
      failed: (response.data as any)?.totalFailed ?? 0,
    };
  }

  /**
   * Get notification templates
   */
  async getTemplates(params: { category?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResponse<NotificationTemplate>> {
    const response = await apiClient.get<PaginatedResponse<NotificationTemplate>>(
      '/notifications/templates',
      { params },
    );
    return response;
  }

  /**
   * Get single template
   */
  async getTemplate(id: string): Promise<NotificationTemplate> {
    const response = await apiClient.get<ApiResponse<NotificationTemplate>>(
      `/notifications/templates/${id}`,
    );
    return response.data;
  }

  /**
   * Create template
   */
  async createTemplate(data: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const response = await apiClient.post<ApiResponse<NotificationTemplate>>(
      '/notifications/templates',
      data,
    );
    return response.data;
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, data: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const response = await apiClient.put<ApiResponse<NotificationTemplate>>(
      `/notifications/templates/${id}`,
      data,
    );
    return response.data;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    const response = await apiClient.get<ApiResponse<{ count: number }>>(
      '/notifications/unread-count',
    );
    return response.data;
  }

  /**
   * Get real-time notifications (WebSocket setup)
   */
  subscribeToNotifications(callback: (notification: Notification) => void): () => void {
    const token = apiClient.getToken();
    const wsUrl = WS_URL;
    const ws = new WebSocket(`${wsUrl}/notifications?token=${token}`);



    ws.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        callback(notification);
      } catch (error) {
        console.error('Failed to parse notification:', error);
      }
    };

    return () => {
      ws.close();
    };
  }

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<{
    email: {
      enabled: boolean;
      types: string[];
    };
    push: {
      enabled: boolean;
      types: string[];
    };
    inApp: {
      enabled: boolean;
      types: string[];
    };
  }> {
    const response = await apiClient.get<ApiResponse<{
      email: {
        enabled: boolean;
        types: string[];
      };
      push: {
        enabled: boolean;
        types: string[];
      };
      inApp: {
        enabled: boolean;
        types: string[];
      };
    }>>(
      '/notifications/preferences',
    );
    return response.data;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(data: any): Promise<void> {
    await apiClient.put(
      '/notifications/preferences',
      data,
    );
  }
}

export const notificationsService = new NotificationsService();
