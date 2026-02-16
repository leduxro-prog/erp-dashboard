/**
 * Smart Inventory Service
 * Velocity-based stock analysis with two conditional rules:
 * 
 * Rule 1: PROTECȚIE MARJĂ (Critical Restock Alert)
 *   Condition: margin > 30% AND estimated stock < 7 days
 *   Output: "⚠️ RESTOCK URGENT: [Name] - Risc de epuizare stoc."
 * 
 * Rule 2: OPTIMIZARE CAPITAL (Liquidation Suggestion)
 *   Condition: stock age > 90 days AND monthly sales < 3 units
 *   Output: "📉 SUGESTIE LICHIDARE: [Name] - Blochează capital."
 */

import { DataSource } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';
import { SmartInventoryAlert, AlertType } from '../../application/dtos/SmartInventoryAlert';

const logger = createModuleLogger('smart-inventory');

export interface SmartInventoryConfig {
    /** Margin threshold for Rule 1 (default: 30%) */
    highMarginThreshold: number;
    /** Days of stock threshold for Rule 1 (default: 7) */
    criticalDaysThreshold: number;
    /** Stock age threshold for Rule 2 in days (default: 90) */
    staleStockAgeDays: number;
    /** Monthly sales threshold for Rule 2 (default: 3 units) */
    lowSalesThreshold: number;
    /** Rolling window in days for velocity calculation (default: 30) */
    velocityWindowDays: number;
}

interface ProductStockData {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    costPrice: number;
    sellingPrice: number;
    lastReceivedDate: Date | null;
    totalSoldLast30Days: number;
}

export class SmartInventoryService {
    private config: SmartInventoryConfig;

    constructor(
        private dataSource: DataSource,
        config?: Partial<SmartInventoryConfig>,
    ) {
        this.config = {
            highMarginThreshold: config?.highMarginThreshold ?? 30,
            criticalDaysThreshold: config?.criticalDaysThreshold ?? 7,
            staleStockAgeDays: config?.staleStockAgeDays ?? 90,
            lowSalesThreshold: config?.lowSalesThreshold ?? 3,
            velocityWindowDays: config?.velocityWindowDays ?? 30,
        };
    }

    /**
     * Run full smart inventory analysis.
     * Returns all alerts sorted by urgency (RESTOCK_URGENT first).
     */
    async analyzeCriticalStock(): Promise<SmartInventoryAlert[]> {
        logger.info('Running smart inventory analysis...');

        const alerts: SmartInventoryAlert[] = [];

        try {
            const products = await this.getProductStockData();

            for (const product of products) {
                const margin = this.calculateMargin(product.costPrice, product.sellingPrice);

                // Rule 1: PROTECȚIE MARJĂ
                const restockAlert = this.checkRestockRule(product, margin);
                if (restockAlert) {
                    alerts.push(restockAlert);
                }

                // Rule 2: OPTIMIZARE CAPITAL
                const liquidationAlert = this.checkLiquidationRule(product, margin);
                if (liquidationAlert) {
                    alerts.push(liquidationAlert);
                }
            }

            // Sort: RESTOCK_URGENT first, then by estimated days left (ascending)
            alerts.sort((a, b) => {
                if (a.alertType !== b.alertType) {
                    return a.alertType === 'RESTOCK_URGENT' ? -1 : 1;
                }
                if (a.alertType === 'RESTOCK_URGENT') {
                    return (a.estimatedDaysLeft ?? 0) - (b.estimatedDaysLeft ?? 0);
                }
                return (b.stockAgeDays ?? 0) - (a.stockAgeDays ?? 0);
            });

            logger.info(`Smart inventory analysis complete: ${alerts.length} alerts`, {
                restockAlerts: alerts.filter(a => a.alertType === 'RESTOCK_URGENT').length,
                liquidationAlerts: alerts.filter(a => a.alertType === 'LIQUIDATION').length,
                totalProducts: products.length,
            });
        } catch (error) {
            logger.error('Smart inventory analysis failed', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return alerts;
    }

    /**
     * Rule 1: PROTECȚIE MARJĂ
     * Condition: margin > 30% AND estimated stock days < 7
     */
    private checkRestockRule(product: ProductStockData, margin: number): SmartInventoryAlert | null {
        if (margin <= this.config.highMarginThreshold) {
            return null;
        }

        const avgDailySales = product.totalSoldLast30Days / this.config.velocityWindowDays;
        const estimatedDaysLeft = avgDailySales > 0
            ? Math.round(product.currentStock / avgDailySales)
            : Infinity;

        if (estimatedDaysLeft >= this.config.criticalDaysThreshold) {
            return null;
        }

        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            alertType: 'RESTOCK_URGENT' as AlertType,
            currentStock: product.currentStock,
            estimatedDaysLeft,
            marginPercentage: Math.round(margin * 100) / 100,
            recommendedAction: `⚠️ RESTOCK URGENT: ${product.name} - Risc de epuizare stoc. Stoc estimat: ${estimatedDaysLeft} zile.`,
        };
    }

    /**
     * Rule 2: OPTIMIZARE CAPITAL
     * Condition: stock age > 90 days AND monthly sales < 3 units
     */
    private checkLiquidationRule(product: ProductStockData, margin: number): SmartInventoryAlert | null {
        if (!product.lastReceivedDate) {
            return null;
        }

        const now = new Date();
        const stockAgeDays = Math.floor((now.getTime() - product.lastReceivedDate.getTime()) / (1000 * 60 * 60 * 24));

        if (stockAgeDays <= this.config.staleStockAgeDays) {
            return null;
        }

        if (product.totalSoldLast30Days >= this.config.lowSalesThreshold) {
            return null;
        }

        return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            alertType: 'LIQUIDATION' as AlertType,
            currentStock: product.currentStock,
            stockAgeDays,
            monthlySales: product.totalSoldLast30Days,
            marginPercentage: Math.round(margin * 100) / 100,
            recommendedAction: `📉 SUGESTIE LICHIDARE: ${product.name} - Blochează capital. Vechime: ${stockAgeDays} zile, vânzări: ${product.totalSoldLast30Days}/lună.`,
        };
    }

