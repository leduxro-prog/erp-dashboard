/**
 * Google Ads API Client
 * Enterprise-grade client for position metrics and campaign reporting.
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - GAQL queries for reporting
 * - Search Absolute Top IS tracking
 * - Budget monitoring
 * - Campaign performance metrics
 */

import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('google-ads');

export interface GoogleAdsConfig {
    developerId: string;
    customerId: string;
    refreshToken: string;
    clientId: string;
    clientSecret: string;
    loginCustomerId?: string;
}

export interface PositionMetrics {
    campaignId: string;
    campaignName: string;
    searchAbsoluteTopImpressionShare: number; // % pe poziția 1
    searchTopImpressionShare: number; // % deasupra organic
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    date: string;
}

export interface BudgetStatus {
    campaignId: string;
    campaignName: string;
    dailyBudget: number;
    spentToday: number;
    remainingBudget: number;
    percentageUsed: number;
}

export interface ProductPerformance {
    productId: string;
    productTitle: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversionValue: number;
    searchAbsoluteTopIS: number;
}

export class GoogleAdsClient {
    private accessToken: string | null = null;
    private tokenExpiresAt: number = 0;

    constructor(private config: GoogleAdsConfig) { }

    /**
     * Get access token using refresh token.
     */
    private async getAccessToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    refresh_token: this.config.refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            const data = await response.json() as {
                access_token?: string;
                expires_in?: number;
                error?: string;
                error_description?: string;
            };

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
            }

            this.accessToken = data.access_token || null;
            this.tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 60) * 1000;

            return this.accessToken!;
        } catch (error) {
            logger.error('Failed to refresh access token', { error });
            throw error;
        }
    }

    /**
     * Execute a GAQL query against the Google Ads API.
     */
    private async executeQuery(query: string): Promise<any[]> {
        const accessToken = await this.getAccessToken();
        const url = `https://googleads.googleapis.com/v15/customers/${this.config.customerId}/googleAds:searchStream`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': this.config.developerId,
                    'Content-Type': 'application/json',
                    ...(this.config.loginCustomerId && {
                        'login-customer-id': this.config.loginCustomerId,
                    }),
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google Ads API error: ${error}`);
            }

            const results: any[] = [];
            const text = await response.text();

            // Parse streaming response
            const lines = text.split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.results) {
                        results.push(...parsed.results);
                    }
                } catch {
                    // Skip non-JSON lines
                }
            }

            return results;
        } catch (error) {
            logger.error('GAQL query failed', { query, error });
            throw error;
        }
    }

    /**
     * Get position metrics for Shopping campaigns.
     * Tracks Search Absolute Top IS for high-margin product visibility.
     */
    async getPositionMetrics(startDate: string, endDate: string): Promise<PositionMetrics[]> {
        const query = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.search_absolute_top_impression_share,
        metrics.search_top_impression_share,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        segments.date
      FROM shopping_performance_view
      WHERE campaign.advertising_channel_type = 'SHOPPING'
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY segments.date DESC
    `;

        try {
            const results = await this.executeQuery(query);

            return results.map(row => ({
                campaignId: row.campaign?.id || '',
                campaignName: row.campaign?.name || '',
                searchAbsoluteTopImpressionShare: (row.metrics?.searchAbsoluteTopImpressionShare || 0) * 100,
                searchTopImpressionShare: (row.metrics?.searchTopImpressionShare || 0) * 100,
                impressions: parseInt(row.metrics?.impressions || '0'),
                clicks: parseInt(row.metrics?.clicks || '0'),
                cost: (parseInt(row.metrics?.costMicros || '0')) / 1_000_000,
                conversions: parseFloat(row.metrics?.conversions || '0'),
                date: row.segments?.date || '',
            }));
        } catch (error) {
            logger.error('Failed to get position metrics', { error });
            return [];
        }
    }

    /**
     * Get budget status for campaigns.
     * Monitors spending against configured limits (e.g., 40€).
     */
    async getBudgetStatus(): Promise<BudgetStatus[]> {
        const today = new Date().toISOString().split('T')[0];

        const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign_budget.amount_micros,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.advertising_channel_type = 'SHOPPING'
        AND campaign.status = 'ENABLED'
        AND segments.date = '${today}'
    `;

        try {
            const results = await this.executeQuery(query);

            return results.map(row => {
                const dailyBudget = (parseInt(row.campaignBudget?.amountMicros || '0')) / 1_000_000;
                const spentToday = (parseInt(row.metrics?.costMicros || '0')) / 1_000_000;

                return {
                    campaignId: row.campaign?.id || '',
                    campaignName: row.campaign?.name || '',
                    dailyBudget,
                    spentToday,
                    remainingBudget: dailyBudget - spentToday,
                    percentageUsed: dailyBudget > 0 ? (spentToday / dailyBudget) * 100 : 0,
                };
            });
        } catch (error) {
            logger.error('Failed to get budget status', { error });
            return [];
        }
    }

    /**
     * Get performance metrics per product.
     * Used for high-margin segmentation analysis.
     */
    async getProductPerformance(startDate: string, endDate: string): Promise<ProductPerformance[]> {
        const query = `
      SELECT
        segments.product_item_id,
        segments.product_title,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.search_absolute_top_impression_share
      FROM shopping_performance_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.conversions_value DESC
      LIMIT 1000
    `;

        try {
            const results = await this.executeQuery(query);

            return results.map(row => ({
                productId: row.segments?.productItemId || '',
                productTitle: row.segments?.productTitle || '',
                impressions: parseInt(row.metrics?.impressions || '0'),
                clicks: parseInt(row.metrics?.clicks || '0'),
                cost: (parseInt(row.metrics?.costMicros || '0')) / 1_000_000,
                conversions: parseFloat(row.metrics?.conversions || '0'),
                conversionValue: parseFloat(row.metrics?.conversionsValue || '0'),
                searchAbsoluteTopIS: (row.metrics?.searchAbsoluteTopImpressionShare || 0) * 100,
            }));
        } catch (error) {
            logger.error('Failed to get product performance', { error });
            return [];
        }
    }

    /**
     * Check if budget threshold is reached and return alert info.
     */
    async checkBudgetAlert(thresholdPercentage: number = 80): Promise<BudgetStatus[]> {
        const statuses = await this.getBudgetStatus();
        return statuses.filter(s => s.percentageUsed >= thresholdPercentage);
    }
}
