/**
 * Daily Report Formatter
 * Formats financial KPIs and inventory alerts into compact WhatsApp messages.
 * 
 * Output format:
 * [RAPORT ZILNIC CYPHER] 📅 Data: DD.MM.YYYY
 * 
 * 💰 FINANCIAR
 * • Venit Brut: [SUMA] €
 * • Profit Net: [SUMA] €
 * • Taxe (Est.): [SUMA] €
 * 
 * 📦 STOC CRITIC
 * • [Nume Produs]: [Acțiune Recomandată]
 */

import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('daily-report-formatter');

export interface DailyFinancialKPIs {
    date: string;
    grossRevenue: number;
    cogs: number;
    opEx: number;
    netProfit: number;
    tvaCollected: number;
    estimatedTax: number;
    invoiceCount: number;
    isComplete: boolean;
    incompleteReason?: string;
}

export interface SmartInventoryAlert {
    productId: string;
    productName: string;
    sku: string;
    alertType: 'RESTOCK_URGENT' | 'LIQUIDATION';
    currentStock: number;
    estimatedDaysLeft?: number;
    stockAgeDays?: number;
    monthlySales?: number;
    marginPercentage: number;
    recommendedAction: string;
}

export class DailyReportFormatter {

    /**
     * Format the complete daily report for WhatsApp delivery.
     * Returns null if data is incomplete (NEVER sends bad data).
     */
    formatDailyReport(kpis: DailyFinancialKPIs, alerts: SmartInventoryAlert[]): string | null {
        // CRITICAL: Never send report with incomplete data
        if (!kpis.isComplete) {
            logger.warn('Data incomplete — report blocked', {
                reason: kpis.incompleteReason,
                date: kpis.date,
            });
            return null;
        }

        const lines: string[] = [];

        // Header
        lines.push(`[RAPORT ZILNIC CYPHER] 📅 Data: ${kpis.date}`);
        lines.push('');

        // Financial section
        lines.push('💰 FINANCIAR');
        lines.push(`• Venit Brut: ${this.formatCurrency(kpis.grossRevenue)} €`);
        lines.push(`• Profit Net: ${this.formatCurrency(kpis.netProfit)} €`);
        lines.push(`• Taxe (Est.): ${this.formatCurrency(kpis.tvaCollected + kpis.estimatedTax)} €`);
        lines.push(`• Facturi: ${kpis.invoiceCount}`);

        // Stock section (only if there are alerts)
        if (alerts.length > 0) {
            lines.push('');
            lines.push('📦 STOC CRITIC');

            // Show restock alerts first (max 5)
            const restockAlerts = alerts.filter(a => a.alertType === 'RESTOCK_URGENT').slice(0, 5);
            for (const alert of restockAlerts) {
                lines.push(`• ${alert.recommendedAction}`);
            }

            // Then liquidation alerts (max 3)
            const liquidationAlerts = alerts.filter(a => a.alertType === 'LIQUIDATION').slice(0, 3);
            for (const alert of liquidationAlerts) {
                lines.push(`• ${alert.recommendedAction}`);
            }

            // Summary if more alerts exist
            const totalShown = restockAlerts.length + liquidationAlerts.length;
            if (alerts.length > totalShown) {
                lines.push(`• ... și încă ${alerts.length - totalShown} alerte`);
            }
        } else {
            lines.push('');
            lines.push('📦 STOC: ✅ Nicio alertă critică');
        }

        return lines.join('\n');
    }

    /**
     * Format an error notification when data retrieval fails.
     * Sent instead of a report to ensure the user knows there was a problem.
     */
    formatErrorReport(date: string, error: string): string {
        return [
            `[CYPHER ⚠️ EROARE CONEXIUNE] 📅 ${date}`,
            '',
            '❌ Raportul zilnic nu a putut fi generat.',
            `Motiv: ${error}`,
            '',
            'Verificați conexiunea la API-ul de contabilitate.',
        ].join('\n');
    }

    /**
     * Format Google Ads sentinel alert.
     */
    formatAdsSentinelAlert(alerts: AdsSentinelAlert[]): string | null {
        if (alerts.length === 0) return null;

        const lines: string[] = [];
        lines.push('[CYPHER 🎯 ALERTĂ ADS]');
        lines.push('');

        for (const alert of alerts) {
            lines.push(`• ${alert.message}`);
        }

        return lines.join('\n');
    }

    /**
     * Format currency with 2 decimal places and thousand separators.
     */
    private formatCurrency(amount: number): string {
        return amount.toLocaleString('ro-RO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }
}

export interface AdsSentinelAlert {
    type: 'competitor_position' | 'budget_critical' | 'low_margin_paused';
    message: string;
    productName?: string;
    currentSpend?: number;
}
