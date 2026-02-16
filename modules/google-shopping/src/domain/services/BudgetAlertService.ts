/**
 * Budget Alert Service
 * Enterprise service for monitoring Google Shopping budget and sending alerts.
 * 
 * Features:
 * - Budget threshold monitoring (e.g., 40€)
 * - Alert when 80% consumed
 * - Auto-prioritization of high-margin products
 * - Webhook notifications
 */

import { createModuleLogger } from '@shared/utils/logger';
import { GoogleAdsClient, BudgetStatus } from '../../infrastructure/api-clients/GoogleAdsClient';

const logger = createModuleLogger('budget-alert');

export enum AlertSeverity {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical',
}

export interface BudgetAlert {
    campaignId: string;
    campaignName: string;
    severity: AlertSeverity;
    message: string;
    currentSpend: number;
    budgetLimit: number;
    percentageUsed: number;
    timestamp: Date;
    recommendedAction: string;
}

export interface BudgetAlertConfig {
    dailyBudgetLimit: number; // e.g., 40 EUR
    warningThreshold: number; // e.g., 70%
    criticalThreshold: number; // e.g., 90%
    webhookUrl?: string;
    emailRecipients?: string[];
}

export class BudgetAlertService {
    private alertHistory: BudgetAlert[] = [];

    constructor(
        private googleAdsClient: GoogleAdsClient,
        private config: BudgetAlertConfig
    ) { }

    /**
     * Determine alert severity based on percentage used.
     */
    private getSeverity(percentageUsed: number): AlertSeverity {
        if (percentageUsed >= this.config.criticalThreshold) {
            return AlertSeverity.CRITICAL;
        } else if (percentageUsed >= this.config.warningThreshold) {
            return AlertSeverity.WARNING;
        }
        return AlertSeverity.INFO;
    }

    /**
     * Generate recommended action based on severity.
     */
    private getRecommendedAction(severity: AlertSeverity, percentageUsed: number): string {
        switch (severity) {
            case AlertSeverity.CRITICAL:
                return 'URGENT: Pause low-margin products immediately. Consider pausing all campaigns and reviewing ROI.';
            case AlertSeverity.WARNING:
                return 'Review campaign performance. Consider reducing bids on low-performing products.';
            default:
                return 'Budget consumption on track. Continue monitoring.';
        }
    }

    /**
     * Check budget status and generate alerts if needed.
     */
    async checkBudgetAlerts(): Promise<BudgetAlert[]> {
        const alerts: BudgetAlert[] = [];

        try {
            const budgetStatuses = await this.googleAdsClient.getBudgetStatus();

            for (const status of budgetStatuses) {
                // Check against configured daily limit
                const effectiveBudget = Math.min(status.dailyBudget, this.config.dailyBudgetLimit);
                const effectivePercentage = (status.spentToday / effectiveBudget) * 100;

                if (effectivePercentage >= this.config.warningThreshold) {
                    const severity = this.getSeverity(effectivePercentage);

                    const alert: BudgetAlert = {
                        campaignId: status.campaignId,
                        campaignName: status.campaignName,
                        severity,
                        message: `Budget ${effectivePercentage.toFixed(1)}% consumed (${status.spentToday.toFixed(2)}€ / ${effectiveBudget.toFixed(2)}€)`,
                        currentSpend: status.spentToday,
                        budgetLimit: effectiveBudget,
                        percentageUsed: effectivePercentage,
                        timestamp: new Date(),
                        recommendedAction: this.getRecommendedAction(severity, effectivePercentage),
                    };

                    alerts.push(alert);
                    this.alertHistory.push(alert);

                    logger.warn('Budget alert generated', {
                        campaign: status.campaignName,
                        severity,
                        percentage: effectivePercentage,
                    });
                }
            }

            // Send notifications if configured
            if (alerts.length > 0) {
                await this.sendNotifications(alerts);
            }

            return alerts;
        } catch (error) {
            logger.error('Failed to check budget alerts', { error });
            throw error;
        }
    }

    /**
     * Send alert notifications via webhook and/or email.
     */
    private async sendNotifications(alerts: BudgetAlert[]): Promise<void> {
        // Send webhook notification
        if (this.config.webhookUrl) {
            try {
                await fetch(this.config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'BUDGET_ALERT',
                        alerts: alerts.map(a => ({
                            campaign: a.campaignName,
                            severity: a.severity,
                            message: a.message,
                            recommendation: a.recommendedAction,
                        })),
                        timestamp: new Date().toISOString(),
                    }),
                });

                logger.info('Webhook notification sent', { alertCount: alerts.length });
            } catch (error) {
                logger.error('Failed to send webhook notification', { error });
            }
        }

        // Log email notification (actual implementation would use email service)
        if (this.config.emailRecipients?.length) {
            logger.info('Email notification would be sent', {
                recipients: this.config.emailRecipients,
                alerts: alerts.length,
            });
        }
    }

    /**
     * Get current budget status with recommendations.
     */
    async getBudgetStatusWithRecommendations(): Promise<{
        status: BudgetStatus[];
        alerts: BudgetAlert[];
        recommendations: string[];
    }> {
        const statuses = await this.googleAdsClient.getBudgetStatus();
        const alerts = await this.checkBudgetAlerts();

        const recommendations: string[] = [];

        // Calculate total spend
        const totalSpend = statuses.reduce((sum, s) => sum + s.spentToday, 0);
        const percentOfLimit = (totalSpend / this.config.dailyBudgetLimit) * 100;

        if (percentOfLimit >= 90) {
            recommendations.push('🔴 CRITICAL: Budget nearly exhausted. Pause all low-margin products.');
        } else if (percentOfLimit >= 70) {
            recommendations.push('🟠 WARNING: Budget consumption high. Prioritize high-margin products.');
        } else if (percentOfLimit >= 50) {
            recommendations.push('🟡 INFO: Budget on track. Monitor position metrics for high-margin products.');
        } else {
            recommendations.push('🟢 OK: Budget healthy. Consider increasing bids on top performers.');
        }

        return {
            status: statuses,
            alerts,
            recommendations,
        };
    }

    /**
     * Get alert history for reporting.
     */
    getAlertHistory(limit: number = 100): BudgetAlert[] {
        return this.alertHistory.slice(-limit);
    }

    /**
     * Clear alert history.
     */
    clearAlertHistory(): void {
        this.alertHistory = [];
    }

    /**
     * Get products that should be paused based on budget status.
     * Returns IDs of low-margin products when budget is critical.
     */
    async getProductsToPause(
        allProductIds: string[],
        highMarginProductIds: string[]
    ): Promise<string[]> {
        const { alerts } = await this.getBudgetStatusWithRecommendations();

        const hasCriticalAlert = alerts.some(a => a.severity === AlertSeverity.CRITICAL);

        if (!hasCriticalAlert) {
            return []; // No need to pause anything
        }

        // Return IDs of products that are NOT high-margin
        const productsToPause = allProductIds.filter(
            id => !highMarginProductIds.includes(id)
        );

        logger.warn('Products marked for pause due to budget constraints', {
            total: allProductIds.length,
            highMargin: highMarginProductIds.length,
            toPause: productsToPause.length,
        });

        return productsToPause;
    }
}
