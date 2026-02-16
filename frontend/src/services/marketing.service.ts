/**
 * Marketing Service
 */

import { apiClient } from './api';
import { ApiResponse, PaginatedResponse } from '../types/common';

// Campaign Types
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: 'email' | 'sms' | 'push' | 'social' | 'display' | 'whatsapp';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  targetSegments: string[];
  startDate: string;
  endDate?: string;
  scheduledAt?: string;
  budget?: number;
  spent?: number;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    conversions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStep {
  id: string;
  campaignId: string;
  order: number;
  type: 'email' | 'sms' | 'push' | 'whatsapp';
  delayMinutes?: number;
  scheduledAt?: string;
  content: {
    subject?: string;
    body: string;
    templateId?: string;
  };
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  metrics?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  createdAt: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  description?: string;
  type: 'static' | 'dynamic';
  customerCount: number;
  criteria: {
    ageRange?: [number, number];
    location?: string[];
    purchaseHistory?: string;
    loyaltyTier?: string[];
    tags?: string[];
  };
  isActive: boolean;
  createdAt: string;
}

export interface AudiencePreview {
  totalCount: number;
  segments: Array<{
    segmentId: string;
    segmentName: string;
    count: number;
  }>;
  excludedReasons: string[];
}

export interface ChannelDelivery {
  id: string;
  campaignId: string;
  channel: string;
  scheduledFor: string;
  sentAt?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  totalCount: number;
  successCount: number;
  failureCount: number;
  errorMessage?: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'bogo' | 'free_shipping';
  value: number;
  minOrderValue?: number;
  maxUses?: number;
  currentUses: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  linkedCampaigns?: string[];
  createdAt: string;
}

export interface EmailSequence {
  id: string;
  name: string;
  description?: string;
  trigger: 'welcome' | 'abandoned_cart' | 'post_purchase' | 'custom';
  emails: Array<{
    id: string;
    order: number;
    subject: string;
    delay: number;
    content: string;
  }>;
  status: 'active' | 'inactive';
  totalSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  createdAt: string;
  updatedAt: string;
}

class MarketingService {
  /**
   * Get campaigns with filters
   */
  async getCampaigns(
    params: {
      page?: number;
      pageSize?: number;
      status?: string;
      type?: string;
      search?: string;
    } = {},
  ): Promise<PaginatedResponse<Campaign>> {
    const response = await apiClient.get<PaginatedResponse<Campaign>>('/marketing/campaigns', {
      params,
    });
    return response;
  }

  /**
   * Get single campaign
   */
  async getCampaign(id: string): Promise<Campaign> {
    const response = await apiClient.get<ApiResponse<Campaign>>(`/marketing/campaigns/${id}`);
    return response.data;
  }