    /**
     * Calculate margin percentage: (sellingPrice - costPrice) / sellingPrice × 100
     */
    private calculateMargin(costPrice: number, sellingPrice: number): number {
        if (sellingPrice <= 0) return 0;
        return ((sellingPrice - costPrice) / sellingPrice) * 100;
    }

    /**
     * Fetch all products with stock, pricing, and sales velocity data.
     */
    private async getProductStockData(): Promise<ProductStockData[]> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.config.velocityWindowDays);

            // Query products with stock levels and sales velocity
            const results = await this.dataSource.query(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          COALESCE(SUM(sl.quantity_available), 0) as current_stock,
          COALESCE((p.metadata->>'cost')::numeric, p.base_price * 0.7) as cost_price,
          p.base_price as selling_price,
          MAX(sl.updated_at) as last_received_date,
          COALESCE(sales.total_sold, 0) as total_sold_last_30_days
        FROM products p
        LEFT JOIN stock_levels sl ON sl.product_id = p.id
        LEFT JOIN (
          SELECT oi.product_id, SUM(oi.quantity) as total_sold
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at >= $1
            AND o.status NOT IN ('cancelled', 'draft')
          GROUP BY oi.product_id
        ) sales ON sales.product_id = p.id
        WHERE sl.quantity_available > 0 OR sales.total_sold > 0
        GROUP BY p.id, p.name, p.sku, p.base_price, p.metadata, sales.total_sold
      `, [thirtyDaysAgo.toISOString()]);

            return results.map((row: any) => ({
                id: row.id,
                name: row.name,
                sku: row.sku || '',
                currentStock: parseInt(row.current_stock, 10) || 0,
                costPrice: parseFloat(row.cost_price) || 0,
                sellingPrice: parseFloat(row.selling_price) || 0,
                lastReceivedDate: row.last_received_date ? new Date(row.last_received_date) : null,
                totalSoldLast30Days: parseInt(row.total_sold_last_30_days, 10) || 0,
            }));
        } catch (error) {
            logger.error('Failed to fetch product stock data', {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }

    /**
     * Get current config for testing/reporting.
     */
    getConfig(): SmartInventoryConfig {
        return { ...this.config };
    }
}
