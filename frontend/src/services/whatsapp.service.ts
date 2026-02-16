/**
 * WhatsApp Integration Service
 */

import { apiClient } from './api';
import { ApiResponse, PaginatedResponse } from '../types/common';
import { WS_URL } from '../config';

// Helper to build query string
const buildQueryString = (params: Record<string, any> | undefined): string => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

// Helper to unwrap ApiResponse
const unwrapData = <T>(response: ApiResponse<T>): T => {
  if (!response.data) {
    throw new Error('No data in response');
  }
  return response.data;
};

// Export Types
export interface WhatsAppConversation {
  id: string;
  phoneNumber: string;
  customerName?: string;
  customerId?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: 'active' | 'closed' | 'archived';
  assignedTo?: string;
  assignedToName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'audio' | 'location' | 'contact';
  thumbnailUrl?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
  sentBy?: string;
  sentByName?: string;
  createdAt: string;
  readAt?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'marketing' | 'utility' | 'authentication' | 'service';
  body: string;
  variables: string[];
  headerVariable?: string;
  headerType?: 'text' | 'image' | 'video' | 'document';
  footerText?: string;
  buttons?: Array<{
    type: 'quick_reply' | 'url';
    text: string;
    url?: string;
  }>;
  status: 'approved' | 'pending' | 'rejected';
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppAgent {
  id: string;
  name: string;
  email?: string;
  status: 'online' | 'away' | 'offline';
  activeConversations: number;
  assignedConversations: number;
  avatar?: string;
}

export interface AssignmentRequest {
  conversationId: string;
  agentId: string;
  note?: string;
}

class WhatsAppService {
  // ============================================================
  // CONVERSATIONS METHODS
  // ============================================================

  /**
   * Get conversations with filters
   */
  async getConversations(params: {
    page?: number;
    pageSize?: number;
    status?: 'active' | 'closed' | 'archived';
    search?: string;
    assignedTo?: string;
  } = {}): Promise<PaginatedResponse<WhatsAppConversation>> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<PaginatedResponse<WhatsAppConversation>>(
      `/whatsapp/conversations${qs}`,
    );
    return response;
  }

  /**
   * Get single conversation
   */
  async getConversation(id: string): Promise<WhatsAppConversation> {
    const response = await apiClient.get<ApiResponse<WhatsAppConversation>>(
      `/whatsapp/conversations/${id}`,
    );
    return unwrapData(response);
  }

  /**
   * Assign conversation to agent
   */
  async assignConversation(data: AssignmentRequest): Promise<WhatsAppConversation> {
    const response = await apiClient.post<ApiResponse<WhatsAppConversation>>(
      '/whatsapp/conversations/assign',
      data,
    );
    return unwrapData(response);
  }

  /**
   * Resolve conversation
   */
  async resolveConversation(conversationId: string, resolutionNote?: string): Promise<WhatsAppConversation> {
    const response = await apiClient.post<ApiResponse<WhatsAppConversation>>(
      `/whatsapp/conversations/${conversationId}/resolve`,
      { resolutionNote },
    );
    return unwrapData(response);
  }

  /**
   * Reopen conversation
   */
  async reopenConversation(conversationId: string): Promise<WhatsAppConversation> {
    const response = await apiClient.post<ApiResponse<WhatsAppConversation>>(
      `/whatsapp/conversations/${conversationId}/reopen`,
    );
    return unwrapData(response);
  }

  // ============================================================
  // MESSAGES METHODS
  // ============================================================

