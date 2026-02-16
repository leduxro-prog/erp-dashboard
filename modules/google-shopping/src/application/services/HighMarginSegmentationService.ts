/**
 * High-Margin Segmentation Service
 * Enterprise service for segmenting products by profit margin.
 * 
 * Features:
 * - Identify products with margin >30%
 * - Priority scoring for ad spend allocation
 * - Integration with inventory and pricing modules
 */

import { DataSource, Repository } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('high-margin-segmentation');

export interface ProductMarginData {
    productId: string;
    sku: string;
    name: string;
    costPrice: number;
    sellingPrice: number;
    marginPercentage: number;
    marginAmount: number;
    isHighMargin: boolean;
    priorityScore: number;
}

export interface SegmentationConfig {
    highMarginThreshold: number; // e.g., 30 for 30%
    priorityWeights: {
        margin: number;
        salesVolume: number;
        conversionRate: number;
    };
}

export interface HighMarginProduct {
    productId: string;
    sku: string;
    name: string;
    marginPercentage: number;
    priorityScore: number;
    recommendedBidMultiplier: number;
}

export class HighMarginSegmentationService {
    private config: SegmentationConfig;

    constructor(
        private dataSource: DataSource,
        config?: Partial<SegmentationConfig>
    ) {
        this.config = {
            highMarginThreshold: config?.highMarginThreshold ?? 30,
            priorityWeights: {
                margin: config?.priorityWeights?.margin ?? 0.5,
                salesVolume: config?.priorityWeights?.salesVolume ?? 0.3,
                conversionRate: config?.priorityWeights?.conversionRate ?? 0.2,
            },
        };
    }

    /**
     * Calculate margin percentage for a product.
     */
    calculateMargin(costPrice: number, sellingPrice: number): { percentage: number; amount: number } {
        if (sellingPrice <= 0) {
            return { percentage: 0, amount: 0 };
        }

        const marginAmount = sellingPrice - costPrice;
        const marginPercentage = (marginAmount / sellingPrice) * 100;

        return {
            percentage: Math.round(marginPercentage * 100) / 100,
            amount: Math.round(marginAmount * 100) / 100,
        };
    }

    /**
     * Check if a product is high-margin based on threshold.
     */
    isHighMargin(marginPercentage: number): boolean {
        return marginPercentage >= this.config.highMarginThreshold;
    }

    /**
     * Calculate priority score for a product.
     * Higher score = more important for ad spend.
     */
    calculatePriorityScore(
        marginPercentage: number,
        salesVolume: number,
        conversionRate: number
    ): number {
        const weights = this.config.priorityWeights;

        // Normalize values to 0-1 range
        const normalizedMargin = Math.min(marginPercentage / 100, 1);
        const normalizedVolume = Math.min(salesVolume / 1000, 1); // Assume 1000+ is max
        const normalizedConversion = Math.min(conversionRate / 10, 1); // Assume 10% is max

        const score =
            normalizedMargin * weights.margin +
            normalizedVolume * weights.salesVolume +
            normalizedConversion * weights.conversionRate;

        return Math.round(score * 100);
    }

    /**
     * Get recommended bid multiplier based on margin.
     * High-margin products get higher bids.
     */
    getRecommendedBidMultiplier(marginPercentage: number): number {
        if (marginPercentage >= 50) return 1.5;
        if (marginPercentage >= 40) return 1.3;
        if (marginPercentage >= 30) return 1.15;
        if (marginPercentage >= 20) return 1.0;
        return 0.8; // Low margin = reduce bids
    }

    /**
     * Analyze products and return high-margin segments.
     */
    async getHighMarginProducts(
        products: Array<{
            id: string;
            sku: string;
            name: string;
            costPrice: number;
            sellingPrice: number;
            salesVolume?: number;
            conversionRate?: number;
        }>
    ): Promise<HighMarginProduct[]> {
        const highMarginProducts: HighMarginProduct[] = [];

        for (const product of products) {
            const { percentage: marginPercentage } = this.calculateMargin(
                product.costPrice,
                product.sellingPrice
            );

            if (!this.isHighMargin(marginPercentage)) {
                continue;
            }

            const priorityScore = this.calculatePriorityScore(
                marginPercentage,
                product.salesVolume ?? 0,
                product.conversionRate ?? 0
            );

            highMarginProducts.push({
                productId: product.id,
                sku: product.sku,
                name: product.name,
                marginPercentage,
                priorityScore,
                recommendedBidMultiplier: this.getRecommendedBidMultiplier(marginPercentage),
            });
        }

        // Sort by priority score (highest first)
        highMarginProducts.sort((a, b) => b.priorityScore - a.priorityScore);

        logger.info('High-margin segmentation complete', {
            total: products.length,
            highMargin: highMarginProducts.length,
            threshold: this.config.highMarginThreshold,
        });

        return highMarginProducts;
    }

    /**
     * Get product IDs that should be prioritized for limited budget.
     */
    async getPriorityProductIds(
        products: Array<{
            id: string;
            sku: string;
            name: string;
            costPrice: number;
            sellingPrice: number;
            salesVolume?: number;
            conversionRate?: number;
        }>,
        maxProducts: number
    ): Promise<string[]> {
        const highMargin = await this.getHighMarginProducts(products);
        return highMargin.slice(0, maxProducts).map(p => p.productId);
    }

    /**
     * Get segmentation summary for reporting.
     */
    async getSegmentationSummary(
        products: Array<{
            id: string;
            costPrice: number;
            sellingPrice: number;
        }>
    ): Promise<{
        totalProducts: number;
        highMarginCount: number;
        highMarginPercentage: number;
        averageMargin: number;
        marginDistribution: Record<string, number>;
    }> {
        let highMarginCount = 0;
        let totalMargin = 0;
        const distribution: Record<string, number> = {
            '0-10%': 0,
            '10-20%': 0,
            '20-30%': 0,
            '30-40%': 0,
            '40-50%': 0,
            '50%+': 0,
        };

        for (const product of products) {
            const { percentage } = this.calculateMargin(product.costPrice, product.sellingPrice);
            totalMargin += percentage;

            if (this.isHighMargin(percentage)) {
                highMarginCount++;
            }

            if (percentage < 10) distribution['0-10%']++;
            else if (percentage < 20) distribution['10-20%']++;
            else if (percentage < 30) distribution['20-30%']++;
            else if (percentage < 40) distribution['30-40%']++;
            else if (percentage < 50) distribution['40-50%']++;
            else distribution['50%+']++;
        }

        return {
            totalProducts: products.length,
            highMarginCount,
            highMarginPercentage: products.length > 0
                ? Math.round((highMarginCount / products.length) * 100)
                : 0,
            averageMargin: products.length > 0
                ? Math.round((totalMargin / products.length) * 100) / 100
                : 0,
            marginDistribution: distribution,
        };
    }
}