  /**
   * Create campaign
   */
  async createCampaign(data: Partial<Campaign>): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>('/marketing/campaigns', data);
    return response.data;
  }

  /**
   * Update campaign
   */
  async updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
    const response = await apiClient.put<ApiResponse<Campaign>>(`/marketing/campaigns/${id}`, data);
    return response.data;
  }

  /**
   * Activate campaign
   */
  async activateCampaign(id: string): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>(
      `/marketing/campaigns/${id}/activate`,
      {},
    );
    return response.data;
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(id: string): Promise<Campaign> {
    const response = await apiClient.post<ApiResponse<Campaign>>(
      `/marketing/campaigns/${id}/pause`,
      {},
    );
    return response.data;
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(id: string): Promise<void> {
    await apiClient.delete(`/marketing/campaigns/${id}`);
  }

  /**
   * Get campaign steps
   */
  async getCampaignSteps(campaignId: string): Promise<CampaignStep[]> {
    const response = await apiClient.get<ApiResponse<CampaignStep[]>>(
      `/marketing/campaigns/${campaignId}/steps`,
    );
    return response.data;
  }

  /**
   * Create/update campaign step
   */
  async saveCampaignStep(campaignId: string, step: Partial<CampaignStep>): Promise<CampaignStep> {
    if (step.id) {
      const response = await apiClient.put<ApiResponse<CampaignStep>>(
        `/marketing/campaigns/${campaignId}/steps/${step.id}`,
        step,
      );
      return response.data;
    }
    const response = await apiClient.post<ApiResponse<CampaignStep>>(
      `/marketing/campaigns/${campaignId}/steps`,
      step,
    );
    return response.data;
  }

  /**
   * Delete campaign step
   */
  async deleteCampaignStep(campaignId: string, stepId: string): Promise<void> {
    await apiClient.delete(`/marketing/campaigns/${campaignId}/steps/${stepId}`);
  }

  /**
   * Get audience segments
   */
  async getAudienceSegments(params?: {
    page?: number;
    pageSize?: number;
    active?: boolean;
  }): Promise<PaginatedResponse<AudienceSegment>> {
    const response = await apiClient.get<PaginatedResponse<AudienceSegment>>(
      '/marketing/audiences',
      { params },
    );
    return response;
  }

  /**
   * Get audience preview
   */
  async getAudiencePreview(data: {
    segmentIds?: string[];
    criteria?: {
      ageRange?: [number, number];
      location?: string[];
      tags?: string[];
    };
  }): Promise<AudiencePreview> {
    const response = await apiClient.post<ApiResponse<AudiencePreview>>(
      '/marketing/audiences/preview',
      data,
    );
    return response.data;
  }

  /**
   * Create audience segment
   */
  async createAudienceSegment(data: Partial<AudienceSegment>): Promise<AudienceSegment> {
    const response = await apiClient.post<ApiResponse<AudienceSegment>>(
      '/marketing/audiences',
      data,
    );
    return response.data;
  }

  /**
   * Schedule campaign
   */
  async scheduleCampaign(
    campaignId: string,
    data: {
      scheduledAt: string;
      channels: string[];
      timeZone?: string;
    },
  ): Promise<{ jobId: string }> {
    const response = await apiClient.post<ApiResponse<{ jobId: string }>>(
      `/marketing/campaigns/${campaignId}/schedule`,
      data,
    );
    return response.data;
  }

  /**
   * Get channel deliveries
   */
  async getCampaignDeliveries(campaignId: string): Promise<ChannelDelivery[]> {
    const response = await apiClient.get<ApiResponse<ChannelDelivery[]>>(
      `/marketing/campaigns/${campaignId}/deliveries`,
    );
    return response.data;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(id: string): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    conversions: number;
    revenue: number;
    roi: number;
    byDate: Array<{
      date: string;
      sent: number;
      opened: number;
      clicked: number;
      conversions: number;
    }>;
    byStep: Array<{
      stepId: string;
      stepOrder: number;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      conversions: number;
    }>;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        conversions: number;
        revenue: number;
        roi: number;
        byDate: Array<{
          date: string;
          sent: number;
          opened: number;
          clicked: number;
          conversions: number;
        }>;
        byStep: Array<{
          stepId: string;
          stepOrder: number;
          sent: number;
          delivered: number;
          opened: number;
          clicked: number;
          conversions: number;
        }>;
      }>
    >(`/marketing/campaigns/${id}/analytics`);
    return response.data;
  }

  /**
   * Get discount codes
   */
  async getDiscountCodes(
    params: {
      page?: number;
      pageSize?: number;
      active?: boolean;
      search?: string;
    } = {},
  ): Promise<PaginatedResponse<DiscountCode>> {
    const response = await apiClient.get<PaginatedResponse<DiscountCode>>(
      '/marketing/discount-codes',
      { params },
    );
    return response;
  }

  /**
   * Get single discount code
   */
  async getDiscountCode(id: string): Promise<DiscountCode> {
    const response = await apiClient.get<ApiResponse<DiscountCode>>(
      `/marketing/discount-codes/${id}`,
    );
    return response.data;
  }

  /**
   * Create discount code
   */
  async createDiscountCode(data: Partial<DiscountCode>): Promise<DiscountCode> {
    const response = await apiClient.post<ApiResponse<DiscountCode>>(
      '/marketing/discount-codes',
      data,
    );
    return response.data;
  }

  /**
   * Generate bulk discount codes
   */
  async generateBulkDiscountCodes(
    baseCode: string,
    count: number,
    data: Partial<DiscountCode>,
  ): Promise<{ codes: string[] }> {
    const response = await apiClient.post<ApiResponse<{ codes: string[] }>>(
      '/marketing/discount-codes/bulk-generate',
      { baseCode, count, ...data },
    );
    return response.data;
  }

  /**
   * Update discount code
   */
  async updateDiscountCode(id: string, data: Partial<DiscountCode>): Promise<DiscountCode> {
    const response = await apiClient.put<ApiResponse<DiscountCode>>(
      `/marketing/discount-codes/${id}`,
      data,
    );
    return response.data;
  }

  /**
   * Deactivate discount code
   */
  async deactivateDiscountCode(id: string): Promise<void> {
    await apiClient.post(`/marketing/discount-codes/${id}/deactivate`, {});
  }

  /**
   * Get email sequences
   */
  async getEmailSequences(
    params: { page?: number; pageSize?: number; status?: string } = {},
  ): Promise<PaginatedResponse<EmailSequence>> {
    const response = await apiClient.get<PaginatedResponse<EmailSequence>>(
      '/marketing/email-sequences',
      { params },
    );
    return response;
  }

  /**
   * Get single email sequence
   */
  async getEmailSequence(id: string): Promise<EmailSequence> {
    const response = await apiClient.get<ApiResponse<EmailSequence>>(
      `/marketing/email-sequences/${id}`,
    );
    return response.data;
  }

  /**
   * Create email sequence
   */
  async createEmailSequence(data: Partial<EmailSequence>): Promise<EmailSequence> {
    const response = await apiClient.post<ApiResponse<EmailSequence>>(
      '/marketing/email-sequences',
      data,
    );
    return response.data;
  }

  /**
   * Update email sequence
   */
  async updateEmailSequence(id: string, data: Partial<EmailSequence>): Promise<EmailSequence> {
    const response = await apiClient.put<ApiResponse<EmailSequence>>(
      `/marketing/email-sequences/${id}`,
      data,
    );
    return response.data;
  }

  /**
   * Get email templates
   */
  async getEmailTemplates(): Promise<
    Array<{
      id: string;
      name: string;
      category: string;
      thumbnail?: string;
    }>
  > {
    const response = await apiClient.get<
      ApiResponse<
        Array<{
          id: string;
          name: string;
          category: string;
          thumbnail?: string;
        }>
      >
    >('/marketing/email-templates');
    return response.data;
  }

  /**
   * Get marketing statistics
   */
  async getStatistics(
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalEmails: number;
    avgOpenRate: number;
    avgClickRate: number;
    totalConversions: number;
    totalRevenue: number;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        totalCampaigns: number;
        activeCampaigns: number;
        totalEmails: number;
        avgOpenRate: number;
        avgClickRate: number;
        totalConversions: number;
        totalRevenue: number;
      }>
    >('/marketing/statistics', { params: { dateFrom, dateTo } });
    return response.data;
  }
}

export const marketingService = new MarketingService();
export default marketingService;