  /**
   * Get conversation messages
   */
  async getMessages(conversationId: string, params: { page?: number; pageSize?: number } = {}): Promise<PaginatedResponse<WhatsAppMessage>> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<PaginatedResponse<WhatsAppMessage>>(
      `/whatsapp/conversations/${conversationId}/messages${qs}`,
    );
    return response;
  }

  /**
   * Send WhatsApp message to conversation
   */
  async sendMessage(conversationId: string, data: {
    message: string;
    mediaUrl?: string;
    mediaType?: string;
  }): Promise<WhatsAppMessage> {
    const response = await apiClient.post<ApiResponse<WhatsAppMessage>>(
      `/whatsapp/conversations/${conversationId}/send`,
      data,
    );
    return unwrapData(response);
  }

  /**
   * Send message to phone number directly
   */
  async sendMessageToPhone(phoneNumber: string, data: {
    message: string;
    mediaUrl?: string;
    mediaType?: string;
  }): Promise<WhatsAppMessage> {
    const response = await apiClient.post<ApiResponse<WhatsAppMessage>>(
      '/whatsapp/send',
      { phoneNumber, ...data },
    );
    return unwrapData(response);
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(data: {
    phoneNumber: string;
    templateId: string;
    variables?: Record<string, string>;
    headerVariable?: string;
  }): Promise<WhatsAppMessage> {
    const response = await apiClient.post<ApiResponse<WhatsAppMessage>>(
      '/whatsapp/send-template',
      data,
    );
    return unwrapData(response);
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(conversationId: string): Promise<void> {
    await apiClient.post(`/whatsapp/conversations/${conversationId}/mark-read`);
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(conversationId: string, messageIds: string[]): Promise<void> {
    await apiClient.post(`/whatsapp/conversations/${conversationId}/messages/read`, { messageIds });
  }

  /**
   * Retry failed message
   */
  async retryMessage(conversationId: string, messageId: string): Promise<WhatsAppMessage> {
    const response = await apiClient.post<ApiResponse<WhatsAppMessage>>(
      `/whatsapp/conversations/${conversationId}/messages/${messageId}/retry`,
    );
    return unwrapData(response);
  }

  // ============================================================
  // TEMPLATES METHODS
  // ============================================================

  /**
   * Get templates
   */
  async getTemplates(params: {
    page?: number;
    pageSize?: number;
    category?: string;
    status?: string;
    search?: string;
  } = {}): Promise<PaginatedResponse<WhatsAppTemplate>> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<PaginatedResponse<WhatsAppTemplate>>(
      `/whatsapp/templates${qs}`,
    );
    return response;
  }

  /**
   * Get single template
   */
  async getTemplate(id: string): Promise<WhatsAppTemplate> {
    const response = await apiClient.get<ApiResponse<WhatsAppTemplate>>(
      `/whatsapp/templates/${id}`,
    );
    return unwrapData(response);
  }

  /**
   * Create template
   */
  async createTemplate(data: Partial<WhatsAppTemplate>): Promise<WhatsAppTemplate> {
    const response = await apiClient.post<ApiResponse<WhatsAppTemplate>>(
      '/whatsapp/templates',
      data,
    );
    return unwrapData(response);
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, data: Partial<WhatsAppTemplate>): Promise<WhatsAppTemplate> {
    const response = await apiClient.put<ApiResponse<WhatsAppTemplate>>(
      `/whatsapp/templates/${id}`,
      data,
    );
    return unwrapData(response);
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    await apiClient.delete(`/whatsapp/templates/${id}`);
  }

  // ============================================================
  // AGENTS METHODS
  // ============================================================

  /**
   * Get available agents
   */
  async getAgents(): Promise<WhatsAppAgent[]> {
    const response = await apiClient.get<ApiResponse<WhatsAppAgent[]>>(
      '/whatsapp/agents',
    );
    return unwrapData(response);
  }

  /**
   * Get current agent info
   */
  async getCurrentAgent(): Promise<WhatsAppAgent> {
    const response = await apiClient.get<ApiResponse<WhatsAppAgent>>(
      '/whatsapp/agents/me',
    );
    return unwrapData(response);
  }

  /**
   * Set agent status
   */
  async setAgentStatus(status: 'online' | 'away' | 'offline'): Promise<WhatsAppAgent> {
    const response = await apiClient.post<ApiResponse<WhatsAppAgent>>(
      '/whatsapp/agents/status',
      { status },
    );
    return unwrapData(response);
  }

  // ============================================================
  // TAGS METHODS
  // ============================================================

  /**
   * Get all tags
   */
  async getTags(): Promise<Array<{ id: string; name: string; color: string }>> {
    const response = await apiClient.get<ApiResponse<Array<{ id: string; name: string; color: string }>>>(
      '/whatsapp/tags',
    );
    return unwrapData(response);
  }

  /**
   * Create tag
   */
  async createTag(data: { name: string; color: string }): Promise<{ id: string; name: string; color: string }> {
    const response = await apiClient.post<ApiResponse<{ id: string; name: string; color: string }>>(
      '/whatsapp/tags',
      data,
    );
    return unwrapData(response);
  }

  /**
   * Update conversation tags
   */
  async updateConversationTags(conversationId: string, tagIds: string[]): Promise<WhatsAppConversation> {
    const response = await apiClient.put<ApiResponse<WhatsAppConversation>>(
      `/whatsapp/conversations/${conversationId}/tags`,
      { tagIds },
    );
    return unwrapData(response);
  }

  // ============================================================
  // CONNECTION & STATUS METHODS
  // ============================================================

  /**
   * Get WhatsApp connection status
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    phoneNumber: string;
    businessName?: string;
    status: 'connected' | 'disconnected' | 'needs_authentication';
    qrCode?: string;
  }> {
    const response = await apiClient.get<ApiResponse<{
      connected: boolean;
      phoneNumber: string;
      businessName?: string;
      status: 'connected' | 'disconnected' | 'needs_authentication';
      qrCode?: string;
    }>>(
      '/whatsapp/status',
    );
    return unwrapData(response);
  }

  /**
   * Connect WhatsApp (get QR code)
   */
  async connectWhatsApp(): Promise<{ qrCode: string; expiresIn: number }> {
    const response = await apiClient.post<ApiResponse<{ qrCode: string; expiresIn: number }>>(
      '/whatsapp/connect',
    );
    return unwrapData(response);
  }

  /**
   * Disconnect WhatsApp
   */
  async disconnectWhatsApp(): Promise<void> {
    await apiClient.post('/whatsapp/disconnect');
  }

  /**
   * Reconnect WhatsApp
   */
  async reconnectWhatsApp(): Promise<{ qrCode: string; expiresIn: number }> {
    const response = await apiClient.post<ApiResponse<{ qrCode: string; expiresIn: number }>>(
      '/whatsapp/reconnect',
    );
    return unwrapData(response);
  }

  // ============================================================
  // STATISTICS METHODS
  // ============================================================

  /**
   * Get WhatsApp statistics
   */
  async getStatistics(params?: { dateFrom?: string; dateTo?: string }): Promise<{
    totalConversations: number;
    activeConversations: number;
    closedConversations: number;
    totalMessages: number;
    inboundMessages: number;
    outboundMessages: number;
    avgResponseTime: number;
    totalAgents: number;
    activeAgents: number;
  }> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<ApiResponse<{
      totalConversations: number;
      activeConversations: number;
      closedConversations: number;
      totalMessages: number;
      inboundMessages: number;
      outboundMessages: number;
      avgResponseTime: number;
      totalAgents: number;
      activeAgents: number;
    }>>(
      `/whatsapp/statistics${qs}`,
    );
    return unwrapData(response);
  }

  /**
   * Get conversations by date range
   */
  async getConversationsByDate(params: {
    dateFrom: string;
    dateTo: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<WhatsAppConversation>> {
    const qs = buildQueryString(params);
    const response = await apiClient.get<PaginatedResponse<WhatsAppConversation>>(
      `/whatsapp/conversations/by-date${qs}`,
    );
    return response;
  }

  // ============================================================
  // WEBSOCKET / REAL-TIME METHODS
  // ============================================================

  /**
   * Subscribe to messages (WebSocket)
   * Returns unsubscribe function
   */
  subscribeToMessages(callback: (message: WhatsAppMessage) => void): () => void {
    const token = apiClient.getToken();
    const wsUrl = WS_URL;
    const ws = new WebSocket(`${wsUrl}/whatsapp/messages?token=${token}`);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        callback(message);
      } catch (error) {
        console.error('Failed to parse WhatsApp message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WhatsApp WebSocket closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }

  /**
   * Subscribe to conversation updates (WebSocket)
   */
  subscribeToConversations(callback: (conversation: WhatsAppConversation) => void): () => void {
    const token = apiClient.getToken();
    const wsUrl = WS_URL;
    const ws = new WebSocket(`${wsUrl}/whatsapp/conversations?token=${token}`);

    ws.onmessage = (event) => {
      try {
        const conversation = JSON.parse(event.data);
        callback(conversation);
      } catch (error) {
        console.error('Failed to parse WhatsApp conversation update:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WhatsApp conversations WebSocket closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }

  /**
   * Subscribe to typing indicators
   */
  subscribeToTyping(callback: (data: { conversationId: string; isTyping: boolean }) => void): () => void {
    const token = apiClient.getToken();
    const wsUrl = WS_URL;
    const ws = new WebSocket(`${wsUrl}/whatsapp/typing?token=${token}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Failed to parse typing indicator:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Typing WebSocket closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;
