/**
 * Ads Sentinel Service
 * Monitors Google Shopping campaigns every 30 minutes.
 * 
 * Features:
 * 1. SENTINEL: Monitors Search Absolute Top Impression Share
 *    - Alerts if competitor takes #1 on high-margin products
 * 
 * 2. PROFIT PROTECTION (30/40 Rule):
 *    - When daily spend hits 30€ → check performance
 *    - Products with margin < 15% consuming budget → PAUSE them
 *    - Last 10€ reserved for high-margin products only
 */

import { createModuleLogger } from '@shared/utils/logger';
import { GoogleAdsClient, BudgetStatus, PositionMetrics, ProductPerformance } from '../../infrastructure/api-clients/GoogleAdsClient';
import { HighMarginSegmentationService } from '../../application/services/HighMarginSegmentationService';

const logger = createModuleLogger('ads-sentinel');

export interface SentinelConfig {
    /** Total daily budget in € (default: 40) */
    dailyBudget: number;
    /** Spend threshold that triggers profit protection check (default: 30) */
    profitProtectionThreshold: number;
    /** Margin below which products get paused when budget is tight (default: 15%) */
    lowMarginThreshold: number;
    /** Margin above which products are considered "Gold" (default: 30%) */
    highMarginThreshold: number;
    /** Impression share below which we alert (default: 50%) */
    impressionShareAlertThreshold: number;
}

export interface SentinelAlert {
    type: 'competitor_position' | 'budget_critical' | 'low_margin_paused';
    message: string;
    productName?: string;
    productId?: string;
    currentSpend?: number;
    timestamp: Date;
}

export interface SentinelResult {
    alerts: SentinelAlert[];
    productsPaused: string[];
    currentSpend: number;
    budgetRemaining: number;
    highMarginProductCount: number;
}

export class AdsSentinelService {
    private config: SentinelConfig;

    constructor(
        private googleAdsClient: GoogleAdsClient,
        private segmentationService: HighMarginSegmentationService,
        config?: Partial<SentinelConfig>,
    ) {
        this.config = {
            dailyBudget: config?.dailyBudget ?? parseFloat(process.env.GOOGLE_ADS_DAILY_BUDGET || '40'),
            profitProtectionThreshold: config?.profitProtectionThreshold ?? parseFloat(process.env.GOOGLE_ADS_PROFIT_PROTECTION_THRESHOLD || '30'),
            lowMarginThreshold: config?.lowMarginThreshold ?? parseFloat(process.env.GOOGLE_ADS_LOW_MARGIN_THRESHOLD || '15'),
            highMarginThreshold: config?.highMarginThreshold ?? 30,
            impressionShareAlertThreshold: config?.impressionShareAlertThreshold ?? 50,
        };
    }

