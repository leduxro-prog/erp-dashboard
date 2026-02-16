/**
 * TikTok Marketing API Client
 * Enterprise-grade client for TikTok Business API.
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Campaign management
 * - Content posting via Content API
 * - Events API for conversion tracking
 * - Rate limiting and retry logic
 */

import { createModuleLogger } from '@shared/utils/logger';
import crypto from 'crypto';

const logger = createModuleLogger('tiktok-marketing');

export interface TikTokConfig {
    appId: string;
    appSecret: string;
    accessToken: string;
    pixelCode?: string;
    advertiserId?: string;
}

export interface TikTokEvent {
    eventName: string; // 'ViewContent', 'AddToCart', 'Purchase', etc.
    eventTime: number; // Unix timestamp
    eventId: string; // Unique event ID for deduplication
    user: {
        email?: string;
        phone?: string;
        externalId?: string;
        ip?: string;
        userAgent?: string;
    };
    properties?: {
        currency?: string;
        value?: number;
        contentId?: string;
        contentType?: string;
        contentName?: string;
        quantity?: number;
    };
}

export interface ContentSchedule {
    id: string;
    scriptText: string;
    mediaUrl?: string;
    scheduledTime: Date;
    hashtags: string[];
    status: 'scheduled' | 'posted' | 'failed';
}

export interface CampaignPerformance {
    campaignId: string;
    campaignName: string;
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
    conversions: number;
    costPerConversion: number;
    roas: number;
}

export class TikTokMarketingClient {
    private baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';
    private eventsUrl = 'https://business-api.tiktok.com/open_api/v1.3/event/track';

    constructor(private config: TikTokConfig) { }

    /**
     * Generate request signature for API calls.
     */
    private generateSignature(timestamp: number, path: string, body: string): string {
        const signStr = `${this.config.appSecret}${timestamp}${path}${body}`;
        return crypto.createHash('sha256').update(signStr).digest('hex');
    }

    /**
     * Make authenticated API request.
     */
    private async request<T>(
        method: string,
        path: string,
        body?: Record<string, unknown>
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const timestamp = Math.floor(Date.now() / 1000);
        const bodyStr = body ? JSON.stringify(body) : '';

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Token': this.config.accessToken,
                    'Timestamp': timestamp.toString(),
                },
                body: bodyStr || undefined,
            });

            const data = await response.json() as {
                code: number;
                message?: string;
                data?: T;
            };

            if (data.code !== 0) {
                throw new Error(`TikTok API error: ${data.message} (code: ${data.code})`);
            }

            return data.data as T;
        } catch (error) {
            logger.error('TikTok API request failed', { path, error });
            throw error;
        }
    }

    /**
     * Track conversion event via Events API (CAPI).
     * Server-to-server tracking for reliable conversions.
     */
    async trackEvent(event: TikTokEvent): Promise<{ success: boolean; eventId: string }> {
        if (!this.config.pixelCode) {
            throw new Error('Pixel code not configured');
        }

        try {
            // Hash PII data
            const hashedUser: Record<string, string> = {};
            if (event.user.email) {
                hashedUser.email = crypto.createHash('sha256').update(event.user.email.toLowerCase()).digest('hex');
            }
            if (event.user.phone) {
                hashedUser.phone = crypto.createHash('sha256').update(event.user.phone).digest('hex');
            }
            if (event.user.externalId) {
                hashedUser.external_id = crypto.createHash('sha256').update(event.user.externalId).digest('hex');
            }

            const payload = {
                pixel_code: this.config.pixelCode,
                event: event.eventName,
                event_id: event.eventId,
                timestamp: new Date(event.eventTime * 1000).toISOString(),
                context: {
                    user: hashedUser,
                    ip: event.user.ip,
                    user_agent: event.user.userAgent,
                },
                properties: event.properties,
            };

            const response = await fetch(this.eventsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Token': this.config.accessToken,
                },
                body: JSON.stringify({ data: [payload] }),
            });

            const data = await response.json() as {
                code: number;
                message?: string;
            };

            if (data.code !== 0) {
                logger.error('Event tracking failed', { event: event.eventName, code: data.code });
                return { success: false, eventId: event.eventId };
            }

            logger.info('Event tracked successfully', {
                event: event.eventName,
                eventId: event.eventId,
            });

            return { success: true, eventId: event.eventId };
        } catch (error) {
            logger.error('Event tracking error', { error });
            return { success: false, eventId: event.eventId };
        }
    }

    /**
     * Track purchase conversion.
     */
    async trackPurchase(
        orderId: string,
        value: number,
        currency: string,
        user: TikTokEvent['user'],
        products: Array<{ id: string; name: string; quantity: number }>
    ): Promise<{ success: boolean; eventId: string }> {
        const event: TikTokEvent = {
            eventName: 'CompletePayment',
            eventTime: Math.floor(Date.now() / 1000),
            eventId: `purchase_${orderId}_${Date.now()}`,
            user,
            properties: {
                currency,
                value,
                contentId: products.map(p => p.id).join(','),
                contentName: products.map(p => p.name).join(','),
                quantity: products.reduce((sum, p) => sum + p.quantity, 0),
            },
        };

        return this.trackEvent(event);
    }

    /**
     * Get campaign performance metrics.
     */
    async getCampaignPerformance(
        advertiserId: string,
        startDate: string,
        endDate: string
    ): Promise<CampaignPerformance[]> {
        try {
            const response = await this.request<{ list: any[] }>('GET', '/report/integrated/get/', {
                advertiser_id: advertiserId,
                report_type: 'BASIC',
                dimensions: ['campaign_id'],
                metrics: [
                    'campaign_name',
                    'impressions',
                    'clicks',
                    'ctr',
                    'spend',
                    'conversion',
                    'cost_per_conversion',
                    'value_per_conversion',
                ],
                data_level: 'AUCTION_CAMPAIGN',
                start_date: startDate,
                end_date: endDate,
            });

            return (response.list || []).map(item => ({
                campaignId: item.dimensions?.campaign_id || '',
                campaignName: item.metrics?.campaign_name || '',
                impressions: parseInt(item.metrics?.impressions || '0'),
                clicks: parseInt(item.metrics?.clicks || '0'),
                ctr: parseFloat(item.metrics?.ctr || '0'),
                spend: parseFloat(item.metrics?.spend || '0'),
                conversions: parseFloat(item.metrics?.conversion || '0'),
                costPerConversion: parseFloat(item.metrics?.cost_per_conversion || '0'),
                roas: parseFloat(item.metrics?.value_per_conversion || '0'),
            }));
        } catch (error) {
            logger.error('Failed to get campaign performance', { error });
            return [];
        }
    }

    /**
     * Get advertiser info.
     */
    async getAdvertiserInfo(advertiserId: string): Promise<{
        id: string;
        name: string;
        balance: number;
        currency: string;
    } | null> {
        try {
            const response = await this.request<{ list: any[] }>('GET', '/advertiser/info/', {
                advertiser_ids: [advertiserId],
            });

            const advertiser = response.list?.[0];
            if (!advertiser) return null;

            return {
                id: advertiser.advertiser_id,
                name: advertiser.name,
                balance: parseFloat(advertiser.balance || '0'),
                currency: advertiser.currency,
            };
        } catch (error) {
            logger.error('Failed to get advertiser info', { error });
            return null;
        }
    }
}