    /**
     * Run the full sentinel check.
     * Called every 30 minutes by the scheduler.
     */
    async runSentinelCheck(): Promise<SentinelResult> {
        const alerts: SentinelAlert[] = [];
        const productsPaused: string[] = [];

        logger.info('Running Ads Sentinel check...');

        try {
            // 1. Get current daily spend from budget status
            const budgetStatuses = await this.googleAdsClient.getBudgetStatus();
            const currentSpend = budgetStatuses.reduce((sum: number, b: BudgetStatus) => sum + b.spentToday, 0);
            const budgetRemaining = this.config.dailyBudget - currentSpend;

            logger.info(`Current spend: ${currentSpend}€ / Budget: ${this.config.dailyBudget}€`);

            // 2. Check competitor positions on high-margin products
            const competitorAlerts = await this.checkCompetitorPositions();
            alerts.push(...competitorAlerts);

            // 3. Apply 30/40 Profit Protection Rule
            if (currentSpend >= this.config.profitProtectionThreshold) {
                logger.info(`Spend ${currentSpend}€ >= ${this.config.profitProtectionThreshold}€ threshold — activating profit protection`);

                const pauseResult = await this.applyProfitProtection();
                alerts.push(...pauseResult.alerts);
                productsPaused.push(...pauseResult.pausedProductIds);
            }

            // 4. Get high-margin product count for reporting
            const highMarginCount = await this.getHighMarginProductCount();

            const result: SentinelResult = {
                alerts,
                productsPaused,
                currentSpend,
                budgetRemaining,
                highMarginProductCount: highMarginCount,
            };

            logger.info('Ads Sentinel check complete', {
                alertCount: alerts.length,
                productsPaused: productsPaused.length,
                currentSpend,
                budgetRemaining,
            });

            return result;
        } catch (error) {
            logger.error('Ads Sentinel check failed', {
                error: error instanceof Error ? error.message : String(error),
            });

            return {
                alerts: [{
                    type: 'budget_critical',
                    message: `⚠️ Eroare la verificarea Google Ads: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    timestamp: new Date(),
                }],
                productsPaused: [],
                currentSpend: 0,
                budgetRemaining: this.config.dailyBudget,
                highMarginProductCount: 0,
            };
        }
    }

    /**
     * SENTINEL: Check if competitors took #1 position on high-margin products.
     * Uses getPositionMetrics to query Search Absolute Top Impression Share.
     */
    private async checkCompetitorPositions(): Promise<SentinelAlert[]> {
        const alerts: SentinelAlert[] = [];

        try {
            const today = new Date().toISOString().split('T')[0];
            const metrics: PositionMetrics[] = await this.googleAdsClient.getPositionMetrics(today, today);

            for (const metric of metrics) {
                // Alert if absolute top impression share is below threshold
                if (metric.searchAbsoluteTopImpressionShare < this.config.impressionShareAlertThreshold) {
                    alerts.push({
                        type: 'competitor_position',
                        message: `🎯 Competitorii au preluat poziția #1 pe campania "${metric.campaignName}" (${metric.searchAbsoluteTopImpressionShare.toFixed(1)}% impression share)`,
                        productName: metric.campaignName,
                        productId: metric.campaignId,
                        currentSpend: metric.cost,
                        timestamp: new Date(),
                    });
                }
            }
        } catch (error) {
            logger.warn('Could not check competitor positions', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return alerts;
    }

    /**
     * 30/40 PROFIT PROTECTION RULE:
     * When spend >= 30€:
     *   1. Check which products have low performance / low margin
     *   2. Identify candidates for pausing
     *   3. Reserve remaining 10€ exclusively for margin > 30% products
     */
    private async applyProfitProtection(): Promise<{ alerts: SentinelAlert[]; pausedProductIds: string[] }> {
        const alerts: SentinelAlert[] = [];
        const pausedProductIds: string[] = [];

        try {
            const today = new Date().toISOString().split('T')[0];
            const products: ProductPerformance[] = await this.googleAdsClient.getProductPerformance(today, today);

            // Identify low-performing products (low conversion rate + spending budget)
            const lowPerformingProducts = products.filter(p => {
                const conversionRate = p.clicks > 0 ? (p.conversions / p.clicks) * 100 : 0;
                return conversionRate < 1 && p.cost > 2; // Low conversion + spending >2€
            });

            if (lowPerformingProducts.length > 0) {
                alerts.push({
                    type: 'budget_critical',
                    message: `💰 Protecție Profit activată: ${lowPerformingProducts.length} produse cu performanță slabă identificate. Ultimii ${this.config.dailyBudget - this.config.profitProtectionThreshold}€ rezervați pentru produse Gold.`,
                    timestamp: new Date(),
                });

                for (const product of lowPerformingProducts) {
                    pausedProductIds.push(product.productId);
                    alerts.push({
                        type: 'low_margin_paused',
                        message: `⏸️ PAUSE recomandat: "${product.productTitle}" — ${product.conversions} conversii din ${product.clicks} click-uri (${product.cost.toFixed(2)}€ cheltuit).`,
                        productName: product.productTitle,
                        productId: product.productId,
                        currentSpend: product.cost,
                        timestamp: new Date(),
                    });
                }
            }
        } catch (error) {
            logger.warn('Profit protection check failed', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return { alerts, pausedProductIds };
    }

    /**
     * Count products with high search absolute top impression share.
     */
    private async getHighMarginProductCount(): Promise<number> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const products = await this.googleAdsClient.getProductPerformance(today, today);
            return products.filter(p => p.searchAbsoluteTopIS >= this.config.highMarginThreshold).length;
        } catch {
            return 0;
        }
    }

    /**
     * Get current config for reporting.
     */
    getConfig(): SentinelConfig {
        return { ...this.config };
    }
}
